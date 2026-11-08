-- HPW Act — Faz 0 çekirdek şema (PostgreSQL 16) — v2.4 (ADR-0017..0041): madde düzeyi takip, anket-agnostik enstrüman ve sonuç paketi: karar çekirdeği düzeltmeleri, dört durum ekseni, düzeltme/sürüm sözleşmeleri, en az yetki: ambition / yerel hedef / katkı projeksiyonu fiziksel olarak ayrı; metrik sürümlü; rol merkezli sahiplik; ifşa kararı
-- Kurallar: her tablo tenant_id; RLS ENABLE + FORCE; uygulama rolü hpw_app tablo sahibi değil, NOBYPASSRLS.
-- Enum'lar text + CHECK; para bigint kuruş; skorlar numeric(5,2); zaman timestamptz (UTC).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- roller (migrator çalıştırır)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='hpw_app') THEN
    CREATE ROLE hpw_app LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

-- ---------- yardımcı: tenant bağlamı
CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$;

-- ---------- tenant / organizasyon / kimlik
CREATE TABLE tenant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  region text NOT NULL DEFAULT 'tr',            -- veri yerleşimi
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,  -- eşikler, ağırlıklar, kohort politikası, onay zinciri, onay modu, yük politikası {max_active_local_targets:2, max_active_actions:3, max_recommended_options:3} (ADR-0031)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization (
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  default_language text NOT NULL DEFAULT 'tr',
  default_timezone text NOT NULL DEFAULT 'Europe/Istanbul',
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE hierarchy_group (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  code text NOT NULL,                      -- idari, fonksiyonel, cografi, ik, teknoloji
  name text NOT NULL,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, organization_id, code)
);

CREATE TABLE org_unit (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  external_id text,
  name text NOT NULL,
  unit_type text NOT NULL CHECK (unit_type IN ('company','gmy','region','area','branch','directorate','subunit','call_center','ops_center','logistics','subsidiary','team')),
  timezone text NOT NULL DEFAULT 'Europe/Istanbul',
  calendar_code text NOT NULL DEFAULT 'TR',   -- çalışma takvimi
  headcount int,
  effective_from date NOT NULL,
  effective_to date,                          -- NULL = aktif
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX ix_org_unit_active ON org_unit (tenant_id, organization_id) WHERE effective_to IS NULL;
CREATE UNIQUE INDEX ux_org_unit_external ON org_unit (tenant_id, organization_id, external_id) WHERE external_id IS NOT NULL AND effective_to IS NULL;

CREATE TABLE org_relationship (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hierarchy_group_id uuid NOT NULL,
  from_unit_id uuid NOT NULL,
  to_unit_id uuid NOT NULL,
  relationship_type text NOT NULL CHECK (relationship_type IN ('reports_to','functional_to','geographic_to','hr_scope','tech_scope','finance_scope','survey_reporting_scope','enabled_by')),
  topic text,                                  -- enabled_by için konu/kaldıraç
  effective_from date NOT NULL,
  effective_to date,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, hierarchy_group_id) REFERENCES hierarchy_group(tenant_id, id),
  FOREIGN KEY (tenant_id, from_unit_id) REFERENCES org_unit(tenant_id, id),
  FOREIGN KEY (tenant_id, to_unit_id) REFERENCES org_unit(tenant_id, id),
  CHECK (from_unit_id <> to_unit_id)
);
-- Bir grupta bir birimin aynı anda tek bir aktif üstü olur (reports_to/functional_to/geographic_to için)
CREATE UNIQUE INDEX ux_org_relationship_single_parent ON org_relationship (tenant_id, hierarchy_group_id, from_unit_id)
  WHERE effective_to IS NULL AND relationship_type IN ('reports_to','functional_to','geographic_to');

-- Effective-dated closure table (grup başına; olaylarla yeniden hesaplanır)
CREATE TABLE org_closure (
  tenant_id uuid NOT NULL,
  hierarchy_group_id uuid NOT NULL,
  ancestor_id uuid NOT NULL,
  descendant_id uuid NOT NULL,
  depth int NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  PRIMARY KEY (tenant_id, hierarchy_group_id, ancestor_id, descendant_id, effective_from)
);
CREATE INDEX ix_org_closure_desc ON org_closure (tenant_id, hierarchy_group_id, descendant_id) WHERE effective_to IS NULL;

CREATE TABLE reorganization_event (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  external_event_id text,                      -- HRIS tekilleştirme (T-37)
  event_type text NOT NULL CHECK (event_type IN ('rename','move','split','merge','close','open','absorb')),
  source_unit_ids uuid[] NOT NULL DEFAULT '{}',
  target_unit_ids uuid[] NOT NULL DEFAULT '{}',
  hierarchy_group_id uuid,
  new_parent_unit_id uuid,
  employee_mapping_rule jsonb,
  effective_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','applying','applied','partially_applied','rejected')),
  approved_by uuid,
  workflow_instance_id uuid,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);
CREATE UNIQUE INDEX ux_reorg_external ON reorganization_event (tenant_id, external_event_id) WHERE external_event_id IS NOT NULL;

CREATE TABLE org_lineage (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reorg_event_id uuid NOT NULL,
  from_unit_id uuid NOT NULL,
  to_unit_id uuid NOT NULL,
  lineage_type text NOT NULL CHECK (lineage_type IN ('renamed_to','moved','split_into','merged_into','closed','opened_from','absorbed_into')),
  weight_share numeric(6,4),                   -- split/merge için pay
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE person (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  external_id text,
  display_name text NOT NULL,
  email text,
  language text NOT NULL DEFAULT 'tr',
  timezone text,
  primary_unit_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','anonymized')),
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

-- Rol merkezli sahiplik (ADR-0028): sorumluluk organizasyonel rolde durur, kişi effective-dated çözülür; ayrılışta iş taşınmaz, rol boşalır
CREATE TABLE org_role (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  role_type text NOT NULL,                     -- branch_manager, region_director, hrbp ...
  title text NOT NULL,                         -- "Konak Şube Müdürü"
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, unit_id) REFERENCES org_unit(tenant_id, id)
);
CREATE UNIQUE INDEX ux_org_role_active ON org_role (tenant_id, unit_id, role_type) WHERE effective_to IS NULL;

CREATE TABLE accountability_assignment (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_role_id uuid NOT NULL,
  person_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('primary','delegate','acting')),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, org_role_id) REFERENCES org_role(tenant_id, id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES person(tenant_id, id)
);
CREATE UNIQUE INDEX ux_accountability_primary_active ON accountability_assignment (tenant_id, org_role_id) WHERE kind = 'primary' AND effective_to IS NULL;
-- Aynı rol ve türde tarih aralıkları örtüşemez (A21)
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE accountability_assignment ADD CONSTRAINT ex_accountability_overlap EXCLUDE USING gist (tenant_id WITH =, org_role_id WITH =, kind WITH =, tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz)) WITH &&);

