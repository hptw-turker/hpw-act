-- 0013 HPW merkez paneli (temel): şirket durdurma/etkinleştirme, durum gerekçesi, müşteri oturumlarının kapatılması, durum sorgusu
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS status_reason text;
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS status_changed_by uuid REFERENCES app_user(id);
-- her istekte müşteri alanı için okunur (SECURITY DEFINER: RLS'den bağımsız, yalnız durum döner)
CREATE OR REPLACE FUNCTION tenant_status(p_tenant uuid) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT status FROM tenant WHERE id = p_tenant $$;
GRANT EXECUTE ON FUNCTION tenant_status(uuid) TO hpw_app;
-- platform yöneticisi yetkili olduğu şirketi durdurur ya da yeniden etkinleştirir; durdurmada o şirketin MÜŞTERİ oturumları hemen kapanır
CREATE OR REPLACE FUNCTION platform_set_tenant_status(p_actor uuid, p_tenant uuid, p_status text, p_reason text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev text;
BEGIN
  IF app_realm() <> 'platform' OR NOT auth_platform_has_tenant(p_actor, p_tenant) THEN RAISE EXCEPTION 'tenant_not_authorized'; END IF;
  IF p_status NOT IN ('active', 'suspended') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  SELECT status INTO prev FROM tenant WHERE id = p_tenant;
  IF prev IS NULL THEN RAISE EXCEPTION 'tenant_not_found'; END IF;
  UPDATE tenant SET status = p_status, status_reason = p_reason, status_changed_at = now(), status_changed_by = p_actor WHERE id = p_tenant;
  IF p_status = 'suspended' THEN DELETE FROM session WHERE tenant_id = p_tenant AND realm = 'customer'; END IF;
  RETURN prev;
END $$;
GRANT EXECUTE ON FUNCTION platform_set_tenant_status(uuid, uuid, text, text) TO hpw_app;
-- girişte açıklayıcı ret: kullanıcının etkin üyeliği var ama şirketi durdurulmuşsa
CREATE OR REPLACE FUNCTION auth_memberships_suspended(p_user uuid) RETURNS int
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT COUNT(*)::int FROM membership m JOIN tenant t ON t.id = m.tenant_id WHERE m.user_id = p_user AND m.status = 'active' AND t.status = 'suspended' $$;
GRANT EXECUTE ON FUNCTION auth_memberships_suspended(uuid) TO hpw_app;
