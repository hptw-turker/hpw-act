# ADR-0022: Politika tabanlı otomatik üretim, toplu onay, yalnız istisnada insan kararı

**Durum:** Kabul edildi (v2.2 semantik kilit, 23.09.2026)

## Karar
Sistem rutin olanı hazırlar ve yürütür; insanın önüne yalnız karar gerektiren istisnalar gelir. Politika sınırları içindeki hedefler toplu onaya uygundur ('167 uygun, 11 istisna'); istisnalar ilgili yöneticinin kararına gider. Şube müdürünün 'kabul et' adımı açıkça kalır (sahiplik bilinçli alınır). Onay modu tenant ayarı: ilk dönem 'açık onay', sonra 'politika tabanlı'.

## Gerekçe
GMY'nin 178 satırı tek tek onaylaması ölçekte darboğazdır; 648 düğüm × 2 hedef × 2 aksiyon = binlerce kayıt Genel Müdür'e gösterilemez.

## Sonuçlar
- Mimari belge bölüm 24 bağlayıcıdır; `packages/domain-core` bu kararı uygular, kabul testleri T-55..T-62 doğrular.
