-- v2.14.0 (Tasarım B): aksiyon panosunda yapay zekâ planından gelen adımların "yapıldı" olarak işaretlenmesi.
-- Plan adımı gerçekleşme kaydının (evidence) yerine geçmez; ayrı sayılır ve ayrı listelenir. Kayıt eklenir, silinmez, değiştirilmez (append-only).
-- Yetki: kanıt ekleyebilen roller (İK yöneticisi, İK iş ortağı, bölge müdürü, birim müdürü, aksiyon sorumlusu) kendi biriminde; politika karar noktasında uygulanır.
CREATE TABLE IF NOT EXISTS action_plan_step (
  tenant_id uuid NOT NULL,
  action_id uuid NOT NULL,
  step_index integer NOT NULL CHECK (step_index >= 0 AND step_index < 50),
  done_at date NOT NULL,
  note text,
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, action_id, step_index),
  FOREIGN KEY (tenant_id, action_id) REFERENCES action(tenant_id, id) ON DELETE CASCADE
);
ALTER TABLE action_plan_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_plan_step FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON action_plan_step;
CREATE POLICY tenant_isolation ON action_plan_step USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());
GRANT SELECT, INSERT ON action_plan_step TO hpw_app;
