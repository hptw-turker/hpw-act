# ADR-0023: Çalışan hiçbir sahiplik zincirine girmez; katkı birim düzeyinde gösterilmez

**Durum:** Kabul edildi (v2.2 semantik kilit, 23.09.2026)

## Karar
Hedef, aksiyon ve kanıt sahibi her zaman bir yöneticidir; en aşağıda gizlilik eşiğini karşılayan en küçük birimin yöneticisi. Çalışan yalnız ses kaynağıdır: gizli öneri (eşik altında toplanmaz), 'siz söylediniz / ne yapılıyor' görünümü ve bir sonraki ölçüm. Aksiyon kütüphanesinde çalışana iş yükleyen şablon yoktur. Katkı tahmini bölge/merkez görünümünde kalır; şube düzeyinde gösterilmez (kota algısı, kıyas ve gizlilik).

## Gerekçe
Çalışan bağlılığı anketinin sorumluluğu çalışana yıkılamaz; değişim aktörü yöneticidir. Prototipteki 'Aksiyon Sahibi · vardiya lideri' etiketi bu kuralı bulanıklaştırmıştı.

## Sonuçlar
- Mimari belge bölüm 24 bağlayıcıdır; `packages/domain-core` bu kararı uygular, kabul testleri T-55..T-62 doğrular.
