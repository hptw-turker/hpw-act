# Bağımsız v2.11.2 test betiği — depo uyarlaması

Kaynak: `HPW-v2.11.2-Denetim-Kanitlari.zip` (112 dosyalık envanter kendi `SHA256SUMS.json` listesiyle doğrulandı) ve `HPW-v2_11_2-Test-Betigi-Paketi.txt` (her dosyanın bayt uzunluğu ve SHA-256 değeri doğrulandı; ZIP'tekilerle bayt düzeyinde aynı). Önceki turların betikleri (original, fixture-adapted, edge-ui, cas-api) depodakilerle aynı.

`tests/pending-ui.cjs` **değiştirilmeden** alındı. Tek ortam uyarlaması kök `pw.cjs`: denetçinin özgünü (`pw.orijinal.cjs`) Playwright'ı ve Chromium'u denetçi ortamına özgü yollardan yükler; depodaki `pw.cjs` aynı dışa aktarımı bu ortamdaki Playwright kurulumuna bağlar (v2.11.1 turundaki uyarlamayla aynı). Etkileşim uyarlaması gerekmedi; test mantığı, beklentiler ve fikstürler aynı.
