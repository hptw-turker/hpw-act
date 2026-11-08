import { AllocationPolicy, CohortMember, DEFAULT_ALLOCATION_POLICY, InternalProposal, LocalTargetProposal, MetricScale, SCORE_0_100, TargetCohort, TargetReconciliationRun } from './types.js';
import { invalid, isFiniteNumber } from '../errors.js';
import { suppressedRationale } from '../privacy/gateway.js';

export const RECONCILIATION_ALGORITHM_VERSION = 'reconcile-v2.3.1';
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const r2 = (x: number) => Math.round(x * 100) / 100;
const band = (policy: AllocationPolicy, score: number) => policy.bands.find(x => score < x.maxScoreExclusive) ?? policy.bands[policy.bands.length - 1]!;

/** Girdi sözleşmesi: sonlu, negatif olmayan ağırlık; ölçek içinde başlangıç/onay/istisna. Sıfır ağırlık açıkça dışlanır (hata değil, gerekçeli). */
export function validateMember(m: CohortMember, scale: MetricScale = SCORE_0_100): void {
  if (!isFiniteNumber(m.aggregationWeight) || m.aggregationWeight < 0) throw invalid('invalid_weight', `aggregationWeight geçersiz: ${m.unitId}`, { unitId: m.unitId, weight: m.aggregationWeight });
  for (const [k, v] of Object.entries({ baseline: m.baseline, approvedException: m.approvedException, approvedTarget: m.approvedTarget, benchmark: m.benchmark })) {
    if (v !== undefined && (!isFiniteNumber(v) || v < scale.min || v > scale.max)) throw invalid('out_of_scale', `${k} ölçek dışı: ${m.unitId}=${v}`, { unitId: m.unitId, field: k, value: v, scale });
  }
}

/** Yerel öneri (İÇ): ambition'dan bağımsız. Akran verisi politika bandının dışına çıkarsa öneri banttan gelir ve kaynak 'methodologist_band' olur; akran gözlemi ayrı saklanır. */
export function proposeLocalInternal(m: CohortMember, policy: AllocationPolicy = DEFAULT_ALLOCATION_POLICY, scale: MetricScale = SCORE_0_100): InternalProposal | null {
  validateMember(m, scale);
  if (m.inclusionState === 'no_baseline' || m.baseline === undefined) return null;
  const b = m.baseline; const hidden = m.inclusionState === 'suppressed'; const fixedMember = m.relationship === 'excluded' || m.relationship === 'monitor';
  const base = { unitId: m.unitId, baseline: b, weight: m.aggregationWeight, hidden, contributionForecast: 0 };
  if (m.approvedException !== undefined) return { ...base, kind: 'numeric', low: Math.min(b, m.approvedException), high: Math.max(b, m.approvedException), target: m.approvedException, fixed: true, source: 'exception' };
  if (m.approvedTarget !== undefined) return { ...base, kind: 'numeric', low: m.approvedTarget, high: m.approvedTarget, target: m.approvedTarget, fixed: true, source: 'approved' };
  if (fixedMember) return { ...base, kind: 'maintain', low: b, high: b, target: b, fixed: true, source: 'fixed_member' };
  const bd = band(policy, b);
  let low: number, high: number, target: number, source: InternalProposal['source']; let peerObservation: InternalProposal['peerObservation'];
  if (m.peerDelta && m.peerDelta.sampleSize >= policy.minPeerSample) {
    peerObservation = { ...m.peerDelta };
    const inBand = m.peerDelta.suggested >= bd.minDelta && m.peerDelta.suggested <= bd.maxDelta && m.peerDelta.upper <= bd.maxDelta && m.peerDelta.upper >= m.peerDelta.suggested;
    if (inBand) {
      low = r2(Math.min(scale.max, b + Math.max(bd.minDelta, m.peerDelta.suggested * 0.5))); high = r2(Math.min(scale.max, b + m.peerDelta.upper)); target = r2(clamp(b + m.peerDelta.suggested, low, high)); source = 'peer_history';
    } else {
      // akran verisi bant dışı: karar uzman politikasıyla verilir, etiket bunu söyler; gözlem ayrı saklanır
      low = r2(Math.min(scale.max, b + bd.minDelta)); high = r2(Math.min(scale.max, b + bd.maxDelta)); target = r2(clamp(b + (bd.minDelta + bd.maxDelta) / 2, low, high)); source = 'methodologist_band';
    }
  } else {
    low = r2(Math.min(scale.max, b + bd.minDelta)); high = r2(Math.min(scale.max, b + bd.maxDelta));
    let delta = (bd.minDelta + bd.maxDelta) / 2;
    if (m.benchmark !== undefined && m.benchmark > b) delta = Math.max(delta, policy.benchmarkPull * (m.benchmark - b));
    if (m.trend !== undefined && m.trend < 0) delta += Math.min(2, -m.trend * 0.25);
    target = r2(clamp(b + delta, low, high)); source = 'methodologist_band';
  }
  if (target - b < policy.meaningfulMovement) return { ...base, kind: 'maintain', low: b, high, target: b, fixed: false, source, ...(peerObservation ? { peerObservation } : {}) };
  return { ...base, kind: 'numeric', low, high, target, fixed: false, source, ...(peerObservation ? { peerObservation } : {}) };
}

