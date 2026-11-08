-- 0018 v2.10.1 bağımsız denetim kapanışı (0014–0017 değiştirilmez)
-- V210-02: merkez ve müşteri kullanıma açılış geçerliliğini AYNI hesapla değerlendirir. Müşteri alanı, HPW atamalarını yalnız kendi şirketi için,
-- yalnız kurulum kanıtı alanlarıyla (kimlik, ad, görev, rol) okuyabilir; platform alanında atanmış erişim kuralı aynen geçerli.
CREATE OR REPLACE FUNCTION platform_assignments_onboarding(p_tenant uuid) RETURNS TABLE (user_id uuid, display_name text, duty text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.user_id, u.display_name, a.duty, r.role FROM platform_tenant_access a JOIN app_user u ON u.id = a.user_id LEFT JOIN platform_role r ON r.user_id = a.user_id AND r.revoked_at IS NULL
  WHERE a.tenant_id = p_tenant AND a.revoked_at IS NULL AND a.valid_from <= CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to >= CURRENT_DATE)
    AND ((app_realm() = 'platform' AND platform_access_active(app_user_id(), p_tenant)) OR (app_realm() = 'customer' AND app_tenant_id() = p_tenant))
  ORDER BY a.duty, u.display_name $$;
GRANT EXECUTE ON FUNCTION platform_assignments_onboarding(uuid) TO hpw_app;
