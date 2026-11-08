# ADR-0003: Hedef matematiği dondurulmuş kohort üzerinde

**Durum:** Kabul edildi (v2.1, 22.09.2026)

## Karar
TargetCohort + CohortMember; politika BASELINE_FROZEN varsayılan, CURRENT_ORG_DYNAMIC operasyonel görünüm, LINEAGE_ADJUSTED split/merge. no_baseline üyeler paydaya girmez.

## Gerekçe
v2 pseudocode'daki t_i=b_i belirsizliği kapanır; organizasyon değişince çıta kaymaz; her AllocationRun yeniden üretilebilir.

## Sonuçlar
- Mimari belgenin ilgili bölümü bağlayıcıdır; değişiklik yeni ADR gerektirir.
- Kabul testleri `docs/testing/acceptance-tests.md` içinde bu kararı doğrular.