/** DIŞ öneri: gizli birim → yalnız öncelik, sayısal alan yok; yetersiz yanıt → doğrulama gerekli. Bu fonksiyon API/arayüz/export için TEK yoldur. */
export function proposeLocal(m: CohortMember, roles: { monitoringRole: string; interventionOwnerRole: string }, policy: AllocationPolicy = DEFAULT_ALLOCATION_POLICY, parentName = 'Üst birim', metric = 'Güven', scale: MetricScale = SCORE_0_100): LocalTargetProposal {
  validateMember(m, scale);
  if (m.aggregationWeight === 0) return { unitId: m.unitId, kind: 'none', reason: 'zero_weight', ...roles };
  if (m.inclusionState === 'suppressed' || (m.responseN !== undefined && m.responseN < policy.minResponseN)) return { unitId: m.unitId, kind: 'priority_only', reason: 'privacy', rationale: suppressedRationale(parentName, metric), ...roles };
  const p = proposeLocalInternal(m, policy, scale);
  if (!p) return { unitId: m.unitId, kind: 'none', reason: 'no_baseline', ...roles };
  const { hidden: _h, weight: _w, contributionForecast: _c, ...pub } = p; void _h; void _w; void _c;
  return { ...pub, ...roles };
}

export function aggregateParent(values: { weight: number; value: number }[]): number {
  if (values.length === 0) throw invalid('empty_set', 'Boş küme: ölçümsüz durum');
  for (const v of values) { if (!isFiniteNumber(v.weight) || v.weight < 0) throw invalid('invalid_weight', 'Ağırlık sonlu ve negatif olmayan olmalı', v); if (!isFiniteNumber(v.value)) throw invalid('invalid_value', 'Değer sonlu olmalı', v); }
  const W = values.reduce((s, v) => s + v.weight, 0); if (W <= 0) throw invalid('zero_total_weight', 'Toplam ağırlık sıfır');
  return values.reduce((s, v) => s + v.weight * v.value, 0) / W;
}
export const round2 = r2;

