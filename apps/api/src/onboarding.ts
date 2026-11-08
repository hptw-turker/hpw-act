/** v2.10.0 kurulum: on adımlı kontrol listesi (gereksinimler §4.3; tasarım v2 bölüm 6).
 * Otomatik adımlar veriden hesaplanır; elle onaylı adımlar (2 hizmet kaydı, 10 kullanıma açılış) kişi, zaman, gerekçe ve onaylanan kanıtın parmak izini taşır.
 * Kaynak değişince onay sessizce geçerli sayılmaz: durum "recheck" (yeniden kontrol gerekli) olur. "x/10" kurulum durumudur; şirketin gelişim puanı değildir. */
import { createHash } from 'node:crypto';
import type { Tx } from './db.js';
export type StepState = 'not_started' | 'in_progress' | 'blocked' | 'done' | 'recheck';
export type StepKey = 'identity' | 'service_record' | 'hpw_owner' | 'customer_admin' | 'organization' | 'instrument' | 'first_cycle' | 'results' | 'user_access' | 'go_live';
export interface Step { key: StepKey; no: number; state: StepState; owner: string; facts: Record<string, unknown>; blockedBy: StepKey | null; approval: { by: string | null; at: string; reason: string } | null }
const fp = (v: unknown) => createHash('sha256').update(JSON.stringify(v ?? null)).digest('hex').slice(0, 32);
export async function computeOnboarding(tx: Tx, tid: string) {
  const t = (await tx.query(`SELECT code, name, locale, timezone, status, tracked_cycle_id, service_record, service_record_at, ops_version FROM tenant WHERE id = $1`, [tid])).rows[0] as { code: string; name: string; locale: string; timezone: string; status: string; tracked_cycle_id: string | null; service_record: Record<string, string> | null; service_record_at: string | null; ops_version: number } | undefined;
  if (!t) return null;
  const q = async (sql: string, a: unknown[] = [tid]) => (await tx.query(sql, a)).rows;
  // v2.10.1 (V210-02): merkez ve müşteri aynı hesabı kullanır; müşteri alanı yalnız kendi şirketinin HPW atamalarını (kanıt alanları) okur
  const asg = await q('SELECT user_id, display_name, duty, role FROM platform_assignments_onboarding($1)') as { user_id: string; display_name: string; duty: string; role: string | null }[];
  const primary = asg.find(a => a.duty === 'primary') ?? null;
  // davet oluşturulması ≠ kabul: adım yalnız etkin kullanıcıya bağlı, daveti kabul edilmiş etkin İK yöneticisi üyeliğiyle tamamlanır
  const admins = await q(`SELECT m.id, u.status AS user_status, (SELECT i.status FROM invitation i WHERE i.membership_id = m.id ORDER BY i.created_at DESC LIMIT 1) AS inv, (SELECT 'perm_fail' FROM tenant_failed_invitations($1) f WHERE f.membership_id = m.id) AS delivery FROM membership m JOIN app_user u ON u.id = m.user_id WHERE m.tenant_id = $1 AND m.status = 'active' AND m.permission_profile = 'HR_ADMIN'`) as { id: string; user_status: string; inv: string | null; delivery: string | null }[];
  const c = (await q(`SELECT (SELECT COUNT(*) FROM org_unit WHERE tenant_id = $1 AND effective_to IS NULL)::int AS units, (SELECT COUNT(*) FROM org_role WHERE tenant_id = $1 AND effective_to IS NULL)::int AS roles, (SELECT COUNT(*) FROM instrument_version WHERE tenant_id = $1)::int AS instruments`))[0] as { units: number; roles: number; instruments: number };
  const cycles = await q(`SELECT id, code, name, period_start, period_end, active_batch_id FROM survey_cycle WHERE tenant_id = $1 ORDER BY period_end DESC, id`) as { id: string; code: string; name: string; period_start: string; period_end: string; active_batch_id: string | null }[];
  const tracked = cycles.find(x => x.id === t.tracked_cycle_id) ?? null;
  const lastResultJob = tracked ? (await q(`SELECT state FROM import_job WHERE tenant_id = $1 AND kind = 'results' AND cycle_id = $2 ORDER BY created_at DESC LIMIT 1`, [tid, tracked.id]))[0] as { state: string } | undefined : undefined;
  // v2.11.0: kalıcı başarısız davet ortak tanımı (tenant_failed_invitations); süresi dolan davet ayrıca engel sayılır
  const inv = (await q(`SELECT COUNT(*) FILTER (WHERE i.status = 'accepted')::int AS accepted, COUNT(*) FILTER (WHERE i.status IN ('draft','ready','pending') AND f.membership_id IS NULL)::int AS open, (COUNT(*) FILTER (WHERE f.membership_id IS NOT NULL) + COUNT(*) FILTER (WHERE i.status = 'expired'))::int AS failed FROM membership m JOIN LATERAL (SELECT id, status FROM invitation WHERE membership_id = m.id ORDER BY created_at DESC LIMIT 1) i ON true LEFT JOIN tenant_failed_invitations($1) f ON f.membership_id = m.id WHERE m.tenant_id = $1 AND m.permission_profile <> 'HR_ADMIN' AND m.status = 'active'`))[0] as { accepted: number; open: number; failed: number };
  const appr = await q(`SELECT step_key, approved_by, approved_at, reason, evidence_fingerprint FROM onboarding_approval WHERE tenant_id = $1 AND superseded_at IS NULL`) as { step_key: string; approved_by: string; approved_at: string; reason: string; evidence_fingerprint: string }[];
  const ap = (k: string) => appr.find(a => a.step_key === k);
  const steps: Step[] = [];
  const push = (key: StepKey, state: StepState, owner: string, facts: Record<string, unknown>, blockedBy: StepKey | null = null, approval: Step['approval'] = null) => steps.push({ key, no: steps.length + 1, state, owner, facts, blockedBy, approval });
  // 1 şirket kimliği
  push('identity', t.code && t.name && t.locale && t.timezone ? 'done' : 'in_progress', 'hpw_admin', { code: t.code, locale: t.locale, timezone: t.timezone });
  // 2 hizmet ve veri yönetimi kaydı (elle onay; kayıt değişince yeniden kontrol)
  const srFp = t.service_record ? fp(t.service_record) : null; const a2 = ap('service_record');
  push('service_record', !t.service_record ? 'not_started' : !a2 ? 'in_progress' : a2.evidence_fingerprint === srFp ? 'done' : 'recheck', 'hpw_admin', { recorded: !!t.service_record, recordedAt: t.service_record_at, ref: t.service_record?.ref ?? null, retentionPolicyRef: t.service_record?.retentionPolicyRef ?? null }, null, a2 ? { by: a2.approved_by, at: a2.approved_at, reason: a2.reason } : null);
  // 3 HPW sorumlusu
  push('hpw_owner', primary ? 'done' : 'not_started', 'hpw_admin', { primary: primary?.display_name ?? null, backup: asg.find(a => a.duty === 'backup')?.display_name ?? null });
  // 4 müşteri yöneticisi: davet → kabul
  const accAdmin = admins.find(a => a.inv === 'accepted' && a.user_status === 'active'); const failAdmin = admins.some(a => a.inv === 'expired' || (a.inv !== 'accepted' && a.delivery === 'perm_fail')); // v2.11.0: kalıcı teslimat hatası e-posta kuyruğundan
  push('customer_admin', accAdmin ? 'done' : admins.length === 0 ? 'not_started' : failAdmin ? 'blocked' : 'in_progress', 'hpw_customer', { admins: admins.length, invitation: admins[0]?.inv ?? null });
  // 5 organizasyon
  push('organization', c.units > 0 && c.roles > 0 ? 'done' : c.units > 0 || c.roles > 0 ? 'in_progress' : 'not_started', 'consultant_customer', { units: c.units, roles: c.roles });
  // 6 ölçüm tanımı
  push('instrument', c.instruments > 0 ? 'done' : 'not_started', 'setup_methodology', { versions: c.instruments });
  // 7 ilk dönem ve izlenen dönem (açıkça seçilir)
  push('first_cycle', tracked ? 'done' : cycles.length ? 'in_progress' : c.instruments === 0 ? 'blocked' : 'not_started', 'consultant', { cycles: cycles.length, tracked: tracked?.code ?? null }, !tracked && !cycles.length && c.instruments === 0 ? 'instrument' : null);
  // 8 sonuçlar: izlenen dönemde etkin sonuç partisi
  push('results', tracked?.active_batch_id ? 'done' : !tracked ? 'blocked' : lastResultJob?.state === 'failed' ? 'blocked' : lastResultJob ? 'in_progress' : 'not_started', 'existing_roles', { trackedCycle: tracked?.code ?? null, lastImport: lastResultJob?.state ?? null }, !tracked ? 'first_cycle' : null);
  // 9 kullanıcı erişimleri
  push('user_access', inv.accepted > 0 ? 'done' : inv.failed > 0 ? 'blocked' : inv.open > 0 ? 'in_progress' : 'not_started', 'customer_hr', { accepted: inv.accepted, open: inv.open, failed: inv.failed });
  // 10 kullanıma açılış: 1–9 tamamken tarihli kabul; onaylanan kanıt değişince yeniden kontrol
  const evidence = { tracked: t.tracked_cycle_id, batch: tracked?.active_batch_id ?? null, primary: primary?.user_id ?? null, admin: accAdmin?.id ?? null, sr: srFp, instruments: c.instruments };
  // 10: HPW onayı (kanıt parmak izi) + müşteri İK yöneticisinin kendi alanındaki teyidi (HPW onayının parmak izine bağlı). İkisi de güncel kanıta eşitse tamamlanır.
  const glFp = fp(evidence); const prereqOk = steps.every(s => s.state === 'done'); const a10 = ap('go_live'); const c10 = ap('go_live_customer');
  const hpwOk = !!a10 && a10.evidence_fingerprint === glFp && prereqOk; const custOk = !!c10 && !!a10 && c10.evidence_fingerprint === a10.evidence_fingerprint;
  const glState: StepState = !a10 ? (prereqOk ? 'not_started' : 'blocked') : !hpwOk ? 'recheck' : custOk ? 'done' : 'in_progress';
  push('go_live', glState, 'hpw_customer', { prerequisitesDone: prereqOk, hpwApproved: !!a10, customerConfirmed: custOk, customerConfirmedAt: custOk ? c10!.approved_at : null }, !prereqOk && !a10 ? (steps.find(s => s.state !== 'done')?.key ?? null) : null, a10 ? { by: a10.approved_by, at: a10.approved_at, reason: a10.reason } : null);
  const done = steps.filter(s => s.state === 'done').length; const firstOpen = steps.find(s => s.state !== 'done')?.key ?? null;
  return { tenant: t, steps, summary: { done, total: steps.length, firstOpen }, cycles, tracked, assignments: asg, fingerprints: { service_record: srFp, go_live: glFp }, prerequisitesDone: prereqOk };
}
