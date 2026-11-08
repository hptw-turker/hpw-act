/** v2.13.0: "Yapay zekâdan yardım al" — AI Hedef ve Aksiyon Planı.
 * Yeni yetki üretmez: bağlantıyı yalnız şirket geneli İK yöneticisi yönetir; plan yalnız hedefin biriminde mevcut hedef yetkisi olan kullanıcıya üretilir;
 * aksiyon yalnız mevcut aksiyon ucundan (kabul edilmiş hedef, birim başına etkin aksiyon sınırı, yetki) açılır. AI hiçbir hedefi/aksiyonu kaydetmez ya da onaylamaz.
 * Yalnız müşteri oturumları kullanır (HPW personeli şirketin anahtarıyla çağrı yapamaz). */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { withContext, HttpError } from '../db.js';
import { requireTenantAsync as requireTenant, requireUnitProfile, dbCtx, audit, type Principal } from '../auth.js';
import { sealProviderKey, openProviderKey } from '../ai/crypto.js';
import { buildContext, basisFromTarget, basisFromPreview } from '../ai/context.js';
import { validatePlan } from '../ai/validate.js';
import { callPlan, aiRuntime } from '../ai/openai.js';
import { PROMPT_VERSION, SCHEMA_VERSION, type AiPlanOutput } from '../ai/prompt.js';
import { openActionTx } from './analysis.js';

type P = Principal & { tenantId: string };
const customerOnly = (p: P) => { if (p.realm !== 'customer') throw new HttpError(403, 'customer_only', 'Yapay zekâ özelliğini yalnız şirket kullanıcıları kullanır'); };
const requireHrAdmin = (p: P) => { customerOnly(p); if (p.profile !== 'HR_ADMIN' || !p.companyWide) throw new HttpError(403, 'forbidden', 'Yapay zekâ bağlantısını yalnız şirket geneli İK yöneticisi yönetir'); };
const TARGET_PROFILES = ['HR_ADMIN', 'HR_PARTNER', 'REGION_MANAGER', 'UNIT_MANAGER'] as const;

async function loadTarget(p: P, ltid: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ltid)) throw new HttpError(404, 'not_found');
  const t = await withContext(dbCtx(p), async tx => (await tx.query('SELECT id, cycle_id, unit_id, item_code, status FROM local_target WHERE tenant_id = $1 AND id = $2', [p.tenantId, ltid])).rows[0] as { id: string; cycle_id: string; unit_id: string; item_code: string; status: string } | undefined);
  if (!t) throw new HttpError(404, 'not_found'); return t;
}
async function requireTargetRight(p: P, unitId: string) { await withContext(dbCtx(p), tx => requireUnitProfile(tx, p, unitId, ...TARGET_PROFILES)); }
async function providerKey(p: P): Promise<string | null> {
  const row = await withContext(dbCtx(p), async tx => (await tx.query('SELECT key_sealed FROM tenant_ai_config WHERE tenant_id = $1', [p.tenantId])).rows[0] as { key_sealed: string } | undefined);
  if (!row) return null; try { return openProviderKey(p.tenantId, row.key_sealed); } catch { throw new HttpError(500, 'ai_key_unreadable', 'Yapay zekâ anahtarı çözülemedi; İK yöneticisi anahtarı yeniden girmelidir'); }
}
async function logCall(p: P, targetId: string, fingerprint: string, outcome: string, latency: number | null) {
  await withContext(dbCtx(p), tx => tx.query('INSERT INTO ai_call_log (tenant_id, target_id, requested_by, fingerprint, outcome, latency_ms) VALUES ($1,$2,$3,$4,$5,$6)', [p.tenantId, targetId, p.userId, fingerprint, outcome, latency]));
}
const planDto = (r: { id: string; fingerprint: string; prompt_version: string; schema_version: string; model: string; output: AiPlanOutput; data_used: unknown; created_at: string; opened?: number[] | null }, currentFp: string | null) => ({ id: r.id, promptVersion: r.prompt_version, schemaVersion: r.schema_version, model: r.model, createdAt: r.created_at, stale: currentFp !== null && currentFp !== r.fingerprint, plan: r.output, dataUsed: r.data_used, openedIndices: r.opened ?? [] });
const PLAN_COLS = "id, fingerprint, prompt_version, schema_version, model, output, data_used, created_at, (SELECT array_agg(action_index ORDER BY action_index) FROM ai_plan_action x WHERE x.tenant_id = ai_plan.tenant_id AND x.plan_id = ai_plan.id) AS opened";

