/** v2.11.0 bekleyen işler: kural değerlendirmesi ve durum geçişleri (tasarım v2 §7; docs/tasarim/BEKLEYEN-ISLER-KURALLARI-v2.11.md).
 * Değerlendirme platform alanında, şirket bağlamında (RLS) ve platform yazma bayrağıyla çalışır; şirket başına danışma kilidiyle sıraya girer.
 * Bir kuralın kaynağı okunamazsa iş durumunu korur (unreadable) — hiçbir zaman "çözüldü" sayılmaz. */
import type { Tx } from './db.js';
import { computeOnboarding } from './onboarding.js';
export const RULES = ['setup_overdue', 'no_admin', 'invite_failed', 'import_pending', 'overdue_actions', 'verification_backlog', 'central_decision', 'inactive', 'methodology'] as const;
export type Rule = typeof RULES[number];
const OWNER: Record<Rule, 'consultant' | 'methodologist'> = { setup_overdue: 'consultant', no_admin: 'consultant', invite_failed: 'consultant', import_pending: 'consultant', overdue_actions: 'consultant', verification_backlog: 'consultant', central_decision: 'consultant', inactive: 'consultant', methodology: 'methodologist' };
const TARGET_DAYS: Record<Rule, number> = { setup_overdue: 3, no_admin: 2, invite_failed: 2, import_pending: 2, overdue_actions: 5, verification_backlog: 5, central_decision: 5, inactive: 10, methodology: 5 };
export const ACTIVE = ['open', 'claimed', 'snoozed', 'dismissed', 'tenant_inactive'];
/** iş günü (Pzt–Cum; resmî tatil takvimi yok) */
export function addBusinessDays(from: Date, n: number) { const d = new Date(from); let left = n; while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) left--; } return d; }
type Outcome = { cond: boolean; evidence: Record<string, unknown> } | { notEvaluable: string };
const one = async (tx: Tx, sql: string, a: unknown[]) => (await tx.query(sql, a)).rows[0] as Record<string, unknown>;
async function check(tx: Tx, tid: string, rule: Rule): Promise<Outcome> {
  const t = await one(tx, 'SELECT created_at, tracked_cycle_id FROM tenant WHERE id = $1', [tid]) as { created_at: string; tracked_cycle_id: string | null };
  const tracked = t.tracked_cycle_id;
  switch (rule) {
    case 'setup_overdue': { const ob = await computeOnboarding(tx, tid); if (!ob) throw new Error('onboarding_unreadable'); const open = ob.steps.slice(0, 9).filter(s => s.state !== 'done').map(s => s.key); const days = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000); return { cond: days >= 14 && open.length > 0, evidence: { openSteps: open, daysSinceCreation: days } }; }
    case 'no_admin': { const r = await one(tx, `SELECT COUNT(*) FILTER (WHERE i.status = 'accepted' AND u.status = 'active')::int AS accepted, MIN(i.created_at) FILTER (WHERE i.status IN ('draft','ready','pending','sent','delivered','temp_fail')) AS oldest, COUNT(*) FILTER (WHERE i.status IN ('draft','ready','pending','sent','delivered','temp_fail'))::int AS pending FROM membership m JOIN app_user u ON u.id = m.user_id LEFT JOIN LATERAL (SELECT status, created_at FROM invitation WHERE membership_id = m.id ORDER BY created_at DESC LIMIT 1) i ON true WHERE m.tenant_id = $1 AND m.status = 'active' AND m.permission_profile = 'HR_ADMIN'`, [tid]) as { accepted: number; oldest: string | null; pending: number };
      if (!r.oldest && r.accepted === 0) return { cond: false, evidence: { note: 'no_invitation' } };
      return { cond: r.accepted === 0 && !!r.oldest && Date.now() - new Date(r.oldest).getTime() > 7 * 86400000, evidence: { pendingSince: r.oldest, pending: r.pending } }; }
    case 'invite_failed': { const rows = (await tx.query(`SELECT permission_profile AS p, COUNT(*)::int AS n FROM tenant_failed_invitations($1) GROUP BY 1`, [tid])).rows as { p: string; n: number }[]; const total = rows.reduce((a, r) => a + r.n, 0); return { cond: total > 0, evidence: { failed: total, byProfile: Object.fromEntries(rows.map(r => [r.p, r.n])) } }; }
    case 'import_pending': { const stale = (await tx.query(`SELECT id, kind, created_at FROM import_job WHERE tenant_id = $1 AND state = 'validated' AND created_at < now() - interval '3 days' ORDER BY created_at LIMIT 20`, [tid])).rows as { id: string; kind: string; created_at: string }[]; const last = await one(tx, `SELECT id, kind, state, created_at FROM import_job WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`, [tid]) as { id: string; kind: string; state: string; created_at: string } | undefined; const lastFailed = last?.state === 'failed' ? { id: last.id, kind: last.kind, at: last.created_at } : null; return { cond: stale.length > 0 || !!lastFailed, evidence: { staleValidated: stale.map(j => ({ id: j.id, kind: j.kind, at: j.created_at })), lastFailed } }; }
    case 'overdue_actions': { if (!tracked) return { notEvaluable: 'no_tracked_cycle' }; const r = await one(tx, `SELECT COUNT(*) FILTER (WHERE lifecycle_state IN ('planned','in_progress','declared_complete','paused'))::int AS eligible, COUNT(*) FILTER (WHERE lifecycle_state = 'in_progress' AND due_date < CURRENT_DATE)::int AS overdue, MAX(CURRENT_DATE - due_date) FILTER (WHERE lifecycle_state = 'in_progress' AND due_date < CURRENT_DATE) AS oldest FROM action WHERE tenant_id = $1 AND cycle_id = $2 AND kind <> 'master'`, [tid, tracked]) as { eligible: number; overdue: number; oldest: number | null }; const c = await one(tx, 'SELECT code FROM survey_cycle WHERE tenant_id = $1 AND id = $2', [tid, tracked]) as { code: string }; return { cond: r.overdue >= 10 || (r.eligible > 0 && r.overdue / r.eligible >= 0.2), evidence: { cycle: c?.code ?? null, overdue: r.overdue, eligible: r.eligible, oldestDays: r.oldest } }; }
    case 'verification_backlog': { if (!tracked) return { notEvaluable: 'no_tracked_cycle' }; const r = await one(tx, `SELECT COUNT(*)::int AS pending, MAX(CURRENT_DATE - updated_at::date) AS oldest FROM action WHERE tenant_id = $1 AND cycle_id = $2 AND lifecycle_state = 'declared_complete' AND verification_state = 'pending'`, [tid, tracked]) as { pending: number; oldest: number | null }; const c = await one(tx, 'SELECT code FROM survey_cycle WHERE tenant_id = $1 AND id = $2', [tid, tracked]) as { code: string }; return { cond: (r.oldest ?? 0) > 14, evidence: { cycle: c?.code ?? null, pending: r.pending, oldestDays: r.oldest } }; }
    case 'central_decision': { const rows = (await tx.query(`SELECT kind, COUNT(*)::int AS n, MAX(CURRENT_DATE - created_at::date) AS oldest FROM cm_central_queue WHERE tenant_id = $1 AND state IN ('open','in_review') AND created_at < now() - interval '7 days' GROUP BY kind`, [tid])).rows as { kind: string; n: number; oldest: number }[]; const n = rows.reduce((a, r) => a + r.n, 0); return { cond: n > 0, evidence: { count: n, oldestDays: rows.length ? Math.max(...rows.map(r => r.oldest)) : null, byKind: Object.fromEntries(rows.map(r => [r.kind, r.n])) } }; }
    case 'inactive': { const pub = await one(tx, 'SELECT COUNT(*)::int AS n FROM survey_cycle WHERE tenant_id = $1 AND active_batch_id IS NOT NULL', [tid]) as { n: number }; if (pub.n === 0) return { cond: false, evidence: { note: 'no_published_results' } }; const last = await one(tx, 'SELECT MAX(occurred_at) AS at FROM audit_event WHERE tenant_id = $1', [tid]) as { at: string | null }; return { cond: !last.at || Date.now() - new Date(last.at).getTime() > 30 * 86400000, evidence: { lastActivityAt: last.at } }; }
    case 'methodology': { const r = await one(tx, `SELECT COUNT(*)::int AS n FROM outcome_assessment WHERE tenant_id = $1 AND comparability_status = 'review_required' AND comparability_review_id IS NULL`, [tid]) as { n: number }; return { cond: r.n > 0, evidence: { pendingReviews: r.n } }; }
  }
}
type Item = { id: string; state: string; claimed_by: string | null; snoozed_until: string | null; dismissed_until: string | null; state_reason: string | null; version: number };
const audit = (tx: Tx, actor: string, action: string, tid: string, id: string, before: unknown, after: unknown) => tx.query('INSERT INTO platform_audit_event (actor_id, action, tenant_id, target_type, target_id, before, after, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [actor, action, tid, 'work_item', id, before === null ? null : JSON.stringify(before), JSON.stringify({ ...(after as object), by: 'system' }), 'kural değerlendirmesi']);
/** bir şirketin kurallarını değerlendirir; tetikleyen kullanıcı işlem geçmişine "sistem (kural değerlendirmesi)" satırlarının tetikleyicisi olarak yazılır */
export async function evaluateTenant(tx: Tx, tid: string, actor: string, rules: readonly Rule[] = RULES) {
  // bir şirketin değerlendirmesi uzarsa ya da kilitte beklerse diğer şirketlerin listesini engellemez: kilit 2 sn, sorgu 5 sn sınırı; aşılırsa bu şirket için hata döner
  await tx.query("SET LOCAL lock_timeout = '2s'"); await tx.query("SET LOCAL statement_timeout = '5s'");
  await tx.query("SELECT pg_advisory_xact_lock(hashtext('hpw-work-item:' || $1))", [tid]);
  const st = (await one(tx, 'SELECT status FROM tenant WHERE id = $1', [tid]) as { status: string } | undefined)?.status;
  if (!st) return { evaluated: 0 };
  // v2.11.1 (V211-01): etkin işler satır kilidiyle okunur — kullanıcı komutları (üstlen/bırak/ertele/reddet) aynı satırı FOR UPDATE ile kilitler;
  // değerlendirme sürerken gelen komut değerlendirmenin bitmesini bekler ve güncel sürümü görür; değerlendirme de eski durumun üzerine yazamaz.
  const active = (await tx.query(`SELECT id, rule, state, claimed_by, snoozed_until, dismissed_until, state_reason, version FROM platform_work_item WHERE tenant_id = $1 AND state <> 'resolved' ORDER BY id FOR UPDATE`, [tid])).rows as (Item & { rule: Rule })[];
  const byRule = new Map(active.map(i => [i.rule, i]));
  if (st !== 'active') { // şirket askıda/arşivde: etkin işler korunur, yeni iş açılmaz, işlem yapılamaz
    for (const i of active) if (i.state !== 'tenant_inactive') { const u = await tx.query(`UPDATE platform_work_item SET state = 'tenant_inactive', state_reason = $2, version = version + 1, last_eval_at = now() WHERE id = $1 AND version = $3`, [i.id, i.state, i.version]); if (!u.rowCount) continue; await audit(tx, actor, 'work_item.tenant_inactive', tid, i.id, { state: i.state }, { state: 'tenant_inactive', tenantStatus: st }); }
    for (const r of rules) await tx.query(`INSERT INTO platform_work_eval (tenant_id, rule, status, detail, last_attempt_at) VALUES ($1,$2,'not_evaluable',$3, now()) ON CONFLICT (tenant_id, rule) DO UPDATE SET status = 'not_evaluable', detail = $3, last_attempt_at = now()`, [tid, r, 'tenant_' + st]);
    return { evaluated: 0 };
  }
  /** sahibin güncel yetkisi: kullanıcı etkin, şirkete geçerli ataması var, rolü Sistem Yöneticisi ya da işin sahip rolü */
  const ownerOk = async (uid: string | null, ownerRole: string) => { if (!uid) return false; const r = await one(tx, `SELECT platform_access_active($1, $2) AS a, (SELECT role FROM platform_role WHERE user_id = $1 AND revoked_at IS NULL) AS role`, [uid, tid]) as { a: boolean; role: string | null }; return !!r.a && (r.role === 'admin' || r.role === ownerRole); };
  /** kaynak koşulundan bağımsız, zamana ve sahibe bağlı sonraki durum: askıdan dönüşte önceki durum körlemesine geri yüklenmez;
   * erteleme/reddetme süreleri askıdayken de işler (takvim zamanı); süresi dolmuşsa iş sahibine — yetkisi sürüyorsa — döner, yoksa açık iş olur */
  const nextState = async (cur: Item & { owner_role?: string }, ownerRole: string) => {
    let base = cur.state === 'tenant_inactive' ? (['open', 'claimed', 'snoozed', 'dismissed'].includes(cur.state_reason ?? '') ? cur.state_reason! : 'open') : cur.state; const now = Date.now(); const notes: string[] = [];
    if (base === 'snoozed' && cur.snoozed_until && new Date(cur.snoozed_until).getTime() <= now) { base = cur.claimed_by ? 'claimed' : 'open'; notes.push('snooze_ended'); }
    if (base === 'dismissed' && cur.dismissed_until && new Date(cur.dismissed_until).getTime() <= now) { base = cur.claimed_by ? 'claimed' : 'open'; notes.push('dismiss_ended'); }
    let claimedBy = cur.claimed_by; if (claimedBy && ['claimed', 'snoozed', 'dismissed'].includes(base) && !(await ownerOk(claimedBy, ownerRole))) { notes.push('owner_lost'); claimedBy = null; if (base === 'claimed') base = 'open'; }
    return { state: base, claimedBy, notes };
  };
  const ownerRoleOf = (rule: Rule) => OWNER[rule];
  let n = 0;
  for (const rule of rules) {
    const cur = byRule.get(rule); let out: Outcome | null = null; let err: string | null = null;
    await tx.query('SAVEPOINT wi_rule'); try { out = await check(tx, tid, rule); await tx.query('RELEASE SAVEPOINT wi_rule'); } catch (e) { await tx.query('ROLLBACK TO SAVEPOINT wi_rule'); err = String((e as Error).message ?? e).slice(0, 200); }
    n++;
    const evalStatus = err !== null || !out ? 'unreadable' : 'notEvaluable' in out ? 'not_evaluable' : 'ok';
    const detail = evalStatus === 'unreadable' ? err : evalStatus === 'not_evaluable' ? (out as { notEvaluable: string }).notEvaluable : null;
    // değerlendirme kaydı kural başına: başarılı kuralların zamanı başarısız kuralı güncelmiş göstermez (last_ok_at yalnız 'ok' iken ilerler)
    await tx.query(`INSERT INTO platform_work_eval (tenant_id, rule, status, detail, last_ok_at, last_attempt_at) VALUES ($1,$2,$3,$4, CASE WHEN $3 = 'ok' THEN now() END, now()) ON CONFLICT (tenant_id, rule) DO UPDATE SET status = $3, detail = $4, last_ok_at = CASE WHEN $3 = 'ok' THEN now() ELSE platform_work_eval.last_ok_at END, last_attempt_at = now()`, [tid, rule, evalStatus, detail]);
    const ok = evalStatus === 'ok' ? out as { cond: boolean; evidence: Record<string, unknown> } : null;
    if (!cur) {
      if (ok?.cond) { const occ = ((await one(tx, 'SELECT COALESCE(MAX(occurrence), 0)::int AS o FROM platform_work_item WHERE tenant_id = $1 AND rule = $2', [tid, rule])) as { o: number }).o + 1;
        const r = await tx.query(`INSERT INTO platform_work_item (tenant_id, rule, occurrence, owner_role, due_at, evidence, eval_status, last_ok_eval_at, last_eval_at) VALUES ($1,$2,$3,$4,$5,$6,'ok',now(),now()) ON CONFLICT DO NOTHING RETURNING id`, [tid, rule, occ, ownerRoleOf(rule), addBusinessDays(new Date(), TARGET_DAYS[rule]).toISOString(), JSON.stringify(ok.evidence)]);
        if (r.rowCount) await audit(tx, actor, 'work_item.opened', tid, r.rows[0].id, null, { rule, occurrence: occ, evidence: ok.evidence }); }
      continue; // değerlendirilemeyen ya da okunamayan kural yeni iş açmaz
    }
    if (ok && !ok.cond) { // kaynakta çözüldü (yalnız koşul başarıyla değerlendirildiyse)
      const u = await tx.query(`UPDATE platform_work_item SET state = 'resolved', resolved_at = now(), state_reason = 'source_resolved', eval_status = 'ok', eval_error = NULL, last_ok_eval_at = now(), last_eval_at = now(), version = version + 1 WHERE id = $1 AND version = $2`, [cur.id, cur.version]); if (!u.rowCount) continue; // son sorun kanıtı işte kalır; sürüm koruması
      await audit(tx, actor, 'work_item.resolved', tid, cur.id, { state: cur.state }, { state: 'resolved', reason: 'source_resolved', evidenceAtResolution: ok.evidence }); continue; }
    // koşul sürüyor ya da belirsiz (okunamadı / değerlendirilemedi): iş kapanmaz, listede kalır; son başarılı doğrulama zamanı yalnız 'ok' iken ilerler
    const nx = await nextState(cur, ownerRoleOf(rule));
    const changed = nx.state !== cur.state || nx.claimedBy !== cur.claimed_by;
    await tx.query(`UPDATE platform_work_item SET state = $2, claimed_by = $3, claimed_at = CASE WHEN $3::uuid IS NULL THEN NULL ELSE claimed_at END, state_reason = CASE WHEN $2 IN ('snoozed','dismissed') THEN state_reason ELSE NULL END,
        snoozed_until = CASE WHEN $2 = 'snoozed' THEN snoozed_until ELSE NULL END, dismissed_until = CASE WHEN $2 = 'dismissed' THEN dismissed_until ELSE NULL END,
        evidence = COALESCE($4, evidence), eval_status = $5, eval_error = $6, last_ok_eval_at = CASE WHEN $5 = 'ok' THEN now() ELSE last_ok_eval_at END, last_eval_at = now(), version = version + $7 WHERE id = $1 AND version = $8`,
      [cur.id, nx.state, nx.claimedBy, ok ? JSON.stringify(ok.evidence) : null, evalStatus, detail, changed ? 1 : 0, cur.version]);
    if (cur.state === 'tenant_inactive') await audit(tx, actor, 'work_item.tenant_active', tid, cur.id, { state: 'tenant_inactive', previous: cur.state_reason }, { state: nx.state, notes: nx.notes, evaluation: evalStatus });
    for (const note of nx.notes) await audit(tx, actor, note === 'snooze_ended' ? 'work_item.snooze_ended' : note === 'dismiss_ended' ? 'work_item.dismiss_ended' : 'work_item.owner_lost', tid, cur.id, { state: cur.state, claimedBy: cur.claimed_by }, { state: nx.state, claimedBy: nx.claimedBy });
  }
  return { evaluated: n };
}
