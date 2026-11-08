export type RelationshipType = 'inherited' | 'contribution' | 'support' | 'local' | 'shared' | 'exception' | 'excluded' | 'monitor' | 'priority_only';
export type InclusionState = 'active' | 'no_baseline' | 'suppressed' | 'excluded' | 'monitor' | 'contribution' | 'support';
export type CohortPolicy = 'BASELINE_FROZEN' | 'CURRENT_ORG_DYNAMIC' | 'LINEAGE_ADJUSTED';
/** Dış (kullanıcıya çıkabilen) yerel hedef türleri. Sayısal olmayan türler sayısal alan taşımaz. */
export type LocalTargetKind = 'numeric' | 'maintain' | 'priority_only' | 'validation_required' | 'none';
/** SQL ile aynı sözlük: local_target.source */
export type ProposalSource = 'peer_history' | 'methodologist_band' | 'approved' | 'exception' | 'fixed_member';

export interface MetricScale { min: number; max: number; }
export const SCORE_0_100: MetricScale = { min: 0, max: 100 };

export interface CohortMember {
  unitId: string;
  relationship: RelationshipType;
  inclusionState: InclusionState;
  /** Resmî toplama ağırlığı (sonuç dosyasından; ≥ 0, sonlu). Sıfır ağırlık açıkça dışlanır. */
  aggregationWeight: number;
  baseline?: number;
  benchmark?: number;
  trend?: number;
  approvedException?: number;
  approvedTarget?: number;
  /** Yanıt sayısı — veri güveni uygunluğu için. */
  responseN?: number;
  /** Akran gözlemi (ham); politika bandı dışına çıkarsa öneri banttan gelir ve kaynak öyle etiketlenir. */
  peerDelta?: { suggested: number; upper: number; sampleSize: number };
}
export interface TargetCohort { cohortId: string; policy: CohortPolicy; snapshotHash: string; members: CohortMember[]; scale?: MetricScale; }

export interface DeltaBand { maxScoreExclusive: number; minDelta: number; maxDelta: number; }
export interface AllocationPolicy {
  bands: DeltaBand[]; benchmarkPull: number; epsilon: number; meaningfulMovement: number; minPeerSample: number; minResponseN: number; policyVersion: string;
}
export const DEFAULT_ALLOCATION_POLICY: AllocationPolicy = {
  bands: [{ maxScoreExclusive: 55, minDelta: 3, maxDelta: 10 }, { maxScoreExclusive: 75, minDelta: 2, maxDelta: 7 }, { maxScoreExclusive: 101, minDelta: 1, maxDelta: 4 }],
  benchmarkPull: 0.5, epsilon: 0.01, meaningfulMovement: 1.5, minPeerSample: 30, minResponseN: 5, policyVersion: 'policy-v2.3.1',
};

/** İÇ nesne: aritmetik için; gizli birimlerin sayıları da burada durur, dışarı ÇIKMAZ. */
export interface InternalProposal {
  unitId: string; kind: 'numeric' | 'maintain'; baseline: number; low: number; high: number; target: number; fixed: boolean; weight: number;
  source: ProposalSource; hidden: boolean; peerObservation?: { suggested: number; upper: number; sampleSize: number };
  /** Tam hassasiyetli katkı; gösterimde yuvarlanır. */
  contributionForecast: number;
}
/** DIŞ nesne (DTO): kullanıcıya, API'ye, export'a çıkan tek biçim. Gizli birimde sayısal alan yoktur. */
export type LocalTargetProposal =
  | { unitId: string; kind: 'numeric' | 'maintain'; baseline: number; low: number; high: number; target: number; fixed: boolean; source: ProposalSource; peerObservation?: { suggested: number; upper: number; sampleSize: number }; monitoringRole: string; interventionOwnerRole: string }
  | { unitId: string; kind: 'priority_only'; reason: 'privacy'; rationale: string; monitoringRole: string; interventionOwnerRole: string }
  | { unitId: string; kind: 'validation_required'; reason: 'low_data_confidence'; monitoringRole: string; interventionOwnerRole: string }
  | { unitId: string; kind: 'none'; reason: 'no_baseline' | 'zero_weight' | 'not_in_arithmetic'; monitoringRole: string; interventionOwnerRole: string };

export type ReconciliationStatus = 'SUPPORTED' | 'GAP' | 'UNSUPPORTED';
export type ReconciliationOption = 'LOWER_AMBITION' | 'ADD_CENTRAL_INTERVENTION' | 'ACCEPT_STRETCH_WITHIN_BOUNDS' | 'CHANGE_TIME_HORIZON';

export interface TargetReconciliationRun {
  algorithmVersion: string; policyVersion: string; cohortSnapshotHash: string;
  corporateAmbition: number;
  /** Dışa çıkabilen yerel öneriler (gizli birimler sayısız kayıtla). */
  localProposals: LocalTargetProposal[];
  /** Dondurulmuş kohort ve resmî ağırlıkla PROJEKSİYON (gelecek skor tahmini değil). */
  supportedProjection: number;
  /** Mevcut politika ve kaynak varsayımları altındaki üst senaryo (fiziksel tavan değil). */
  upperScenario: number;
  status: ReconciliationStatus;
  gap: number;
  /** GAP: farkı tavanlar içinde dağıtan seçenek; uygulanmaz. Gizli birimler dahil edilmez. */
  stretchAdjustments?: { unitId: string; from: number; to: number }[];
  /** Esnetme fiilen uygulanınca hesaplanan projeksiyon ve kapanmayan fark (F21). */
  stretchedProjection?: number; residualGap?: number;
  options: ReconciliationOption[];
  /** Aritmetiğe giren ama sayısı gizli tutulan birimler. */
  hiddenParticipants: string[];
  nonArithmetic: { unitId: string; reason: 'no_baseline' | 'contribution' | 'support' | 'zero_weight' }[];
  explanation: string[];
}