export async function aiRoutes(app: FastifyInstance) {
  // durum: düğmenin gösterilip gösterilmeyeceği (anahtar değeri hiçbir zaman dönmez)
  app.get('/api/t/:tid/ai/status', async req => { const p = await requireTenant(req, (req.params as { tid: string }).tid); const rt = aiRuntime();
    const row = await withContext(dbCtx(p), async tx => (await tx.query('SELECT key_last4, updated_at FROM tenant_ai_config WHERE tenant_id = $1', [p.tenantId])).rows[0] as { key_last4: string; updated_at: string } | undefined);
    const canManage = p.realm === 'customer' && p.profile === 'HR_ADMIN' && !!p.companyWide;
    return { available: !!row && !!rt.model && p.realm === 'customer', configured: !!row, modelConfigured: !!rt.model, canManage, ...(canManage ? { keyLast4: row?.key_last4 ?? null, updatedAt: row?.updated_at ?? null, model: rt.model } : {}) };
  });
  app.post('/api/t/:tid/ai/config', { schema: { body: { type: 'object', required: ['apiKey'], properties: { apiKey: { type: 'string', minLength: 20, maxLength: 400 } }, additionalProperties: false } } }, async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); requireHrAdmin(p);
    const key = (req.body as { apiKey: string }).apiKey.trim(); if (!/^sk-[A-Za-z0-9_-]{16,}$/.test(key)) throw new HttpError(422, 'invalid_key_format', 'Anahtar biçimi tanınmadı (sk- ile başlamalı)');
    const sealed = sealProviderKey(p.tenantId, key); const last4 = key.slice(-4);
    await withContext(dbCtx(p), async tx => {
      await tx.query('INSERT INTO tenant_ai_config (tenant_id, key_sealed, key_last4, updated_by) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id) DO UPDATE SET key_sealed = EXCLUDED.key_sealed, key_last4 = EXCLUDED.key_last4, updated_by = EXCLUDED.updated_by, updated_at = now()', [p.tenantId, sealed, last4, p.userId]);
      await audit(tx, p, 'tenant', p.tenantId, 'ai_config_set', null, { provider: 'openai', keyLast4: last4 }, 'yapay zekâ bağlantısı');
    });
    return { configured: true, keyLast4: last4 };
  });
  app.post('/api/t/:tid/ai/config/remove', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); requireHrAdmin(p);
    await withContext(dbCtx(p), async tx => { await tx.query('DELETE FROM tenant_ai_config WHERE tenant_id = $1', [p.tenantId]); await audit(tx, p, 'tenant', p.tenantId, 'ai_config_removed', null, null, 'yapay zekâ bağlantısı kaldırıldı'); });
    return { configured: false };
  });

  // ---- yardımcılar: bağlam (temel veri), plan satırı, önbellek araması, çağrı + doğrulama + kayıt
  const planExcl = async (p: P, planId: string | null) => planId ? (await withContext(dbCtx(p), async tx => (await tx.query('SELECT action_id FROM ai_plan_action WHERE tenant_id = $1 AND plan_id = $2', [p.tenantId, planId])).rows as { action_id: string }[])).map(r => r.action_id) : [];
  const ctxForTarget = async (req: FastifyRequest, p: P, t: { id: string; cycle_id: string; unit_id: string; item_code: string }, planId: string | null) => {
    const b = await basisFromTarget(app, req, p.tenantId, t); if ('error' in b) throw new HttpError(b.error === 'forbidden' ? 403 : 404, b.error);
    const built = await buildContext(app, req, p.tenantId, b, { excludeActionIds: await planExcl(p, planId) }); if ('error' in built) throw new HttpError(built.error === 'forbidden' ? 403 : 404, built.error); return built;
  };
  const ctxForPreview = async (req: FastifyRequest, p: P, cid: string, uid: string, code: string) => {
    const b = await basisFromPreview(app, req, p.tenantId, cid, uid, code);
    if ('error' in b) { if (b.error === 'not_targetable') throw new HttpError(b.status && b.status >= 400 && b.status < 500 ? b.status : 422, 'not_targetable', 'Bu madde için hedef önerisi üretilemiyor; yapay zekâ planı da üretilmez'); throw new HttpError(b.error === 'forbidden' ? 403 : 404, b.error); }
    const built = await buildContext(app, req, p.tenantId, b); if ('error' in built) throw new HttpError(built.error === 'forbidden' ? 403 : 404, built.error); return built;
  };
  const generate = async (p: P, reply: { code: (n: number) => unknown }, scope: { targetId: string | null; cycleId: string; unitId: string; itemCode: string }, built: { ctx: import('../ai/context.js').AiContext; fingerprint: string }, regenerate: boolean) => {
    const rt = aiRuntime(); const key = await providerKey(p);
    const log = (outcome: string, ms: number | null) => withContext(dbCtx(p), tx => tx.query('INSERT INTO ai_call_log (tenant_id, target_id, unit_id, item_code, requested_by, fingerprint, outcome, latency_ms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [p.tenantId, scope.targetId, scope.unitId, scope.itemCode, p.userId, built.fingerprint, outcome, ms]));
    if (!key || !rt.model) { await log('not_configured', null); throw new HttpError(409, 'ai_not_configured', !key ? 'Şirket için yapay zekâ bağlantısı kurulmamış' : 'Sunucuda yapay zekâ modeli yapılandırılmamış'); }
    if (!regenerate) {
      const cached = await withContext(dbCtx(p), async tx => (await tx.query(scope.targetId ? `SELECT ${PLAN_COLS} FROM ai_plan WHERE tenant_id = $1 AND target_id = $2 AND fingerprint = $3 ORDER BY created_at DESC LIMIT 1` : `SELECT ${PLAN_COLS} FROM ai_plan WHERE tenant_id = $1 AND target_id IS NULL AND cycle_id = $2 AND unit_id = $3 AND item_code = $4 AND fingerprint = $5 ORDER BY created_at DESC LIMIT 1`, scope.targetId ? [p.tenantId, scope.targetId, built.fingerprint] : [p.tenantId, scope.cycleId, scope.unitId, scope.itemCode, built.fingerprint])).rows[0]);
      if (cached) { await log('cached', null); return { plan: planDto(cached, built.fingerprint), cached: true }; }
    }
    const t0 = Date.now(); const res = await callPlan(key, built.ctx); const ms = Date.now() - t0;
    if (res.kind !== 'ok') { await log(res.kind === 'invalid_output' ? 'invalid_output' : res.kind, ms); reply.code(res.kind === 'timeout' ? 504 : 502); return { error: `ai_${res.kind}`, message: res.kind === 'refusal' ? 'Sağlayıcı isteği yanıtlamayı reddetti' : res.kind === 'timeout' ? 'Sağlayıcı zamanında yanıt vermedi' : 'Sağlayıcıdan geçerli yanıt alınamadı', details: null }; }
    const v = validatePlan(res.json, built.ctx);
    if (!v.ok) { await log(v.kind, ms); reply.code(502); return { error: `ai_${v.kind}`, message: v.kind === 'range_violation' ? 'Önerilen hedef izinli aralığın dışında; plan kaydedilmedi' : 'Yapay zekâ çıktısı şemadan geçmedi; plan kaydedilmedi', details: { errors: v.errors } }; }
    const row = await withContext(dbCtx(p), async tx => {
      const r = (await tx.query(`INSERT INTO ai_plan (tenant_id, target_id, cycle_id, unit_id, item_code, fingerprint, prompt_version, schema_version, model, output, data_used, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${PLAN_COLS}`, [p.tenantId, scope.targetId, scope.cycleId, scope.unitId, scope.itemCode, built.fingerprint, PROMPT_VERSION, SCHEMA_VERSION, rt.model, JSON.stringify(v.plan), JSON.stringify(Object.keys(built.ctx)), p.userId])).rows[0];
      await tx.query('INSERT INTO ai_call_log (tenant_id, target_id, unit_id, item_code, requested_by, fingerprint, outcome, latency_ms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [p.tenantId, scope.targetId, scope.unitId, scope.itemCode, p.userId, built.fingerprint, 'ok', ms]);
      return r;
    });
    return { plan: planDto(row, built.fingerprint), cached: false };
  };

  // ---- kayıtlı hedef için plan (v2.13.0 davranışı; bağlanmış önizleme planını da gösterir)
  app.get('/api/t/:tid/targets/:ltid/ai-plan', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); customerOnly(p); const t = await loadTarget(p, (req.params as { ltid: string }).ltid); await requireTargetRight(p, t.unit_id);
    const row = await withContext(dbCtx(p), async tx => (await tx.query(`SELECT ${PLAN_COLS} FROM ai_plan WHERE tenant_id = $1 AND target_id = $2 ORDER BY created_at DESC LIMIT 1`, [p.tenantId, t.id])).rows[0]);
    const built = await ctxForTarget(req as FastifyRequest, p, t, row?.id ?? null);
    return { plan: row ? planDto(row, built.fingerprint) : null, targetStatus: t.status, allowedTargetRange: built.ctx.allowedTargetRange, currentValue: built.ctx.currentValue };
  });
  app.post('/api/t/:tid/targets/:ltid/ai-plan', { schema: { body: { type: 'object', properties: { regenerate: { type: 'boolean' } }, additionalProperties: false } } }, async (req, reply) => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); customerOnly(p); const t = await loadTarget(p, (req.params as { ltid: string }).ltid); await requireTargetRight(p, t.unit_id);
    const built = await ctxForTarget(req as FastifyRequest, p, t, null);
    const r = await generate(p, reply, { targetId: t.id, cycleId: t.cycle_id, unitId: t.unit_id, itemCode: t.item_code }, built, !!(req.body as { regenerate?: boolean } | undefined)?.regenerate);
    return 'error' in r ? r : { ...r, targetStatus: t.status };
  });

  // ---- v2.13.1: hedef ÖNCESİ plan (hedef önizlemesi bağlamında; hedef kaydı yazılmaz)
  const previewParams = (req: FastifyRequest) => { const { cid, uid, code } = req.params as { cid: string; uid: string; code: string }; if (!/^[0-9a-f-]{36}$/i.test(cid) || !/^[0-9a-f-]{36}$/i.test(uid) || !/^[A-Za-z0-9_.-]{1,40}$/.test(code)) throw new HttpError(404, 'not_found'); return { cid, uid, code }; };
  app.get('/api/t/:tid/cycles/:cid/units/:uid/items/:code/ai-plan', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); customerOnly(p); const { cid, uid, code } = previewParams(req as FastifyRequest); await requireTargetRight(p, uid);
    const built = await ctxForPreview(req as FastifyRequest, p, cid, uid, code);
    const row = await withContext(dbCtx(p), async tx => (await tx.query(`SELECT ${PLAN_COLS} FROM ai_plan WHERE tenant_id = $1 AND target_id IS NULL AND cycle_id = $2 AND unit_id = $3 AND item_code = $4 ORDER BY created_at DESC LIMIT 1`, [p.tenantId, cid, uid, code])).rows[0]);
    return { plan: row ? planDto(row, built.fingerprint) : null, allowedTargetRange: built.ctx.allowedTargetRange, currentValue: built.ctx.currentValue }; // önizleme: hedef yok (targetStatus alanı dönmez)
  });
  app.post('/api/t/:tid/cycles/:cid/units/:uid/items/:code/ai-plan', { schema: { body: { type: 'object', properties: { regenerate: { type: 'boolean' } }, additionalProperties: false } } }, async (req, reply) => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); customerOnly(p); const { cid, uid, code } = previewParams(req as FastifyRequest); await requireTargetRight(p, uid);
    const built = await ctxForPreview(req as FastifyRequest, p, cid, uid, code);
    const r = await generate(p, reply, { targetId: null, cycleId: cid, unitId: uid, itemCode: code }, built, !!(req.body as { regenerate?: boolean } | undefined)?.regenerate);
    return r;
  });
  // hedef oluşturulunca önizleme planını hedefe bağla — sağlayıcı çağrısı yok; yalnız target_id bir kez doldurulur
  app.post('/api/t/:tid/ai-plans/:pid/bind', { schema: { body: { type: 'object', required: ['targetId'], properties: { targetId: { type: 'string', minLength: 36, maxLength: 36 } }, additionalProperties: false } } }, async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); customerOnly(p); const { pid } = req.params as { pid: string }; if (!/^[0-9a-f-]{36}$/i.test(pid)) throw new HttpError(404, 'not_found');
    const t = await loadTarget(p, (req.body as { targetId: string }).targetId); await requireTargetRight(p, t.unit_id);
    return withContext(dbCtx(p), async tx => {
      const plan = (await tx.query('SELECT id, target_id, cycle_id, unit_id, item_code FROM ai_plan WHERE tenant_id = $1 AND id = $2 FOR UPDATE', [p.tenantId, pid])).rows[0] as { id: string; target_id: string | null; cycle_id: string; unit_id: string; item_code: string } | undefined;
      if (!plan) throw new HttpError(404, 'not_found');
      if (plan.target_id) { if (plan.target_id === t.id) return { bound: true, planId: pid, targetId: t.id, already: true }; throw new HttpError(409, 'already_bound', 'Bu plan başka bir hedefe bağlı'); }
      if (plan.cycle_id !== t.cycle_id || plan.unit_id !== t.unit_id || plan.item_code !== t.item_code) throw new HttpError(409, 'scope_mismatch', 'Plan bu hedefin dönem/birim/maddesine ait değil');
      await tx.query('UPDATE ai_plan SET target_id = $3, bound_at = now() WHERE tenant_id = $1 AND id = $2 AND target_id IS NULL', [p.tenantId, pid, t.id]);
      await audit(tx, p, 'local_target', t.id, 'ai_plan_bound', null, { planId: pid }, 'yapay zekâ planı hedefe bağlandı');
      return { bound: true, planId: pid, targetId: t.id };
    });
  });

  // "Seçilen aksiyonları taslağa aktar": AI yeniden çağrılmaz. Hedef kabul edilmeden, plan bayatken ya da plan hedefe bağlı değilken aksiyon kaydı yaratılmaz.
  // Tarihler plandan: çıpa = hedefin kabul tarihi; start = çıpa + (startMonth−1) ay, due = çıpa + endMonth ay − 1 gün, en geç çıpa + takip ufku. cadence plandan (V1'de monthly).
  app.post('/api/t/:tid/ai-plans/:pid/actions', { schema: { body: { type: 'object', required: ['indices'], properties: { indices: { type: 'array', minItems: 1, maxItems: 3, uniqueItems: true, items: { type: 'integer', minimum: 0, maximum: 2 } } }, additionalProperties: false } } }, async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); customerOnly(p); const { pid } = req.params as { pid: string };
    if (!/^[0-9a-f-]{36}$/i.test(pid)) throw new HttpError(404, 'not_found');
    const b = req.body as { indices: number[] };
    const head = await withContext(dbCtx(p), async tx => (await tx.query('SELECT p.id, p.fingerprint, p.target_id, p.unit_id, p.output, t.status AS target_status, t.cycle_id, t.item_code, t.created_at AS target_created, (SELECT max(e.occurred_at) FROM audit_event e WHERE e.tenant_id = p.tenant_id AND e.entity_type = \'local_target\' AND e.entity_id = t.id AND e.action = \'accept\') AS accepted_at FROM ai_plan p LEFT JOIN local_target t ON t.tenant_id = p.tenant_id AND t.id = p.target_id WHERE p.tenant_id = $1 AND p.id = $2', [p.tenantId, pid])).rows[0] as { id: string; fingerprint: string; target_id: string | null; unit_id: string; output: AiPlanOutput; target_status: string | null; cycle_id: string; item_code: string; target_created: string; accepted_at: string | null } | undefined);
    if (!head) throw new HttpError(404, 'not_found'); await requireTargetRight(p, head.unit_id);
    if (head.output.interventionScope === 'COMPANY' || head.output.interventionScope === 'INSUFFICIENT_DATA') throw new HttpError(409, 'not_local_scope', 'Bu plan şirket düzeyinde ya da veri yetersiz olarak sınıflandı; yerel aksiyona çevrilmez');
    if (!head.target_id) throw new HttpError(409, 'target_not_accepted', 'Aksiyonlar hedef kabul edildikten sonra taslağa aktarılabilir.');
    if (!['accepted', 'active'].includes(String(head.target_status))) throw new HttpError(409, 'target_not_accepted', 'Aksiyonlar hedef kabul edildikten sonra taslağa aktarılabilir.');
    const cur = await ctxForTarget(req as FastifyRequest, p, { id: head.target_id, cycle_id: head.cycle_id, unit_id: head.unit_id, item_code: head.item_code }, pid);
    if (cur.fingerprint !== head.fingerprint) throw new HttpError(409, 'plan_stale', 'Bu plan daha eski verilere göre hazırlanmıştır; aksiyon aktarmadan önce planı yeniden oluşturun.');
    const anchor = new Date(head.accepted_at ?? head.target_created).toISOString().slice(0, 10); const horizonDays = Math.round(Number((cur.ctx.unit as { followUp?: { horizonDays?: number } }).followUp?.horizonDays ?? 365)); const horizonEnd = addDays(anchor, horizonDays);
    const idx = [...b.indices].sort(); if (idx.some(i => !head.output.actions[i])) throw new HttpError(404, 'not_found', 'Planda böyle bir aksiyon yok');
    if (idx.some(i => head.output.actions[i]!.level === 'COMPANY')) throw new HttpError(409, 'not_local_scope', 'Seçilen aksiyonlardan en az biri şirket desteği gerektiren iştir; yerel aksiyon olarak açılmaz'); // v2.13.2: aksiyon düzeyi
    return withContext(dbCtx(p), async tx => {
      const done = (await tx.query('SELECT action_index FROM ai_plan_action WHERE tenant_id = $1 AND plan_id = $2 AND action_index = ANY($3::int[])', [p.tenantId, pid, idx])).rows as { action_index: number }[];
      if (done.length) throw new HttpError(409, 'already_opened', 'Seçilen aksiyonlardan en az biri daha önce aktarıldı');
      const opened: unknown[] = [];
      for (const i of idx) {
        const a = head.output.actions[i]!; const startDate = addMonths(anchor, a.startMonth - 1); let dueDate = addDays(addMonths(anchor, a.endMonth), -1); if (dueDate > horizonEnd) dueDate = horizonEnd;
        const act = await openActionTx(req, tx, p, head.target_id!, { draft: true, custom: { title: a.title.slice(0, 200), cadence: (a.cadence ?? 'monthly') as 'monthly', leadingKpi: (a.indicators[0] ?? 'gerçekleşme').slice(0, 200) }, startDate, dueDate });
        await tx.query('INSERT INTO ai_plan_action (tenant_id, plan_id, action_index, action_id, created_by) VALUES ($1,$2,$3,$4,$5)', [p.tenantId, pid, i, (act as { id: string }).id, p.userId]);
        opened.push({ ...(act as object), plannedWindow: { startDate, dueDate, cadence: a.cadence ?? 'monthly', anchor } });
      }
      return { actions: opened, fromPlan: { planId: pid, indices: idx } };
    });
  });

  // v2.13.1: AI kökenli aksiyonun plan ayrıntısı (salt okunur). Önce kullanıcının aksiyonu görebildiği mevcut ayrıntı ucuyla doğrulanır.
  app.get('/api/t/:tid/actions/:aid/ai-plan', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); customerOnly(p); const { aid } = req.params as { aid: string }; if (!/^[0-9a-f-]{36}$/i.test(aid)) throw new HttpError(404, 'not_found');
    const vis = await app.inject({ method: 'GET', url: `/api/t/${p.tenantId}/actions/${aid}`, headers: { cookie: String(req.headers.cookie ?? '') } }); if (vis.statusCode !== 200) throw new HttpError(vis.statusCode === 403 ? 403 : 404, vis.statusCode === 403 ? 'forbidden' : 'not_found');
    const r = await withContext(dbCtx(p), async tx => (await tx.query('SELECT x.action_index, p.id, p.created_at, p.prompt_version, p.schema_version, p.output FROM ai_plan_action x JOIN ai_plan p ON p.tenant_id = x.tenant_id AND p.id = x.plan_id WHERE x.tenant_id = $1 AND x.action_id = $2', [p.tenantId, aid])).rows[0] as { action_index: number; id: string; created_at: string; prompt_version: string; schema_version: string; output: AiPlanOutput } | undefined);
    if (!r) throw new HttpError(404, 'not_found', 'Bu aksiyon yapay zekâ planından aktarılmadı');
    return { planId: r.id, createdAt: r.created_at, promptVersion: r.prompt_version, schemaVersion: r.schema_version, interventionScope: r.output.interventionScope, action: r.output.actions[r.action_index] ?? null, note: 'Yapay zekâ önerisidir; gerçekleşme ya da kanıt değildir.' };
  });

  // v2.14.0 (Tasarım B panosu): plan adımları ve "yapıldı" işareti. Plan adımı gerçekleşme (kanıt) kaydının yerine geçmez; ayrı sayılır.
  const planSteps = async (p: Principal & { tenantId: string }, req: FastifyRequest, aid: string) => {
    const vis = await app.inject({ method: 'GET', url: `/api/t/${p.tenantId}/actions/${aid}`, headers: { cookie: String(req.headers.cookie ?? '') } }); if (vis.statusCode !== 200) throw new HttpError(vis.statusCode === 403 ? 403 : 404, vis.statusCode === 403 ? 'forbidden' : 'not_found');
    return withContext(dbCtx(p), async tx => {
      const r = (await tx.query('SELECT x.action_index, p.output FROM ai_plan_action x JOIN ai_plan p ON p.tenant_id = x.tenant_id AND p.id = x.plan_id WHERE x.tenant_id = $1 AND x.action_id = $2', [p.tenantId, aid])).rows[0] as { action_index: number; output: AiPlanOutput } | undefined;
      const texts = r ? (r.output.actions[r.action_index]?.steps ?? []) : [];
      const done = (await tx.query("SELECT step_index, to_char(done_at, 'YYYY-MM-DD') AS done_at, note FROM action_plan_step WHERE tenant_id = $1 AND action_id = $2 ORDER BY step_index", [p.tenantId, aid])).rows as { step_index: number; done_at: string; note: string | null }[];
      const steps = texts.map((text, index) => { const d = done.find(x => x.step_index === index); return { index, text, doneAt: d ? String(d.done_at).slice(0, 10) : null, note: d?.note ?? null }; });
      return { fromPlan: !!r, steps, doneCount: steps.filter(x => x.doneAt).length, total: steps.length };
    });
  };
  app.get('/api/t/:tid/actions/:aid/plan-steps', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); const { aid } = req.params as { aid: string }; if (!/^[0-9a-f-]{36}$/i.test(aid)) throw new HttpError(404, 'not_found');
    return planSteps(p, req, aid);
  });
  app.post('/api/t/:tid/actions/:aid/plan-steps/:idx/done', { schema: { body: { type: 'object', required: ['date'], properties: { date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, note: { type: 'string', maxLength: 2000 } }, additionalProperties: false } } }, async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); customerOnly(p); const { aid, idx } = req.params as { aid: string; idx: string }; if (!/^[0-9a-f-]{36}$/i.test(aid) || !/^\d{1,2}$/.test(idx)) throw new HttpError(404, 'not_found');
    const b = req.body as { date: string; note?: string }; const index = Number(idx);
    if (b.date > new Date().toISOString().slice(0, 10)) throw new HttpError(422, 'future_date', 'Gelecek tarihli adım kaydedilemez');
    const cur = await planSteps(p, req, aid); if (!cur.fromPlan) throw new HttpError(404, 'not_found', 'Bu aksiyon yapay zekâ planından aktarılmadı'); if (index >= cur.total) throw new HttpError(404, 'not_found', 'Planda böyle bir adım yok');
    return withContext(dbCtx(p), async tx => {
      const a = (await tx.query('SELECT unit_id, lifecycle_state FROM action WHERE tenant_id = $1 AND id = $2 FOR UPDATE', [p.tenantId, aid])).rows[0] as { unit_id: string; lifecycle_state: string } | undefined; if (!a) throw new HttpError(404, 'not_found');
      await requireUnitProfile(tx, p, a.unit_id, 'HR_ADMIN', 'HR_PARTNER', 'REGION_MANAGER', 'UNIT_MANAGER', 'ACTION_OWNER');
      if (!['in_progress', 'planned'].includes(a.lifecycle_state)) throw new HttpError(409, 'action_not_in_progress', 'Plan adımı yalnız devam eden ya da planlanmış aksiyonda işaretlenir');
      const ex = (await tx.query("SELECT to_char(done_at, 'YYYY-MM-DD') AS done_at, note FROM action_plan_step WHERE tenant_id = $1 AND action_id = $2 AND step_index = $3", [p.tenantId, aid, index])).rows[0] as { done_at: string; note: string | null } | undefined;
      if (ex) return { index, doneAt: String(ex.done_at).slice(0, 10), note: ex.note, alreadyDone: true };
      await tx.query('INSERT INTO action_plan_step (tenant_id, action_id, step_index, done_at, note, created_by) VALUES ($1,$2,$3,$4,$5,$6)', [p.tenantId, aid, index, b.date, b.note?.trim() || null, p.userId]);
      await audit(tx, p, 'action', aid, 'plan_step_done', null, { index, date: b.date }, 'plan adımı yapıldı olarak işaretlendi');
      return { index, doneAt: b.date, note: b.note?.trim() || null, alreadyDone: false };
    });
  });
}

function addMonths(isoDate: string, n: number): string { const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]; const t = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(d, last)); return t.toISOString().slice(0, 10); }
function addDays(isoDate: string, n: number): string { const t = new Date(`${isoDate}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
