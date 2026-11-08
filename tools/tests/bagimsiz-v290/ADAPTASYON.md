# Bağımsız v2.9.0 karşı örnekleri — depo uyarlamaları

Denetçinin betikleri (`HPW-v2.9.0-Denetim-ve-Kanitlar.zip/tests`) beklentileri değiştirilmeden alındı. Yalnız şu ortam/dosya yolu uyarlamaları yapıldı:

1. `independent-ui.cjs`, `independent-api.mjs`, `production-config.mjs`: çıktı dizini `EVIDENCE_DIR` ortam değişkeniyle verilebilir; verilmezse özgün `../evidence` kullanılır.
2. Çalıştırma: `HPW_SOURCE`, `HPW_API_RUNTIME`, `WEB_DIST`, `PLAYWRIGHT_MODULE` özgün README'deki gibi ortam değişkenleriyle verilir (`tools/tests/fe/run-fe-tests.mjs` bunları depo yollarına ayarlar).

Test türleri (özgün README): `independent-ui` kontrollü HTTP yanıtlarıyla gerçek tarayıcı; `independent-api` gerçek Fastify işleyicileri + kontrollü veritabanı arıza enjeksiyonu (gerçek PostgreSQL değil); `production-config` paketlenmiş yapılandırma/şifreleme kodu. Gerçek PostgreSQL karşılıkları `apps/api/test/v01-v28.test.ts` içindeki v2.9.1 testleridir.
3. `production-config.mjs`: v2.9.1'de `seal()` üretimde anahtar yokken hata fırlatır (geri dönüş anahtarı kullanılmaz). Özgün betik çocuk süreçte `unseal(seal(...))` çağrısının başarılı olacağını varsaydığı için çocuk süreç çöküyor ve betik JSON ayrıştırma hatasıyla düşüyordu. Çağrı try/catch ile sarıldı; başarısızlık `sealRoundTrip: "seal_refused:mfa_key_missing"` olarak kaydedilir. Başarısızlık ölçütü (`problems` boşsa çıkış kodu 1) değişmedi.