CREATE TABLE role_assignment (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  role_code text NOT NULL CHECK (role_code IN ('executive','hr_admin','hrbp','dept_head','line_manager','action_owner','viewer','enabler_unit','hpw_super_admin','hpw_platform_admin','hpw_program_director','hpw_consultant','hpw_methodologist','hpw_data_analyst','hpw_report_designer','hpw_auditor')),
  hierarchy_group_id uuid,
  unit_id uuid,
  includes_descendants boolean NOT NULL DEFAULT true,
  relationship_type text,
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE delegation (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_person_id uuid NOT NULL,
  to_person_id uuid NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('all','unit','actions')),
  scope_ref jsonb,
  reason text NOT NULL CHECK (reason IN ('leave','vacancy','temporary')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  CHECK (from_person_id <> to_person_id),
  CHECK (approved_by IS NULL OR approved_by <> to_person_id)      -- vekâlet alan kendi vekâletini onaylayamaz
);

CREATE TABLE responsibility_map (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  scope_unit_id uuid,                          -- NULL = tüm organizasyon
  topic text NOT NULL,                         -- boyut, madde veya kaldıraç etiketi
  accountable_unit_id uuid NOT NULL,
  enabling_unit_ids uuid[] NOT NULL DEFAULT '{}',
  authority text NOT NULL DEFAULT 'decision' CHECK (authority IN ('decision','recommendation')),
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

-- ---------- ölçüm
CREATE TABLE survey_cycle (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  rollup_hierarchy_group_id uuid NOT NULL,     -- I-01: tam olarak bir
  confidentiality_threshold int NOT NULL DEFAULT 5,
  comment_threshold int NOT NULL DEFAULT 10,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, organization_id, code),
  FOREIGN KEY (tenant_id, rollup_hierarchy_group_id) REFERENCES hierarchy_group(tenant_id, id)
);

CREATE TABLE survey_source (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('hptw_native','csv','api')),
  source_name text,
  imported_at timestamptz,
  quality_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

-- ---------- enstrüman (ADR-0040): anket-agnostik; şirket boyut çıkarabilir, madde ekleyebilir; sistem sonuç paketinden algılar
CREATE TABLE survey_instrument (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,                          -- HPTW-CBA
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, code)
);
CREATE TABLE instrument_version (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL,
  version text NOT NULL,                       -- 2026-v3
  language text NOT NULL DEFAULT 'tr',
  scoring_rule_version_id uuid NOT NULL,
  reference_instrument_version_id uuid,        -- algılamada kıyaslanan HPTW referansı (boyut çıkarma / özel madde tespiti)
  detection jsonb,                             -- DetectionSummary: çıkarılan boyutlar, özel maddeler, modüller, ölçekler, uyarılar
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, instrument_id, version),
  FOREIGN KEY (tenant_id, instrument_id) REFERENCES survey_instrument(tenant_id, id)
);
CREATE TABLE instrument_dimension (
  tenant_id uuid NOT NULL,
  instrument_version_id uuid NOT NULL,
  code text NOT NULL,                          -- GUR
  name text NOT NULL,
  category text,
  module text NOT NULL CHECK (module IN ('core','engagement','ecosystem','custom')),
  PRIMARY KEY (tenant_id, instrument_version_id, code),
  FOREIGN KEY (tenant_id, instrument_version_id) REFERENCES instrument_version(tenant_id, id)
);
CREATE TABLE instrument_item (
  tenant_id uuid NOT NULL,
  instrument_version_id uuid NOT NULL,
  code text NOT NULL,                          -- GUR-03; takip birimi
  text text NOT NULL,
  text_en text,
  dimension_code text,                         -- NULL: boyutsuz özel madde
  scale text NOT NULL CHECK (scale IN ('likert5_topbox','likert5_mean','nps_0_10','binary','custom')),
  polarity text NOT NULL DEFAULT 'positive' CHECK (polarity IN ('positive','negative')),
  interaction_area text NOT NULL CHECK (interaction_area IN ('work','manager','colleagues','employer_brand','system','self','outcome')),
  responsibility_center text NOT NULL CHECK (responsibility_center IN ('line_manager','team','hr_policy','talent_system','central_function','top_management','employer_brand','outcome','individual')), -- ADR-0041
  origin text NOT NULL CHECK (origin IN ('core','module','custom')),
  lever_tags text[] NOT NULL DEFAULT '{}',
  metric_definition_id uuid,                   -- her madde bir metrik tanımına bağlanır (metric_type='item')
  PRIMARY KEY (tenant_id, instrument_version_id, code),
  FOREIGN KEY (tenant_id, instrument_version_id) REFERENCES instrument_version(tenant_id, id),
  FOREIGN KEY (tenant_id, instrument_version_id, dimension_code) REFERENCES instrument_dimension(tenant_id, instrument_version_id, code)
);
CREATE TABLE instrument_index (
  tenant_id uuid NOT NULL,
  instrument_version_id uuid NOT NULL,
  code text NOT NULL,                          -- WBI, ENG, OVERALL
  name text NOT NULL,
  rule text NOT NULL CHECK (rule IN ('mean_of_items','mean_of_dimensions')),
  purpose text NOT NULL CHECK (purpose IN ('certification','report')),
  PRIMARY KEY (tenant_id, instrument_version_id, code),
  FOREIGN KEY (tenant_id, instrument_version_id) REFERENCES instrument_version(tenant_id, id)
);
CREATE TABLE instrument_index_member (
  tenant_id uuid NOT NULL,
  instrument_version_id uuid NOT NULL,
  index_code text NOT NULL,
  item_code text NOT NULL,
  PRIMARY KEY (tenant_id, instrument_version_id, index_code, item_code),
  FOREIGN KEY (tenant_id, instrument_version_id, index_code) REFERENCES instrument_index(tenant_id, instrument_version_id, code),
  FOREIGN KEY (tenant_id, instrument_version_id, item_code) REFERENCES instrument_item(tenant_id, instrument_version_id, code)
);
-- Sorumluluk merkezi → rol eşlemesi (tenant kurulumunda): varsayılan eşleme domain'de, buradaki kayıt tenant'ın kendi rolüne bağlar
CREATE TABLE responsibility_center_role (
  tenant_id uuid NOT NULL,
  responsibility_center text NOT NULL CHECK (responsibility_center IN ('line_manager','team','hr_policy','talent_system','central_function','top_management','employer_brand','outcome','individual')),
  lever_tag text NOT NULL DEFAULT '*',         -- merkezi fonksiyonda kaldıraca göre (IT, tesis, operasyon planlama, İSG)
  org_role_id uuid,                            -- NULL: birim yöneticisi rolü (birime göre çözülür)
  PRIMARY KEY (tenant_id, responsibility_center, lever_tag)
);
CREATE TABLE benchmark (
  tenant_id uuid NOT NULL,
  cycle_id uuid NOT NULL,
  metric_code text NOT NULL,                   -- madde ya da indeks kodu
  benchmark_set text NOT NULL CHECK (benchmark_set IN ('sector','scale','certified','turkey','custom')),
  value numeric(5,2) NOT NULL,
  PRIMARY KEY (tenant_id, cycle_id, metric_code, benchmark_set)
);

