# HPW Act v2.10.2 — bağımsız tekrar kanıtları

Hedef ZIP: `HPW_Act_TESLIMAT_v2.10.2_3040f1ae93df.zip`.
SHA-256: `cabf461fbe2eb499b3a58e4d25990cca5d61cd87f8f83133b90538b5e19f038f`.

Tarayıcılar teslim ZIP'inin DOLU_DEMO/assets/app/apps/web/dist dizinini açar; yeniden derlenmiş arayüz kullanılmaz. HTTP yanıtları test düzeneği tarafından kontrol edilir. Gerçek PostgreSQL, RLS veya transaction izolasyonu bu kanıt paketinin bağımsız kabul kapsamı değildir.

## Özgün karşı örnekler

`previous/pack/tests/edge-ui.cjs` ile `previous/pack/previous/evidence-pack/tests/independent-ui.cjs` özgün denetçi dosyalarıdır. Üreticinin v2.10.2'ye aldığı kopyalarla bayt karşılaştırması `evidence/original-script-comparison.json` içindedir.

Node ve Playwright bulunan bir ortamda şu ortam değişkenlerini tanımlayın:

- `HPW_SOURCE`: ürün ZIP'indeki GELISTIRICI_KAYNAK mutlak dizini.
- `WEB_DIST`: ürün ZIP'indeki DOLU_DEMO/assets/app/apps/web/dist mutlak dizini.
- `HPW_API_RUNTIME`: ürün ZIP'indeki DOLU_DEMO/assets/app/apps/api/dist/src mutlak dizini.
- `PLAYWRIGHT_MODULE`: kullanılacak Playwright modülü.
- `CHROMIUM_PATH`: çalıştırılabilir Chromium dosyası.
- `OUT`: her test grubu için yeni, boş çıktı dizini.

Sonra `node previous/pack/tests/edge-ui.cjs` çalıştırın. Önceki yedi UI testi için `node previous/pack/previous/evidence-pack/tests/independent-ui.cjs`; eski onay kontrolü için `node previous/pack/previous/evidence-pack/tests/independent-api.mjs` çalıştırın. Sunucu betikleri gerçek paket kodunu kullanır, DB bağlantısını denetçi düzeneğiyle değiştirir.

## Makbuz testi uyarlaması

`previous/pack/tests/receipt-api.mjs` değiştirilmedi. Eski betik, v2.10.1'de olağan tekrarın receipt_lost ürettiğini göstermek için yazılmış bir ulaşılabilirlik sondasıdır. v2.10.2'de makbuz kalıcı tutulduğundan yeni UPDATE/SELECT sorguları bu eski düzeneğin dışında kalır. Özgün sondanın bu nedenle verdiği 500 / UNMOCKED QUERY ürünün gerçek veritabanında 500 verdiği anlamına gelmez; bu test geçti olarak sayılmadı.

Yeni `receipt-acceptance.mjs`, ayrı dosyada ve açık uyarlamayla yazıldı. Eklenenler: makbuzun saklanması ve okunmasının SQL modeli, payload hash/aktör/kaynak bilgisi, canlı profil değişimi, gerçek teyit INSERT sayacı. Bilinmeyen sorgular hata vermeye devam eder. Beklentiler: ilk 200; aynı anahtar ve gövdede aynı 200; farklı gövdede 409; profil geri alınca 403; profil geri gelince aynı makbuz; güncel done durumu; makbuz fiziksel olarak kaybolduğunda journal sayesinde ikinci yazma olmaması. `node receipt-acceptance.mjs` ile çalışır.

Bu model PostgreSQL davranışını kanıtlamaz. İşleyicinin doğru sorguları üretmesini ve verilen DB sonuçlarına karşı davranışını doğrular.

## Regresyonlar ve sonuç kapısı

`run-tests.py` bu denetimdeki komut sırasını ve ortamı kaydeder; mevcut yerel TSX bağımlılığına başvurur. Taşınan ortamda yollar uyarlanmalıdır. Gerçek komutlar, başlangıç/bitiş saatleri ve çıkış kodları `evidence/fresh-suite/run.json` içindedir.

İki regresyon parçasında aynı, yeni ve benzersiz `REG_RUN` kullanıldı. Önce `REG_SPLIT=0/2`, sonra `REG_SPLIT=1/2` ile ürünün `tools/tests/fe/ui-regresyon.cjs` dosyası çalıştı. Sonuç dosyası ve `.meta.json` aynı koşuya aittir. Eski denetçi tarayıcı betiğinden sonra `FE_PART=C` ile ürünün `run-fe-tests.mjs` kapısı çalıştırıldı. Kanıttaki JSON sonuçları test sayımlarının kaynağıdır; stdout logları yardımcı izdir.

`i18n-coverage.mjs` için mevcut TypeScript kurulumu apps/web/node_modules altına bağlantılandı. Yetki sözleşmesi kontrolünün ilk denemesi eksik React bağımlılığı nedeniyle başlamadı; mevcut React, React DOM ve React Router DOM bağlantıları eklenince aynı betik geçti. İlk hata ve başarılı tekrar ayrı loglarda korunur. Temiz npm kurulum yapıldığı iddia edilmez. Ürünün kaynak dosyaları ve davranış beklentileri değiştirilmedi. Paketlenmiş kaynaklarla son bayt karşılaştırması `evidence/source-integrity.json` içindedir.
