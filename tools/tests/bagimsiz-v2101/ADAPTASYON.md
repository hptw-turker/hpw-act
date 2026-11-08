# Bağımsız v2.10.1 devam karşı örnekleri — depo uyarlamaları

Denetçinin `tests/edge-ui.cjs`, `tests/receipt-api.mjs` ve `previous/evidence-pack/tests/pw.cjs` dosyaları **değiştirilmeden** ve aynı göreli dizin yapısıyla alındı (edge-ui, `pw.cjs`'yi `../previous/evidence-pack/tests/` altından yükler). Çalıştırma ortamı: `HPW_SOURCE` (depo kökü), `WEB_DIST`, `PLAYWRIGHT_MODULE`, `OUT`.

- `edge-ui.cjs` (V2101-R1/R2/R3): standart ön yüz kapısına (B parçası) bağlı; başarısızlıkta çıkış kodu 1.
- `receipt-api.mjs`: denetçinin kendi tanımıyla **ulaşılabilirlik sondası** — `receipt_lost` yolu oluşabiliyorsa çıkış kodu 0 verir. Kabul testi olarak kapıya bağlanmadı: düzeltmeden sonra ilk başarılı teyidin makbuzu saklanır; sondanın kontrollü veritabanı düzeneği makbuzu yazan (`UPDATE idempotency_key SET response_status = $3 …`) ve okuyan sorguları modellemez, bu yüzden sonda artık altyapı hatasıyla biter. Bu hatayı "geçti" saymamak için sonuç yalnız başlangıç kanıtı olarak saklandı. Aynı zincirin kabul testi gerçek PostgreSQL üzerindedir: `apps/api/test/v2101.test.ts` — "V2101-02 makbuz zinciri".
