/** Aksiyon öneri motoru (v2.3): deterministik uygunluk filtreleri, sözlüksel sıralama; gözlemsel etkinlik yalnız son kriter (nedensel sıralama yok). LLM sayı üretmez. */
export interface ActionTemplateVersion {
  code: string; version: string; title: string;
  targetMetrics: string[]; driverItems: string[]; unitTypes: string[]; lever: string; accountableRole: string;
  preconditions?: { minTeamSize?: number }; contraindications?: string[];
  effort: 'low' | 'medium' | 'high'; cost: 'none' | 'low' | 'medium' | 'high'; timeToSignalWeeks: number;
  evidenceLevel: 'E0' | 'E1' | 'E2' | 'E3' | 'E4'; leadingKpi: string;
  /** Yalnız "birlikte gözlendi" — nedensel değil. */
  observedAssociation?: { medianChange: number; sampleSize: number };
}
export interface UnitContext { unitType: string; teamSize: number; activeFlags: string[]; ownerRoleExists: (role: string) => boolean; controllability: (lever: string) => number; workload: number; connectors: string[]; }
export interface Recommendation { template: ActionTemplateVersion; ownerFit: number; contextFit: number; evidenceMaturity: number; effortFit: number; recommended: boolean; }
const EFFORT: Record<string, number> = { low: 1, medium: 0.6, high: 0.3 };

export function recommendActions(metric: string, driver: string | null, unit: UnitContext, library: ActionTemplateVersion[], max = 3): Recommendation[] {
  const candidates = library
    .filter(t => t.targetMetrics.includes(metric))
    .filter(t => !driver || t.driverItems.includes(driver) || t.driverItems.length === 0)
    .filter(t => t.unitTypes.includes(unit.unitType))
    .filter(t => !t.preconditions?.minTeamSize || unit.teamSize >= t.preconditions.minTeamSize)
    .filter(t => !(t.contraindications ?? []).some(c => unit.activeFlags.includes(c)))
    .filter(t => unit.ownerRoleExists(t.accountableRole));
  const scored = candidates.map(t => ({
    template: t,
    ownerFit: unit.controllability(t.lever),
    contextFit: 1,
    evidenceMaturity: (unit.connectors.includes(t.lever) ? 1 : 0) * 0.5 + (t.evidenceLevel === 'E0' || t.evidenceLevel === 'E1' ? 0.5 : 0.25),
    effortFit: EFFORT[t.effort]! * (1 - Math.min(0.5, unit.workload / 2)),
    recommended: false,
  }));
  // sözlüksel: sahip uygunluğu → bağlam → kanıt olgunluğu → çaba → sinyal süresi → gözlemsel geçmiş (en son)
  scored.sort((a, b) => (b.ownerFit - a.ownerFit) || (b.contextFit - a.contextFit) || (b.evidenceMaturity - a.evidenceMaturity) || (b.effortFit - a.effortFit)
    || (a.template.timeToSignalWeeks - b.template.timeToSignalWeeks) || ((b.template.observedAssociation?.medianChange ?? 0) - (a.template.observedAssociation?.medianChange ?? 0)));
  const out = scored.slice(0, max); if (out[0]) out[0].recommended = true; return out;
}
