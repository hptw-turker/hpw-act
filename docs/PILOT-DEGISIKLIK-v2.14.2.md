# HPW Act pilot v2.14.2 — son düzeltme (A06 hiza, A03 etiket, A04 gecikme); Tasarım B kilitli

**Başlangıç.** v2.14.1 / build 6f2603afd3e3 / ZIP SHA-256 da5e95c8f4423beb59f98036d60d6f896b9bed164a5a792cbf6edabf315de4cf doğrulandı. A01, A02, A05 yeniden uygulanmadı.

| # | Bulgu (önce) | Düzeltme | Sonuç (sonra) |
|---|---|---|---|
| A06 | thead ve tbody ayrı `display:table`; 390 px'de "Başlangıç" başlığı x=199,5 / veri x=309; 320/820 ve birim sonuçları tablosunda da kopuk | `ui/tb.tsx`: tablo tek parça, `div.tbl-kaydir` kabında; `tasarim-b.css` (≤820 px): ayrık kurallar geçersiz, tablo `display:table; width:max-content; min-width:100%; max-width:none`, kaydırma kapta. Sütun, sıra, yazı boyutu (12,5 px), düğmeler aynen | TR/EN 320/390/820: başlık–veri en büyük sapma 0 px; sayfa taşmıyor; sağdaki işlem düğmesine tablo içinden erişilip tıklanabiliyor (elementFromPoint); birim sonuçları 390: sapma 0 |
| A03 | Mobil SVG (viewBox 350): 98'de etiket sağ sınırı 350,2, 100'de 361 — kesik | `charts/Grafik.tsx` yalnız mobil sürüm: etiket sığıyorsa yerinde; sağ kenara yaslanınca sığıyorsa oraya (98); çubuğa binecekse aynı renk ve boyutta çubuğun hemen altına, sağa yaslı (100). Renk, boyut, ölçek, yerleşim aynen; masaüstü kodu değişmedi | TR/EN × 390/320 × 0/98/100: etiket viewBox içinde, iki değer etiketi dikey ayrık, eksen ve diğer yazılarla çakışma yok (getBBox) |
| A04 | `slotBitis()` doğal dönem sonunu kullanıyordu; weekly 2026-01-08–10 (W2), saat 2026-01-11T12:00Z gecikme yok. Ayrıca tek seferlikte termin günü erken gecikme; yıl sonunda W53/F27 gecikmesi geç | `pages/ChainB.tsx slotBitis()`: dönem bitişi = doğal dönem sonu ile pencere sonundan (windowEnd dahil → ertesi gün 00:00 UTC) erken olanı; haftalık/iki haftalık dönem yıl sonunda biter (sunucunun slotKeyFor yıl başında sıfırlanır); tek seferlik = pencere sonu. Kareler ve yerleşim aynen | Kontrollü saatle 15 sınır durumu (dönemler sunucunun planSlots motorundan): weekly kısmi sonra/son gün/00:00:01, biweekly, monthly, quarterly kısmi ve son gün, once son gün/sonra, monthly doğal, yıl geçişi W53, F27, 31 Aralık son gün — hepsi beklendiği gibi |

**Masaüstü değer 100 notu.** Talimat masaüstüne dokunulmamasını istediği için masaüstü etiket konumu değiştirilmedi; masaüstünde değer 100 iken etiketin sınıra yakınlığı ölçülmedi, ayrı karar gerektirir.

**Ölçüm.** `tools/tests/fe/v2142-karsi-ornek.cjs` (35 kontrol): v2.14.1 teslim ZIP'inin web çıktısında 23 BAŞARISIZ → düzeltilmiş çıktıda ve final ZIP'te 35/35. Önceki 23 kontrol (`v2141-karsi-ornek.cjs`) yeni çıktıda 23/23; tek uyarlama A06 ölçümünün kaydırmayı en yakın kaydırılabilir kapta araması (gereksinim aynı: uyarlanmış betik v2.14.1'de 23/23, v2.14.0'da aynı 17 hatayı yakalar). A06 hiza ölçümünde düğmeye erişim, elementFromPoint görünür alan istediği için satır önce dikey olarak görünüre alınarak ölçülür.

**Tasarım kilidi.** v2.14.1 teslim çıktısıyla aynı veri/rol/dil/viewport/ekran durumu: masaüstü 1440 görüntülerinin tamamında (hedef ekranı, hedef önerisi, pano, liste, ana ekranlar, hata durumları) piksel farkı 0. Mobil farklar yalnız tablo alanında (hiza, kap kaydırma) ve 98/100 değer etiketinde.

**Değişen dosyalar.** `apps/web/src/product/ui/tb.tsx`, `apps/web/src/product/ui/charts/Grafik.tsx`, `apps/web/src/product/pages/ChainB.tsx`, `apps/web/src/styles/tasarim-b.css`, `apps/api/src/server.ts` (sürüm), `ops/paketle-teslimat.sh` (sürüm); testler `tools/tests/fe/v2142-karsi-ornek.cjs` (yeni), `tools/tests/fe/v2141-karsi-ornek.cjs` (A06 kaydırma kabı ölçümü). Sunucu davranışı, sözleşme ve migrasyon değişmedi.

**Doğrulama.** API 111/111 (gerçek PostgreSQL 16) · sözleşme 1.384 gerçek yanıt, 0 sapma · FE kapısı A 6/6, R 215/215 (koşu v2142), B 20 bağımsız paket, C geçti · denetçi tarayıcı 26/27 (belgeli istisna LOGIN-ENTER) · dil kapsamı eksik 0 · marka OK.

**Koşulamayan.** Mac/Safari; gerçek OpenAI çağrısı (kapsam dışı).
