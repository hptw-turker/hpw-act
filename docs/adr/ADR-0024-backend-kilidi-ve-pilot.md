# ADR-0024: Backend kilidi kapısı ve 400 şubelik gölge pilot

**Durum:** Kabul edildi (v2.2 semantik kilit, 23.09.2026)

## Karar
Target/Result/Relationship/Action tabloları kalıcılaştırılmadan önce şu cümleler yazılı ve değişmezdir: ambition kota değildir; yerel hedef yerel veriden üretilir; katkı açıklamadır; resmî toplama ağırlığı tek kaynaktır; şiddet/güven/kontrol/yük ayrıdır; gizli birim sayısal çıktı vermez; çalışan sahiplik zincirine girmez; tamamlandı/doğrulandı/etkili üç ayrı durumdur; etkinlik nedensellik iddiası içermez. Pilot: 400 şube gölge çalıştırma (kullanıcısız, uzman değerlendirmesi: kaç hedef saçma, kaç sahip yanlış, kaç yerel sorun kurumsal seçim yüzünden kayıp, kaç gizli birimde dolaylı sızıntı) → 40 şube canlı → 100 → 400 → sonraki ölçüm.

## Gerekçe
Hedef semantiği tablolar yazıldıktan sonra değişirse migrasyon yalnız veritabanını değil API'leri, olayları, audit'i, arayüzü ve raporları etkiler. 20 iyi niyetli şubeyle pilot algoritmanın gerçek dağılımını göstermez.

## Sonuçlar
- Mimari belge bölüm 24 bağlayıcıdır; `packages/domain-core` bu kararı uygular, kabul testleri T-55..T-62 doğrular.
