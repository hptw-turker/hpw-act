# v2.11.3 bağımsız denetim kanıtları

Bu dosyalar ürün teslimi değildir. Ürünü ayrıca açın: HPW_Act_TESLIMAT_v2.11.3_090687250d70.zip; SHA-256 4d5ed880a96ca997a9be4da56bd4c0f42c552f3cbd04ed469761230cf8f5c131.

tests/reconcile-ui.cjs gerçek teslim web'ini kontrollü HTTP yanıtları ve saatle çalıştırır. İlk komutun uygulanıp uygulanmadığı düzeneğin açık değişkenidir. Diğer yönetici senaryosunda özgün komut uygulanmaz, güncel iş farklı tarih/gerekçeyle aynı duruma geçmiştir. PostgreSQL üzerinde yazma yapılmaz. EXPIRED-UNREADABLE senaryosunda 503 okuma hatası sürerken yeniden açılan boş formdan yeni bir gönderimin mümkün olduğu da kaydedilir. Bu test mükerrer iş etkisi iddiası değildir.

Gerekenler: Node, Playwright (clock desteği), Chromium ve ürünün tools/tests/fe/harness.cjs dosyası. pw.cjs burada kullanılan ortam adaptörüdür: CODEX_PRIMARY_RUNTIME_NODE_MODULES/playwright ve browser/chromium bekler. Başka ortamda yalnız bu adaptörü kurulu Playwright'ı dışa aktaracak şekilde değiştirin; örneğin module.exports=require('playwright'). Ürün ve özgün denetçi testlerinin beklentileri korunmalıdır.

```bash
export HPW_SOURCE='/absolute/HPW_Act_TESLIMAT_v2.11.3/GELISTIRICI_KAYNAK'
export WEB_DIST='/absolute/HPW_Act_TESLIMAT_v2.11.3/DOLU_DEMO/assets/app/apps/web/dist'
export HPW_API_RUNTIME='/absolute/HPW_Act_TESLIMAT_v2.11.3/DOLU_DEMO/assets/app/apps/api/dist/src'
export OUT='/absolute/output/reconcile-ui'
node tests/reconcile-ui.cjs
```

Mevcut teslimde sonuç PASS / FAIL / FAIL / FAIL ve çıkış 1. ERROR test ortamı arızasıdır; bulgu sayılmamalıdır. Ekran metni Türkçe yerel küçük harfe çevrilerek karşılaştırılır; CSS büyük harf gösterimi başarı mesajını kaçırmaz.

tests/pending-ui.cjs önceki bağımsız gece yarısı/kapat-aç testidir; değiştirilmeden 3/3 geçti. edge-ui 7/7 ve fixture-adapted/independent-ui 5/5 geçti. cas-api gerçek Fastify/evaluator kodunu kontrollü işlem modeliyle sınar; PostgreSQL değildir. cas-api için UI_RESULTS, fixture-adapted/independent-ui.cjs koşusunun results.json dosyasına verilmelidir. İlk ortam hatasının logu korunmuştur; son 4/4 sonuç kabul tablosunda kullanılmıştır. original/independent-api bu tur yeniden koşulmadı; arşiv için korunur.

run-suite.py mevcut regresyonların bu denetimdeki komutlarını içerir; source/HPW_Act_TESLIMAT_v2.11.3 düzenini ve harness bağımlılıklarını bekler. run-originals.py önceki testleri çalıştırır. node_modules ve tarayıcı ikilisi pakete dahil değildir; harness/package-lock.json bağımlılıkları sabitler.

evidence/ bağımsız üretilen kanıttır. supplier-evidence/ üreticiden alınmıştır; bağımsız PostgreSQL/tur kabulü değildir. evidence/reconcile-ui-draft-text-check/ ilk taslak testin büyük/küçük harf eşleşme sorununun kaydıdır; kabul sayısına katılmaz. Kullanılacak güncel sonuç evidence/reconcile-ui/results.json dosyasıdır.

TXT test paketi JSON/UTF-8 dosya taşıma biçimidir. content alanını UTF-8 yazıp bytes ve sha256 değerlerini doğrulayın; JSON'u kod gibi çalıştırmayın. extract-test-bundle.py yeni bir dizine güvenli çıkarma yapar. Bu TXT ham ekran görüntülerini veya ürün paketini içermez.
