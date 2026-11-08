# Süreç: Kanıt incelemesi

**Faz:** Faz 0 (kişi doğrulaması), Faz 2 (anomali) · Yürütücü: WorkflowInstance (motor bağımsız; Faz 0 Postgres adım yürütücüsü)

Tetikleyici: `Action.CompletionDeclared` veya `Evidence.Submitted`.
1. lock_requirement — sürüm kilitli gereksinimi yükle.
2. evaluate_rules — count/duration/attendance/artifact/attestation/system_metric; coverage hesapla.
3. score — `evidenceConfidence()`; anomaly_flags.
4. route — Yüksek/Orta ve coverage=1 → verified; coverage<1 → partially_verified; Düşük → review_required + AttentionItem(audience=verifier, SoD ile seçilir).
5. wait_human (yalnız review_required) — verified | partially | rejected(reason). Verifier ≠ submitter ve vekili değil (T-20).
6. publish — Evidence.* olayı; execution_status geçişi state machine üzerinden.
7. schedule_kpi_check — öncü KPI penceresi için kalıcı timer; sonraki ölçümde outcome_confirmed adayı.