/** Uzlaştırma: yerel öneriler ÖNCE (ambition'dan bağımsız), sonra karşılaştırma. Fark sessizce dağıtılmaz. Gizli birimler aritmetiğe girer, sayıları çıkmaz. */
export function reconcile(corporateAmbition: number, cohort: TargetCohort, policy: AllocationPolicy = DEFAULT_ALLOCATION_POLICY, roles?: (unitId: string) => { monitoringRole: string; interventionOwnerRole: string }): TargetReconciliationRun {
  const scale = cohort.scale ?? SCORE_0_100;
  if (!isFiniteNumber(corporateAmbition) || corporateAmbition < scale.min || corporateAmbition > scale.max) throw invalid('out_of_scale', `ambition ölçek dışı: ${corporateAmbition}`);
  const roleOf = roles ?? (() => ({ monitoringRole: 'birim yöneticisi', interventionOwnerRole: 'birim yöneticisi' }));
  const internal: InternalProposal[] = []; const nonArithmetic: TargetReconciliationRun['nonArithmetic'] = []; const explanation: string[] = [];
  for (const m of cohort.members) {
    validateMember(m, scale);
    if (m.relationship === 'contribution' || m.relationship === 'support') { nonArithmetic.push({ unitId: m.unitId, reason: m.relationship }); continue; }
    if (m.aggregationWeight === 0) { nonArithmetic.push({ unitId: m.unitId, reason: 'zero_weight' }); continue; }
    const p = proposeLocalInternal(m, policy, scale);
    if (!p) { nonArithmetic.push({ unitId: m.unitId, reason: 'no_baseline' }); continue; }
    internal.push(p);
  }
  const localProposals = cohort.members.map(m => proposeLocal(m, roleOf(m.unitId), policy, 'Üst birim', 'Güven', scale)).filter(p => p.kind !== 'none' || true);
  const hiddenParticipants = internal.filter(p => p.hidden).map(p => p.unitId);
  const base = { algorithmVersion: RECONCILIATION_ALGORITHM_VERSION, policyVersion: policy.policyVersion, cohortSnapshotHash: cohort.snapshotHash, corporateAmbition, localProposals, hiddenParticipants, nonArithmetic };
  if (internal.length === 0) return { ...base, supportedProjection: NaN, upperScenario: NaN, status: 'UNSUPPORTED', gap: NaN, options: ['LOWER_AMBITION'], explanation: ['Aritmetiğe giren birim yok: ölçümsüz durum'] };
  const W = internal.reduce((s, p) => s + p.weight, 0);
  const supportedRaw = aggregateParent(internal.map(p => ({ weight: p.weight, value: p.target })));
  const upperRaw = aggregateParent(internal.map(p => ({ weight: p.weight, value: p.high })));
  for (const p of internal) p.contributionForecast = (p.weight * (p.target - p.baseline)) / W; // tam hassasiyet; gösterimde yuvarla
  const supportedProjection = r2(supportedRaw), upperScenario = r2(upperRaw);
  explanation.push(`Yerel önerilerin resmî ağırlıklı projeksiyonu ${supportedProjection}; mevcut politika altındaki üst senaryo ${upperScenario}.`);
  if (supportedRaw + policy.epsilon >= corporateAmbition) return { ...base, supportedProjection, upperScenario, status: 'SUPPORTED', gap: 0, options: [], explanation: [...explanation, `İstenen ${corporateAmbition} yerel önerilerle destekleniyor.`] };
  if (upperRaw + policy.epsilon < corporateAmbition) return { ...base, supportedProjection, upperScenario, status: 'UNSUPPORTED', gap: r2(corporateAmbition - supportedRaw), options: ['LOWER_AMBITION', 'ADD_CENTRAL_INTERVENTION', 'CHANGE_TIME_HORIZON'], explanation: [...explanation, `İstenen ${corporateAmbition} mevcut planla desteklenmiyor; üst senaryo ${upperScenario}.`] };
  const adj = internal.map(p => ({ unitId: p.unitId, from: p.target, to: p.target, high: p.high, weight: p.weight, fixed: p.fixed, hidden: p.hidden }));
  let A = supportedRaw; let guard = 0;
  while (A + policy.epsilon < corporateAmbition && guard++ < 1000) {
    const adjustable = adj.filter(a => !a.fixed && !a.hidden && a.to < a.high && a.weight > 0); // gizli birime sayısal yükümlülük üretilmez (F21)
    const H = adjustable.reduce((s, a) => s + (a.high - a.to) * a.weight, 0); if (H <= 1e-9) break;
    const shortfall = (corporateAmbition - A) * W;
    for (const a of adjustable) { const share = ((a.high - a.to) * a.weight) / H; a.to = Math.min(a.high, a.to + (shortfall * share) / a.weight); }
    A = aggregateParent(adj.map(a => ({ weight: a.weight, value: a.to })));
  }
  const stretchedProjection = r2(aggregateParent(adj.map(a => ({ weight: a.weight, value: a.to })))); // önerilen değişiklikler uygulanınca gerçek projeksiyon (F21)
  const residualGap = r2(Math.max(0, corporateAmbition - stretchedProjection));
  return { ...base, supportedProjection, upperScenario, status: residualGap > policy.epsilon ? 'UNSUPPORTED' : 'GAP', gap: r2(corporateAmbition - supportedRaw),
    stretchAdjustments: adj.filter(a => !a.hidden && a.to !== a.from).map(({ unitId, from, to }) => ({ unitId, from, to: r2(to) })), stretchedProjection, residualGap,
    options: residualGap > policy.epsilon ? ['LOWER_AMBITION', 'ADD_CENTRAL_INTERVENTION', 'CHANGE_TIME_HORIZON'] : ['LOWER_AMBITION', 'ACCEPT_STRETCH_WITHIN_BOUNDS', 'ADD_CENTRAL_INTERVENTION', 'CHANGE_TIME_HORIZON'],
    explanation: [...explanation, residualGap > policy.epsilon ? `Esnetilebilir birimler (gizli ve sabit hariç) en fazla ${stretchedProjection} projeksiyonuna ulaşır; ${residualGap} puan kapanmıyor.` : `İstenen ${corporateAmbition} ile projeksiyon ${supportedProjection} arasında ${r2(corporateAmbition - supportedRaw)} puan fark; esnetme uygulanınca projeksiyon ${stretchedProjection}; karar gerektirir.`] };
}

