# ADR-0025: Metrik birinci sınıf nesnedir: MetricDefinition, MetricVersion, ScoringRuleVersion

**Durum:** Kabul edildi (v2.3 kanonik, 24.09.2026)

## Karar
Hedef, sonuç ve öncelik `dimension` metnine değil `metric_version`'a bağlanır. MetricDefinition (item | dimension | index | enps | other), MetricVersion (etiket, ölçek, öncekiyle karşılaştırılabilirlik, geçerlilik), ScoringRuleVersion (formül, toplama yöntemi, hassasiyet, resmî kaynak). ItemCatalog/ItemVersion bu modele erir. "Güven 68" = metric TRUST · version 2026-v3 · scoring rule HPTW-2026-02.

## Gerekçe
Hedefin bağlı olduğu şey her zaman soru değildir (boyut, eNPS, Experience Index, ileride bileşik endeksler). Yıllar sonra "bu hedef hangi Güven metodolojisiydi" cevaplanabilmeli.

## Sonuçlar
- Mimari belge v2.3 bağlayıcıdır; `packages/domain-core` ve `db/migrations/0001_core.sql` bu kararı uygular; kabul testleri T-64..T-69 doğrular.
