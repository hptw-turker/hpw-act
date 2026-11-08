import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evidenceConfidence, verifierAllowed } from '../src/evidence/confidence.js';

const req = { ruleType: 'count' as const, expectedValue: 8, windowStart: '2026-01-01', windowEnd: '2026-03-01', isCritical: true };
const art = (i: number, hash = `h${i}`) => ({ id: `e${i}`, type: 'artifact' as const, fileHash: hash, date: '2026-02-01', submittedBy: 'owner' });

test('T-24: 8 beklenir 7 bulunur → partially_verified', () => {
  const r = evidenceConfidence(req, Array.from({ length: 7 }, (_, i) => art(i)), { actionId: 'a', ownerId: 'owner', verifierId: 'boss' });
  assert.equal(r.status, 'partially_verified');
  assert.ok(Math.abs(r.coverage - 7 / 8) < 1e-9);
});

test('8/8 bağımsız doğrulayıcı → verified, HIGH', () => {
  const r = evidenceConfidence(req, Array.from({ length: 8 }, (_, i) => art(i)), { actionId: 'a', ownerId: 'owner', verifierId: 'boss' });
  assert.equal(r.status, 'verified'); assert.equal(r.confidence, 'HIGH');
});

test('T-22: ilişkisiz aksiyonlarda hash tekrarı → duplicate_hash_unrelated, otomatik ret yok', () => {
  const r = evidenceConfidence(req, Array.from({ length: 8 }, (_, i) => art(i, 'same')), {
    actionId: 'a', ownerId: 'owner', verifierId: 'boss',
    otherActionsWithSameHash: Array.from({ length: 13 }, (_, i) => ({ actionId: `x${i}` })),
  });
  assert.ok(r.anomalyFlags.includes('duplicate_hash_unrelated'));
  assert.notEqual(r.status, 'rejected' as unknown);
});

test('I-24: aynı ana aksiyonun yerel uygulamaları arasında hash paylaşımı sinyal değildir', () => {
  const r = evidenceConfidence({ ...req, expectedValue: 1, ruleType: 'artifact' }, [art(1, 'duyuru')], {
    actionId: 'le-konak', masterActionId: 'M1', ownerId: 'owner', verifierId: 'boss',
    otherActionsWithSameHash: Array.from({ length: 40 }, (_, i) => ({ actionId: `le${i}`, masterActionId: 'M1' })),
  });
  assert.ok(!r.anomalyFlags.includes('duplicate_hash_unrelated'));
  assert.equal(r.status, 'verified');
});

test('T-23: beyan 200, LMS 83 → LOW / review_required', () => {
  const r = evidenceConfidence({ ruleType: 'attendance', expectedValue: 25, isCritical: false },
    [{ id: 'lms', type: 'system_data', metricValue: 83, submittedBy: 'connector', metricPeriod: '2026-Q4' }], // sistem verisi dönem bilgisi taşımalı (F27)
    { actionId: 'a', ownerId: 'owner', verifierId: 'boss', ownerClaimedValue: 200 });
  assert.ok(r.anomalyFlags.includes('connector_contradicts_claim'));
  assert.equal(r.confidence, 'LOW'); assert.equal(r.status, 'review_required');
});

test('toplu tamamlama sinyali', () => {
  const r = evidenceConfidence(req, Array.from({ length: 8 }, (_, i) => art(i)), { actionId: 'a', ownerId: 'owner', verifierId: 'boss', completionsLast24h: 17 });
  assert.ok(r.anomalyFlags.includes('suspicious_bulk_completion'));
});

test('T-20: kritik kanıtta sahip veya vekili doğrulayamaz', () => {
  assert.equal(verifierAllowed(req, 'ayse', 'ayse', false), false);
  assert.equal(verifierAllowed(req, 'ayse', 'vekil', true), false);
  assert.equal(verifierAllowed(req, 'ayse', 'boss', false), true);
  assert.equal(verifierAllowed({ ...req, isCritical: false }, 'ayse', 'ayse', false), true);
});
