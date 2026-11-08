-- HPW Act — 0002: çalışan ürün dilimi (v2.5). Kimlik, üyelik, oturum, davet, e-posta kuyruğu, içe alma işi, tenant kataloğu (birim tipi, unvan), enstrüman puanlama, sonuç yayın işaretçisi.
-- Kurallar: hiçbir rol BYPASSRLS değil; her tenant tablosu FORCE RLS; platform alanı yalnız app.realm='platform' ve yetkili müşteri listesiyle.

CREATE OR REPLACE FUNCTION app_realm() RETURNS text LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('app.realm', true), ''), 'customer') $$;
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;

-- ---------- tenant kimliği
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'tr';
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Istanbul';
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS default_login text NOT NULL DEFAULT 'LOCAL_PASSWORD' CHECK (default_login IN ('LOCAL_PASSWORD','SSO'));
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended'));
CREATE UNIQUE INDEX IF NOT EXISTS ux_tenant_code ON tenant (code);
-- platform alanı tenant listesini görür (yetkili liste platform_tenant_access ile)
CREATE TABLE platform_tenant_access (
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

-- ---------- kimlik (global; tenant'a üyelikle bağlanır)
CREATE TABLE app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_norm text GENERATED ALWAYS AS (lower(email)) STORED,
  display_name text NOT NULL,
  realm text NOT NULL DEFAULT 'customer' CHECK (realm IN ('customer','platform')),
  password_hash text,                          -- scrypt; NULL = parola henüz belirlenmedi (davet bekliyor)
  locale text NOT NULL DEFAULT 'tr',
  timezone text NOT NULL DEFAULT 'Europe/Istanbul',
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','disabled')),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_app_user_email ON app_user (email_norm);

CREATE TABLE membership (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id),
  permission_profile text NOT NULL CHECK (permission_profile IN ('HR_ADMIN','HR_PARTNER','EXEC','REGION_MANAGER','UNIT_MANAGER','ACTION_OWNER','VIEWER')),
  scope_unit_id uuid,                          -- kapsam kökü (NULL = bütün şirket; yalnız HR_ADMIN/EXEC/VIEWER için)
  person_id uuid,                              -- org kişisi (rol atamaları buradan)
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, user_id),
  FOREIGN KEY (tenant_id) REFERENCES tenant(id)
);

CREATE TABLE session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES app_user(id),
  realm text NOT NULL,
  tenant_id uuid,                              -- müşteri oturumu: üyelik tenant'ı; platform: seçili tenant (değiştirilebilir)
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- davet ve e-posta kuyruğu
CREATE TABLE invitation (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id),
  membership_id uuid NOT NULL,
  version int NOT NULL DEFAULT 1,               -- yeniden gönderim yeni sürüm; eski token geçersiz
  token_hash text UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','pending','accepted','expired','revoked')),
  expires_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);
CREATE TABLE email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  invitation_id uuid,
  idempotency_key text UNIQUE,
  to_email text NOT NULL,
  subject text NOT NULL,
  body_text text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','temp_fail','perm_fail','complaint')),
  transport text,                              -- smtp | sandbox
  provider_message_id text,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

-- ---------- içe alma işi (genel): yükle → doğrula → önizle → onayla
CREATE TABLE import_job (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('org','users','instrument','results')),
  cycle_id uuid,
  state text NOT NULL DEFAULT 'validated' CHECK (state IN ('validated','failed','committed')),
  file_name text,
  file_hash text,
  file_size int,
  template_version text,
  row_count int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  warning_count int NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]',          -- [{sheet,row,col,code,message,value,severity}]
  preview jsonb NOT NULL DEFAULT '{}',
  payload jsonb NOT NULL DEFAULT '{}',         -- doğrulanmış normalize satırlar (onayda uygulanır)
  committed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

