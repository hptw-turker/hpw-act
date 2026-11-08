-- HPW Act — 0004: HTML giriş ve N01–N36 sertleştirmesi (ilk kurulum durumu, hız sınırı anahtarları, tarihli yetki, kanıt slot politikası)
CREATE OR REPLACE FUNCTION platform_user_count() RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT COUNT(*)::int FROM app_user WHERE realm = 'platform' AND status <> 'disabled' $$;
GRANT EXECUTE ON FUNCTION platform_user_count() TO hpw_app;
-- parola token tüketimi: hesap pasifse ya da amaç uyuşmuyorsa tüketilmez; reset hesap etkinleştirme kararı değildir (N10)
CREATE OR REPLACE FUNCTION auth_password_token_consume(p_token_hash text, p_password_hash text) RETURNS TABLE (user_id uuid, email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; u record;
BEGIN
  SELECT * INTO t FROM password_token pt WHERE pt.token_hash = p_token_hash AND pt.used_at IS NULL AND pt.expires_at > now() FOR UPDATE; IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO u FROM app_user a WHERE a.id = t.user_id; IF u.status = 'disabled' THEN UPDATE password_token SET used_at = now() WHERE id = t.id; RETURN; END IF;
  UPDATE password_token SET used_at = now() WHERE id = t.id;
  UPDATE app_user SET password_hash = p_password_hash, status = CASE WHEN t.purpose = 'set' AND status = 'invited' THEN 'active' ELSE status END, updated_at = now() WHERE id = t.user_id;
  UPDATE session SET revoked_at = now() WHERE session.user_id = t.user_id AND revoked_at IS NULL;
  RETURN QUERY SELECT a.id, a.email FROM app_user a WHERE a.id = t.user_id;
END $$;
-- kanıt: gerçekleşme kimliği ile karşılanan plan slotu ayrı (N23): slot_key dolu ve geçerli kayıtlar plan slotunu karşılar; ek olaylar fulfills_slot=false
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS fulfills_slot boolean NOT NULL DEFAULT true;
-- hedef tarihçesi: rebase/keep kararı eski değerleri ezmez (N17)
ALTER TABLE local_target ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]';
-- takip değerlendirmesi: onay hangi değerlendirme kimliği ve sürümleriyle bağlandı (N25)
ALTER TABLE comparability_review ADD COLUMN IF NOT EXISTS assessment_id uuid;
-- tarihli organizasyon: CREATE'te valid_to saklanır (N08) — sütunlar zaten var; org_relationship/org_role effective_to kullanılıyor
-- N24: politika ile karşılanan (E0/E1) iş "bağımsız doğrulandı" değil "policy_met" olarak etiketlenir
ALTER TABLE action DROP CONSTRAINT IF EXISTS action_verification_state_check;
ALTER TABLE action ADD CONSTRAINT action_verification_state_check CHECK (verification_state IN ('pending','auto_verified','policy_met','human_verified','partial','needs_review','invalidated'));
ALTER TABLE evidence_verification DROP CONSTRAINT IF EXISTS evidence_verification_state_check;
ALTER TABLE evidence_verification ADD CONSTRAINT evidence_verification_state_check CHECK (state IN ('pending','auto_verified','policy_met','human_verified','partial','needs_review','invalidated'));
