-- 0017 v2.10.0 şirket işletimi (tasarım v2 dilim 2; "Çok Şirketli Merkez Paneli" gereksinimleri 27.09.2026 §4.2–4.3, §8, §10.2.4–5)
-- 1) yaşam döngüsü: aktif / durdurulmuş / arşivlenmiş (kurulum aşaması ayrı alan; arşiv silme değildir; arşivden dönüş önce durdurulmuş)
ALTER TABLE tenant DROP CONSTRAINT IF EXISTS tenant_status_check;
ALTER TABLE tenant ADD CONSTRAINT tenant_status_check CHECK (status IN ('active', 'suspended', 'archived'));
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES app_user(id);
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS archive_reason text;
-- 2) izlenen dönem (açıkça seçilir; en yeni dönem varsayılmaz) ve şirket işletim kaydının sürümü (expectedVersion)
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS tracked_cycle_id uuid;
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS tracked_cycle_set_by uuid REFERENCES app_user(id);
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS tracked_cycle_set_at timestamptz;
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS ops_version int NOT NULL DEFAULT 1;
-- 3) hizmet ve veri yönetimi kaydı (kurulum adımı 2): referans, kapsam, sorumlular, saklama politikası sürümü. Hukuki uygunluk kanıtı sayılmaz.
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS service_record jsonb;
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS service_record_by uuid REFERENCES app_user(id);
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS service_record_at timestamptz;
-- 4) elle onaylı kurulum adımları: kişi, zaman, gerekçe ve onaylanan kanıtın parmak izi (kaynak değişince onay "yeniden kontrol gerekli" olur)
CREATE TABLE IF NOT EXISTS onboarding_approval (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenant(id),
  step_key text NOT NULL CHECK (step_key IN ('service_record', 'go_live', 'go_live_customer')), -- go_live_customer: müşteri İK yöneticisinin kendi alanındaki teyidi
  approved_by uuid NOT NULL REFERENCES app_user(id), approved_at timestamptz NOT NULL DEFAULT now(), reason text NOT NULL CHECK (length(reason) >= 3),
  evidence_fingerprint text NOT NULL, superseded_at timestamptz
);
ALTER TABLE onboarding_approval DROP CONSTRAINT IF EXISTS onboarding_approval_step_key_check; ALTER TABLE onboarding_approval ADD CONSTRAINT onboarding_approval_step_key_check CHECK (step_key IN ('service_record', 'go_live', 'go_live_customer'));
CREATE UNIQUE INDEX IF NOT EXISTS ux_onboarding_approval_active ON onboarding_approval (tenant_id, step_key) WHERE superseded_at IS NULL;
ALTER TABLE onboarding_approval ENABLE ROW LEVEL SECURITY; ALTER TABLE onboarding_approval FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS onboarding_platform ON onboarding_approval; CREATE POLICY onboarding_platform ON onboarding_approval FOR ALL USING (app_realm() = 'platform' AND platform_access_active(app_user_id(), tenant_id)) WITH CHECK (app_realm() = 'platform' AND platform_access_active(app_user_id(), tenant_id));
DROP POLICY IF EXISTS onboarding_customer_read ON onboarding_approval; CREATE POLICY onboarding_customer_read ON onboarding_approval FOR SELECT USING (app_realm() = 'customer' AND tenant_id = app_tenant_id());
DROP POLICY IF EXISTS onboarding_customer_confirm ON onboarding_approval; CREATE POLICY onboarding_customer_confirm ON onboarding_approval FOR INSERT WITH CHECK (app_realm() = 'customer' AND tenant_id = app_tenant_id() AND step_key = 'go_live_customer');
DROP POLICY IF EXISTS onboarding_customer_supersede ON onboarding_approval; CREATE POLICY onboarding_customer_supersede ON onboarding_approval FOR UPDATE USING (app_realm() = 'customer' AND tenant_id = app_tenant_id() AND step_key = 'go_live_customer');
GRANT SELECT, INSERT, UPDATE ON onboarding_approval TO hpw_app;
-- izlenen dönem veri ilişkisi düzeyinde de aynı şirketin dönemi olmak zorunda (bileşik yabancı anahtar)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_tracked_cycle_fk') THEN ALTER TABLE tenant ADD CONSTRAINT tenant_tracked_cycle_fk FOREIGN KEY (id, tracked_cycle_id) REFERENCES survey_cycle (tenant_id, id); END IF; END $$;

