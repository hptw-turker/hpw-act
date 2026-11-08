# ADR-0021: Nedensel güven derecesi ve etkinlik öğrenmesi

**Durum:** Yerini aldı (superseded) → ADR-0027 (AttributionEvidenceGrade; 'nedensel güven' terimi kaldırıldı) ve ADR-0035 (A/B yalnız kayıtlı tasarım + karşılaştırma grubu + inceleme ile). Tarih için korunur; uygulanmaz.

## Karar
Outcome.causal_evidence_grade ∈ {A deneysel, B eşleştirilmiş kıyas (fark-içinde-fark), C yüksek karşılaştırılabilirlikte önce/sonra, D karşılaştırılamaz/yalnız beyan}. Etkinlik bilgi tabanı 'birlikte gözlendi' ile 'etkisi' ayrımını korur; yalnız C ve üstünden öğrenir, seçim yanlılığına karşı B'yi tercih eder. causal_claim şema düzeyinde false.

## Gerekçe
'Bu 8 görüşme skoru 8 puan yükseltti' çoğu durumda çıkarılamaz; ürün nedensellik motoru gibi davranmaz ama dürüst bir derece söyler. Beklenti: çoğu aksiyon C, ara sıra B; A etiketi kalır ama müşteri organizasyonlarında nadirdir.

## Sonuçlar
- Mimari belge bölüm 24 bağlayıcıdır; `packages/domain-core` bu kararı uygular, kabul testleri T-55..T-62 doğrular.
