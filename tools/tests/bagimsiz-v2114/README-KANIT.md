# HPW Act v2.11.4 bağımsız denetim kanıtları

Bu bir ürün teslimi değildir. İncelenen ürün: `HPW_Act_TESLIMAT_v2.11.4_8ab25e62e66d.zip`, SHA-256 `795b41698323f4584e3f2820a1f6f6d3f08d9bdb352b6990fb6a404b3323f199`.

`evidence/` bu denetimde bağımsız üretilen kanıttır. `supplier-evidence/` üreticiden alınan ve açıkça ayrılan kayıtlardır; bağımsız PostgreSQL veya paket turu kabulü değildir. Ürün kodunda düzeltme yapılmamıştır.

## Yeni karşı örnek

`tests/outcome-order-ui.cjs` teslim edilen gerçek web derlemesini kontrollü HTTP ve saatle çalıştırır. Üç senaryo vardır:

1. `SAVED-CONTROL`: özgün komut sonuç sorgusundan önce kaydedilmiştir; sonuç `applied` ve doğru başarı iletisi.
2. `ABSENT-CONTROL`: özgün komut hiç kaydedilmemiştir, sürüm değişmez; ikinci bilinçli onay istenir.
3. `COMMIT-BETWEEN-READS`: ilk sonuç sorgusu `not_found` anlık görüntüsünü alır; sonra özgün komut ve makbuzu birlikte kaydedilmiş sayılır; sonraki iş okuması sürüm 4 döner. Ekran yanlış biçimde “Önceki gönderiminiz uygulanmadı” der ve niyet kaydını siler. Son gözlemci sorgusu aynı anahtar için `applied` döner.

Sıra HTTP işleyicisindeki olaylarla belirlenir; yarış sonucunu tesadüfi bir bekleme süresi belirlemez. Gözlemci sorgusu ürünün yaptığı sorgu değildir; `phase: observer-proof` olarak ayrılmıştır. Gerçek PostgreSQL'de bu yarış koşturulmamıştır. Test veri kaybı veya mükerrer iş etkisi iddiası değildir. v2.11.4 sonucu: **2 PASS, 1 FAIL**, çıkış kodu 1. `ERROR` ürün bulgusu sayılmamalıdır.

## Çalıştırma

Node, Playwright (clock desteği), Chromium ve ürünün `tools/tests/fe/harness.cjs` dosyası gerekir. `pw.cjs` bu denetimin ortam adaptörüdür: `CODEX_PRIMARY_RUNTIME_NODE_MODULES/playwright` ve `browser/chromium` kullanır. Başka ortamda yalnız bu adaptörü kurulu Playwright'ı dışa aktaracak şekilde uyarlayın; örneğin `module.exports=require('playwright')`. Bu, test davranışı veya beklentisi değişikliği değildir. Tarayıcı ikilisi ve node_modules pakete dahil değildir.

```bash
export HPW_SOURCE='/absolute/HPW_Act_TESLIMAT_v2.11.4/GELISTIRICI_KAYNAK'
export WEB_DIST='/absolute/HPW_Act_TESLIMAT_v2.11.4/DOLU_DEMO/assets/app/apps/web/dist'
export HPW_API_RUNTIME='/absolute/HPW_Act_TESLIMAT_v2.11.4/DOLU_DEMO/assets/app/apps/api/dist/src'
export OUT='/absolute/output/outcome-order-ui'
node tests/outcome-order-ui.cjs
```

Yeni uç sondası için ayrı bir OUT verip `node tests/outcome-api.mjs` çalıştırın. Sonuç **6/6**. Bu betik gerçek paket Fastify uygulamasını çalıştırır, veritabanı sorguları kontrollü modeldedir; PostgreSQL testi değildir. Modelin kullanıcı ve şirket erişimi tanımları betikte ve sorgu günlüğünde görünür. `tests/cas-api.mjs` de aynı türdedir; ayrıca `UI_RESULTS` değişkeni `fixture-adapted/independent-ui.cjs` çıktısındaki `results.json` dosyasına verilmelidir.

## Önceki testlerin korunması

`tests/reconcile-ui.cjs`, `pending-ui.cjs`, `edge-ui.cjs` ve `cas-api.mjs` önceki bağımsız kanıt paketinden aynen korunmuştur. SHA karşılaştırması `evidence/original-test-comparison.json` içindedir. `tests/outcome-adapted/reconcile-ui.cjs`, üreticinin yeni sonuç ucunu yanıtlayan kopyasıdır: özgünle farkı yalnız uç yanıtı ve göreli adaptör yoludur; fark `evidence/adaptation.diff` içinde bağımsız çıkarılmıştır. Beklentiler korunur. Özgün sonuç **2 PASS, 1 FAIL, 1 ERROR**; geçerli uyarlama **4 PASS**. Özgünün yeni ucu bilmemesi ürün regresyonu olarak sayılmaz.

`tests/original/independent-api.mjs` bu tur çalıştırılmamıştır; tarihsel test olarak korunur. Sonuçları başka koşularla birleştirmeyin. `fixture-adapted/independent-ui.cjs` önceki zorunlu DTO alanı uyarlamasıdır. Bu tur 5/5 geçmiştir.

`run-suite.py`, `run-originals.py` ve `run-reconcile.py` kullanılan koşuculardır; `run-new.py` yeni iki testi aynı komut/ortam ayarlarıyla tekrar üretmek içindir. Ürünü `source/HPW_Act_TESLIMAT_v2.11.4/` içine açın. `harness/package-lock.json` yardımcı bağımlılıkları sabitler. `setup.py` önceki kanıt paketini karşılaştırma için beklediğinden ilk test çalıştırması için zorunlu değildir. Paket kaynakları ve teslim web'i son SHA denetimiyle ayrıca karşılaştırılır.

`evidence/outcome-order-draft/` yeni sondanın ilk tanı sürümüdür. Nihai `tests/outcome-order-ui.cjs`, yanlış “uygulanmadı” iletisinin kaldırılmasına ek olarak doğru başarı bildirimini ve yeni taslağın gönderilmemesini de ister. Nihai sonuç `evidence/outcome-order-ui/` içindedir; iki koşunun sonucu da 2 PASS / 1 FAIL. Taslak kabul sayısına eklenmez.

Eski 27 senaryolu `ui-audit.cjs` bu ortamda iki değişmemiş koşuda 25/27 verdi: LOGIN-ENTER belgeli istisna, DEEP-LINK sabit 250 ms sonrasındaki ölçümde 0 düğme. Aynı başarısız koşunun ekran görüntüsünde düğme görünür. `diagnose-legacy-deeplink.cjs`, aynı özgün düzenek ve fikstürle yalnız bu akışı ölçer; görünürlük koşulu sağlandı, sayfa hatası yok. Bu tanı özgün testin beklentisini değiştirmez ve ilk sonuç kapısının başarısızlığını silmez. Ayrıntılar raporda; `evidence/suite/result-gate.log`, `evidence/legacy-repeat/` ve `evidence/deeplink-diagnostic/` birlikte değerlendirilmelidir.

TXT test paketi JSON/UTF-8 taşıma biçimidir; JSON'u kod gibi çalıştırmayın. `extract-test-bundle.py` yeni bir dizine çıkarırken her dosyanın bayt sayısını ve SHA-256'sını denetler. TXT dosyası ham ekran görüntülerini veya ürünü içermez. ZIP içindeki `SHA256SUMS.json`, kendi dışındaki bütün kanıt dosyalarının envanteridir.
