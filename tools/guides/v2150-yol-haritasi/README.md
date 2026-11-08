# Rol kılavuzları — v2.15.0 "6 · Yol haritası" bölümü

v2.14.2 rol kılavuzlarına (8 PDF) yol haritası bölümünü ekler. 1–5. bölümler değişmez; kapak, içindekiler ve bütün sayfa altbilgileri v2.15.0 olarak yeniden basılır.

1. Demo sunucusu (8787) Saha Bankacılık sentetik örnek yol haritasıyla çalışırken ekranları alın:
   `OUT=/tmp/hpw-guide-shots node cap.cjs` (yalnız bazıları için adlarını ekleyin: `node cap.cjs YH-S-plan`).
   Her ekranın kırpma alanı ve kırmızı numaraların konduğu öğeler `spec.json` içindedir.
2. Bölümü üretin ve birleştirin:
   `python3 build.py <v2.14.2 kılavuz klasörü> /tmp/hpw-guide-shots <çıkış klasörü>`

Metinler ve numara açıklamaları `icerik.py` içindedir (numara sırası `spec.json`daki işaret sırasıyla aynıdır). Ekranlarda gerçek müşteri verisi kullanılmaz.
