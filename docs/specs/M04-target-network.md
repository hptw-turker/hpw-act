# M04 — Hedef ağı, kohort, cascade, istisna, çatışma

**Mimari bölüm:** 8 · **Faz:** 0 (istisna Faz 1, çatışma Faz 2)

## Amaç
Sayısal hedefleri bir ağ olarak yönetir; dondurulmuş kohort üzerinde fizibilite kontrollü dağıtım; onay ve istisna müzakeresi; çatışma tespiti.

## Nesneler
Target (sürümlü), TargetRelationship, TargetCohort, CohortMember, AllocationRun, ExceptionRequest, TargetConflict, BusinessGoal.

## Kurallar ve algoritmalar
- Kohort politikaları BASELINE_FROZEN (varsayılan), CURRENT_ORG_DYNAMIC, LINEAGE_ADJUSTED; `no_baseline` paydada değil (I-09); ağırlık `aggregation_weight` (resmî), gizli birim aritmetiğe girer ama sayısal çıktı vermez (I-39).
- v2.3 (ADR-0026): ambition, yerel hedef, fonksiyonel KPI ve katkı projeksiyonu ayrı tablolar; `target_relationship` yalnız kapsam; `action_objective_link` aksiyon↔hedef. Uzlaştırma çıktısı `contribution_projection` satırlarını üretir (değiştirilemez). Projeksiyon ≠ takip dönemi gerçek üst sonuç.
- v2.2 (ADR-0018): `proposeLocal()` her birim için ambition'dan bağımsız yerel hedef (akran dağılımı P65/P80 ≥ minPeerSample, yoksa metodoloğun kalıcı bantları; anlamlı en küçük hareketin altında MAINTAIN). `reconcile()` resmî ağırlıklarla desteklenen değer, azami ve durum: SUPPORTED / GAP (esnetme seçeneği, uygulanmaz) / INFEASIBLE (ambition düşür / merkezi müdahale / süre). TargetReconciliationRun yeniden üretilebilir. Katkı tahmini yalnız bölge/merkez görünümünde.
- Onay: politika içi hedefler toplu onaya uygun; istisnalar ilgili yöneticiye; şube kabulü açık adım (ADR-0022).
- Kanonik kenar kısıtı partial unique index (I-10); ResponsibilityAllocation aritmetiğe girmez (I-11).
- Onay zinciri tenant ayarı; istisna: talep → onay/ret/karşı teklif; `requested_by ≠ approver`; onay üst hedefin expected_version'ı ile (T-15); onaylanan istisna → yeniden dengeleme ÖNERİSİ, kardeş hedefler sessizce değişmez (T-49).
- Roll-up: aynı dondurulmuş ağırlıklarla; fizibilite düşerse üst hedef `at_risk` + AttentionItem (T-50).
- Çatışma: aynı birim/yol, örtüşen dönem, aynı kaldıraç, ters yön → TargetConflict → ortak üst yöneticiye (Faz 2, BusinessGoal ile).
- Hedef zinciri ve measurement_plan (çok dönemli).

## API (özet; tam sözleşme docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz))
POST /targets (draft; unit, dimension, cycle, kind) · POST /targets/{id}/cohort (policy) → cohort · POST /targets/{id}/allocate → AllocationRun · GET /allocation-runs/{id} (proposals, contribution, infeasibility) · POST /targets/{id}/submit · POST /targets/{id}/approve (If-Match) · POST /targets/{id}/exceptions · POST /exceptions/{id}/decide (approve|reject|counter, If-Match parent) · GET /targets/{id}/explain ("Neden 60?").

## Olaylar
`Target.Drafted/Submitted/Approved/Versioned/AtRisk/Closed`, `Cohort.Frozen`, `Allocation.Completed/Infeasible`, `Exception.Requested/Decided`, `TargetConflict.Detected/Resolved`.

## Kabul kriterleri
T-02, T-03, T-04, T-05, T-07, T-09, T-14, T-15, T-49, T-50, T-52.
