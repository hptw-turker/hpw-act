# ADR-0008: Karşılaştırılabilirlik bir kapıdır

**Durum:** Kabul edildi (v2.1, 22.09.2026)

## Karar
ComparabilityAssessment önce; not_comparable → attainment NOT_EVALUATED, impact insufficient_measurement; review_required → Metodolog/HR Admin onayı.

## Gerekçe
n 650→41, madde değişimi veya nüfus değişimi varken otomatik "tuttu" yazılmaz.

## Sonuçlar
- Mimari belgenin ilgili bölümü bağlayıcıdır; değişiklik yeni ADR gerektirir.
- Kabul testleri `docs/testing/acceptance-tests.md` içinde bu kararı doğrular.
