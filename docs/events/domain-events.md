# Domain olay kataloğu

Zarf: `{ event_id, event_type, aggregate_type, aggregate_id, aggregate_version, tenant_id, occurred_at, correlation_id, causation_id, payload }`. Teslimat en az bir kez; tüketici `processed_events(event_id)`.

| Olay | Üreten modül | Tüketenler | Payload (özet) |
|---|---|---|---|
| Import.Committed | M01 | M03 analiz, M11 projeksiyon | cycle_id, source, row_count, quality_summary |
| Result.Suppressed | M01 | M11 | unit_id, item_version_id, n |
| ItemVersion.Created | M01 | M09 | item_id, version, equivalence |
| OrgUnit.Created / Changed / Closed | M02 | M10 scope, M04 fizibilite, M05 deployment, M11 | unit_id, effective_from, lineage |
| Reorg.Drafted / Approved / Applied / PartiallyApplied | M02 | M04, M05, M08, M11 | event_id_external, type, sources, targets, steps |
| Person.Deprovisioned | M02 | M08 orphan, M10 | person_id |
| Ownership.Orphaned | M02 | M08 | entity_type, entity_id, previous_owner, accountable |
| Delegation.Started / Ended | M02 | M08, M10 | from, to, scope, until |
| Analysis.Completed | M03 | M04, M11 | cycle_id, priorities_version |
| FocusArea.Proposed | M03 | M11 | unit_id, dimension, priority, tier |
| Cohort.Frozen | M04 | M11 | target_id, policy, member_count, snapshot_hash |
| Allocation.Completed / Infeasible | M04 | M08 (infeasible → attention), M11 | run_id, projected, max_achievable |
| Target.Drafted / Submitted / Approved / Versioned / AtRisk / Closed | M04 | M05, M08, M11 | target_id, version, approved_target, reason |
| Exception.Requested / Decided | M04 | M08, M11 | request_id, type, decision, parent_version |
| TargetConflict.Detected / Resolved | M04 | M08 | conflict_id, targets, lever |
| Action.Created / Deployed / Declined / Cancelled / CompletionDeclared | M05/M06 | M08, M11 | action_id, kind, parent_action_id |
| LocalExecution.Created / Cancelled | M05 | M08, M11 | action_id, unit_id, owner |
| Problem.Escalated | M05 | M05 clustering, M08 | escalation_id, lever, suggested_owner |
| IssueCluster.Formed / Converted | M05 | M08, M11 | cluster_id, member_count, master_action_id |
| Resource.Requested / Committed | M05 | M08 | requirement_id, gap |
| Evidence.Submitted / Verified / PartiallyVerified / ReviewRequired / Rejected / AnomalyDetected | M06 | M08, M11 | evidence_id, action_id, confidence, flags |
| CheckIn.Recorded | M07 | M08 (confidence drop), M11 | subject, progress, confidence |
| Deadline.Extended | M07 | M08, M11 | action_id, old_due, new_due, reason |
| Bulk.Previewed / Committed / Undone | M07 | M11 | bulk_id, type, affected_count |
| Attention.Created / Acknowledged / Resolved / Escalated | M08 | M11 | item_id, audience, type, severity, sla |
| Notification.Sent / Failed / Retried | M08 | M11 | delivery_id, channel |
| Comparability.Assessed | M09 | M11 | target_id, level, status |
| Outcome.Evaluated / Decided | M09 | M05 impact_status, M11, M09 effectiveness | target_id, attainment, movement_class, decision |
| Policy.Denied | M10 | audit | actor, action, resource, reason |
| Workflow.Started / StepCompleted / Incident / Completed | M12 | M08 (incident → attention) | instance_id, step, attempts |
| Connector.Synced / Failed | M12 | M08 | connector_id, cursor, lag |
| Retention.Executed, LegalHold.Placed/Released, Deletion.Requested/Completed | M12 | audit | scope, count |
