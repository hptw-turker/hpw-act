# ADR-0012: Tam event sourcing yok; ilişkisel güncel durum + audit/karar olayları + outbox

**Durum:** Kabul edildi (v2.1, 22.09.2026)

## Karar
Audit append-only ama kişisel veri referansla; silmede anonim kimlik.

## Gerekçe
KVKK silme hakkı ile değiştirilemez olay geçmişi çelişir; audit ve replay ihtiyacı outbox ve karar olaylarıyla karşılanır.

## Sonuçlar
- Mimari belgenin ilgili bölümü bağlayıcıdır; değişiklik yeni ADR gerektirir.
- Kabul testleri `docs/testing/acceptance-tests.md` içinde bu kararı doğrular.
