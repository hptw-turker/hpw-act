# Durum makineleri (tek kaynak: packages/domain-core/src/state)

## Target
```
draft → pending_approval (submit)
pending_approval → active (approve) | draft (reject / counter)
active → exception_pending (exception requested) → active (decided)
active → at_risk (feasibility dropped | conflict) → active (restored)
active → under_review (new measurement, comparability low) → achieved | partial | missed
active → achieved | partial | missed (new measurement, comparability ok)
active → closed_with_reason (unit closed | no longer needed)
achieved → sustain ; partial → continue_or_strengthen ; missed → redesign_or_root_cause
```
Kural: `active`'den `achieved/partial/missed`'e geçiş yalnız Outcome yazıldıktan sonra ve `comparability != not_comparable` ise.

## Action.execution_status (standalone ve local_execution)
```
planned → not_started → in_progress
in_progress ↔ at_risk ; in_progress ↔ delayed
in_progress → evidence_pending (owner declares complete)
evidence_pending → partially_verified | verified | review_required
partially_verified → verified
review_required → verified | partially_verified | in_progress (rejected by human)
planned | in_progress → cancelled (with reason)
```
`master` aksiyonun execution_status'u yoktur; `distribution = count by status of local executions`.

## Action.impact_status
```
not_measured → measurement_scheduled → strong_improvement | limited_improvement | no_change | deterioration | insufficient_measurement
```
Yalnız Outcome hesaplandığında değişir; execution_status ile hiçbir geçiş bağı yoktur.

## EvidenceVerification.state
```
declared → submitted → verified | partially_verified | review_required
review_required → verified | partially_verified | rejected (human, reason)
verified → kpi_confirmed → outcome_confirmed
```

## ExceptionRequest
```
pending → approved | rejected | countered
countered → accepted_by_requester (→ approved) | rejected_by_requester (→ pending with new value)
```
Onay kararı üst hedefin `expected_version`ını taşır; sürüm değiştiyse karar reddedilir ve fizibilite yeniden istenir (T-15).

## AttentionItem
```
open → acknowledged → resolved | dismissed (reason required)
open → escalated (SLA breach)
```

## WorkflowInstance
```
created → running → waiting (timer | human) → running → completed
running → failed_step → running (retry) | incident (retries exhausted) → running (operator resolved) | compensated
```

## ReorganizationEvent
```
draft (from HRIS or manual) → approved (HR Admin) → applying (workflow) → applied | partially_applied (incident) → applied
```
