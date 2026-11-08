# HPW Act v2.9.0 bağımsız karşı örnekler

Referans build: 119ebdc06f49. Uygulama ZIP SHA-256:
b13871fc5a2f49b2269b6854af8d6ccafdf125cfa143171440c2155af3146a21

Bu testler kusurlu referans sürümde çıkış kodu 1 üretir. Bulgular JSON çıktılarında ayrıntılıdır. Test hatası ile ürün karşı örneğini ayırmak için logları inceleyin. V290-04 SQL kaynak bulgusu için gerçek PostgreSQL senaryosu raporda tanımlıdır; bu pakette çalıştırılmış gibi gösterilmez.

## Hazırlık

Node.js 24 ve Playwright/Chromium kullanıldı. Uygulama ZIP'ini sembolik bağlantıları koruyarak açın. Bu denetim ZIP'inde uygulamanın kendisi ve üçüncü taraf bağımlılıkları yoktur.

Aşağıdaki dizilimi kullanabilirsiniz:

- source/HPW_Act_TESLIMAT_v2.9.0/ : uygulama ZIP'inden çıkan kök
- tests/ : buradaki betikler
- evidence/ : çıktı dizini (önceden oluşturun)

Alternatif yollar için:

- HPW_SOURCE = GELISTIRICI_KAYNAK dizininin mutlak yolu
- HPW_API_RUNTIME = DOLU_DEMO/assets/app/apps/api/dist/src dizininin mutlak yolu
- WEB_DIST = DOLU_DEMO/assets/app/apps/web/dist dizininin mutlak yolu
- PLAYWRIGHT_MODULE = kurulu playwright modülünün mutlak yolu (isteğe bağlı)
- CHROMIUM_PATH = özel Chromium çalıştırılabilir dosyası (isteğe bağlı)
- CHROMIUM_ARGS = JSON dizisi biçiminde ek tarayıcı argümanları (isteğe bağlı)

Örnek:

```bash
mkdir -p evidence
export HPW_SOURCE="/mutlak/yol/HPW_Act_TESLIMAT_v2.9.0/GELISTIRICI_KAYNAK"
export HPW_API_RUNTIME="/mutlak/yol/HPW_Act_TESLIMAT_v2.9.0/DOLU_DEMO/assets/app/apps/api/dist/src"
export WEB_DIST="/mutlak/yol/HPW_Act_TESLIMAT_v2.9.0/DOLU_DEMO/assets/app/apps/web/dist"
node tests/independent-ui.cjs
node tests/production-config.mjs
node tests/independent-api.mjs
```

## Test türleri

- independent-ui.cjs: Teslim edilmiş web JS/CSS'sini Chromium'da çalıştırır; ağ cevapları sentetiktir. İki bozuk DTO ve iki şirket bağlamı yarışını sınar. Gerçek şirket verisine yazmaz.
- production-config.mjs: Paketlenmiş config/mfa kodunu ayrı üretim ortam süreçlerinde yükler. Yalnız sentetik değerler kullanır; DB'ye bağlanmaz.
- independent-api.mjs: Paketlenmiş Fastify sunucusunu inject ile çağırır; pg havuzu sınırındaki yanıt ve arızalar kontrollüdür. Dört ret kontrolü ve müdahale audit yazım hatası içerir. PostgreSQL/RLS entegrasyon testi değildir.
- pw.cjs: Tarayıcı ortam uyarlaması. Ürün beklentilerini değiştirmez.

Düzeltme yaparken bu karşı örnekleri standart testlerinize taşıyın. Özellikle gerçek DB davranışını bu mock üzerinden doğrulanmış saymayın. Yeni durable outbox tasarımı için DB arıza modelini ve gerçek entegrasyon testini birlikte güncelleyin; yalnız bulgu bayrağını kapatmayın.

## Ham çıktılar

evidence/ içindeki domain, istemci, regresyon ve statik sözleşme logları üretici testlerinin bağımsız koşularıdır. Yeni karşı örnekler independent-*.json ve production-config.json dosyalarındadır. baseline-exit-codes.json üç karşı örnek betiğinin kusurlu referanstaki çıkış kodlarını içerir.
