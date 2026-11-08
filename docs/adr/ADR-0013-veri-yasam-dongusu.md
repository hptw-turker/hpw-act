# ADR-0013: Veri yaşam döngüsü ayrı domain

**Durum:** Kabul edildi (v2.1, 22.09.2026)

## Karar
DataRetentionPolicy, EvidenceRetentionClass, LegalHold, DeletionRequest, AnonymizationJob, ExportRequest, DataTransferRegister.

## Gerekçe
KVKK imha yönetmeliği ve md.9 yurt dışı aktarım rejimi (standart sözleşme, 5 iş günü bildirim) nesne olarak izlenmeli.

## Sonuçlar
- Mimari belgenin ilgili bölümü bağlayıcıdır; değişiklik yeni ADR gerektirir.
- Kabul testleri `docs/testing/acceptance-tests.md` içinde bu kararı doğrular.
