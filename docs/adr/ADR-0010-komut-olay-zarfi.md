# ADR-0010: Komut zarfı, iyimser eşzamanlılık, olay tekilleştirme

**Durum:** Kabul edildi (v2.1, 22.09.2026)

## Karar
command_id + expected_version + correlation/causation; 409 değişen alanlarla; command_log; olay zarfı event_id; tüketici dedupe; DLQ; replay.

## Gerekçe
2.400 eşzamanlı yönetici, HRIS reorg, toplu atama ve tekrar teslimat aynı anda: hedef kaybolmaz, çift sahip oluşmaz, çift escalation olmaz.

## Sonuçlar
- Mimari belgenin ilgili bölümü bağlayıcıdır; değişiklik yeni ADR gerektirir.
- Kabul testleri `docs/testing/acceptance-tests.md` içinde bu kararı doğrular.
