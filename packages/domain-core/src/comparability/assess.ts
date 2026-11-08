/** Mimari 13.1 — karşılaştırılabilirlik değerlendirmesi; kapı davranışı (I-25). */
export interface ComparabilityInput {
  baselineN: number;
  followupN: number;
  baselineResponseRate?: number;
  followupResponseRate?: number;
  itemEquivalence: 'identical' | 'equivalent' | 'changed';
  /** Her iki dönemde de birimde olan çalışan payı (0..1); bilinmiyorsa undefined → headcount değişimi vekil */
  populationContinuity?: number;
  headcountChangeRatio?: number; // |Δ| / baseline
  lineageEventsInPeriod: number;
  measurementIntervalDays: number;
  expectedIntervalDays: number;
  qualityFlagCount: number;
  minN: number; // gizlilik eşiği (5)
}
export interface ComparabilityResult {
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'auto_valid' | 'review_required' | 'not_comparable';
  score: number;
  reasons: string[];
}

export function assessComparability(i: ComparabilityInput): ComparabilityResult {
  if (!Number.isFinite(i.baselineN) || !Number.isFinite(i.followupN) || i.baselineN < 0 || i.followupN < 0) return { level: 'LOW', status: 'not_comparable', score: 0, reasons: ['invalid_n'] } as unknown as ReturnType<typeof assessComparability>;
  const reasons: string[] = [];
  let score = 100;
  if (i.followupN < i.minN) { return { level: 'LOW', status: 'not_comparable', score: 0, reasons: ['followup_below_confidentiality_threshold'] }; }
  if (i.itemEquivalence === 'changed') { return { level: 'LOW', status: 'not_comparable', score: 0, reasons: ['item_materially_changed'] }; }
  if (i.itemEquivalence === 'equivalent') { score -= 10; reasons.push('item_equivalent_not_identical'); }

  const nRatio = i.followupN / Math.max(1, i.baselineN);
  if (nRatio < 0.5 || nRatio > 2) { score -= 35; reasons.push(`response_count_change_${Math.round(nRatio * 100)}pct`); }
  else if (nRatio < 0.75 || nRatio > 1.5) { score -= 15; reasons.push('response_count_change_moderate'); }

  if (i.baselineResponseRate !== undefined && i.followupResponseRate !== undefined) {
    const d = i.baselineResponseRate - i.followupResponseRate;
    if (d > 0.3) { score -= 20; reasons.push('response_rate_dropped'); } else if (d > 0.15) { score -= 10; reasons.push('response_rate_dropped_moderate'); }
  }

  const continuity = i.populationContinuity ?? (i.headcountChangeRatio !== undefined ? 1 - Math.min(1, i.headcountChangeRatio) : undefined);
  if (continuity !== undefined) {
    if (continuity <= 0.5) { score -= 30; reasons.push('population_changed_majority'); }
    else if (continuity < 0.75) { score -= 15; reasons.push('population_changed_significant'); }
  }
  if (i.lineageEventsInPeriod > 0) { score -= Math.min(20, 10 * i.lineageEventsInPeriod); reasons.push('reorg_in_period'); }
  const intervalRatio = i.measurementIntervalDays / Math.max(1, i.expectedIntervalDays);
  if (intervalRatio < 0.5 || intervalRatio > 2) { score -= 10; reasons.push('measurement_interval_abnormal'); }
  if (i.qualityFlagCount > 0) { score -= Math.min(15, 5 * i.qualityFlagCount); reasons.push('data_quality_flags'); }

  score = Math.max(0, score);
  const level: ComparabilityResult['level'] = score >= 80 ? 'HIGH' : score >= 55 ? 'MEDIUM' : 'LOW';
  const status: ComparabilityResult['status'] = level === 'HIGH' ? 'auto_valid' : level === 'MEDIUM' ? 'review_required' : score >= 30 ? 'review_required' : 'not_comparable';
  return { level, status, score, reasons };
}

export type Attainment = 'ACHIEVED' | 'PARTIAL' | 'MISSED' | 'NOT_EVALUATED';
export type MovementClass = 'strong_improvement' | 'limited_improvement' | 'no_change' | 'deterioration' | 'insufficient_measurement';

