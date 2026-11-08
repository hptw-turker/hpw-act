-- HPW Act — 0011: kuyruk ve alttaki kayıt ayrışmasının onarımı (V270-P0-01), kohort tarih esası (V270-P1-06)
ALTER TABLE cm_ambition ADD COLUMN IF NOT EXISTS cohort_as_of date;
ALTER TABLE cm_ambition ADD COLUMN IF NOT EXISTS cohort_as_of_basis text CHECK (cohort_as_of_basis IN ('freeze_date','cycle_end'));
-- kararsız kapatılmış ama alttaki kaydı hâlâ açık olan kuyruk satırları yeniden açılır
UPDATE cm_central_queue q SET state = 'open', decision = NULL, decided_by = NULL, decided_at = NULL
 WHERE q.state = 'closed' AND q.kind = 'resource' AND EXISTS (SELECT 1 FROM cm_resource_request r WHERE r.tenant_id = q.tenant_id AND r.id = q.entity_id AND r.state IN ('open','in_review'));
UPDATE cm_central_queue q SET state = 'open', decision = NULL, decided_by = NULL, decided_at = NULL
 WHERE q.state = 'closed' AND q.kind IN ('exception','decision') AND q.entity_type = 'cm_ambition_cohort' AND EXISTS (SELECT 1 FROM cm_ambition_cohort c WHERE c.tenant_id = q.tenant_id AND c.ambition_id = q.entity_id AND c.unit_id = q.unit_id AND c.reconciliation IN ('exception','counterproposal','gap'));
UPDATE cm_central_queue q SET state = 'open', decision = NULL, decided_by = NULL, decided_at = NULL
 WHERE q.state = 'closed' AND q.kind = 'upgrade' AND EXISTS (SELECT 1 FROM cm_master_action_deployment d WHERE d.tenant_id = q.tenant_id AND d.master_action_id = q.entity_id AND d.transition_state = 'pending_upgrade');
