import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessPriority, severityScore, confidenceScore, severityTier } from '../src/priority/priority.js';
import { transitionExecution } from '../src/state/action-execution.js';
import { trUpper, trLower, trCompare } from '../src/util/turkish.js';

const sev = { need: .9, trendRisk: .7, relativeGap: .7, breadth: .8, impact: .6 };
const base = { severity: sev, confidence: { responseN: 40, responseRate: 0.85 }, controllability: 0.9, workload: 0.3, accountableUnitId: 'KONAK', affectedUnitId: 'KONAK' };

test('T-55a: düşük veri güveni şiddeti küçültmez; karar "doğrulama gerekli"', () => {
  const strong = assessPriority(base); const weak = assessPriority({ ...base, confidence: { responseN: 6, responseRate: 0.5 } });
  assert.equal(strong.severity, weak.severity);
  assert.equal(strong.decision, 'numeric_target_and_actions'); assert.equal(weak.decision, 'validation_required');
});
test('T-55b: kontrol edilebilirlik önceliği değil sahibi değiştirir', () => {
  const r = assessPriority({ ...base, controllability: 0.2, accountableUnitId: 'OPERASYON-PLANLAMA' });
  assert.equal(r.severity, assessPriority(base).severity); assert.equal(r.ownership, 'accountable_unit'); assert.equal(r.ownerUnitId, 'OPERASYON-PLANLAMA');
});
test('T-55c: dolu iş yükü sorunu gizlemez; alternatif sahip / merkezi destek', () => {
  const r = assessPriority({ ...base, workload: 0.95 });
  assert.equal(r.decision, 'numeric_target_and_actions'); assert.equal(r.ownership, 'alternative_owner_or_central_support');
});
test('T-68: stratejik önem şiddeti değiştirmez, yalnız sıralamayı etkiler', () => {
  const a = assessPriority({ ...base, strategicRelevance: 0 }); const b = assessPriority({ ...base, strategicRelevance: 1 });
  assert.equal(a.severity, b.severity); assert.equal(a.decision, b.decision); assert.ok(b.rankKey > a.rankKey);
  assert.equal(a.confidenceLabel, 'HIGH');
});
test('şiddet bantları ve önleyici katman', () => {
  assert.ok(severityScore(sev) >= 75); assert.equal(severityTier(severityScore(sev), sev), 'critical');
  const good = { ...sev, need: .1, trendRisk: .7 }; assert.equal(severityTier(severityScore(good), good), 'preventive');
  assert.ok(confidenceScore({ responseN: 30, responseRate: 0.8 }) >= 0.9);
});

test('T-25: declare_complete → evidence_pending; verified yalnız verify ile', () => {
  assert.equal(transitionExecution('in_progress', 'declare_complete'), 'evidence_pending');
  assert.throws(() => transitionExecution('in_progress', 'verify'), /invalid_transition/);
  assert.equal(transitionExecution('evidence_pending', 'verify_partial'), 'partially_verified');
  assert.equal(transitionExecution('review_required', 'reject_by_human'), 'in_progress');
});

test('T-42: Türkçe casing ve collation', () => {
  assert.equal(trUpper('birim iletişim ılık'), 'BİRİM İLETİŞİM ILIK');
  assert.equal(trLower('İNSAN KAYNAKLARI'), 'insan kaynakları');
  assert.equal(trLower('ISPARTA'), 'ısparta');
  assert.ok(trCompare('ışık', 'iyi') < 0);
});
