# Faz 0 — Domain çekirdeği, pilot sertleştirmesi ve HPTW iç pilotu (4–5 ay)

Sıra bağlayıcıdır: her epic bir öncekinin çıktısını kullanır. Her story için: spec, T-xx, DoD.

## E0.1 Depo ve altyapı (1 hafta)
- [ ] S0.1.1 pnpm workspace, tsconfig strict, ESLint (toUpperCase/toLowerCase yasağı), Prettier, husky pre-commit (`tr-kontrol`, `lint`).
- [ ] S0.1.2 `apps/api` NestJS iskeleti (modüller: org, ingestion, analysis, targets, actions, evidence, execution, attention, policy, platform); OpenAPI üretimi; health endpoint.
- [ ] S0.1.3 PostgreSQL 16 + Drizzle migrasyon çalıştırıcı; roller `hpw_migrator`/`hpw_app` (NOBYPASSRLS); `pnpm rls-check` (db/scripts).
- [ ] S0.1.4 Docker compose (postgres, redis, minio); OpenTelemetry temel; CI (.github/workflows/ci.yml).
- [ ] S0.1.5 `packages/domain-core` yayınlanabilir; testler CI'da. DoD: `pnpm -r test` yeşil.

## E0.2 Tenant, kimlik, komut zarfı (2 hafta)
- [ ] S0.2.1 Tenant/Organization/Person tabloları + RLS + `SET LOCAL app.tenant_id` middleware (T-47).
- [ ] S0.2.2 OIDC (Entra) ile oturum; `actor`/`acting_for` türetme; Delegation tablosu.
- [ ] S0.2.3 Komut zarfı middleware: Idempotency-Key, If-Match, correlation/causation; `command_log`; 409 gövdesi (T-14, T-31).
- [ ] S0.2.4 Outbox + relay + `processed_events` + DLQ tabloları; olay zarfı; replay komutu (T-13).
- [ ] S0.2.5 AuditEvent (referansla, kişisel veri yok); audit yazımı handler sırasında.
- [ ] S0.2.6 `packages/policy` iskeleti: `decide()`; temel roller; SoD kuralı çerçevesi (tam ABAC Faz 1).

## E0.3 Organizasyon grafı (3 hafta) — M02
- [ ] S0.3.1 HierarchyGroup, OrgUnit (effective-dated, timezone, calendar), OrgRelationship; closure table + yeniden hesaplama.
- [ ] S0.3.2 `is_rollup` tek grup kısıtı; scope sorguları `asOf`.
- [ ] S0.3.3 ResponsibilityMap + ResponsibilityAllocation (pay, decision_authority).
- [ ] S0.3.4 ReorganizationEvent draft/approve; süreç yürütücü ile rename/move/close/open (docs/workflows/reorg-transfer.md) (T-16, T-37).
- [ ] S0.3.5 Person deprovision → inactive → Ownership.Orphaned olayı (devir ekranı Faz 1) (T-38 kısmi).
- [ ] S0.3.6 Atlas seed'i içe alan komut: `pnpm seed:atlas && pnpm api:load-atlas` (T-01).

## E0.4 Süreç yürütücü (2 hafta) — M12
- [ ] S0.4.1 `packages/workflow`: WorkflowDefinition/Instance/Step/Timer/Incident tabloları; adım yürütücü (idempotency_key, retry, incident); kalıcı timer poller.
- [ ] S0.4.2 Reorg süreci bu yürütücü üzerinde; çökme testi (T-12).
- [ ] S0.4.3 Toplu içe alma süreci (1M satır, yeniden başlatılabilir) (T-46).

## E0.5 Sonuç alma (2 hafta) — M01
- [ ] S0.5.1 SurveyCycle/SurveySource/ItemCatalog/ItemVersion; HPTW native JSON payload (docs/api) ve CSV şablonu.
- [ ] S0.5.2 Normalizasyon, baskılama (n<5, yorum 10, üst çıkarım koruması), `result_visible` görünümü (T-06).
- [ ] S0.5.3 Kalite bayrakları, eşleme ekranı için API; commit süreci.

## E0.6 Analiz ve öncelik (1,5 hafta) — M03
- [ ] S0.6.1 Sinyaller ve PriorityAssessment v2.2 (`domain-core/priority`: şiddet, güven, kontrol, yük), eşikler, tenant ağırlıkları; birimin kendi öncelik listesi.
- [ ] S0.6.2 Sorun yeri sınıflandırması ve segmentasyon A–D; relevance önerisi API'si.

