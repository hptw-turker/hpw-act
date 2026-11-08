# ADR-0005: Ana aksiyon / dağıtım / yerel uygulama

**Durum:** Kabul edildi (v2.1, 22.09.2026)

## Karar
Action.kind ∈ {standalone, master, local_execution}; Deployment kapsam kuralı; master durumu dağılımdır, tek completed yok.

## Gerekçe
400 şubede "merkezde tamamlandı ama 137 şube yapmadı" yanılgısı ortadan kalkar; 73 şube → kurumsal aksiyon aynı model.

## Sonuçlar
- Mimari belgenin ilgili bölümü bağlayıcıdır; değişiklik yeni ADR gerektirir.
- Kabul testleri `docs/testing/acceptance-tests.md` içinde bu kararı doğrular.
