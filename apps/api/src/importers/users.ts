import type { Tx } from '../db.js';
import { buildWorkbook, isoDate } from '../xlsx.js';
import { Report, EMAIL_RE, CODE_RE, requireSheet } from '../validation.js';
import { checkTenantCode, TEMPLATE_VERSION, tenantInfo, type Importer, type ValidationResult } from './common.js';

const PROFILES = ['HR_ADMIN', 'HR_PARTNER', 'EXEC', 'REGION_MANAGER', 'UNIT_MANAGER', 'ACTION_OWNER', 'VIEWER'];
const RANK: Record<string, number> = { VIEWER: 0, ACTION_OWNER: 1, UNIT_MANAGER: 2, REGION_MANAGER: 3, HR_PARTNER: 4, EXEC: 4, HR_ADMIN: 5 };
type UserRow = { op: string; email: string; name: string; locale: string; timezone: string; login: string; invite: boolean; row: number };
type AssignRow = { op: string; email: string; role: string; kind: string; from: string; to: string | null; row: number };
type AccessRow = { op: string; email: string; scope: string; profile: string; includeDescendants: boolean; row: number };

/** Kullanıcılar (F07/F09): e-posta kullanıcı adıdır; dosyada parola yoktur; yetki profili Org_Rolleri üzerinden gelir; davet ayrı, kişi başına kayıtla gönderilir. */
export const usersImporter: Importer = {
  kind: 'users',
  unitsAffected(payload) { const p = payload as { assigns?: { role: string; roleUnit?: string }[]; access?: { scope: string }[]; roleUnits?: Record<string, string> }; const set = new Set<string>(); for (const a of p.access ?? []) set.add(a.scope); for (const a of p.assigns ?? []) set.add(p.roleUnits?.[a.role] ?? a.roleUnit ?? '*'); return [...set]; },
  grantsRequired(payload) { const p = payload as { profiles?: Record<string, string>; access?: { profile: string }[] }; return [...new Set([...Object.values(p.profiles ?? {}), ...(p.access ?? []).map(a => a.profile)].filter(x => x && x !== 'VIEWER'))]; },
  async template(tx, ctx) {
    const t = await tenantInfo(tx, ctx.tenantId);
    const roles = (await tx.query('SELECT code, title, permission_profile FROM org_role WHERE tenant_id = $1 AND code IS NOT NULL AND effective_to IS NULL ORDER BY code', [ctx.tenantId])).rows;
    const users = (await tx.query(`SELECT u.email, u.display_name, u.locale, u.timezone, m.permission_profile, m.status FROM membership m JOIN app_user u ON u.id = m.user_id WHERE m.tenant_id = $1 ORDER BY u.email`, [ctx.tenantId])).rows;
    return buildWorkbook({
      title: 'HPW Act | Kullanıcılar ve toplu davet şablonu', version: TEMPLATE_VERSION,
      guide: ['E-posta kullanıcı adıdır. Dosyada PAROLA ALANI YOKTUR; her kişi davet bağlantısıyla kendi parolasını belirler (tek kullanımlık, süreli).', 'Yetki profili, atanan rolün (Org_Rolleri) permission_profile değerinden gelir; bir kişinin birden çok rolü varsa en geniş profil geçerlidir. İK Yöneticisi platform rolü atayamaz.', 'Bu bir DEĞİŞİKLİK dosyasıdır: operation sütunu dolu satırlar işlenir (CREATE / UPDATE / DEACTIVATE). DEACTIVATE üyeliği iptal eder, oturumları kapatır, bekleyen davetleri iptal eder.', 'invite_requested=YES olan kişiler "Davetleri gönder" adımında kişisel davet alır; gönderim bu dosyayla değil ayrı bir onayla başlar.', 'Formül girmeyin; yalnız değer.'],
      sheets: [
        { name: 'Kullanicilar', columns: [{ key: 'tenant_code', header: 'tenant_code' }, { key: 'operation', header: 'operation', list: ['CREATE', 'UPDATE', 'DEACTIVATE'] }, { key: 'email', header: 'email', width: 34 }, { key: 'display_name', header: 'display_name', width: 30 }, { key: 'locale', header: 'locale', list: ['tr', 'en'] }, { key: 'timezone', header: 'timezone' }, { key: 'login_method', header: 'login_method', list: ['LOCAL_PASSWORD', 'SSO'] }, { key: 'invite_requested', header: 'invite_requested', list: ['YES', 'NO'] }], rows: users.map(u => ({ tenant_code: t.code, operation: '', email: u.email, display_name: u.display_name, locale: u.locale, timezone: u.timezone, login_method: 'LOCAL_PASSWORD', invite_requested: 'NO' })) },
        { name: 'Rol_Atamalari', columns: [{ key: 'tenant_code', header: 'tenant_code' }, { key: 'operation', header: 'operation', list: ['CREATE', 'CLOSE'] }, { key: 'email', header: 'email', width: 34 }, { key: 'role_code', header: 'role_code', list: roles.slice(0, 200).map(r => r.code) }, { key: 'assignment_kind', header: 'assignment_kind', list: ['PRIMARY', 'DELEGATE', 'ACTING'] }, { key: 'valid_from', header: 'valid_from' }, { key: 'valid_to', header: 'valid_to' }] },
        { name: 'Ek_Erisim', columns: [{ key: 'tenant_code', header: 'tenant_code' }, { key: 'operation', header: 'operation', list: ['CREATE', 'UPDATE', 'CLOSE'] }, { key: 'email', header: 'email', width: 34 }, { key: 'scope_code', header: 'scope_code' }, { key: 'access_profile', header: 'access_profile', list: ['VIEWER', 'HR_PARTNER'] }, { key: 'include_descendants', header: 'include_descendants', list: ['YES', 'NO'] }] },
        { name: 'Roller_Bilgi', columns: [{ key: 'role_code', header: 'role_code' }, { key: 'title', header: 'title', width: 30 }, { key: 'permission_profile', header: 'permission_profile' }], rows: roles.map(r => ({ role_code: r.code, title: r.title, permission_profile: r.permission_profile })) },
      ],
      dictionary: [
        { sheet: 'Kullanicilar', field: 'email', desc: 'Kullanıcı adı ve davet alıcısı; şirket içinde tekil.', req: 'Zorunlu', type: 'e-posta' },
        { sheet: 'Kullanicilar', field: 'invite_requested', desc: 'YES: davet kuyruğuna alınır; gönderim "Davetleri gönder" ile başlar.', req: 'Zorunlu', type: 'seçim', allowed: 'YES / NO' },
        { sheet: 'Rol_Atamalari', field: 'role_code', desc: 'Org_Rolleri sayfasındaki rol kodu (Roller_Bilgi sayfasına bakın).', req: 'Zorunlu', type: 'kod' },
        { sheet: 'Rol_Atamalari', field: 'assignment_kind', desc: 'PRIMARY asıl sahip; DELEGATE vekil; ACTING vekâleten. Aynı rolde aynı türden iki eşzamanlı atama olamaz.', req: 'Zorunlu', type: 'seçim', allowed: 'PRIMARY / DELEGATE / ACTING' },
        { sheet: 'Ek_Erisim', field: 'scope_code', desc: 'Rolsüz izleyici erişimi için birim kodu; profil VIEWER ya da HR_PARTNER.', req: 'İsteğe bağlı', type: 'kod' },
      ],
    });
  },
  async validate(sheets, tx, ctx): Promise<ValidationResult> {
    const rep = new Report();
    checkTenantCode(sheets, ctx, rep, ['Kullanicilar', 'Rol_Atamalari', 'Ek_Erisim']);
    const dbMembers = new Map<string, { profile: string; status: string }>((await tx.query('SELECT u.email_norm, m.permission_profile, m.status FROM membership m JOIN app_user u ON u.id = m.user_id WHERE m.tenant_id = $1', [ctx.tenantId])).rows.map((r: { email_norm: string; permission_profile: string; status: string }) => [r.email_norm, { profile: r.permission_profile, status: r.status }]));
    const dbRoles = new Map<string, string>((await tx.query('SELECT code, permission_profile FROM org_role WHERE tenant_id = $1 AND code IS NOT NULL AND effective_to IS NULL', [ctx.tenantId])).rows.map((r: { code: string; permission_profile: string }) => [r.code, r.permission_profile]));
    const dbUnits = new Set<string>((await tx.query('SELECT external_id FROM org_unit WHERE tenant_id = $1 AND external_id IS NOT NULL', [ctx.tenantId])).rows.map((r: { external_id: string }) => r.external_id));
    const users: UserRow[] = []; const assigns: AssignRow[] = []; const access: AccessRow[] = []; const fileEmails = new Map<string, UserRow>();
    if (requireSheet(sheets, 'Kullanicilar', ['operation', 'email', 'display_name'], rep)) for (const r of sheets['Kullanicilar']!.rows) {
      const c = r.cells; const op = (c['operation'] ?? '').toLocaleUpperCase('en-US'); if (!op) continue;
      if (!['CREATE', 'UPDATE', 'DEACTIVATE'].includes(op)) { rep.error('Kullanicilar', r.n, 'operation', 'invalid_operation', 'CREATE/UPDATE/DEACTIVATE', op); continue; }
      const email = (c['email'] ?? '').trim().toLocaleLowerCase('en-US');
      if (!EMAIL_RE.test(email)) { rep.error('Kullanicilar', r.n, 'email', 'invalid_email', 'Geçersiz e-posta', c['email']); continue; }
      if (fileEmails.has(email)) { rep.error('Kullanicilar', r.n, 'email', 'duplicate_in_file', 'Aynı e-posta dosyada iki kez', email); continue; }
      if ('password' in c || 'parola' in c) rep.error('Kullanicilar', r.n, 'password', 'password_column_forbidden', 'Dosyada parola sütunu olamaz');
      const exists = dbMembers.has(email);
      if (op === 'CREATE' && exists) rep.error('Kullanicilar', r.n, 'email', 'member_exists', 'Bu e-posta şirkette zaten üye; UPDATE kullanın', email);
      if (op !== 'CREATE' && !exists) rep.error('Kullanicilar', r.n, 'email', 'member_not_found', 'Güncellenecek üye yok', email);
      if (op !== 'DEACTIVATE' && !c['display_name']) rep.error('Kullanicilar', r.n, 'display_name', 'required', 'display_name zorunlu');
      const login = (c['login_method'] || 'LOCAL_PASSWORD').toLocaleUpperCase('en-US'); if (!['LOCAL_PASSWORD', 'SSO'].includes(login)) rep.error('Kullanicilar', r.n, 'login_method', 'invalid_login', 'LOCAL_PASSWORD ya da SSO', login);
      if (login === 'SSO') rep.warn('Kullanicilar', r.n, 'login_method', 'sso_not_configured', 'SSO bu şirket için yapılandırılmadı; kişi davetle parola belirleyecek');
      const u: UserRow = { op, email, name: c['display_name'] ?? '', locale: (c['locale'] || 'tr').toLocaleLowerCase('en-US'), timezone: c['timezone'] || 'Europe/Istanbul', login, invite: (c['invite_requested'] ?? 'YES').toLocaleUpperCase('en-US') !== 'NO', row: r.n };
      fileEmails.set(email, u); users.push(u);
    }
    const profileOf = new Map<string, string>();
    if (sheets['Rol_Atamalari'] && requireSheet(sheets, 'Rol_Atamalari', ['operation', 'email', 'role_code', 'assignment_kind'], rep)) for (const r of sheets['Rol_Atamalari'].rows) {
      const c = r.cells; const op = (c['operation'] ?? '').toLocaleUpperCase('en-US'); if (!op) continue;
      if (!['CREATE', 'CLOSE'].includes(op)) { rep.error('Rol_Atamalari', r.n, 'operation', 'invalid_operation', 'CREATE ya da CLOSE', op); continue; }
      const email = (c['email'] ?? '').trim().toLocaleLowerCase('en-US'); const role = c['role_code'] ?? ''; const kind = (c['assignment_kind'] || 'PRIMARY').toLocaleUpperCase('en-US');
      if (!fileEmails.has(email) && !dbMembers.has(email)) rep.error('Rol_Atamalari', r.n, 'email', 'user_unknown', 'Kişi ne dosyada ne şirkette var', email);
      if (!dbRoles.has(role)) rep.error('Rol_Atamalari', r.n, 'role_code', 'role_not_found', 'Rol kodu yok (Roller_Bilgi)', role);
      if (!['PRIMARY', 'DELEGATE', 'ACTING'].includes(kind)) rep.error('Rol_Atamalari', r.n, 'assignment_kind', 'invalid_kind', 'PRIMARY/DELEGATE/ACTING', kind);
      const from = isoDate(c['valid_from'] ?? '') ?? new Date().toISOString().slice(0, 10); const to = isoDate(c['valid_to'] ?? '');
      if (from === 'INVALID') rep.error('Rol_Atamalari', r.n, 'valid_from', 'invalid_date', 'Tarih geçersiz', c['valid_from']);
      if (assigns.some(a => a.op === 'CREATE' && op === 'CREATE' && a.role === role && a.kind === kind && a.kind === 'PRIMARY' && a.email !== email)) rep.error('Rol_Atamalari', r.n, 'role_code', 'primary_conflict', 'Aynı rol için dosyada iki asıl sahip', role);
      assigns.push({ op, email, role, kind, from: from === 'INVALID' ? new Date().toISOString().slice(0, 10) : from, to: to && to !== 'INVALID' ? to : null, row: r.n });
      if (op === 'CREATE') { const p = dbRoles.get(role); if (p) { const cur = profileOf.get(email); if (!cur || RANK[p]! > RANK[cur]!) profileOf.set(email, p); } }
    }
    if (sheets['Ek_Erisim'] && requireSheet(sheets, 'Ek_Erisim', ['email', 'scope_code', 'access_profile'], rep)) for (const r of sheets['Ek_Erisim'].rows) {
      const c = r.cells; const email = (c['email'] ?? '').trim().toLocaleLowerCase('en-US'); if (!email) continue;
      if (!fileEmails.has(email) && !dbMembers.has(email)) rep.error('Ek_Erisim', r.n, 'email', 'user_unknown', 'Kişi yok', email);
      if (!dbUnits.has(c['scope_code'] ?? '')) rep.error('Ek_Erisim', r.n, 'scope_code', 'unit_not_found', 'Birim yok', c['scope_code']);
      const prof = (c['access_profile'] || 'VIEWER').toLocaleUpperCase('en-US'); if (!['VIEWER', 'HR_PARTNER'].includes(prof)) rep.error('Ek_Erisim', r.n, 'access_profile', 'invalid_profile', 'VIEWER ya da HR_PARTNER', prof);
      const aop = (c['operation'] || 'CREATE').toLocaleUpperCase('en-US'); if (!['CREATE', 'UPDATE', 'CLOSE'].includes(aop)) rep.error('Ek_Erisim', r.n, 'operation', 'invalid_operation', 'CREATE/UPDATE/CLOSE', aop);
      access.push({ op: aop, email, scope: c['scope_code'] ?? '', profile: prof, includeDescendants: (c['include_descendants'] ?? 'YES').toLocaleUpperCase('en-US') !== 'NO', row: r.n }); if (!profileOf.has(email) || prof === 'HR_PARTNER') profileOf.set(email, prof);
    }
    for (const u of users) if (u.op === 'CREATE' && !profileOf.has(u.email)) { profileOf.set(u.email, 'VIEWER'); rep.warn('Kullanicilar', u.row, 'email', 'no_role', 'Rol ataması yok; kişi hiçbir birimi göremez (kapsam sıfır) — rol ya da Ek_Erisim verin', u.email); }
    // yetki tırmanması (R04): dosyadaki rol/erişim profilleri, işlemi yapanın verebileceği profillerle sınırlı
    const grantable = ctx.grantable ?? []; for (const [email, prof] of profileOf) if (prof !== 'VIEWER' && !grantable.includes(prof)) rep.error('Rol_Atamalari', null, 'role_code', 'grant_not_allowed', `${prof} profilini verme yetkiniz yok (${email})`, prof);
    const rowCount = users.length + assigns.length + access.length;
    if (rowCount === 0) rep.error('Kullanicilar', null, null, 'empty', 'Dosyada işlenecek satır yok');
    const preview = { users: { create: users.filter(u => u.op === 'CREATE').length, update: users.filter(u => u.op === 'UPDATE').length, deactivate: users.filter(u => u.op === 'DEACTIVATE').length }, invitations: users.filter(u => u.op === 'CREATE' && u.invite).length, assignments: assigns.length, profiles: Object.fromEntries([...profileOf].map(([e, p]) => [e, p])) };
    return { report: rep, payload: { users, assigns, access, profiles: Object.fromEntries(profileOf), roleUnits: Object.fromEntries((await tx.query('SELECT r.code, u.external_id FROM org_role r JOIN org_unit u ON u.tenant_id = r.tenant_id AND u.id = r.unit_id WHERE r.tenant_id = $1', [ctx.tenantId])).rows.map(r => [r.code, r.external_id])) }, preview, rowCount, templateVersion: TEMPLATE_VERSION };
  },
  async commit(payload, tx, ctx) {
    const p = payload as { users: UserRow[]; assigns: AssignRow[]; access: AccessRow[]; profiles: Record<string, string> };
    let created = 0, updated = 0, deactivated = 0, invites = 0;
    for (const u of p.users) {
      if (u.op === 'DEACTIVATE') {
        const m = (await tx.query('SELECT m.id, m.user_id, m.person_id FROM membership m JOIN app_user a ON a.id = m.user_id WHERE m.tenant_id = $1 AND a.email_norm = $2', [ctx.tenantId, u.email])).rows[0];
        if (!m) continue;
        await tx.query('UPDATE membership SET status = $3, revoked_at = now() WHERE tenant_id = $1 AND id = $2', [ctx.tenantId, m.id, 'revoked']);
        await tx.query('UPDATE invitation SET status = $3 WHERE tenant_id = $1 AND user_id = $2 AND status IN ($4, $5, $6)', [ctx.tenantId, m.user_id, 'revoked', 'draft', 'ready', 'pending']);
        await tx.query('UPDATE accountability_assignment SET effective_to = now() WHERE tenant_id = $1 AND person_id = $2 AND effective_to IS NULL', [ctx.tenantId, m.person_id]);
        await tx.query('SELECT auth_sessions_revoke_user($1, $2)', [m.user_id, ctx.tenantId]); // yetki iptali: oturumlar hemen kapanır; başka şirketteki üyelik etkilenmez
        deactivated++; continue;
      }
      const userId = (await tx.query('SELECT upsert_user($1,$2,$3,$4) AS id', [u.email, u.name, u.locale, u.timezone])).rows[0].id as string;
      const profile = p.profiles[u.email] ?? 'VIEWER';
      const scope = p.access.find(a => a.email === u.email);
      const scopeId = scope ? (await tx.query('SELECT id FROM org_unit WHERE tenant_id = $1 AND external_id = $2', [ctx.tenantId, scope.scope])).rows[0]?.id : null;
      if (u.op === 'CREATE') {
        const person = (await tx.query('INSERT INTO person (tenant_id, organization_id, display_name, email, language, timezone, user_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [ctx.tenantId, ctx.organizationId, u.name, u.email, u.locale, u.timezone, userId])).rows[0].id;
        const mem = (await tx.query('INSERT INTO membership (tenant_id, user_id, permission_profile, scope_unit_id, person_id, explicit_profile) VALUES ($1,$2,$3,$4,$5,false) RETURNING id', [ctx.tenantId, userId, profile, scopeId, person])).rows[0].id; // profil önbellek; etkin yetki rollerden çözülür (R05)
        if (u.invite) { await tx.query('INSERT INTO invitation (tenant_id, user_id, membership_id, status, created_by) VALUES ($1,$2,$3,$4,$5)', [ctx.tenantId, userId, mem, 'ready', ctx.userId]); invites++; }
        created++;
      } else {
        await tx.query('UPDATE app_user SET display_name = $2, locale = $3, timezone = $4, updated_at = now() WHERE id = $1', [userId, u.name, u.locale, u.timezone]);
        await tx.query('UPDATE membership SET permission_profile = $3, scope_unit_id = COALESCE($4, scope_unit_id) WHERE tenant_id = $1 AND user_id = $2 AND explicit_profile = false', [ctx.tenantId, userId, profile, scopeId]);
        updated++;
      }
    }
    for (const a of p.assigns) {
      const m = (await tx.query('SELECT m.person_id FROM membership m JOIN app_user u ON u.id = m.user_id WHERE m.tenant_id = $1 AND u.email_norm = $2', [ctx.tenantId, a.email])).rows[0]; if (!m) continue;
      const role = (await tx.query('SELECT id FROM org_role WHERE tenant_id = $1 AND code = $2', [ctx.tenantId, a.role])).rows[0]; if (!role) continue;
      if (a.op === 'CREATE') await tx.query('INSERT INTO accountability_assignment (tenant_id, org_role_id, person_id, kind, effective_from, effective_to) VALUES ($1,$2,$3,$4,$5,$6)', [ctx.tenantId, role.id, m.person_id, a.kind.toLocaleLowerCase('en-US'), a.from, a.to]);
      else await tx.query('UPDATE accountability_assignment SET effective_to = now() WHERE tenant_id = $1 AND org_role_id = $2 AND person_id = $3 AND (effective_to IS NULL OR effective_to > now())', [ctx.tenantId, role.id, m.person_id]);
    }
    // Ek_Erisim bağımsız işlem (N09): CREATE/UPDATE gerçek upsert (daraltma dahil), CLOSE bugün kapatır; üyelik kullanıcı satırından bağımsız çözülür
    let scopesWritten = 0;
    for (const a of p.access) {
      const mem = (await tx.query('SELECT m.id FROM membership m JOIN app_user u ON u.id = m.user_id WHERE m.tenant_id = $1 AND u.email_norm = $2', [ctx.tenantId, a.email])).rows[0]?.id; const su = (await tx.query('SELECT id FROM org_unit WHERE tenant_id = $1 AND external_id = $2', [ctx.tenantId, a.scope])).rows[0]?.id; if (!mem || !su) continue;
      if (a.op === 'CLOSE') { const r = await tx.query('UPDATE membership_scope SET effective_to = CURRENT_DATE WHERE tenant_id = $1 AND membership_id = $2 AND unit_id = $3 AND access_profile = $4 AND (effective_to IS NULL OR effective_to > CURRENT_DATE)', [ctx.tenantId, mem, su, a.profile]); scopesWritten += r.rowCount ?? 0; }
      else { const r = await tx.query('INSERT INTO membership_scope (tenant_id, membership_id, unit_id, access_profile, include_descendants, effective_from, effective_to) VALUES ($1,$2,$3,$4,$5,CURRENT_DATE,NULL) ON CONFLICT (tenant_id, membership_id, unit_id, access_profile) DO UPDATE SET include_descendants = EXCLUDED.include_descendants, effective_to = NULL', [ctx.tenantId, mem, su, a.profile, a.includeDescendants]); scopesWritten += r.rowCount ?? 0; }
    }
    return { applied: { created, updated, deactivated, invitationsReady: invites, assignments: p.assigns.length, scopes: scopesWritten } };
  },
};