## E0.6b Semantik kilit — backend kilidi kapısı (1 hafta, E0.7'den önce) — ADR-0017..0024
- [x] S0.6b.1 domain-core: `assessPriority` (dört eksen), `proposeLocal` + `reconcile` (yerel-önce uzlaştırma, SUPPORTED/GAP/INFEASIBLE), `canExpose` + ikincil baskılama, `evidenceRisk/evidenceLevel`, `causalEvidenceGrade`; testler T-55..T-61.
- [x] S0.6b.2 Şema: result.aggregation_weight, priority_assessment, target.kind (corporate_ambition/local_numeric/maintain), target_reconciliation_run, evidence_requirement.evidence_level, outcome.causal_evidence_grade.
- [x] S0.6b.2b v2.3 kanonik: metric_definition/metric_version/scoring_rule_version; corporate_ambition / local_target / functional_kpi / contribution_projection ayrı tablolar; org_role + accountability_assignment; disclosure_decision; outcome_assessment (atıf derecesi); evidence kural-önce; strateji ayrı eksen; yük politikası; domain-core testleri T-64..T-69.
- [ ] S0.6b.3 İçe alma: HPTW native payload ve CSV şablonuna `aggregation_weight` ve `metric_version`; reconciliation testi T-57 (üst skor birebir).
- [ ] S0.6b.4 `packages/policy`: gizlilik çıktı kapısı bütün okuma uçlarında (hedef, katkı, açıklama, karne); çalışan hesabına sahiplik reddi (T-62).
- [ ] S0.6b.5 Onay modu ayarı (açık / politika tabanlı), istisna tespiti (`detectExceptions`: gizlilik, düşük güven, aralık üstü, önemli üzerine yazma, sahiplik belirsizliği, yetki boşluğu, kapasite, çatışma, veri kalitesi, reorg, doğrulama boşluğu) ve toplu onay uç noktaları.
- [ ] S0.6b.7 Çok kiracılı kimlik: e-posta alanı → tenant eşlemesi, tenant başına SSO (OIDC) ve SCIM, HPTW personeli için ayrı kimlik alanı ve yetkili müşteri listesi; müşteri kurulum süreci (7 adım, WorkflowInstance) ve `tenant_onboarding` durumu.
- [x] S0.6b.8 (v2.3.1) Karar çekirdeği düzeltmeleri: gizlilikte varsayılan ret + iç/dış DTO, inceleme kapısı, kanıt geçerliliği önce, girdi doğrulama, UTC/çakışma, yanıt uygunluğu, dört durum ekseni, kapatma anlamı (ADR-0033..0038; testler karsi-ornekler.test.ts). SQL/API tek sözlükte. Prototipte aynı kayıt zinciri.
- [ ] S0.6b.9 G0 kapısı: gerçek PostgreSQL'de RLS/kısıt/EXCLUDE/eşzamanlılık testi (docker compose), sözleşme testi (SQL enum = domain tip = OpenAPI şema), lockfile ile temiz checkout CI.
- [ ] S0.6b.10 G1 kapısı: izinli gerçek HPTW sonuç dosyasıyla resmî üst skor mutabakatı (T-57 gerçek fixture); veri düzeltme dilimi (import_batch → correction_run → etkilenen onayların geçersizleşmesi) uçtan uca; hukuk/güvenlik kontrolü.
- [x] S0.6b.11 (v2.4) Enstrüman modeli + sonuç paketi çözümleyici + algılama + panel türetme + sorumluluk merkezi (domain, SQL, API, prototip; ADR-0039..0041, T-70..T-76).
- [ ] S0.6b.12 Metodoloji onayı: referans enstrümandaki sorumluluk merkezi eşlemesi (75 madde) ve tenant kurulumunda `responsibility_center_role` bağlama ekranı.
- [ ] S0.6b.13 HPTW export'undan gerçek sonuç paketi üretimi (PowerBI/rapor üretim hattından manifest + CSV'ler) ve gerçek dosyayla T-70/T-72.
- [ ] S0.6b.6 Kaçış ölçümleri (escape telemetry) olay kataloğuna; export/import politikası; PostgreSQL yamalı sürüm kapısı deploy listesine.

## E0.7 Hedef ağı ve cascade (3 hafta) — M04
- [ ] S0.7.1 Target (sürümlü), TargetRelationship (partial unique kanonik kenar, T-07), TargetCohort/CohortMember (BASELINE_FROZEN), AllocationRun.
- [ ] S0.7.2 `proposeLocal()` + `reconcile()` entegrasyonu → TargetReconciliationRun; GAP/INFEASIBLE kararı Genel Müdür'e (T-02, T-03, T-04, T-05, T-50, T-56).
- [ ] S0.7.3 Onay akışı (submit/approve, If-Match; politika içi toplu onay); versiyonlama; `explain` endpoint'i ("Neden 55?" — akran dağılımı / bant kaynağıyla, katkı birim düzeyinde yok).
- [ ] S0.7.4 Roll-up ve fizibilite yeniden hesabı olay tüketicisi; at_risk + AttentionItem üretimi (T-49 temel).

