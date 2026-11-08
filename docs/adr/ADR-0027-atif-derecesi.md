# ADR-0027: CausalEvidenceGrade → AttributionEvidenceGrade; C yalnız zamansal ilişkidir

**Durum:** Kabul edildi (v2.3 kanonik, 24.09.2026)

## Karar
OutcomeAssessment.attribution_evidence_grade: A deneysel ("nedensel etki için güçlü kanıt"), B güçlü yarı-deneysel / eşleştirilmiş kıyas ("aksiyonun etkisiyle uyumlu güçlü atıf kanıtı"), C karşılaştırılabilir önce/sonra ("zamansal ilişki var; nedensellik kanıtlanmadı"), D karşılaştırılamaz/yalnız beyan ("etki değerlendirilemez"). `estimated_effect` yalnız A/B'de dolar (şema CHECK); C'de alan `observed_change`. Kontrol tower üç cümle söyler: aksiyon doğrulandı mı, skor iyileşti mi, iyileşme bu aksiyondan mı biliniyor mu.

## Gerekçe
Skorun 49'dan 57'ye çıkması aksiyonun +8 yarattığını göstermez; uç başlangıçlardan seçilmiş gruplarda ortalamaya regresyon doğal değişimi etki gibi gösterir. "Nedensel güven C" adı fazla güçlüydü.

## Sonuçlar
- Mimari belge v2.3 bağlayıcıdır; `packages/domain-core` ve `db/migrations/0001_core.sql` bu kararı uygular; kabul testleri T-64..T-69 doğrular.
