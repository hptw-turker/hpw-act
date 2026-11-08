/** Madde düzeyi sonuç katmanı (v2.4). Prototipte madde skorları birimin boyut skorundan ve HPTW demo madde profilinden deterministik türetilir;
    gerçek sistemde sonuç paketinden (results_item.csv) gelir. Atlas enstrümanı: HPTW 2026 tam + 2 şirkete özel madde. */
import { data } from './mock';
import { HPTW_2026, assessPriority, normGap, normNegativeTrend, rolesForItem, indexFromItems, type InstrumentItem, type InstrumentVersion, type PriorityAssessment, type RolePair } from '@hpw-act/domain-core';

const CUSTOM: InstrumentItem[] = [
  { code: 'OZL-01', text: 'Şubemdeki müşteri yoğunluğu ile kadro planı uyumludur.', textEn: 'Staffing in my branch matches customer traffic.', dimensionCode: 'OZL', scale: 'likert5_topbox', polarity: 'positive', interactionArea: 'system', responsibilityCenter: 'central_function', origin: 'custom', leverTags: ['operasyon_planlama', 'is_yuku'] },
  { code: 'OZL-02', text: 'Şube içi görev rotasyonu adil uygulanır.', textEn: 'Task rotation within the branch is applied fairly.', dimensionCode: 'OZL', scale: 'likert5_topbox', polarity: 'positive', interactionArea: 'manager', responsibilityCenter: 'line_manager', origin: 'custom', leverTags: ['adalet'] },
];
export const ATLAS_INSTRUMENT: InstrumentVersion = { ...HPTW_2026, dimensions: [...HPTW_2026.dimensions, { code: 'OZL', name: 'Şirkete Özel', nameEn: 'Company-specific', module: 'custom' }], items: [...HPTW_2026.items, ...CUSTOM] };

/** HPTW demo raporu madde profili (Top Box). Boyut ortalaması boyut içi yayılımı gizler: Gurur 60 / 72 / 61 / 93. */
const PROFILE: Record<string, number> = {
  'BAS-01': 76, 'BAS-02': 82, 'BAS-03': 74, 'BAS-04': 84, 'GUR-01': 60, 'GUR-02': 72, 'GUR-03': 61, 'GUR-04': 93, 'GUV-01': 55, 'GUV-02': 86, 'GUV-03': 75, 'GUV-04': 77, 'BAG-01': 93, 'BAG-02': 93, 'BAG-03': 88,
  'POZ-01': 89, 'POZ-02': 84, 'POZ-03': 67, 'POZ-04': 83, 'YIL-01': 93, 'YIL-02': 87, 'YIL-03': 93, 'YIL-04': 91, 'TEM-01': 54, 'TEM-02': 54, 'TEM-03': 77, 'TEM-04': 82,
  'CES-01': 83, 'CES-02': 91, 'CES-03': 74, 'CES-04': 71, 'LID-01': 82, 'LID-02': 72, 'LID-03': 70, 'LID-04': 75, 'YET-01': 78, 'YET-02': 76, 'YET-03': 85, 'YET-04': 70,
  'ERI-01': 78, 'ERI-02': 58, 'ERI-03': 69, 'ERI-04': 70, 'PER-01': 71, 'PER-02': 66, 'PER-03': 69, 'PER-04': 47, 'ISG-01': 57, 'ISG-02': 57, 'ISG-03': 57, 'ISG-04': 66,
  'ISE-01': 90, 'ISE-02': 72, 'ISE-03': 93, 'ISE-04': 81, 'EGI-01': 78, 'EGI-02': 78, 'EGI-03': 77, 'EGI-04': 72, 'YEK-01': 71, 'YEK-02': 55, 'YEK-03': 46, 'YEK-04': 55,
  'CAL-01': 65, 'CAL-02': 74, 'CAL-03': 49, 'CAL-04': 62, 'DIJ-01': 70, 'DIJ-02': 75, 'DIJ-03': 69, 'DIJ-04': 65, 'SAG-01': 89, 'SAG-02': 60, 'SAG-03': 61, 'SAG-04': 51,
  'OZL-01': 58, 'OZL-02': 69,
};
const DEMO_OVERALL = 73.0;
const DIM_MEAN: Record<string, number> = {};
for (const d of ATLAS_INSTRUMENT.dimensions) { const v = ATLAS_INSTRUMENT.items.filter(i => i.dimensionCode === d.code).map(i => PROFILE[i.code]!); DIM_MEAN[d.code] = v.reduce((s, x) => s + x, 0) / v.length; }
const DIM_TR: Record<string, string> = { BAS: 'Başarı', GUR: 'Gurur', GUV: 'Güven', BAG: 'Bağlılık' };
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
const r1 = (x: number) => Math.round(x * 10) / 10;

