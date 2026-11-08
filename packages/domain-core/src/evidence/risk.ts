/** Risk bazlı kanıt politikası (v2.3): KURAL ÖNCE, PUAN TRİYAJ. Seviye açık kurallardan seçilir; risk puanı yalnız inceleme sırasını ve örneklem seçimini belirler. Kabulde dondurulur. */
export type EvidenceLevel = 'E0' | 'E1' | 'E2' | 'E3' | 'E4';
export interface EvidenceRiskSignals { criticality: number; reach: number; cost: number; gamingRisk: number; irreversibility: number; priorAnomaly: number; } // 0..1
export interface EvidenceRiskPolicy { weights: EvidenceRiskSignals; bands: { maxExclusive: number; level: EvidenceLevel }[]; }
export const DEFAULT_EVIDENCE_RISK_POLICY: EvidenceRiskPolicy = {
  weights: { criticality: .30, reach: .20, cost: .15, gamingRisk: .15, irreversibility: .10, priorAnomaly: .10 },
  bands: [{ maxExclusive: 20, level: 'E0' }, { maxExclusive: 40, level: 'E1' }, { maxExclusive: 60, level: 'E2' }, { maxExclusive: 80, level: 'E3' }, { maxExclusive: 101, level: 'E4' }],
};
export const EVIDENCE_LEVEL_LABEL: Record<EvidenceLevel, string> = { E0: 'Yapılandırılmış beyan', E1: 'Yapılandırılmış kayıt (tarih, adet, katılımcı)', E2: 'Belge / sistem izi', E3: 'Bağımsız doğrulama', E4: 'Örneklem denetimi' };

export function evidenceRisk(s: EvidenceRiskSignals, p: EvidenceRiskPolicy = DEFAULT_EVIDENCE_RISK_POLICY): number {
  const w = p.weights;
  return Math.round(100 * (w.criticality * s.criticality + w.reach * s.reach + w.cost * s.cost + w.gamingRisk * s.gamingRisk + w.irreversibility * s.irreversibility + w.priorAnomaly * s.priorAnomaly));
}
export interface EvidenceLevelContext {
  boundToNumericTarget: boolean; deployedUnits: number; ownerHasPriorAnomaly: boolean;
  reversible?: boolean; costBand?: 'none' | 'low' | 'medium' | 'high'; critical?: boolean; largeProgram?: boolean; systemTraceAvailable?: boolean;
}
const ORDER: EvidenceLevel[] = ['E0', 'E1', 'E2', 'E3', 'E4'];
const up = (l: EvidenceLevel) => ORDER[Math.min(4, ORDER.indexOf(l) + 1)]!;
/** Kural tablosu (rule-first): düşük riskli yerel geri alınabilir rutin → E0/E1; sayısal hedefe bağlı rutin → E1; orta maliyet ya da çok birime yaygın → E2;
    yüksek maliyet / kritik / manipülasyon riski → E3; büyük program → E4 (denetim sınıfı). Sistem izi varsa dosya istenmez. Önceki anomali bir basamak yukarı. */
export function evidenceLevelByRules(ctx: EvidenceLevelContext): { level: EvidenceLevel; rule: string; preferSystemTrace: boolean } {
  let level: EvidenceLevel; let rule: string;
  if (ctx.largeProgram) { level = 'E4'; rule = 'buyuk_program_denetim_sinifi'; }
  else if (ctx.critical || ctx.costBand === 'high') { level = 'E3'; rule = 'yuksek_maliyet_veya_kritik'; }
  else if (ctx.costBand === 'medium' || ctx.deployedUnits > 1) { level = 'E2'; rule = 'orta_maliyet_veya_yaygin'; }
  else if (ctx.boundToNumericTarget) { level = 'E1'; rule = 'sayisal_hedefe_bagli_rutin'; }
  else { level = ctx.reversible === false ? 'E1' : 'E0'; rule = 'dusuk_risk_yerel_rutin'; }
  if (level === 'E0' && ctx.boundToNumericTarget && ctx.deployedUnits > 1) level = 'E1';
  if (ctx.ownerHasPriorAnomaly) { level = up(level); rule += '+onceki_anomali'; }
  return { level, rule, preferSystemTrace: !!ctx.systemTraceAvailable };
}
/** Geriye uyumlu: puan yalnız triyaj; seviye kurallardan. */
export function evidenceLevel(risk: number, ctx: EvidenceLevelContext, _p: EvidenceRiskPolicy = DEFAULT_EVIDENCE_RISK_POLICY): EvidenceLevel {
  void risk; return evidenceLevelByRules(ctx).level;
}
/** Doğrulama iş yükü politikası: kim/ne inceler. */
export type VerificationRoute = 'auto' | 'none_unless_exception' | 'connector_or_human' | 'human_review' | 'sample_audit';
/** Sistem izi dosya yerine geçer, bağımsız kontrol yerine geçmez: E3 her zaman insan incelemesi, E4 her zaman örneklem denetimi. */
export function verificationRoute(level: EvidenceLevel, hasSystemTrace: boolean, connectorConfidenceHigh: boolean): VerificationRoute {
  if (level === 'E3') return 'human_review';
  if (level === 'E4') return 'sample_audit';
  if (hasSystemTrace) return 'auto';
  if (level === 'E0' || level === 'E1') return 'none_unless_exception';
  return connectorConfidenceHigh ? 'auto' : 'connector_or_human';
}
