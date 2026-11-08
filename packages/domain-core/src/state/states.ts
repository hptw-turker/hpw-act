/** Dört ayrı durum ekseni (v2.3.1): tek enum'a sıkıştırılmaz. SQL ile aynı sözlük. */
export type LifecycleState = 'planned' | 'in_progress' | 'declared_complete' | 'closed' | 'cancelled' | 'paused' | 'superseded';
export type VerificationState = 'pending' | 'auto_verified' | 'human_verified' | 'partial' | 'needs_review' | 'invalidated';
export type HealthState = 'on_track' | 'at_risk' | 'blocked' | 'overdue';
export type OutcomeState = 'not_measured' | 'pending_review' | 'improved' | 'no_meaningful_change' | 'deteriorated' | 'not_comparable';
export type AttributionState = 'none' | 'temporal_only' | 'credited';
export interface ExecutionSnapshot { lifecycle: LifecycleState; verification: VerificationState; health: HealthState; outcome: OutcomeState; attribution?: AttributionState; }
/** "Kanıtı doğrulandı ama iş engellendi / sonuç ölçülmedi" gibi bileşimler serbestçe temsil edilir; yalnız mantıksız bileşimler reddedilir. */
export function validateSnapshot(s: ExecutionSnapshot): string[] {
  const errs: string[] = [];
  if (s.lifecycle === 'planned' && s.verification !== 'pending') errs.push('planned_but_verified');
  // Gözlenen sonuç (improved) aksiyonun durumundan bağımsızdır; yasak olan aksiyona nedensel kredi vermektir (F30)
  if (s.attribution === 'credited' && (s.lifecycle === 'cancelled' || s.verification === 'invalidated')) errs.push('attribution_without_verified_execution');
  return errs;
}
/** Kanıt sonradan geçersizleşince: doğrulama 'invalidated', iş yaşam döngüsü yeniden açılır; tarihçe silinmez. */
export function invalidateEvidence(s: ExecutionSnapshot, reason: string): ExecutionSnapshot & { reopenReason: string } {
  return { ...s, verification: 'invalidated', attribution: 'none', lifecycle: s.lifecycle === 'closed' || s.lifecycle === 'declared_complete' ? 'in_progress' : s.lifecycle, reopenReason: reason };
}
