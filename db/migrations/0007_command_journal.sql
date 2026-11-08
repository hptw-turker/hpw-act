-- HPW Act — 0007: komut günlüğü (F99-02) ve makbuzda etkilenen birim kümesi (F99-03)
CREATE TABLE IF NOT EXISTS command_journal (
  tenant_id uuid NOT NULL,
  command_key text NOT NULL,
  actor_id uuid,
  committed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, command_key)
);
ALTER TABLE command_journal ENABLE ROW LEVEL SECURITY; ALTER TABLE command_journal FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON command_journal;
CREATE POLICY tenant_isolation ON command_journal USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());
GRANT SELECT, INSERT ON command_journal TO hpw_app;
ALTER TABLE idempotency_key ADD COLUMN IF NOT EXISTS resource_unit_ids uuid[];
-- P0-3: kabul edilen davetin tüketilmiş token hash'i (yanıt kaybı kurtarma); token_hash NULL'a çekildiği için ayrı sütun
ALTER TABLE invitation ADD COLUMN IF NOT EXISTS consumed_token_hash text;
CREATE OR REPLACE FUNCTION invitation_mark_consumed(p_hash text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE invitation i SET consumed_token_hash = p_hash FROM app_user u WHERE u.id = i.user_id AND i.status = 'accepted' AND i.consumed_token_hash IS NULL AND i.accepted_at > now() - interval '1 minute' AND i.token_hash IS NULL AND i.id = (SELECT i2.id FROM invitation i2 WHERE i2.status = 'accepted' AND i2.consumed_token_hash IS NULL ORDER BY i2.accepted_at DESC LIMIT 1);
$$;
CREATE OR REPLACE FUNCTION invitation_used_peek(p_hash text) RETURNS TABLE (email text, status text, accepted_at timestamptz) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT u.email, i.status, i.accepted_at FROM invitation i JOIN app_user u ON u.id = i.user_id WHERE i.consumed_token_hash = p_hash AND i.status = 'accepted' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION invitation_mark_consumed(text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION invitation_mark_consumed(text) TO hpw_app;
REVOKE ALL ON FUNCTION invitation_used_peek(text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION invitation_used_peek(text) TO hpw_app;
