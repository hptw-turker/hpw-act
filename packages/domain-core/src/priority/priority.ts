/** Mimari 7.2 (v2.3) — Öncelik değerlendirmesi beş ayrı eksen: Çalışan şiddeti, Veri güveni, Kontrol edilebilirlik, İş yükü, Stratejik önem.
    Şiddet çalışan sinyalidir; strateji onu değiştirmez (sıralama/zamanlamayı etkiler). Güven şiddeti küçültmez ("doğrulama gerekli" der);
    iş yükü sorunu gizlemez (zamanlama/alternatif sahip); kontrol edilebilirlik önceliği değil sahibi belirler. */
export interface SeverityWeights { need: number; trendRisk: number; relativeGap: number; breadth: number; impact: number; }
export const DEFAULT_SEVERITY_WEIGHTS: SeverityWeights = { need: .40, trendRisk: .20, relativeGap: .15, breadth: .15, impact: .10 };
/** Toplu (yanıt düzeyi veri yok) modda etki tahmini "estimated" olarak küçülür. */
export const AGGREGATE_MODE_SEVERITY_WEIGHTS: SeverityWeights = { need: .45, trendRisk: .20, relativeGap: .15, breadth: .15, impact: .05 };

export interface SeveritySignals { need: number; trendRisk: number; relativeGap: number; breadth: number; impact: number; } // 0..1
export type ConfidenceLabel = 'LOW' | 'MEDIUM' | 'HIGH';
/** Kullanıcıya yüzde gösterilmez; kalibre edilmemiş formül olasılık değildir. */
export function confidenceLabel(c: number): ConfidenceLabel { return c >= 0.75 ? 'HIGH' : c >= 0.5 ? 'MEDIUM' : 'LOW'; }
export interface ConfidenceSignals { responseN: number; responseRate?: number; dataQualityFlags?: number; historicalStability?: number; nStable?: number; }
export interface PriorityInput {
  severity: SeveritySignals; confidence: ConfidenceSignals;
  /** Birimin bu kaldıracı değiştirme gücü 0..1 (ResponsibilityMap'ten). */
  controllability: number;
  /** Sahibin aktif iş yükü 0..1 (WorkloadIndex). */
  workload: number;
  /** Stratejik önem 0..1 — yönetim tercihi; şiddeti değiştirmez, sıralamayı ve zamanlamayı etkiler. */
  strategicRelevance?: number;
  accountableUnitId: string; affectedUnitId: string;
}
export interface PriorityThresholds { critical: number; recommended: number; watch: number; minConfidence: number; workloadFull: number; controllabilityLow: number; /** Sayısal karar için asgari yanıt (gizlilik eşiğiyle aynı). */ minResponseN: number; }
export const DEFAULT_THRESHOLDS: PriorityThresholds = { critical: 75, recommended: 55, watch: 30, minConfidence: 0.5, workloadFull: 0.8, controllabilityLow: 0.4, minResponseN: 5 };

export type SeverityTier = 'critical' | 'recommended' | 'watch' | 'none' | 'preventive';
export type PriorityDecision = 'numeric_target_and_actions' | 'validation_required' | 'recommended_target' | 'monitor' | 'no_action';
export type OwnershipRoute = 'local' | 'accountable_unit' | 'alternative_owner_or_central_support';

export interface PriorityAssessment {
  severity: number; confidence: number; confidenceLabel: ConfidenceLabel; controllability: number; workload: number; strategicRelevance: number;
  /** Sıralama anahtarı: şiddet önce, strateji ikincil. */
  rankKey: number;
  tier: SeverityTier; decision: PriorityDecision; ownership: OwnershipRoute; ownerUnitId: string;
  notes: string[]; algorithmVersion: string;
}
export const PRIORITY_ALGORITHM_VERSION = 'priority-v2.3.0';