-- ---------- tenant kataloğu: birim tipleri ve unvanlar (müşteriye özel)
CREATE TABLE unit_type (
  tenant_id uuid NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  PRIMARY KEY (tenant_id, code)
);
ALTER TABLE org_unit DROP CONSTRAINT IF EXISTS org_unit_unit_type_check;
CREATE UNIQUE INDEX IF NOT EXISTS ux_org_unit_external ON org_unit (tenant_id, external_id) WHERE external_id IS NOT NULL;
ALTER TABLE org_role ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE org_role ADD COLUMN IF NOT EXISTS permission_profile text CHECK (permission_profile IN ('HR_ADMIN','HR_PARTNER','EXEC','REGION_MANAGER','UNIT_MANAGER','ACTION_OWNER','VIEWER'));
CREATE UNIQUE INDEX IF NOT EXISTS ux_org_role_code ON org_role (tenant_id, code) WHERE code IS NOT NULL;
ALTER TABLE hierarchy_group ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'SURVEY_ROLLUP' CHECK (purpose IN ('SURVEY_ROLLUP','RESPONSIBILITY','GEOGRAPHIC','OTHER'));
CREATE UNIQUE INDEX IF NOT EXISTS ux_hierarchy_group_code ON hierarchy_group (tenant_id, code);
ALTER TABLE person ADD COLUMN IF NOT EXISTS user_id uuid;

-- ---------- enstrüman: ölçek, seçenek, puanlama kuralı, madde sürümü, sertifikasyon uygunluğu
CREATE TABLE instrument_scale (
  tenant_id uuid NOT NULL,
  instrument_version_id uuid NOT NULL,
  code text NOT NULL,                          -- L5, NPS11, BIN
  label text NOT NULL,
  value_type text NOT NULL DEFAULT 'INTEGER',
  min_value numeric, max_value numeric,
  options jsonb NOT NULL DEFAULT '[]',         -- [{code,label,valid}]
  PRIMARY KEY (tenant_id, instrument_version_id, code)
);
CREATE TABLE scoring_rule (
  tenant_id uuid NOT NULL,
  instrument_version_id uuid NOT NULL,
  code text NOT NULL,                          -- L5_TOP2_V1
  scale_code text NOT NULL,
  metric_kind text NOT NULL CHECK (metric_kind IN ('FAVORABLE_PCT','MEAN_0_100','NPS')),
  favorable_options text[] NOT NULL DEFAULT '{}',
  negative_options text[] NOT NULL DEFAULT '{}',
  min_output numeric NOT NULL DEFAULT 0, max_output numeric NOT NULL DEFAULT 100,
  state text NOT NULL DEFAULT 'APPROVED' CHECK (state IN ('DRAFT','APPROVED')),
  PRIMARY KEY (tenant_id, instrument_version_id, code)
);
ALTER TABLE instrument_item ADD COLUMN IF NOT EXISTS item_version text NOT NULL DEFAULT 'HPW_ONAYI_BEKLIYOR';
ALTER TABLE instrument_item ADD COLUMN IF NOT EXISTS scale_code text;
ALTER TABLE instrument_item ADD COLUMN IF NOT EXISTS selection_state text NOT NULL DEFAULT 'INCLUDED' CHECK (selection_state IN ('INCLUDED','EXCLUDED'));
ALTER TABLE instrument_item ADD COLUMN IF NOT EXISTS target_policy text NOT NULL DEFAULT 'TARGETABLE' CHECK (target_policy IN ('TARGETABLE','MONITOR_ONLY','REVIEW_REQUIRED'));
ALTER TABLE instrument_item ADD COLUMN IF NOT EXISTS equivalence text NOT NULL DEFAULT 'identical' CHECK (equivalence IN ('identical','equivalent','changed','custom'));
ALTER TABLE instrument_item ADD COLUMN IF NOT EXISTS display_order int;
ALTER TABLE instrument_version ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT','PUBLISHED'));
ALTER TABLE instrument_version ADD COLUMN IF NOT EXISTS certification_eligible boolean NOT NULL DEFAULT false;
ALTER TABLE instrument_version ADD COLUMN IF NOT EXISTS certification_notes text[] NOT NULL DEFAULT '{}';
-- madde metriği: item_code_TB, item_code_NPS ...
CREATE TABLE item_metric (
  tenant_id uuid NOT NULL,
  instrument_version_id uuid NOT NULL,
  metric_code text NOT NULL,
  item_code text NOT NULL,
  rule_code text NOT NULL,
  direction text NOT NULL DEFAULT 'HIGHER_BETTER' CHECK (direction IN ('HIGHER_BETTER','LOWER_BETTER')),
  metric_version_id uuid,                      -- metric_version bağı (result satırları bunu kullanır)
  PRIMARY KEY (tenant_id, instrument_version_id, metric_code),
  FOREIGN KEY (tenant_id, instrument_version_id, item_code) REFERENCES instrument_item(tenant_id, instrument_version_id, code)
);

