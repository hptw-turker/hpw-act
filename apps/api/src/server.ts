import { appendFileSync } from 'node:fs';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { config, validateConfig } from './config.js';
import { HttpError, withContext } from './db.js';
import { loadPrincipal, grantsHash, mfaOk } from './auth.js';
import { ROUTE_CLASS, platformAllows, type RouteClass, type PlatformRole } from './governance.js';
import { randomUUID } from 'node:crypto';
import { readdirSync as rdd } from 'node:fs';
const INSTANCE_ID = randomUUID(); // süreç kimliği: aynı ortamda hangi kurulumun/derlemenin yanıt verdiği (V01)
import { authRoutes } from './routes/auth.js';
import { platformRoutes } from './routes/platform.js';
import { tenantRoutes } from './routes/tenant.js';
import { analysisRoutes } from './routes/analysis.js';
import { corporateRoutes } from './routes/corporate.js';
import { aiRoutes } from './routes/ai.js';
import { roadmapRoutes } from './routes/roadmap.js';
import { rm2Routes } from './routes/rm2.js';
import { runOutboxOnce } from './mailer.js';

export async function buildApp() {
  const problems = validateConfig(); if (problems.length) throw new Error(`Üretim yapılandırması eksik: ${problems.join('; ')}`); // fail-closed (R35)
  const app = Fastify({ trustProxy: config.trustProxy, logger: process.env.LOG === 'true', bodyLimit: 2 * 1024 * 1024, ajv: { customOptions: { removeAdditional: false, coerceTypes: false, allErrors: true } } });
  await app.register(cookie); await app.register(multipart, { limits: { fileSize: config.maxUploadBytes, files: 1 } });
  app.addHook('onRequest', async req => { if (req.url.startsWith('/api/')) req.principal = await loadPrincipal(req); });
  // komut tekilleştirme (R28/V10/V11): anahtar aktör+yöntem+tam yol (sorgu dahil: önizleme ≠ kayıt); ilk istek satırı rezerve eder (in_progress),
  // eşzamanlı ikinci istek 409; tamamlanan yanıt yalnız aynı yetki parmak iziyle yeniden verilir (rol düşünce önbellek geçersiz)
  /** v2.9.0 MFA kapısı: platform personeli MFA kurulumu ve doğrulaması olmadan merkez ve şirket uçlarına erişemez (kurulum, doğrulama, kimlik bilgisi uçları hariç) */
  app.addHook('preHandler', async req => {
    const p = req.principal; const url = req.routeOptions?.url ?? ''; if (!p || p.realm !== 'platform') return;
    if (!(url.startsWith('/api/platform') || url.startsWith('/api/t/'))) return; if (url.startsWith('/api/platform/mfa') || url === '/api/platform/me' || url === '/api/platform/bootstrap') return;
    if (!mfaOk(p)) throw new HttpError(403, 'mfa_required', p.mfaEnabled ? 'Doğrulama uygulamanızdaki kodu girerek girişi tamamlayın' : 'HPW personeli için iki adımlı doğrulama zorunludur; önce doğrulama uygulamasını kurun');
  });
  /** v2.9.0 platform yetenek denetimi (tasarım v2 3.4): HPW personelinin şirket içi her isteği rol × uç sınıfı × şirket durumu × müdahale ile denetlenir; olumluysa ve yazmaysa veritabanı yazma bayrağı açılır. */
  app.addHook('preHandler', async req => {
    const p = req.principal; const url = req.routeOptions?.url ?? ''; if (!p || p.realm !== 'platform' || !url.startsWith('/api/t/:tid')) return;
    const tid = (req.params as { tid?: string }).tid; if (!tid || !/^[0-9a-f-]{36}$/i.test(tid)) return;
    const cls: RouteClass = req.method === 'GET' ? 'read' : (ROUTE_CLASS[`${req.method} ${url}`] ?? 'business');
    const ctx = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM platform_tenant_ctx($1,$2)', [p.userId, tid])).rows[0] as { has_access: boolean; role: PlatformRole | null; tenant_status: string | null; intervention_id: string | null; intervention_actor: string | null } | undefined);
    if (!ctx?.has_access) throw new HttpError(403, 'tenant_not_authorized', 'Bu şirkette yetkiniz yok');
    const intervention = !!ctx.intervention_id && ctx.intervention_actor === p.userId && ctx.role === 'admin';
    const v = platformAllows(ctx.role, cls, ctx.tenant_status, intervention);
    if (!v.ok) throw new HttpError(403, 'platform_capability', v.reason === 'suspended' ? 'Şirket durdurulmuş ya da arşivlenmiş; HPW yalnız okuyabilir' : v.reason === 'intervention_required' ? 'Bu işlem müşterinin işletme kararıdır; HPW yalnız müdahale modunda yapabilir' : 'HPW rolünüz bu işleme izin vermiyor');
    if (cls !== 'read') { p.platformWrite = true; p.interventionId = cls === 'business' ? ctx.intervention_id : null; if (cls === 'business' && ctx.intervention_id) p.intervention = { id: ctx.intervention_id, requestKey: String(req.headers['idempotency-key'] ?? req.id).slice(0, 160), route: `${req.method} ${req.url}`.slice(0, 300), seq: 0 }; } // v2.10.0 (§10.2.5): iz anahtarı gerçek komut adresini de içerir
  });
  // V290-06: müdahale izi artık db.ts withContext içinde, iş etkisiyle aynı transaction'da yazılır (onResponse'taki ayrı ve hatası yutulan yazım kaldırıldı)
  app.addHook('preHandler', async (req, reply) => {
    const key = req.headers['idempotency-key']; if (!key || (req.method !== 'POST' && req.method !== 'PATCH') || !req.url.startsWith('/api/t/') || !req.principal || !(req.principal.realm === 'platform' ? (req.params as { tid?: string }).tid : req.principal.tenantId)) return; // P0-5: PATCH de komut sözleşmesinde
    const k = `${req.principal.userId}|${req.method}|${req.url}|${String(key).slice(0, 160)}`; req.idempotencyKey = k; const hash = createHash('sha256').update(JSON.stringify(req.body ?? null)).digest('hex'); const gh = grantsHash(req.principal); const owner = randomUUID(); req.idempotencyOwner = owner;
    // v2.10.0 (§7.3): HPW personelinde tekrar güvenliği kaydı oturumun seçili şirketine değil İSTEĞİN şirketine (adres) bağlanır; başka sekmede şirket değişse bile yeniden deneme aynı kaydı bulur
    const urlTid = (req.params as { tid?: string }).tid; const ctx = req.principal.realm === 'platform' ? { realm: 'platform' as const, userId: req.principal.userId, tenantId: urlTid ?? null, platformWrite: true } : { realm: 'customer' as const, userId: req.principal.userId, tenantId: req.principal.tenantId };
    // Y02: tek atomik ifade — yeni rezervasyon ya da süresi dolmuş (>120 sn, yanıt yok) rezervasyonun sahiplik anahtarıyla devralınması; RETURNING yalnız satırı gerçekten alan isteğe döner
    const got = await withContext(ctx, async tx => (await tx.query(`INSERT INTO idempotency_key (tenant_id, key, actor_id, payload_hash, response_status, response_body, grants_hash, owner_token, created_at) VALUES ($1,$2,$3,$4,0,NULL,$5,$6,now()) ON CONFLICT (tenant_id, key) DO UPDATE SET owner_token = EXCLUDED.owner_token, created_at = now(), grants_hash = EXCLUDED.grants_hash WHERE idempotency_key.response_status = 0 AND idempotency_key.created_at < now() - interval '120 seconds' AND idempotency_key.payload_hash = EXCLUDED.payload_hash RETURNING owner_token`, [ctx.tenantId, k, req.principal!.userId, hash, gh, owner])).rows[0]);
    if (got && got.owner_token === owner) {
      const done = await withContext(ctx, async tx => (await tx.query('SELECT 1 FROM command_journal WHERE tenant_id = $1 AND command_key = $2 UNION ALL SELECT 1 FROM audit_event WHERE tenant_id = $1 AND correlation_id = $2 LIMIT 1', [ctx.tenantId, k])).rowCount); // crash penceresi: iş commit olmuş ama makbuz yazılamamışsa audit izi vardır
      if (done) { await withContext(ctx, tx => tx.query('UPDATE idempotency_key SET response_status = 409, response_body = $3 WHERE tenant_id = $1 AND key = $2 AND owner_token = $4', [ctx.tenantId, k, JSON.stringify({ error: 'receipt_lost', message: 'Komut daha önce yürütüldü; makbuz kaybolduğu için sonuç gösterilemiyor, iş yeniden yapılmadı' }), owner])); return reply.status(409).send({ error: 'receipt_lost', message: 'Komut daha önce yürütüldü; makbuz kaybolduğu için sonuç gösterilemiyor, iş yeniden yapılmadı' }); }
      req.principal!.commandKey = k; req.idempotencyReserved = true; return; }
    const prev = await withContext(ctx, async tx => (await tx.query('SELECT payload_hash, response_status, response_body, actor_id, resource_scope, resource_unit_id, resource_unit_ids, required_profiles FROM idempotency_key WHERE tenant_id = $1 AND key = $2', [ctx.tenantId, k])).rows[0]);
    if (!prev || prev.actor_id !== req.principal.userId) return reply.status(409).send({ error: 'idempotency_conflict', message: 'Anahtar başka bir aktöre ait' });
    if (prev.payload_hash !== hash) return reply.status(409).send({ error: 'idempotency_conflict', message: 'Aynı anahtar farklı gövdeyle kullanıldı' });
    if (prev.response_status === 0) return reply.status(409).send({ error: 'idempotency_in_progress', message: 'Aynı komut hâlâ işleniyor (rezervasyon başka bir istekte); sonucu bekleyin' });
    // Y01: tamamlanmış makbuz yalnız kaynağın GÜNCEL yetkisiyle verilir; kaynak/kapsam bilgisi yoksa fail-closed (yeniden çalıştırma yok, silme yok)
    if (!prev.resource_scope) return reply.status(409).send({ error: 'receipt_scope_missing', message: 'Komut daha önce tamamlandı ama makbuzun kaynak/kapsam bilgisi yok; sonuç bu anahtarla tekrar verilemez (yeni bir komut olarak yeniden yetkilendirin)' });
    try { const { requireUnitProfile, requireProfile } = await import('./auth.js'); const pr = (prev.required_profiles ?? []) as Parameters<typeof requireProfile>[1][]; if (prev.resource_scope === 'unit' && prev.resource_unit_id) await withContext(ctx, tx => requireUnitProfile(tx, { ...req.principal!, tenantId: ctx.tenantId! }, prev.resource_unit_id, ...pr)); else if (prev.resource_scope === 'units' && Array.isArray(prev.resource_unit_ids)) { requireProfile(req.principal, ...pr); await withContext(ctx, async tx => { for (const u of prev.resource_unit_ids as string[]) await requireUnitProfile(tx, { ...req.principal!, tenantId: ctx.tenantId! }, u, ...pr); }); } /* F99-03: etkilenen bütün birimler güncel yetkiyle */ else if (prev.resource_scope === 'tenant') requireProfile(req.principal, ...pr); else if (prev.resource_scope === 'tenant_wide') { /* v2.10.1 (V2101-02): müşteri alanı + profil + şirket geneli yetki güncel haliyle yeniden denetlenir */ requireProfile(req.principal, ...pr); if (req.principal.realm !== 'customer' || !req.principal.companyWide) throw new HttpError(403, 'company_wide_required', 'Bu işlem şirket genelinde yetki gerektirir'); } else return reply.status(409).send({ error: 'receipt_scope_missing', message: 'Makbuz kaynak bilgisi eksik' }); }
    catch (e) { const err = e as { status?: number; code?: string; message?: string }; return reply.status(err.status ?? 403).send({ error: err.code ?? 'forbidden_profile', message: `Komut daha önce tamamlandı; sonucu görmek için güncel yetki gerekir: ${err.message ?? ''}` }); }
    return reply.status(prev.response_status).send(prev.response_body);
  });
  app.addHook('onSend', async (req, reply, payload) => {
    if (!(req.idempotencyKey && req.idempotencyReserved && req.principal)) return payload;
    // v2.10.0 (§7.3): HPW personelinde tekrar güvenliği kaydı oturumun seçili şirketine değil İSTEĞİN şirketine (adres) bağlanır; başka sekmede şirket değişse bile yeniden deneme aynı kaydı bulur
    const urlTid = (req.params as { tid?: string }).tid; const ctx = req.principal.realm === 'platform' ? { realm: 'platform' as const, userId: req.principal.userId, tenantId: urlTid ?? null, platformWrite: true } : { realm: 'customer' as const, userId: req.principal.userId, tenantId: req.principal.tenantId }; let body: unknown = null; try { body = JSON.parse(String(payload)); } catch { body = null; }
    const res = req.idempotencyResource;
    if (reply.statusCode >= 500 || (reply.statusCode < 300 && !res)) { await withContext(ctx, tx => tx.query('DELETE FROM idempotency_key WHERE tenant_id = $1 AND key = $2 AND owner_token = $3', [ctx.tenantId, req.idempotencyKey, req.idempotencyOwner])).catch(() => null); return payload; } // kaynak bilgisi olmayan başarılı komut makbuz olarak saklanmaz (Y01 fail-closed); tekrarında yeniden yetkilendirme gerekir
    await withContext(ctx, tx => tx.query('UPDATE idempotency_key SET response_status = $3, response_body = $4, resource_scope = $5, resource_unit_id = $6, required_profiles = $7, resource_unit_ids = $9 WHERE tenant_id = $1 AND key = $2 AND owner_token = $8', [ctx.tenantId, req.idempotencyKey, reply.statusCode, body === null ? null : JSON.stringify(body), res?.scope ?? null, res?.unitId ?? null, res?.profiles ?? null, req.idempotencyOwner, res?.unitIds ?? null])).catch(() => null); // Y02: yalnız rezervasyon sahibi makbuz yazar; gecikmiş eski iş yeni sahibin makbuzunu ezemez
    return payload;
  });
  app.setErrorHandler((err: unknown, _req, reply) => {
    const e = err as { status?: number; code?: string; message?: string; details?: unknown; statusCode?: number; validation?: unknown[] };
    if (e.validation) return reply.status(400).send({ error: 'invalid_request', message: 'İstek gövdesi geçersiz', details: e.validation }); // R07
    if (e instanceof HttpError || (typeof e.status === 'number' && e.code)) return reply.status(e.status ?? 500).send({ error: e.code, message: e.message, details: e.details ?? null });
    if (typeof e.statusCode === 'number' && e.statusCode < 500) return reply.status(e.statusCode).send({ error: e.code ?? 'bad_request', message: e.message });
    app.log.error(err as Error); console.error('[500]', _req.method, _req.url, (err as Error).message, (err as Error).stack?.split('\n').slice(1, 3).join(' | ')); return reply.status(500).send({ error: 'internal_error', message: 'Beklenmeyen hata' });
  });
  app.get('/api/health', async () => ({ ok: true, version: '3.0.0', env: config.envName, mail: config.smtpUrl ? 'smtp' : 'sandbox', build: config.buildId, install: config.installId, instance: INSTANCE_ID }));
  // hazırlık (V02): uygulama hesabıyla DB bağlantısı, beklenen migrasyon defteri, kritik definer fonksiyonlar; sorunlar ham hata/stack olmadan
  const readiness = async () => { const reasons: string[] = []; let schema: string | null = null; const expected = (() => { try { return rdd(join(config.migrationsDir)).filter(f => f.endsWith('.sql')).sort(); } catch { return [] as string[]; } })();
    try { const rows = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map(r => String(r.name))); schema = rows[rows.length - 1] ?? null; for (const f of expected) if (!rows.includes(f)) reasons.push(`migrasyon uygulanmamış: ${f}`); if (!rows.length) reasons.push('şema kurulmamış'); }
    catch (e) { reasons.push('veritabanı bağlantısı yok ya da uygulama hesabının izni eksik'); void e; }
    if (!reasons.length) { try { await withContext({ realm: 'anon' }, tx => tx.query('SELECT platform_user_count()')); } catch { reasons.push('definer fonksiyonları eksik (migrasyon 0004)'); } }
    return { ready: reasons.length === 0, reasons, env: config.envName, version: '3.1.0', build: config.buildId, install: config.installId, instance: INSTANCE_ID, schema, expectedSchema: expected[expected.length - 1] ?? null, mail: config.smtpUrl ? 'smtp' : 'sandbox', mailNote: config.smtpUrl ? 'gerçek sağlayıcı yapılandırılmış' : 'test kutusu; gerçek gönderim yok', appPath: '/app.html' }; };
  app.get('/api/ready', async (_req, reply) => { const r = await readiness(); return reply.status(r.ready ? 200 : 503).send(r); });
  app.get('/api/health-probe.js', async (_req, reply) => { const r = await readiness(); return reply.header('Cache-Control', 'no-store').type('application/javascript').send(`window.__HPW_ACT_HEALTH=${JSON.stringify({ ok: true, ...r })};`); });
  // ilk kurulum durumu (sır yok): giriş ekranı "ilk HPW yöneticisini kur" formunu buna göre gösterir
  app.get('/api/platform/bootstrap-status', async () => { const n = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT platform_user_count() AS n')).rows[0].n); return { needsBootstrap: Number(n) === 0, setupKeyRequired: !!config.setupKey, env: config.envName }; });
  // test posta kutusu (yalnız sandbox modunda ve üretim dışı, V09): dosyalar outbox kimliğiyle adlandırılır; şirket görünümü tenant_id + invitation_id ile, platform görünümü yetkili müşteri listesiyle sınırlı
  const readMail = (id: string) => { const f = join(config.mailDir, `${id}.eml`); if (!existsSync(f)) return null; const t = readFileSync(f, 'utf8'); const h = (k: string) => (new RegExp(`^${k}: (.*)$`, 'm').exec(t)?.[1] ?? ''); return { id, to: h('To'), subject: h('Subject'), date: h('Date'), body: t.split('\n\n').slice(1).join('\n\n'), link: /https?:\/\/\S+#\/(davet|parola)\/[A-Za-z0-9_-]+/.exec(t)?.[0] ?? null, transport: 'sandbox' }; };
  const sandboxOff = () => { if (config.production || config.smtpUrl) throw new HttpError(404, 'sandbox_unavailable', 'Test posta kutusu yalnız sandbox modunda ve üretim dışında'); };
  app.get('/api/t/:tid/mail-sandbox', async req => { const { tid } = req.params as { tid: string }; const { requireTenantAsync, requireProfile } = await import('./auth.js'); const p = await requireTenantAsync(req, tid); requireProfile(p, 'HR_ADMIN'); sandboxOff(); const ids = await withContext({ realm: 'worker' }, async tx => (await tx.query('SELECT o.id FROM email_outbox o WHERE o.tenant_id = $1 AND o.invitation_id IS NOT NULL ORDER BY o.created_at DESC LIMIT 300', [tid])).rows.map(r => String(r.id))); return { transport: 'sandbox', note: 'Test/sandbox kutusu — gerçek teslimat değildir; yalnız bu şirketin davet postaları (outbox kimliğiyle)', mails: ids.map(readMail).filter(Boolean) }; });
  app.get('/api/platform/mail-sandbox', async req => { const p = req.principal; if (!p || p.realm !== 'platform') throw new HttpError(403, 'platform_only'); sandboxOff(); const ids = await withContext({ realm: 'worker' }, async tx => (await tx.query(`SELECT o.id, o.tenant_id, u.realm FROM email_outbox o LEFT JOIN app_user u ON u.email_norm = lower(o.to_email) WHERE (o.tenant_id IS NOT NULL AND o.invitation_id IS NOT NULL AND auth_platform_has_tenant($1, o.tenant_id)) OR (o.tenant_id IS NULL AND u.realm = 'platform') OR (o.tenant_id IS NULL AND $2::boolean) ORDER BY o.created_at DESC LIMIT 300`, [p.userId, config.testOperatorMailbox])).rows.map(r => String(r.id))); return { transport: 'sandbox', note: config.testOperatorMailbox ? 'Test operatörü kutusu: yetkili müşterilerin davetleri, platform hesap postaları ve bu test ortamındaki parola bağlantıları (üretimde kapalı)' : 'Yetkili müşterilerin davet postaları ve platform hesap postaları', mails: ids.map(readMail).filter(Boolean) }; });
  /** N04: sözleşme doğrulaması için gerçek başarı yanıtlarını örnekler (yalnız HPW_CONTRACT_CAPTURE verilirse; testte) */
  if (process.env.HPW_CONTRACT_CAPTURE) { const cap = process.env.HPW_CONTRACT_CAPTURE; const trim = (v: unknown, d = 0): unknown => Array.isArray(v) ? v.slice(0, 25).map(x => trim(x, d + 1)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, trim(x, d + 1)])) : v;
    app.addHook('onSend', async (req, reply, payload) => { try { const ct = String(reply.getHeader('content-type') ?? ''); const url = req.routeOptions?.url; if (reply.statusCode < 300 && ct.includes('application/json') && typeof payload === 'string' && url?.startsWith('/api/')) appendFileSync(cap, JSON.stringify({ m: req.method, u: url, b: trim(JSON.parse(payload)) }) + '\n'); } catch { /* örnekleme ürünü etkilemez */ } return payload; }); }
  /** v3.0.0 (ADR-0043): kapalı modüllerin uçları işaretlenir; anahtar kapalıyken 404 döner (kod ve tablolar durur). */
  let legacyReg = false; app.addHook('onRoute', r => { if (legacyReg) r.config = { ...(r.config as object ?? {}), legacy: true } as typeof r.config; });
  app.addHook('preHandler', async req => { if ((req.routeOptions?.config as { legacy?: boolean } | undefined)?.legacy && !config.legacyModules) throw new HttpError(404, 'module_disabled', 'Bu bölüm bu sürümde kullanılmıyor'); });
  await authRoutes(app); await platformRoutes(app); await tenantRoutes(app);
  legacyReg = true; await analysisRoutes(app); await corporateRoutes(app); await aiRoutes(app); await roadmapRoutes(app); legacyReg = false;
  await rm2Routes(app);
  if (existsSync(config.webDist)) {
    await app.register(fastifyStatic, { root: config.webDist, prefix: '/', index: false, serve: false });
    const blocked = new Set(['/index.html', '/hpw-act-prototip.html', '/prototip']);
    app.get('/*', (req, reply) => { const path = req.url.split('?')[0]!; if (path === '/' || path === '/index.html') return reply.redirect('/app.html'); const g = /^\/g\/([A-Za-z0-9_-]{3,24})\/?$/.exec(path); if (g) return reply.redirect(`/app.html#/g/${g[1]}`); /* v3.0: şirkete özel giriş adresi */ if (!config.servePrototype && (blocked.has(path) || path.startsWith('/prototip'))) return reply.status(404).send({ error: 'not_found', message: 'Prototip bu üründe servis edilmez' }); if (path.startsWith('/api/')) return reply.status(404).send({ error: 'not_found' }); const file = path.replace(/^\//, ''); if (file && existsSync(join(config.webDist, file)) && !file.includes('..')) return reply.sendFile(file); return reply.sendFile('app.html'); });
  }
  return app;
}
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!);
if (isMain) { const app = await buildApp(); await app.listen({ port: config.port, host: config.host }); setInterval(() => runOutboxOnce(100).catch(() => null), 30_000); console.log(`HPW Act API [${config.envName}] :${config.port} · web ${existsSync(config.webDist) ? 'servis ediliyor' : 'yok'} · mail ${config.smtpUrl ? 'smtp' : 'sandbox (' + config.mailDir + ')'}`); }
