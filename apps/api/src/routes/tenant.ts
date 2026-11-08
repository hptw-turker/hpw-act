import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
import { withContext, HttpError, type Tx } from '../db.js';
import { requireTenantAsync as requireTenant, requireProfile, requireUnitProfile, dbCtx, newToken, tokenHash, isAtLeast, grantableProfiles, audit } from '../auth.js';
import { readWorkbook, errorWorkbook } from '../xlsx.js';
import { computeOnboarding } from '../onboarding.js';
import { orgImporter } from '../importers/org.js';
import { usersImporter } from '../importers/users.js';
import { instrumentImporter, buildSpec, certification, publishInstrument, STANDARD } from '../importers/instrument.js';
import { resultsImporter } from '../importers/results.js';
import { roadmapImporter } from '../importers/roadmap.js';
import { roadmap2Importer } from '../importers/roadmap2.js';
import { tenantInfo, type Importer, type ImportCtx } from '../importers/common.js';
import { Report } from '../validation.js';
import { config } from '../config.js';
import { runOutboxOnce } from '../mailer.js';

const IMPORTERS: Record<string, Importer> = { org: orgImporter, users: usersImporter, instrument: instrumentImporter, results: resultsImporter, roadmap: roadmapImporter, roadmap2: roadmap2Importer };
const ADMIN = ['HR_ADMIN'] as const; const SETUP = ['HR_ADMIN', 'HR_PARTNER'] as const;
/** v3.0.0: kapalı modüllerin içe alım türleri (soru seti, sonuçlar, v2.15 yol haritası) */
const LEGACY_KINDS = ['instrument', 'results', 'roadmap'];
const importProfiles = (kind: string) => (kind === 'users' ? ADMIN : SETUP);

async function ctxOf(tx: Tx, p: Parameters<typeof grantableProfiles>[0] & { tenantId: string; userId: string }, cycleId?: string | null): Promise<ImportCtx> { const t = await tenantInfo(tx, p.tenantId); return { tenantId: p.tenantId, tenantCode: t.code, organizationId: t.organizationId, userId: p.userId, cycleId: cycleId ?? null, grantable: grantableProfiles(p), actorProfile: p.realm === 'platform' ? 'PLATFORM' : (p.profile ?? 'VIEWER') }; }
async function readUpload(req: FastifyRequest): Promise<{ name: string; buf: Buffer }> {
  const file = await req.file({ limits: { fileSize: config.maxUploadBytes, files: 1 } }); if (!file) throw new HttpError(400, 'file_required', 'Dosya yüklenmedi');
  if (/\.[a-z0-9]{1,5}$/i.test(file.filename) && !/\.xlsx$/i.test(file.filename)) throw new HttpError(415, 'xlsx_only', 'Yalnız .xlsx kabul edilir'); // uzantısız dosya imza ve çözümlemeyle denetlenir
  const buf = await file.toBuffer(); if (file.file.truncated) throw new HttpError(413, 'file_too_large', `Dosya ${config.maxUploadBytes} bayttan büyük`);
  if (buf.subarray(0, 2).toString('binary') !== 'PK') throw new HttpError(415, 'not_a_zip', 'XLSX imzası yok');
  return { name: file.filename.replace(/[^\w.\- ]/g, '_').slice(0, 120), buf };
}