export function severityScore(s: SeveritySignals, w: SeverityWeights = DEFAULT_SEVERITY_WEIGHTS): number {
  const v = w.need * s.need + w.trendRisk * s.trendRisk + w.relativeGap * s.relativeGap + w.breadth * s.breadth + w.impact * s.impact;
  return Math.max(0, Math.min(100, Math.round(100 * v)));
}
export function confidenceScore(c: ConfidenceSignals): number {
  if (!Number.isFinite(c.responseN) || c.responseN <= 0) return 0; // yanıt yoksa güven yok; diğer bileşenler telafi etmez
  const nStable = c.nStable ?? 30;
  const nPart = Math.min(1, c.responseN / nStable);
  const ratePart = c.responseRate === undefined ? 1 : Math.min(1, Math.max(0, (c.responseRate - 0.3) / 0.5));
  const qualityPart = Math.max(0, 1 - 0.15 * (c.dataQualityFlags ?? 0));
  const stabilityPart = c.historicalStability ?? 1;
  return Math.round(100 * (0.5 * nPart + 0.2 * ratePart + 0.15 * qualityPart + 0.15 * stabilityPart)) / 100;
}
export function severityTier(score: number, s: SeveritySignals, t: PriorityThresholds = DEFAULT_THRESHOLDS): SeverityTier {
  if (s.need < 0.2 && s.trendRisk >= 0.6) return 'preventive';
  if (score >= t.critical) return 'critical';
  if (score >= t.recommended) return 'recommended';
  if (score >= t.watch) return 'watch';
  return 'none';
}

/** İki boyutlu karar: şiddet × güven. Kontrol ve yük yalnız sahibi ve yolu belirler. */
export function assessPriority(i: PriorityInput, w: SeverityWeights = DEFAULT_SEVERITY_WEIGHTS, t: PriorityThresholds = DEFAULT_THRESHOLDS): PriorityAssessment {
  const severity = severityScore(i.severity, w); const confidence = confidenceScore(i.confidence);
  const tier = severityTier(severity, i.severity, t); const notes: string[] = [];
  let decision: PriorityDecision;
  const eligible = Number.isFinite(i.confidence.responseN) && i.confidence.responseN >= t.minResponseN; // uygunluk kapısı: yetersiz yanıtla sayısal karar yok
  if (tier === 'none') decision = 'no_action';
  else if (!eligible) { decision = 'validation_required'; notes.push(`Yanıt sayısı ${i.confidence.responseN} < ${t.minResponseN}: sayısal hedef kararı verilemez`); }
  else if (tier === 'watch') decision = 'monitor';
  else if (confidence < t.minConfidence) { decision = 'validation_required'; notes.push('Sorun ciddi olabilir; veri güveni düşük — nabız ölçümü / nitel gözden geçirme / üst birim sinyali'); }
  else decision = tier === 'critical' || tier === 'preventive' ? 'numeric_target_and_actions' : 'recommended_target';
  let ownership: OwnershipRoute = 'local'; let ownerUnitId = i.affectedUnitId;
  if (i.controllability < t.controllabilityLow) { ownership = 'accountable_unit'; ownerUnitId = i.accountableUnitId; notes.push('Kaldıraç yerel kontrol dışında; sahip hesap veren birim, etkilenen birim yerel'); }
  else if (i.workload >= t.workloadFull && decision !== 'no_action') { ownership = 'alternative_owner_or_central_support'; notes.push('Sahibin kapasitesi dolu; sorun önemini korur, alternatif sahip / merkezi destek / sonraki dönem'); }
  const strategicRelevance = i.strategicRelevance ?? 0;
  return { severity, confidence, confidenceLabel: confidenceLabel(confidence), controllability: i.controllability, workload: i.workload, strategicRelevance, rankKey: severity * 100 + Math.round(strategicRelevance * 99), tier, decision, ownership, ownerUnitId, notes, algorithmVersion: PRIORITY_ALGORITHM_VERSION };
}

/** Sinyal normalizasyonu yardımcıları */
export const normGap = (reference: number, current: number, span = 30) => Math.max(0, Math.min(1, (reference - current) / span));
export const normNegativeTrend = (current: number, previous: number | undefined, span = 10) => previous === undefined ? 0 : Math.max(0, Math.min(1, (previous - current) / span));
