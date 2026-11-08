# HPW Act v2.10.0 bağımsız denetim kanıtları

Paket build: 372b8231aec0. Ürün uygulaması bu kanıt ZIP'ine tekrar konulmadı.

`tests/independent-ui.cjs`: teslim edilmiş web paketini Chromium'da açar; HTTP yanıtlarını paket içindeki harness üzerinden kontrol eder. 7 yeni senaryo vardır. Beklenen davranış doğru uygulandığında PASS, v2.10.0'da görülen kusurda FAIL yazar ve 1 çıkış kodu verir.

`tests/independent-api.mjs`: teslim edilmiş Fastify uygulamasını ve onboarding hesaplayıcısını çalıştırır. Yalnız `pool.connect` kontrollü DB yanıtlarıyla değiştirilir. PostgreSQL, RLS, kilitler veya yarış izolasyonu testi DEĞİLDİR. Eski kanıtla müşteri teyidinin kabul edilmesini gösterir.

`tests/pw.cjs`: yalnız Playwright modülü ve Chromium çalıştırma yolu/argümanları için ortam uyarlamasıdır. Ürün davranışını veya test beklentilerini değiştirmez.

## Çalıştırma

Node, Playwright, Chromium ve açılmış uygulama ZIP'i gerekir. Ortamınıza uygun gerçek yolları verin:

```bash
export HPW_SOURCE=/absolute/path/HPW_Act_TESLIMAT_v2.10.0/GELISTIRICI_KAYNAK
export WEB_DIST=/absolute/path/HPW_Act_TESLIMAT_v2.10.0/DOLU_DEMO/assets/app/apps/web/dist
export HPW_API_RUNTIME=/absolute/path/HPW_Act_TESLIMAT_v2.10.0/DOLU_DEMO/assets/app/apps/api/dist/src
export PLAYWRIGHT_MODULE=/absolute/path/to/node_modules/playwright
export CHROMIUM_PATH=/absolute/path/to/chromium
node tests/independent-ui.cjs
node tests/independent-api.mjs
```

İsteğe bağlı `OUT` mutlak çıktı dizini; UI için `TEST_FILTER` test kimliği parçasıdır. Varsayılan OUT kanıt dizinidir; orijinal kanıtı korumak için yeniden koşuda farklı OUT kullanın. Yeni sürümde DB sorgu şekli değişirse API testinin yanıt düzeneği açıkça uyarlanmalıdır. UNMOCKED QUERY / 500, düzeltmenin geçtiği anlamına gelmez.

Mevcut ürün testleri bağımsız koşuda değiştirilmedi. UI testleri için `PW_MODULE` bu paketin `tests/pw.cjs` dosyasına, `WEB_DIST` teslim edilmiş derlemeye, `OUT` ayrı kanıt dizinine ayarlandı. `ui-regresyon.cjs` 107/107; `ui-audit.cjs` 26/27 verdi. LOGIN-ENTER belgeli e-posta istisnasıdır.

Domain ve istemci TypeScript testlerinde ortamda mevcut TSX yükleyicisi kullanıldı. Bu bağımlılık uyarlaması temiz kurulum testi değildir. İlk Chromium denemesinde single-process seçeneği bağlam kapatıldıktan sonra tarayıcıyı sonlandırdı; seçenek kaldırılarak testler baştan tamamlandı. Rapordaki sonuçlar tamamlanan koşulara aittir.

`evidence/independent-ui/` ekran görüntüleri orijinal davranışı gösterir. Dar ekran testinde yalnız tanı için anlık CSS uygulandı, ölçüldü ve görüntü almadan önce geri alındı. Hiçbir ürün kaynak dosyası değiştirilmedi.

`evidence/identity.json`, `package-summary.json`, domain/istemci/sözleşme logları ve iki mevcut tarayıcı grubunun sonuçları bağımsız koşulardır. Üreticinin gerçek PostgreSQL testleri, BOŞ/DOLU turları ve yükseltme beyanları bu kanıtlarla karıştırılmamalıdır.

Denetim tarihi: 27.09.2026. Ortam: Linux, Node 24.19, Chromium 153. PostgreSQL kurulumu ortam izinleri nedeniyle yapılamadı; ilgili tanı logu yalnız bu sınırlamayı belgeler.
