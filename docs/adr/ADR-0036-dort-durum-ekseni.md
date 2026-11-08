# ADR-0036: Dört ayrı durum ekseni

**Durum:** Kabul edildi (v2.3.1, 24.09.2026) — inceleme raporu P0-03

## Karar
İş durumu tek enum'a sıkıştırılmaz. Dört eksen SQL ve uygulamada aynı sözlükle taşınır: yaşam döngüsü (`planned / in_progress / declared_complete / closed / cancelled / paused / superseded`), doğrulama (`pending / auto_verified / human_verified / partial / needs_review / invalidated`), operasyonel sağlık (`on_track / at_risk / blocked / overdue`), sonuç (`not_measured / pending_review / improved / no_meaningful_change / deteriorated / not_comparable`). "Kanıtı doğrulandı ama iş engellendi / sonuç ölçülmedi" gibi bileşimler serbestçe temsil edilir; yalnız mantıksız bileşimler reddedilir (`validateSnapshot`). Ana aksiyonun tek "tamamlandı" alanı yoktur (dağılım).

## Kanıt
`packages/domain-core/src/state/states.ts`; SQL `action.lifecycle_state / verification_state / health_state`, `evidence_verification.state`; `docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz)` ExecutionSnapshot.
