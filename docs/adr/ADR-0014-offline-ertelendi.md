# ADR-0014: Çevrimdışı istemci ertelendi; komut zarfı hazır

**Durum:** Kabul edildi (v2.1, 22.09.2026)

## Karar
Düşük bağlantı yolu Teams/e-posta asenkron check-in. PWA + yerel komut kuyruğu müşteri segmenti gerektirirse. Geç gelen komutta anlamsal çatışma çözümü ilk günden.

## Gerekçe
Efor yüksek, hedef pazarda ihtiyaç doğrulanmadı; zarf hazır olduğu için sonradan eklemek migrasyon gerektirmez.

## Sonuçlar
- Mimari belgenin ilgili bölümü bağlayıcıdır; değişiklik yeni ADR gerektirir.
- Kabul testleri `docs/testing/acceptance-tests.md` içinde bu kararı doğrular.
