# ADR-0035: İnceleme kapısı, atıf kaydı ve kanıt geçerliliği önce

**Durum:** Kabul edildi (v2.3.1, 24.09.2026) — inceleme raporu P0-02, P0-03 (A06, A13–A18)

## Karar
**İnceleme kapısı.** `review_required` + geçerli metodolog onayı yok → `OutcomeAssessment.status = PENDING_REVIEW`, attainment `NOT_EVALUATED`. Gözlem ayrı saklanır (`observed_above_target`): "gözlenen skor hedef üzerinde" ile "hedef doğrulandı" farklı cümlelerdir. Onay (`ComparabilityReview`) aynı sonuç revizyonunu ve karşılaştırılabilirlik sürümünü referans gösterir; sonuç düzeltilirse geçersizleşir. **Atıf.** A/B derecesi yalnız kayıtlı tasarım (`attribution_design_record_id`), karşılaştırma grubu ve inceleme ile; alana "deneysel" yazmak derece kazandırmaz, `estimated_effect` C/D'de yayımlanmaz.

**Kanıt sırası.** Önce geçerlilik: tür (kural tipine uygun), iş/birim/metrik eşleşmesi, tarih penceresi, kaynak, tekil gerçekleşme (`occurrence_key`; dosya hash'i tek başına olay tanımlamaz), eski dönem metriği, sonuç verisinin uygulama kanıtı olmaması. Geçersiz kanıt gereksinime sayılmaz (`rejected_evidence`). Sonra E0–E4 politikası, en sonda inceleme önceliği/güven puanı. E3'ün insan incelemesi ve E4'ün örneklem denetimi sistem izi bulununca kaybolmaz. E0/E1'de yapılandırılmış kayıt (tarih + gerçekleşti + katılımcı) yeter; PDF istenmez. E0 "beyanla politika karşılandı" etiketi bağımsız doğrulanmış gerçek anlamına gelmez.

## Kanıt
`packages/domain-core/src/comparability/assess.ts`, `src/evidence/{validity,confidence,risk}.ts`; testler `test/comparability.test.ts` (T-28 düzeltildi), `test/karsi-ornekler.test.ts` (A15–A18), `test/privacy-risk.test.ts` (A13/A14).
