-- 0015 HPW merkezi dilim 1 (v2.9.0): platform rollerinde zorunlu MFA (TOTP, RFC 6238) ve hassas işlemlerde yeniden doğrulama (K9)
CREATE TABLE IF NOT EXISTS platform_mfa (
  user_id uuid PRIMARY KEY REFERENCES app_user(id),
  secret_enc text,                 -- etkin sır (uygulama anahtarıyla AES-GCM şifreli)
  pending_enc text,                -- kurulum sürerken doğrulanmamış sır
  enabled_at timestamptz,
  last_step bigint NOT NULL DEFAULT 0,   -- yeniden oynatma koruması: aynı ya da eski zaman adımı reddedilir
  recovery_hashes text[] NOT NULL DEFAULT '{}',
  reset_by uuid REFERENCES app_user(id), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE platform_mfa ENABLE ROW LEVEL SECURITY; ALTER TABLE platform_mfa FORCE ROW LEVEL SECURITY; -- doğrudan erişim yok; yalnız aşağıdaki fonksiyonlar
ALTER TABLE session ADD COLUMN IF NOT EXISTS mfa_at timestamptz;
-- oturum durumu: rol + MFA (tek sorgu; her platform isteğinde)
CREATE OR REPLACE FUNCTION platform_session_state(p_token_hash text, p_user uuid) RETURNS TABLE (role text, mfa_enabled boolean, mfa_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT platform_role_of(p_user), EXISTS (SELECT 1 FROM platform_mfa m WHERE m.user_id = p_user AND m.enabled_at IS NOT NULL), (SELECT s.mfa_at FROM session s WHERE s.token_hash = p_token_hash AND s.user_id = p_user) $$;
CREATE OR REPLACE FUNCTION platform_mfa_get(p_user uuid) RETURNS TABLE (secret_enc text, pending_enc text, enabled_at timestamptz, last_step bigint, recovery_left int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT m.secret_enc, m.pending_enc, m.enabled_at, m.last_step, COALESCE(array_length(m.recovery_hashes, 1), 0) FROM platform_mfa m WHERE m.user_id = p_user $$;
CREATE OR REPLACE FUNCTION platform_mfa_set_pending(p_user uuid, p_enc text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM platform_mfa WHERE user_id = p_user AND enabled_at IS NOT NULL) THEN RAISE EXCEPTION 'mfa_already_enabled'; END IF;
  INSERT INTO platform_mfa (user_id, pending_enc) VALUES (p_user, p_enc) ON CONFLICT (user_id) DO UPDATE SET pending_enc = EXCLUDED.pending_enc, updated_at = now();
END $$;
-- kurulum doğrulandı: bekleyen sır etkinleşir, kurtarma kodları (özet) kaydedilir, adım işaretlenir, oturum doğrulanmış olur
CREATE OR REPLACE FUNCTION platform_mfa_enable(p_user uuid, p_token_hash text, p_step bigint, p_recovery text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE platform_mfa SET secret_enc = pending_enc, pending_enc = NULL, enabled_at = now(), last_step = p_step, recovery_hashes = p_recovery, updated_at = now() WHERE user_id = p_user AND pending_enc IS NOT NULL AND enabled_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'mfa_not_pending'; END IF;
  UPDATE session SET mfa_at = now() WHERE token_hash = p_token_hash AND user_id = p_user;
END $$;
-- giriş ikinci adımı ya da yeniden doğrulama: adım son kullanılandan büyük olmalı
CREATE OR REPLACE FUNCTION platform_mfa_accept(p_user uuid, p_token_hash text, p_step bigint) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE platform_mfa SET last_step = p_step, updated_at = now() WHERE user_id = p_user AND enabled_at IS NOT NULL AND last_step < p_step;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE session SET mfa_at = now() WHERE token_hash = p_token_hash AND user_id = p_user; RETURN true;
END $$;
-- kurtarma kodu: tek kullanımlık
CREATE OR REPLACE FUNCTION platform_mfa_use_recovery(p_user uuid, p_token_hash text, p_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE platform_mfa SET recovery_hashes = array_remove(recovery_hashes, p_hash), updated_at = now() WHERE user_id = p_user AND enabled_at IS NOT NULL AND p_hash = ANY (recovery_hashes);
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE session SET mfa_at = now() WHERE token_hash = p_token_hash AND user_id = p_user; RETURN true;
END $$;
-- sıfırlama: yalnız başka bir Sistem Yöneticisi; kişinin oturumları kapanır, sonraki girişte yeniden kurulum
CREATE OR REPLACE FUNCTION platform_mfa_reset(p_actor uuid, p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT platform_is_admin(p_actor) THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF p_actor = p_user THEN RAISE EXCEPTION 'mfa_self_reset'; END IF;
  DELETE FROM platform_mfa WHERE user_id = p_user; DELETE FROM session WHERE user_id = p_user AND realm = 'platform';
END $$;
GRANT EXECUTE ON FUNCTION platform_session_state(text, uuid), platform_mfa_get(uuid), platform_mfa_set_pending(uuid, text), platform_mfa_enable(uuid, text, bigint, text[]), platform_mfa_accept(uuid, text, bigint), platform_mfa_use_recovery(uuid, text, text), platform_mfa_reset(uuid, uuid) TO hpw_app;
-- doğrudan tablo erişimi hiçbir alan için yok (yalnız SECURITY DEFINER fonksiyonlar); açık ret politikası
DROP POLICY IF EXISTS platform_mfa_none ON platform_mfa; CREATE POLICY platform_mfa_none ON platform_mfa USING (false) WITH CHECK (false);
