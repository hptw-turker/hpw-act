import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessComparability, evaluateOutcome } from '../src/comparability/assess.js';

const base = { baselineN: 650, followupN: 640, itemEquivalence: 'identical' as const, lineageEventsInPeriod: 0, measurementIntervalDays: 365, expectedIntervalDays: 365, qualityFlagCount: 0, minN: 5 };

test('normal koşullar → HIGH / auto_valid', () => {
  const c = assessComparability(base);
  assert.equal(c.level, 'HIGH'); assert.equal(c.status, 'auto_valid');
});

test('T-28: n 650→41 → düşük karşılaştırılabilirlik, otomatik achieved yok', () => {
  const c = assessComparability({ ...base, followupN: 41 });
  assert.notEqual(c.status, 'auto_valid');
  assert.ok(c.reasons.some(r => r.startsWith('response_count_change')));
  const o = evaluateOutcome({ baseline: 61, approvedTarget: 68, followup: 70, comparability: c, comparabilityVersion: 'cv1', resultVersion: 'rv1' });
  assert.equal(o.attainment, 'NOT_EVALUATED'); assert.equal(o.status, 'PENDING_REVIEW'); assert.equal(o.observedAboveTarget, true); // gözlem ayrı, karar insanın
  const approved = evaluateOutcome({ baseline: 61, approvedTarget: 68, followup: 70, comparability: c, comparabilityVersion: 'cv1', resultVersion: 'rv1', review: { decision: 'comparable_labeled', reviewedBy: 'metodolog', reviewedAt: '2027-05-01', comparabilityVersion: 'cv1', resultVersion: 'rv1' } });
  assert.equal(approved.status, 'EVALUATED'); assert.equal(approved.attainment, 'ACHIEVED');
  const stale = evaluateOutcome({ baseline: 61, approvedTarget: 68, followup: 70, comparability: c, comparabilityVersion: 'cv2', resultVersion: 'rv1', review: { decision: 'comparable', reviewedBy: 'metodolog', reviewedAt: '2027-05-01', comparabilityVersion: 'cv1', resultVersion: 'rv1' } });
  assert.equal(stale.status, 'PENDING_REVIEW'); // sonuç düzeltilince eski onay geçersiz
  assert.equal(o.causalClaim, false);
});

test('T-29: madde materially changed → not_comparable → NOT_EVALUATED', () => {
  const c = assessComparability({ ...base, itemEquivalence: 'changed' });
  assert.equal(c.status, 'not_comparable');
  const o = evaluateOutcome({ baseline: 61, approvedTarget: 68, followup: 69, comparability: c });
  assert.equal(o.attainment, 'NOT_EVALUATED'); assert.equal(o.movementClass, 'insufficient_measurement');
});

test('nüfusun %60ı değişti → review_required', () => {
  const c = assessComparability({ ...base, populationContinuity: 0.4 });
  assert.equal(c.status, 'review_required');
});

test('T-26: uygulama verified ama skor düştü → deterioration, nedensellik yok', () => {
  const c = assessComparability(base);
  const o = evaluateOutcome({ baseline: 62, approvedTarget: 68, followup: 57, comparability: c });
  assert.equal(o.attainment, 'MISSED'); assert.equal(o.movementClass, 'deterioration'); assert.equal(o.causalClaim, false);
});
