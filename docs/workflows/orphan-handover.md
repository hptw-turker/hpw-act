# Süreç: Sahipsiz iş devri

**Faz:** Faz 1 · Yürütücü: WorkflowInstance (motor bağımsız; Faz 0 Postgres adım yürütücüsü)

Tetikleyici: `Person.Deprovisioned` veya `OrgUnit.Closed`.
1. inactivate — Person.status=inactive; oturumlar kapatılır.
2. discover — sahip olduğu Target/Action/local_execution/exception onayları listesi.
3. temporary_escalation — her öğe için accountable/roll-up üstüne AttentionItem(type=orphan_ownership, severity=critical).
4. wait_assignment (human) — yeni sahip ata | üstlen | gerekçeli kapat; toplu işlem desteklenir.
5. apply — sahip değişikliği (version+1), Delegation kapanışları, bildirim aboneliklerinin devri.
6. onboarding — yeni sahip ilk girişte devralınan öğeler ekranı (devam ettir / yeniden değerlendir / kapatma talebi).
7. retain_actor_ref — audit'te önceki aktör referansı saklama politikasına göre korunur (T-18, T-38).