CREATE TABLE metric_definition (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,                        -- NULL = HPTW global katalog
  code text NOT NULL,                          -- TRUST, Q7, ENPS, HPW_INDEX
  metric_type text NOT NULL CHECK (metric_type IN ('item','dimension','index','enps','other')), -- takip (hedef/aksiyon/kanıt/sonuç) yalnız 'item' (ADR-0039)
  dimension text,                              -- madde ise bağlı olduğu boyut
  item_code text,                              -- instrument_item.code (metric_type='item')
  responsibility_center text CHECK (responsibility_center IN ('line_manager','team','hr_policy','talent_system','central_function','top_management','employer_brand','outcome','individual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE scoring_rule_version (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,                          -- HPTW-2026-02
  formula text NOT NULL,                       -- likert5 → (raw−1)/4×100 vb.
  aggregation_method text NOT NULL,            -- respondent_mean, unit_mean_weighted ...
  precision_digits int NOT NULL DEFAULT 2,
  official_source text NOT NULL DEFAULT 'hptw',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE metric_version (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  definition_id uuid NOT NULL,
  version int NOT NULL,
  label text NOT NULL,                         -- ifade / etiket
  scoring_rule_version_id uuid NOT NULL,
  scale_min numeric(6,2), scale_max numeric(6,2),
  comparable_to_previous text CHECK (comparable_to_previous IN ('identical','equivalent','changed')),
  effective_from date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, definition_id, version),
  FOREIGN KEY (tenant_id, definition_id) REFERENCES metric_definition(tenant_id, id),
  FOREIGN KEY (tenant_id, scoring_rule_version_id) REFERENCES scoring_rule_version(tenant_id, id),
  CHECK (version = 1 OR comparable_to_previous IS NOT NULL)   -- I-07
);

CREATE TABLE result (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL,
  source_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  metric_version_id uuid NOT NULL,             -- GUR-03 61 = metric GUR-03 · instrument 2026-v3 · scoring rule HPTW-2026-02
  metric_kind text NOT NULL DEFAULT 'item' CHECK (metric_kind IN ('item','dimension','index')), -- boyut/indeks sonuçları türetilmiştir; resmî değerle mutabakat zorunlu
  raw_score numeric(6,2),
  normalized_score numeric(5,2),
  favorable_pct numeric(5,2),
  n int NOT NULL,
  response_rate numeric(5,4),
  population int,
  aggregation_weight numeric(14,6),          -- HPTW üst skor hesabındaki resmî ağırlık; sonuç dosyasından gelir, türetilmez (ADR-0018)
  suppressed boolean NOT NULL DEFAULT false,
  rollup_source text NOT NULL DEFAULT 'direct' CHECK (rollup_source IN ('direct','rolled_up','derived')),
  quality_flags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  import_batch_id uuid,                        -- ADR-0033: hangi içe alma partisiyle geldi
  revision int NOT NULL DEFAULT 1,             -- düzeltme eski gözlemi silmez; yeni revizyon yazar
  superseded_by uuid,                          -- düzeltilmiş gözlemin yeni kaydı
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, cycle_id, unit_id, metric_version_id, revision),
  FOREIGN KEY (tenant_id, metric_version_id) REFERENCES metric_version(tenant_id, id),
  FOREIGN KEY (tenant_id, unit_id) REFERENCES org_unit(tenant_id, id),
  FOREIGN KEY (tenant_id, cycle_id) REFERENCES survey_cycle(tenant_id, id),
  CHECK (n >= 0),
  CHECK (aggregation_weight IS NULL OR aggregation_weight >= 0),
  CHECK (n >= 5 OR suppressed = true)          -- gizlilik n'den hesaplanır; bayrak yalnız daha kısıtlayıcı olabilir (ADR-0034)
);

-- Baskılanmış değerler istemciye asla gitmez (uygulama katmanı ek olarak zorlar)
-- Yanıt dağılımı: Top Box paketten değil dağılımdan yeniden hesaplanır (T-70); gizli birimde satır yok
CREATE TABLE result_distribution (
  tenant_id uuid NOT NULL,
  result_id uuid NOT NULL,
  option_code text NOT NULL,                   -- '1'..'5' ya da '0'..'10'
  count int NOT NULL CHECK (count >= 0),
  PRIMARY KEY (tenant_id, result_id, option_code),
  FOREIGN KEY (tenant_id, result_id) REFERENCES result(tenant_id, id)
);

CREATE VIEW result_visible WITH (security_invoker = true) AS -- çağıranın RLS'i uygulanır; view sahibi yetkisiyle sızdırmaz
SELECT tenant_id, id, cycle_id, source_id, unit_id, metric_version_id,
       CASE WHEN suppressed THEN NULL ELSE raw_score END AS raw_score,
       CASE WHEN suppressed THEN NULL ELSE normalized_score END AS normalized_score,
       CASE WHEN suppressed THEN NULL ELSE favorable_pct END AS favorable_pct,
       n, response_rate, population, suppressed, rollup_source, quality_flags
FROM result;

-- ---------- içe alma partisi ve düzeltme (ADR-0033): taslakta doğrulanır, tek geçişle yayımlanır; düzeltme eski gözlemi silmez
CREATE TABLE import_batch (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL,
  source_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','validated','published','superseded','failed')),
  file_hash text,
  row_count int, suppressed_count int, quality_flag_count int,
  parent_score_reconciled boolean,             -- T-57: resmî üst skorla mutabakat
  instrument_version_id uuid,                  -- paketten algılanan enstrüman (ADR-0040)
  index_reconciled boolean,                    -- T-72: resmî indeks = madde ortalaması (≤0,15)
  bundle_manifest jsonb,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);
CREATE TABLE correction_run (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  import_batch_id uuid NOT NULL,
  reason text NOT NULL,
  affected_targets uuid[] NOT NULL DEFAULT '{}',      -- önizleme: hangi hedef, onay, projeksiyon ve sonuç etkilenir
  affected_approvals uuid[] NOT NULL DEFAULT '{}',
  affected_outcomes uuid[] NOT NULL DEFAULT '{}',
  state text NOT NULL DEFAULT 'previewed' CHECK (state IN ('previewed','applied','rolled_back')),
  applied_by uuid, applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, import_batch_id) REFERENCES import_batch(tenant_id, id)
);

