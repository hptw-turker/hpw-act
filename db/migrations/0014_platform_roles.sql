-- 0014 HPW merkezi dilim 1 (v2.9.0): platform rolleri, şirket görevleri, platform yazma koruması, müdahale modu, platform işlem geçmişi
-- Genel rol: ne yapabileceği; şirket görevi: nerede yapabileceği. İkisi birlikte olmadan şirket verisine erişilmez.
CREATE TABLE IF NOT EXISTS platform_role (
  user_id uuid PRIMARY KEY REFERENCES app_user(id),
  role text NOT NULL CHECK (role IN ('admin', 'consultant', 'methodologist', 'auditor')),
  granted_by uuid REFERENCES app_user(id), granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz, revoked_by uuid REFERENCES app_user(id), reason text, version int NOT NULL DEFAULT 1
);
-- K4: mevcut platform hesapları Sistem Yöneticisi olarak taşınır
INSERT INTO platform_role (user_id, role, reason) SELECT id, 'admin', 'v2.9.0 geçişi: mevcut platform hesabı' FROM app_user WHERE realm = 'platform' ON CONFLICT DO NOTHING;
ALTER TABLE platform_role ENABLE ROW LEVEL SECURITY; ALTER TABLE platform_role FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_role_read ON platform_role; CREATE POLICY platform_role_read ON platform_role FOR SELECT USING (app_realm() = 'platform');
GRANT SELECT ON platform_role TO hpw_app;

ALTER TABLE platform_tenant_access ADD COLUMN IF NOT EXISTS duty text NOT NULL DEFAULT 'admin_scope';
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_tenant_access_duty_check') THEN ALTER TABLE platform_tenant_access ADD CONSTRAINT platform_tenant_access_duty_check CHECK (duty IN ('admin_scope', 'primary', 'backup', 'methodologist', 'auditor')); END IF; END $$;
ALTER TABLE platform_tenant_access ADD COLUMN IF NOT EXISTS valid_from date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE platform_tenant_access ADD COLUMN IF NOT EXISTS valid_to date;
ALTER TABLE platform_tenant_access ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE platform_tenant_access ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE platform_tenant_access ADD COLUMN IF NOT EXISTS revoked_by uuid;
ALTER TABLE platform_tenant_access ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;
UPDATE platform_tenant_access SET valid_from = granted_at::date WHERE valid_from > granted_at::date;
CREATE UNIQUE INDEX IF NOT EXISTS ux_pta_primary ON platform_tenant_access (tenant_id) WHERE duty = 'primary' AND revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_pta_backup ON platform_tenant_access (tenant_id) WHERE duty = 'backup' AND revoked_at IS NULL;
-- etkin erişim: etkin rol + iptal edilmemiş, geçerlilik aralığındaki atama
CREATE OR REPLACE FUNCTION platform_access_active(p_user uuid, p_tenant uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM platform_tenant_access a JOIN app_user u ON u.id = a.user_id JOIN platform_role r ON r.user_id = a.user_id AND r.revoked_at IS NULL
    WHERE a.user_id = p_user AND a.tenant_id = p_tenant AND u.realm = 'platform' AND u.status = 'active' AND a.revoked_at IS NULL AND a.valid_from <= CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to >= CURRENT_DATE)) $$;
