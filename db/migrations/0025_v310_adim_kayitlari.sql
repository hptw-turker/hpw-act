-- v3.1.0 (R-05…R-09): adım kayıtları — not, gelişme, engel / engel kalktı, yapıldı / geri alındı, dosya. Eklemeli migrasyon; mevcut tablolar ve veriler değişmez.
-- Kayıtlar yalnız eklenir (UPDATE/DELETE yetkisi yok): önceki not, engel ve işaretleme geçmişi korunur. Engel durumu kayıtlardan türetilir:
-- açık engel = 'BLOCKER' kaydı olup ona bağlı 'UNBLOCK' kaydı bulunmayan. Engel, adımın Yapıldı/Yapılmadı durumundan ve termininden bağımsızdır.

CREATE TABLE IF NOT EXISTS rm2_step_record (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  step_id uuid NOT NULL,
  roadmap_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('NOTE','PROGRESS','BLOCKER','UNBLOCK','DONE','UNDO','FILE')),
  body text CHECK (body IS NULL OR length(body) <= 2000),
  blocker_id uuid,                                   -- yalnız UNBLOCK: kaldırılan engel kaydı
  created_by uuid,                                   -- eski notlar aktarılırken işaretleyen bilinmiyorsa boş kalabilir
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'app' CHECK (source IN ('app','v300_note','v300_status')),
  updated_at timestamptz NOT NULL DEFAULT now(),     -- proje kuralı; kayıt yalnız eklendiği için created_at ile aynı kalır
  version int NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, step_id) REFERENCES rm2_step(tenant_id, id),
  FOREIGN KEY (tenant_id, roadmap_id) REFERENCES rm2_roadmap(tenant_id, id),
  FOREIGN KEY (tenant_id, unit_id) REFERENCES org_unit(tenant_id, id),
  FOREIGN KEY (tenant_id, blocker_id) REFERENCES rm2_step_record(tenant_id, id),
  -- engel bildirimi ve çözüm notu açıklamasız olamaz; engel kalktı kaydı hangi engelin kalktığını taşır
  CHECK (kind NOT IN ('BLOCKER','UNBLOCK') OR (body IS NOT NULL AND length(btrim(body)) > 0)),
  CHECK ((kind = 'UNBLOCK') = (blocker_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS rm2_step_record_step_idx ON rm2_step_record (tenant_id, step_id, created_at);
-- bir engel yalnız bir kez kaldırılır (eşzamanlı iki kaldırma isteğinden biri reddedilir)
CREATE UNIQUE INDEX IF NOT EXISTS rm2_step_record_unblock_uq ON rm2_step_record (tenant_id, blocker_id) WHERE kind = 'UNBLOCK';

-- Kayda bağlı dosya: içerik veritabanında değil, sunucudaki kalıcı dosya deposunda (HPW_FILE_DIR/<şirket>/<rastgele anahtar>) durur.
CREATE TABLE IF NOT EXISTS rm2_step_file (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL,
  step_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 200),
  mime text NOT NULL,
  size_bytes int NOT NULL CHECK (size_bytes > 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  storage_key text NOT NULL CHECK (storage_key ~ '^[0-9a-f-]{36}$'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, storage_key),
  FOREIGN KEY (tenant_id, record_id) REFERENCES rm2_step_record(tenant_id, id),
  FOREIGN KEY (tenant_id, step_id) REFERENCES rm2_step(tenant_id, id),
  FOREIGN KEY (tenant_id, unit_id) REFERENCES org_unit(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS rm2_step_file_record_idx ON rm2_step_file (tenant_id, record_id);

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['rm2_step_record','rm2_step_file'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())', t);
END LOOP; END $$;
GRANT SELECT, INSERT ON rm2_step_record, rm2_step_file TO hpw_app;

-- Yol haritası yeniden yüklendiğinde aynı adım yeni bir satır olur (durum taşınır). Kayıt geçmişinin de görünmesi için yeni satır öncekine bağlanır;
-- kayıtlar kopyalanmaz, zincir üzerinden okunur. Sütun yalnız yükleme sırasında bir kez yazılır (UPDATE yetkisi verilmez).
ALTER TABLE rm2_step ADD COLUMN IF NOT EXISTS carried_from uuid;
CREATE INDEX IF NOT EXISTS rm2_step_carried_idx ON rm2_step (tenant_id, carried_from);

-- Mevcut verinin korunması: v3.0.0'da adımla birlikte kaydedilmiş notlar ve Yapıldı işaretleri kayıt geçmişine bir kez aktarılır.
-- rm2_step.note sütunu değişmez (silinmez, üzerine yazılmaz); v3.1.0 kodu o sütuna artık yazmaz.
INSERT INTO rm2_step_record (tenant_id, step_id, roadmap_id, unit_id, kind, body, created_by, created_at, source)
SELECT s.tenant_id, s.id, s.roadmap_id, s.unit_id, 'DONE', NULL, s.updated_by, COALESCE(s.status_at, s.updated_at), 'v300_status'
FROM rm2_step s WHERE s.status = 'DONE' AND NOT EXISTS (SELECT 1 FROM rm2_step_record x WHERE x.tenant_id = s.tenant_id AND x.step_id = s.id AND x.source = 'v300_status');
INSERT INTO rm2_step_record (tenant_id, step_id, roadmap_id, unit_id, kind, body, created_by, created_at, source)
SELECT s.tenant_id, s.id, s.roadmap_id, s.unit_id, 'NOTE', left(s.note, 2000), s.updated_by, COALESCE(s.status_at, s.updated_at) + interval '1 millisecond', 'v300_note'
FROM rm2_step s WHERE s.note IS NOT NULL AND length(btrim(s.note)) > 0 AND NOT EXISTS (SELECT 1 FROM rm2_step_record x WHERE x.tenant_id = s.tenant_id AND x.step_id = s.id AND x.source = 'v300_note');