## E0.8 Aksiyon modeli (3 hafta) — M05
- [ ] S0.8.1 Action (standalone/master/local_execution), Deployment kapsam kuralı, local_execution üretimi (süreç) (T-10).
- [ ] S0.8.2 ActionContribution (ağırlık ≤1), ActionParticipant, Dependency (döngü kontrolü), ActionTemplate + HPTW başlangıç kütüphanesi (10 şablon).
- [ ] S0.8.3 Öneri motoru v0: şablon eşleme (dimension + context_tags), ≤3 öneri, önerilen paket; decline reason_code → sistem davranışı (bütçe → ResourceRequirement Faz 1'de; şimdilik dikkat öğesi).
- [ ] S0.8.4 Master dağılım görünümü; yeni/kapanan birimde otomatik yerel uygulama.

## E0.9 Kanıt ve doğrulama (2,5 hafta) — M06
- [ ] S0.9.1 EvidenceRequirement (şablondan kopya, sürüm kilidi), Evidence (dosya: hash, virüs, saklama sınıfı; link; attestation), EvidenceVerification.
- [ ] S0.9.2 `complete` → evidence_pending; kural motoru (count/duration/attendance/artifact/attestation); partially_verified (T-24, T-25).
- [ ] S0.9.3 `evidenceConfidence()` entegrasyonu (bağlayıcısız); review_required → AttentionItem; insan kararı; SoD (T-20, T-22 temel).
- [ ] S0.9.4 Kanıt inceleme süreci (docs/workflows/evidence-review.md).

## E0.10 Yürütme ve dikkat üretimi (1,5 hafta) — M07/M08
- [ ] S0.10.1 CheckIn (progress, confidence, not); termin uzatma; iptal.
- [ ] S0.10.2 AttentionItem tablosu ve üretimi (feasibility, orphan, evidence review, handover); e-posta bildirimi; kuyruk ekranı Faz 1.
- [ ] S0.10.3 Anlamsal çatışma (409 SEMANTIC_CONFLICT) (T-30).

## E0.11 Minimal arayüz ve scorecard (3 hafta) — M11
- [x] S0.11.1 `apps/web`: React + Vite iskeleti, i18n (tr/en), HPTW marka tasarım sistemi (`docs/design/hpw-act-arayuz-sistemi.md`, tokens.css), erişilebilirlik temeli, `pnpm brand-qa`.
- [x] S0.11.2 Ekranlar mock adaptörle: giriş; dikkat kuyruğu; içe alma; birim sonuçları (baskılama); hedef allocate/onayla + "Neden?" + 409 çatışma; aksiyon öner/kabul/reddet; yerel uygulama dağılımı; kanıt yükle/doğrula (SoD); scorecard (frozen/current).
- [x] S0.11.2b 13 aktör (müşteri + HPTW rolleri), rol tabanlı gezinme ve dikkat kuyruğu, `Guard` politika reddi, kapsam kilitleri (şube müdürü yalnız kendi satırı); yeni ekranlar: Kurumsal, Organizasyon, Kullanıcılar, Ayarlar, Tenantlar, Metodoloji, Denetim.
- [ ] S0.11.3 `src/api/mock.ts` → gerçek API adaptörü (openapi.yaml); oturum OIDC; toplu işlem ve dikkat kapatma gerekçesi sunucuya.
- [ ] S0.11.4 Türkçe collation ve casing testleri (T-42); Playwright e2e (giriş → hedef onay → 409).

## E0.12 Pilot kabulü (1 hafta)
- [ ] Gerçek HPTW müşterisi sonuçlarıyla kurumsal hedef üç seviyeye dağıtıldı; aynı girdi aynı sonucu üretiyor.
- [ ] Bir master action ≥20 birime yerel uygulama; "tamamlandı" kanıtsız doğrulanmıyor.
- [ ] Reorg (move+close) tarihçeyi bozmuyor, yarıda kesilince devam ediyor; eski ekrandan kayıt 409.
- [ ] Zorunlu Faz 0 testleri: T-03, T-05, T-07, T-12, T-14, T-37, T-47, T-50 (+ T-01, T-02, T-04, T-06, T-08, T-09, T-10, T-13, T-16, T-24, T-25, T-31, T-42, T-46).

## Açık sorular (Claude Code buraya ekler)
- (boş)
