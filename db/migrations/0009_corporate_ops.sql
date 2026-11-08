-- HPW Act — 0009: kurumsal motor yönetim alanları (v2.6.9): uzlaştırma durumları, metrik kimliği, dağıtım kabul/red ve sürüm kararı, yapılandırılmış kaynak/bütçe/bağımlılık istekleri
ALTER TABLE cm_ambition_cohort DROP CONSTRAINT IF EXISTS cm_ambition_cohort_reconciliation_check;
ALTER TABLE cm_ambition_cohort ADD CONSTRAINT cm_ambition_cohort_reconciliation_check CHECK (reconciliation IN ('pending','aligned','gap','unsupported','exception','counterproposal','contributing','no_local_target','counterproposal_accepted','counterproposal_rejected','exception_accepted'));
ALTER TABLE cm_ambition ADD COLUMN IF NOT EXISTS metric_code text;   -- P0-9: açık metrik kimliği (yalnız *_TB desteklenir; NPS/mean/BIN reddedilir)
ALTER TABLE cm_master_action_deployment ADD COLUMN IF NOT EXISTS local_response text CHECK (local_response IN ('pending','accepted','rejected'));
ALTER TABLE cm_master_action_deployment ALTER COLUMN local_response SET DEFAULT 'pending';
ALTER TABLE cm_master_action_deployment ADD COLUMN IF NOT EXISTS local_reason text;
ALTER TABLE cm_master_action_deployment ADD COLUMN IF NOT EXISTS upgrade_decision text CHECK (upgrade_decision IN ('upgrade','keep_old','retire'));
ALTER TABLE cm_master_action_deployment ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE TABLE IF NOT EXISTS cm_resource_request (
  tenant_id uuid NOT NULL, id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK (kind IN ('resource','budget','dependency')),
  deployment_id uuid, master_action_id uuid, unit_id uuid, owner_role_code text, need text NOT NULL, amount numeric(14,2), currency text DEFAULT 'TRY',
  due_date date, state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','in_review','approved','rejected','fulfilled')), decision text, reason text,
  blocks_execution boolean NOT NULL DEFAULT false, decided_by uuid, decided_at timestamptz, created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cm_resource_request ENABLE ROW LEVEL SECURITY; ALTER TABLE cm_resource_request FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON cm_resource_request; CREATE POLICY tenant_isolation ON cm_resource_request USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());
GRANT SELECT, INSERT, UPDATE ON cm_resource_request TO hpw_app;
ALTER TABLE cm_central_queue DROP CONSTRAINT IF EXISTS cm_central_queue_kind_check;
ALTER TABLE cm_central_queue ADD CONSTRAINT cm_central_queue_kind_check CHECK (kind IN ('exception','resource','dependency','decision','orphan','upgrade'));
-- as-of hiyerarşi (P0-5): bütün aktif ilişki sorguları için tek fonksiyon
CREATE OR REPLACE FUNCTION org_parent_asof(p_tenant uuid, p_unit uuid, p_date date) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT r.to_unit_id FROM org_relationship r WHERE r.tenant_id = p_tenant AND r.from_unit_id = p_unit AND r.relationship_type = 'reports_to' AND r.effective_from <= p_date AND (r.effective_to IS NULL OR r.effective_to > p_date) ORDER BY r.effective_from DESC LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION org_parent_asof(uuid, uuid, date) TO hpw_app;
