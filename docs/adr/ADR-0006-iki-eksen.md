# ADR-0006: execution_status ve impact_status ayrı eksenler

**Durum:** Kabul edildi (v2.1, 22.09.2026)

## Karar
Hiçbir DTO/ekran ikisini tek sayıya indirgemez. HealthScore yalnız iç risk sinyali.

## Gerekçe
"Uygulama %100, etki negatif" ifade edilebilmeli; task completion ≠ deneyim iyileşmesi.

## Sonuçlar
- Mimari belgenin ilgili bölümü bağlayıcıdır; değişiklik yeni ADR gerektirir.
- Kabul testleri `docs/testing/acceptance-tests.md` içinde bu kararı doğrular.