export async function tenantRoutes(app: FastifyInstance) {
  /** v2.10.0 kurulum adımı 10 — müşteri teyidi: HPW'nin kullanıma açılış onayını müşterinin şirket genelindeki İK yöneticisi kendi alanında teyit eder.
   * HPW personeli (müdahale modunda da) teyit veremez; teyit, onaylanan kanıtın parmak izine bağlıdır (HPW yeniden onaylarsa yeniden teyit gerekir). */
  /** v2.10.1 (V210-02): müşteri alanı, merkezle AYNI geçerlilik hesabını (computeOnboarding) kullanır. Geçerliliğini yitirmiş HPW onayı “teyit bekleniyor”
   * gibi sunulmaz (state = recheck, fingerprint = null); müşteri teyidi yalnız güncel kanıta eşit, geçerli HPW onayı için alınır. */
  const goLiveState = async (tx: Tx, tid: string) => {
    const ob = await computeOnboarding(tx, tid); if (!ob) throw new HttpError(404, 'tenant_not_found');
    const step = ob.steps.find(x => x.key === 'go_live')!; const f = step.facts as { customerConfirmedAt?: string | null };
    return { state: step.state, hpwApprovedAt: step.approval?.at ?? null, hpwReason: step.approval?.reason ?? null, customerConfirmedAt: step.state === 'done' ? (f.customerConfirmedAt ?? null) : null, awaitingCustomer: step.state === 'in_progress', fingerprint: step.state === 'in_progress' ? ob.fingerprints.go_live : null };
  };
  app.get('/api/t/:tid/onboarding/go-live', async req => { const p = await requireTenant(req, (req.params as { tid: string }).tid); return withContext(dbCtx(p), tx => goLiveState(tx, p.tenantId)); });
  app.post('/api/t/:tid/onboarding/go-live/confirm', { schema: { body: { type: 'object', required: ['reason', 'expectedFingerprint'], properties: { reason: { type: 'string', minLength: 3, maxLength: 500 }, expectedFingerprint: { type: 'string', minLength: 8, maxLength: 64 } }, additionalProperties: false } } }, async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); if (p.realm !== 'customer') throw new HttpError(403, 'customer_only', 'Kullanıma açılış teyidini müşterinin İK yöneticisi kendi hesabıyla verir'); requireProfile(p, 'HR_ADMIN'); if (!p.companyWide) throw new HttpError(403, 'company_wide_required', 'Bu işlem şirket genelinde yetki gerektirir');
    req.idempotencyResource = { scope: 'tenant_wide', profiles: ['HR_ADMIN'] }; // v2.10.1 (V2101-02): başarılı teyidin makbuzu saklanır; aynı anahtarlı tekrar güncel yetkiyle yeniden denetlenip aynı sonucu döndürür
    const b = req.body as { reason: string; expectedFingerprint: string };
    return withContext(dbCtx(p), async tx => {
      // güncel kanıt + önkoşullar + geçerli HPW onayı aynı transaction'da; şirket satırındaki paylaşımlı kilit (withContext) HPW onayı ve şirket kaydı değişiklikleriyle yarışı sıraya koyar
      const st = await goLiveState(tx, p.tenantId);
      if (st.state === 'done') return { confirmed: true, already: true, confirmedAt: st.customerConfirmedAt };
      if (st.state === 'recheck') throw new HttpError(409, 'evidence_changed', 'Teyit etmek istediğiniz onay güncel değil; sayfayı yenileyip yeniden inceleyin');
      if (!st.fingerprint) throw new HttpError(409, 'hpw_approval_missing', 'HPW henüz kullanıma açılışı onaylamadı');
      if (st.fingerprint !== b.expectedFingerprint) throw new HttpError(409, 'evidence_changed', 'Teyit etmek istediğiniz onay güncel değil; sayfayı yenileyip yeniden inceleyin');
      await tx.query(`UPDATE onboarding_approval SET superseded_at = now() WHERE tenant_id = $1 AND step_key = 'go_live_customer' AND superseded_at IS NULL`, [p.tenantId]);
      await tx.query(`INSERT INTO onboarding_approval (tenant_id, step_key, approved_by, reason, evidence_fingerprint) VALUES ($1,'go_live_customer',$2,$3,$4)`, [p.tenantId, p.userId, b.reason.trim(), st.fingerprint]);
      await audit(tx, p, 'tenant', p.tenantId, 'go_live_customer_confirm', null, { fingerprint: st.fingerprint }, b.reason.trim());
      return { confirmed: true, already: false, confirmedAt: new Date().toISOString() };
    });
  });
  app.get('/api/t/:tid/overview', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid);
    return withContext(dbCtx(p), async tx => {
      const t = (await tx.query('SELECT id, code, name, locale, timezone, default_login, status FROM tenant WHERE id = $1', [p.tenantId])).rows[0];
      const counts = (await tx.query(`SELECT (SELECT COUNT(*) FROM org_unit WHERE tenant_id = $1 AND effective_to IS NULL)::int AS units, (SELECT COUNT(*) FROM org_role WHERE tenant_id = $1 AND effective_to IS NULL)::int AS roles, (SELECT COUNT(*) FROM membership WHERE tenant_id = $1 AND status = 'active')::int AS members, (SELECT COUNT(*) FROM instrument_version WHERE tenant_id = $1)::int AS instruments, (SELECT COUNT(*) FROM survey_cycle WHERE tenant_id = $1)::int AS cycles, (SELECT COUNT(*) FROM survey_cycle WHERE tenant_id = $1 AND active_batch_id IS NOT NULL)::int AS published_cycles, (SELECT COUNT(*) FROM invitation WHERE tenant_id = $1 AND status = 'pending')::int AS pending_invites, (SELECT COUNT(*) FROM invitation WHERE tenant_id = $1 AND status = 'ready')::int AS ready_invites, (SELECT COUNT(*) FROM invitation WHERE tenant_id = $1 AND status = 'accepted')::int AS accepted_invites, (SELECT COUNT(*) FROM local_target WHERE tenant_id = $1 AND status IN ('accepted','active'))::int AS targets, (SELECT COUNT(*) FROM action WHERE tenant_id = $1)::int AS actions`, [p.tenantId])).rows[0];
      return { tenant: t, counts, env: config.envName, principal: { profile: p.realm === 'platform' ? 'PLATFORM' : p.profile, companyWide: p.companyWide ?? p.realm === 'platform' } };
    });
  });
  // ---------- organizasyon (ekran)
  app.get('/api/t/:tid/org', async req => { const p = await requireTenant(req, (req.params as { tid: string }).tid); return withContext(dbCtx(p), async tx => ({
    unitTypes: (await tx.query('SELECT code, label FROM unit_type WHERE tenant_id = $1 ORDER BY code', [p.tenantId])).rows,
    units: (await tx.query(`SELECT u.id, u.external_id AS code, u.name, u.unit_type, u.timezone, u.effective_from, u.effective_to, (SELECT p.external_id FROM org_relationship r JOIN org_unit p ON p.tenant_id = r.tenant_id AND p.id = r.to_unit_id WHERE r.tenant_id = u.tenant_id AND r.from_unit_id = u.id AND r.relationship_type = 'reports_to' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to > CURRENT_DATE) LIMIT 1) AS parent_code FROM org_unit u WHERE u.tenant_id = $1 ORDER BY u.external_id`, [p.tenantId])).rows,
    hierarchies: (await tx.query('SELECT code, name, purpose FROM hierarchy_group WHERE tenant_id = $1 ORDER BY code', [p.tenantId])).rows,
    roles: (await tx.query(`SELECT r.id, r.code, r.title, r.permission_profile, u.external_id AS unit_code, r.effective_to, (SELECT string_agg(pe.display_name, ', ') FROM accountability_assignment a JOIN person pe ON pe.tenant_id = a.tenant_id AND pe.id = a.person_id WHERE a.tenant_id = r.tenant_id AND a.org_role_id = r.id AND a.effective_to IS NULL) AS holders FROM org_role r JOIN org_unit u ON u.tenant_id = r.tenant_id AND u.id = r.unit_id WHERE r.tenant_id = $1 ORDER BY r.code`, [p.tenantId])).rows,
  })); });
  app.post('/api/t/:tid/org/units', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); requireProfile(p, ...SETUP); req.idempotencyResource = { scope: 'tenant', profiles: [...SETUP] };
    const b = (req.body ?? {}) as { code?: string; name?: string; unitType?: string; parentCode?: string; hierarchyCode?: string; timezone?: string; validFrom?: string; unitTypeLabel?: string };
    return withContext(dbCtx(p), async tx => {
      const ctx = await ctxOf(tx, p); const rep = new Report();
      const sheets: Parameters<Importer['validate']>[0] = { Birimler: { name: 'Birimler', header: ['tenant_code', 'operation', 'unit_code', 'unit_name', 'unit_type_code', 'timezone', 'valid_from', 'valid_to'], rows: [{ n: 2, cells: { tenant_code: ctx.tenantCode, operation: 'CREATE', unit_code: b.code ?? '', unit_name: b.name ?? '', unit_type_code: b.unitType ?? '', timezone: b.timezone ?? 'Europe/Istanbul', valid_from: b.validFrom ?? new Date().toISOString().slice(0, 10), valid_to: '' } }] } };
      if (b.unitTypeLabel && b.unitType) sheets['Birim_Tipleri'] = { name: 'Birim_Tipleri', header: ['tenant_code', 'unit_type_code', 'label'], rows: [{ n: 2, cells: { tenant_code: ctx.tenantCode, unit_type_code: b.unitType, label: b.unitTypeLabel } }] };
      if (b.parentCode) { sheets['Hiyerarsiler'] = { name: 'Hiyerarsiler', header: ['tenant_code', 'hierarchy_code', 'label', 'purpose'], rows: [{ n: 2, cells: { tenant_code: ctx.tenantCode, hierarchy_code: b.hierarchyCode ?? 'SURVEY', label: 'Anket toplama ağacı', purpose: 'SURVEY_ROLLUP' } }] }; sheets['Iliskiler'] = { name: 'Iliskiler', header: ['tenant_code', 'operation', 'hierarchy_code', 'child_unit', 'parent_unit', 'relation_type', 'valid_from', 'valid_to'], rows: [{ n: 2, cells: { tenant_code: ctx.tenantCode, operation: 'CREATE', hierarchy_code: b.hierarchyCode ?? 'SURVEY', child_unit: b.code ?? '', parent_unit: b.parentCode, relation_type: 'REPORTS_TO', valid_from: b.validFrom ?? new Date().toISOString().slice(0, 10), valid_to: '' } }] }; }
      const v = await orgImporter.validate(sheets, tx, ctx); void rep;
      if (!v.report.ok) throw new HttpError(422, 'validation_failed', 'Birim eklenemedi', v.report.issues);
      return orgImporter.commit(v.payload, tx, ctx);
    });
  });
  app.post('/api/t/:tid/org/roles', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); requireProfile(p, ...SETUP); req.idempotencyResource = { scope: 'tenant', profiles: [...SETUP] };
    const b = (req.body ?? {}) as { code?: string; unitCode?: string; title?: string; permissionProfile?: string };
    return withContext(dbCtx(p), async tx => { const ctx = await ctxOf(tx, p); const v = await orgImporter.validate({ Org_Rolleri: { name: 'Org_Rolleri', header: ['tenant_code', 'operation', 'role_code', 'unit_code', 'title', 'permission_profile', 'valid_from', 'valid_to'], rows: [{ n: 2, cells: { tenant_code: ctx.tenantCode, operation: 'CREATE', role_code: b.code ?? '', unit_code: b.unitCode ?? '', title: b.title ?? '', permission_profile: b.permissionProfile ?? '', valid_from: new Date().toISOString().slice(0, 10), valid_to: '' } }] } }, tx, ctx); if (!v.report.ok) throw new HttpError(422, 'validation_failed', 'Rol eklenemedi', v.report.issues); return orgImporter.commit(v.payload, tx, ctx); });
  });
  // ---------- soru seti (ekran): standart katalog + ek soru
  app.get('/api/t/:tid/instruments/catalog', async req => { await requireTenant(req, (req.params as { tid: string }).tid); return { instrumentCode: STANDARD.instrumentCode, version: STANDARD.version, dimensions: STANDARD.dimensions, items: STANDARD.items.map(i => ({ code: i.code, text: i.text, textEn: i.textEn, dimensionCode: i.dimensionCode, scale: i.scale === 'nps_0_10' ? 'NPS11' : 'L5', origin: i.origin, interactionArea: i.interactionArea, responsibilityCenter: i.responsibilityCenter, defaultTargetPolicy: i.responsibilityCenter === 'outcome' || i.responsibilityCenter === 'individual' ? 'MONITOR_ONLY' : 'TARGETABLE' })), scales: ['L5', 'L5R', 'NPS11', 'BIN'] }; });
  app.get('/api/t/:tid/instruments', async req => { const p = await requireTenant(req, (req.params as { tid: string }).tid); return withContext(dbCtx(p), async tx => (await tx.query(`SELECT v.id, v.version, v.state, v.certification_eligible, v.certification_notes, v.created_at, (SELECT COUNT(*) FROM instrument_item i WHERE i.tenant_id = v.tenant_id AND i.instrument_version_id = v.id AND i.selection_state = 'INCLUDED')::int AS items, (SELECT COUNT(*) FROM instrument_item i WHERE i.tenant_id = v.tenant_id AND i.instrument_version_id = v.id AND i.origin = 'custom')::int AS custom_items FROM instrument_version v WHERE v.tenant_id = $1 ORDER BY v.created_at DESC`, [p.tenantId])).rows); });
  app.get('/api/t/:tid/instruments/:ivid/items', async req => { const p = await requireTenant(req, (req.params as { tid: string }).tid); const { ivid } = req.params as { ivid: string }; return withContext(dbCtx(p), async tx => (await tx.query('SELECT code, text, text_en, dimension_code, scale_code, origin, selection_state, target_policy, responsibility_center, interaction_area, equivalence, display_order FROM instrument_item WHERE tenant_id = $1 AND instrument_version_id = $2 ORDER BY display_order', [p.tenantId, ivid])).rows); });
  app.post('/api/t/:tid/instruments', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); requireProfile(p, ...SETUP); req.idempotencyResource = { scope: 'tenant', profiles: [...SETUP] };
    const b = (req.body ?? {}) as { version?: string; standardItemCodes?: string[]; customItems?: Parameters<typeof buildSpec>[1]['customItems']; overrides?: Record<string, { text?: string; targetPolicy?: string }> };
    return withContext(dbCtx(p), async tx => {
      const ctx = await ctxOf(tx, p); const rep = new Report();
      const spec = buildSpec(rep, { standardItemCodes: b.standardItemCodes ?? [], customItems: b.customItems ?? [], overrides: b.overrides, version: b.version });
      if (!rep.ok) throw new HttpError(422, 'validation_failed', 'Soru seti yayımlanamadı', rep.issues);
      const r = await publishInstrument(tx, ctx, spec); return { ...r, warnings: rep.warnings, certification: certification(spec) };
    });
  });
  // ---------- dönemler
  app.get('/api/t/:tid/cycles', async req => { const p = await requireTenant(req, (req.params as { tid: string }).tid); return withContext(dbCtx(p), async tx => (await tx.query(`SELECT c.id, c.code, c.name, c.period_start, c.period_end, c.status, c.instrument_version_id, iv.version AS instrument_version, c.active_batch_id, (SELECT COUNT(*) FROM result r WHERE r.tenant_id = c.tenant_id AND r.import_batch_id = c.active_batch_id)::int AS result_rows FROM survey_cycle c LEFT JOIN instrument_version iv ON iv.tenant_id = c.tenant_id AND iv.id = c.instrument_version_id WHERE c.tenant_id = $1 ORDER BY c.period_start DESC`, [p.tenantId])).rows); });
  app.post('/api/t/:tid/cycles', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); requireProfile(p, ...SETUP); req.idempotencyResource = { scope: 'tenant', profiles: [...SETUP] };
    const b = (req.body ?? {}) as { code?: string; name?: string; periodStart?: string; periodEnd?: string; instrumentVersionId?: string; hierarchyCode?: string };
    if (!b.code || !b.periodStart || !b.periodEnd) throw new HttpError(400, 'code_and_period_required');
    return withContext(dbCtx(p), async tx => {
      const ctx = await ctxOf(tx, p);
      let h = (await tx.query('SELECT id FROM hierarchy_group WHERE tenant_id = $1 AND code = $2', [p.tenantId, b.hierarchyCode ?? 'SURVEY'])).rows[0];
      if (!h) h = (await tx.query('INSERT INTO hierarchy_group (tenant_id, organization_id, code, name, purpose) VALUES ($1,$2,$3,$4,$5) RETURNING id', [p.tenantId, ctx.organizationId, b.hierarchyCode ?? 'SURVEY', 'Anket toplama ağacı', 'SURVEY_ROLLUP'])).rows[0];
      if (b.instrumentVersionId && !(await tx.query('SELECT 1 FROM instrument_version WHERE tenant_id = $1 AND id = $2', [p.tenantId, b.instrumentVersionId])).rowCount) throw new HttpError(404, 'instrument_not_found');
      try { const r = await tx.query('INSERT INTO survey_cycle (tenant_id, organization_id, code, name, period_start, period_end, rollup_hierarchy_group_id, instrument_version_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [p.tenantId, ctx.organizationId, b.code, b.name ?? b.code, b.periodStart, b.periodEnd, h.id, b.instrumentVersionId ?? null]); return { id: r.rows[0].id }; }
      catch (e) { if (String((e as Error).message).includes('survey_cycle_tenant_id_organization_id_code_key')) throw new HttpError(409, 'cycle_code_exists'); throw e; }
    });
  });
  app.patch('/api/t/:tid/cycles/:cid', async req => { const p = await requireTenant(req, (req.params as { tid: string }).tid); requireProfile(p, ...SETUP); req.idempotencyResource = { scope: 'tenant', profiles: [...SETUP] }; const { cid } = req.params as { cid: string }; const b = (req.body ?? {}) as { instrumentVersionId?: string }; return withContext(dbCtx(p), async tx => { if (!(await tx.query('SELECT 1 FROM instrument_version WHERE tenant_id = $1 AND id = $2', [p.tenantId, b.instrumentVersionId])).rowCount) throw new HttpError(404, 'instrument_not_found'); const c = (await tx.query('SELECT active_batch_id FROM survey_cycle WHERE tenant_id = $1 AND id = $2', [p.tenantId, cid])).rows[0]; if (!c) throw new HttpError(404, 'cycle_not_found'); if (c.active_batch_id) throw new HttpError(409, 'cycle_has_results', 'Sonuç yayımlanmış dönemin soru seti değiştirilemez; yeni dönem açın'); await tx.query('UPDATE survey_cycle SET instrument_version_id = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2', [p.tenantId, cid, b.instrumentVersionId]); return { ok: true }; }); });
  // ---------- kullanıcılar ve davetler
  app.get('/api/t/:tid/users', async req => { const p = await requireTenant(req, (req.params as { tid: string }).tid); requireProfile(p, ...SETUP); req.idempotencyResource = { scope: 'tenant', profiles: [...SETUP] }; return withContext(dbCtx(p), async tx => (await tx.query(`SELECT m.id AS membership_id, u.id AS user_id, u.email, u.display_name, u.status AS user_status, u.last_login_at, m.permission_profile, m.status AS membership_status, (SELECT su.external_id FROM org_unit su WHERE su.tenant_id = m.tenant_id AND su.id = m.scope_unit_id) AS scope_code, (SELECT string_agg(r.code, ', ') FROM accountability_assignment a JOIN org_role r ON r.tenant_id = a.tenant_id AND r.id = a.org_role_id WHERE a.tenant_id = m.tenant_id AND a.person_id = m.person_id AND a.effective_to IS NULL) AS roles, (SELECT json_build_object('status', i.status, 'version', i.version, 'sent_at', i.sent_at, 'accepted_at', i.accepted_at, 'expires_at', i.expires_at, 'delivery', (SELECT o.status FROM email_outbox o WHERE o.invitation_id = i.id ORDER BY o.created_at DESC LIMIT 1), 'transport', (SELECT o.transport FROM email_outbox o WHERE o.invitation_id = i.id ORDER BY o.created_at DESC LIMIT 1)) FROM invitation i WHERE i.tenant_id = m.tenant_id AND i.membership_id = m.id ORDER BY i.version DESC LIMIT 1) AS invitation FROM membership m JOIN app_user u ON u.id = m.user_id WHERE m.tenant_id = $1 ORDER BY u.email`, [p.tenantId])).rows); });
  app.post('/api/t/:tid/users', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); requireProfile(p, ...ADMIN); req.idempotencyResource = { scope: 'tenant', profiles: [...ADMIN] };
    const b = (req.body ?? {}) as { email?: string; displayName?: string; roleCodes?: string[]; invite?: boolean; locale?: string };
    return withContext(dbCtx(p), async tx => { const ctx = await ctxOf(tx, p); const v = await usersImporter.validate({ Kullanicilar: { name: 'Kullanicilar', header: ['tenant_code', 'operation', 'email', 'display_name', 'locale', 'timezone', 'login_method', 'invite_requested'], rows: [{ n: 2, cells: { tenant_code: ctx.tenantCode, operation: 'CREATE', email: b.email ?? '', display_name: b.displayName ?? '', locale: b.locale ?? 'tr', timezone: 'Europe/Istanbul', login_method: 'LOCAL_PASSWORD', invite_requested: b.invite === false ? 'NO' : 'YES' } }] }, Rol_Atamalari: { name: 'Rol_Atamalari', header: ['tenant_code', 'operation', 'email', 'role_code', 'assignment_kind', 'valid_from', 'valid_to'], rows: (b.roleCodes ?? []).map((rc, i) => ({ n: i + 2, cells: { tenant_code: ctx.tenantCode, operation: 'CREATE', email: b.email ?? '', role_code: rc, assignment_kind: 'PRIMARY', valid_from: new Date().toISOString().slice(0, 10), valid_to: '' } })) } }, tx, ctx); if (!v.report.ok) throw new HttpError(422, 'validation_failed', 'Kullanıcı eklenemedi', v.report.issues); return usersImporter.commit(v.payload, tx, ctx); });
  });
  app.post('/api/t/:tid/users/:mid/revoke', async req => { const p = await requireTenant(req, (req.params as { tid: string }).tid); requireProfile(p, ...ADMIN); req.idempotencyResource = { scope: 'tenant', profiles: [...ADMIN] }; const { mid } = req.params as { mid: string }; return withContext(dbCtx(p), async tx => { const m = (await tx.query('SELECT user_id, person_id FROM membership WHERE tenant_id = $1 AND id = $2', [p.tenantId, mid])).rows[0]; if (!m) throw new HttpError(404, 'not_found'); if (m.user_id === p.userId) throw new HttpError(409, 'cannot_revoke_self'); await tx.query('UPDATE membership SET status = $3, revoked_at = now() WHERE tenant_id = $1 AND id = $2', [p.tenantId, mid, 'revoked']); await tx.query('UPDATE invitation SET status = $3 WHERE tenant_id = $1 AND membership_id = $2 AND status IN ($4,$5,$6)', [p.tenantId, mid, 'revoked', 'draft', 'ready', 'pending']); await tx.query('UPDATE accountability_assignment SET effective_to = now() WHERE tenant_id = $1 AND person_id = $2 AND effective_to IS NULL', [p.tenantId, m.person_id]); const n = (await tx.query('SELECT auth_sessions_revoke_user($1,$2) AS n', [m.user_id, p.tenantId])).rows[0].n; await audit(tx, p, 'membership', mid, 'revoke', null, { sessionsRevoked: n }); return { ok: true, sessionsRevoked: n }; }); });
  /** Tek işlemle toplu davet: seçilen (ya da bütün "ready") davetler için kişisel token + kişi başına outbox kaydı; eski token geçersiz (yeni sürüm). */
  app.post('/api/t/:tid/invitations/send', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); requireProfile(p, ...ADMIN); req.idempotencyResource = { scope: 'tenant', profiles: [...ADMIN] };
    const b = (req.body ?? {}) as { membershipIds?: string[]; resend?: boolean };
    const result = await withContext(dbCtx(p), async tx => {
      const t = (await tx.query('SELECT name FROM tenant WHERE id = $1', [p.tenantId])).rows[0];
      const where = b.membershipIds?.length ? 'AND i.membership_id = ANY($2::uuid[])' : 'AND $2::uuid[] IS NOT NULL';
      const statuses = b.resend ? ['ready', 'pending', 'expired'] : ['ready'];
      const rows = (await tx.query(`SELECT i.id, i.user_id, i.membership_id, i.version, u.email, u.display_name, m.permission_profile, m.status AS mstatus FROM invitation i JOIN app_user u ON u.id = i.user_id JOIN membership m ON m.tenant_id = i.tenant_id AND m.id = i.membership_id WHERE i.tenant_id = $1 ${where} AND i.status = ANY($3::text[]) AND m.status = 'active' AND u.status <> 'disabled' FOR UPDATE OF i`, [p.tenantId, b.membershipIds ?? [], statuses])).rows;
      let queued = 0;
      for (const r of rows) {
        const token = newToken(); const version = r.version + (r.mstatus === 'active' && b.resend ? 1 : 0);
        await tx.query('UPDATE invitation SET token_hash = $3, version = $4, status = $5, expires_at = now() + ($6::text)::interval, sent_at = NULL WHERE tenant_id = $1 AND id = $2', [p.tenantId, r.id, tokenHash(token), version, 'pending', `${config.inviteTtlHours} hours`]);
        const link = `${config.appBaseUrl}/#/davet/${token}`;
        const body = `Sayın ${r.display_name},\n\n${t.name} için HPW Act hesabınız oluşturuldu.\nKullanıcı adınız: ${r.email}\nYetki profili: ${r.permission_profile}\n\nParolanızı belirlemek için kişisel bağlantınız (tek kullanımlık, ${config.inviteTtlHours} saat geçerli):\n${link}\n\nBu bağlantı yalnız size aittir; paylaşmayın. Sorun yaşarsanız şirketinizin İK yöneticisine yazın.`;
        await tx.query('INSERT INTO email_outbox (tenant_id, invitation_id, idempotency_key, to_email, subject, body_text) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (idempotency_key) DO NOTHING', [p.tenantId, r.id, `inv-${r.id}-v${version}`, r.email, `${t.name} · HPW Act daveti`, body]);
        queued++;
      }
      await audit(tx, p, 'invitation', null, b.resend ? 'resend' : 'send', null, { queued, membershipIds: b.membershipIds ?? 'all-ready' });
      return { queued };
    });
    const w = await runOutboxOnce(500); // kuyruğu hemen işle; durum kayıtları: queued → processing (kira) → sent/temp_fail/perm_fail/blocked
    return { ...result, delivery: w };
  });
  app.get('/api/t/:tid/invitations/outbox', async req => { const p = await requireTenant(req, (req.params as { tid: string }).tid); requireProfile(p, ...ADMIN); req.idempotencyResource = { scope: 'tenant', profiles: [...ADMIN] }; return withContext(dbCtx(p), async tx => (await tx.query('SELECT o.id, o.to_email, o.subject, o.status, o.transport, o.attempts, o.last_error, o.created_at, o.sent_at FROM email_outbox o WHERE o.tenant_id = $1 ORDER BY o.created_at DESC LIMIT 500', [p.tenantId])).rows); });
  // ---------- şablon indir / yükle / önizle / onayla / hata dosyası
  app.get('/api/t/:tid/templates/:kind.xlsx', async (req, reply) => {
    const { tid, kind } = req.params as { tid: string; kind: string }; const p = await requireTenant(req, tid); requireProfile(p, ...SETUP); req.idempotencyResource = { scope: 'tenant', profiles: [...SETUP] };
    const imp = IMPORTERS[kind]; if (!imp || (LEGACY_KINDS.includes(kind) && !config.legacyModules)) throw new HttpError(404, 'unknown_template');
    const cycleId = (req.query as { cycleId?: string }).cycleId ?? null;
    if ((kind === 'results' || kind === 'roadmap') && !cycleId) throw new HttpError(400, 'cycle_required', kind === 'roadmap' ? 'Yol haritası formu için dönem seçin' : 'Sonuç şablonu için dönem seçin');
    const buf = await withContext(dbCtx(p), async tx => imp.template(tx, await ctxOf(tx, p, cycleId)));
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').header('Content-Disposition', `attachment; filename="HPW_Act_${kind}_sablonu.xlsx"`); return reply.send(buf);
  });
  app.post('/api/t/:tid/imports/:kind', async req => {
    const { tid, kind } = req.params as { tid: string; kind: string }; const p = await requireTenant(req, tid); requireProfile(p, ...SETUP); req.idempotencyResource = { scope: 'tenant', profiles: [...SETUP] };
    const imp = IMPORTERS[kind]; if (!imp || (LEGACY_KINDS.includes(kind) && !config.legacyModules)) throw new HttpError(404, 'unknown_import'); requireProfile(p, ...importProfiles(kind));
    if (p.realm !== 'platform' && p.profile === 'HR_PARTNER' && !p.companyWide) throw new HttpError(403, 'company_wide_required', 'Toplu yükleme şirket geneli yetki ister');
    const cycleId = (req.query as { cycleId?: string }).cycleId ?? null; if ((kind === 'results' || kind === 'roadmap') && !cycleId) throw new HttpError(400, 'cycle_required');
    const { name, buf } = await readUpload(req); const hash = createHash('sha256').update(buf).digest('hex');
    const sheets = await readWorkbook(buf);
    return withContext(dbCtx(p), async tx => {
      const ctx = await ctxOf(tx, p, cycleId); const v = await imp.validate(sheets, tx, ctx);
      const job = (await tx.query('INSERT INTO import_job (tenant_id, kind, cycle_id, state, file_name, file_hash, file_size, template_version, row_count, error_count, warning_count, errors, preview, payload, created_by, pinned) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id', [p.tenantId, kind, cycleId, v.report.ok ? 'validated' : 'failed', name, hash, buf.length, v.templateVersion, v.rowCount, v.report.errors.length, v.report.warnings.length, JSON.stringify(v.report.issues.map(i => ({ ...i, value: i.code.startsWith('suppressed') ? undefined : i.value }))), JSON.stringify(v.preview), v.report.ok ? JSON.stringify(v.payload) : '{}', p.userId, JSON.stringify(v.pinned ?? {})])).rows[0].id;
      return { jobId: job, state: v.report.ok ? 'validated' : 'failed', rowCount: v.rowCount, errorCount: v.report.errors.length, warningCount: v.report.warnings.length, issues: v.report.issues.slice(0, 500), preview: v.preview, canCommit: v.report.ok };
    });
  });
  app.get('/api/t/:tid/imports', async req => { const p = await requireTenant(req, (req.params as { tid: string }).tid); requireProfile(p, ...SETUP); req.idempotencyResource = { scope: 'tenant', profiles: [...SETUP] }; return withContext(dbCtx(p), async tx => (await tx.query('SELECT id, kind, cycle_id, state, file_name, row_count, error_count, warning_count, preview, committed_at, created_at FROM import_job WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100', [p.tenantId])).rows); });
  app.get('/api/t/:tid/imports/:jid', async req => { const p = await requireTenant(req, (req.params as { tid: string }).tid); requireProfile(p, ...SETUP); req.idempotencyResource = { scope: 'tenant', profiles: [...SETUP] }; const { jid } = req.params as { jid: string }; return withContext(dbCtx(p), async tx => { const j = (await tx.query('SELECT id, kind, cycle_id, state, file_name, row_count, error_count, warning_count, errors, preview, committed_at, created_at, CASE WHEN state = $3 THEN payload ELSE NULL END AS committed_result FROM import_job WHERE tenant_id = $1 AND id = $2', [p.tenantId, jid, 'committed'])).rows[0]; if (!j) throw new HttpError(404, 'not_found'); return j; }); }); // P0-4: committed işin uygulanan sonucu (recover)
  app.get('/api/t/:tid/imports/:jid/errors.xlsx', async (req, reply) => { const p = await requireTenant(req, (req.params as { tid: string }).tid); requireProfile(p, ...SETUP); req.idempotencyResource = { scope: 'tenant', profiles: [...SETUP] }; const { jid } = req.params as { jid: string }; const errs = await withContext(dbCtx(p), async tx => { const j = (await tx.query('SELECT errors FROM import_job WHERE tenant_id = $1 AND id = $2', [p.tenantId, jid])).rows[0]; if (!j) throw new HttpError(404, 'not_found'); return j.errors; }); reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').header('Content-Disposition', 'attachment; filename="hata_satirlari.xlsx"'); return reply.send(await errorWorkbook(errs)); });
  app.post('/api/t/:tid/imports/:jid/commit', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); requireProfile(p, ...SETUP); req.idempotencyResource = { scope: 'tenant', profiles: [...SETUP] }; const { jid } = req.params as { jid: string };
    return withContext(dbCtx(p), async tx => {
      const j = (await tx.query('SELECT * FROM import_job WHERE tenant_id = $1 AND id = $2 FOR UPDATE', [p.tenantId, jid])).rows[0]; if (!j) throw new HttpError(404, 'not_found');
      if (j.state === 'committed') return { ok: true, recovered: true, applied: (j.payload as { applied?: unknown })?.applied ?? null, note: 'Bu iş daha önce işlenmişti; sonuç yeniden okundu, ikinci kez uygulanmadı' }; // P0-4: yanıt kaybı kurtarma
      if (j.state !== 'validated' || j.error_count > 0) throw new HttpError(409, 'not_committable', 'Hata içeren yükleme onaylanamaz; hata dosyasını indirip düzeltin ve yeniden yükleyin');
      requireProfile(p, ...importProfiles(j.kind as string)); req.idempotencyResource = { scope: 'tenant', profiles: [...importProfiles(j.kind as string)] };
      const imp = IMPORTERS[j.kind as string]!; const ctx = await ctxOf(tx, p, j.cycle_id);
      if (j.cycle_id) await tx.query('SELECT 1 FROM survey_cycle WHERE tenant_id = $1 AND id = $2 FOR UPDATE', [p.tenantId, j.cycle_id]); // V11: pin denetimi ve yayın aynı kilit altında
      if (imp.unitsAffected) { const codes = imp.unitsAffected(j.payload); const affectedIds: string[] = []; for (const code of codes) { if (code === '*') { if (!(p.realm === 'platform' || (p.companyWide && p.profile === 'HR_ADMIN'))) throw new HttpError(403, 'company_scope_required', 'Kök/şirket düzeyi değişiklik yalnız şirket geneli İK yöneticisi tarafından onaylanır'); continue; } const u = (await tx.query('SELECT id FROM org_unit WHERE tenant_id = $1 AND external_id = $2', [p.tenantId, code])).rows[0]; if (!u) continue; await requireUnitProfile(tx, p, u.id, 'HR_ADMIN', 'HR_PARTNER'); affectedIds.push(u.id); } if (affectedIds.length) req.idempotencyResource = { scope: 'units', unitIds: affectedIds, profiles: ['HR_ADMIN', 'HR_PARTNER'] }; } // M09/F99-03: onay anında birim/kapsam yetkisi; makbuz etkilenen birim kümesini taşır
      if (imp.grantsRequired) { const need = imp.grantsRequired(j.payload); const can = grantableProfiles(p); const bad = need.filter(x => !can.includes(x as (typeof can)[number])); if (bad.length) throw new HttpError(403, 'grant_not_allowed', `Onay anında yetkiniz bu dosyadaki profilleri vermeye yetmiyor: ${bad.join(', ')} (doğrulama taslak kontroldür, yetki komut anında yeniden çözülür)`); } // V07
      if (imp.pinnedNow) { const now = await imp.pinnedNow(tx, ctx); for (const [k, v] of Object.entries(j.pinned ?? {})) if (now[k] !== v) throw new HttpError(409, 'revalidate_required', `Doğrulamadan sonra ${k} değişti; dosyayı yeniden yükleyip doğrulayın`); } // R23
      const b = (req.body ?? {}) as { confirmReplace?: boolean }; if (j.kind === 'results' && (j.preview as { removedCells?: number }).removedCells && !b.confirmReplace) throw new HttpError(409, 'confirm_replace_required', `Bu yükleme aktif sonuç kümesinden ${(j.preview as { removedCells: number }).removedCells} hücreyi düşürecek (FULL_REPLACE); onaylamak için confirmReplace=true gönderin ya da import_mode=PATCH kullanın`); // R22
      const applied = await imp.commit(j.payload, tx, ctx);
      await audit(tx, p, 'import_job', jid, `commit:${j.kind}`, null, { fileHash: j.file_hash, rows: j.row_count, applied });
      await tx.query('UPDATE import_job SET state = $3, committed_at = now(), payload = $4 WHERE tenant_id = $1 AND id = $2', [p.tenantId, jid, 'committed', JSON.stringify({ applied, committedBy: p.userId })]); // P0-4: uygulanan sonuç job üzerinde; yanıt kaybında GET /imports/:jid ile geri okunur
      return { ok: true, ...applied };
    });
  });
  void isAtLeast;
}
