-- HPW Act — 0005: V01–V28 tutarlılık. idempotency yetki parmak izi (V10), verili slot dönüşümü ve inceleme bayrağı (V17), slot tekilliği, hedef taslak durumu (V14), takip onayı bağı (V15), benchmark PATCH (V12)
ALTER TABLE idempotency_key ADD COLUMN IF NOT EXISTS grants_hash text;
-- V17: eski kayıtlarda slot_key yoksa (0004 öncesi) ritimden türet; aynı slottaki geçerli kayıtlardan yalnız en erken olan plan slotunu karşılar, diğerleri ek olay; slot türetilemeyen satır incelemeye
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS slot_review_needed boolean NOT NULL DEFAULT false;
UPDATE evidence e SET slot_key = CASE (a.requirement->>'cadence')
    WHEN 'monthly' THEN to_char(e.evidence_date, 'YYYY-MM')
    WHEN 'quarterly' THEN to_char(e.evidence_date, 'YYYY') || '-Q' || to_char(e.evidence_date, 'Q')
    WHEN 'weekly' THEN to_char(e.evidence_date, 'IYYY') || '-W' || to_char(e.evidence_date, 'IW')
    WHEN 'biweekly' THEN to_char(e.evidence_date, 'IYYY') || '-F' || ((to_char(e.evidence_date, 'IW')::int + 1) / 2)::text
    WHEN 'once' THEN 'once' ELSE NULL END
  FROM action a WHERE a.tenant_id = e.tenant_id AND a.id = e.action_id AND e.slot_key IS NULL AND e.validity = 'valid';
UPDATE evidence SET slot_review_needed = true WHERE validity = 'valid' AND slot_key IS NULL;
WITH ranked AS (SELECT tenant_id, id, row_number() OVER (PARTITION BY tenant_id, action_id, slot_key ORDER BY evidence_date, submitted_at, id) AS rn FROM evidence WHERE validity = 'valid' AND slot_key IS NOT NULL)
UPDATE evidence e SET fulfills_slot = (r.rn = 1) FROM ranked r WHERE r.tenant_id = e.tenant_id AND r.id = e.id;
CREATE UNIQUE INDEX IF NOT EXISTS ux_evidence_slot_fulfilled ON evidence (tenant_id, action_id, slot_key) WHERE validity = 'valid' AND fulfills_slot;
-- V14: rebase sonrası taslak öneri; onaylı değer yokken accepted/active olamaz
ALTER TABLE local_target DROP CONSTRAINT IF EXISTS local_target_status_check;
ALTER TABLE local_target ADD CONSTRAINT local_target_status_check CHECK (status IN ('proposed','policy_approvable','exception_requires_human','accepted','active','exception_pending','at_risk','under_review','pending_acceptance','achieved','partial','missed','closed_with_reason','sustain','continue_or_strengthen','redesign_or_root_cause','paused','superseded'));
ALTER TABLE local_target ADD CONSTRAINT local_target_approved_when_active CHECK (status NOT IN ('accepted','active') OR approved_target IS NOT NULL) NOT VALID;
-- V15: değerlendirme hangi takip sonucu ve hedef sürümüyle yapıldı
ALTER TABLE outcome_assessment ADD COLUMN IF NOT EXISTS followup_result_id uuid;
ALTER TABLE outcome_assessment ADD COLUMN IF NOT EXISTS target_version int;
ALTER TABLE outcome_assessment ADD COLUMN IF NOT EXISTS baseline_result_id uuid;
-- hazırlık ucu (V02): uygulama hesabı migrasyon defterini okuyabilir (yazamaz)
GRANT SELECT ON schema_migrations TO hpw_app;
