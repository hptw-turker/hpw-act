-- HPW Act — 0003: R01–R44 sertleştirme. Yetki (rol atamalarından türetilen profil, açık şirket geneli yetkisi), kimlik (parola sıfırlama, hesap durumu),
-- sonuç soy bilgisi (kaynak referansı, ithal modu, sürüm pinleme), kuyruk kirası, komut tekilleştirme, ortam ayrımı.

-- ---------- üyelik: profil açık mı (platformca verilmiş HR_ADMIN gibi) yoksa rollerden mi türetilir; şirket geneli görünüm açık yetkidir (R03/R05)
ALTER TABLE membership ADD COLUMN IF NOT EXISTS explicit_profile boolean NOT NULL DEFAULT false;
ALTER TABLE membership ADD COLUMN IF NOT EXISTS company_wide boolean NOT NULL DEFAULT false;
UPDATE membership SET explicit_profile = true, company_wide = true WHERE permission_profile = 'HR_ADMIN';
CREATE TABLE IF NOT EXISTS membership_scope (
  tenant_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  access_profile text NOT NULL CHECK (access_profile IN ('VIEWER','HR_PARTNER')),
  include_descendants boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  PRIMARY KEY (tenant_id, membership_id, unit_id, access_profile)
);
-- kimlik doğrulama: kullanıcının kendi üyelikleri (R01) — dar kapsamlı definer
CREATE OR REPLACE FUNCTION auth_memberships(p_user uuid) RETURNS TABLE (tenant_id uuid, tenant_name text, tenant_code text, permission_profile text, status text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT m.tenant_id, t.name, t.code, m.permission_profile, m.status FROM membership m JOIN tenant t ON t.id = m.tenant_id WHERE m.user_id = p_user AND m.status = 'active' AND t.status = 'active' ORDER BY t.name $$;
DROP FUNCTION IF EXISTS auth_session_switch_tenant(text, uuid);
CREATE FUNCTION auth_session_switch_tenant(p_token_hash text, p_tenant uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM session WHERE token_hash = p_token_hash AND revoked_at IS NULL AND expires_at > now() FOR UPDATE; IF NOT FOUND THEN RETURN false; END IF;
  IF s.realm = 'platform' THEN IF NOT EXISTS (SELECT 1 FROM platform_tenant_access a WHERE a.user_id = s.user_id AND a.tenant_id = p_tenant) THEN RETURN false; END IF;
  ELSE IF NOT EXISTS (SELECT 1 FROM membership m JOIN tenant t ON t.id = m.tenant_id WHERE m.user_id = s.user_id AND m.tenant_id = p_tenant AND m.status = 'active' AND t.status = 'active') THEN RETURN false; END IF; END IF;
  UPDATE session SET tenant_id = p_tenant WHERE id = s.id; RETURN true;
END $$;
-- oturum aramasında kullanıcı durumu ve üyelik durumu (R10): disabled → satır yok
CREATE OR REPLACE FUNCTION auth_session_lookup(p_token_hash text) RETURNS TABLE (session_id uuid, user_id uuid, realm text, tenant_id uuid, email text, display_name text, user_status text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE session SET last_seen_at = now() WHERE token_hash = p_token_hash AND revoked_at IS NULL AND expires_at > now();
  SELECT s.id, s.user_id, s.realm, s.tenant_id, u.email, u.display_name, u.status FROM session s JOIN app_user u ON u.id = s.user_id WHERE s.token_hash = p_token_hash AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'active' $$;
-- platform yetki listesi kontrolü (R02)
CREATE OR REPLACE FUNCTION auth_platform_has_tenant(p_user uuid, p_tenant uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM platform_tenant_access a JOIN app_user u ON u.id = a.user_id WHERE a.user_id = p_user AND a.tenant_id = p_tenant AND u.realm = 'platform' AND u.status = 'active') $$;
-- davet kabulü: mevcut parolalı hesapta parola DEĞİŞTİRİLMEZ (R10); yeni kimlikte parola kurulur ve diğer oturumlar kapanır
DROP FUNCTION IF EXISTS invitation_accept(text, text);
CREATE FUNCTION invitation_accept(p_token_hash text, p_password_hash text) RETURNS TABLE (user_id uuid, tenant_id uuid, email text, mode text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv record; u record;
BEGIN
  SELECT * INTO inv FROM invitation i WHERE i.token_hash = p_token_hash AND i.status = 'pending' AND i.expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO u FROM app_user a WHERE a.id = inv.user_id;
  IF u.status = 'disabled' THEN RETURN; END IF;
  UPDATE invitation i2 SET status = 'accepted', accepted_at = now(), token_hash = NULL WHERE i2.tenant_id = inv.tenant_id AND i2.id = inv.id;
  IF u.password_hash IS NULL THEN
    UPDATE app_user u2 SET password_hash = p_password_hash, status = 'active', updated_at = now() WHERE u2.id = inv.user_id;
    UPDATE session SET revoked_at = now() WHERE session.user_id = inv.user_id AND revoked_at IS NULL;
    RETURN QUERY SELECT u.id, inv.tenant_id, u.email, 'password_set'::text;
  ELSE
    RETURN QUERY SELECT u.id, inv.tenant_id, u.email, 'membership_joined'::text; -- parola korunur; kişi mevcut parolasıyla girer
  END IF;
END $$;
DROP FUNCTION IF EXISTS invitation_peek(text);
CREATE FUNCTION invitation_peek(p_token_hash text) RETURNS TABLE (tenant_name text, email text, display_name text, expires_at timestamptz, has_password boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT t.name, u.email, u.display_name, i.expires_at, u.password_hash IS NOT NULL FROM invitation i JOIN app_user u ON u.id = i.user_id JOIN tenant t ON t.id = i.tenant_id WHERE i.token_hash = p_token_hash AND i.status = 'pending' AND i.expires_at > now() $$;

-- ---------- parola sıfırlama / kurma (R34, R35): süreli tek kullanımlık, amaç etiketli
CREATE TABLE IF NOT EXISTS password_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id),
  purpose text NOT NULL CHECK (purpose IN ('reset','set')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE password_token ENABLE ROW LEVEL SECURITY; ALTER TABLE password_token FORCE ROW LEVEL SECURITY;
CREATE POLICY deny_all ON password_token USING (false) WITH CHECK (false);
CREATE OR REPLACE FUNCTION auth_password_token_create(p_email text, p_purpose text, p_token_hash text, p_ttl interval) RETURNS TABLE (user_id uuid, display_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u record;
BEGIN
  SELECT * INTO u FROM app_user a WHERE a.email_norm = lower(p_email) AND a.status <> 'disabled'; IF NOT FOUND THEN RETURN; END IF;
  UPDATE password_token SET used_at = now() WHERE password_token.user_id = u.id AND used_at IS NULL; -- eski bağlantılar geçersiz
  INSERT INTO password_token (user_id, purpose, token_hash, expires_at) VALUES (u.id, p_purpose, p_token_hash, now() + p_ttl);
  RETURN QUERY SELECT u.id, u.display_name;
END $$;
CREATE OR REPLACE FUNCTION auth_password_token_consume(p_token_hash text, p_password_hash text) RETURNS TABLE (user_id uuid, email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record;
BEGIN
  SELECT * INTO t FROM password_token pt WHERE pt.token_hash = p_token_hash AND pt.used_at IS NULL AND pt.expires_at > now() FOR UPDATE; IF NOT FOUND THEN RETURN; END IF;
  UPDATE password_token SET used_at = now() WHERE id = t.id;
  UPDATE app_user SET password_hash = p_password_hash, status = 'active', updated_at = now() WHERE id = t.user_id;
  UPDATE session SET revoked_at = now() WHERE session.user_id = t.user_id AND revoked_at IS NULL;
  RETURN QUERY SELECT a.id, a.email FROM app_user a WHERE a.id = t.user_id;
END $$;
-- giriş denemesi sınırı (R35): e-posta + IP başına pencere
CREATE TABLE IF NOT EXISTS login_attempt (key text PRIMARY KEY, attempts int NOT NULL DEFAULT 0, window_start timestamptz NOT NULL DEFAULT now(), locked_until timestamptz);
ALTER TABLE login_attempt ENABLE ROW LEVEL SECURITY; ALTER TABLE login_attempt FORCE ROW LEVEL SECURITY; CREATE POLICY deny_all ON login_attempt USING (false) WITH CHECK (false);
CREATE OR REPLACE FUNCTION auth_login_attempt(p_key text, p_success boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM login_attempt WHERE key = p_key FOR UPDATE;
  IF FOUND AND r.locked_until IS NOT NULL AND r.locked_until > now() THEN RETURN false; END IF;
  IF p_success THEN DELETE FROM login_attempt WHERE key = p_key; RETURN true; END IF;
  IF NOT FOUND OR r.window_start < now() - interval '15 minutes' THEN INSERT INTO login_attempt (key, attempts, window_start) VALUES (p_key, 1, now()) ON CONFLICT (key) DO UPDATE SET attempts = 1, window_start = now(), locked_until = NULL; RETURN true; END IF;
  UPDATE login_attempt SET attempts = attempts + 1, locked_until = CASE WHEN attempts + 1 >= 8 THEN now() + interval '15 minutes' ELSE NULL END WHERE key = p_key;
  RETURN true;
END $$;
-- platform kurulumu: tek seferlik ve atomik (R35)
CREATE OR REPLACE FUNCTION platform_bootstrap(p_email text, p_display_name text, p_password_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(7712001);
  IF EXISTS (SELECT 1 FROM app_user WHERE realm = 'platform') THEN RAISE EXCEPTION 'already_bootstrapped'; END IF;
  INSERT INTO app_user (email, display_name, realm, password_hash, status) VALUES (p_email, p_display_name, 'platform', p_password_hash, 'active') RETURNING id INTO uid; RETURN uid;
END $$;
CREATE OR REPLACE FUNCTION platform_grant_tenant(p_user uuid, p_tenant uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ INSERT INTO platform_tenant_access (user_id, tenant_id, granted_by) VALUES (p_user, p_tenant, app_user_id()) ON CONFLICT DO NOTHING $$;
CREATE OR REPLACE FUNCTION platform_create_user(p_email text, p_display_name text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  IF app_realm() <> 'platform' OR app_user_id() IS NULL THEN RAISE EXCEPTION 'platform_realm_required'; END IF;
  SELECT id INTO uid FROM app_user WHERE email_norm = lower(p_email);
  IF uid IS NULL THEN INSERT INTO app_user (email, display_name, realm, status) VALUES (p_email, p_display_name, 'platform', 'invited') RETURNING id INTO uid; ELSE UPDATE app_user SET realm = 'platform' WHERE id = uid; END IF;
  RETURN uid;
END $$;

-- ---------- e-posta kuyruğu: kira ve yeniden deneme (R33)
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE email_outbox DROP CONSTRAINT IF EXISTS email_outbox_status_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_status_check CHECK (status IN ('queued','processing','sent','delivered','temp_fail','perm_fail','complaint','blocked'));
CREATE OR REPLACE FUNCTION outbox_claim(p_limit int) RETURNS SETOF email_outbox LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE email_outbox o SET status = 'processing', lease_until = now() + interval '2 minutes', attempts = attempts + 1
  WHERE o.id IN (SELECT id FROM email_outbox WHERE (status IN ('queued','temp_fail') AND next_attempt_at <= now() AND attempts < 5) OR (status = 'processing' AND lease_until < now()) ORDER BY created_at LIMIT p_limit FOR UPDATE SKIP LOCKED)
  RETURNING o.* $$;
CREATE OR REPLACE FUNCTION outbox_mark(p_id uuid, p_status text, p_transport text, p_message_id text, p_error text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE email_outbox SET status = CASE WHEN p_status = 'temp_fail' AND attempts >= 5 THEN 'perm_fail' ELSE p_status END, transport = p_transport, provider_message_id = COALESCE(p_message_id, provider_message_id), last_error = p_error, lease_until = NULL,
    next_attempt_at = CASE WHEN p_status = 'temp_fail' THEN now() + (interval '1 minute' * power(2, LEAST(attempts, 6))) ELSE next_attempt_at END,
    sent_at = CASE WHEN p_status IN ('sent','delivered') THEN now() ELSE sent_at END WHERE id = p_id $$;

-- ---------- sonuç soy bilgisi ve ithal sözleşmesi (R21–R24)
ALTER TABLE result ADD COLUMN IF NOT EXISTS source_reference text;
ALTER TABLE result ADD COLUMN IF NOT EXISTS carried_from_batch_id uuid;   -- PATCH modunda korunan satırın kaynağı
ALTER TABLE import_batch ADD COLUMN IF NOT EXISTS import_mode text NOT NULL DEFAULT 'FULL_REPLACE' CHECK (import_mode IN ('FULL_REPLACE','PATCH'));
ALTER TABLE import_batch ADD COLUMN IF NOT EXISTS file_hash_sha256 text;
ALTER TABLE import_batch ADD COLUMN IF NOT EXISTS removed_cells int NOT NULL DEFAULT 0;
ALTER TABLE import_job ADD COLUMN IF NOT EXISTS pinned jsonb NOT NULL DEFAULT '{}';   -- {instrumentVersionId, activeBatchId, orgVersion}
ALTER TABLE benchmark ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE benchmark ADD COLUMN IF NOT EXISTS set_version text;
ALTER TABLE local_target ADD COLUMN IF NOT EXISTS baseline_superseded boolean NOT NULL DEFAULT false;
ALTER TABLE local_target ADD COLUMN IF NOT EXISTS measurement_plan jsonb;  -- {followupCycleCode?, horizonDays}
ALTER TABLE action ADD COLUMN IF NOT EXISTS custom boolean NOT NULL DEFAULT false;
ALTER TABLE action ADD COLUMN IF NOT EXISTS urgent_reason text;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS slot_key text;             -- ritim slotu (2026-05 gibi); slot başına tek gerçekleşme (R26)

-- ---------- komut tekilleştirme (R28): tenant + anahtar + gövde özeti
CREATE TABLE IF NOT EXISTS idempotency_key (
  tenant_id uuid NOT NULL,
  key text NOT NULL,
  actor_id uuid NOT NULL,
  payload_hash text NOT NULL,
  response_status int NOT NULL,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, key)
);
ALTER TABLE idempotency_key ENABLE ROW LEVEL SECURITY; ALTER TABLE idempotency_key FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON idempotency_key USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_key, membership_scope TO hpw_app;
ALTER TABLE membership_scope ENABLE ROW LEVEL SECURITY; ALTER TABLE membership_scope FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON membership_scope USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());
-- audit_event: uygulama yazımı (R29)
GRANT INSERT, SELECT ON audit_event TO hpw_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hpw_app;

-- ---------- güven sınırı (R36): definer fonksiyonları yalnız uygulama rolüne
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_tenant_id(), app_realm(), app_user_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth_memberships(uuid), auth_session_switch_tenant(text, uuid), auth_session_lookup(text), auth_platform_has_tenant(uuid, uuid), invitation_accept(text, text), invitation_peek(text), auth_password_token_create(text, text, text, interval), auth_password_token_consume(text, text), auth_login_attempt(text, boolean), platform_bootstrap(text, text, text), platform_grant_tenant(uuid, uuid), platform_create_user(text, text), outbox_claim(int), outbox_mark(uuid, text, text, text, text), auth_lookup_user(text), auth_session_create(text, uuid, text, uuid, interval), auth_session_revoke(text), auth_sessions_revoke_user(uuid, uuid), platform_create_tenant(text, text, text, text, text), platform_list_tenants(), upsert_user(text, text, text, text) TO hpw_app;
GRANT EXECUTE ON FUNCTION outbox_claim(int), outbox_mark(uuid, text, text, text, text) TO hpw_worker;
-- migrasyon defteri: içerik özeti (R38)
CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text;
