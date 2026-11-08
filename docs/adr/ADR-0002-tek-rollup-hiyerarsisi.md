# ADR-0002: Dönem başına tam olarak bir roll-up hiyerarşisi

**Durum:** Kabul edildi (v2.1, 22.09.2026)

## Karar
HierarchyGroup.is_rollup_for_cycle; skor toplama, baseline ve inherited katkı yalnız bu grup boyunca. Diğer ilişkiler sorumluluk/görünürlük.

## Gerekçe
Çift sayım imkânsız; "şube kime roll-up olacak" sorusu veri modelinde cevaplı. HPTW anket hiyerarşisi kazanır, HRIS diğer gruplara beslenir.

## Sonuçlar
- Mimari belgenin ilgili bölümü bağlayıcıdır; değişiklik yeni ADR gerektirir.
- Kabul testleri `docs/testing/acceptance-tests.md` içinde bu kararı doğrular.
