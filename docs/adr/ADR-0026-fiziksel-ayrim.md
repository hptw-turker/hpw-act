# ADR-0026: Ambition, yerel hedef ve katkı projeksiyonu fiziksel olarak ayrı tablolardır

**Durum:** Kabul edildi (v2.3 kanonik, 24.09.2026)

## Karar
`corporate_ambition` (istenen değer; kota değil; yerel hedef algoritmasına girdi olmaz), `local_target` (yalnız yerel veriden: baseline_result, öneri, fizibil aralık, onay; sahip rol), `functional_kpi` (skor aritmetiği dışı), `contribution_projection` (türetilmiş, uzlaştırma koşusuna bağlı, değiştirilemez, HEDEF DEĞİL). `target_relationship` yalnız kapsam/soy kütüğü içindir; aritmetik yalnız `target_reconciliation_run` içinde resmî ağırlıkla yapılır. `action_objective_link` aksiyonu yerel hedefe ya da fonksiyonel KPI'ya bağlar.

## Gerekçe
Aynı Target tablosunda `kind` ile ayrım geliştiriciyi üst-alt kota modeline davet eder; katkı bir hedef gibi algılanınca zamanla kotaya dönüşür. Semantik kilit veri modelinin kendisi olmalıdır.

## Sonuçlar
- Mimari belge v2.3 bağlayıcıdır; `packages/domain-core` ve `db/migrations/0001_core.sql` bu kararı uygular; kabul testleri T-64..T-69 doğrular.
