import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { withContext, HttpError, type DbContext, type Tx } from './db.js';
import { config } from './config.js';

export function hashPassword(pw: string): string { const salt = randomBytes(16).toString('hex'); const h = scryptSync(pw, salt, 64).toString('hex'); return `scrypt$${salt}$${h}`; }
export function verifyPassword(pw: string, stored: string | null): boolean { if (!stored) return false; const [, salt, h] = stored.split('$'); if (!salt || !h) return false; const c = scryptSync(pw, salt, 64); const s = Buffer.from(h, 'hex'); return c.length === s.length && timingSafeEqual(c, s); }
export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (t: string) => createHash('sha256').update(t).digest('hex');
export function validatePassword(pw: string): string | null { if (typeof pw !== 'string' || pw.length < 10) return 'Parola en az 10 karakter olmalı'; if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Parola harf ve rakam içermeli'; return null; }

export type Profile = 'HR_ADMIN' | 'HR_PARTNER' | 'EXEC' | 'REGION_MANAGER' | 'UNIT_MANAGER' | 'ACTION_OWNER' | 'VIEWER';
export const PROFILES: Profile[] = ['HR_ADMIN', 'HR_PARTNER', 'EXEC', 'REGION_MANAGER', 'UNIT_MANAGER', 'ACTION_OWNER', 'VIEWER'];
const RANK: Record<Profile, number> = { VIEWER: 0, ACTION_OWNER: 1, UNIT_MANAGER: 2, REGION_MANAGER: 3, HR_PARTNER: 4, EXEC: 4, HR_ADMIN: 5 };
export interface Principal { intervention?: import('./db.js').InterventionTrace | null; mfaEnabled?: boolean; mfaAt?: string | null; platformRole?: 'admin' | 'consultant' | 'methodologist' | 'auditor' | null; platformWrite?: boolean; interventionId?: string | null; commandKey?: string; sessionToken: string; userId: string; email: string; displayName: string; realm: 'customer' | 'platform'; tenantId: string | null; profile?: Profile; companyWide?: boolean; membershipId?: string | null; personId?: string | null; roleUnitIds?: string[]; grants?: { unitId: string; profile: Profile; includeDescendants: boolean }[]; scopes?: { unitId: string; profile: Profile; includeDescendants: boolean }[]; }
declare module 'fastify' { interface FastifyRequest { principal?: Principal; idempotencyKey?: string; idempotencyReserved?: boolean; idempotencyOwner?: string; idempotencyResource?: { scope: 'unit' | 'tenant' | 'units' | 'tenant_wide'; unitId?: string | null; unitIds?: string[]; profiles: Profile[] } } }

/** Etkin yetki (R05): açık profil (platformca verilen HR_ADMIN) ya da bugün geçerli rol atamalarının en genişi; rol yoksa yalnız ek erişim kapsamları. Her istekte yeniden çözülür. */
export async function resolveMembership(tx: Tx, tenantId: string, userId: string): Promise<{ membershipId: string; personId: string | null; profile: Profile; companyWide: boolean; roleUnitIds: string[]; grants: NonNullable<Principal['grants']>; scopes: Principal['scopes'] } | null> {
  const m = (await tx.query('SELECT id, permission_profile, explicit_profile, company_wide, person_id FROM membership WHERE user_id = $1 AND status = $2', [userId, 'active'])).rows[0];
  if (!m) return null;
  // yarı açık aralık [from, to): rol tanımı ve atama tarihleri birlikte (N08)
  const roles = (await tx.query(`SELECT r.permission_profile, r.unit_id FROM accountability_assignment a JOIN org_role r ON r.tenant_id = a.tenant_id AND r.id = a.org_role_id WHERE a.tenant_id = $1 AND a.person_id = $2 AND a.effective_from <= now() AND (a.effective_to IS NULL OR a.effective_to > now()) AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to > CURRENT_DATE)`, [tenantId, m.person_id])).rows as { permission_profile: Profile; unit_id: string }[];
  const scopes = (await tx.query('SELECT unit_id, access_profile, include_descendants FROM membership_scope WHERE tenant_id = $1 AND membership_id = $2 AND effective_from <= CURRENT_DATE AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)', [tenantId, m.id])).rows.map(r => ({ unitId: r.unit_id, profile: r.access_profile as Profile, includeDescendants: r.include_descendants as boolean }));
  let profile: Profile = 'VIEWER';
  if (m.explicit_profile) profile = m.permission_profile;
  else { for (const r of roles) if (RANK[r.permission_profile] > RANK[profile]) profile = r.permission_profile; for (const s of scopes) if (RANK[s.profile] > RANK[profile]) profile = s.profile; }
  const companyWide = !!m.company_wide || (m.explicit_profile && ['HR_ADMIN', 'EXEC'].includes(m.permission_profile)) || roles.some(r => ['HR_ADMIN', 'EXEC'].includes(r.permission_profile));
  const grants = [...roles.map(r => ({ unitId: r.unit_id, profile: r.permission_profile, includeDescendants: true })), ...scopes];
  return { membershipId: m.id, personId: m.person_id, profile, companyWide, roleUnitIds: [...new Set(roles.map(r => r.unit_id))], grants, scopes };
}
export async function loadPrincipal(req: FastifyRequest): Promise<Principal | undefined> {
  const raw = req.cookies?.[config.cookieName]; if (!raw) return undefined;
  const th = tokenHash(raw);
  const row = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM auth_session_lookup($1)', [th])).rows[0]);
  if (!row) return undefined; // süresi dolmuş, iptal edilmiş ya da pasif hesap (R10)
  const p: Principal = { sessionToken: raw, userId: row.user_id, email: row.email, displayName: row.display_name, realm: row.realm, tenantId: row.tenant_id };
  if (p.realm === 'platform') { const st = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM platform_session_state($1,$2)', [th, p.userId])).rows[0] as { role: Principal['platformRole']; mfa_enabled: boolean; mfa_at: string | null } | undefined); if (!st?.role) return undefined; p.platformRole = st.role; p.mfaEnabled = !!st.mfa_enabled; p.mfaAt = st.mfa_at; } // v2.9.0: etkin rolü olmayan platform hesabı oturum açamaz; MFA durumu oturumdan // v2.9.0: etkin rolü olmayan platform hesabı oturum açamaz
  if (p.realm === 'customer' && p.tenantId) {
    const m = await withContext({ realm: 'customer', userId: p.userId, tenantId: p.tenantId }, tx => resolveMembership(tx, p.tenantId!, p.userId));
    if (!m) return undefined;
    Object.assign(p, { profile: m.profile, companyWide: m.companyWide, membershipId: m.membershipId, personId: m.personId, roleUnitIds: m.roleUnitIds, grants: m.grants, scopes: m.scopes });
  }
  return p;
}
export function requireAuth(req: FastifyRequest): Principal { if (!req.principal) throw new HttpError(401, 'unauthenticated'); return req.principal; }
/** Tenant kapısı (R02): platform personeli için URL'deki şirket yetkili listede olmalı; müşteri için oturumun şirketi URL ile aynı olmalı. */
export async function requireTenantAsync(req: FastifyRequest, tenantIdParam?: string): Promise<Principal & { tenantId: string }> {
  const p = requireAuth(req);
  if (p.realm === 'platform') { const tid = tenantIdParam ?? p.tenantId; if (!tid) throw new HttpError(403, 'tenant_context_required'); const ok = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT auth_platform_has_tenant($1,$2) AS ok', [p.userId, tid])).rows[0].ok); if (!ok) throw new HttpError(403, 'tenant_not_authorized', 'Bu müşteri yetkili listenizde değil'); return { ...p, tenantId: tid }; }
  if (!p.tenantId) throw new HttpError(403, 'tenant_context_required');
  if (tenantIdParam && tenantIdParam !== p.tenantId) throw new HttpError(403, 'tenant_mismatch', 'Bu sekmedeki şirket ile oturumunuzdaki şirket farklı; sayfayı yenileyip şirketi yeniden seçin. Başka şirkete işlem gönderilmedi.');
  // MP11 (temel): durdurulmuş şirkette müşteri alanı okuyamaz ve yazamaz; platform alanı etkilenmez
  const st = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT tenant_status($1) AS s', [p.tenantId])).rows[0]?.s as string | null);
  if (st && st !== 'active') throw new HttpError(403, 'tenant_suspended', 'Bu şirketin hizmeti Happy Place to Work tarafından geçici olarak durduruldu. Şirketinizin İK yöneticisine ya da HPW’ye başvurun.');
  return { ...p, tenantId: p.tenantId };
}
export function requireProfile(p: Principal, ...allowed: Profile[]): void {
  if (p.realm === 'platform') return; // yetkili müşteri listesi requireTenantAsync ile doğrulandı
  if (!p.profile || !allowed.includes(p.profile)) throw new HttpError(403, 'forbidden_profile', `Bu işlem için yetki profili: ${allowed.join(', ')}`);
}
/** Kimin hangi profili verebileceği (R04): HR_ADMIN hepsini; HR_PARTNER yalnız saha profillerini; diğerleri hiçbirini. Platform personeli HR_ADMIN dahil verebilir (ilk yetkili). */
export function grantableProfiles(p: Principal): Profile[] { if (p.realm === 'platform') return PROFILES; if (p.profile === 'HR_ADMIN') return PROFILES; if (p.profile === 'HR_PARTNER') return ['REGION_MANAGER', 'UNIT_MANAGER', 'ACTION_OWNER', 'VIEWER']; return []; }
export const isAtLeast = (p: Principal, profile: Profile) => p.realm === 'platform' || (p.profile !== undefined && RANK[p.profile] >= RANK[profile]);
export function dbCtx(p: Principal & { tenantId: string }): DbContext { return { realm: p.realm === 'platform' ? 'platform' : 'customer', userId: p.userId, tenantId: p.tenantId, commandKey: p.commandKey ?? null, platformWrite: p.realm === 'platform' ? !!p.platformWrite : undefined, intervention: p.realm === 'platform' ? p.intervention ?? null : null }; }
export function setSessionCookie(reply: FastifyReply, token: string) { reply.setCookie(config.cookieName, token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/', maxAge: config.sessionTtlHours * 3600 }); }
export function clearSessionCookie(reply: FastifyReply) { reply.clearCookie(config.cookieName, { path: '/' }); }
/** Denetim izi (R29): her yazma komutu aynı transaction'da audit_event üretir. */
export async function audit(tx: Tx, p: Principal & { tenantId: string }, entityType: string, entityId: string | null, action: string, oldValue: unknown, newValue: unknown, reason?: string, correlationId?: string) {
  await tx.query('INSERT INTO audit_event (tenant_id, entity_type, entity_id, action, old_value, new_value, actor_ref, reason, correlation_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [p.tenantId, entityType, entityId ?? '00000000-0000-0000-0000-000000000000', action, oldValue === undefined ? null : JSON.stringify(oldValue), newValue === undefined ? null : JSON.stringify(newValue), p.userId, reason ?? null, correlationId ?? p.commandKey ?? null]);
}

/** Kaynak bazlı yetki (N06/N07): bu birim için kişinin en yüksek profili, yalnız o birimi kapsayan rol/kapsam çiftlerinden. Şirket geneli yetki (HR_ADMIN/EXEC) her birimi kapsar. Görme hakkı yazma hakkı değildir. */
export async function profileForUnit(tx: Tx, p: Principal & { tenantId: string }, unitId: string): Promise<Profile | null> {
  if (p.realm === 'platform') return 'HR_ADMIN';
  // şirket geneli yönetim yalnız HR_ADMIN (açık ya da rolden); EXEC/VIEWER şirket geneli görünümü yazma yetkisi vermez (V08)
  if (p.companyWide && p.profile === 'HR_ADMIN') return 'HR_ADMIN';
  const grants = p.grants ?? []; if (!grants.length) return null;
  const anc = new Set<string>((await tx.query(`WITH RECURSIVE up AS (SELECT $2::uuid AS id UNION SELECT r.to_unit_id FROM org_relationship r JOIN up ON up.id = r.from_unit_id WHERE r.tenant_id = $1 AND r.relationship_type = 'reports_to' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to > CURRENT_DATE)) SELECT id FROM up`, [p.tenantId, unitId])).rows.map(r => r.id));
  let best: Profile | null = null;
  for (const g of grants) { const covers = g.unitId === unitId || (g.includeDescendants && anc.has(g.unitId)); if (covers && (best === null || RANK[g.profile] > RANK[best])) best = g.profile; }
  return best;
}
export async function requireUnitProfile(tx: Tx, p: Principal & { tenantId: string }, unitId: string, ...allowed: Profile[]): Promise<Profile> {
  const prof = await profileForUnit(tx, p, unitId);
  if (!prof) throw new HttpError(403, 'unit_not_in_scope', 'Bu birim yetki kapsamınızda değil');
  if (!allowed.includes(prof)) throw new HttpError(403, 'forbidden_profile', `Bu birimde yetkiniz ${prof}; işlem için ${allowed.join(', ')} gerekir`);
  return prof;
}

/** yetki parmak izi (V10): idempotency yanıtı yalnız aynı yetki kümesiyle yeniden verilir */
export function grantsHash(p: Principal): string { return createHash('sha256').update(JSON.stringify({ r: p.realm, pr: p.profile ?? null, cw: !!p.companyWide, g: (p.grants ?? []).map(g => [g.unitId, g.profile, g.includeDescendants]).sort() })).digest('hex').slice(0, 32); }

/** v2.9.0 (K9): platform oturumu MFA ile doğrulanmış mı; hassas işlemde son 10 dakika içinde mi */
export const mfaOk = (p: Principal) => p.realm !== 'platform' || !config.mfaRequired || (!!p.mfaEnabled && !!p.mfaAt);
export function requireRecentMfa(p: Principal) { if (p.realm !== 'platform' || !config.mfaRequired) return; /* ADR-0043: iki adımlı doğrulama kapalıyken yeniden doğrulama da istenmez */ const at = p.mfaAt ? Date.parse(p.mfaAt) : 0; if (!at || Date.now() - at > 10 * 60 * 1000) throw new HttpError(403, 'reauth_required', 'Bu işlem için doğrulama uygulamanızdaki kodla yeniden doğrulama gerekiyor'); }
