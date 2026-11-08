-- v2.13.0: Hedefler ekranında isteğe bağlı "Yapay zekâdan yardım al" (AI Hedef ve Aksiyon Planı).
-- Yeni paralel hedef/aksiyon sistemi YOK: plan mevcut yerel hedefe (local_target) bağlıdır; aksiyon yalnız mevcut aksiyon ucundan,
-- kullanıcının açık eylemiyle ve mevcut kurallarla (kabul edilmiş hedef, birim başına etkin aksiyon sınırı, yetki) açılır.
-- Yayımlanmış migrasyonlar değiştirilmez; yalnız bu ileri migrasyon eklenir.

-- Şirket bazında yapay zekâ sağlayıcı bağlantısı. Anahtar sunucuda AES-256-GCM ile mühürlüdür; mühür şirket kimliğine bağlıdır
-- (ek doğrulanmış veri: tenant_id) — A şirketinin mührü B şirketinde açılamaz. Düz anahtar hiçbir yanıtta ve günlükte yer almaz.
CREATE TABLE IF NOT EXISTS tenant_ai_config (
  tenant_id uuid PRIMARY KEY REFERENCES tenant(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'openai' CHECK (provider = 'openai'),
  key_sealed text NOT NULL,
  key_last4 text NOT NULL CHECK (length(key_last4) = 4),
  updated_by uuid NOT NULL REFERENCES app_user(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Üretilmiş planlar: yalnız sunucu şema doğrulamasından (ve hedef aralığı denetiminden) geçen çıktı kaydedilir.
-- fingerprint: bağlam paketi + istem sürümü + model + şema sürümü özeti; aynı parmak izi yeni çağrı üretmez.
CREATE TABLE IF NOT EXISTS ai_plan (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL,
  cycle_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  item_code text NOT NULL,
  fingerprint text NOT NULL,
  prompt_version text NOT NULL,
  schema_version text NOT NULL,
  model text NOT NULL,
  output jsonb NOT NULL,
  data_used jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, target_id) REFERENCES local_target(tenant_id, id),
  FOREIGN KEY (tenant_id, unit_id) REFERENCES org_unit(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS ai_plan_target_idx ON ai_plan (tenant_id, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_plan_fingerprint_idx ON ai_plan (tenant_id, target_id, fingerprint, created_at DESC); -- planlar değişmez: açık yeniden oluşturma yeni satır ekler (geçmiş korunur)

-- Çağrı günlüğü: yalnız sonuç sınıfı ve süre; istek/yanıt içeriği ve anahtar yazılmaz.
CREATE TABLE IF NOT EXISTS ai_call_log (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL,
  requested_by uuid NOT NULL REFERENCES app_user(id),
  fingerprint text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('ok','cached','invalid_output','range_violation','refusal','timeout','provider_error','not_configured')),
  latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, target_id) REFERENCES local_target(tenant_id, id)
);

-- Plandan açılan aksiyonlar: aynı plan aksiyonu ikinci kez açılamaz; aksiyonun kendisi mevcut aksiyon tablosundadır.
CREATE TABLE IF NOT EXISTS ai_plan_action (
  tenant_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  action_index int NOT NULL CHECK (action_index BETWEEN 0 AND 2),
  action_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, plan_id, action_index),
  FOREIGN KEY (tenant_id, plan_id) REFERENCES ai_plan(tenant_id, id),
  FOREIGN KEY (tenant_id, action_id) REFERENCES action(tenant_id, id)
);

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['tenant_ai_config','ai_plan','ai_call_log','ai_plan_action'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())', t);
END LOOP; END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_ai_config TO hpw_app;
GRANT SELECT, INSERT ON ai_plan TO hpw_app;
GRANT SELECT, INSERT ON ai_call_log TO hpw_app;
GRANT SELECT, INSERT ON ai_plan_action TO hpw_app;
