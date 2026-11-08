-- HPW Act — 0008: Sorumluluk Haritası (P1-8), reorg/devir tarihçesi (P1-11), kurumsal motor çekirdeği (P2-12)
CREATE TABLE IF NOT EXISTS cm_responsibility_map (
  tenant_id uuid NOT NULL, id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code text, interaction_area text, responsibility_center text NOT NULL,
  role_code text NOT NULL, scope_unit_id uuid, include_descendants boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE, effective_to date,
  exception_reason text, status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('candidate','confirmed','retired')),
  decided_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (item_code IS NOT NULL OR interaction_area IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_responsibility_map_lookup ON cm_responsibility_map (tenant_id, item_code, interaction_area) WHERE status = 'confirmed';
-- reorg/devir: hedef/aksiyon sahipliği tarihçesi
CREATE TABLE IF NOT EXISTS cm_ownership_transfer (
  tenant_id uuid NOT NULL, id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('local_target','action','org_unit')), entity_id uuid NOT NULL,
  from_unit_id uuid, to_unit_id uuid, from_role_code text, to_role_code text, reason text NOT NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE, decided_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
-- kurumsal motor: istek → kohort dondurma → yerel katkı projeksiyonu → uzlaştırma/istisna/karşı teklif → ana aksiyon → dağıtım → yerel uygulama × N → sürüm geçişi → merkezi karar kuyruğu → Control Tower
CREATE TABLE IF NOT EXISTS cm_ambition (
  tenant_id uuid NOT NULL, id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cycle_id uuid NOT NULL, item_code text NOT NULL,
  ambition_value numeric(6,2) NOT NULL, rationale text NOT NULL, version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','frozen','reconciling','reconciled','superseded')),
  cohort_frozen_at timestamptz, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cm_ambition_cohort (
  tenant_id uuid NOT NULL, ambition_id uuid NOT NULL REFERENCES cm_ambition(id) ON DELETE CASCADE, unit_id uuid NOT NULL,
  headcount int, baseline_value numeric(6,2), baseline_n int, baseline_visible boolean NOT NULL DEFAULT true,
  local_target_value numeric(6,2), local_target_id uuid, projection_value numeric(6,2),
  reconciliation text NOT NULL DEFAULT 'pending' CHECK (reconciliation IN ('pending','aligned','gap','unsupported','exception','counterproposal')),
  counterproposal_value numeric(6,2), exception_reason text, decided_by uuid, decided_at timestamptz,
  PRIMARY KEY (tenant_id, ambition_id, unit_id)
);
CREATE TABLE IF NOT EXISTS cm_master_action (
  tenant_id uuid NOT NULL, id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ambition_id uuid REFERENCES cm_ambition(id),
  code text NOT NULL, title text NOT NULL, description text, version int NOT NULL DEFAULT 1, cadence text NOT NULL DEFAULT 'monthly',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','superseded','retired')), supersedes_id uuid,
  owner_role_code text, budget_note text, dependencies text, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code, version)
);
CREATE TABLE IF NOT EXISTS cm_master_action_deployment (
  tenant_id uuid NOT NULL, id uuid PRIMARY KEY DEFAULT gen_random_uuid(), master_action_id uuid NOT NULL REFERENCES cm_master_action(id), unit_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','superseded','withdrawn')), local_action_id uuid, version int NOT NULL DEFAULT 1,
  transition_state text NOT NULL DEFAULT 'current' CHECK (transition_state IN ('current','pending_upgrade','upgraded','retired')),
  deployed_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, master_action_id, unit_id)
);
CREATE TABLE IF NOT EXISTS cm_central_queue (
  tenant_id uuid NOT NULL, id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK (kind IN ('exception','resource','dependency','decision','orphan')),
  entity_type text, entity_id uuid, unit_id uuid, title text NOT NULL, detail text, priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','in_review','decided','closed')), decision text, decided_by uuid, decided_at timestamptz,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), dedupe_key text, UNIQUE (tenant_id, dedupe_key)
);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['cm_responsibility_map','cm_ownership_transfer','cm_ambition','cm_ambition_cohort','cm_master_action','cm_master_action_deployment','cm_central_queue'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())', t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO hpw_app', t);
END LOOP; END $$;
