# Nesneler ve Faz 0 kapsamı

Tam alan listesi mimari bölüm 16'da. Bu dosya Faz 0'da hangi nesnelerin hangi kapsamda kurulacağını söyler.

| Nesne | Faz 0 | Not |
|---|---|---|
| Tenant, Organization, HierarchyGroup, OrgUnit, OrgRelationship | ✓ tam | closure table per group, effective-dated |
| ReorganizationEvent, OrgLineage | ✓ rename/move/close/open | split/merge Faz 2 |
| ResponsibilityMap, ResponsibilityAllocation | ✓ | öğrenme (escalation'dan) Faz 2 |
| Person, RoleAssignment, Delegation | ✓ (Delegation temel) | vekâlet UI Faz 1 |
| SurveyCycle, SurveySource, ItemCatalog, ItemVersion, Result | ✓ | HPTW native + CSV |
| MetricDefinition, MetricVersion, ScoringRuleVersion | ✓ | v2.3 (ItemCatalog/ItemVersion'ın yerine) |
| OrgRole, AccountabilityAssignment | ✓ | v2.3 rol merkezli sahiplik |
| PriorityAssessment (şiddet, güven, kontrol, yük, stratejik önem, karar, sahip) | ✓ | v2.3 |
| CorporateAmbition, LocalTarget, FunctionalKPI, ContributionProjection (türetilmiş) | ✓ | v2.3 fiziksel ayrım |
| DisclosureDecision | ✓ | v2.3 |
| FocusArea, TargetRelationship (kapsam/soy kütüğü), TargetCohort, CohortMember (aggregation_weight), TargetReconciliationRun | ✓ | contribution/support Faz 1 |
| ExceptionRequest, TargetConflict, BusinessGoal | Faz 1 / Faz 2 | |
| Action, Deployment, ActionContribution, ActionParticipant, Dependency, ActionTemplate | ✓ | kütüphane içeriği HPTW danışman |
| EvidenceRequirement (evidence_level E0–E4, evidence_risk), Evidence, EvidenceVerification | ✓ (kişi doğrulaması) | bağlayıcılar ve anomali Faz 2 |
| CheckIn, KPIDefinition, KPIValue | ✓ temel | |
| ProblemEscalation, IssueCluster | Faz 1 / Faz 2 | |
| ResourceRequirement, ResourceCommitment | Faz 1 | manuel |
| OutcomeAssessment (attribution_evidence_grade, observed_change), ComparabilityAssessment, ExternalFactor | tablo Faz 0, akış Faz 2 | |
| AttentionItem, NotificationRule | Faz 1 (Faz 0'da yalnız üretim, kuyruk ekranı yok) | |
| AuditEvent, CommandLog, OutboxEvent, ProcessedEvent | ✓ | |
| WorkflowInstance/Step/Timer/Incident | ✓ (Postgres yürütücü) | Temporal Faz 2 |
| DataRetentionPolicy, LegalHold, DeletionRequest, AnonymizationJob, DataTransferRegister | Faz 0 tasarım/tablo, Faz 2 akış | |
| EffectivenessStat, WorkloadIndex | Faz 3 / Faz 1 | |
