-- HPW Act — 0006: M10/M11 ve Y01/Y02 makbuz alanları (0005 kanonik yayımlanmış hâline geri alındı; bu alanlar yeni numaralı migrasyonda)
-- M10/M11: tekrar yanıtı kaynağın güncel yetkisine bağlı; tamamlanmış komut kaydı silinmez
ALTER TABLE idempotency_key ADD COLUMN IF NOT EXISTS resource_unit_id uuid;
ALTER TABLE idempotency_key ADD COLUMN IF NOT EXISTS required_profiles text[];
-- Y01/Y02: makbuz kapsamı zorunlu, rezervasyon sahiplik anahtarı
ALTER TABLE idempotency_key ADD COLUMN IF NOT EXISTS resource_scope text;
ALTER TABLE idempotency_key ADD COLUMN IF NOT EXISTS owner_token text;
-- crash penceresi (iş commit oldu, makbuz yazılmadı): komut kimliği audit_event.correlation_id ile izlenir; devralmada iş yapılmışsa yeniden yürütülmez
CREATE INDEX IF NOT EXISTS ix_audit_event_correlation ON audit_event (tenant_id, correlation_id) WHERE correlation_id IS NOT NULL;
-- HPW sürümlü madde eşdeğerlik kararı (Y05): metin/ölçek/kural dışında metodoloji kararı
CREATE TABLE IF NOT EXISTS item_equivalence_decision (
  tenant_id uuid NOT NULL,
  item_code text NOT NULL,
  from_instrument_version_id uuid NOT NULL,
  to_instrument_version_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('identical','equivalent','changed')),
  method_version text NOT NULL,
  decided_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, item_code, from_instrument_version_id, to_instrument_version_id)
);
ALTER TABLE item_equivalence_decision ENABLE ROW LEVEL SECURITY; ALTER TABLE item_equivalence_decision FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON item_equivalence_decision;
CREATE POLICY tenant_isolation ON item_equivalence_decision USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());
GRANT SELECT, INSERT, UPDATE ON item_equivalence_decision TO hpw_app;