-- ---------- dönem: enstrüman sürümü ve aktif sonuç sürümü (atomik yayın işaretçisi)
ALTER TABLE survey_cycle ADD COLUMN IF NOT EXISTS instrument_version_id uuid;
ALTER TABLE survey_cycle ADD COLUMN IF NOT EXISTS active_batch_id uuid;
ALTER TABLE survey_cycle ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup','open','published','closed'));
ALTER TABLE result ADD COLUMN IF NOT EXISTS metric_code text;
ALTER TABLE result ADD COLUMN IF NOT EXISTS result_version text;
ALTER TABLE result ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'OBSERVED' CHECK (status IN ('OBSERVED','SUPPRESSED','OFFICIAL'));
CREATE INDEX IF NOT EXISTS ix_result_lookup ON result (tenant_id, cycle_id, import_batch_id, unit_id, metric_code);
ALTER TABLE import_batch ADD COLUMN IF NOT EXISTS import_job_id uuid;
ALTER TABLE import_batch ADD COLUMN IF NOT EXISTS bundle_code text;
-- resmî toplamlar (indeks) ayrı: mutabakat için
CREATE TABLE official_aggregate (
  tenant_id uuid NOT NULL,
  cycle_id uuid NOT NULL,
  import_batch_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  aggregate_code text NOT NULL,
  definition_version text,
  value numeric NOT NULL,
  status text NOT NULL DEFAULT 'OFFICIAL',
  source_reference text,
  PRIMARY KEY (tenant_id, import_batch_id, unit_id, aggregate_code)
);

-- ---------- aksiyon: kanıt gereksinimi kilidi ve ritim
ALTER TABLE action ADD COLUMN IF NOT EXISTS evidence_level text;
ALTER TABLE action ADD COLUMN IF NOT EXISTS evidence_rule text;
ALTER TABLE action ADD COLUMN IF NOT EXISTS verification_route text;
ALTER TABLE action ADD COLUMN IF NOT EXISTS requirement jsonb;    -- {ruleType, expected, windowStart, windowEnd, cadence, label}
ALTER TABLE action ADD COLUMN IF NOT EXISTS cycle_id uuid;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS attendance int;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS occurred boolean NOT NULL DEFAULT true;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS validity text NOT NULL DEFAULT 'valid';
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS invalid_reason text;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS note text;

-- dikkat durum sözlüğü (ADR-0037): snoozed / rerouted / exempted eklenir
ALTER TABLE attention_item DROP CONSTRAINT IF EXISTS attention_item_state_check;
ALTER TABLE attention_item ADD CONSTRAINT attention_item_state_check CHECK (state IN ('open','acknowledged','snoozed','rerouted','resolved','exempted','dismissed','escalated'));

-- ---------- RLS: yeni tenant tabloları
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT unnest(ARRAY['membership','invitation','import_job','unit_type','instrument_scale','scoring_rule','item_metric','official_aggregate']) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO hpw_app', t);
  END LOOP;
END $$;
-- platform alanı: yetkili müşteri listesindeki tenant'lar (app.realm='platform' ve platform_tenant_access)
CREATE POLICY platform_access ON tenant FOR ALL USING (app_realm() = 'platform' AND EXISTS (SELECT 1 FROM platform_tenant_access a WHERE a.tenant_id = tenant.id AND a.user_id = app_user_id())) WITH CHECK (app_realm() = 'platform');
CREATE POLICY platform_membership ON membership FOR ALL USING (app_realm() = 'platform' AND EXISTS (SELECT 1 FROM platform_tenant_access a WHERE a.tenant_id = membership.tenant_id AND a.user_id = app_user_id())) WITH CHECK (app_realm() = 'platform' AND EXISTS (SELECT 1 FROM platform_tenant_access a WHERE a.tenant_id = membership.tenant_id AND a.user_id = app_user_id()));
CREATE POLICY platform_invitation ON invitation FOR ALL USING (app_realm() = 'platform' AND EXISTS (SELECT 1 FROM platform_tenant_access a WHERE a.tenant_id = invitation.tenant_id AND a.user_id = app_user_id())) WITH CHECK (app_realm() = 'platform' AND EXISTS (SELECT 1 FROM platform_tenant_access a WHERE a.tenant_id = invitation.tenant_id AND a.user_id = app_user_id()));
-- platform alanında tenant'a bağlı çalışma: app.tenant_id set edilince tenant_isolation zaten geçer; yetki kontrolü uygulama katmanında + platform_tenant_access
ALTER TABLE platform_tenant_access ENABLE ROW LEVEL SECURITY; ALTER TABLE platform_tenant_access FORCE ROW LEVEL SECURITY;
CREATE POLICY own_access ON platform_tenant_access USING (user_id = app_user_id() OR app_realm() = 'platform_admin');
GRANT SELECT ON platform_tenant_access TO hpw_app;
-- app_user: kendi satırı; platform admin hepsi
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY; ALTER TABLE app_user FORCE ROW LEVEL SECURITY;
CREATE POLICY user_self ON app_user USING (id = app_user_id() OR app_realm() IN ('platform','platform_admin') OR EXISTS (SELECT 1 FROM membership m WHERE m.user_id = app_user.id AND m.tenant_id = app_tenant_id())) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON app_user TO hpw_app;
-- session ve email_outbox yalnız SECURITY DEFINER fonksiyonlarla (auth alanı)
ALTER TABLE session ENABLE ROW LEVEL SECURITY; ALTER TABLE session FORCE ROW LEVEL SECURITY;
CREATE POLICY deny_all ON session USING (false) WITH CHECK (false); -- yalnız SECURITY DEFINER auth_* fonksiyonları; doğrudan erişim yok
ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY; ALTER TABLE email_outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY outbox_tenant ON email_outbox USING (tenant_id = app_tenant_id() OR app_realm() = 'worker') WITH CHECK (tenant_id = app_tenant_id() OR app_realm() = 'worker');
GRANT SELECT, INSERT, UPDATE ON email_outbox TO hpw_app;

