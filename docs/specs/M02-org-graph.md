# M02 — Organizasyon grafı, sorumluluk haritası, reorg, vekâlet

**Mimari bölüm:** 5 · **Faz:** 0 (split/merge, öğrenen harita Faz 2)

## Amaç
Organizasyonu ağ olarak modeller; dönem başına tek roll-up hiyerarşisi; sorumluluk haritası; effective-dated birimler; reorg olayları süreç olarak; vekâlet ve sahipsiz iş.

## Nesneler
HierarchyGroup, OrgUnit, OrgRelationship, closure tabloları, ReorganizationEvent, OrgLineage, ResponsibilityMap, ResponsibilityAllocation, Person, RoleAssignment, Delegation, OrphanQueue (AttentionItem türü).

## Kurallar ve algoritmalar
- I-01: cycle başına tek `is_rollup` grubu; DB kısıtı `uq_rollup_group_per_cycle`.
- Closure table her grup için effective-dated: `(ancestor, descendant, depth, effective_from, effective_to)`. Kapsam sorguları buradan.
- Reorg türleri: rename, move, split (Faz 2), merge (Faz 2), close, open, absorb. Davranış tablosu mimari 5.3. Uygulama = WorkflowInstance; adımlar: validate → snapshot → apply units → rebind relationships → rebind targets/actions → create attention items → recompute feasibility → publish `Reorg.Applied`. Her adım idempotent (T-12, T-16).
- HRIS'ten gelen reorg → `draft`, HR Admin onayı gerekir; `external_event_id` ile tekil (T-37).
- Affected/Accountable/Enabling hesabı: topic → ResponsibilityMap; yönetici davranışı konularında accountable = affected.
- Deprovision sırası (mimari 5.4): inactive → login block → discover → orphan workflow → temporary accountable → new owner → actor ref retained (T-18, T-38).
- Delegation: kapsam × süre; çakışma reddedilir; süre bitince yetki döner (T-19).
- Zaman dilimi ve çalışma takvimi birimde; termin hesabı `businessDays(unit.calendar)` (T-43).

## API (özet; tam sözleşme docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz))
GET/POST /org/hierarchy-groups · POST /org/units · POST /org/relationships · GET /org/units/{id}/scope?group=&asOf= · POST /org/reorg-events (draft) · POST /org/reorg-events/{id}/approve · GET /org/reorg-events/{id} (adım durumu) · POST /org/delegations · GET /org/responsibility-map · POST /org/responsibility-allocations.

## Olaylar
`OrgUnit.Created/Changed/Closed`, `Reorg.Drafted/Approved/Applied/PartiallyApplied`, `Person.Deprovisioned`, `Ownership.Orphaned`, `Delegation.Started/Ended`.

## Kabul kriterleri
T-01, T-12, T-16, T-18, T-19, T-37, T-38, T-43.
