-- 0016 v2.9.1 bağımsız denetim kapanışı (0014/0015 değiştirilmez; düzeltmeler ileri migrasyonla)
-- V290-04: atama bitirmede şirket kapsamı; rol modeli değişmezleri (ana danışman, görev-rol uyumu); son yönetici eşzamanlılığı (ortak kilit);
-- V290-06: müdahale izinin tekilliği; V290-05: MFA sırrının yeni anahtarla yeniden mühürlenmesi (anahtar değişimi)

-- rol ve görev uyumu tek yerde
CREATE OR REPLACE FUNCTION platform_duty_ok(p_role text, p_duty text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_role WHEN 'admin' THEN true WHEN 'consultant' THEN p_duty IN ('primary', 'backup') WHEN 'methodologist' THEN p_duty = 'methodologist' WHEN 'auditor' THEN p_duty = 'auditor' ELSE false END $$;

-- V290-04: önce şirket kapsamı (yetkisiz aktöre kaydın varlığı sızmaz), sonra kayıt; ortak kilit (son yönetici sayımı)
CREATE OR REPLACE FUNCTION platform_unassign(p_actor uuid, p_user uuid, p_tenant uuid, p_reason text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev text;
BEGIN
  IF NOT platform_is_admin(p_actor) THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF NOT platform_access_active(p_actor, p_tenant) THEN RAISE EXCEPTION 'tenant_not_authorized'; END IF;
  PERFORM pg_advisory_xact_lock(7712002);
  SELECT duty INTO prev FROM platform_tenant_access WHERE user_id = p_user AND tenant_id = p_tenant AND revoked_at IS NULL FOR UPDATE; IF prev IS NULL THEN RAISE EXCEPTION 'assignment_not_found'; END IF;
  IF prev = 'primary' THEN RAISE EXCEPTION 'primary_handover_required'; END IF;
  IF prev = 'admin_scope' AND (SELECT COUNT(*) FROM platform_tenant_access a JOIN platform_role r ON r.user_id = a.user_id AND r.revoked_at IS NULL AND r.role = 'admin' WHERE a.tenant_id = p_tenant AND a.revoked_at IS NULL) <= 1 THEN RAISE EXCEPTION 'last_admin'; END IF;
  UPDATE platform_tenant_access SET revoked_at = now(), revoked_by = p_actor, reason = p_reason, version = version + 1 WHERE user_id = p_user AND tenant_id = p_tenant;
  RETURN prev;
END $$;

-- ana danışman değişmezi: mevcut ana danışman atama yoluyla başka göreve çevrilemez (devir fonksiyonu kendi içinde çevirir); görev-rol uyumu
CREATE OR REPLACE FUNCTION platform_assign(p_actor uuid, p_user uuid, p_tenant uuid, p_duty text, p_reason text, p_valid_to date) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev text; r text;
BEGIN
  IF NOT platform_is_admin(p_actor) THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF NOT platform_access_active(p_actor, p_tenant) THEN RAISE EXCEPTION 'tenant_not_authorized'; END IF;
  PERFORM pg_advisory_xact_lock(7712002);
  SELECT pr.role INTO r FROM platform_role pr JOIN app_user u ON u.id = pr.user_id WHERE pr.user_id = p_user AND pr.revoked_at IS NULL AND u.realm = 'platform'; IF r IS NULL THEN RAISE EXCEPTION 'staff_not_found'; END IF;
  IF NOT platform_duty_ok(r, p_duty) THEN RAISE EXCEPTION 'duty_role_mismatch'; END IF;
  SELECT duty INTO prev FROM platform_tenant_access WHERE user_id = p_user AND tenant_id = p_tenant AND revoked_at IS NULL FOR UPDATE;
  IF prev = 'primary' AND p_duty <> 'primary' AND COALESCE(current_setting('app.platform_handover', true), '') <> 'on' THEN RAISE EXCEPTION 'primary_handover_required'; END IF;
  INSERT INTO platform_tenant_access (user_id, tenant_id, granted_by, duty, reason, valid_from, valid_to) VALUES (p_user, p_tenant, p_actor, p_duty, p_reason, CURRENT_DATE, p_valid_to)
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET duty = EXCLUDED.duty, granted_by = p_actor, granted_at = now(), reason = p_reason, valid_from = CURRENT_DATE, valid_to = p_valid_to, revoked_at = NULL, revoked_by = NULL, version = platform_tenant_access.version + 1;
  RETURN prev;
END $$;
-- devir: önceki sahibi kendi içinde yedeğe alır ya da görevden çıkarır; ardından yeni kişiyi atar (tek işlem, ortak kilit)
CREATE OR REPLACE FUNCTION platform_handover(p_actor uuid, p_from uuid, p_to uuid, p_tenant uuid, p_duty text, p_reason text, p_valid_to date) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev text; fr text;
BEGIN
  IF NOT platform_is_admin(p_actor) THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF NOT platform_access_active(p_actor, p_tenant) THEN RAISE EXCEPTION 'tenant_not_authorized'; END IF;
  PERFORM pg_advisory_xact_lock(7712002);
  SELECT pr.role INTO fr FROM platform_role pr WHERE pr.user_id = p_from AND pr.revoked_at IS NULL;
  -- yeni sahip şirkette başka bir görevdeyse (ör. yedek) o görev önce boşaltılır; aşağıdaki atama satırı yeniden etkinleştirir
  UPDATE platform_tenant_access SET revoked_at = now(), revoked_by = p_actor, version = version + 1 WHERE user_id = p_to AND tenant_id = p_tenant AND revoked_at IS NULL AND p_to <> p_from;
  IF p_duty = 'primary' AND platform_duty_ok(fr, 'backup') AND NOT EXISTS (SELECT 1 FROM platform_tenant_access WHERE tenant_id = p_tenant AND duty = 'backup' AND revoked_at IS NULL AND user_id <> p_from) THEN
    UPDATE platform_tenant_access SET duty = 'backup', reason = p_reason, version = version + 1 WHERE user_id = p_from AND tenant_id = p_tenant AND duty = 'primary' AND revoked_at IS NULL;
  ELSE
    UPDATE platform_tenant_access SET revoked_at = now(), revoked_by = p_actor, reason = p_reason, version = version + 1 WHERE user_id = p_from AND tenant_id = p_tenant AND duty = p_duty AND revoked_at IS NULL;
  END IF;
  PERFORM set_config('app.platform_handover', 'on', true);
  prev := platform_assign(p_actor, p_to, p_tenant, p_duty, p_reason, p_valid_to);
  PERFORM set_config('app.platform_handover', 'off', true);
  RETURN prev;
END $$;

-- bir şirketin tek (etkin, yönetici rollü) yönetici kapsamı bu kişiyse şirket yönetilemez kalır
CREATE OR REPLACE FUNCTION platform_last_tenant_admin(p_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM platform_tenant_access a WHERE a.user_id = p_user AND a.revoked_at IS NULL AND a.duty = 'admin_scope'
    AND NOT EXISTS (SELECT 1 FROM platform_tenant_access b JOIN platform_role r ON r.user_id = b.user_id AND r.role = 'admin' AND r.revoked_at IS NULL WHERE b.tenant_id = a.tenant_id AND b.revoked_at IS NULL AND b.duty = 'admin_scope' AND b.user_id <> p_user)) $$;
-- rol değişimi: ortak kilit (son yönetici eşzamanlılığı); bütün etkin görevler yeni rolle uyumlu olmalı; ana danışmanlık devredilmeden rol görevi taşıyamayacak role düşürülemez
CREATE OR REPLACE FUNCTION platform_role_set(p_actor uuid, p_user uuid, p_role text, p_reason text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev text;
BEGIN
  IF NOT platform_is_admin(p_actor) THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  PERFORM pg_advisory_xact_lock(7712002);
  IF NOT platform_is_admin(p_actor) THEN RAISE EXCEPTION 'platform_admin_required'; END IF; -- kilit beklerken aktörün yetkisi düşmüş olabilir
  IF NOT EXISTS (SELECT 1 FROM app_user WHERE id = p_user AND realm = 'platform') THEN RAISE EXCEPTION 'staff_not_found'; END IF;
  SELECT role INTO prev FROM platform_role WHERE user_id = p_user AND revoked_at IS NULL;
  IF prev = 'admin' AND p_role <> 'admin' AND (SELECT COUNT(*) FROM platform_role WHERE role = 'admin' AND revoked_at IS NULL) <= 1 THEN RAISE EXCEPTION 'last_admin'; END IF;
  IF prev = 'admin' AND p_role <> 'admin' AND platform_last_tenant_admin(p_user) THEN RAISE EXCEPTION 'last_tenant_admin'; END IF;
  IF EXISTS (SELECT 1 FROM platform_tenant_access WHERE user_id = p_user AND revoked_at IS NULL AND duty = 'primary' AND NOT platform_duty_ok(p_role, duty)) THEN RAISE EXCEPTION 'primary_handover_required'; END IF;
  IF EXISTS (SELECT 1 FROM platform_tenant_access WHERE user_id = p_user AND revoked_at IS NULL AND NOT platform_duty_ok(p_role, duty)) THEN RAISE EXCEPTION 'role_duty_conflict'; END IF;
  INSERT INTO platform_role (user_id, role, granted_by, reason) VALUES (p_user, p_role, p_actor, p_reason)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, granted_by = p_actor, granted_at = now(), revoked_at = NULL, revoked_by = NULL, reason = p_reason, version = platform_role.version + 1;
  DELETE FROM session WHERE user_id = p_user AND realm = 'platform' AND prev IS DISTINCT FROM p_role;
  RETURN prev;
END $$;
CREATE OR REPLACE FUNCTION platform_role_revoke(p_actor uuid, p_user uuid, p_reason text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev text;
BEGIN
  IF NOT platform_is_admin(p_actor) THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  PERFORM pg_advisory_xact_lock(7712002);
  IF NOT platform_is_admin(p_actor) THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  SELECT role INTO prev FROM platform_role WHERE user_id = p_user AND revoked_at IS NULL; IF prev IS NULL THEN RAISE EXCEPTION 'staff_not_found'; END IF;
  IF prev = 'admin' AND (SELECT COUNT(*) FROM platform_role WHERE role = 'admin' AND revoked_at IS NULL) <= 1 THEN RAISE EXCEPTION 'last_admin'; END IF;
  IF EXISTS (SELECT 1 FROM platform_tenant_access WHERE user_id = p_user AND duty = 'primary' AND revoked_at IS NULL) THEN RAISE EXCEPTION 'primary_handover_required'; END IF;
  IF platform_last_tenant_admin(p_user) THEN RAISE EXCEPTION 'last_tenant_admin'; END IF;
  UPDATE platform_role SET revoked_at = now(), revoked_by = p_actor, reason = p_reason, version = version + 1 WHERE user_id = p_user;
  UPDATE platform_tenant_access SET revoked_at = now(), revoked_by = p_actor, version = version + 1 WHERE user_id = p_user AND revoked_at IS NULL;
  DELETE FROM session WHERE user_id = p_user AND realm = 'platform';
  RETURN prev;
END $$;

-- V290-06: müdahale izi tekilliği (aynı müdahale + aynı istek anahtarı + aynı transaction sırası tek kayıt)
CREATE UNIQUE INDEX IF NOT EXISTS ux_pae_intervention_req ON platform_audit_event (intervention_id, request_id) WHERE action = 'intervention.write';

-- V290-05: anahtar değişimi — doğrulanmış sır yeni anahtarla yeniden mühürlenir (yalnız etkin sır; içerik değişmez)
CREATE OR REPLACE FUNCTION platform_mfa_reseal(p_user uuid, p_old text, p_new text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE platform_mfa SET secret_enc = p_new, updated_at = now() WHERE user_id = p_user AND secret_enc = p_old AND enabled_at IS NOT NULL; RETURN FOUND; END $$;
GRANT EXECUTE ON FUNCTION platform_duty_ok(text, text), platform_last_tenant_admin(uuid), platform_mfa_reseal(uuid, text, text) TO hpw_app;
