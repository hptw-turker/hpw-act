# ADR-0033: Veri düzeltme, ana aksiyon sürümü ve yaşam döngüsü sözleşmeleri

**Durum:** Kabul edildi (v2.3.1, 24.09.2026) — inceleme raporu P0-06

## Karar
Üç birbirine bağlı sözleşme zorunludur.

1. **ImportBatch / ResultRevision / CorrectionRun.** Sonuç verisi taslakta doğrulanır (`import_batch.state: draft → validated → published`), tek görünürlük geçişiyle yayımlanır. Düzeltme eski gözlemi silmez: `result.revision` artar, eski kayıt `superseded_by` ile işaretlenir. `correction_run` düzeltmenin etkilediği hedef, onay, projeksiyon ve sonuçları önizler (`affected_*`); uygulandığında eski onaylar ve `comparability_review` kayıtları geçersizleşir (`invalidated_at`), yürütülmüş işin tarihçesi silinmez.
2. **MasterActionRevision / Deployment(master_revision) / LocalExecution.** Yerel uygulama kabul ettiği ana aksiyon sürümüne bağlı kalır (`action.master_revision`). Yeni sürüme geçiş bir migrasyon kararıdır; tamamlanmış iş geriye dönük eksik sayılmaz. `is_critical_change` işaretli sürüm bildirilir ve onayla taşınır. Periyodik işler tek kalıcı "tamamlandı" yerine `deployment_occurrence` (birim × pencere) ile izlenir; aynı iş farklı event_id'lerle çoğalmaz.
3. **Pause / Resume / Supersede / Reopen / Invalidate.** Yaşam döngüsü ve doğrulama ayrı eksenlerdir (ADR-0036). Afet, kapanış, iptal, düzeltme ya da sonradan yanlışlığı anlaşılan kanıt için sebep, aktör, zaman ve etki kaydedilir (`pause_reason`, `supersede_reason`, `reopen_reason`, `evidence_verification.invalidation_reason`). Kapatmak veya silmek tek çıkış değildir.

## Gerekçe
Yanlış sonuç eşlemesinin taahhütler oluştuktan sonra düzeltilmesi, 400 uygulamaya yayılmış ana aksiyonun revizyonu ve sonradan geçersizleşen kanıt için bağlı sözleşme yoktu.

## Kanıt
`db/migrations/0001_core.sql`: import_batch, correction_run, result.revision/superseded_by, master_action_revision, deployment.master_revision, deployment_occurrence; `docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz)`: /imports/{id}/publish, /imports/{id}/corrections/preview; `packages/domain-core/src/state/states.ts` invalidateEvidence.