/** İç katkı projeksiyonları (yalnız bölge/merkez görünümü; gizli birimler çıkarılır). Tam hassasiyet; yuvarlama çağıranın işi. */
export function contributionProjections(cohort: TargetCohort, policy: AllocationPolicy = DEFAULT_ALLOCATION_POLICY): { unitId: string; contribution: number; weight: number; target: number; baseline: number; low: number; high: number; source: string; kind: string; fixed: boolean }[] {
  const scale = cohort.scale ?? SCORE_0_100;
  const internal = cohort.members.filter(m => m.relationship !== 'contribution' && m.relationship !== 'support' && m.aggregationWeight > 0).map(m => proposeLocalInternal(m, policy, scale)).filter((p): p is InternalProposal => !!p);
  const W = internal.reduce((s, p) => s + p.weight, 0);
  return internal.filter(p => !p.hidden).map(p => ({ unitId: p.unitId, contribution: (p.weight * (p.target - p.baseline)) / W, weight: p.weight, target: p.target, baseline: p.baseline, low: p.low, high: p.high, source: p.source, kind: p.kind, fixed: p.fixed }));
}

/** Roll-up: onaylı değerlerden projeksiyon, resmî ağırlıkla; hangi projeksiyon olduğu çağıranca etiketlenir ("herkes kabul ederse" ≠ "kabul edilmiş plan"). */
export function rollupProjected(cohort: TargetCohort, approved: Record<string, number>): number {
  const vals: { weight: number; value: number }[] = [];
  for (const m of cohort.members) {
    if (m.inclusionState === 'no_baseline' || m.baseline === undefined) continue;
    if (m.relationship === 'contribution' || m.relationship === 'support' || m.aggregationWeight === 0) continue;
    vals.push({ weight: m.aggregationWeight, value: approved[m.unitId] ?? m.baseline });
  }
  return r2(aggregateParent(vals));
}
