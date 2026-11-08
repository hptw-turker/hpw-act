-- 0019 v2.11.0 bekleyen işler (tasarım v2 §5.5, §7; MP08). 0001–0018 değiştirilmez. Kural davranışı: docs/tasarim/BEKLEYEN-ISLER-KURALLARI-v2.11.md
CREATE TABLE IF NOT EXISTS platform_work_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenant(id),
  rule text NOT NULL CHECK (rule IN ('setup_overdue','no_admin','invite_failed','import_pending','overdue_actions','verification_backlog','central_decision','inactive','methodology')),
  occurrence int NOT NULL DEFAULT 1,
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','claimed','snoozed','dismissed','tenant_inactive','resolved')),
  owner_role text NOT NULL CHECK (owner_role IN ('consultant','methodologist')),
  claimed_by uuid REFERENCES app_user(id), claimed_at timestamptz,
  snoozed_until timestamptz, dismissed_until timestamptz, state_reason text,
  opened_at timestamptz NOT NULL DEFAULT now(), due_at timestamptz NOT NULL, resolved_at timestamptz,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  eval_status text NOT NULL DEFAULT 'ok' CHECK (eval_status IN ('ok','unreadable','not_evaluable')), eval_error text,
  last_ok_eval_at timestamptz, last_eval_at timestamptz,
  version int NOT NULL DEFAULT 1,
  CHECK (state <> 'snoozed' OR snoozed_until IS NOT NULL), CHECK (state <> 'dismissed' OR dismissed_until IS NOT NULL),
  CHECK (state <> 'resolved' OR resolved_at IS NOT NULL)
);
-- şirket + kural başına en çok bir etkin iş (eşzamanlı değerlendirmede mükerrer açık iş olamaz)
CREATE UNIQUE INDEX IF NOT EXISTS ux_work_item_active ON platform_work_item (tenant_id, rule) WHERE state <> 'resolved';
CREATE INDEX IF NOT EXISTS ix_work_item_tenant ON platform_work_item (tenant_id, state);
-- şirket + kural değerlendirme durumu (iş olmasa da “hesaplanamadı / değerlendirilemedi / sorun yok” ayrımı ve güncellik)
CREATE TABLE IF NOT EXISTS platform_work_eval (
  tenant_id uuid NOT NULL REFERENCES tenant(id), rule text NOT NULL, status text NOT NULL CHECK (status IN ('ok','unreadable','not_evaluable')),
  detail text, last_ok_at timestamptz, last_attempt_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, rule)
);
-- merkez komutlarının tekrar güvenliği (işlem anahtarı; kullanıcı kapsamlı; yanıt aynı transaction'da saklanır)
CREATE TABLE IF NOT EXISTS platform_command (
  user_id uuid NOT NULL REFERENCES app_user(id), key text NOT NULL, route text NOT NULL, payload_hash text NOT NULL, tenant_id uuid,
  response_status int NOT NULL, response_body jsonb, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, key)
);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['platform_work_item','platform_work_eval'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS work_platform ON %I', t);
  EXECUTE format('CREATE POLICY work_platform ON %I FOR ALL USING (app_realm() = ''platform'' AND platform_access_active(app_user_id(), tenant_id)) WITH CHECK (app_realm() = ''platform'' AND platform_access_active(app_user_id(), tenant_id))', t);
  EXECUTE format('DROP POLICY IF EXISTS platform_write_guard_i ON %I', t); EXECUTE format('CREATE POLICY platform_write_guard_i ON %I AS RESTRICTIVE FOR INSERT WITH CHECK (platform_write_ok())', t);
  EXECUTE format('DROP POLICY IF EXISTS platform_write_guard_u ON %I', t); EXECUTE format('CREATE POLICY platform_write_guard_u ON %I AS RESTRICTIVE FOR UPDATE USING (platform_write_ok())', t);
  EXECUTE format('DROP POLICY IF EXISTS platform_write_guard_d ON %I', t); EXECUTE format('CREATE POLICY platform_write_guard_d ON %I AS RESTRICTIVE FOR DELETE USING (platform_write_ok())', t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO hpw_app', t);
END LOOP; END $$;
ALTER TABLE platform_command ENABLE ROW LEVEL SECURITY; ALTER TABLE platform_command FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS command_own ON platform_command; CREATE POLICY command_own ON platform_command FOR ALL USING (app_realm() = 'platform' AND user_id = app_user_id()) WITH CHECK (app_realm() = 'platform' AND user_id = app_user_id());
GRANT SELECT, INSERT ON platform_command TO hpw_app;
-- Kalıcı başarısız davet — TEK tanım (portföy, kurulum hesabı ve bekleyen işler aynı fonksiyonu kullanır; çağıranın RLS bağlamında çalışır):
-- etkin üyeliğin EN SON daveti kabul edilmemiş, iptal edilmemiş ve süresi dolmamış; o davetin EN SON teslimat denemesi kalıcı başarısız.
-- Aynı davetin birden çok denemesi tek sayılır; sonradan başarılı teslim/kabul eski hatayı gölgelemez; iptal ve süresi dolan davet teslimat hatası sayılmaz
-- (süresi dolan davet kurulum hesabında ayrıca “engelli” sayılır); başka şirketin teslimat kayıtları şirket eşleşmesiyle dışlanır.
CREATE OR REPLACE FUNCTION tenant_failed_invitations(p_tenant uuid) RETURNS TABLE (membership_id uuid, permission_profile text, invitation_id uuid)
LANGUAGE sql STABLE AS $$
  SELECT m.id, m.permission_profile, i.id FROM membership m
  JOIN LATERAL (SELECT id, status FROM invitation WHERE membership_id = m.id AND tenant_id = m.tenant_id ORDER BY created_at DESC, version DESC LIMIT 1) i ON true
  JOIN LATERAL (SELECT status FROM email_outbox WHERE invitation_id = i.id AND tenant_id = m.tenant_id ORDER BY created_at DESC, id DESC LIMIT 1) o ON true
  WHERE m.tenant_id = p_tenant AND m.status = 'active' AND i.status NOT IN ('accepted', 'revoked', 'expired') AND o.status = 'perm_fail' $$;
GRANT EXECUTE ON FUNCTION tenant_failed_invitations(uuid) TO hpw_app;
