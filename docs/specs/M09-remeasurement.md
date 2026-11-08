# M09 — Yeniden ölçüm, karşılaştırılabilirlik, sonuç değerlendirme

**Mimari bölüm:** 13 · **Faz:** 2

## Amaç
Yeni ölçüm geldiğinde karşılaştırılabilirliği değerlendirir (kapı), Outcome yazar, dört karar yolunu açar, etkinlik istatistiklerini besler.

## Nesneler
ComparabilityAssessment, Outcome, ExternalFactor, EffectivenessStat.

## Kurallar ve algoritmalar
- Faktörler: n değişimi, yanıt oranı, madde sürümü, nüfus devamlılığı, lineage olayları, ölçüm aralığı, kalite bayrakları → Yüksek/Orta/Düşük + auto_valid/review_required/not_comparable (`packages/domain-core/src/comparability`).
- Kapı: not_comparable → attainment NOT_EVALUATED, impact insufficient_measurement, impact_confidence Düşük (I-25, T-28, T-29); review_required → Metodolog/HR Admin.
- OutcomeAssessment: observed_change, attainment, movement_class, external_factors, decision, `attribution_evidence_grade` A/B/C/D (ADR-0027: C = zamansal ilişki, nedensellik kanıtlanmadı; `estimated_effect` yalnız A/B), `causal_claim=false` (I-26). Kontrol kulesi üç ayrı cümle: doğrulandı mı / iyileşti mi / bu aksiyondan mı biliniyor mu.
- Etkinlik istatistiği yalnız C ve üstünden, 'birlikte gözlendi' etiketiyle öğrenir.
- Çapraz matris: uygulama × iyileşme; 'business outcome gerçekleşti / planned execution gerçekleşmedi' ayrı (T-26, T-27).
- EffectivenessStat yalnız Yüksek/Orta karşılaştırılabilirlikten (Faz 3).

## API (özet; tam sözleşme docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz))
POST /cycles/{id}/evaluate (job) · GET /targets/{id}/comparability · POST /targets/{id}/comparability/decide (Metodolog) · GET /targets/{id}/outcome · POST /targets/{id}/outcome/decision · POST /cycles/{id}/external-factors.

## Olaylar
`Comparability.Assessed`, `Outcome.Evaluated/Decided`, `ExternalFactor.Recorded`.

## Kabul kriterleri
T-17, T-26, T-27, T-28, T-29.
