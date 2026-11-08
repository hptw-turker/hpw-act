-- v2.15.0: Sunumla birebir yol haritası (rapor planı) — HPTW birim raporundaki yol haritası bölümünün HPW Act'te takip edilen karşılığı.
-- Kaynak: "Yol haritası formu" (HPW_Act_roadmap_sablonu.xlsx) mevcut içe alım hattıyla (doğrula → önizle → onayla) yüklenir.
-- Sunumdaki metin ve sayılar AYNEN saklanır; HPW Act bunları yeniden hesaplamaz. Takip edilen nesneler: eylem planı adımları (İK ve birim yönetimi)
-- ve eylem planı takvim kilometre taşları. Çalışan alıntıları bu tablolara hiçbir biçimde girmez (formda alan yoktur).
-- Mevcut madde bazlı hedef/aksiyon/kanıt sistemi DEĞİŞMEZ; bu tablolar ona bağlı değildir. Yayımlanmış migrasyonlar değiştirilmez.

ALTER TABLE import_job DROP CONSTRAINT IF EXISTS import_job_kind_check;
ALTER TABLE import_job ADD CONSTRAINT import_job_kind_check CHECK (kind IN ('org','users','instrument','results','roadmap'));

-- Bir birimin bir dönemdeki yol haritası (sunumun yol haritası bölümü). Yeni yükleme eskisini 'superseded' yapar; geçmiş korunur.
CREATE TABLE IF NOT EXISTS roadmap (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  import_job_id uuid,
  report_title text NOT NULL,
  company_label text NOT NULL,
  unit_label text NOT NULL,
  sector_label text,
  start_date date NOT NULL,
  content jsonb NOT NULL,                 -- sunumdaki gösterim bölümleri (ana sonuç, güçlü yönler, öncelikler, gündem, roller, takvim, izleme)
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, unit_id) REFERENCES org_unit(tenant_id, id),
  FOREIGN KEY (tenant_id, cycle_id) REFERENCES survey_cycle(tenant_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS roadmap_active_uq ON roadmap (tenant_id, cycle_id, unit_id) WHERE status = 'active';

-- Sunumdaki eylem planı (konu). Sayılar sunumdaki değerlerdir.
CREATE TABLE IF NOT EXISTS roadmap_plan (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  roadmap_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  plan_no int NOT NULL CHECK (plan_no BETWEEN 1 AND 20),
  theme_no int,
  title text NOT NULL,
  headline text NOT NULL,
  mentions int CHECK (mentions IS NULL OR mentions >= 0),
  commenters int CHECK (commenters IS NULL OR commenters >= 0),
  data_note text,
  indicators jsonb NOT NULL DEFAULT '[]',
  measure jsonb NOT NULL DEFAULT '{}',     -- {label, itemCode, current, company, target, rule, text}
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, roadmap_id, plan_no),
  FOREIGN KEY (tenant_id, roadmap_id) REFERENCES roadmap(tenant_id, id),
  FOREIGN KEY (tenant_id, unit_id) REFERENCES org_unit(tenant_id, id)
);

-- Eylem planı adımı: sunumdaki rol sütunlarının her maddesi. İK ve birim yönetimi adımları takip edilir; çalışan adımları yalnız gösterilir.
CREATE TABLE IF NOT EXISTS roadmap_step (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  roadmap_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  role_code text NOT NULL CHECK (role_code IN ('IK','YONETIM','CALISAN')),
  role_label text NOT NULL,
  ord int NOT NULL CHECK (ord BETWEEN 1 AND 50),
  text text NOT NULL,
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED','IN_PROGRESS','DONE')),
  note text CHECK (note IS NULL OR length(note) <= 1000),
  updated_by uuid,
  status_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, plan_id, role_code, ord),
  CHECK (role_code <> 'CALISAN' OR status = 'NOT_STARTED'),
  FOREIGN KEY (tenant_id, roadmap_id) REFERENCES roadmap(tenant_id, id),
  FOREIGN KEY (tenant_id, plan_id) REFERENCES roadmap_plan(tenant_id, id),
  FOREIGN KEY (tenant_id, unit_id) REFERENCES org_unit(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS roadmap_step_unit_idx ON roadmap_step (tenant_id, unit_id, role_code);

-- Eylem planı takvimi: "İlk 30 gün / İlk 90 gün / 6 ay" kilometre taşları; termin = yol haritası başlangıcı + gün.
CREATE TABLE IF NOT EXISTS roadmap_milestone (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  roadmap_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  ord int NOT NULL CHECK (ord BETWEEN 1 AND 20),
  phase_label text NOT NULL,
  due_days int NOT NULL CHECK (due_days BETWEEN 1 AND 1095),
  due_date date NOT NULL,
  text text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','DONE')),
  note text CHECK (note IS NULL OR length(note) <= 1000),
  updated_by uuid,
  status_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, plan_id, ord),
  FOREIGN KEY (tenant_id, roadmap_id) REFERENCES roadmap(tenant_id, id),
  FOREIGN KEY (tenant_id, plan_id) REFERENCES roadmap_plan(tenant_id, id),
  FOREIGN KEY (tenant_id, unit_id) REFERENCES org_unit(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS roadmap_milestone_unit_idx ON roadmap_milestone (tenant_id, unit_id, due_date);

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['roadmap','roadmap_plan','roadmap_step','roadmap_milestone'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())', t);
END LOOP; END $$;
-- İçerik değişmez: yalnız durum alanları güncellenebilir (sütun düzeyi yetki); yol haritası yalnız 'superseded' yapılabilir.
GRANT SELECT, INSERT ON roadmap, roadmap_plan, roadmap_step, roadmap_milestone TO hpw_app;
GRANT UPDATE (status, updated_at, version) ON roadmap TO hpw_app;
GRANT UPDATE (status, note, updated_by, status_at, updated_at, version) ON roadmap_step TO hpw_app;
GRANT UPDATE (status, note, updated_by, status_at, updated_at, version) ON roadmap_milestone TO hpw_app;
