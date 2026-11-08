# ADR-0017: Öncelik: şiddet, veri güveni, kontrol edilebilirlik ve iş yükü ayrı eksenler

**Durum:** Kabul edildi (v2.2 semantik kilit, 23.09.2026)

## Karar
PriorityAssessment dört ayrı değer taşır. Şiddet = need .35, trend .20, göreli açık .15, genişlik .15, etki .10, strateji .05 (tenant ayarı). Güven şiddeti çarpmaz: şiddet yüksek + güven düşük → 'doğrulama gerekli' (nabız ölçümü, nitel gözden geçirme, üst birim sinyali), agresif sayısal hedef yok. Kontrol edilebilirlik önceliği düşürmez, sahibi hesap veren birime yönlendirir (etkilenen birim ayrı). İş yükü sorunu gizlemez; alternatif sahip / merkezi destek / sonraki dönem. Karar iki boyutludur (şiddet × güven).

## Gerekçe
v2 formülü güveni önceliğe çarpıp iş yükünü çıkarıyordu: dört kişilik ekipteki ağır sorun 'önemsiz', dolu yöneticinin sorunu görünmez, merkezin sebep olduğu sorun şubede küçük oluyordu. Sorunun ciddiyeti ile ona dair verinin güvenilirliği farklı şeylerdir.

## Sonuçlar
- Mimari belge bölüm 24 bağlayıcıdır; `packages/domain-core` bu kararı uygular, kabul testleri T-55..T-62 doğrular.
