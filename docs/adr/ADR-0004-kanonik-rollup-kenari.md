# ADR-0004: Kanonik roll-up kenarı kısıtı ve ResponsibilityAllocation

**Durum:** Kabul edildi (v2.1, 22.09.2026)

## Karar
Bir (parent_target, child_unit) çifti için aktif inherited/shared/exception kenarı en fazla bir tane (partial unique index). Sorumluluk payları ResponsibilityAllocation'da, skor matematiğine girmez.

## Gerekçe
Matris organizasyonda çift sayım DB düzeyinde engellenir; %40/%35/%25 gibi paylar hesap verebilirlik ve açıklama içindir.

## Sonuçlar
- Mimari belgenin ilgili bölümü bağlayıcıdır; değişiklik yeni ADR gerektirir.
- Kabul testleri `docs/testing/acceptance-tests.md` içinde bu kararı doğrular.