/** Atıf kanıtı derecesi: A deneysel, B güçlü yarı-deneysel (eşleştirilmiş kıyas + fark-içinde-fark), C karşılaştırılabilir önce/sonra = yalnız zamansal ilişki, D karşılaştırılamaz/yalnız beyan. */
export type AttributionEvidenceGrade = 'A' | 'B' | 'C' | 'D';
export const ATTRIBUTION_LABEL: Record<AttributionEvidenceGrade, string> = { A: 'Nedensel etki için güçlü kanıt', B: 'Aksiyonun etkisiyle uyumlu güçlü atıf kanıtı', C: 'Zamansal ilişki var; nedensellik kanıtlanmadı', D: 'Etki değerlendirilemez' };
/** Metodolog incelemesi: review_required durumunda onay olmadan kesin sonuç yazılmaz; onay aynı sonuç ve karşılaştırılabilirlik sürümünü referans gösterir. */
export interface ComparabilityReview { decision: 'comparable' | 'comparable_labeled' | 'not_comparable'; reviewedBy: string; reviewedAt: string; comparabilityVersion: string; resultVersion: string; }
export interface OutcomeInput { baseline: number; approvedTarget: number; followup: number; comparability: ComparabilityResult; strongThreshold?: number; noiseBand?: number;
  /** review_required için zorunlu; sürümler eşleşmezse onay geçersizdir. */
  review?: ComparabilityReview; comparabilityVersion?: string; resultVersion?: string;
  /** A/B yalnız kayıtlı tasarım, karşılaştırma grubu ve inceleme ile: aksi halde C'ye düşer ve tahmini etki yayımlanmaz. */
  comparison?: { design: 'matched_did' | 'experimental'; comparisonMovement: number; designRecordId?: string; comparisonGroupId?: string; reviewedBy?: string }; }
export type OutcomeStatus = 'EVALUATED' | 'PENDING_REVIEW' | 'NOT_COMPARABLE';
export interface OutcomeResult { status: OutcomeStatus; attainment: Attainment; observedChange: number; movementClass: MovementClass; impactConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Gözlem ayrı: "gözlenen skor hedef üzerinde" demek "hedef doğrulandı" demek değildir. */
  observedAboveTarget: boolean;
  attributionEvidenceGrade: AttributionEvidenceGrade;
  /** Yalnız A/B'de dolar: (post−pre)_treated − (post−pre)_comparison. C'de yalnız observedChange vardır. */
  estimatedEffect?: number; causalClaim: false; }

/** Karşılaştırılabilirlik kapıdır: not_comparable → NOT_EVALUATED (T-28, T-29). Nedensellik iddiası hiçbir zaman yok (I-26). */
export function evaluateOutcome(o: OutcomeInput): OutcomeResult {
  const movement = Math.round((o.followup - o.baseline) * 100) / 100;
  const observedAboveTarget = o.followup >= o.approvedTarget;
  // Onay yalnız her iki sürüm de verilmiş ve birebir eşleşiyorsa geçerlidir (F29)
  const reviewValid = !!o.review && !!o.comparabilityVersion && !!o.resultVersion && o.review.comparabilityVersion === o.comparabilityVersion && o.review.resultVersion === o.resultVersion;
  if (o.comparability.status === 'not_comparable' || (reviewValid && o.review!.decision === 'not_comparable')) {
    return { status: 'NOT_COMPARABLE', attainment: 'NOT_EVALUATED', observedChange: movement, movementClass: 'insufficient_measurement', impactConfidence: 'LOW', observedAboveTarget, attributionEvidenceGrade: 'D', causalClaim: false };
  }
  if (o.comparability.status === 'review_required' && !reviewValid) {
    return { status: 'PENDING_REVIEW', attainment: 'NOT_EVALUATED', observedChange: movement, movementClass: 'insufficient_measurement', impactConfidence: 'LOW', observedAboveTarget, attributionEvidenceGrade: 'D', causalClaim: false };
  }
  const noise = o.noiseBand ?? 1.5;
  const strong = o.strongThreshold ?? Math.max(3, (o.approvedTarget - o.baseline) * 0.75);
  const attainment: Attainment = o.followup >= o.approvedTarget ? 'ACHIEVED' : movement > noise ? 'PARTIAL' : 'MISSED';
  const movementClass: MovementClass = movement >= strong ? 'strong_improvement' : movement > noise ? 'limited_improvement' : movement < -noise ? 'deterioration' : 'no_change';
  const impactConfidence = o.comparability.level === 'HIGH' ? 'HIGH' : o.comparability.level === 'MEDIUM' ? 'MEDIUM' : 'LOW';
  const designRecorded = !!o.comparison && !!o.comparison.designRecordId && !!o.comparison.comparisonGroupId && !!o.comparison.reviewedBy;
  const grade: AttributionEvidenceGrade = designRecorded && o.comparison!.design === 'experimental' ? 'A' : designRecorded && o.comparison!.design === 'matched_did' ? 'B' : o.comparability.level === 'HIGH' || (reviewValid && o.review!.decision === 'comparable') ? 'C' : 'D';
  const estimatedEffect = (grade === 'A' || grade === 'B') && o.comparison ? Math.round((movement - o.comparison.comparisonMovement) * 100) / 100 : undefined;
  return { status: 'EVALUATED', attainment, observedChange: movement, movementClass, impactConfidence, observedAboveTarget, attributionEvidenceGrade: grade, ...(estimatedEffect !== undefined ? { estimatedEffect } : {}), causalClaim: false };
}
