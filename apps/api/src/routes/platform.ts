import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { withContext, HttpError, type Tx } from '../db.js';
import { PLATFORM_CAN, platformAllows, type PlatformRole } from '../governance.js';
import { computeOnboarding } from '../onboarding.js';
import { evaluateTenant, RULES, ACTIVE } from '../workitems.js';
import { requireAuth, hashPassword, validatePassword, newToken, tokenHash, requireRecentMfa } from '../auth.js';
import { newSecret, seal, unseal, needsReseal, b32decode, verifyTotp, newRecoveryCodes, recoveryHash } from '../mfa.js';
import { rateLimit, rateReset } from './auth.js';
import { config } from '../config.js';
import { runOutboxOnce } from '../mailer.js';

/** HPW platform alanı: müşteri (tenant) oluşturma, ilk yetkili, yetkili müşteri listesi, platform personeli daveti. */
export async function platformRoutes(app: FastifyInstance) {
  const requirePlatform = (req: Parameters<typeof requireAuth>[0]) => { const p = requireAuth(req); if (p.realm !== 'platform') throw new HttpError(403, 'platform_only'); return p; };
  /** v2.9.0: merkez yönetimi yalnız HPW Sistem Yöneticisi */
  const requirePlatformAdmin = (req: Parameters<typeof requireAuth>[0]) => { const p = requirePlatform(req); if (p.platformRole !== 'admin') throw new HttpError(403, 'platform_admin_required', 'Bu işlem yalnız HPW Sistem Yöneticisine açıktır'); return p; };
  /** platform işlem geçmişi (aynı işlemde) */
  const paudit = (tx: Tx, actor: string, action: string, tenantId: string | null, targetType: string | null, targetId: string | null, before: unknown, after: unknown, reason?: string | null, interventionId?: string | null) => tx.query('INSERT INTO platform_audit_event (actor_id, action, tenant_id, target_type, target_id, before, after, reason, intervention_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [actor, action, tenantId, targetType, targetId, before === undefined || before === null ? null : JSON.stringify(before), after === undefined || after === null ? null : JSON.stringify(after), reason ?? null, interventionId ?? null]);
  const dbErr = (e: unknown): never => { const m = String((e as Error)?.message ?? e); const map: Record<string, [number, string, string]> = { platform_admin_required: [403, 'platform_admin_required', 'Bu işlem yalnız HPW Sistem Yöneticisine açıktır'], last_admin: [409, 'last_admin', 'Son Sistem Yöneticisi kaldırılamaz ya da rolü değiştirilemez'], primary_handover_required: [409, 'primary_handover_required', 'Ana danışman görevi önce başka bir danışmana devredilmelidir'], staff_not_found: [404, 'staff_not_found', 'HPW personeli bulunamadı'], assignment_not_found: [404, 'assignment_not_found', 'Atama bulunamadı'], duty_role_mismatch: [422, 'duty_role_mismatch', 'Bu görev kişinin HPW rolüyle uyumlu değil'], last_tenant_admin: [409, 'last_tenant_admin', 'Kişi bazı şirketlerin tek yöneticisi; önce bu şirketlere başka bir Sistem Yöneticisi atayın'], role_duty_conflict: [409, 'role_duty_conflict', 'Kişinin şirketlerdeki görevleri yeni rolle uyumlu değil; önce bu görevleri bitirin ya da devredin'], tenant_not_authorized: [403, 'tenant_not_authorized', 'Bu şirkette yetkiniz yok'] }; for (const [k, v] of Object.entries(map)) if (m.includes(k)) throw new HttpError(v[0], v[1], v[2]); if (/ux_pta_primary|ux_pta_backup/.test(m)) throw new HttpError(409, 'duty_taken', 'Bu şirkette bu görev zaten başka bir kişide; önce devredin'); if (/ux_intervention_active/.test(m)) throw new HttpError(409, 'intervention_active', 'Bu şirkette zaten etkin bir müdahale var'); throw e as Error; };
  app.get('/api/platform/tenants', async req => { const p = requirePlatform(req); return withContext({ realm: 'platform', userId: p.userId }, async tx => (await tx.query('SELECT * FROM platform_list_tenants()')).rows); });
  app.post('/api/platform/tenants', { schema: { body: { type: 'object', required: ['code', 'name'], properties: { code: { type: 'string', pattern: '^[A-Z0-9_-]{3,24}$' }, name: { type: 'string', minLength: 2, maxLength: 120 }, locale: { type: 'string', enum: ['tr', 'en'] }, timezone: { type: 'string', maxLength: 64 }, defaultLogin: { type: 'string', enum: ['LOCAL_PASSWORD', 'SSO'] }, adminEmail: { type: 'string', format: 'email' }, adminName: { type: 'string', maxLength: 120 } }, additionalProperties: false } } }, async req => {
    const p = requirePlatformAdmin(req); const b = req.body as { code: string; name: string; locale?: string; timezone?: string; defaultLogin?: string; adminEmail?: string; adminName?: string };
    return withContext({ realm: 'platform', userId: p.userId, platformWrite: true }, async tx => {
      let tenantId: string;
      try { tenantId = (await tx.query('SELECT platform_create_tenant($1,$2,$3,$4,$5) AS id', [b.code, b.name, b.locale ?? 'tr', b.timezone ?? 'Europe/Istanbul', b.defaultLogin ?? 'LOCAL_PASSWORD'])).rows[0].id; }
      catch (e) { if (String((e as Error).message).includes('ux_tenant_code')) { const ex = (await withContext({ realm: 'platform', userId: p.userId }, tx => tx.query('SELECT id, code, name, created_at FROM tenant WHERE code = $1', [String((b as { code: string }).code).trim().toLocaleUpperCase('en-US')]))).rows[0]; throw new HttpError(409, 'tenant_exists', 'Bu şirket kodu zaten kullanılıyor; yanıt kaybolduysa mevcut kayıt budur', ex ? { existing: { id: ex.id, code: ex.code, name: ex.name, createdAt: ex.created_at } } : undefined); } throw e; } // P0-3: yanıt kaybı kurtarma — aynı kodla ikinci komut var olan şirketi bildirir, ikinci şirket yaratmaz
      let invitation: { email: string } | null = null;
      if (b.adminEmail) {
        await tx.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
        const org = (await tx.query('SELECT id FROM organization WHERE tenant_id = $1', [tenantId])).rows[0].id;
        const uid = (await tx.query('SELECT upsert_user($1,$2,$3,$4) AS id', [b.adminEmail, b.adminName ?? b.adminEmail, b.locale ?? 'tr', b.timezone ?? 'Europe/Istanbul'])).rows[0].id;
        const person = (await tx.query('INSERT INTO person (tenant_id, organization_id, display_name, email, user_id) VALUES ($1,$2,$3,$4,$5) RETURNING id', [tenantId, org, b.adminName ?? b.adminEmail, b.adminEmail, uid])).rows[0].id;
        const mem = (await tx.query('INSERT INTO membership (tenant_id, user_id, permission_profile, person_id, explicit_profile, company_wide) VALUES ($1,$2,$3,$4,true,true) RETURNING id', [tenantId, uid, 'HR_ADMIN', person])).rows[0].id;
        await tx.query('INSERT INTO invitation (tenant_id, user_id, membership_id, status, created_by) VALUES ($1,$2,$3,$4,$5)', [tenantId, uid, mem, 'ready', p.userId]);
        // (denetim kaydı ilk yönetici olsun olmasın aşağıda yazılır)
        invitation = { email: b.adminEmail };
      }
      await tx.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
        await tx.query('INSERT INTO audit_event (tenant_id, entity_type, entity_id, action, new_value, actor_ref) VALUES ($1,$2,$3,$4,$5,$6)', [tenantId, 'tenant', tenantId, 'create', JSON.stringify({ code: b.code, name: b.name, firstAdmin: b.adminEmail ?? null }), p.userId]);
      await paudit(tx, p.userId, 'tenant.create', tenantId, 'tenant', tenantId, null, { code: b.code, name: b.name, firstAdmin: b.adminEmail ?? null });
      return { id: tenantId, code: b.code, name: b.name, firstAdminInvitation: invitation };
    });
  });
  /** HPW merkez paneli (temel): yetkili şirketlerin takip özeti. Şirket başına özet kendi bağlamında (RLS) okunur; tek şirketin hatası bütün listeyi düşürmez (error alanı). */
  app.get('/api/platform/portfolio', async req => {
    const p = requirePlatform(req);
    const tenants = await withContext({ realm: 'platform', userId: p.userId }, async tx => (await tx.query('SELECT * FROM platform_list_tenants()')).rows as { id: string; code: string; name: string; status: string; created_at: string }[]);
    const items = [] as unknown[];
    for (const t of tenants) {
      try {
        const s = await withContext({ realm: 'platform', userId: p.userId, tenantId: t.id }, async tx => {
          const c = (await tx.query(`SELECT (SELECT COUNT(*) FROM org_unit WHERE tenant_id = $1 AND effective_to IS NULL)::int AS units, (SELECT COUNT(*) FROM org_role WHERE tenant_id = $1 AND effective_to IS NULL)::int AS roles, (SELECT COUNT(*) FROM membership WHERE tenant_id = $1 AND status = 'active')::int AS members, (SELECT COUNT(*) FROM instrument_version WHERE tenant_id = $1)::int AS instruments, (SELECT COUNT(*) FROM survey_cycle WHERE tenant_id = $1)::int AS cycles, (SELECT COUNT(*) FROM survey_cycle WHERE tenant_id = $1 AND active_batch_id IS NOT NULL)::int AS published_cycles, (SELECT COUNT(*) FROM invitation WHERE tenant_id = $1 AND status IN ('ready','pending','sent','delivered','temp_fail'))::int AS open_invites, (SELECT COUNT(*) FROM invitation WHERE tenant_id = $1 AND status = 'accepted')::int AS accepted_invites, (SELECT COUNT(*) FROM tenant_failed_invitations($1))::int AS failed_invites /* v2.11.0: kaynak e-posta teslimatı (davet durumu perm_fail alamaz) */, (SELECT COUNT(*) FROM local_target WHERE tenant_id = $1 AND cycle_id = (SELECT tracked_cycle_id FROM tenant WHERE id = $1) AND status IN ('accepted','active'))::int AS targets, (SELECT COUNT(*) FROM action WHERE tenant_id = $1 AND cycle_id = (SELECT tracked_cycle_id FROM tenant WHERE id = $1) AND kind <> 'master')::int AS actions, (SELECT COUNT(*) FROM action WHERE tenant_id = $1 AND cycle_id = (SELECT tracked_cycle_id FROM tenant WHERE id = $1) AND lifecycle_state = 'in_progress' AND due_date < CURRENT_DATE)::int AS overdue_actions, (SELECT COUNT(*) FROM action WHERE tenant_id = $1 AND cycle_id = (SELECT tracked_cycle_id FROM tenant WHERE id = $1) AND lifecycle_state = 'declared_complete' AND verification_state = 'pending')::int AS awaiting_verification, (SELECT MAX(occurred_at) FROM audit_event WHERE tenant_id = $1) AS last_activity_at, (SELECT status_reason FROM tenant WHERE id = $1) AS status_reason, (SELECT status_changed_at FROM tenant WHERE id = $1) AS status_changed_at`, [t.id])).rows[0] as Record<string, unknown>;
          const setup = { organization: Number(c.units) > 0 && Number(c.roles) > 0, instrument: Number(c.instruments) > 0, results: Number(c.published_cycles) > 0, users: Number(c.accepted_invites) > 0 };
          const missing = Object.entries(setup).filter(([, v]) => !v).map(([k]) => k);
          const ob = await computeOnboarding(tx, t.id); // v2.10.0: on adımlı kurulum özeti, ana danışman, izlenen dönem
          const onb = ob ? { done: ob.summary.done, total: ob.summary.total, firstOpen: ob.summary.firstOpen } : null; const primaryConsultant = ob?.assignments.find(a => a.duty === 'primary')?.display_name ?? null; const trackedCycle = ob?.tracked ? { id: ob.tracked.id, code: ob.tracked.code } : null;
          return { onboarding: onb, primaryConsultant, trackedCycle, counts: { units: c.units, roles: c.roles, members: c.members, instruments: c.instruments, cycles: c.cycles, publishedCycles: c.published_cycles, openInvites: c.open_invites, acceptedInvites: c.accepted_invites, failedInvites: c.failed_invites, targets: ob?.tracked ? c.targets : null, actions: ob?.tracked ? c.actions : null, overdueActions: ob?.tracked ? c.overdue_actions : null, awaitingVerification: ob?.tracked ? c.awaiting_verification : null }, cycleBound: ob?.tracked ? 'tracked_cycle' : 'no_tracked_cycle', setup: { ...setup, complete: missing.length === 0, missing }, lastActivityAt: c.last_activity_at ?? null, statusReason: c.status_reason ?? null, statusChangedAt: c.status_changed_at ?? null };
        });
        items.push({ ...t, summary: s, error: null });
      } catch (e) { items.push({ ...t, summary: null, error: String((e as Error)?.message ?? e).slice(0, 200) }); }
    }
    return { contract: 'hpw-act-platform-portfolio/1', generatedAt: new Date().toISOString(), scope: { tenants: tenants.length, failed: items.filter(x => (x as { error: unknown }).error).length }, items };
  });
  /** Şirketi durdur / yeniden etkinleştir (yetkili platform yöneticisi; gerekçe zorunlu; durdurmada müşteri oturumları kapanır; denetim kaydı şirket bağlamında) */
  app.post('/api/platform/tenants/:tid/status', { schema: { body: { type: 'object', required: ['status', 'reason'], properties: { status: { type: 'string', enum: ['active', 'suspended', 'archived'] }, reason: { type: 'string', minLength: 3, maxLength: 500 } }, additionalProperties: false } } }, async req => {
    const p = requirePlatformAdmin(req); requireRecentMfa(p); const tid = (req.params as { tid: string }).tid; const b = req.body as { status: 'active' | 'suspended' | 'archived'; reason: string };
    if (!/^[0-9a-f-]{36}$/i.test(tid)) throw new HttpError(422, 'invalid_tenant');
    return withContext({ realm: 'platform', userId: p.userId, tenantId: tid, platformWrite: true, allowInactive: true }, async tx => {
      let prev: string;
      try { prev = (await tx.query('SELECT platform_set_tenant_status($1,$2,$3,$4) AS prev', [p.userId, tid, b.status, b.reason])).rows[0].prev; }
      catch (e) { const m = String((e as Error).message); if (m.includes('tenant_not_authorized')) throw new HttpError(403, 'tenant_not_authorized', 'Bu şirkette yetkiniz yok'); if (m.includes('tenant_not_found')) throw new HttpError(404, 'tenant_not_found'); if (m.includes('invalid_transition')) throw new HttpError(409, 'invalid_transition', 'Bu durum geçişine izin verilmez: arşive yalnız durdurulmuş şirket alınır; arşivden önce durdurulmuş duruma dönülür'); throw e; }
      const act = b.status === 'archived' ? 'tenant.archive' : prev === 'archived' ? 'tenant.unarchive' : b.status === 'suspended' ? 'tenant.suspend' : 'tenant.activate';
      await tx.query('INSERT INTO audit_event (tenant_id, entity_type, entity_id, action, old_value, new_value, actor_ref) VALUES ($1,$2,$3,$4,$5,$6,$7)', [tid, 'tenant', tid, act.replace('tenant.', ''), JSON.stringify({ status: prev }), JSON.stringify({ status: b.status, reason: b.reason }), p.userId]);
      await paudit(tx, p.userId, act, tid, 'tenant', tid, { status: prev }, { status: b.status }, b.reason);
      return { id: tid, status: b.status, previousStatus: prev, reason: b.reason };
    });
  });
  /** İlk (ya da ek) İK yöneticisi daveti: aynı e-posta ile ikinci çağrı yeni üyelik/davet oluşturmaz, mevcut durumu döner */
  app.post('/api/platform/tenants/:tid/admin-invite', { schema: { body: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' }, displayName: { type: 'string', maxLength: 120 } }, additionalProperties: false } } }, async req => {
    const p = requirePlatform(req); const tid = (req.params as { tid: string }).tid; const b = req.body as { email: string; displayName?: string };
    if (!/^[0-9a-f-]{36}$/i.test(tid)) throw new HttpError(422, 'invalid_tenant');
    const cx = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM platform_tenant_ctx($1,$2)', [p.userId, tid])).rows[0] as { has_access: boolean; role: PlatformRole | null; tenant_status: string | null });
    if (!cx?.has_access) throw new HttpError(403, 'tenant_not_authorized', 'Bu şirkette yetkiniz yok');
    const v = platformAllows(cx.role, 'setup', cx.tenant_status, false); if (!v.ok) throw new HttpError(403, 'platform_capability', v.reason === 'suspended' ? 'Şirket durdurulmuş ya da arşivlenmiş; HPW yalnız okuyabilir' : 'HPW rolünüz bu işleme izin vermiyor');
    return withContext({ realm: 'platform', userId: p.userId, tenantId: tid, platformWrite: true }, async tx => {
      const t = (await tx.query('SELECT locale, timezone FROM tenant WHERE id = $1', [tid])).rows[0] as { locale: string; timezone: string } | undefined; if (!t) throw new HttpError(404, 'tenant_not_found');
      const uid = (await tx.query('SELECT upsert_user($1,$2,$3,$4) AS id', [b.email, b.displayName ?? b.email, t.locale, t.timezone])).rows[0].id as string;
      const ex = (await tx.query(`SELECT m.id, m.permission_profile, (SELECT status FROM invitation i WHERE i.membership_id = m.id ORDER BY i.created_at DESC LIMIT 1) AS invitation_status FROM membership m WHERE m.tenant_id = $1 AND m.user_id = $2 AND m.status = 'active'`, [tid, uid])).rows[0] as { id: string; permission_profile: string; invitation_status: string | null } | undefined;
      if (ex) return { membershipId: ex.id, existing: true, permissionProfile: ex.permission_profile, invitationStatus: ex.invitation_status };
      const org = (await tx.query('SELECT id FROM organization WHERE tenant_id = $1', [tid])).rows[0].id;
      const person = (await tx.query('INSERT INTO person (tenant_id, organization_id, display_name, email, user_id) VALUES ($1,$2,$3,$4,$5) RETURNING id', [tid, org, b.displayName ?? b.email, b.email, uid])).rows[0].id;
      const mem = (await tx.query('INSERT INTO membership (tenant_id, user_id, permission_profile, person_id, explicit_profile, company_wide) VALUES ($1,$2,$3,$4,true,true) RETURNING id', [tid, uid, 'HR_ADMIN', person])).rows[0].id as string;
      await tx.query('INSERT INTO invitation (tenant_id, user_id, membership_id, status, created_by) VALUES ($1,$2,$3,$4,$5)', [tid, uid, mem, 'ready', p.userId]);
      await tx.query('INSERT INTO audit_event (tenant_id, entity_type, entity_id, action, new_value, actor_ref) VALUES ($1,$2,$3,$4,$5,$6)', [tid, 'membership', mem, 'platform_admin_invite', JSON.stringify({ email: b.email }), p.userId]);
      await paudit(tx, p.userId, 'tenant.admin_invite', tid, 'membership', mem, null, { email: b.email });
      return { membershipId: mem, existing: false, permissionProfile: 'HR_ADMIN', invitationStatus: 'ready' };
    });
  });
  // ilk platform yöneticisi: tek seferlik, atomik (R35); SETUP_KEY varsa zorunlu, üretimde zorunlu
  app.post('/api/platform/bootstrap', { schema: { body: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' }, displayName: { type: 'string', maxLength: 120 }, setupKey: { type: 'string' } } } } }, async req => {
    const b = req.body as { email: string; password: string; displayName?: string; setupKey?: string };
    if (config.setupKey && b.setupKey !== config.setupKey) throw new HttpError(403, 'setup_key_invalid');
    const bad = validatePassword(b.password); if (bad) throw new HttpError(400, 'weak_password', bad);
    try { const r = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT platform_bootstrap($1,$2,$3) AS id', [b.email, b.displayName ?? 'HPW Yönetici', hashPassword(b.password)])).rows[0]); return { id: r.id }; }
    catch (e) { if (String((e as Error).message).includes('already_bootstrapped')) throw new HttpError(409, 'already_bootstrapped', 'Platform yöneticisi zaten var'); throw e; }
  });
  // platform personeli: davet benzeri parola kurma bağlantısı (R34)
  // platform personeli (v2.9.0): yalnız Sistem Yöneticisi; rol zorunlu (varsayılan danışman); isteğe bağlı şirket atamaları görevleriyle; parola kurma bağlantısı (R34)
  const createStaff = async (req: Parameters<typeof requireAuth>[0]) => {
    const p = requirePlatformAdmin(req); requireRecentMfa(p); const b = req.body as { email: string; displayName?: string; role?: PlatformRole; tenantIds?: string[]; duty?: string; reason?: string };
    const role: PlatformRole = b.role ?? 'consultant'; const duty = b.duty ?? (role === 'admin' ? 'admin_scope' : role === 'consultant' ? 'backup' : role);
    const r = await withContext({ realm: 'platform', userId: p.userId, platformWrite: true }, async tx => {
      const uid = (await tx.query('SELECT platform_create_user($1,$2) AS id', [b.email, b.displayName ?? b.email])).rows[0].id as string;
      try { await tx.query('SELECT platform_role_set($1,$2,$3,$4)', [p.userId, uid, role, b.reason ?? 'personel açıldı']); for (const t of b.tenantIds ?? []) await tx.query('SELECT platform_assign($1,$2,$3,$4,$5,NULL)', [p.userId, uid, t, duty, b.reason ?? 'personel açılışında atama']); } catch (e) { dbErr(e); }
      const token = newToken();
      await tx.query('SELECT auth_password_token_create($1,$2,$3,$4::interval)', [b.email, 'set', tokenHash(token), `${config.inviteTtlHours} hours`]);
      await paudit(tx, p.userId, 'staff.create', null, 'user', uid, null, { email: b.email, role, tenants: b.tenantIds ?? [], duty });
      return { id: uid, token };
    });
    await withContext({ realm: 'worker' }, tx => tx.query('INSERT INTO email_outbox (to_email, subject, body_text, idempotency_key) VALUES ($1,$2,$3,$4)', [b.email, 'HPW Act platform erişimi', `Platform hesabınız açıldı (${config.envName}). Parolanızı belirlemek için bağlantı (${config.inviteTtlHours} saat, tek kullanımlık):\n${config.appBaseUrl}/#/parola/${r.token}`, `platform-${r.id}-${Date.now()}`]));
    await runOutboxOnce(10).catch(() => null); return { id: r.id, role };
  };
  const staffBody = { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' }, displayName: { type: 'string', maxLength: 120 }, role: { type: 'string', enum: ['admin', 'consultant', 'methodologist', 'auditor'] }, duty: { type: 'string', enum: ['admin_scope', 'primary', 'backup', 'methodologist', 'auditor'] }, reason: { type: 'string', maxLength: 500 }, tenantIds: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: 500 } }, additionalProperties: false };
  app.post('/api/platform/users', { schema: { body: staffBody } }, createStaff);
  app.post('/api/platform/staff', { schema: { body: staffBody } }, createStaff);
  /** v2.10.0 şirket işletimi: detay (özet, kurulum, dönemler, sorumlular, son olaylar) */
  const tenantCtx = async (p: ReturnType<typeof requirePlatform>, tid: string, cls: 'read' | 'setup') => {
    if (!/^[0-9a-f-]{36}$/i.test(tid)) throw new HttpError(403, 'tenant_not_authorized', 'Bu şirkette yetkiniz yok');
    const cx = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM platform_tenant_ctx($1,$2)', [p.userId, tid])).rows[0] as { has_access: boolean; role: PlatformRole | null; tenant_status: string | null });
    if (!cx?.has_access) throw new HttpError(403, 'tenant_not_authorized', 'Bu şirkette yetkiniz yok');
    const v = platformAllows(cx.role, cls, cx.tenant_status, false); if (!v.ok) throw new HttpError(403, 'platform_capability', v.reason === 'suspended' ? 'Şirket durdurulmuş ya da arşivlenmiş; HPW yalnız okuyabilir' : 'HPW rolünüz bu işleme izin vermiyor');
    return cx;
  };
  app.get('/api/platform/tenants/:tid', async req => {
    const p = requirePlatform(req); const tid = (req.params as { tid: string }).tid; const cx = await tenantCtx(p, tid, 'read');
    return withContext({ realm: 'platform', userId: p.userId, tenantId: tid }, async tx => {
      const ob = await computeOnboarding(tx, tid); if (!ob) throw new HttpError(403, 'tenant_not_authorized', 'Bu şirkette yetkiniz yok');
      const t = (await tx.query('SELECT id, code, name, status, status_reason, status_changed_at, archived_at, archive_reason, tracked_cycle_id, tracked_cycle_set_at, ops_version, service_record, service_record_at, locale, timezone, created_at FROM tenant WHERE id = $1', [tid])).rows[0];
      const events = (await tx.query(`SELECT e.id, e.occurred_at, u.email AS actor_email, e.action, e.reason, e.result, e.intervention_id FROM platform_audit_event e LEFT JOIN app_user u ON u.id = e.actor_id WHERE e.tenant_id = $1 ORDER BY e.occurred_at DESC LIMIT 10`, [tid])).rows;
      const canSetup = platformAllows(cx.role, 'setup', cx.tenant_status, false).ok;
      // v3.0 (ADR-0043) sade kurulum: organizasyon → yol haritası → kullanıcılar ve davet (üç dosya)
      const k = (await tx.query(`SELECT (SELECT COUNT(*) FROM org_unit WHERE tenant_id = $1 AND effective_to IS NULL)::int AS units,
          (SELECT COUNT(*) FROM rm2_roadmap WHERE tenant_id = $1 AND status = 'active')::int AS roadmaps,
          (SELECT COUNT(*) FROM rm2_plan pl JOIN rm2_roadmap r ON r.tenant_id = pl.tenant_id AND r.id = pl.roadmap_id AND r.status = 'active' WHERE pl.tenant_id = $1)::int AS plans,
          (SELECT to_char(MAX(r.start_date), 'YYYY-MM-DD') FROM rm2_roadmap r WHERE r.tenant_id = $1 AND r.status = 'active') AS start_date,
          (SELECT COUNT(*) FROM membership WHERE tenant_id = $1 AND status = 'active')::int AS members,
          (SELECT COUNT(*) FROM invitation WHERE tenant_id = $1 AND status IN ('draft','ready'))::int AS unsent,
          (SELECT COUNT(*) FROM invitation WHERE tenant_id = $1 AND status = 'pending')::int AS pending,
          (SELECT COUNT(*) FROM invitation WHERE tenant_id = $1 AND status = 'accepted')::int AS accepted`, [tid])).rows[0];
      const setup3 = { organization: { units: k.units, done: k.units > 1 }, roadmap: { roadmaps: k.roadmaps, plans: k.plans, startDate: k.start_date, done: k.roadmaps > 0 }, users: { members: k.members, unsent: k.unsent, pending: k.pending, accepted: k.accepted, done: k.members > 1 && k.unsent === 0 }, loginPath: `/g/${t.code}` };
      return { contract: 'hpw-act-platform-tenant/1', tenant: t, setup3, onboarding: { steps: ob.steps, summary: ob.summary, fingerprints: ob.fingerprints }, cycles: ob.cycles.map(c => ({ ...c, tracked: c.id === t.tracked_cycle_id })), assignments: ob.assignments, recentEvents: events,
        can: { setup: canSetup, manage: cx.role === 'admin', approveServiceRecord: cx.role === 'admin' && cx.tenant_status === 'active', approveGoLive: (cx.role === 'admin' || ob.assignments.some(a => a.user_id === p.userId && a.duty === 'primary')) && cx.tenant_status === 'active' } };
    });
  });
  const verBody = (extra: Record<string, unknown>, req: string[]) => ({ type: 'object', required: [...req, 'expectedVersion'], properties: { ...extra, expectedVersion: { type: 'integer', minimum: 1 } }, additionalProperties: false });
  const versionConflict = async (tx: Tx, tid: string) => { const cur = (await tx.query('SELECT ops_version FROM tenant WHERE id = $1', [tid])).rows[0]?.ops_version; return new HttpError(409, 'version_conflict', 'Şirket kaydı siz görüntüledikten sonra değişti; güncel hali yüklendi, işlemi yeniden değerlendirin', { currentVersion: cur }); };
  /** izlenen dönem: açıkça seçilir; sürüm denetimli; dönem aynı şirkete ait olmalı */
  app.patch('/api/platform/tenants/:tid/tracked-cycle', { schema: { body: verBody({ cycleId: { type: ['string', 'null'], format: 'uuid' } }, ['cycleId']) } }, async req => {
    const p = requirePlatform(req); const tid = (req.params as { tid: string }).tid; await tenantCtx(p, tid, 'setup'); const b = req.body as { cycleId: string | null; expectedVersion: number };
    return withContext({ realm: 'platform', userId: p.userId, tenantId: tid, platformWrite: true }, async tx => {
      if (b.cycleId && !(await tx.query('SELECT 1 FROM survey_cycle WHERE tenant_id = $1 AND id = $2', [tid, b.cycleId])).rowCount) throw new HttpError(422, 'cycle_not_in_tenant', 'Seçilen dönem bu şirkete ait değil');
      const prev = (await tx.query('SELECT tracked_cycle_id FROM tenant WHERE id = $1', [tid])).rows[0]?.tracked_cycle_id ?? null;
      const r = await tx.query('UPDATE tenant SET tracked_cycle_id = $2, tracked_cycle_set_by = $3, tracked_cycle_set_at = now(), ops_version = ops_version + 1 WHERE id = $1 AND ops_version = $4 RETURNING ops_version', [tid, b.cycleId, p.userId, b.expectedVersion]);
      if (!r.rowCount) throw await versionConflict(tx, tid);
      await paudit(tx, p.userId, 'tenant.tracked_cycle', tid, 'tenant', tid, { cycleId: prev }, { cycleId: b.cycleId }, null);
      await tx.query('INSERT INTO audit_event (tenant_id, entity_type, entity_id, action, old_value, new_value, actor_ref) VALUES ($1,$2,$3,$4,$5,$6,$7)', [tid, 'tenant', tid, 'tracked_cycle', JSON.stringify({ cycleId: prev }), JSON.stringify({ cycleId: b.cycleId }), p.userId]);
      return { tenantId: tid, trackedCycleId: b.cycleId, version: r.rows[0].ops_version };
    });
  });
  /** hizmet ve veri yönetimi kaydı (kurulum adımı 2): yalnız Sistem Yöneticisi; değişince onay yeniden kontrol ister */
  const srProps = { ref: { type: 'string', minLength: 1, maxLength: 120 }, scope: { type: 'string', minLength: 1, maxLength: 500 }, owners: { type: 'string', minLength: 1, maxLength: 300 }, retentionPolicyRef: { type: 'string', minLength: 1, maxLength: 120 } };
  app.post('/api/platform/tenants/:tid/service-record', { schema: { body: verBody(srProps, ['ref', 'scope', 'owners', 'retentionPolicyRef']) } }, async req => {
    const p = requirePlatformAdmin(req); const tid = (req.params as { tid: string }).tid; await tenantCtx(p, tid, 'setup'); const b = req.body as { ref: string; scope: string; owners: string; retentionPolicyRef: string; expectedVersion: number };
    const rec = { ref: b.ref.trim(), scope: b.scope.trim(), owners: b.owners.trim(), retentionPolicyRef: b.retentionPolicyRef.trim() };
    return withContext({ realm: 'platform', userId: p.userId, tenantId: tid, platformWrite: true }, async tx => {
      const prev = (await tx.query('SELECT service_record FROM tenant WHERE id = $1', [tid])).rows[0]?.service_record ?? null;
      const r = await tx.query('UPDATE tenant SET service_record = $2, service_record_by = $3, service_record_at = now(), ops_version = ops_version + 1 WHERE id = $1 AND ops_version = $4 RETURNING ops_version', [tid, JSON.stringify(rec), p.userId, b.expectedVersion]);
      if (!r.rowCount) throw await versionConflict(tx, tid);
      await paudit(tx, p.userId, 'tenant.service_record', tid, 'tenant', tid, prev, rec, null);
      return { tenantId: tid, serviceRecord: rec, version: r.rows[0].ops_version };
    });
  });
  /** elle onaylı kurulum adımları: onay, o andaki kanıtın parmak izini saklar */
  app.post('/api/platform/tenants/:tid/onboarding/:step/approve', { schema: { body: verBody({ reason: { type: 'string', minLength: 3, maxLength: 500 }, expectedFingerprint: { type: 'string', minLength: 8, maxLength: 64 } }, ['reason', 'expectedFingerprint']) } }, async req => {
    const p = requirePlatform(req); const { tid, step } = req.params as { tid: string; step: string }; const cx = await tenantCtx(p, tid, 'setup'); const b = req.body as { reason: string; expectedVersion: number; expectedFingerprint: string };
    if (step !== 'service_record' && step !== 'go_live') throw new HttpError(404, 'step_not_found', 'Bu kurulum adımı elle onaylanmaz');
    return withContext({ realm: 'platform', userId: p.userId, tenantId: tid, platformWrite: true }, async tx => {
      const ob = await computeOnboarding(tx, tid); if (!ob) throw new HttpError(403, 'tenant_not_authorized', 'Bu şirkette yetkiniz yok');
      if (ob.tenant.ops_version !== b.expectedVersion) throw await versionConflict(tx, tid);
      const isPrimary = ob.assignments.some(a => a.user_id === p.userId && a.duty === 'primary');
      if (step === 'service_record' && cx.role !== 'admin') throw new HttpError(403, 'platform_admin_required', 'Bu işlem yalnız HPW Sistem Yöneticisine açıktır');
      if (step === 'go_live' && cx.role !== 'admin' && !isPrimary) throw new HttpError(403, 'platform_capability', 'Kullanıma açılışı Sistem Yöneticisi ya da şirketin ana danışmanı onaylar');
      if (step === 'service_record' && !ob.fingerprints.service_record) throw new HttpError(409, 'step_prerequisite', 'Önce hizmet ve veri yönetimi kaydını girin');
      if (step === 'go_live' && !ob.prerequisitesDone) throw new HttpError(409, 'step_prerequisite', 'Kullanıma açılış için 1–9. adımların tamamlanmış olması gerekir');
      // görülen kanıt ≠ şu anki kanıt ise onay verilmez (kaynak kontrolü ile onay arasındaki değişiklik eski kanıtı onaylatmaz); onaydan sonraki değişiklik ise durumu 'yeniden kontrol'e çevirir
      if (b.expectedFingerprint !== ob.fingerprints[step]) throw new HttpError(409, 'evidence_changed', 'Onaylamak istediğiniz kanıt siz görüntüledikten sonra değişti; güncel durumu inceleyip yeniden onaylayın', { currentFingerprint: ob.fingerprints[step] });
      await tx.query('UPDATE onboarding_approval SET superseded_at = now() WHERE tenant_id = $1 AND step_key = $2 AND superseded_at IS NULL', [tid, step]);
      await tx.query('INSERT INTO onboarding_approval (tenant_id, step_key, approved_by, reason, evidence_fingerprint) VALUES ($1,$2,$3,$4,$5)', [tid, step, p.userId, b.reason.trim(), ob.fingerprints[step]]);
      const v = (await tx.query('UPDATE tenant SET ops_version = ops_version + 1 WHERE id = $1 RETURNING ops_version', [tid])).rows[0].ops_version;
      await paudit(tx, p.userId, 'onboarding.approve', tid, 'onboarding_step', step, null, { step }, b.reason.trim());
      if (step === 'go_live') await tx.query('INSERT INTO audit_event (tenant_id, entity_type, entity_id, action, new_value, actor_ref, reason) VALUES ($1,$2,$3,$4,$5,$6,$7)', [tid, 'tenant', tid, 'go_live', JSON.stringify({ approvedBy: p.email }), p.userId, b.reason.trim()]);
      return { tenantId: tid, step, approved: true, version: v };
    });
  });
  /** v2.11.0 bekleyen işler (MP08; docs/tasarim/BEKLEYEN-ISLER-KURALLARI-v2.11.md) */
  const WI_FRESH_MS = 5 * 60 * 1000;
  app.get('/api/platform/work-items', async req => {
    const p = requirePlatform(req); const q = req.query as { tenantId?: string; state?: string; rule?: string; includeResolved?: string; evaluate?: string };
    // evaluate=0: yalnız kayıtlı durum (değerlendirme yok) — arayüz ilk görünümü bununla hemen çizer, ardından evaluate=1 ile değerlendirmeyi tetikler
    const tenants = await withContext({ realm: 'platform', userId: p.userId }, async tx => (await tx.query('SELECT * FROM platform_list_tenants()')).rows as { id: string; code: string; name: string; status: string }[]);
    const scope = q.tenantId ? tenants.filter(t => t.id === q.tenantId) : tenants;
    const last = await withContext({ realm: 'platform', userId: p.userId }, async tx => (await tx.query('SELECT tenant_id, MIN(last_attempt_at) AS at, COUNT(*)::int AS n FROM platform_work_eval GROUP BY tenant_id')).rows as { tenant_id: string; at: string; n: number }[]);
    const lastBy = new Map(last.map(r => [r.tenant_id, r]));
    // değerlendirme LİSTE AÇILIŞINDA tetiklenir (arka plan değerlendiricisi yok); son değerlendirmesi 5 dk'dan eski şirketler sırayla, toplam 8 sn bütçeyle değerlendirilir.
    // Bir şirketin hatası/gecikmesi diğerlerini engellemez: o şirket evaluationFailures ya da evaluationDeferred'da listelenir, son bilinen durumu (zamanıyla) gösterilir.
    const evalFailed: { tenantId: string; error: string }[] = []; const deferred: string[] = []; const t0 = Date.now();
    for (const t of q.evaluate === '0' ? [] : scope) { const l = lastBy.get(t.id); if (l && l.n >= RULES.length && Date.now() - new Date(l.at).getTime() < WI_FRESH_MS) continue;
      if (Date.now() - t0 > 8000) { deferred.push(t.id); continue; }
      try { await withContext({ realm: 'platform', userId: p.userId, tenantId: t.id, platformWrite: true, allowInactive: true }, tx => evaluateTenant(tx, t.id, p.userId)); } catch (e) { evalFailed.push({ tenantId: t.id, error: String((e as Error).message ?? e).slice(0, 120) }); } }
    return withContext({ realm: 'platform', userId: p.userId }, async tx => {
      const states = q.includeResolved === '1' ? null : ACTIVE;
      const rows = (await tx.query(`SELECT w.id, w.tenant_id, t.code AS tenant_code, t.name AS tenant_name, t.status AS tenant_status, w.rule, w.occurrence, w.state, w.owner_role, w.claimed_by, u.display_name AS claimed_by_name, w.claimed_at, w.snoozed_until, w.dismissed_until, w.state_reason, w.opened_at, w.due_at, w.resolved_at, w.evidence, w.eval_status, w.eval_error, w.last_ok_eval_at, w.last_eval_at, w.version
        FROM platform_work_item w JOIN tenant t ON t.id = w.tenant_id LEFT JOIN app_user u ON u.id = w.claimed_by
        WHERE ($1::text[] IS NULL OR w.state = ANY($1)) AND ($2::uuid IS NULL OR w.tenant_id = $2) AND ($3::text IS NULL OR w.state = $3) AND ($4::text IS NULL OR w.rule = $4)
        ORDER BY w.due_at, t.code, w.rule, w.id LIMIT 500`, [states, q.tenantId ?? null, q.state ?? null, q.rule ?? null])).rows;
      // v2.11.1 (V211-03): kural sonucu tablo filtresinden bağımsızdır — active_item_state, o şirket+kural için etkin iş varsa durumu (yoksa null)
      const evals = (await tx.query(`SELECT e.tenant_id, t.code AS tenant_code, e.rule, e.status, e.detail, e.last_ok_at, e.last_attempt_at, a.state AS active_item_state FROM platform_work_eval e JOIN tenant t ON t.id = e.tenant_id LEFT JOIN LATERAL (SELECT w.state FROM platform_work_item w WHERE w.tenant_id = e.tenant_id AND w.rule = e.rule AND w.state <> 'resolved' LIMIT 1) a ON true WHERE ($1::uuid IS NULL OR e.tenant_id = $1) ORDER BY t.code, e.rule`, [q.tenantId ?? null])).rows;
      const roles = new Map<string, PlatformRole | null>(); for (const t of scope) roles.set(t.id, (await tx.query('SELECT * FROM platform_tenant_ctx($1,$2)', [p.userId, t.id])).rows[0]?.role ?? null);
      const can = (r: { tenant_id: string; owner_role: string; state: string; claimed_by: string | null; tenant_status: string }) => { const role = roles.get(r.tenant_id) ?? null; const act = r.tenant_status === 'active' && r.state !== 'resolved' && r.state !== 'tenant_inactive' && (role === 'admin' || role === r.owner_role);
        return { claim: act && r.state === 'open', release: act && r.state === 'claimed' && (r.claimed_by === p.userId || role === 'admin'), snooze: act && (r.state === 'open' || r.state === 'claimed'), dismiss: role === 'admin' && r.tenant_status === 'active' && ['open', 'claimed', 'snoozed'].includes(r.state) }; };
      return { contract: 'hpw-act-work-items/1', generatedAt: new Date().toISOString(), items: rows.map(r => ({ ...r, can: can(r) })), evaluations: evals, evaluationFailures: evalFailed, evaluationDeferred: deferred, evaluationTrigger: 'list_open', evaluated: q.evaluate !== '0', freshnessMinutes: 5 };
    });
  });
  /** v2.11.4 (V2113-A01/A02): komut sonucu sorgusu — kanıt komut kimliğine (kullanıcı + işlem anahtarı) bağlıdır; durum/sürüm/alan benzerliği kanıt sayılmaz.
   * applied: bu kullanıcının bu anahtarla gönderdiği komut kaydedilmiş (yanıt komutla aynı transaction'da saklanır); route işi ve işlemi gösterir.
   * not_found: bu kullanıcı için bu anahtarla kaydedilmiş komut yok. Komutun şirketine güncel erişim yoksa 404 command_not_visible (sonuç doğrulanamaz). */
  app.get('/api/platform/commands/:key/outcome', async req => {
    const p = requirePlatform(req); const key = String((req.params as { key: string }).key ?? ''); if (!key || key.length > 200) throw new HttpError(404, 'command_not_found', 'Komut bulunamadı');
    const row = await withContext({ realm: 'platform', userId: p.userId }, async tx => (await tx.query('SELECT route, tenant_id, response_status, response_body, created_at FROM platform_command WHERE user_id = $1 AND key = $2', [p.userId, key])).rows[0] as { route: string; tenant_id: string | null; response_status: number; response_body: unknown; created_at: string } | undefined);
    if (!row) return { contract: 'hpw-act-command-outcome/1', key, status: 'not_found', route: null, tenantId: null, responseStatus: null, response: null, recordedAt: null };
    if (row.tenant_id) { const cx = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM platform_tenant_ctx($1,$2)', [p.userId, row.tenant_id])).rows[0] as { has_access: boolean } | undefined); if (!cx?.has_access) throw new HttpError(404, 'command_not_visible', 'Bu komutun sonucu görüntülenemiyor (şirkete erişiminiz yok)'); }
    return { contract: 'hpw-act-command-outcome/1', key, status: 'applied', route: row.route, tenantId: row.tenant_id, responseStatus: row.response_status, response: row.response_body, recordedAt: row.created_at };
  });
  app.get('/api/platform/work-items/:id/history', async req => {
    const p = requirePlatform(req); const id = (req.params as { id: string }).id; if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'work_item_not_found', 'İş bulunamadı');
    return withContext({ realm: 'platform', userId: p.userId }, async tx => {
      const it = (await tx.query('SELECT tenant_id FROM platform_work_item WHERE id = $1', [id])).rows[0]; if (!it) throw new HttpError(404, 'work_item_not_found', 'İş bulunamadı');
      return (await tx.query(`SELECT e.id, e.occurred_at, e.action, u.email AS actor_email, u.display_name AS actor_name, e.before, e.after, e.reason FROM platform_audit_event e LEFT JOIN app_user u ON u.id = e.actor_id WHERE e.target_type = 'work_item' AND e.target_id = $1 ORDER BY e.occurred_at, e.id`, [id])).rows;
    });
  });
  const wiBody = { type: 'object', required: ['expectedVersion'], properties: { expectedVersion: { type: 'integer', minimum: 1 }, reason: { type: 'string', minLength: 3, maxLength: 500 }, until: { type: 'string', format: 'date-time' } }, additionalProperties: false };
  app.post('/api/platform/work-items/:id/:op', { schema: { body: wiBody } }, async (req, reply) => {
    const p = requirePlatform(req); const { id, op } = req.params as { id: string; op: string }; const b = req.body as { expectedVersion: number; reason?: string; until?: string };
    if (!['claim', 'release', 'snooze', 'dismiss'].includes(op)) throw new HttpError(404, 'not_found', 'Bilinmeyen işlem');
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'work_item_not_found', 'İş bulunamadı');
    const key = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'].slice(0, 200) : null; const route = `POST /work-items/${id}/${op}`; const hash = createHash('sha256').update(route + JSON.stringify(b)).digest('hex');
    // güncel yetki her istekte (tekrarda da) yeniden denetlenir: iş görünür mü, şirket etkin mi, rol uygun mu
    const item = await withContext({ realm: 'platform', userId: p.userId }, async tx => (await tx.query('SELECT id, tenant_id, rule, state, owner_role, claimed_by, version FROM platform_work_item WHERE id = $1', [id])).rows[0] as { id: string; tenant_id: string; rule: string; state: string; owner_role: string; claimed_by: string | null; version: number } | undefined);
    if (!item) throw new HttpError(404, 'work_item_not_found', 'İş bulunamadı');
    const cx = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM platform_tenant_ctx($1,$2)', [p.userId, item.tenant_id])).rows[0] as { has_access: boolean; role: PlatformRole | null; tenant_status: string | null });
    if (!cx?.has_access) throw new HttpError(404, 'work_item_not_found', 'İş bulunamadı');
    if (cx.tenant_status !== 'active') throw new HttpError(403, 'platform_capability', 'Şirket durdurulmuş ya da arşivlenmiş; bekleyen işlerde işlem yapılamaz');
    if (op === 'dismiss' ? cx.role !== 'admin' : !(cx.role === 'admin' || cx.role === item.owner_role)) throw new HttpError(403, 'platform_capability', op === 'dismiss' ? 'Reddetme yalnız HPW Sistem Yöneticisine açıktır' : 'HPW rolünüz bu işe izin vermiyor');
    if (key) { const prev = await withContext({ realm: 'platform', userId: p.userId }, async tx => (await tx.query('SELECT route, payload_hash, response_status, response_body FROM platform_command WHERE user_id = $1 AND key = $2', [p.userId, key])).rows[0] as { route: string; payload_hash: string; response_status: number; response_body: unknown } | undefined);
      if (prev) { if (prev.payload_hash !== hash) throw new HttpError(409, 'idempotency_conflict', 'Bu işlem anahtarı farklı bir istekle kullanılmış'); reply.header('idempotent-replay', 'true'); return reply.status(prev.response_status).send(prev.response_body); } }
    const now = Date.now();
    if (op === 'snooze' || op === 'dismiss') { if (!b.reason || !b.until) throw new HttpError(422, 'reason_until_required', 'Gerekçe ve tarih zorunludur'); const u = new Date(b.until).getTime(); const max = op === 'dismiss' ? 30 : 90; if (!(u > now) || u - now > max * 86400000) throw new HttpError(422, 'invalid_until', op === 'dismiss' ? 'Reddetme süresi en çok 30 gün olabilir' : 'Erteleme tarihi gelecekte ve en çok 90 gün içinde olmalıdır'); }
    try {
      return await withContext({ realm: 'platform', userId: p.userId, tenantId: item.tenant_id, platformWrite: true }, async tx => {
        const cur = (await tx.query('SELECT state, claimed_by, version FROM platform_work_item WHERE id = $1 FOR UPDATE', [id])).rows[0] as { state: string; claimed_by: string | null; version: number };
        if (cur.version !== b.expectedVersion) { if (op === 'claim' && cur.state === 'claimed') throw new HttpError(409, 'work_item_taken', 'Bu işi az önce başka biri üstlendi', { currentVersion: cur.version }); throw new HttpError(409, 'version_conflict', 'İş siz görüntüledikten sonra değişti; güncel hali yüklendi', { currentVersion: cur.version }); }
        const allowed: Record<string, string[]> = { claim: ['open'], release: ['claimed'], snooze: ['open', 'claimed'], dismiss: ['open', 'claimed', 'snoozed'] };
        if (!allowed[op]!.includes(cur.state)) throw new HttpError(409, op === 'claim' && cur.state === 'claimed' ? 'work_item_taken' : 'invalid_state', op === 'claim' && cur.state === 'claimed' ? 'Bu işi az önce başka biri üstlendi' : 'İşin güncel durumu bu işleme izin vermiyor', { currentVersion: cur.version });
        if (op === 'release' && cur.claimed_by !== p.userId && cx.role !== 'admin') throw new HttpError(403, 'platform_capability', 'Yalnız üstlenen kişi ya da Sistem Yöneticisi bırakabilir');
        const [set, params] = op === 'claim' ? [`state = 'claimed', claimed_by = $2, claimed_at = now()`, [id, p.userId]] : op === 'release' ? [`state = 'open', claimed_by = NULL, claimed_at = NULL`, [id]] : op === 'snooze' ? [`state = 'snoozed', snoozed_until = $2, state_reason = $3`, [id, b.until, b.reason]] : [`state = 'dismissed', dismissed_until = $2, state_reason = $3`, [id, b.until, b.reason]];
        const r = (await tx.query(`UPDATE platform_work_item SET ${set}, version = version + 1 WHERE id = $1 RETURNING id, state, version, claimed_by, snoozed_until, dismissed_until`, params as unknown[])).rows[0];
        await paudit(tx, p.userId, 'work_item.' + op, item.tenant_id, 'work_item', id, { state: cur.state, claimedBy: cur.claimed_by }, { state: r.state, until: b.until ?? null }, b.reason ?? null);
        const body = { workItem: r };
        if (key) await tx.query('INSERT INTO platform_command (user_id, key, route, payload_hash, tenant_id, response_status, response_body) VALUES ($1,$2,$3,$4,$5,200,$6)', [p.userId, key, route, hash, item.tenant_id, JSON.stringify(body)]);
        return body;
      });
    } catch (e) { // aynı anahtarla eşzamanlı ikinci istek: birincinin sonucu döner
      if ((e as { code?: string }).code === '23505' && key) { const prev = await withContext({ realm: 'platform', userId: p.userId }, async tx => (await tx.query('SELECT payload_hash, response_status, response_body FROM platform_command WHERE user_id = $1 AND key = $2', [p.userId, key])).rows[0]); if (prev && prev.payload_hash === hash) { reply.header('idempotent-replay', 'true'); return reply.status(prev.response_status).send(prev.response_body); } throw new HttpError(409, 'idempotency_conflict', 'Bu işlem anahtarı farklı bir istekle kullanılmış'); }
      throw e; }
  });
  /** v2.9.0 MFA (K9): kurulum, giriş ikinci adımı, kurtarma kodu, yeniden doğrulama, yönetici sıfırlaması */
  const mfaRow = (uid: string) => withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM platform_mfa_get($1)', [uid])).rows[0] as { secret_enc: string | null; pending_enc: string | null; enabled_at: string | null; last_step: string; recovery_left: number } | undefined);
  app.get('/api/platform/mfa', async req => { const p = requirePlatform(req); const r = await mfaRow(p.userId); return { enabled: !!r?.enabled_at, pending: !!r?.pending_enc && !r?.enabled_at, verified: !!p.mfaEnabled && !!p.mfaAt, recoveryCodesLeft: r?.enabled_at ? r.recovery_left : null }; });
  app.post('/api/platform/mfa/setup', async req => {
    const p = requirePlatform(req); const secret = newSecret();
    try { await withContext({ realm: 'anon' }, tx => tx.query('SELECT platform_mfa_set_pending($1,$2)', [p.userId, seal(secret)])); } catch (e) { if (String((e as Error).message).includes('mfa_already_enabled')) throw new HttpError(409, 'mfa_already_enabled', 'Doğrulama uygulaması zaten kurulu'); throw e; }
    const label = encodeURIComponent(`HPW Act:${p.email}`); return { secret, otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('HPW Act')}&algorithm=SHA1&digits=6&period=30` };
  });
  const verifyCode = async (req: Parameters<typeof requireAuth>[0], code: string) => {
    const p = requirePlatform(req); await rateLimit('mfa', p.userId, req.ip); const r = await mfaRow(p.userId); const th = tokenHash(p.sessionToken);
    if (r?.pending_enc && !r.enabled_at) { const step = verifyTotp(b32decode(unseal(r.pending_enc)), code); if (step === null) throw new HttpError(422, 'mfa_invalid', 'Kod geçersiz ya da süresi geçmiş; uygulamadaki güncel kodu girin'); const codes = newRecoveryCodes(); await withContext({ realm: 'anon' }, tx => tx.query('SELECT platform_mfa_enable($1,$2,$3,$4)', [p.userId, th, step, codes.map(recoveryHash)])); await withContext({ realm: 'platform', userId: p.userId }, tx => paudit(tx, p.userId, 'mfa.enable', null, 'user', p.userId, null, null)); await rateReset('mfa', p.userId, req.ip); return { verified: true, recoveryCodes: codes }; }
    if (!r?.enabled_at || !r.secret_enc) throw new HttpError(409, 'mfa_not_setup', 'Önce doğrulama uygulamasını kurun');
    const step = verifyTotp(b32decode(unseal(r.secret_enc)), code); const ok = step !== null && (await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT platform_mfa_accept($1,$2,$3) AS ok', [p.userId, th, step])).rows[0].ok as boolean));
    if (!ok) throw new HttpError(422, 'mfa_invalid', 'Kod geçersiz ya da süresi geçmiş; uygulamadaki güncel kodu girin'); await rateReset('mfa', p.userId, req.ip);
    if (needsReseal(r.secret_enc)) { const old = r.secret_enc; const secretPlain = unseal(old); await withContext({ realm: 'anon' }, tx => tx.query('SELECT platform_mfa_reseal($1,$2,$3)', [p.userId, old, seal(secretPlain)])); } // V290-05: anahtar değişimi/v1 → güncel anahtar
    return { verified: true };
  };
  const codeBody = { type: 'object', required: ['code'], properties: { code: { type: 'string', pattern: '^[0-9]{6}$' } }, additionalProperties: false };
  app.post('/api/platform/mfa/verify', { schema: { body: codeBody } }, async req => verifyCode(req, (req.body as { code: string }).code));
  app.post('/api/auth/reauth', { schema: { body: codeBody } }, async req => verifyCode(req, (req.body as { code: string }).code));
  app.post('/api/platform/mfa/recovery', { schema: { body: { type: 'object', required: ['code'], properties: { code: { type: 'string', minLength: 10, maxLength: 12 } }, additionalProperties: false } } }, async req => {
    const p = requirePlatform(req); await rateLimit('mfa', p.userId, req.ip); const ok = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT platform_mfa_use_recovery($1,$2,$3) AS ok', [p.userId, tokenHash(p.sessionToken), recoveryHash((req.body as { code: string }).code)])).rows[0].ok as boolean);
    if (!ok) throw new HttpError(422, 'mfa_invalid', 'Kurtarma kodu geçersiz ya da kullanılmış'); await withContext({ realm: 'platform', userId: p.userId }, tx => paudit(tx, p.userId, 'mfa.recovery_used', null, 'user', p.userId, null, null)); await rateReset('mfa', p.userId, req.ip); return { verified: true };
  });
  app.post('/api/platform/staff/:uid/mfa-reset', { schema: { body: { type: 'object', required: ['reason'], properties: { reason: { type: 'string', minLength: 3, maxLength: 500 } }, additionalProperties: false } } }, async req => {
    const p = requirePlatformAdmin(req); requireRecentMfa(p); const uid = (req.params as { uid: string }).uid; const b = req.body as { reason: string };
    return withContext({ realm: 'platform', userId: p.userId, platformWrite: true }, async tx => { try { await tx.query('SELECT platform_mfa_reset($1,$2)', [p.userId, uid]); } catch (e) { if (String((e as Error).message).includes('mfa_self_reset')) throw new HttpError(409, 'mfa_self_reset', 'Kendi doğrulamanızı sıfırlayamazsınız; başka bir Sistem Yöneticisine başvurun'); dbErr(e); } await paudit(tx, p.userId, 'mfa.reset', null, 'user', uid, null, null, b.reason); return { userId: uid, reset: true }; });
  });
  /** oturumdaki HPW personeli: rol ve yetenekler */
  app.get('/api/platform/me', async req => { const p = requirePlatform(req); return { userId: p.userId, email: p.email, displayName: p.displayName, role: p.platformRole ?? null, capabilities: PLATFORM_CAN[p.platformRole as PlatformRole] ?? [], canManage: p.platformRole === 'admin', mfa: { enabled: !!p.mfaEnabled, verified: !!p.mfaEnabled && !!p.mfaAt } }; });
  app.get('/api/platform/staff', async req => { const p = requirePlatformAdmin(req); return withContext({ realm: 'platform', userId: p.userId }, async tx => (await tx.query('SELECT * FROM platform_staff_list()')).rows); });
  app.patch('/api/platform/staff/:uid', { schema: { body: { type: 'object', required: ['role', 'reason'], properties: { role: { type: 'string', enum: ['admin', 'consultant', 'methodologist', 'auditor'] }, reason: { type: 'string', minLength: 3, maxLength: 500 } }, additionalProperties: false } } }, async req => {
    const p = requirePlatformAdmin(req); requireRecentMfa(p); const uid = (req.params as { uid: string }).uid; const b = req.body as { role: PlatformRole; reason: string };
    return withContext({ realm: 'platform', userId: p.userId, platformWrite: true }, async tx => { let prev: string | null = null; try { prev = (await tx.query('SELECT platform_role_set($1,$2,$3,$4) AS prev', [p.userId, uid, b.role, b.reason])).rows[0].prev; } catch (e) { dbErr(e); } await paudit(tx, p.userId, 'staff.role_change', null, 'user', uid, { role: prev }, { role: b.role }, b.reason); return { userId: uid, role: b.role, previousRole: prev }; });
  });
  app.post('/api/platform/staff/:uid/revoke', { schema: { body: { type: 'object', required: ['reason'], properties: { reason: { type: 'string', minLength: 3, maxLength: 500 } }, additionalProperties: false } } }, async req => {
    const p = requirePlatformAdmin(req); requireRecentMfa(p); const uid = (req.params as { uid: string }).uid; const b = req.body as { reason: string };
    if (uid === p.userId) throw new HttpError(409, 'self_revoke', 'Kendi erişiminizi kaldıramazsınız');
    return withContext({ realm: 'platform', userId: p.userId, platformWrite: true }, async tx => { let prev: string | null = null; try { prev = (await tx.query('SELECT platform_role_revoke($1,$2,$3) AS prev', [p.userId, uid, b.reason])).rows[0].prev; } catch (e) { dbErr(e); } await paudit(tx, p.userId, 'staff.revoke', null, 'user', uid, { role: prev }, { revoked: true }, b.reason); return { userId: uid, revoked: true, previousRole: prev }; });
  });
  /** şirket atamaları (görev + gerekçe + isteğe bağlı bitiş) */
  app.get('/api/platform/tenants/:tid/assignments', async req => { const p = requirePlatform(req); const tid = (req.params as { tid: string }).tid; if (!/^[0-9a-f-]{36}$/i.test(tid)) throw new HttpError(422, 'invalid_tenant'); return withContext({ realm: 'platform', userId: p.userId }, async tx => (await tx.query('SELECT * FROM platform_assignments($1)', [tid])).rows); });
  app.post('/api/platform/tenants/:tid/assignments', { schema: { body: { type: 'object', required: ['userId', 'duty', 'reason'], properties: { userId: { type: 'string', format: 'uuid' }, duty: { type: 'string', enum: ['admin_scope', 'primary', 'backup', 'methodologist', 'auditor'] }, reason: { type: 'string', minLength: 3, maxLength: 500 }, validTo: { type: 'string', format: 'date' }, handoverFrom: { type: 'string', format: 'uuid' } }, additionalProperties: false } } }, async req => {
    const p = requirePlatformAdmin(req); requireRecentMfa(p); const tid = (req.params as { tid: string }).tid; const b = req.body as { userId: string; duty: string; reason: string; validTo?: string; handoverFrom?: string };
    if (!/^[0-9a-f-]{36}$/i.test(tid)) throw new HttpError(422, 'invalid_tenant');
    return withContext({ realm: 'platform', userId: p.userId, tenantId: tid, platformWrite: true, allowInactive: true }, async tx => {
      let prev: string | null = null;
      try {
        // devir: önceki ana/yedek danışman aynı işlemde yedeğe alınır ya da görevden çıkarılır (tek sorumlu boşluğu oluşmaz)
        prev = b.handoverFrom && b.handoverFrom !== b.userId ? (await tx.query('SELECT platform_handover($1,$2,$3,$4,$5,$6,$7) AS prev', [p.userId, b.handoverFrom, b.userId, tid, b.duty, b.reason, b.validTo ?? null])).rows[0].prev : (await tx.query('SELECT platform_assign($1,$2,$3,$4,$5,$6) AS prev', [p.userId, b.userId, tid, b.duty, b.reason, b.validTo ?? null])).rows[0].prev;
      } catch (e) { dbErr(e); }
      await paudit(tx, p.userId, b.handoverFrom ? 'assignment.handover' : 'assignment.grant', tid, 'user', b.userId, { duty: prev, from: b.handoverFrom ?? null }, { duty: b.duty, validTo: b.validTo ?? null }, b.reason);
      return { tenantId: tid, userId: b.userId, duty: b.duty, previousDuty: prev };
    });
  });
  app.post('/api/platform/tenants/:tid/assignments/:uid/end', { schema: { body: { type: 'object', required: ['reason'], properties: { reason: { type: 'string', minLength: 3, maxLength: 500 } }, additionalProperties: false } } }, async req => {
    const p = requirePlatformAdmin(req); requireRecentMfa(p); const { tid, uid } = req.params as { tid: string; uid: string }; const b = req.body as { reason: string };
    // V290-04: hedef şirkete etkin erişim sunucu girişinde de zorunlu (fonksiyon da aynı politikayı uygular); yetkisiz aktöre kaydın varlığı sızmaz
    if (!/^[0-9a-f-]{36}$/i.test(tid) || !/^[0-9a-f-]{36}$/i.test(uid)) throw new HttpError(403, 'tenant_not_authorized', 'Bu şirkette yetkiniz yok');
    const acc = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT auth_platform_has_tenant($1,$2) AS ok', [p.userId, tid])).rows[0].ok as boolean); if (!acc) throw new HttpError(403, 'tenant_not_authorized', 'Bu şirkette yetkiniz yok');
    return withContext({ realm: 'platform', userId: p.userId, tenantId: tid, platformWrite: true, allowInactive: true }, async tx => { let prev: string | null = null; try { prev = (await tx.query('SELECT platform_unassign($1,$2,$3,$4) AS prev', [p.userId, uid, tid, b.reason])).rows[0].prev; } catch (e) { dbErr(e); } await paudit(tx, p.userId, 'assignment.end', tid, 'user', uid, { duty: prev }, null, b.reason); return { tenantId: tid, userId: uid, ended: true, previousDuty: prev }; });
  });
  /** müdahale modu (K7): yalnız Sistem Yöneticisi, gerekçe ≥ 20 karakter, 15/30/60 dakika, aktif şirkette */
  app.post('/api/platform/tenants/:tid/intervention', { schema: { body: { type: 'object', required: ['reason', 'minutes'], properties: { reason: { type: 'string', minLength: 20, maxLength: 1000 }, minutes: { type: 'integer', enum: [15, 30, 60] } }, additionalProperties: false } } }, async req => {
    const p = requirePlatformAdmin(req); requireRecentMfa(p); const tid = (req.params as { tid: string }).tid; const b = req.body as { reason: string; minutes: number };
    const cx = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM platform_tenant_ctx($1,$2)', [p.userId, tid])).rows[0] as { has_access: boolean; tenant_status: string | null });
    if (!cx?.has_access) throw new HttpError(403, 'tenant_not_authorized', 'Bu şirkette yetkiniz yok'); if (cx.tenant_status !== 'active') throw new HttpError(403, 'platform_capability', 'Şirket durdurulmuş ya da arşivlenmiş; HPW yalnız okuyabilir');
    return withContext({ realm: 'platform', userId: p.userId, tenantId: tid, platformWrite: true }, async tx => {
      await tx.query('UPDATE platform_intervention SET ended_at = now(), ended_by = $2 WHERE tenant_id = $1 AND ended_at IS NULL AND ends_at <= now()', [tid, p.userId]);
      let row: { id: string; ends_at: string };
      try { row = (await tx.query(`INSERT INTO platform_intervention (tenant_id, actor_id, reason, ends_at) VALUES ($1,$2,$3, now() + make_interval(mins => $4)) RETURNING id, ends_at`, [tid, p.userId, b.reason, b.minutes])).rows[0]; } catch (e) { dbErr(e); throw e; }
      await paudit(tx, p.userId, 'intervention.start', tid, 'intervention', row.id, null, { minutes: b.minutes, endsAt: row.ends_at }, b.reason, row.id);
      await tx.query('INSERT INTO audit_event (tenant_id, entity_type, entity_id, action, new_value, actor_ref, reason) VALUES ($1,$2,$3,$4,$5,$6,$7)', [tid, 'platform_intervention', row.id, 'intervention_start', JSON.stringify({ minutes: b.minutes, endsAt: row.ends_at, actor: p.email }), p.userId, b.reason]);
      return { id: row.id, tenantId: tid, endsAt: row.ends_at };
    });
  });
  app.post('/api/platform/interventions/:iid/end', async req => {
    const p = requirePlatformAdmin(req); const iid = (req.params as { iid: string }).iid; if (!/^[0-9a-f-]{36}$/i.test(iid)) throw new HttpError(422, 'invalid_intervention');
    const tid = await withContext({ realm: 'platform', userId: p.userId }, async tx => (await tx.query('SELECT tenant_id FROM platform_intervention WHERE id = $1', [iid])).rows[0]?.tenant_id as string | undefined);
    if (!tid) throw new HttpError(404, 'intervention_not_found');
    return withContext({ realm: 'platform', userId: p.userId, tenantId: tid, platformWrite: true, allowInactive: true }, async tx => {
      const r = await tx.query('UPDATE platform_intervention SET ended_at = now(), ended_by = $2 WHERE id = $1 AND ended_at IS NULL RETURNING id', [iid, p.userId]);
      if (r.rowCount) { await paudit(tx, p.userId, 'intervention.end', tid, 'intervention', iid, null, { endedBy: p.userId }, null, iid); await tx.query('INSERT INTO audit_event (tenant_id, entity_type, entity_id, action, new_value, actor_ref) VALUES ($1,$2,$3,$4,$5,$6)', [tid, 'platform_intervention', iid, 'intervention_end', JSON.stringify({ actor: p.email }), p.userId]); }
      return { id: iid, ended: true };
    });
  });
  /** platform işlem geçmişi: görünürlük veritabanı politikasıyla (erişilen şirketler; genel olaylar yalnız yönetici) */
  app.get('/api/platform/audit-events', async req => {
    const p = requirePlatform(req); const q = req.query as { tenantId?: string; action?: string; actorId?: string; before?: string; limit?: string };
    const lim = Math.min(Math.max(Number(q.limit ?? 50) || 50, 1), 200);
    return withContext({ realm: 'platform', userId: p.userId }, async tx => {
      const rows = (await tx.query(`SELECT e.id, e.occurred_at, e.actor_id, u.email AS actor_email, e.action, e.tenant_id, t.code AS tenant_code, t.name AS tenant_name, e.target_type, e.target_id, e.before, e.after, e.reason, e.result, e.intervention_id
        FROM platform_audit_event e LEFT JOIN app_user u ON u.id = e.actor_id LEFT JOIN tenant t ON t.id = e.tenant_id
        WHERE ($1::uuid IS NULL OR e.tenant_id = $1) AND ($2::text IS NULL OR e.action LIKE $2 || '%') AND ($3::uuid IS NULL OR e.actor_id = $3) AND ($4::timestamptz IS NULL OR e.occurred_at < $4)
        ORDER BY e.occurred_at DESC LIMIT $5`, [q.tenantId && /^[0-9a-f-]{36}$/i.test(q.tenantId) ? q.tenantId : null, q.action || null, q.actorId && /^[0-9a-f-]{36}$/i.test(q.actorId) ? q.actorId : null, q.before || null, lim])).rows;
      return { items: rows, nextBefore: rows.length === lim ? rows[rows.length - 1].occurred_at : null };
    });
  });

}
