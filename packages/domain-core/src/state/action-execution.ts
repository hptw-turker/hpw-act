/** docs/domain/state-machines.md — Action.execution_status tek geçiş tablosu. */
export type ExecutionStatus = 'planned' | 'not_started' | 'in_progress' | 'at_risk' | 'delayed' | 'evidence_pending' | 'partially_verified' | 'verified' | 'review_required' | 'cancelled';
export type ExecutionEvent = 'start' | 'flag_risk' | 'clear_risk' | 'miss_deadline' | 'declare_complete' | 'verify' | 'verify_partial' | 'require_review' | 'reject_by_human' | 'cancel';

const T: Record<ExecutionStatus, Partial<Record<ExecutionEvent, ExecutionStatus>>> = {
  planned:            { start: 'not_started', cancel: 'cancelled' },
  not_started:        { start: 'in_progress', cancel: 'cancelled', miss_deadline: 'delayed' },
  in_progress:        { flag_risk: 'at_risk', miss_deadline: 'delayed', declare_complete: 'evidence_pending', cancel: 'cancelled' },
  at_risk:            { clear_risk: 'in_progress', declare_complete: 'evidence_pending', cancel: 'cancelled' },
  delayed:            { clear_risk: 'in_progress', declare_complete: 'evidence_pending', cancel: 'cancelled' },
  evidence_pending:   { verify: 'verified', verify_partial: 'partially_verified', require_review: 'review_required' },
  partially_verified: { verify: 'verified', require_review: 'review_required' },
  review_required:    { verify: 'verified', verify_partial: 'partially_verified', reject_by_human: 'in_progress' },
  verified:           {},
  cancelled:          {},
};

export function transitionExecution(from: ExecutionStatus, ev: ExecutionEvent): ExecutionStatus {
  const to = T[from][ev];
  if (!to) { const e = new Error(`invalid_transition: ${from} --${ev}--> ?`); (e as Error & { code: string }).code = 'invalid_transition'; throw e; }
  return to;
}
