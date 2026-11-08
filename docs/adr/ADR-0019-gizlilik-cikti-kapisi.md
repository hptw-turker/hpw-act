# ADR-0019: Gizlilik bütün türetilmiş çıktılara uygulanır (Privacy Output Gateway)

**Durum:** Kabul edildi (v2.2 semantik kilit, 23.09.2026)

## Karar
canExpose(viewer, unit, metric, outputType) skor, başlangıç, hedef, fark, katkı, sıra, kıyas açığı, sayısal açıklama ve aksiyon gerekçesini birlikte denetler. Gizli birim (n < eşik) hiçbir sayısal çıktı üretmez; yalnız 'üst birim önceliği kapsamında bu uygulama öneriliyor' kalıbı. Üst toplam + görünen alt birimlerden tek gizli birim çıkarılabiliyorsa ikincil baskılama. Gizlilik testleri (üst toplam çıkarımı, hedeften başlangıç çıkarımı, katkıdan fark çıkarımı, iki filtre sorgusunun farkı) sürüm engelleyicidir.

## Gerekçe
'Skoru sakla ama +10 hedef göster' gizli skoru tersine hesaplatır. v2.1 yalnız Result ekranını koruyordu.

## Sonuçlar
- Mimari belge bölüm 24 bağlayıcıdır; `packages/domain-core` bu kararı uygular, kabul testleri T-55..T-62 doğrular.