-- ---------- öncelik değerlendirmesi (v2.2: dört ayrı eksen)
CREATE TABLE priority_assessment (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  metric_version_id uuid NOT NULL,
  metric_kind text NOT NULL DEFAULT 'item' CHECK (metric_kind = 'item'), -- öncelik madde başına (ADR-0039)
  item_code text,
  responsibility_center text,                  -- maddeden; sahipliği belirler
  severity numeric(5,2) NOT NULL,              -- çalışan şiddeti 0–100 (strateji hariç)
  confidence numeric(5,4) NOT NULL,            -- veri güveni 0–1 (şiddeti küçültmez)
  controllability numeric(5,4) NOT NULL,       -- yerel kontrol 0–1 (sahibi belirler)
  workload numeric(5,4) NOT NULL,              -- sahibin yükü 0–1 (zamanlamayı belirler)
  strategic_relevance numeric(5,4) NOT NULL DEFAULT 0, -- yönetim tercihi; şiddete girmez, sıralamayı etkiler (ADR-0017)
  response_n int NOT NULL,                     -- uygunluk kapısı: eşik altı yanıtla sayısal karar yok (A20)
  confidence_label text NOT NULL CHECK (confidence_label IN ('LOW','MEDIUM','HIGH')), -- kullanıcıya yüzde gösterilmez
  need numeric(5,4), trend_risk numeric(5,4), breadth numeric(5,4), relative_gap numeric(5,4), impact_estimate numeric(5,4),
  impact_evidence_grade text CHECK (impact_evidence_grade IN ('A','B','C','D')),
  problem_locality text CHECK (problem_locality IN ('corporate','functional','local','mixed')),
  tier text NOT NULL CHECK (tier IN ('critical','recommended','watch','none','preventive')),
  decision text NOT NULL CHECK (decision IN ('numeric_target_and_actions','validation_required','recommended_target','monitor','no_action')),
  ownership text NOT NULL CHECK (ownership IN ('local','accountable_unit','alternative_owner_or_central_support')),
  owner_unit_id uuid NOT NULL,
  algorithm_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, cycle_id, unit_id, metric_version_id, algorithm_version),
  CHECK (response_n >= 5 OR decision IN ('validation_required','monitor','no_action'))
);

-- ---------- hedef anlamı (ADR-0026): ambition, yerel hedef ve katkı projeksiyonu FİZİKSEL olarak ayrıdır; hiçbiri diğerinden türetilmez
CREATE TABLE corporate_ambition (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL,
  scope_unit_id uuid NOT NULL,                 -- şirket, iş kolu ya da bölge kapsamı
  metric_version_id uuid NOT NULL,
  metric_kind text NOT NULL DEFAULT 'item' CHECK (metric_kind IN ('item','index')), -- istenen değer madde ya da sertifikasyon indeksi üzerinde olabilir; indeks ambition'ı madde hedeflerinin projeksiyonuyla uzlaştırılır
  baseline_score numeric(5,2),
  desired_value numeric(5,2) NOT NULL,         -- yönetimin istediği değer — KOTA DEĞİLDİR, yerel hedef algoritmasına girdi olmaz
  target_date date NOT NULL,
  owner_role_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_reconciliation','supported','gap_decided','unsupported','approved','closed')),
  rationale text,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, metric_version_id) REFERENCES metric_version(tenant_id, id),
  FOREIGN KEY (tenant_id, owner_role_id) REFERENCES org_role(tenant_id, id)
);

CREATE TABLE local_target (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  metric_version_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('numeric','maintain','priority_only','validation_required')),
  baseline_result_id uuid,                     -- yerel veriden üretilir; ambition burada yoktur
  baseline_score numeric(5,2),
  suggested_target numeric(5,2),
  lower_feasible numeric(5,2),
  upper_feasible numeric(5,2),
  approved_target numeric(5,2),
  source text CHECK (source IN ('peer_history','methodologist_band','approved','exception','fixed_member')),
  target_date date,
  owner_role_id uuid NOT NULL,                 -- "şubede sonucu izleyen rol"; kişi accountability_assignment ile çözülür
  intervention_owner_role_id uuid,             -- "bu müdahaleyi yapmaya yetkili rol" (maddenin sorumluluk merkezinden; ADR-0041)
  metric_kind text NOT NULL DEFAULT 'item' CHECK (metric_kind = 'item'), -- takip yalnız madde düzeyinde (ADR-0039)
  item_code text,                              -- denormalize: GUR-03
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','policy_approvable','exception_requires_human','accepted','active','exception_pending','at_risk','under_review','achieved','partial','missed','closed_with_reason','sustain','continue_or_strengthen','redesign_or_root_cause','paused','superseded')),
  approved_exception_id uuid,                  -- geçerli istisna kimliği; aralık dışı onay yalnız bununla (durum adına bağlı değil)
  peer_observation jsonb,                      -- {suggested, upper, sample_size}: gözlemsel kanıt; uzman bandı kararı 'source' ile ayrı
  rationale text,
  lever_tags text[] NOT NULL DEFAULT '{}',
  cohort_id uuid,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, metric_version_id) REFERENCES metric_version(tenant_id, id),
  FOREIGN KEY (tenant_id, owner_role_id) REFERENCES org_role(tenant_id, id),
  FOREIGN KEY (tenant_id, unit_id) REFERENCES org_unit(tenant_id, id),
  FOREIGN KEY (tenant_id, baseline_result_id) REFERENCES result(tenant_id, id),
  CHECK (kind <> 'numeric' OR (suggested_target IS NOT NULL AND lower_feasible IS NOT NULL AND upper_feasible IS NOT NULL AND lower_feasible <= suggested_target AND suggested_target <= upper_feasible AND baseline_score IS NOT NULL)),
  CHECK (kind IN ('numeric','maintain') OR (suggested_target IS NULL AND lower_feasible IS NULL AND upper_feasible IS NULL AND approved_target IS NULL AND baseline_score IS NULL)), -- sayısal olmayan tür sayı taşımaz (A05)
  CHECK (baseline_score IS NULL OR (baseline_score >= 0 AND baseline_score <= 100)),
  CHECK (suggested_target IS NULL OR (suggested_target >= 0 AND suggested_target <= 100)),
  CHECK (approved_target IS NULL OR (approved_target >= 0 AND approved_target <= 100)),
  CHECK (approved_target IS NULL OR (approved_target >= lower_feasible AND approved_target <= upper_feasible) OR approved_exception_id IS NOT NULL)
);
CREATE INDEX ix_local_target_unit_cycle ON local_target (tenant_id, cycle_id, unit_id, metric_version_id);

