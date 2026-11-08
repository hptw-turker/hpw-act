# Bağımsız v2.11.5 test betiği — depo uyarlaması

Kaynak: `HPW-v2_11_5-Test-Paketi.txt` (JSON test paketi; kanıt ZIP'i bu turda iletilmedi). 87 dosyanın her biri bayt sayısı ve SHA-256 değeriyle doğrulanarak çıkarıldı (87/87). `tests/multi-pending-ui.cjs` SHA-256 `7fe7db4cdccf1e3fa38c5379d8028a53ef32630e86e9a70542aaa6f1f8109bf8` — paketteki değerle aynı; **değiştirilmeden** alındı. Önceki turların betikleri (`outcome-order-ui.cjs`, `outcome-api.mjs`, `pending-ui.cjs`, `edge-ui.cjs`, `reconcile-ui.cjs`, uyarlamalı `reconcile-ui.cjs`, `cas-api.mjs`) depodakilerle bayt düzeyinde aynı.

Tek ortam uyarlaması kök `pw.cjs` (önceki turlardaki gibi; özgünü `pw.orijinal.cjs`). Etkileşim uyarlaması yok. Denetçinin ilk taslak testi ve üç ERROR'lu kaydı (`taslak-kanit/multi-pending-draft/`) ayrı saklandı; ürün bulgusu sayılmadı.
