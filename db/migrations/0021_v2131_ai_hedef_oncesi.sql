-- v2.13.1: AI planı hedef kararından ÖNCE (hedef önizlemesi bağlamında) üretilebilir ve hedef oluşturulunca aynı plan, yeni sağlayıcı çağrısı yapılmadan hedefe bağlanır.
-- 0020 değiştirilmez. Önizleme planı: target_id NULL, şirket + dönem + birim + madde + parmak iziyle saklanır. Bağlama yalnız target_id sütununu bir kez doldurur
-- (uygulama rolüne yalnız bu sütunda UPDATE yetkisi verilir; plan içeriği değişmez). Hedefe bağlanmamış plan gerçek hedef ya da aksiyon kaydı değildir.
ALTER TABLE ai_plan ALTER COLUMN target_id DROP NOT NULL;
ALTER TABLE ai_plan ADD COLUMN IF NOT EXISTS bound_at timestamptz;
CREATE INDEX IF NOT EXISTS ai_plan_preview_idx ON ai_plan (tenant_id, cycle_id, unit_id, item_code, fingerprint, created_at DESC) WHERE target_id IS NULL;
GRANT UPDATE (target_id, bound_at) ON ai_plan TO hpw_app;
-- önizleme çağrılarının günlüğü (hedef henüz yok): target_id isteğe bağlı; birim ve madde kaydedilir (içerik ya da anahtar yazılmaz)
ALTER TABLE ai_call_log ALTER COLUMN target_id DROP NOT NULL;
ALTER TABLE ai_call_log ADD COLUMN IF NOT EXISTS unit_id uuid;
ALTER TABLE ai_call_log ADD COLUMN IF NOT EXISTS item_code text;
ALTER TABLE ai_call_log ADD CONSTRAINT ai_call_log_scope_ck CHECK (target_id IS NOT NULL OR (unit_id IS NOT NULL AND item_code IS NOT NULL));
