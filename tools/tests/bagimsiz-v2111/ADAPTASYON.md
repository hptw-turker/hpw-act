# Bağımsız v2.11.1 test betikleri — depo uyarlamaları

Kaynak: `HPW-v2.11.1-Denetim-Kanitlari.zip` (SHA-256 `6b21f2273276f66a7e92ef831a275576a817b4f0b7aeb710097b7dee16ea32d5`) ve aynı dosyaların metin kopyası `HPW-v2_11_1-Test-Betikleri.txt`. Metin kopyasındaki her dosyanın bayt uzunluğu ve SHA-256 değeri doğrulandı; ZIP'teki dosyalarla bayt düzeyinde aynı.

`tests/original/*`, `tests/fixture-adapted/*`, `tests/edge-ui.cjs`, `tests/cas-api.mjs`, `adaptation.diff`, `README-denetci.md`: **değiştirilmeden** alındı.

Tek ortam uyarlaması: kök `pw.cjs`. Denetçinin özgünü (`pw.orijinal.cjs`) Playwright'ı `CODEX_PRIMARY_RUNTIME_NODE_MODULES` yolundan ve Chromium'u ZIP'e eklenmemiş `browser/chromium` ikili dosyasından yüklüyor. Depodaki `pw.cjs` aynı dışa aktarımı bu ortamdaki Playwright kurulumuna ve onun Chromium'una bağlar. Test mantığı, beklentileri ve fikstürleri değişmedi.

`tests/fixture-adapted/independent-ui.cjs` denetçinin kendi uyarlamasıdır (`adaptation.diff`): v2.11.0 özgün UI betiğinin beklentileri korunur, yalnız fikstüre yeni zorunlu `active_item_state: 'open'` alanı eklenir. `tests/cas-api.mjs` kontrollü DB modelidir (satır kilidi modellenmez); PostgreSQL kilit kabulü değildir — gerçek karşılığı `apps/api/test/v2111.test.ts`.
