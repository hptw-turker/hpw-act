/** Mimari 10.4 — kanıt güveni başlangıç modeli; eşikler ve ağırlıklar kalibre edilecek. */
export type EvidenceType = 'declaration' | 'artifact' | 'attestation' | 'system_data' | 'employee_outcome';

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  fileHash?: string;
  /** Kanıtın ait olduğu tarih; gereksinim penceresiyle kıyaslanır. */
  date?: string; // ISO
  submittedBy: string;
  /** Bağlayıcı metriği (system_data) */
  metricValue?: number;
}

export interface EvidenceRequirementSpec {
  ruleType: 'count' | 'duration' | 'attendance' | 'artifact' | 'attestation' | 'system_metric';
  expectedValue: number;
  windowStart?: string;
  windowEnd?: string;
  isCritical: boolean;
}

export interface ConfidenceContext {
  actionId: string;
  /** Aynı ana aksiyonun yerel uygulamalarını tanımlar; bunlar arasında hash paylaşımı meşrudur (I-24). */
  masterActionId?: string;
  ownerId: string;
  verifierId?: string;
  /** Doğrulayıcı, sahibin vekili mi (Delegation). */
  verifierActsForOwner?: boolean;
  /** Aynı hash'in kullanıldığı diğer aksiyonlar: {actionId, masterActionId} */
  otherActionsWithSameHash?: { actionId: string; masterActionId?: string }[];
  /** Sahibin beyan ettiği değer (ör. 200 katılımcı) */
  ownerClaimedValue?: number;
  /** Aynı kullanıcının son 24 saatte tamamladığı aksiyon sayısı */
  completionsLast24h?: number;
  bulkCompletionThreshold?: number; // varsayılan 10
}

export interface ConfidenceResult {
  score: number;               // 0..100
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'verified' | 'partially_verified' | 'review_required';
  coverage: number;            // 0..1
  anomalyFlags: string[];
  components: { coverage: number; sourceTrust: number; independence: number; temporal: number; crossConsistency: number; penalty: number };
}

const SOURCE_TRUST: Record<EvidenceType, number> = { system_data: 1.0, employee_outcome: 1.0, attestation: 0.85, artifact: 0.65, declaration: 0.40 };

function inWindow(d: string | undefined, req: EvidenceRequirementSpec): boolean {
  if (!d) return true;
  if (req.windowStart && d < req.windowStart) return false;
  if (req.windowEnd && d > req.windowEnd) return false;
  return true;
}

import { validateEvidence, type ScopedEvidence, type ScopedRequirement } from './validity.js';
/** Geçerlilik önce: geçersiz kanıt kapsamaya girmez; reddedilenler bayrak olarak döner. */
export function evidenceConfidence(req: EvidenceRequirementSpec, evidenceIn: EvidenceItem[], ctx: ConfidenceContext): ConfidenceResult & { rejected: { id: string; reason: string }[] } {
  const flags: string[] = [];
  const validity = validateEvidence(req as ScopedRequirement, evidenceIn as ScopedEvidence[]);
  const evidence = validity.valid;
  for (const r of validity.rejected) flags.push(`invalid_evidence:${r.reason}:${r.id}`);
  const nonDeclaration = evidence.filter(e => e.type !== 'declaration');

  // coverage: kural tipine göre karşılanan / beklenen
  let satisfied = 0;
  if (req.ruleType === 'count' || req.ruleType === 'artifact') satisfied = nonDeclaration.filter(e => inWindow(e.date, req)).length;
  else if (req.ruleType === 'attendance' || req.ruleType === 'system_metric' || req.ruleType === 'duration') {
    const metric = evidence.filter(e => e.metricValue !== undefined).map(e => e.metricValue!);
    satisfied = metric.length ? Math.max(...metric) : 0;
  } else if (req.ruleType === 'attestation') satisfied = evidence.some(e => e.type === 'attestation') ? req.expectedValue : 0;
  const coverage = req.expectedValue > 0 ? Math.min(1, satisfied / req.expectedValue) : (nonDeclaration.length ? 1 : 0);

  const sourceTrust = evidence.length ? evidence.reduce((s, e) => s + SOURCE_TRUST[e.type], 0) / evidence.length : 0;
  const independence = ctx.verifierId && ctx.verifierId !== ctx.ownerId && !ctx.verifierActsForOwner ? 1.0 : 0.30;
  const withDate = evidence.filter(e => e.date);
  const temporal = withDate.length ? withDate.filter(e => inWindow(e.date, req)).length / withDate.length : 1;

  // çapraz tutarlılık: beyan vs bağlayıcı metriği
  let crossConsistency = 1;
  let mismatchSeverity = 0;
  const connector = evidence.find(e => e.type === 'system_data' && e.metricValue !== undefined);
  if (connector && ctx.ownerClaimedValue !== undefined && ctx.ownerClaimedValue > 0) {
    mismatchSeverity = Math.min(1, Math.abs(ctx.ownerClaimedValue - connector.metricValue!) / ctx.ownerClaimedValue);
    crossConsistency = 1 - mismatchSeverity;
    if (mismatchSeverity > 0.15) flags.push('connector_contradicts_claim');
  }

  // cezalar
  let penalty = 0;
  const unrelatedDup = (ctx.otherActionsWithSameHash ?? []).filter(o => !(ctx.masterActionId && o.masterActionId === ctx.masterActionId));
  if (unrelatedDup.length > 0) { penalty += 0.25; flags.push('duplicate_hash_unrelated'); }
  if (withDate.some(e => !inWindow(e.date, req))) { penalty += 0.15; flags.push('evidence_outside_window'); }
  if (mismatchSeverity > 0.15) penalty += 0.30 * mismatchSeverity;
  if ((ctx.completionsLast24h ?? 0) >= (ctx.bulkCompletionThreshold ?? 10)) { penalty += 0.20; flags.push('suspicious_bulk_completion'); }
  if (evidence.length === 0 || evidence.every(e => e.type === 'declaration')) flags.push('declaration_only');
  if (ctx.verifierId && (ctx.verifierId === ctx.ownerId || ctx.verifierActsForOwner)) flags.push('owner_is_verifier');

  const raw = 0.30 * coverage + 0.25 * sourceTrust + 0.15 * independence + 0.15 * temporal + 0.15 * crossConsistency - penalty;
  let score = Math.round(Math.max(0, Math.min(1, raw)) * 100);
  // Beyan ile sistem verisi ciddi çelişiyorsa (>%30) güven Düşük'e sabitlenir; karar insana gider.
  if (mismatchSeverity > 0.30) score = Math.min(score, 59);
  const confidence: ConfidenceResult['confidence'] = score >= 80 ? 'HIGH' : score >= 60 ? 'MEDIUM' : 'LOW';
  const status: ConfidenceResult['status'] = confidence === 'LOW' ? 'review_required' : coverage < 1 ? 'partially_verified' : 'verified';
  return { score, confidence, status, coverage, anomalyFlags: flags, components: { coverage, sourceTrust, independence, temporal, crossConsistency, penalty }, rejected: validity.rejected };
}

/** SoD sert kuralı (I-23, T-20): kritik gereksinimde doğrulayıcı sahip veya vekili olamaz. Politika katmanı bunu çağırır. */
export function verifierAllowed(req: EvidenceRequirementSpec, ownerId: string, verifierId: string, verifierActsForOwner: boolean): boolean {
  if (!req.isCritical) return true;
  return verifierId !== ownerId && !verifierActsForOwner;
}
