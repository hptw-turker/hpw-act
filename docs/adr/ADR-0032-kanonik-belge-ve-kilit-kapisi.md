# ADR-0032: Tek kanonik mimari belge; şema kilidi kapısı ve gölge pilot

**Durum:** Kabul edildi (v2.3 kanonik, 24.09.2026)

## Karar
Mimari belge v2.3'ten itibaren tek algoritmadır; "çelişirse bölüm X kazanır" ifadesi yasaktır, eski algoritma metinleri arşive taşınır. Kabul manifesti tek yerdedir (docs/testing). Şema kilidi kapısı: tek kanonik belge; T-01..T-69 tek manifest; ambition/yerel/katkı fiziksel ayrım; metrik modeli; HPTW skor sözleşmesi gerçek fixture'da tutuyor; ifşa sözleşmesi ve fark sorgusu koruması; n<5 arayüzde hiçbir kanalda sayısal hedef yok; kota dili bütün arayüz ve kılavuzlardan kalkmış; rol merkezli sahiplik; sonuç semantiği (C nedensel değil); doğrulama yükü politikası; yük sınırları; desteklenen ve yamalı PostgreSQL sürümü; 400 şube gölge çalıştırma (gizlilik sızıntısı 0, anlamsız hedef oranı eşik altı, yerel ağır sorunun kurumsal seçim yüzünden kaybı 0, sessiz esnetme 0, C derecesinin nedenselmiş gibi anlatımı 0); 40 şube canlı pilot (planlama ≤5 dk, check-in ≤60 sn). Bunlardan biri kırmızıysa şema kilitlenmez.

## Gerekçe
Backend'de en pahalı hata yanlış algoritmadan çok yanlış adlandırılmış domain nesnesinden çıkar.

## Sonuçlar
- Mimari belge v2.3 bağlayıcıdır; `packages/domain-core` ve `db/migrations/0001_core.sql` bu kararı uygular; kabul testleri T-64..T-69 doğrular.
