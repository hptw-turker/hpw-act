/** v2.4 derin inceleme raporu bulguları (F11, F15, F16, F21, F27, F29, F30, F31): düzeltmeden önce kırmızı. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topBoxFromDistribution } from '../src/instrument/scoring.js';
import { parseBundle } from '../src/instrument/bundle.js';
import { planReportCells } from '../src/privacy/gateway.js';
import { reconcile, aggregateParent } from '../src/allocation/allocate.js';
import { assessComparability, evaluateOutcome } from '../src/comparability/assess.js';
import { readFileSync } from 'node:fs';

test('F11: ters madde, ikili ve ortalama ölçekleri doğru puanlanır; bilinmeyen ölçek/seçenek sessizce geçmez', () => {
  assert.equal(topBoxFromDistribution('likert5_topbox', { counts: { '1': 6, '2': 2, '3': 0, '4': 1, '5': 1 } }, 'negative').topBoxPct, 80, 'ters maddede olumlu 1|2');
  assert.equal(topBoxFromDistribution('binary', { counts: { YES: 8, NO: 2 } }).topBoxPct, 80, 'ikili ölçek 0 üretmez');
  assert.equal(topBoxFromDistribution('likert5_mean', { counts: { '4': 10 } }).topBoxPct, 75, 'ortalama tabanlı: 4 → (4−1)/4 = %75, Top Box 100 değil');
  assert.throws(() => topBoxFromDistribution('likert5_topbox', { counts: { '6': 1 } }), /invalid_option/);
  assert.throws(() => topBoxFromDistribution('custom', { counts: { a: 1 } }), /unsupported_scale/);
});
test('F15/F12: gizli satır dağılım ya da sayı taşırsa paket reddedilir; boş unit_id ve tekrar reddedilir', () => {
  const f = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
  const base = { manifest: f('manifest.json'), instrument: f('instrument.csv'), resultsItem: '' };
  assert.throws(() => parseBundle({ ...base, resultsItem: 'unit_id;item_code;n;top_box_pct;c_1;c_2;c_3;c_4;c_5\nT;BAS-01;4;;0;0;0;2;2\n' }), /suppressed_data_present/);
  assert.throws(() => parseBundle({ ...base, resultsItem: 'unit_id;item_code;n;top_box_pct\nT;BAS-01;4;50\n' }), /suppressed_data_present/);
  assert.throws(() => parseBundle({ ...base, resultsItem: 'unit_id;item_code;n;top_box_pct\n;BAS-01;10;50\n' }), /missing_unit/);
  assert.throws(() => parseBundle({ ...base, resultsItem: 'unit_id;item_code;n;top_box_pct\nA;BAS-01;10;50\nA;BAS-01;10;50\n' }), /duplicate_result/);
  assert.throws(() => parseBundle({ ...base, resultsItem: 'unit_id;item_code;n;top_box_pct\nA;BAS-01;10;abc\n' }), /invalid_topbox/);
});
test('F16: üç toplam (A+H, B+H, A+B) birlikte yayımlanamaz; H tekil çözülemez', () => {
  const units = { A: { unitId: 'A', n: 40 }, B: { unitId: 'B', n: 30 }, H: { unitId: 'H', n: 4 } };
  const plan = planReportCells([{ cellId: 'AH', unitIds: ['A', 'H'] }, { cellId: 'BH', unitIds: ['B', 'H'] }, { cellId: 'AB', unitIds: ['A', 'B'] }], units);
  assert.ok(plan.publish.length < 3, JSON.stringify(plan));
  const safe = planReportCells([{ cellId: 'AB', unitIds: ['A', 'B'] }, { cellId: 'ABH', unitIds: ['A', 'B', 'H'] }], units); assert.equal(safe.publish.length, 1);
  const fine = planReportCells([{ cellId: 'A', unitIds: ['A'] }, { cellId: 'B', unitIds: ['B'] }], units); assert.equal(fine.publish.length, 2);
});
test('F21: esnetme gizli birime uygulanmaz; önerilen değişiklikler uygulanınca hesaplanan projeksiyon gösterilenle eşleşir; kapanmayan fark gizlenmez', () => {
  const m = (id: string, hidden = false) => ({ unitId: id, relationship: 'inherited' as const, inclusionState: hidden ? 'suppressed' as const : 'active' as const, aggregationWeight: 10, baseline: 50, responseN: hidden ? 4 : 30 });
  const r = reconcile(59, { cohortId: 'c', policy: 'BASELINE_FROZEN', snapshotHash: 'h', members: [m('V'), m('H', true)] });
  assert.ok(!(r.stretchAdjustments ?? []).some(a => a.unitId === 'H'));
  const applied = aggregateParent([{ weight: 10, value: r.stretchAdjustments?.find(a => a.unitId === 'V')?.to ?? 0 }, { weight: 10, value: 56.5 }]);
  assert.ok(Math.abs(applied - (r.stretchedProjection ?? -1)) < 0.05, `uygulanan ${applied} ≠ gösterilen ${r.stretchedProjection}`);
  assert.ok((r.residualGap ?? 0) > 0 && r.status === 'UNSUPPORTED', JSON.stringify({ status: r.status, residual: r.residualGap }));
});
test('F29: inceleme onayı sürüm alanları olmadan kullanılamaz; geçersiz n karşılaştırılamaz', () => {
  const c = assessComparability({ baselineN: 650, followupN: 41, itemEquivalence: 'identical', lineageEventsInPeriod: 0, measurementIntervalDays: 365, expectedIntervalDays: 365, qualityFlagCount: 0, minN: 5 });
  const o = evaluateOutcome({ baseline: 61, approvedTarget: 68, followup: 70, comparability: c, review: { decision: 'comparable', reviewedBy: 'm', reviewedAt: 'x', comparabilityVersion: 'cv1', resultVersion: 'rv1' } });
  assert.equal(o.status, 'PENDING_REVIEW', 'sonuç sürümleri verilmemişken onay geçerli sayılmaz');
  const bad = assessComparability({ baselineN: NaN, followupN: 41, itemEquivalence: 'identical', lineageEventsInPeriod: 0, measurementIntervalDays: 365, expectedIntervalDays: 365, qualityFlagCount: 0, minN: 5 }); assert.equal(bad.status, 'not_comparable');
});
