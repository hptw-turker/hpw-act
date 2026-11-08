# Süreç: Reorg devri

**Faz:** Faz 0 (rename/move/close/open), Faz 2 (split/merge) · Yürütücü: WorkflowInstance (motor bağımsız; Faz 0 Postgres adım yürütücüsü)

Tetikleyici: `POST /org/reorg-events/{id}/approve`.
1. validate — olay türü, kaynak/hedef birimler, effective_date; external_event_id tekil (T-37).
2. snapshot — etkilenen birimler, hedefler, aksiyonlar, sahipler listesi (öğe bazında WorkflowStep).
3. apply_units — effective_to/from; closure table güncelle (idempotent: zaten uygulanmışsa atla).
4. rebind_relationships — her etkilenen OrgRelationship için ayrı adım.
5. rebind_targets — her Target için: move → izle + üst ilişkiyi yeniden bağla; close → closed_with_reason; open → priority_only bağ; (split/merge Faz 2: lineage + yeni öneri).
6. rebind_actions — local_execution'lar birimi izler / iptal (lineage notu) / yeni birim için oluştur.
7. ownership — sahibi kalmayan öğeler → Ownership.Orphaned; yeni yönetici için handover AttentionItem (devam ettir / yeniden değerlendir / kapatma talebi).
8. recompute_feasibility — etkilenen üst hedefler için allocate(); at_risk ise AttentionItem.
9. recompute_scope — materialized scope.
10. publish — Reorg.Applied (veya PartiallyApplied + incident).
Her adım öğe listesi ile ilerler; yeniden başlatmada tamamlanmış öğeler atlanır (T-12, T-16).
