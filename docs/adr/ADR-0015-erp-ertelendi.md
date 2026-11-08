# ADR-0015: ResourceRequirement/Commitment manuel; ERP bağlayıcısı talebe bağlı

**Durum:** Kabul edildi (v2.1, 22.09.2026)

## Karar
Nesneler Faz 1'de manuel girişle; SAP/Oracle bağlayıcısı somut müşteri talebiyle Faz 3.

## Gerekçe
Ürün sınırı; müşterilerin çoğu bu iş için ERP bağlamayacak.

## Sonuçlar
- Mimari belgenin ilgili bölümü bağlayıcıdır; değişiklik yeni ADR gerektirir.
- Kabul testleri `docs/testing/acceptance-tests.md` içinde bu kararı doğrular.
