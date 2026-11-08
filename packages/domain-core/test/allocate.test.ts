import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile, proposeLocal, proposeLocalInternal, rollupProjected, aggregateParent, contributionProjections } from '../src/allocation/allocate.js';
import type { TargetCohort, CohortMember } from '../src/allocation/types.js';

const m = (unitId: string, baseline: number | undefined, w = 100, extra: Partial<CohortMember> = {}): CohortMember => ({
  unitId, relationship: 'inherited', inclusionState: baseline === undefined ? 'no_baseline' : 'active', aggregationWeight: w, responseN: 30, ...(baseline !== undefined ? { baseline } : {}), ...extra,
});
const cohort = (members: CohortMember[]): TargetCohort => ({ cohortId: 'c1', policy: 'BASELINE_FROZEN', snapshotHash: 'h1', members });
const roles = { monitoringRole: 'Şube Müdürü', interventionOwnerRole: 'Şube Müdürü' };
const num = (r: ReturnType<typeof reconcile>, id: string) => { const p = r.localProposals.find(x => x.unitId === id)!; if (p.kind !== 'numeric' && p.kind !== 'maintain') throw new Error('sayısal değil: ' + id); return p; };

test('T-02: yerel öneriler ambition\'dan bağımsız üretilir; ambition projeksiyonla karşılaştırılır (SUPPORTED); hiçbir öneri tavanı aşmaz', () => {
  const c = cohort([m('A', 55, 120), m('B', 62, 80), m('C', 67, 60), m('D', 82, 40)]);
  const r = reconcile(66, c);
  assert.equal(r.status, 'SUPPORTED'); assert.ok(r.supportedProjection >= 66);
  for (const p of r.localProposals) if (p.kind === 'numeric') assert.ok(p.target <= p.high + 1e-9 && p.target >= p.low - 1e-9);
});
test('T-56: ambition değişince yerel öneriler değişmez; GAP; esnetme seçenek, uygulanmaz', () => {
  const c = cohort([m('A', 55, 120), m('B', 62, 80), m('C', 67, 60), m('D', 82, 40)]);
  const base = reconcile(66, c); const r = reconcile(69, c);
  assert.equal(r.status, 'GAP');
  assert.deepEqual(r.localProposals, base.localProposals);
  assert.ok(r.options.includes('ACCEPT_STRETCH_WITHIN_BOUNDS') && r.options.includes('LOWER_AMBITION'));
  for (const a of r.stretchAdjustments!) { const p = num(r, a.unitId); assert.ok(a.to <= p.high + 1e-9 && a.to > a.from); }
});
test('T-03 / T-50: üst senaryonun ötesi UNSUPPORTED ("mevcut planla desteklenmiyor"), seçenekler döner', () => {
  const r = reconcile(90, cohort([m('A', 50), m('B', 55)]));
  assert.equal(r.status, 'UNSUPPORTED'); assert.ok(r.upperScenario < 90); assert.ok(r.options.includes('LOWER_AMBITION'));
});
test('T-04: 44 ve 82 baseline farklı hedef, düşük olan daha büyük artış', () => {
  const r = reconcile(60, cohort([m('LOW', 44), m('HIGH', 82)]));
  const low = num(r, 'LOW'), high = num(r, 'HIGH'); assert.ok(low.target - low.baseline > high.target - high.baseline);
});
test('T-05: baseline olmayan birim aritmetiğe girmez ve dışarıda "none/no_baseline"', () => {
  const r = reconcile(60, cohort([m('A', 60, 100), m('NEW', undefined, 100)]));
  assert.deepEqual(r.nonArithmetic, [{ unitId: 'NEW', reason: 'no_baseline' }]);
  assert.equal(r.localProposals.find(p => p.unitId === 'NEW')!.kind, 'none');
});
test('T-57: resmî toplama ağırlığı üst skoru birebir üretir', () => {
  assert.equal(aggregateParent([{ weight: 0.6, value: 50 }, { weight: 0.4, value: 70 }]), 58);
  assert.equal(rollupProjected(cohort([m('A', 50, 0.6), m('B', 70, 0.4)]), {}), 58);
});
test('onaylı hedef ve istisna sabit; kapsam dışı üye MAINTAIN ve paydada', () => {
  const r = reconcile(63, cohort([m('A', 60, 100, { approvedTarget: 64 }), m('EXC', 58, 100, { approvedException: 60 }), m('FIN', 68, 100, { relationship: 'excluded' })]));
  assert.equal(num(r, 'A').target, 64); assert.equal(num(r, 'A').fixed, true); assert.equal(num(r, 'EXC').target, 60); assert.equal(num(r, 'FIN').kind, 'maintain');
});
test('anlamlı en küçük hareketin altında MAINTAIN: 96 skorlu şubeye sahte hassasiyet üretilmez', () => {
  const p = proposeLocalInternal(m('TOP', 96, 50), { bands: [{ maxScoreExclusive: 101, minDelta: 0.5, maxDelta: 1 }], benchmarkPull: 0.5, epsilon: 0.01, meaningfulMovement: 1.5, minPeerSample: 30, minResponseN: 5, policyVersion: 't' })!;
  assert.equal(p.kind, 'maintain'); assert.equal(p.target, 96);
});
test('A07: akran verisi bant dışıysa (negatif) öneri banttan gelir ve kaynak "methodologist_band"; akran gözlemi ayrı saklanır', () => {
  const p = proposeLocalInternal(m('N', 48, 10, { peerDelta: { suggested: -2, upper: 0, sampleSize: 200 } }))!;
  assert.equal(p.source, 'methodologist_band'); assert.deepEqual(p.peerObservation, { suggested: -2, upper: 0, sampleSize: 200 }); assert.ok(p.target > p.baseline);
  const ok = proposeLocalInternal(m('P', 48, 50, { peerDelta: { suggested: 4, upper: 7, sampleSize: 218 } }))!;
  assert.equal(ok.source, 'peer_history'); assert.equal(ok.target, 52);
  const wild = proposeLocalInternal(m('W', 48, 50, { peerDelta: { suggested: 14, upper: 20, sampleSize: 218 } }))!;
  assert.equal(wild.source, 'methodologist_band'); assert.ok(wild.high - wild.baseline <= 10);
});
test('I-12: deterministik', () => { const c = cohort([m('A', 55, 120), m('B', 62, 80)]); assert.deepEqual(reconcile(66, c), reconcile(66, c)); });
test('A12: katkı projeksiyonu tam hassasiyetle toplanır (yuvarlama gösterimde)', () => {
  const c = cohort(Array.from({ length: 400 }, (_, i) => m(`U${i}`, 60, 1)));
  const cp = contributionProjections(c);
  const sum = cp.reduce((s, p) => s + p.contribution, 0);
  const r = reconcile(60, c);
  assert.ok(Math.abs(sum - (r.supportedProjection - 60)) < 0.02);
});
test('A08/A09/A10/A11: geçersiz girdi sessizce geçmez', () => {
  assert.throws(() => aggregateParent([{ weight: -1, value: 50 }, { weight: 2, value: 80 }]), /invalid_weight|negatif/);
  assert.throws(() => aggregateParent([]), /empty_set|Boş/);
  const r = reconcile(69, cohort([m('Z', 55, 0), m('A', 55, 120), m('B', 62, 80)]));
  assert.ok(Number.isFinite(r.supportedProjection)); assert.deepEqual(r.nonArithmetic, [{ unitId: 'Z', reason: 'zero_weight' }]); for (const a of r.stretchAdjustments ?? []) assert.ok(Number.isFinite(a.to));
  assert.throws(() => reconcile(63, cohort([m('E', 58, 100, { approvedException: 110 })])), /out_of_scale/);
  assert.throws(() => reconcile(140, cohort([m('A', 55)])), /out_of_scale/);
});
test('A05 / T-58: gizli birim aritmetiğe girer ama dışarı sayısal çıkmaz; esnetme listesinde yer almaz', () => {
  const r = reconcile(69, cohort([m('A', 55, 120), m('B', 62, 80), m('H', 41, 4, { inclusionState: 'suppressed', responseN: 4 })]));
  const h = r.localProposals.find(p => p.unitId === 'H')!;
  assert.equal(h.kind, 'priority_only'); assert.ok(!('target' in h) && !('baseline' in h));
  assert.deepEqual(r.hiddenParticipants, ['H']); assert.ok(!(r.stretchAdjustments ?? []).some(a => a.unitId === 'H'));
  const ext = proposeLocal(m('H', 41, 4, { inclusionState: 'suppressed' }), roles);
  assert.equal(ext.kind, 'priority_only'); assert.equal(JSON.stringify(ext).includes('41'), false);
});
