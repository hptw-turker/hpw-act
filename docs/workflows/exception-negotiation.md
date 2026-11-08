# Süreç: İstisna müzakeresi

**Faz:** Faz 1 · Yürütücü: WorkflowInstance (motor bağımsız; Faz 0 Postgres adım yürütücüsü)

Tetikleyici: `POST /targets/{id}/exceptions`.
1. validate — talep eden hedefin sahibi/accountable'ı mı; SoD: requester ≠ approver adayı.
2. snapshot — üst hedef `parent_version` kaydedilir.
3. notify_approver — AttentionItem(type=exception_pending, audience=approver, sla=5 iş günü).
4. wait_decision (human) — approve | reject | counter. Karar `If-Match parent_version` ile; uyuşmazlık → step 2'ye dön (recompute).
5. on_counter → notify_requester (AttentionItem) → wait_requester (accept → 6; reject → 4).
6. apply — TargetRelationship.type=exception, exception_value; Target.Versioned.
7. reallocate — `allocate()` yeniden; sonuç FEASIBLE → bitir; INFEASIBLE → AttentionItem(type=feasibility_dropped, audience=parent owner, options=[rebalance, accept_risk, lower_parent]).
8. on_rebalance → kardeş hedefler için yeni ÖNERİ hedefleri (draft), onların onayına; onaylı hedefler değiştirilmez.
Timer: step 4 SLA aşımı → escalated. Compensation: step 6 sonrası hata → exception geri alınır, audit.
