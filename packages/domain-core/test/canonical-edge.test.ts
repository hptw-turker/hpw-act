import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCanonicalEdge, findCanonicalViolations } from '../src/rollup/canonical-edge.js';

test('T-07: aynı birim ikinci aritmetik kenarla bağlanamaz', () => {
  const existing = [{ parentTargetId: 'P', childUnitId: 'KONAK', relationshipType: 'inherited', active: true }];
  assert.throws(() => assertCanonicalEdge(existing, { parentTargetId: 'P', childUnitId: 'KONAK', relationshipType: 'shared', active: true }), /canonical_edge_violation/);
});
test('contribution kenarı aritmetik değildir, çakışmaz', () => {
  const existing = [{ parentTargetId: 'P', childUnitId: 'AKADEMI', relationshipType: 'inherited', active: true }];
  assert.doesNotThrow(() => assertCanonicalEdge(existing, { parentTargetId: 'P', childUnitId: 'AKADEMI', relationshipType: 'contribution', active: true }));
});
test('kapanmış kenar sayılmaz', () => {
  const v = findCanonicalViolations([
    { parentTargetId: 'P', childUnitId: 'X', relationshipType: 'inherited', active: false },
    { parentTargetId: 'P', childUnitId: 'X', relationshipType: 'exception', active: true },
  ]);
  assert.equal(v.length, 0);
});