CREATE TABLE functional_kpi (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL,
  unit_id uuid NOT NULL,                       -- destekleyici birim (Teknoloji, Akademi)
  ambition_id uuid,                            -- hangi ambition'ı destekler; skor aritmetiğine girmez
  title text NOT NULL,                         -- "vardiya sisteminin %95 kapsama ulaşması"
  desired_state text NOT NULL,
  owner_role_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'proposed',
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

-- Türetilmiş, kullanıcı tarafından düzenlenemez, her uzlaştırma koşusunda yeniden üretilir; HEDEF DEĞİLDİR; birim kapsamında gösterilmez
CREATE TABLE contribution_projection (
  tenant_id uuid NOT NULL,
  reconciliation_run_id uuid NOT NULL,
  local_target_id uuid NOT NULL,
  ambition_id uuid NOT NULL,
  frozen_weight numeric(14,6) NOT NULL,
  projected_contribution numeric(6,3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, reconciliation_run_id, local_target_id)
);
CREATE RULE contribution_projection_no_update AS ON UPDATE TO contribution_projection DO INSTEAD NOTHING;

CREATE TABLE target_history (
  tenant_id uuid NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('corporate_ambition','local_target','functional_kpi')),
  target_id uuid NOT NULL,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by uuid,
  acting_for uuid,
  reason text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, target_kind, target_id, version)
);

-- Kapsam ve soy kütüğü ilişkisi: yerel hedef ↔ ambition kapsamı. ARİTMETİK İÇİN DEĞİL; aritmetik yalnız uzlaştırma koşusunda resmî ağırlıkla yapılır
CREATE TABLE target_relationship (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_target_id uuid NOT NULL,              -- corporate_ambition.id
  child_target_id uuid NOT NULL,               -- local_target.id
  child_unit_id uuid NOT NULL,                 -- kanonik kenar kısıtı için denormalize
  relationship_type text NOT NULL CHECK (relationship_type IN ('inherited','contribution','support','local','shared','exception','excluded','monitor','priority_only')),
  contribution_weight numeric(8,6),
  rationale text,
  approval_status text NOT NULL DEFAULT 'proposed' CHECK (approval_status IN ('proposed','approved','rejected')),
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);
-- I-10 / T-07: bir (ambition, child_unit) için aktif kapsam kenarı en fazla bir — BÜTÜN ilişki türlerinde (aritmetik yalnız uzlaştırma koşusunda)
CREATE UNIQUE INDEX ux_target_relationship_canonical ON target_relationship (tenant_id, parent_target_id, child_unit_id)
  WHERE effective_to IS NULL AND approval_status <> 'rejected';

CREATE TABLE target_cohort (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ambition_id uuid NOT NULL,
  cycle_id uuid NOT NULL,
  cohort_policy text NOT NULL CHECK (cohort_policy IN ('BASELINE_FROZEN','CURRENT_ORG_DYNAMIC','LINEAGE_ADJUSTED')),
  snapshot_hash text NOT NULL,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE cohort_member (
  tenant_id uuid NOT NULL,
  cohort_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  relationship_type text NOT NULL,
  inclusion_state text NOT NULL CHECK (inclusion_state IN ('active','no_baseline','suppressed','excluded','monitor','contribution','support')),
  inclusion_reason text,
  aggregation_weight numeric(14,6),            -- resmî toplama ağırlığı (result.aggregation_weight kopyası, dondurulmuş)
  baseline_population int,
  baseline_value numeric(5,2),                 -- baskılanmışsa da saklanır (istemciye gitmez)
  benchmark numeric(5,2),
  trend numeric(6,2),
  confidence numeric(5,4),
  PRIMARY KEY (tenant_id, cohort_id, unit_id),
  CHECK (inclusion_state <> 'no_baseline' OR baseline_value IS NULL)
);

-- v2.2: yeniden üretilebilir uzlaştırma kaydı — "Neden Konak 55 olmuştu?" bir yıl sonra aynı girdiyle cevaplanır
CREATE TABLE target_reconciliation_run (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ambition_id uuid NOT NULL,                   -- corporate_ambition.id
  cohort_id uuid NOT NULL,
  algorithm_version text NOT NULL,
  policy_version text NOT NULL,
  input_snapshot_hash text NOT NULL,
  corporate_ambition numeric(5,2) NOT NULL,
  local_proposals jsonb NOT NULL,              -- [{local_target_id, unit_id, kind, baseline, low, high, target, fixed, source}] — ambition'dan bağımsız üretilmiş; katkılar contribution_projection'da
  official_weights jsonb NOT NULL,             -- {unit_id: aggregation_weight}
  constraints jsonb NOT NULL DEFAULT '[]',     -- onaylı hedef sabit, gizli birim sayısal çıktı vermez, no_baseline aritmetik dışı, kapasite/istisna politikası
  supported_projection numeric(5,2),          -- dondurulmuş kohort + resmî ağırlıkla PROJEKSİYON (gelecek skor tahmini değil)
  upper_scenario numeric(5,2),                 -- mevcut politika ve kaynak varsayımları altındaki üst senaryo (fiziksel tavan değil)
  status text NOT NULL CHECK (status IN ('SUPPORTED','GAP','UNSUPPORTED')),
  hidden_participants uuid[] NOT NULL DEFAULT '{}', -- aritmetiğe giren, sayısı gizli birimler
  gap numeric(5,2) NOT NULL DEFAULT 0,
  stretch_adjustments jsonb,                   -- GAP: [{unit_id, from, to}] — uygulanmaz, karar için sunulur; gizli birimler dahil edilmez
  options text[] NOT NULL DEFAULT '{}',        -- LOWER_AMBITION | ACCEPT_STRETCH_WITHIN_BOUNDS | ADD_CENTRAL_INTERVENTION | CHANGE_TIME_HORIZON
  decision text CHECK (decision IN ('lower_ambition','accept_stretch_within_bounds','add_central_intervention','change_time_horizon')),
  decided_by uuid,
  explanation text[] NOT NULL DEFAULT '{}',
  initiated_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE exception_request (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  local_target_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('no_target','lower_target','later_date','reassign_owner')),
  proposed_value numeric(5,2),
  proposed_date date,
  reason_code text NOT NULL CHECK (reason_code IN ('merger_or_closure','uncontrollable_lever','unrealistic','no_resources','other')),
  justification text,
  requested_by uuid NOT NULL,
  approver_id uuid,
  parent_version_seen int,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','countered','accepted_by_requester','rejected_by_requester')),
  counter_value numeric(5,2),
  decided_at timestamptz,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  CHECK (approver_id IS NULL OR approver_id <> requested_by)   -- I-15 SoD
);

CREATE TABLE responsibility_allocation (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  local_target_id uuid,
  action_id uuid,
  unit_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('accountable','responsible','enabler','contributor')),
  responsibility_share numeric(5,4),           -- 0..1, skor matematiğine girmez (I-11)
  decision_authority boolean NOT NULL DEFAULT false,
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  CHECK ((local_target_id IS NOT NULL) <> (action_id IS NOT NULL))
);

