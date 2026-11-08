# v2.11.2 bağımsız kanıtları

Bu paket ürün dağıtımı değildir. İncelenen ürünü ayrıca açın: HPW_Act_TESLIMAT_v2.11.2_39a2d66d1ee2.zip; SHA-256 8a682f82a37fab8b11c3930fc73d55524b2c4a710f81dfb456526039a8220935.

Ürün kodunu değiştirmeden tests/pending-ui.cjs gerçek derlenmiş arayüze kontrollü HTTP yanıtları verir. Saat Europe/Istanbul; Playwright clock yalnız tarih/saat davranışını kontrol eder. Sunucu etkisi düzeneğin belleğinde temsil edilir. PostgreSQL, gerçek teslimat, yük veya işletim sistemi kabulü değildir.

Gerekenler: Node, Playwright (clock desteği), Chromium ve ürünün tools/tests/fe/harness.cjs dosyası. tests/*.cjs dosyaları ../pw.cjs adaptörünü kullanır. Buradaki pw.cjs denetimde kullanılan ortam adaptörüdür; CODEX_PRIMARY_RUNTIME_NODE_MODULES/playwright ve browser/chromium arar. Kendi ortamınızda yalnız bu adaptörü mevcut Playwright modülünü dışa aktaracak biçimde uyarlayın. Örneğin kurulu Playwright için module.exports=require('playwright'). Ürünün kendi test/harness dosyaları değiştirilmemelidir.

Örnek (yolları kendi açtığınız dizine göre ayarlayın):

```bash
export HPW_SOURCE='/absolute/HPW_Act_TESLIMAT_v2.11.2/GELISTIRICI_KAYNAK'
export WEB_DIST='/absolute/HPW_Act_TESLIMAT_v2.11.2/DOLU_DEMO/assets/app/apps/web/dist'
export HPW_API_RUNTIME='/absolute/HPW_Act_TESLIMAT_v2.11.2/DOLU_DEMO/assets/app/apps/api/dist/src'
export OUT='/absolute/evidence-output/pending-ui'
node tests/pending-ui.cjs
```

İsteğe bağlı TEST_FILTER=midnight / reopen / same-day-control tek senaryo seçer. Mevcut teslimde çıkış 1; sonuçlar PASS, FAIL, FAIL. ERROR bir test ortamı sorunudur ve bulgu olarak sayılmamalıdır. Sonuç JSON'u ilk otomatik gönderimleri, gövdeyi, anahtarı, form iletilerini, açık pencereyi ve niyet kaydını içerir. Çıktıdaki kimlikler sentetiktir.

Önceki bağımsız testler özgün dosyalar olarak korunmuştur. Geçerli fikstürlü UI, edge-ui ve cas-api bu tur yeniden çalıştırıldı. cas-api gerçek API/evaluator kodunu kontrollü işlem modeliyle sınar; gerçek PostgreSQL değildir. original/independent-api.mjs bu tur yeniden koşulmadı; önceki özgün kanıtın korunması için dahil edildi. Zorunlu active_item_state alanı bulunmayan original/independent-ui.cjs kabul kapısı yapılmamalıdır; fixture-adapted sürümü bu alanı ekler, davranış beklentisini değiştirmez.

run-suite.py bu denetimde çalıştırılan mevcut test komutlarının kaydıdır; source/HPW_Act_TESLIMAT_v2.11.2 dizin düzenini ve harness bağımlılıklarını bekler. harness/package-lock.json sabitlenmiş bağımlılıkları içerir; browser ve node_modules pakete dahil değildir. evidence/suite/run.json komutları, zamanları, çıkış kodlarını ve kullanılan yolları kaydeder.

supplier-evidence yalnız üreticiden alınan kanıttır. evidence ise bu bağımsız koşuda üretilmiştir. Özellikle BOŞ 7h ekranı ve gerçek PostgreSQL logları bağımsız yeniden koşu olarak sunulmamaktadır.

HPW-v2.11.2-Test-Betigi-Paketi.txt aynı test araçlarının JSON/UTF-8 taşıma biçimidir; ZIP yüklemesi başarısız olursa kullanılabilir. content alanını UTF-8 olarak yazın ve bytes/sha256 ile doğrulayın. JSON'u kod gibi çalıştırmayın; extract-test-bundle.py dosyaları güvenli bir hedefe çıkarır. Orijinal kanıt arşivi veya ürün dosyaları bu TXT'nin içinde yoktur.