-- 5) arşivlenmiş şirkete yalnız Sistem Yöneticisi ve Denetçi erişir (geçmiş için); durdurulmuş ve aktif şirkette atama kuralları aynen
CREATE OR REPLACE FUNCTION platform_access_active(p_user uuid, p_tenant uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM platform_tenant_access a JOIN app_user u ON u.id = a.user_id JOIN platform_role r ON r.user_id = a.user_id AND r.revoked_at IS NULL JOIN tenant t ON t.id = a.tenant_id
    WHERE a.user_id = p_user AND a.tenant_id = p_tenant AND u.realm = 'platform' AND u.status = 'active' AND a.revoked_at IS NULL AND a.valid_from <= CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to >= CURRENT_DATE)
      AND (t.status <> 'archived' OR r.role IN ('admin', 'auditor'))) $$;
-- müşteri tarafı: etkin olmayan (durdurulmuş ya da arşivlenmiş) şirkette girişte açıklayıcı ret
CREATE OR REPLACE FUNCTION auth_memberships_suspended(p_user uuid) RETURNS int
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT COUNT(*)::int FROM membership m JOIN tenant t ON t.id = m.tenant_id WHERE m.user_id = p_user AND m.status = 'active' AND t.status IN ('suspended', 'archived') $$;
-- durum geçişleri: aktif ↔ durdurulmuş; durdurulmuş → arşiv; arşiv → durdurulmuş (doğrudan etkinleştirme yok). Etkin olmayan şirkette müşteri oturumları kapanır.
CREATE OR REPLACE FUNCTION platform_set_tenant_status(p_actor uuid, p_tenant uuid, p_status text, p_reason text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev text;
BEGIN
  IF app_realm() <> 'platform' OR NOT auth_platform_has_tenant(p_actor, p_tenant) THEN RAISE EXCEPTION 'tenant_not_authorized'; END IF;
  IF NOT platform_is_admin(p_actor) THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF p_status NOT IN ('active', 'suspended', 'archived') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  SELECT status INTO prev FROM tenant WHERE id = p_tenant FOR UPDATE; IF prev IS NULL THEN RAISE EXCEPTION 'tenant_not_found'; END IF;
  IF prev = p_status THEN RETURN prev; END IF;
  IF NOT ((prev = 'active' AND p_status = 'suspended') OR (prev = 'suspended' AND p_status IN ('active', 'archived')) OR (prev = 'archived' AND p_status = 'suspended')) THEN RAISE EXCEPTION 'invalid_transition'; END IF;
  UPDATE tenant SET status = p_status, status_reason = p_reason, status_changed_at = now(), status_changed_by = p_actor, ops_version = ops_version + 1,
    archived_at = CASE WHEN p_status = 'archived' THEN now() WHEN prev = 'archived' THEN NULL ELSE archived_at END,
    archived_by = CASE WHEN p_status = 'archived' THEN p_actor WHEN prev = 'archived' THEN NULL ELSE archived_by END,
    archive_reason = CASE WHEN p_status = 'archived' THEN p_reason WHEN prev = 'archived' THEN NULL ELSE archive_reason END WHERE id = p_tenant;
  IF p_status <> 'active' THEN
    DELETE FROM session WHERE tenant_id = p_tenant AND realm = 'customer';          -- açık müşteri oturumları
    UPDATE platform_intervention SET ended_at = now(), ended_by = p_actor WHERE tenant_id = p_tenant AND ended_at IS NULL; -- süren müdahale yetkisi
  END IF;
  RETURN prev;
END $$;

-- 6) §10.2.4: mevcut ana danışmana başka bir görevin devri onun ana görevini sessizce silemez
CREATE OR REPLACE FUNCTION platform_handover(p_actor uuid, p_from uuid, p_to uuid, p_tenant uuid, p_duty text, p_reason text, p_valid_to date) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev text; fr text; toduty text;
BEGIN
  IF NOT platform_is_admin(p_actor) THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF NOT platform_access_active(p_actor, p_tenant) THEN RAISE EXCEPTION 'tenant_not_authorized'; END IF;
  PERFORM pg_advisory_xact_lock(7712002);
  SELECT duty INTO toduty FROM platform_tenant_access WHERE user_id = p_to AND tenant_id = p_tenant AND revoked_at IS NULL FOR UPDATE;
  IF toduty = 'primary' AND p_duty <> 'primary' THEN RAISE EXCEPTION 'primary_handover_required'; END IF;
  SELECT pr.role INTO fr FROM platform_role pr WHERE pr.user_id = p_from AND pr.revoked_at IS NULL;
  UPDATE platform_tenant_access SET revoked_at = now(), revoked_by = p_actor, version = version + 1 WHERE user_id = p_to AND tenant_id = p_tenant AND revoked_at IS NULL AND p_to <> p_from;
  IF p_duty = 'primary' AND platform_duty_ok(fr, 'backup') AND NOT EXISTS (SELECT 1 FROM platform_tenant_access WHERE tenant_id = p_tenant AND duty = 'backup' AND revoked_at IS NULL AND user_id <> p_from) THEN
    UPDATE platform_tenant_access SET duty = 'backup', reason = p_reason, version = version + 1 WHERE user_id = p_from AND tenant_id = p_tenant AND duty = 'primary' AND revoked_at IS NULL;
  ELSE
    UPDATE platform_tenant_access SET revoked_at = now(), revoked_by = p_actor, reason = p_reason, version = version + 1 WHERE user_id = p_from AND tenant_id = p_tenant AND duty = p_duty AND revoked_at IS NULL;
  END IF;
  PERFORM set_config('app.platform_handover', 'on', true);
  prev := platform_assign(p_actor, p_to, p_tenant, p_duty, p_reason, p_valid_to);
  PERFORM set_config('app.platform_handover', 'off', true);
  RETURN COALESCE(toduty, prev);