-- ---------- aksiyon
CREATE TABLE action_template (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,                        -- NULL = HPTW kütüphanesi
  code text NOT NULL,
  version int NOT NULL DEFAULT 1,
  title text NOT NULL,
  dimension text NOT NULL,
  item_codes text[] NOT NULL DEFAULT '{}',
  action_type text NOT NULL,
  context_tags text[] NOT NULL DEFAULT '{}',
  expected_impact text CHECK (expected_impact IN ('low','medium','high')),
  effort text CHECK (effort IN ('low','medium','high')),
  cost_band text CHECK (cost_band IN ('none','low','medium','high')),
  time_to_impact_days int,
  owner_role text,
  evidence_level text NOT NULL CHECK (evidence_level IN ('declaration','artifact','attestation','system_data','employee_outcome')),
  evidence_rule jsonb NOT NULL,                -- {rule_type, expected_value, window_days, source}
  target_metric_codes text[] NOT NULL DEFAULT '{}',
  driver_item_codes text[] NOT NULL DEFAULT '{}',
  suitable_unit_types text[] NOT NULL DEFAULT '{}',
  lever text,
  accountable_role_type text,
  preconditions jsonb NOT NULL DEFAULT '{}',   -- {min_team_size}
  contraindications text[] NOT NULL DEFAULT '{}',
  time_to_signal_weeks int,
  observed_association jsonb,                  -- {median_change, sample_size} — yalnız "birlikte gözlendi"; sıralamada son kriter, nedensel değil
  leading_kpis jsonb NOT NULL DEFAULT '[]',
  suggested_duration_days int,
  is_critical boolean NOT NULL DEFAULT false,  -- SoD sert kural için
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, code, version)
);

CREATE TABLE action (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('standalone','master','local_execution')),
  parent_action_id uuid,
  template_id uuid,
  title text NOT NULL,
  description text,
  unit_id uuid NOT NULL,
  owner_role_id uuid,                          -- rol merkezli; kişi accountability_assignment ile
  accountable_role_id uuid,
  lever_tags text[] NOT NULL DEFAULT '{}',
  start_date date,
  due_date date,
  original_due_date date,
  -- Dört ayrı durum ekseni (ADR-0036): yaşam döngüsü, doğrulama, operasyonel sağlık; sonuç outcome_assessment'ta
  lifecycle_state text CHECK (lifecycle_state IN ('planned','in_progress','declared_complete','closed','cancelled','paused','superseded')),
  verification_state text NOT NULL DEFAULT 'pending' CHECK (verification_state IN ('pending','auto_verified','human_verified','partial','needs_review','invalidated')),
  health_state text NOT NULL DEFAULT 'on_track' CHECK (health_state IN ('on_track','at_risk','blocked','overdue')),
  master_revision int,                         -- yerel uygulama, kabul ettiği ana aksiyon sürümüne bağlı kalır (ADR-0033)
  pause_reason text, supersede_reason text, reopen_reason text,
  execution_confidence numeric(5,2),
  cancel_reason text,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  CHECK (kind <> 'master' OR lifecycle_state IS NULL),                 -- I-16: ana aksiyonun tek "tamamlandı" alanı yoktur
  CHECK (kind <> 'local_execution' OR (parent_action_id IS NOT NULL AND master_revision IS NOT NULL)),
  CHECK (kind = 'master' OR lifecycle_state IS NOT NULL),
  CHECK (lifecycle_state IS DISTINCT FROM 'planned' OR verification_state = 'pending'),
  FOREIGN KEY (tenant_id, unit_id) REFERENCES org_unit(tenant_id, id),
  FOREIGN KEY (tenant_id, parent_action_id) REFERENCES action(tenant_id, id)
);
CREATE INDEX ix_action_parent ON action (tenant_id, parent_action_id) WHERE parent_action_id IS NOT NULL;

-- ADR-0033: ana aksiyon sürümü; yerel uygulama kabul ettiği sürüme bağlı kalır, yeni sürüme geçiş bir migrasyon kararıdır
CREATE TABLE master_action_revision (
  tenant_id uuid NOT NULL,
  master_action_id uuid NOT NULL,
  revision int NOT NULL,
  title text NOT NULL,
  evidence_rule jsonb NOT NULL,
  change_note text,
  is_critical_change boolean NOT NULL DEFAULT false, -- kritik değişiklik bildirilir ve onayla taşınır
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, master_action_id, revision),
  FOREIGN KEY (tenant_id, master_action_id) REFERENCES action(tenant_id, id)
);

CREATE TABLE deployment (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  master_action_id uuid NOT NULL,
  master_revision int NOT NULL,
  scope_rule jsonb NOT NULL,                   -- {hierarchy_group, root_unit_id, unit_types[], exclude_unit_ids[]}
  completion_threshold numeric(5,4) NOT NULL DEFAULT 0.95,
  workflow_instance_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, master_action_id, master_revision) REFERENCES master_action_revision(tenant_id, master_action_id, revision)
);
-- Tekil dağıtım iş anahtarı: aynı (ana aksiyon sürümü, birim, gerçekleşme penceresi) için tek yerel uygulama; farklı event_id'lerle gelen aynı iş çoğalmaz
CREATE TABLE deployment_occurrence (
  tenant_id uuid NOT NULL,
  deployment_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  window_start date NOT NULL,
  local_execution_id uuid NOT NULL,
  PRIMARY KEY (tenant_id, deployment_id, unit_id, window_start),
  FOREIGN KEY (tenant_id, deployment_id) REFERENCES deployment(tenant_id, id),
  FOREIGN KEY (tenant_id, local_execution_id) REFERENCES action(tenant_id, id)
);

