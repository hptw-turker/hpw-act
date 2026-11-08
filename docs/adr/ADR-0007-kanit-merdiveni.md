# ADR-0007: Kanıt merdiveni, otomatik ret yok, SoD sert

**Durum:** Kabul edildi (v2.1, 22.09.2026)

## Karar
declared→submitted→verified/partial→kpi_confirmed→outcome_confirmed. Anomali → review_required, insan karar verir. Kritik kanıtta sahip ≠ doğrulayan politika ile. Aynı ana aksiyonun yerel uygulamaları arasındaki hash tekrarı sinyal değil.

## Gerekçe
Sahte kanıt yakalanır, meşru paylaşım cezalandırılmaz, yanlış pozitifte sistem değil insan karar verir.

## Sonuçlar
- Mimari belgenin ilgili bölümü bağlayıcıdır; değişiklik yeni ADR gerektirir.
- Kabul testleri `docs/testing/acceptance-tests.md` içinde bu kararı doğrular.
