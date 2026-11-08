# ADR-0001: Modüler monolit, olay tabanlı sınırlar

**Durum:** Kabul edildi (v2.1, 22.09.2026)

## Karar
Ekip küçük, tenant büyük. Tek kod tabanı, modül sınırları paket düzeyinde, modüller arası iletişim domain olayları (outbox). Ayrıştırma ihtiyacı doğduğunda sınırlar hazır.

## Gerekçe
Mikroservis operasyon yükü erken; dağıtık monolit riski modül sınırlarını lint ile koruyarak azaltılır.

## Sonuçlar
- Mimari belgenin ilgili bölümü bağlayıcıdır; değişiklik yeni ADR gerektirir.
- Kabul testleri `docs/testing/acceptance-tests.md` içinde bu kararı doğrular.