-- Aksiyon ↔ hedef bağı (çoktan çoğa): yerel hedef ya da fonksiyonel KPI
CREATE TABLE action_objective_link (
  tenant_id uuid NOT NULL,
  action_id uuid NOT NULL,
  objective_kind text NOT NULL CHECK (objective_kind IN ('local_target','functional_kpi')),
  objective_id uuid NOT NULL,
  weight numeric(5,4) NOT NULL CHECK (weight > 0 AND weight <= 1),
  expected_effect text,
  rationale text,
  PRIMARY KEY (tenant_id, action_id, objective_kind, objective_id)
);

CREATE TABLE action_participant (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL,
  person_id uuid,
  unit_id uuid,
  role text NOT NULL CHECK (role IN ('accountable','responsible','contributor','verifier','enabler','informed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  CHECK (person_id IS NOT NULL OR unit_id IS NOT NULL)
);
CREATE UNIQUE INDEX ux_action_single_accountable ON action_participant (tenant_id, action_id) WHERE role = 'accountable';

CREATE TABLE dependency (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL,
  depends_on_type text NOT NULL CHECK (depends_on_type IN ('action','unit','decision')),
  depends_on_ref uuid,
  description text,
  owner_person_id uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','blocked','resolved','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

-- ---------- kanıt
CREATE TABLE evidence_requirement (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL,
  template_version int,
  min_evidence_type text NOT NULL CHECK (min_evidence_type IN ('declaration','artifact','attestation','system_data','employee_outcome')),
  rule_type text NOT NULL CHECK (rule_type IN ('count','duration','attendance','artifact','attestation','system_metric')),
  expected_value numeric(12,2),
  window_start date,
  window_end date,
  source text,
  is_critical boolean NOT NULL DEFAULT false,
  evidence_level text NOT NULL DEFAULT 'E1' CHECK (evidence_level IN ('E0','E1','E2','E3','E4')), -- KURALDAN seçilir, kabulde dondurulur (ADR-0020/0030)
  policy_rule_code text NOT NULL DEFAULT 'sayisal_hedefe_bagli_rutin',
  evidence_policy_version text NOT NULL DEFAULT 'ev-policy-v1',
  evidence_risk numeric(5,2),                  -- yalnız triyaj (inceleme sırası, örneklem); seviye belirlemez
  risk_signals jsonb,                          -- {criticality, reach, cost, gaming_risk, irreversibility, prior_anomaly}
  prefer_system_trace boolean NOT NULL DEFAULT false,
  locked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, action_id)
);

CREATE TABLE evidence (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN ('declaration','artifact','attestation','system_data','employee_outcome')),
  file_hash text,
  occurrence_key text,                         -- (tarih + birim + olay kimliği) gibi tekil gerçekleşme anahtarı; dosya hash'i tek başına olay tanımlamaz (A15)
  unit_id uuid,
  metric_code text,
  metric_period text,
  file_ref text,
  retention_class text,
  evidence_date date,
  metric_value numeric(12,2),
  connector_ref text,
  submitted_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX ix_evidence_hash ON evidence (tenant_id, file_hash) WHERE file_hash IS NOT NULL;
CREATE UNIQUE INDEX ux_evidence_occurrence ON evidence (tenant_id, action_id, occurrence_key) WHERE occurrence_key IS NOT NULL;

CREATE TABLE evidence_verification (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('pending','auto_verified','human_verified','partial','needs_review','invalidated')), -- ADR-0036 doğrulama ekseni; sonradan geçersizleşen kanıt 'invalidated' + iş yeniden açılır, tarihçe silinmez
  rejected_evidence jsonb NOT NULL DEFAULT '[]', -- [{evidence_id, reason}] geçerlilik reddi (wrong_type, undated, out_of_window, duplicate_occurrence, wrong_scope, stale_metric, outcome_not_execution)
  invalidation_reason text,
  route text CHECK (route IN ('auto','none_unless_exception','connector_or_human','human_review','sample_audit')),
  coverage numeric(5,4),
  score numeric(5,2),
  confidence text CHECK (confidence IN ('HIGH','MEDIUM','LOW')),
  anomaly_flags text[] NOT NULL DEFAULT '{}',
  verifier_person_id uuid,
  decision_reason text,
  decided_at timestamptz,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

-- ---------- sonuç değerlendirme (ADR-0027): uygulama ≠ sonuç ≠ atıf; nedensellik iddiası şema düzeyinde yasak
CREATE TABLE outcome_assessment (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  local_target_id uuid NOT NULL,
  followup_cycle_id uuid NOT NULL,
  baseline numeric(5,2),
  followup numeric(5,2),
  observed_change numeric(6,2),                -- yalnız gözlenen değişim; etki değil
  attainment text NOT NULL CHECK (attainment IN ('ACHIEVED','PARTIAL','MISSED','NOT_EVALUATED')),
  movement_class text NOT NULL CHECK (movement_class IN ('strong_improvement','limited_improvement','no_change','deterioration','insufficient_measurement')),
  execution_status_at_followup text,
  verification_status_at_followup text,
  comparability_level text CHECK (comparability_level IN ('HIGH','MEDIUM','LOW')),
  comparability_status text CHECK (comparability_status IN ('auto_valid','review_required','not_comparable')),
  status text NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('EVALUATED','PENDING_REVIEW','NOT_COMPARABLE')),
  observed_above_target boolean,               -- gözlem ayrı: "hedef üzerinde" ≠ "hedef doğrulandı"
  comparability_review_id uuid,                -- review_required için zorunlu; aynı sonuç ve karşılaştırılabilirlik sürümünü referans gösterir
  result_revision int,
  comparability_version text,
  attribution_evidence_grade text NOT NULL CHECK (attribution_evidence_grade IN ('A','B','C','D')), -- C = zamansal ilişki, nedensellik kanıtlanmadı
  attribution_design_record_id uuid,           -- A/B yalnız kayıtlı tasarım + karşılaştırma grubu + inceleme ile
  estimated_effect numeric(6,2),               -- yalnız A/B
  external_factors jsonb NOT NULL DEFAULT '[]',
  decision text CHECK (decision IN ('close','sustain','continue','strengthen','redesign','root_cause')),
  causal_claim boolean NOT NULL DEFAULT false CHECK (causal_claim = false), -- I-26
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, local_target_id, followup_cycle_id),
  CHECK (estimated_effect IS NULL OR attribution_evidence_grade IN ('A','B')),
  CHECK (attribution_evidence_grade IN ('C','D') OR attribution_design_record_id IS NOT NULL),
  CHECK (status = 'EVALUATED' OR attainment = 'NOT_EVALUATED')
);