CREATE OR REPLACE FUNCTION auth_platform_has_tenant(p_user uuid, p_tenant uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT platform_access_active(p_user, p_tenant) $$;
CREATE OR REPLACE FUNCTION platform_list_tenants() RETURNS TABLE (id uuid, code text, name text, status text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT t.id, t.code, t.name, t.status, t.created_at FROM tenant t WHERE app_realm() = 'platform' AND platform_access_active(app_user_id(), t.id) ORDER BY t.created_at $$;
DROP POLICY IF EXISTS platform_access ON tenant; CREATE POLICY platform_access ON tenant FOR ALL USING (app_realm() = 'platform' AND platform_access_active(app_user_id(), tenant.id)) WITH CHECK (app_realm() = 'platform');
DROP POLICY IF EXISTS platform_membership ON membership; CREATE POLICY platform_membership ON membership FOR ALL USING (app_realm() = 'platform' AND platform_access_active(app_user_id(), membership.tenant_id)) WITH CHECK (app_realm() = 'platform' AND platform_access_active(app_user_id(), membership.tenant_id));
DROP POLICY IF EXISTS platform_invitation ON invitation; CREATE POLICY platform_invitation ON invitation FOR ALL USING (app_realm() = 'platform' AND platform_access_active(app_user_id(), invitation.tenant_id)) WITH CHECK (app_realm() = 'platform' AND platform_access_active(app_user_id(), invitation.tenant_id));
-- şirket açan yönetici o şirkete yönetici kapsamıyla atanır (mevcut davranış); yeniden atama iptal edilmiş satırı canlandırır
CREATE OR REPLACE FUNCTION platform_grant_tenant(p_user uuid, p_tenant uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO platform_tenant_access (user_id, tenant_id, granted_by, duty) VALUES (p_user, p_tenant, app_user_id(), 'admin_scope')
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET revoked_at = NULL, revoked_by = NULL, valid_from = CURRENT_DATE, valid_to = NULL, version = platform_tenant_access.version + 1 WHERE platform_tenant_access.revoked_at IS NOT NULL $$;

-- platform yazma koruması (K1/K6, bölüm 3.4): platform alanında her şirket tablosuna yazma yalnız app.platform_write='on' iken; API bunu yalnız yetenek denetimi olumluyken açar
CREATE OR REPLACE FUNCTION platform_write_ok() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT app_realm() <> 'platform' OR COALESCE(current_setting('app.platform_write', true), '') = 'on' $$;
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity AND c.relname NOT IN ('platform_role', 'platform_tenant_access', 'platform_audit_event', 'platform_intervention', 'schema_migrations') LOOP
    EXECUTE format('DROP POLICY IF EXISTS platform_write_guard_i ON %I', t); EXECUTE format('CREATE POLICY platform_write_guard_i ON %I AS RESTRICTIVE FOR INSERT WITH CHECK (platform_write_ok())', t);
    EXECUTE format('DROP POLICY IF EXISTS platform_write_guard_u ON %I', t); EXECUTE format('CREATE POLICY platform_write_guard_u ON %I AS RESTRICTIVE FOR UPDATE USING (platform_write_ok())', t);
    EXECUTE format('DROP POLICY IF EXISTS platform_write_guard_d ON %I', t); EXECUTE format('CREATE POLICY platform_write_guard_d ON %I AS RESTRICTIVE FOR DELETE USING (platform_write_ok())', t);
  END LOOP; END $$;

-- müdahale modu (K7): şirket başına aynı anda bir etkin müdahale
CREATE TABLE IF NOT EXISTS platform_intervention (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenant(id), actor_id uuid NOT NULL REFERENCES app_user(id),
  reason text NOT NULL CHECK (length(reason) >= 20), started_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz NOT NULL, ended_at timestamptz, ended_by uuid REFERENCES app_user(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_intervention_active ON platform_intervention (tenant_id) WHERE ended_at IS NULL;
ALTER TABLE platform_intervention ENABLE ROW LEVEL SECURITY; ALTER TABLE platform_intervention FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS intervention_platform ON platform_intervention; CREATE POLICY intervention_platform ON platform_intervention FOR ALL USING (app_realm() = 'platform' AND platform_access_active(app_user_id(), tenant_id)) WITH CHECK (app_realm() = 'platform' AND platform_access_active(app_user_id(), tenant_id));
DROP POLICY IF EXISTS intervention_customer_read ON platform_intervention; CREATE POLICY intervention_customer_read ON platform_intervention FOR SELECT USING (app_realm() = 'customer' AND tenant_id = app_tenant_id());
GRANT SELECT, INSERT, UPDATE ON platform_intervention TO hpw_app;

-- platform işlem geçmişi: yalnız ekleme; şirket bağlamı boş olabilir (personel, rol olayları)
CREATE TABLE IF NOT EXISTS platform_audit_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), occurred_at timestamptz NOT NULL DEFAULT now(), actor_id uuid NOT NULL, action text NOT NULL,
  tenant_id uuid, target_type text, target_id text, before jsonb, after jsonb, reason text, result text NOT NULL DEFAULT 'ok', request_id text, intervention_id uuid
);
CREATE INDEX IF NOT EXISTS ix_pae_time ON platform_audit_event (occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_pae_tenant ON platform_audit_event (tenant_id, occurred_at DESC);
CREATE RULE platform_audit_no_update AS ON UPDATE TO platform_audit_event DO INSTEAD NOTHING;
CREATE RULE platform_audit_no_delete AS ON DELETE TO platform_audit_event DO INSTEAD NOTHING;
ALTER TABLE platform_audit_event ENABLE ROW LEVEL SECURITY; ALTER TABLE platform_audit_event FORCE ROW LEVEL SECURITY;
-- görünürlük: aktörün etkin erişimi olan şirketler; şirketsiz (genel) olaylar yalnız Sistem Yöneticisi
DROP POLICY IF EXISTS pae_read ON platform_audit_event; CREATE POLICY pae_read ON platform_audit_event FOR SELECT USING (app_realm() = 'platform' AND ((tenant_id IS NOT NULL AND platform_access_active(app_user_id(), tenant_id)) OR (tenant_id IS NULL AND EXISTS (SELECT 1 FROM platform_role r WHERE r.user_id = app_user_id() AND r.role = 'admin' AND r.revoked_at IS NULL))));
DROP POLICY IF EXISTS pae_insert ON platform_audit_event; CREATE POLICY pae_insert ON platform_audit_event FOR INSERT WITH CHECK (app_realm() = 'platform' AND actor_id = app_user_id());
GRANT SELECT, INSERT ON platform_audit_event TO hpw_app;

-- personel ve rol yönetimi (yalnız etkin Sistem Yöneticisi çağırabilir)
CREATE OR REPLACE FUNCTION platform_is_admin(p_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM platform_role r JOIN app_user u ON u.id = r.user_id WHERE r.user_id = p_user AND r.role = 'admin' AND r.revoked_at IS NULL AND u.status = 'active') $$;
CREATE OR REPLACE FUNCTION platform_role_of(p_user uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT r.role FROM platform_role r JOIN app_user u ON u.id = r.user_id WHERE r.user_id = p_user AND r.revoked_at IS NULL AND u.status = 'active' $$;
CREATE OR REPLACE FUNCTION platform_staff_list() RETURNS TABLE (user_id uuid, email text, display_name text, role text, role_revoked_at timestamptz, user_status text, last_login_at timestamptz, tenants int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email, u.display_name, r.role, r.revoked_at, u.status, u.last_login_at,
    (SELECT COUNT(*)::int FROM platform_tenant_access a WHERE a.user_id = u.id AND a.revoked_at IS NULL)
  FROM app_user u LEFT JOIN platform_role r ON r.user_id = u.id WHERE u.realm = 'platform' AND platform_is_admin(app_user_id()) ORDER BY u.display_name $$;
CREATE OR REPLACE FUNCTION platform_role_set(p_actor uuid, p_user uuid, p_role text, p_reason text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev text;
BEGIN
  IF NOT platform_is_admin(p_actor) THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM app_user WHERE id = p_user AND realm = 'platform') THEN RAISE EXCEPTION 'staff_not_found'; END IF;
  SELECT role INTO prev FROM platform_role WHERE user_id = p_user AND revoked_at IS NULL;
  IF prev = 'admin' AND p_role <> 'admin' AND (SELECT COUNT(*) FROM platform_role WHERE role = 'admin' AND revoked_at IS NULL) <= 1 THEN RAISE EXCEPTION 'last_admin'; END IF;
  INSERT INTO platform_role (user_id, role, granted_by, reason) VALUES (p_user, p_role, p_actor, p_reason)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, granted_by = p_actor, granted_at = now(), revoked_at = NULL, revoked_by = NULL, reason = p_reason, version = platform_role.version + 1;
  DELETE FROM session WHERE user_id = p_user AND realm = 'platform' AND prev IS DISTINCT FROM p_role; -- yetki değişince oturum yeniden açılır
  RETURN prev;
END $$;
CREATE OR REPLACE FUNCTION platform_role_revoke(p_actor uuid, p_user uuid, p_reason text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev text;
BEGIN
  IF NOT platform_is_admin(p_actor) THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  SELECT role INTO prev FROM platform_role WHERE user_id = p_user AND revoked_at IS NULL; IF prev IS NULL THEN RAISE EXCEPTION 'staff_not_found'; END IF;
  IF prev = 'admin' AND (SELECT COUNT(*) FROM platform_role WHERE role = 'admin' AND revoked_at IS NULL) <= 1 THEN RAISE EXCEPTION 'last_admin'; END IF;
  IF EXISTS (SELECT 1 FROM platform_tenant_access WHERE user_id = p_user AND duty = 'primary' AND revoked_at IS NULL) THEN RAISE EXCEPTION 'primary_handover_required'; END IF;
  UPDATE platform_role SET revoked_at = now(), revoked_by = p_actor, reason = p_reason, version = version + 1 WHERE user_id = p_user;
  UPDATE platform_tenant_access SET revoked_at = now(), revoked_by = p_actor, version = version + 1 WHERE user_id = p_user AND revoked_at IS NULL;
  DELETE FROM session WHERE user_id = p_user AND realm = 'platform';
  RETURN prev;
END $$;
-- şirket ataması: görev + gerekçe + isteğe bağlı bitiş; aynı kişinin önceki görevi güncellenir
CREATE OR REPLACE FUNCTION platform_assign(p_actor uuid, p_user uuid, p_tenant uuid, p_duty text, p_reason text, p_valid_to date) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev text; r text;
BEGIN
  IF NOT platform_is_admin(p_actor) THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF NOT platform_access_active(p_actor, p_tenant) THEN RAISE EXCEPTION 'tenant_not_authorized'; END IF;
  SELECT pr.role INTO r FROM platform_role pr JOIN app_user u ON u.id = pr.user_id WHERE pr.user_id = p_user AND pr.revoked_at IS NULL AND u.realm = 'platform'; IF r IS NULL THEN RAISE EXCEPTION 'staff_not_found'; END IF; -- parolasını henüz belirlememiş (etkin olmayan) personel de atanabilir
  IF (p_duty IN ('primary', 'backup') AND r NOT IN ('consultant', 'admin')) OR (p_duty = 'methodologist' AND r NOT IN ('methodologist', 'admin')) OR (p_duty = 'auditor' AND r NOT IN ('auditor', 'admin')) OR (p_duty = 'admin_scope' AND r <> 'admin') THEN RAISE EXCEPTION 'duty_role_mismatch'; END IF;
  SELECT duty INTO prev FROM platform_tenant_access WHERE user_id = p_user AND tenant_id = p_tenant AND revoked_at IS NULL;
  INSERT INTO platform_tenant_access (user_id, tenant_id, granted_by, duty, reason, valid_from, valid_to) VALUES (p_user, p_tenant, p_actor, p_duty, p_reason, CURRENT_DATE, p_valid_to)
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET duty = EXCLUDED.duty, granted_by = p_actor, granted_at = now(), reason = p_reason, valid_from = CURRENT_DATE, valid_to = p_valid_to, revoked_at = NULL, revoked_by = NULL, version = platform_tenant_access.version + 1;
  RETURN prev;
END $$;
CREATE OR REPLACE FUNCTION platform_unassign(p_actor uuid, p_user uuid, p_tenant uuid, p_reason text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev text;
BEGIN
  IF NOT platform_is_admin(p_actor) THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  SELECT duty INTO prev FROM platform_tenant_access WHERE user_id = p_user AND tenant_id = p_tenant AND revoked_at IS NULL; IF prev IS NULL THEN RAISE EXCEPTION 'assignment_not_found'; END IF;
  IF prev = 'primary' THEN RAISE EXCEPTION 'primary_handover_required'; END IF;
  IF prev = 'admin_scope' AND (SELECT COUNT(*) FROM platform_tenant_access a JOIN platform_role r ON r.user_id = a.user_id AND r.revoked_at IS NULL AND r.role = 'admin' WHERE a.tenant_id = p_tenant AND a.revoked_at IS NULL) <= 1 THEN RAISE EXCEPTION 'last_admin'; END IF;
  UPDATE platform_tenant_access SET revoked_at = now(), revoked_by = p_actor, reason = p_reason, version = version + 1 WHERE user_id = p_user AND tenant_id = p_tenant;
  RETURN prev;
END $$;
-- devir: önceki görev sahibi aynı işlemde yedeğe alınır (yedek boşsa) ya da görevden çıkarılır; ardından yeni kişi atanır (tek sorumlu boşluğu oluşmaz)
CREATE OR REPLACE FUNCTION platform_handover(p_actor uuid, p_from uuid, p_to uuid, p_tenant uuid, p_duty text, p_reason text, p_valid_to date) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev text;
BEGIN
  IF NOT platform_is_admin(p_actor) THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF NOT platform_access_active(p_actor, p_tenant) THEN RAISE EXCEPTION 'tenant_not_authorized'; END IF;
  IF p_duty = 'primary' AND NOT EXISTS (SELECT 1 FROM platform_tenant_access WHERE tenant_id = p_tenant AND duty = 'backup' AND revoked_at IS NULL AND user_id <> p_from) THEN
    UPDATE platform_tenant_access SET duty = 'backup', reason = p_reason, version = version + 1 WHERE user_id = p_from AND tenant_id = p_tenant AND duty = 'primary' AND revoked_at IS NULL;
  ELSE
    UPDATE platform_tenant_access SET revoked_at = now(), revoked_by = p_actor, reason = p_reason, version = version + 1 WHERE user_id = p_from AND tenant_id = p_tenant AND duty = p_duty AND revoked_at IS NULL;
  END IF;
  prev := platform_assign(p_actor, p_to, p_tenant, p_duty, p_reason, p_valid_to);
  RETURN prev;
END $$;
GRANT EXECUTE ON FUNCTION platform_handover(uuid, uuid, uuid, uuid, text, text, date) TO hpw_app;
CREATE OR REPLACE FUNCTION platform_assignments(p_tenant uuid) RETURNS TABLE (user_id uuid, email text, display_name text, role text, duty text, valid_from date, valid_to date, reason text, granted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email, u.display_name, r.role, a.duty, a.valid_from, a.valid_to, a.reason, a.granted_at FROM platform_tenant_access a JOIN app_user u ON u.id = a.user_id LEFT JOIN platform_role r ON r.user_id = a.user_id AND r.revoked_at IS NULL
  WHERE a.tenant_id = p_tenant AND a.revoked_at IS NULL AND platform_access_active(app_user_id(), p_tenant) ORDER BY a.duty, u.display_name $$;
-- yetenek denetimi bağlamı: rol, şirket durumu, etkin müdahale (tek sorgu)
CREATE OR REPLACE FUNCTION platform_tenant_ctx(p_user uuid, p_tenant uuid) RETURNS TABLE (has_access boolean, role text, tenant_status text, intervention_id uuid, intervention_actor uuid, ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT platform_access_active(p_user, p_tenant), platform_role_of(p_user), (SELECT status FROM tenant WHERE id = p_tenant),
    i.id, i.actor_id, i.ends_at FROM (SELECT 1) x LEFT JOIN platform_intervention i ON i.tenant_id = p_tenant AND i.ended_at IS NULL AND i.ends_at > now() $$;
-- ilk kurulum: bootstrap edilen hesap Sistem Yöneticisi olur
CREATE OR REPLACE FUNCTION platform_bootstrap(p_email text, p_display_name text, p_password_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(7712001);
  IF EXISTS (SELECT 1 FROM app_user WHERE realm = 'platform') THEN RAISE EXCEPTION 'already_bootstrapped'; END IF;
  INSERT INTO app_user (email, display_name, realm, password_hash, status) VALUES (p_email, p_display_name, 'platform', p_password_hash, 'active') RETURNING id INTO uid;
  INSERT INTO platform_role (user_id, role, reason) VALUES (uid, 'admin', 'ilk kurulum');
  RETURN uid;
END $$;
GRANT EXECUTE ON FUNCTION platform_access_active(uuid, uuid), platform_write_ok(), platform_is_admin(uuid), platform_role_of(uuid), platform_staff_list(), platform_role_set(uuid, uuid, text, text), platform_role_revoke(uuid, uuid, text), platform_assign(uuid, uuid, uuid, text, text, date), platform_unassign(uuid, uuid, uuid, text), platform_assignments(uuid), platform_tenant_ctx(uuid, uuid) TO hpw_app;