export interface ItemScore { item: InstrumentItem; score: number | null; n: number; suppressed: boolean; companyValue: number; benchmarkCertified: number; }
type Unit = (typeof data.units)[number];
function unitOverall(u: Unit): number | null { const v = Object.values(u.dims as Record<string, { score: number } | null>).filter((x): x is { score: number } => !!x).map(x => x.score); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; }
export function companyItemValue(code: string): number { const it = ATLAS_INSTRUMENT.items.find(i => i.code === code)!; const dimTr = it.dimensionCode ? DIM_TR[it.dimensionCode] : undefined; const base = dimTr === 'Güven' ? data.company.trust : DEMO_OVERALL + (dimTr ? 0 : 0); return r1(base + PROFILE[code]! - (dimTr ? DIM_MEAN[it.dimensionCode!]! : DEMO_OVERALL)); }
/** Birimin madde skoru: çekirdek boyutlarda birimin gerçek boyut skoru + madde sapması; modülde birim geneli + madde sapması; deterministik küçük gürültü. */
export function itemScores(unitId: string): ItemScore[] {
  const u = data.units.find(x => x.id === unitId); if (!u) return [];
  const overall = unitOverall(u);
  return ATLAS_INSTRUMENT.items.map(item => {
    const dimTr = item.dimensionCode ? DIM_TR[item.dimensionCode] : undefined;
    const dimRes = dimTr ? (u.dims as Record<string, { score: number; n: number; suppressed: boolean } | null>)[dimTr] : null;
    const n = dimRes?.n ?? u.n; const suppressed = u.suppressed || n < 5;
    const base = dimRes ? dimRes.score : overall; const mean = dimTr ? DIM_MEAN[item.dimensionCode!]! : DEMO_OVERALL;
    const noise = (hash(unitId + item.code) - 0.5) * 8;
    const score = base === null || suppressed ? null : r1(Math.max(5, Math.min(98, base + (PROFILE[item.code]! - mean) + noise)));
    return { item, score, n, suppressed, companyValue: companyItemValue(item.code), benchmarkCertified: r1(PROFILE[item.code]! + 2.5) };
  });
}
export function unitIndex(unitId: string, indexCode: 'WBI' | 'ENG'): { value: number | null; partial: boolean } {
  const idx = ATLAS_INSTRUMENT.indices.find(i => i.code === indexCode)!; const scores = itemScores(unitId);
  const vals: Record<string, number | undefined> = {}; for (const c of idx.members) { const s = scores.find(x => x.item.code === c); vals[c] = s?.score ?? undefined; }
  const r = indexFromItems(idx.members, vals); return { value: r.value, partial: r.partial };
}
export function dimensionSpread(unitId: string, dimCode: string): { mean: number | null; min: number | null; max: number | null } {
  const v = itemScores(unitId).filter(s => s.item.dimensionCode === dimCode && s.score !== null).map(s => s.score!);
  if (!v.length) return { mean: null, min: null, max: null };
  return { mean: r1(v.reduce((s, x) => s + x, 0) / v.length), min: Math.min(...v), max: Math.max(...v) };
}
export interface ItemPriority extends ItemScore { roles: RolePair; assessment: PriorityAssessment | null; }
/** Madde başına öncelik: şiddet çalışanın sinyali (şirket ve sertifikalı benchmark farkı), kontrol edilebilirlik sorumluluk merkezinden, stratejik önem kurumsal yönden (Güven maddeleri). Bağlılık ve kişisel eğilim maddeleri hedef değil izlemedir. */
export function itemPriorities(unitId: string): ItemPriority[] {
  const u = data.units.find(x => x.id === unitId)!;
  return itemScores(unitId).map(s => {
    const roles = rolesForItem(s.item, u.name, u.type === 'call_center' ? 'call_center' : u.type === 'branch' ? 'branch' : 'hq_department');
    if (s.score === null || s.suppressed) return { ...s, roles, assessment: null };
    const a = assessPriority({
      severity: { need: normGap(s.benchmarkCertified, s.score, 20), trendRisk: s.item.dimensionCode === 'GUV' ? normNegativeTrend(s.score, u.prevTrust ?? undefined) : 0.1, relativeGap: normGap(s.companyValue, s.score, 15), breadth: Math.min(1, u.population / 50), impact: 0.5 },
      confidence: { responseN: s.n, responseRate: 0.85 }, controllability: roles.controllability, workload: 0.45, strategicRelevance: s.item.dimensionCode === 'GUV' ? 0.8 : 0.3,
      accountableUnitId: roles.interventionOwnerRole, affectedUnitId: u.name,
    });
    const assessment = roles.targetable ? a : { ...a, decision: 'monitor' as const };
    return { ...s, roles, assessment };
  });
}
/** Şube için hedeflenebilir öncelikli maddeler (en fazla iki yerel hedef): karar sayısal/önerilen ve madde hedeflenebilir. */
export function targetableItems(unitId: string): ItemPriority[] {
  return itemPriorities(unitId).filter(p => p.assessment && p.roles.targetable && ['numeric_target_and_actions', 'recommended_target'].includes(p.assessment.decision)).sort((a, b) => b.assessment!.rankKey - a.assessment!.rankKey);
}
export const ITEM_LABEL = (code: string) => ATLAS_INSTRUMENT.items.find(i => i.code === code)?.text ?? code;
export const DIM_LABEL = (code?: string) => ATLAS_INSTRUMENT.dimensions.find(d => d.code === code)?.name ?? '';