-- Metodolog incelemesi (ADR-0035): review_required + geçerli onay yok → kesin sonuç yok
CREATE TABLE comparability_review (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  local_target_id uuid NOT NULL,
  followup_cycle_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('comparable','comparable_labeled','not_comparable')),
  comparability_version text NOT NULL,
  result_revision int NOT NULL,
  reviewed_by uuid NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  invalidated_at timestamptz,                  -- sonuç düzeltilince eski onay geçersizleşir
  PRIMARY KEY (tenant_id, id)
);

-- ---------- ifşa kararları (ADR-0029): gizlilik bir yanıt üretim politikasıdır; her karar denetim izine yazılır
CREATE TABLE disclosure_decision (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  viewer_person_id uuid NOT NULL,
  output_type text NOT NULL CHECK (output_type IN ('score','baseline','target','target_range','delta','contribution','rank','benchmark_gap','explanation_numeric','response_rate','comment','action_rationale','export')),
  query_context jsonb NOT NULL,                -- {unit_ids, filters, hierarchy_group}
  allowed boolean NOT NULL,
  reason text NOT NULL CHECK (reason IN ('ok','suppressed_unit','secondary_suppression','differencing','contribution_unit_scope','comment_threshold')),
  decided_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX ix_disclosure_viewer ON disclosure_decision (tenant_id, viewer_person_id, decided_at);

-- ---------- yürütme
CREATE TABLE check_in (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('action','local_target')),
  subject_id uuid NOT NULL,
  progress_pct numeric(5,2),
  confidence text CHECK (confidence IN ('high','medium','low')),
  note text,
  by_person_id uuid NOT NULL,
  acting_for uuid,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

-- ---------- dikkat ve audit
CREATE TABLE attention_item (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  audience_person_id uuid,
  audience_role text,
  item_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  rule_code text,
  dedupe_key text NOT NULL,                    -- kural + nesne + koşul + gün (I-30)
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','acknowledged','resolved','dismissed','escalated')),
  sla_due_at timestamptz,
  resolved_by uuid,
  resolved_at timestamptz,
  dismiss_reason text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, dedupe_key)
);

CREATE TABLE audit_event (
  tenant_id uuid NOT NULL,
  id bigserial,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  actor_ref uuid,                              -- Person referansı; kişisel veri yok (I-33)
  acting_for_ref uuid,
  reason text,
  correlation_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);
-- append-only
CREATE RULE audit_event_no_update AS ON UPDATE TO audit_event DO INSTEAD NOTHING;
CREATE RULE audit_event_no_delete AS ON DELETE TO audit_event DO INSTEAD NOTHING;

-- ---------- komut / olay altyapısı
CREATE TABLE command_log (
  tenant_id uuid NOT NULL,
  command_id uuid NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid,
  expected_version int,
  actor_ref uuid,
  acting_for_ref uuid,
  correlation_id text,
  causation_id text,
  response_status int NOT NULL,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, command_id)
);

CREATE TABLE outbox_event (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version int,
  correlation_id text,
  causation_id text,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  PRIMARY KEY (tenant_id, event_id)
);
CREATE INDEX ix_outbox_unpublished ON outbox_event (occurred_at) WHERE published_at IS NULL;

CREATE TABLE processed_event (
  tenant_id uuid NOT NULL,
  consumer text NOT NULL,
  event_id uuid NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, consumer, event_id)
);

CREATE TABLE dead_letter (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  consumer text NOT NULL,
  event_id uuid NOT NULL,
  attempts int NOT NULL,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

-- ---------- süreç yürütücü (Faz 0 Postgres)
CREATE TABLE workflow_instance (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  definition_code text NOT NULL,               -- reorg_transfer, evidence_review, bulk_import, deployment ...
  definition_version int NOT NULL DEFAULT 1,
  entity_type text,
  entity_id uuid,
  state text NOT NULL DEFAULT 'created' CHECK (state IN ('created','running','waiting','completed','failed_step','incident','compensated','cancelled')),
  current_step text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE workflow_step (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL,
  step_code text NOT NULL,
  item_ref text,                               -- öğe bazında adım (ör. unit_id)
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed','skipped')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, instance_id, idempotency_key)
);

CREATE TABLE workflow_timer (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL,
  timer_code text NOT NULL,
  fire_at timestamptz NOT NULL,
  fired_at timestamptz,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX ix_workflow_timer_due ON workflow_timer (fire_at) WHERE fired_at IS NULL;

CREATE TABLE workflow_incident (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL,
  step_id uuid,
  reason text NOT NULL,
  retries_exhausted boolean NOT NULL DEFAULT true,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

-- ---------- veri yaşam döngüsü (tablolar Faz 0, akışlar Faz 2)
CREATE TABLE data_retention_policy (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  data_class text NOT NULL,                    -- evidence_artifact, audit, result, person
  retention_days int NOT NULL,
  action text NOT NULL CHECK (action IN ('delete','anonymize')),
  legal_basis text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, data_class)
);

CREATE TABLE legal_hold (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  scope_type text NOT NULL,
  scope_ref uuid,
  reason text NOT NULL,
  placed_by uuid NOT NULL,
  placed_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE deletion_request (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_person_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','blocked_by_hold','executing','completed','rejected')),
  record jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE data_transfer_register (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  connector_code text NOT NULL,
  destination text NOT NULL,
  legal_basis text NOT NULL,
  standard_contract_ref text,
  notified_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

-- ---------- RLS: her tablo (tenant hariç)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'tenant' AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped) LOOP -- yalnız tenant_id taşıyan tablolar (migrasyon defteri gibi altyapı tabloları hariç)
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO hpw_app', t);
  END LOOP;
END $$;
-- tenant tablosu: uygulama yalnız kendi tenant satırını okur
ALTER TABLE tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_self ON tenant USING (id = app_tenant_id());
GRANT SELECT ON tenant TO hpw_app;
-- En az yetki (ADR-0034): API rolü ham result'ı okuyamaz, yalnız gizlilik uygulanmış görünümü; ham okuma iç analiz worker'ına (hpw_worker), o da API dışına veri vermez
REVOKE SELECT ON result FROM hpw_app;
GRANT SELECT ON result_visible TO hpw_app;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hpw_worker') THEN CREATE ROLE hpw_worker NOBYPASSRLS NOLOGIN; END IF; END $$;
GRANT SELECT, INSERT ON result, priority_assessment, target_reconciliation_run, contribution_projection, import_batch, correction_run TO hpw_worker;
GRANT SELECT ON org_unit, org_relationship, org_closure, survey_cycle, metric_version, target_cohort, cohort_member, local_target, corporate_ambition TO hpw_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hpw_app;
