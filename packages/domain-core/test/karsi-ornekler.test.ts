/** İnceleme raporunun karşı örnekleri (A01–A22): düzeltmeden önce kırmızı, sonra yeşil. Her biri saf fonksiyon düzeyinde. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessPriority } from '../src/priority/priority.js';
import { evidenceConfidence } from '../src/evidence/confidence.js';
import { validateEvidence } from '../src/evidence/validity.js';
import { resolveAccountable } from '../src/org/accountability.js';
import { canOpenAction } from '../src/policy/workload.js';
import { dismiss } from '../src/attention/dismiss.js';
import { invalidateEvidence, validateSnapshot } from '../src/state/states.js';

const sev = { need: .9, trendRisk: .5, relativeGap: .8, breadth: .8, impact: .5 };
test('A20: sıfır ya da eşik altı yanıtla sayısal hedef kararı çıkmaz', () => {
  for (const n of [0, 3, 4]) { const r = assessPriority({ severity: sev, confidence: { responseN: n, responseRate: 0.9 }, controllability: .9, workload: .3, accountableUnitId: 'x', affectedUnitId: 'x' }); assert.notEqual(r.decision, 'numeric_target_and_actions', `n=${n}`); assert.notEqual(r.decision, 'recommended_target'); }
  assert.equal(assessPriority({ severity: sev, confidence: { responseN: 0 }, controllability: .9, workload: .3, accountableUnitId: 'x', affectedUnitId: 'x' }).confidence, 0);
});

const req = { ruleType: 'count' as const, expectedValue: 8, windowStart: '2026-10-01', windowEnd: '2026-12-31', isCritical: false, unitId: 'KONAK', period: '2026-ANA' };
const ctx = { actionId: 'a', ownerId: 'owner', verifierId: 'boss' };
test('A15: aynı gerçekleşmenin sekiz kopyası tek gerçekleşme sayılır; farklı kimlik + aynı hash + aynı tarih de kopyadır', () => {
  const same = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, type: 'artifact' as const, fileHash: 'h1', date: '2026-10-07', submittedBy: 'owner', unitId: 'KONAK' }));
  const r = evidenceConfidence(req, same, ctx);
  assert.equal(r.rejected.filter(x => x.reason === 'duplicate_occurrence').length, 7); assert.ok(r.coverage <= 1 / 8 + 1e-9); assert.notEqual(r.status, 'verified');
});
test('A16: tarihsiz belge geçerli sayılmaz', () => {
  const und = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, type: 'artifact' as const, fileHash: `h${i}`, submittedBy: 'owner', unitId: 'KONAK' }));
  const r = evidenceConfidence(req, und, ctx); assert.equal(r.rejected.length, 8); assert.equal(r.coverage, 0);
});
test('A17: eski döneme ait sistem metriği yeni dönemin gereksinimini karşılamaz', () => {
  const v = validateEvidence({ ruleType: 'attendance', expectedValue: 200, isCritical: false, period: '2026-ANA' }, [{ id: 'lms', type: 'system_data', metricValue: 200, submittedBy: 'connector', metricPeriod: '2025-ANA' }]);
  assert.equal(v.valid.length, 0); assert.equal(v.rejected[0]!.reason, 'stale_metric');
});
test('A18: sonuç (employee_outcome) uygulama kanıtı sayılmaz', () => {
  const v = validateEvidence(req, Array.from({ length: 8 }, (_, i) => ({ id: `o${i}`, type: 'employee_outcome' as const, date: '2026-10-07', submittedBy: 'x', unitId: 'KONAK' })));
  assert.equal(v.valid.length, 0); assert.ok(v.rejected.every(r => r.reason === 'outcome_not_execution'));
});
test('A17b: yanlış birime ait kanıt reddedilir', () => {
  const v = validateEvidence(req, [{ id: 'k', type: 'artifact', date: '2026-10-07', submittedBy: 'x', unitId: 'ATASEHIR' }]);
  assert.equal(v.rejected[0]!.reason, 'wrong_scope');
});
test('A21/A22: çakışan eşzamanlı vekiller hata verir; zaman dilimi UTC anıyla kıyaslanır', () => {
  const role = { roleId: 'r', roleType: 't', unitId: 'u' };
  assert.throws(() => resolveAccountable(role, [{ roleId: 'r', personId: 'a', from: '2026-09-01T00:00:00Z', kind: 'delegate' }, { roleId: 'r', personId: 'b', from: '2026-09-02T00:00:00Z', kind: 'delegate' }], '2026-09-10T00:00:00Z'), /assignment_conflict/);
  const r = resolveAccountable(role, [{ roleId: 'r', personId: 'a', from: '2026-09-23T12:00:00+03:00', kind: 'delegate' }], '2026-09-23T10:00:00Z');
  assert.deepEqual(r, { roleId: 'r', personId: 'a', kind: 'delegate' }); // 12:00+03:00 = 09:00Z → 10:00Z'de başlamıştır
  assert.throws(() => resolveAccountable(role, [{ roleId: 'r', personId: 'a', from: 'dün', kind: 'primary' }], '2026-09-23T10:00:00Z'), /invalid_timestamp/);
});
test('Acil vaka üç aksiyon sınırına takılmaz', () => { assert.equal(canOpenAction(3, undefined, true).allowed, true); assert.equal(canOpenAction(3).allowed, false); });
test('Dikkat kapatma: okundu yalnız bilgi için; ertele/yönlendir yükümlülüğü bitirmez; muafiyet gerekçe ve yetki ister', () => {
  const item = { id: 'i', obligation: 'decision' as const, ownerRoleId: 'r-sube', state: 'open' as const };
  assert.equal(dismiss(item, { action: 'acknowledge', actorRoleId: 'r-sube' }).error, 'acknowledge_only_for_info');
  assert.equal(dismiss(item, { action: 'snooze', until: '2099-10-01', actorRoleId: 'r-sube' }).obligationCleared, false);
  assert.equal(dismiss(item, { action: 'reroute', toRoleId: 'r-bolge', reason: 'yetki bölgede', actorRoleId: 'r-sube' }).item.ownerRoleId, 'r-bolge');
  assert.equal(dismiss(item, { action: 'exempt', reason: 'kapanış', actorRoleId: 'r-sube' }).error, 'exempt_requires_reason_and_authority');
  assert.equal(dismiss(item, { action: 'exempt', reason: 'kapanış', actorRoleId: 'r-bolge' }).error, 'exempt_requires_reason_and_authority', 'yetki listesinde olmayan üst rol muafiyet veremez');
  assert.equal(dismiss(item, { action: 'exempt', reason: 'kapanış', actorRoleId: 'r-bolge', authorityRoleIds: ['r-bolge'] }).obligationCleared, true);
  assert.equal(dismiss(item, { action: 'resolve', actorRoleId: 'r-baska' }).error, 'resolve_requires_owner');
  assert.equal(dismiss(item, { action: 'resolve', actorRoleId: 'r-sube' }).error, 'resolve_requires_domain_event', 'kartı çözmek yükümlülüğü kapatmaz; olay referansı gerekir (F31)');
  assert.equal(dismiss(item, { action: 'resolve', actorRoleId: 'r-sube', resolvedEventRef: 'decision:123' }).obligationCleared, true);
  assert.equal(dismiss(item, { action: 'snooze', until: '2020-01-01', actorRoleId: 'r-sube' }).error, 'snooze_requires_future_date');
});
test('Durum eksenleri ayrı; sonradan geçersizleşen kanıt işi yeniden açar, tarihçe silinmez', () => {
  const s = invalidateEvidence({ lifecycle: 'closed', verification: 'human_verified', health: 'on_track', outcome: 'improved' }, 'kanıt tarihi sahte');
  assert.equal(s.verification, 'invalidated'); assert.equal(s.lifecycle, 'in_progress'); assert.equal(s.attribution, 'none');
  assert.deepEqual(validateSnapshot(s), [], 'gözlenen iyileşme yasaklanmaz (F30)'); assert.ok(validateSnapshot({ ...s, attribution: 'credited' }).includes('attribution_without_verified_execution'), 'geçersiz kanıtla nedensel kredi verilmez');
});
