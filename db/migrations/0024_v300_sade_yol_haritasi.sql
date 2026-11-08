-- v3.0.0 (ADR-0043): Sade HPW Act — raporun yol haritasının takibi. Kurum + işletme katmanı; hedef rapordan gelir; adım durumu ikili.
-- Eklemeli migrasyon: v2.x tabloları (roadmap*, hedef/aksiyon/kanıt vb.) DEĞİŞMEZ ve silinmez; kapalı modüller kodda anahtarla kapatılır.
-- Kaynak: "Yol haritası dosyası" (yh-2) içe alım hattıyla (doğrula → önizle → onayla) yüklenir. Çalışan alıntıları bu tablolara girmez.

ALTER TABLE import_job DROP CONSTRAINT IF EXISTS import_job_kind_check;
ALTER TABLE import_job ADD CONSTRAINT import_job_kind_check CHECK (kind IN ('org','users','instrument','results','roadmap','roadmap2'));

-- Bir birimin (kurum = kök birim ya da işletme) bir dönemdeki yol haritası. Yeni yükleme eskisini 'superseded' yapar.
CREATE TABLE IF NOT EXISTS rm2_roadmap (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  layer text NOT NULL CHECK (layer IN ('KURUM','ISLETME')),
  import_job_id uuid,
  report_title text NOT NULL,
  unit_label text NOT NULL,
  respondents int CHECK (respondents IS NULL OR respondents >= 0),
  comparison_label text,
  headline text,
  summary text,
  start_date date NOT NULL,
  measure_period text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, unit_id) REFERENCES org_unit(tenant_id, id),
  FOREIGN KEY (tenant_id, cycle_id) REFERENCES survey_cycle(tenant_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS rm2_roadmap_active_uq ON rm2_roadmap (tenant_id, cycle_id, unit_id) WHERE status = 'active';

-- Eylem planı: tek anket maddesi; hedef olumlu yanıt sayısıyla (hedef kesri) ya da 'IZLENIR'.
CREATE TABLE IF NOT EXISTS rm2_plan (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  roadmap_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  plan_no int NOT NULL CHECK (plan_no BETWEEN 1 AND 20),
  title text NOT NULL,
  item_code text NOT NULL,
  item_text text NOT NULL,
  respondents int CHECK (respondents IS NULL OR respondents > 0),
  current_pos int CHECK (current_pos IS NULL OR current_pos >= 0),
  current_pct numeric(5,2) CHECK (current_pct IS NULL OR current_pct BETWEEN 0 AND 100),
  comparison_pct numeric(5,2) CHECK (comparison_pct IS NULL OR comparison_pct BETWEEN 0 AND 100),
  target_kind text NOT NULL CHECK (target_kind IN ('HEDEF','IZLENIR')),
  target_pos int CHECK (target_pos IS NULL OR target_pos >= 0),
  target_pct numeric(5,2) CHECK (target_pct IS NULL OR target_pct BETWEEN 0 AND 100),
  responsibility text,
  impact_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, roadmap_id, plan_no),
  FOREIGN KEY (tenant_id, roadmap_id) REFERENCES rm2_roadmap(tenant_id, id),
  FOREIGN KEY (tenant_id, unit_id) REFERENCES org_unit(tenant_id, id),
  CHECK (target_kind = 'IZLENIR' OR (target_pos IS NOT NULL AND respondents IS NOT NULL AND current_pos IS NOT NULL AND target_pos > current_pos AND target_pos <= respondents))
);

-- Adım: rol, aşama (30/90/180 gün), metin, çıktı; durum ikili. Çalışan adımı işaretlenmez. Atıf: kurum adımına bağlı İK satırı.
CREATE TABLE IF NOT EXISTS rm2_step (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  roadmap_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  role_code text NOT NULL CHECK (role_code IN ('IK','YONETIM','CALISAN')),
  role_label text NOT NULL,
  phase_days int NOT NULL CHECK (phase_days IN (30,90,180)),
  ord int NOT NULL CHECK (ord BETWEEN 1 AND 50),
  text text NOT NULL,
  output text,
  contribution text,
  ref_label text,
  ref_step_id uuid,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'NOT_DONE' CHECK (status IN ('NOT_DONE','DONE')),
  note text CHECK (note IS NULL OR length(note) <= 1000),
  updated_by uuid,
  status_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, plan_id, role_code, phase_days, ord),
  FOREIGN KEY (tenant_id, roadmap_id) REFERENCES rm2_roadmap(tenant_id, id),
  FOREIGN KEY (tenant_id, plan_id) REFERENCES rm2_plan(tenant_id, id),
  FOREIGN KEY (tenant_id, unit_id) REFERENCES org_unit(tenant_id, id),
  CHECK (role_code <> 'CALISAN' OR status = 'NOT_DONE'),
  CHECK (ref_step_id IS NULL OR status = 'NOT_DONE')
);
CREATE INDEX IF NOT EXISTS rm2_step_unit_idx ON rm2_step (tenant_id, unit_id, due_date);
CREATE INDEX IF NOT EXISTS rm2_step_ref_idx ON rm2_step (tenant_id, ref_step_id);

-- İzlenen anket maddeleri (raporun "izleme göstergeleri" tablosu) ve bir sonraki ölçümün değeri.
CREATE TABLE IF NOT EXISTS rm2_item (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  roadmap_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  ord int NOT NULL CHECK (ord BETWEEN 1 AND 50),
  item_code text NOT NULL,
  item_text text NOT NULL,
  link_label text,
  current_pct numeric(5,2),
  comparison_pct numeric(5,2),
  sector_pct numeric(5,2),
  target_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, roadmap_id, ord),
  FOREIGN KEY (tenant_id, roadmap_id) REFERENCES rm2_roadmap(tenant_id, id),
  FOREIGN KEY (tenant_id, unit_id) REFERENCES org_unit(tenant_id, id)
);

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['rm2_roadmap','rm2_plan','rm2_step','rm2_item'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())', t);
END LOOP; END $$;
-- İçerik değişmez: yalnız adım durumu güncellenir; yol haritası yalnız 'superseded' yapılabilir; atıf, yükleme sırasında bir kez bağlanır.
GRANT SELECT, INSERT ON rm2_roadmap, rm2_plan, rm2_step, rm2_item TO hpw_app;
GRANT UPDATE (status, updated_at, version) ON rm2_roadmap TO hpw_app;
GRANT UPDATE (status, note, updated_by, status_at, updated_at, version) ON rm2_step TO hpw_app;

-- Şirkete özel giriş adresi (/g/<şirket kodu>): oturumsuz, yalnız etkin şirketin kodu ve adı döner (marka başlığı için). Başka bilgi taşımaz.
CREATE OR REPLACE FUNCTION auth_tenant_by_code(p_code text) RETURNS TABLE (tenant_code text, tenant_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT t.code, t.name FROM tenant t WHERE t.code = p_code AND t.status = 'active' $$;
REVOKE ALL ON FUNCTION auth_tenant_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_tenant_by_code(text) TO hpw_app;
