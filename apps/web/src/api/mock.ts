/** Mock adaptör — API (apps/api) hazır olana kadar Atlas fixture'ı ve domain-core algoritmalarıyla çalışır (v2.2: yerel-önce uzlaştırma, dört eksenli öncelik).
    Sözleşme docs/api/openapi.yaml ile aynıdır; gerçek adaptöre geçişte yalnız bu dosya değişir. */
import fixture from '@atlas/web-fixture.json';
import { reconcile, contributionProjections, assessPriority, normGap, normNegativeTrend, rolesForItem, type TargetCohort, type TargetReconciliationRun, type PriorityAssessment } from '@hpw-act/domain-core';
import { ConflictError, type Conflict } from './envelope';
import { itemScores, companyItemValue, ATLAS_INSTRUMENT } from './items';
function itemScoreOf(unitId: string, code: string): number | null { const s = itemScores(unitId).find(x => x.item.code === code); return s && !s.suppressed ? s.score : null; }

export type Fixture = typeof fixture;
export const data: Fixture = fixture;

const state = { targetVersion: 11, approvedKonak: null as number | null };

/** Resmî toplama ağırlığı: HPTW üst skoru yanıt düzeyi ortalamayla hesapladığı için ağırlık = yanıt sayısı; sonuç dosyasından gelir, burada fixture'dan okunur. */
/** v2.4: bölge kohortu MADDE bazında kurulur (varsayılan GUV-01). Boyut/indeks ambition'ı madde hedeflerinin projeksiyonuyla uzlaştırılır. */
export const DEFAULT_ITEM = 'GUV-01';
export function buildEgeCohort(itemCode = DEFAULT_ITEM): TargetCohort {
  return {
    cohortId: `coh-ege-${itemCode}-2026`, policy: 'BASELINE_FROZEN', snapshotHash: `sha256:atlas-2026-ege-${itemCode}`,
    members: data.egeRegion.branches.map(b => {
      const sc = itemScoreOf(b.id, itemCode);
      return { unitId: b.id, relationship: 'inherited' as const, aggregationWeight: b.n, responseN: b.n,
        inclusionState: sc === null && !b.suppressed ? 'no_baseline' as const : b.suppressed ? 'suppressed' as const : 'active' as const,
        ...(sc !== null ? { baseline: sc } : {}), benchmark: companyItemValue(itemCode) };
    }),
  };
}
export function egeBaseline(itemCode = DEFAULT_ITEM): number {
  const c = buildEgeCohort(itemCode); let W = 0, S = 0;
  for (const m of c.members) if (m.baseline !== undefined) { W += m.aggregationWeight; S += m.aggregationWeight * m.baseline; }
  return Math.round((S / W) * 100) / 100;
}
/** İki sorumluluk etiketi: şubede sonucu izleyen rol ve müdahaleyi yapmaya yetkili rol (Güven/vardiya kaldıracı merkezde). */
export function rolesFor(unitId: string, itemCode = DEFAULT_ITEM): { monitoringRole: string; interventionOwnerRole: string } {
  const name = data.egeRegion.branches.find(b => b.id === unitId)?.name ?? data.units.find(u => u.id === unitId)?.name ?? unitId;
  const item = ATLAS_INSTRUMENT.items.find(i => i.code === itemCode)!;
  const r = rolesForItem(item, name); return { monitoringRole: r.monitoringRole, interventionOwnerRole: r.interventionOwnerRole };
}
export function runReconciliation(ambition: number, itemCode = DEFAULT_ITEM): TargetReconciliationRun { return reconcile(ambition, buildEgeCohort(itemCode), undefined, id => rolesFor(id, itemCode)); }
export function egeContributions(itemCode = DEFAULT_ITEM) { return contributionProjections(buildEgeCohort(itemCode)); }
/** Bölge için hedeflenebilir maddeler (sonuç ve kişisel eğilim maddeleri hariç), bölge ağırlıklı skoruyla; en düşük en üstte. */
export function egeItemOptions(): { code: string; text: string; dimension: string; baseline: number }[] {
  return ATLAS_INSTRUMENT.items.filter(i => i.responsibilityCenter !== 'outcome' && i.responsibilityCenter !== 'individual').map(i => ({ code: i.code, text: i.text, dimension: ATLAS_INSTRUMENT.dimensions.find(d => d.code === i.dimensionCode)?.name ?? '', baseline: egeBaseline(i.code) })).sort((a, b) => a.baseline - b.baseline);
}

/** Kurumsal düzey (senaryo sabitleri: 12 GMY'nin yerel önerilerinin resmî ağırlıklı toplamı). */
export const corporate = { baseline: data.company.trust, ambition: 68, supported: 66.4, upperScenario: 67.2 };

/** Birimin kendi öncelikleri: dört eksen. Kontrol edilebilirlik ve sahip ResponsibilityMap'ten (fixture'da Konak Güven → vardiya → Operasyon Planlama). */
export function unitPriorities(unitId: string): { dimension: string; score: number | null; n: number; suppressed: boolean; assessment: PriorityAssessment | null; accountable: string }[] {
  const u = data.units.find(x => x.id === unitId); if (!u) return [];
  const dims: [string, number, string][] = [['Güven', 0.8, 'vardiya_planlama'], ['Başarı', 0.5, 'yerel'], ['Gurur', 0.4, 'yerel'], ['Bağlılık', 0.6, 'yerel']];
  return dims.map(([d, strategic, lever]) => {
    const r = (u.dims as Record<string, { score: number; n: number; suppressed: boolean } | null>)[d];
    if (!r) return { dimension: d, score: null, n: 0, suppressed: true, assessment: null, accountable: '—' };
    const ref = d === 'Güven' ? data.company.trust : 66;
    const controllable = lever === 'yerel' ? 0.9 : 0.3;
    const a = assessPriority({
      severity: { need: normGap(ref, r.score, 20), trendRisk: d === 'Güven' ? normNegativeTrend(r.score, u.prevTrust ?? undefined) : 0.1, relativeGap: normGap(ref, r.score, 15), breadth: Math.min(1, u.population / 60), impact: 0.5 },
      confidence: { responseN: r.n, responseRate: 0.85 }, controllability: controllable, workload: 0.45, strategicRelevance: strategic,
      accountableUnitId: lever === 'yerel' ? u.name : 'Operasyon Planlama Müdürlüğü', affectedUnitId: u.name,
    });
    return { dimension: d, score: r.suppressed ? null : r.score, n: r.n, suppressed: r.suppressed, assessment: r.suppressed ? null : a, accountable: a.ownerUnitId };
  });
}

export function targetVersion(): number { return state.targetVersion; }
export function simulateConcurrentEdit(): void { state.targetVersion += 1; }
export async function approveTarget(unitId: string, value: number, expectedVersion: number): Promise<{ version: number }> {
  await new Promise(r => setTimeout(r, 150));
  if (expectedVersion !== state.targetVersion) {
    const c: Conflict = { kind: 'version', currentVersion: state.targetVersion, yourVersion: expectedVersion, changedBy: 'Zeynep Demir (İK İş Ortağı)', changedFields: ['target_date', 'owner_person_id'] };
    throw new ConflictError(c);
  }
  state.targetVersion += 1; if (unitId === 'SUBE-KONAK') state.approvedKonak = value;
  return { version: state.targetVersion };
}