END $$;

-- 7) §10.2.5: müdahale izi tekilliği komutu da kapsar (aynı istemci anahtarının iki farklı komutta kullanımı izleri birleştirmez)
DROP INDEX IF EXISTS ux_pae_intervention_req;
CREATE UNIQUE INDEX IF NOT EXISTS ux_pae_intervention_req2 ON platform_audit_event (intervention_id, target_id, request_id) WHERE action = 'intervention.write';

-- 8) kuyruktaki e-postalar: etkin olmayan şirketin davet ve bildirimleri gönderilmez, bekletilir (şirket yeniden etkinleşince gönderilir); şirketsiz (platform) postalar etkilenmez
CREATE OR REPLACE FUNCTION outbox_claim(p_limit int) RETURNS SETOF email_outbox LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE email_outbox o SET status = 'processing', lease_until = now() + interval '2 minutes', attempts = attempts + 1
  WHERE o.id IN (SELECT e.id FROM email_outbox e LEFT JOIN tenant t ON t.id = e.tenant_id WHERE ((e.status IN ('queued','temp_fail') AND e.next_attempt_at <= now() AND e.attempts < 5) OR (e.status = 'processing' AND e.lease_until < now())) AND (e.tenant_id IS NULL OR t.status = 'active') ORDER BY e.created_at LIMIT p_limit FOR UPDATE OF e SKIP LOCKED)
  RETURNING o.* $$;
-- 9) şirket işletim alanlarının yazımı (yalnız bu sütunlar; satır erişimi RLS + platform yazma korumasıyla)
GRANT UPDATE (tracked_cycle_id, tracked_cycle_set_by, tracked_cycle_set_at, ops_version, service_record, service_record_by, service_record_at) ON tenant TO hpw_app;
-- 10) devam eden yazmalar: her müşteri ve HPW yazma transaction'ı başında şirket satırında paylaşımlı kilit alır ve durumu okur.
--     Durum değişikliği (FOR UPDATE) süren transaction'ların bitmesini bekler; sonrakiler etkin olmayan durumu görüp reddedilir.
CREATE OR REPLACE FUNCTION tenant_status_lock(p_tenant uuid) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT status FROM tenant WHERE id = p_tenant FOR SHARE $$;
GRANT EXECUTE ON FUNCTION tenant_status_lock(uuid) TO hpw_app;
