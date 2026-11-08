# Bağımsız v2.10.0 karşı örnekleri — depo uyarlamaları

Denetçinin `tests/independent-ui.cjs`, `tests/independent-api.mjs`, `tests/pw.cjs` dosyaları **değiştirilmeden** alındı (bayt düzeyinde aynı). Yalnız çalıştırma ortamı verildi:
`HPW_SOURCE` (depo kökü; `tools/tests/fe/harness.cjs` buradan yüklenir), `WEB_DIST` (depo ya da teslim paketi web derlemesi), `HPW_API_RUNTIME` (derlenmiş API), `PLAYWRIGHT_MODULE`, `OUT` (ayrı kanıt dizini). `tools/tests/fe/run-fe-tests.mjs` bunları ayarlar ve başarısızlıkta çıkış kodunu 1 yapar.

`independent-api.mjs` veritabanı sorgularını SQL metninde alt dize eşleştirerek yanıtlar. v2.10.1'de kurulum hesabı `platform_assignments` yerine `platform_assignments_onboarding` fonksiyonunu çağırır; düzeneğin `sql.includes('platform_assignments')` kuralı bu çağrıyı da aynı atama yanıtıyla karşılar. Bu nedenle sorgu düzeneğinde uyarlama gerekmedi; beklenmeyen sorgu (UNMOCKED QUERY) oluşmadı. Bu test gerçek PostgreSQL testi değildir; gerçek karşılığı `apps/api/test/v2101.test.ts`.
