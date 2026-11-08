# M05 — Aksiyon modeli: ana/yerel, katkı, katılımcı, bağımlılık, kaynak, kümeleme, kapasite

**Mimari bölüm:** 9 · **Faz:** 0 (kümeleme Faz 2, kaynak Faz 1)

## Amaç
Aksiyonları standalone/master/local_execution olarak yönetir; çoktan çoğa hedef katkısı; RACI katılımcıları; bağımlılık; öneri ve reddetme döngüsü; sorun escalation'ı ve kümeleme; kaynak gereksinimi; kapasite.

## Nesneler
Action, Deployment, ActionContribution, ActionParticipant, Dependency, ActionTemplate, ProblemEscalation, IssueCluster, ResourceRequirement, ResourceCommitment, WorkloadIndex.

## Kurallar ve algoritmalar
- master → Deployment(scope_rule) → local_execution × N; master durumu dağılım; `completion_threshold` ile 'tamamlandı' yalnız sahip kararıyla (I-16, T-10).
- Yeni birim kapsama girince otomatik local_execution; kapanan birimde lineage notuyla iptal.
- ActionContribution ağırlık toplamı ≤ 1 (I-17); Dependency döngü kontrolü (I-18).
- Öneri: en fazla 3, önerilen paket; kabul / değiştir / uygun değil; neden kodları ve sistem davranışı tablosu (mimari 9.3): out_of_authority → ResponsibilityMap + ortak aksiyon/escalation; budget_required → ResourceRequirement + dikkat + alternatif; staff_shortage → kapasite + alternatif; covered_by_other → mevcut aksiyona bağla; not_fit_local → farklı bağlam etiketi; other → HRBP.
- ProblemEscalation → kümeleme (lever + accountable + dimension; eşik % kardeş veya mutlak) → IssueCluster → kurumsal master action önerisi (Faz 2, T-51).
- ResourceRequirement/Commitment manuel (Faz 1, T-39); açık = requested − committed; açık varsa aksiyon at_risk.
- WorkloadIndex türetilmiş; 'dolu' → öneri motoru alternatif sahip; manuel kapasite girişi yok.

## API (özet; tam sözleşme docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz))
POST /actions (standalone|master) · POST /actions/{id}/deploy (scope_rule) → job · GET /actions/{id}/distribution · POST /actions/{id}/contributions · POST /actions/{id}/participants · POST /actions/{id}/dependencies · POST /actions/{id}/decline (reason_code) → proposals · POST /actions/{id}/escalate-problem · GET /issue-clusters · POST /issue-clusters/{id}/convert · POST /actions/{id}/resource-requirements · POST /resource-requirements/{id}/commitments · GET /people/{id}/workload.

## Olaylar
`Action.Created/Deployed/Declined/Cancelled`, `LocalExecution.Created/Cancelled`, `Problem.Escalated`, `IssueCluster.Formed/Converted`, `Resource.Requested/Committed`.

## Kabul kriterleri
T-08, T-09, T-10, T-11, T-21, T-39, T-51, T-53.