-- ---------- kimlik doğrulama fonksiyonları (SECURITY DEFINER; token düz metin saklanmaz)
CREATE OR REPLACE FUNCTION auth_lookup_user(p_email text) RETURNS TABLE (id uuid, email text, display_name text, realm text, password_hash text, status text, locale text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT id, email, display_name, realm, password_hash, status, locale FROM app_user WHERE email_norm = lower(p_email) $$;
CREATE OR REPLACE FUNCTION auth_session_create(p_token_hash text, p_user uuid, p_realm text, p_tenant uuid, p_ttl interval) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ INSERT INTO session (token_hash, user_id, realm, tenant_id, expires_at) VALUES (p_token_hash, p_user, p_realm, p_tenant, now() + p_ttl) RETURNING id $$;
CREATE OR REPLACE FUNCTION auth_session_lookup(p_token_hash text) RETURNS TABLE (session_id uuid, user_id uuid, realm text, tenant_id uuid, email text, display_name text, user_status text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE session SET last_seen_at = now() WHERE token_hash = p_token_hash AND revoked_at IS NULL AND expires_at > now();
  SELECT s.id, s.user_id, s.realm, s.tenant_id, u.email, u.display_name, u.status FROM session s JOIN app_user u ON u.id = s.user_id WHERE s.token_hash = p_token_hash AND s.revoked_at IS NULL AND s.expires_at > now() $$;
CREATE OR REPLACE FUNCTION auth_session_revoke(p_token_hash text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ UPDATE session SET revoked_at = now() WHERE token_hash = p_token_hash $$;
CREATE OR REPLACE FUNCTION auth_sessions_revoke_user(p_user uuid, p_tenant uuid) RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ WITH u AS (UPDATE session SET revoked_at = now() WHERE user_id = p_user AND revoked_at IS NULL AND (p_tenant IS NULL OR tenant_id = p_tenant) RETURNING 1) SELECT count(*)::int FROM u $$;
CREATE OR REPLACE FUNCTION auth_session_switch_tenant(p_token_hash text, p_tenant uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ UPDATE session SET tenant_id = p_tenant WHERE token_hash = p_token_hash AND realm = 'platform' $$;
-- davet kabulü: token tek kullanımlık ve atomik
CREATE OR REPLACE FUNCTION invitation_accept(p_token_hash text, p_password_hash text) RETURNS TABLE (user_id uuid, tenant_id uuid, email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv record;
BEGIN
  SELECT * INTO inv FROM invitation i WHERE i.token_hash = p_token_hash AND i.status = 'pending' AND i.expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE invitation i2 SET status = 'accepted', accepted_at = now(), token_hash = NULL WHERE i2.tenant_id = inv.tenant_id AND i2.id = inv.id;
  UPDATE app_user u2 SET password_hash = p_password_hash, status = 'active', updated_at = now() WHERE u2.id = inv.user_id;
  RETURN QUERY SELECT u.id AS user_id, inv.tenant_id AS tenant_id, u.email AS email FROM app_user u WHERE u.id = inv.user_id;
END $$;
CREATE OR REPLACE FUNCTION invitation_peek(p_token_hash text) RETURNS TABLE (tenant_name text, email text, display_name text, expires_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT t.name, u.email, u.display_name, i.expires_at FROM invitation i JOIN app_user u ON u.id = i.user_id JOIN tenant t ON t.id = i.tenant_id WHERE i.token_hash = p_token_hash AND i.status = 'pending' AND i.expires_at > now() $$;
-- platform kullanıcısı oluşturma (ilk kurulum; yalnız owner çalıştırır)
GRANT EXECUTE ON FUNCTION auth_lookup_user(text), auth_session_create(text, uuid, text, uuid, interval), auth_session_lookup(text), auth_session_revoke(text), auth_sessions_revoke_user(uuid, uuid), auth_session_switch_tenant(text, uuid), invitation_accept(text, text), invitation_peek(text) TO hpw_app;
-- tenant oluşturma: platform alanı (owner fonksiyonu; app.realm platform ve app.user_id zorunlu)
CREATE OR REPLACE FUNCTION platform_create_tenant(p_code text, p_name text, p_locale text, p_timezone text, p_default_login text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tid uuid; oid uuid;
BEGIN
  IF app_realm() <> 'platform' OR app_user_id() IS NULL THEN RAISE EXCEPTION 'platform_realm_required'; END IF;
  IF p_code !~ '^[A-Z0-9_-]{3,24}$' THEN RAISE EXCEPTION 'invalid_tenant_code'; END IF;
  INSERT INTO tenant (name, region, code, locale, timezone, default_login) VALUES (p_name, 'tr', p_code, p_locale, p_timezone, p_default_login) RETURNING id INTO tid;
  INSERT INTO platform_tenant_access (user_id, tenant_id, granted_by) VALUES (app_user_id(), tid, app_user_id());
  INSERT INTO organization (tenant_id, name, default_language, default_timezone) VALUES (tid, p_name, p_locale, p_timezone) RETURNING id INTO oid;
  RETURN tid;
END $$;
GRANT EXECUTE ON FUNCTION platform_create_tenant(text, text, text, text, text) TO hpw_app;
CREATE OR REPLACE FUNCTION platform_list_tenants() RETURNS TABLE (id uuid, code text, name text, status text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT t.id, t.code, t.name, t.status, t.created_at FROM tenant t WHERE app_realm() = 'platform' AND EXISTS (SELECT 1 FROM platform_tenant_access a WHERE a.tenant_id = t.id AND a.user_id = app_user_id()) ORDER BY t.created_at $$;
GRANT EXECUTE ON FUNCTION platform_list_tenants() TO hpw_app;
-- kullanıcı kaydı (davet için): var olan e-posta ise mevcut id
CREATE OR REPLACE FUNCTION upsert_user(p_email text, p_display_name text, p_locale text, p_timezone text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  SELECT id INTO uid FROM app_user WHERE email_norm = lower(p_email);
  IF uid IS NULL THEN INSERT INTO app_user (email, display_name, locale, timezone) VALUES (p_email, p_display_name, COALESCE(p_locale,'tr'), COALESCE(p_timezone,'Europe/Istanbul')) RETURNING id INTO uid; END IF;
  RETURN uid;
END $$;
GRANT EXECUTE ON FUNCTION upsert_user(text, text, text, text) TO hpw_app;
-- e-posta işçisi: kuyruktan al (worker alanı)
CREATE OR REPLACE FUNCTION outbox_claim(p_limit int) RETURNS SETOF email_outbox LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT * FROM email_outbox WHERE status IN ('queued','temp_fail') AND attempts < 5 ORDER BY created_at LIMIT p_limit FOR UPDATE SKIP LOCKED $$;
CREATE OR REPLACE FUNCTION outbox_mark(p_id uuid, p_status text, p_transport text, p_message_id text, p_error text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ UPDATE email_outbox SET status = p_status, transport = p_transport, provider_message_id = COALESCE(p_message_id, provider_message_id), last_error = p_error, attempts = attempts + 1, sent_at = CASE WHEN p_status IN ('sent','delivered') THEN now() ELSE sent_at END WHERE id = p_id $$;
GRANT EXECUTE ON FUNCTION outbox_claim(int), outbox_mark(uuid, text, text, text, text) TO hpw_worker, hpw_app;
GRANT USAGE ON SCHEMA public TO hpw_app, hpw_worker;
GRANT SELECT, INSERT, UPDATE ON app_user TO hpw_worker;
