import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canExpose, secondarySuppression, suppressedRationale, NUMERIC_OUTPUTS, differencingRisk, decide, canExposeComments, planReportCells } from '../src/privacy/gateway.js';
import { evidenceLevelByRules, verificationRoute } from '../src/evidence/risk.js';
import { recommendActions } from '../src/actions/recommend.js';
import { canOpenAction, canAddLocalTarget } from '../src/policy/workload.js';
import { resolveAccountable } from '../src/org/accountability.js';
import { evidenceRisk, evidenceLevel } from '../src/evidence/risk.js';
import { assessComparability, evaluateOutcome } from '../src/comparability/assess.js';

test('T-58: gizli birim hiçbir sayısal türetilmiş çıktı vermez; yalnız üst birim önceliği kalıbı', () => {
  const unit = { unitId: 'T4', n: 4, suppressed: true }; const viewer = { id: 'v', scope: 'unit' as const, unitId: 'T4' };
  for (const o of NUMERIC_OUTPUTS) assert.equal(canExpose(viewer, unit, o).allowed, false, o);
  assert.equal(canExpose(viewer, unit, 'action_rationale').allowed, true);
  assert.match(suppressedRationale('Ege Bölge', 'Güven'), /Ege Bölge önceliği kapsamında/);
});
test('katkı tahmini birim düzeyinde gösterilmez, bölge düzeyinde gösterilir', () => {
  const unit = { unitId: 'KONAK', n: 32, suppressed: false };
  assert.equal(canExpose({ id: 'v', scope: 'unit', unitId: 'KONAK' }, unit, 'contribution').allowed, false);
  assert.equal(canExpose({ id: 'v', scope: 'region' }, unit, 'contribution').allowed, true);
  assert.equal(canExpose({ id: 'v', scope: 'unit', unitId: 'KONAK' }, unit, 'target').allowed, true);
});
test('T-59: üst toplam + görünen alt birimlerden tek gizli birim çıkarılamasın → ikincil baskılama', () => {
  const r = secondarySuppression(true, [{ unitId: 'A', n: 40, suppressed: false }, { unitId: 'B', n: 7, suppressed: false }, { unitId: 'C', n: 4, suppressed: true }]);
  assert.deepEqual(r.suppressAdditional, ['B']);
  assert.deepEqual(secondarySuppression(true, [{ unitId: 'A', n: 40, suppressed: false }, { unitId: 'C', n: 4, suppressed: true }, { unitId: 'D', n: 3, suppressed: true }]).suppressAdditional, []);
});

test('A01/A02/A03: varsayılan ret — gizli birimde yorum yok, bayrak yanlış olsa da n eşiği tutar, bilinmeyen birim/görüntüleyen reddedilir', () => {
  const u4 = { unitId: 'T', n: 4, suppressed: true }; const v = { id: 'v', scope: 'region' as const };
  assert.equal(decide(v, 'comment', { unitIds: ['T'] }, { T: u4 }, []).allowed, false);
  assert.equal(canExpose(v, { unitId: 'T', n: 4, suppressed: false }, 'score').allowed, false);
  assert.equal(decide(v, 'score', { unitIds: ['YOK'] }, {}, []).reason, 'unknown_unit');
  assert.equal(decide({ scope: 'region' }, 'score', { unitIds: ['A'] }, { A: { unitId: 'A', n: 40 } }, []).reason, 'unknown_viewer');
  assert.equal(decide(v, 'comment', { unitIds: ['B'] }, { B: { unitId: 'B', n: 8 } }, []).reason, 'comment_threshold');
  assert.equal(decide(v, 'export', { unitIds: ['T'] }, { T: u4 }, []).allowed, false); // export aynı yol
});

test('A04: önceden tanımlı rapor hücrelerinde tamamlayıcı baskılama — üç örtüşen toplamdan gizli değer çözülemez', () => {
  const units = { A: { unitId: 'A', n: 40 }, B: { unitId: 'B', n: 30 }, H: { unitId: 'H', n: 4 } };
  const plan = planReportCells([{ cellId: 'ABH', unitIds: ['A', 'B', 'H'] }, { cellId: 'AB', unitIds: ['A', 'B'] }, { cellId: 'AH', unitIds: ['A', 'H'] }, { cellId: 'A', unitIds: ['A'] }], units);
  assert.ok(!plan.publish.includes('AB') || !plan.publish.includes('ABH'));
  assert.ok(!plan.publish.includes('AH') || !plan.publish.includes('A'));
  assert.ok(!plan.publish.includes('H' as string));
});

test('T-64: fark sorgusu koruması — iki sorgunun farkı tek gizli birimse ikinci sorgu bastırılır ve karar kaydedilir', () => {
  const units = { A: { unitId: 'A', n: 40, suppressed: false }, B: { unitId: 'B', n: 30, suppressed: false }, C: { unitId: 'C', n: 4, suppressed: true } };
  const first = { unitIds: ['A', 'B', 'C'] }; const second = { unitIds: ['A', 'B'] };
  assert.equal(differencingRisk([first], second, units).blocked, true);
  const d = decide({ id: 'v1', scope: 'region' }, 'score', second, units, [first]);
  assert.equal(d.allowed, false); assert.equal(d.reason, 'differencing');
  assert.equal(decide({ id: 'v1', scope: 'region' }, 'score', { unitIds: ['A', 'B'] }, units, []).allowed, true);
  assert.equal(canExposeComments({ unitId: 'B', n: 8, suppressed: false }), false);
});

test('T-60b: kural önce — düşük riskli rutin E0, sayısal hedefe bağlı E1, yaygın E2, kritik E3, büyük program E4; doğrulama yolu', () => {
  assert.equal(evidenceLevelByRules({ boundToNumericTarget: false, deployedUnits: 1, ownerHasPriorAnomaly: false, reversible: true, costBand: 'none' }).level, 'E0');
  assert.equal(evidenceLevelByRules({ boundToNumericTarget: true, deployedUnits: 1, ownerHasPriorAnomaly: false, costBand: 'none' }).level, 'E1');
  assert.equal(evidenceLevelByRules({ boundToNumericTarget: true, deployedUnits: 400, ownerHasPriorAnomaly: false, costBand: 'low' }).level, 'E2');
  assert.equal(evidenceLevelByRules({ boundToNumericTarget: true, deployedUnits: 400, ownerHasPriorAnomaly: false, critical: true }).level, 'E3');
  assert.equal(evidenceLevelByRules({ boundToNumericTarget: true, deployedUnits: 400, ownerHasPriorAnomaly: false, largeProgram: true }).level, 'E4');
  assert.equal(verificationRoute('E2', true, false), 'auto'); assert.equal(verificationRoute('E3', false, false), 'human_review'); assert.equal(verificationRoute('E4', false, false), 'sample_audit');
  assert.equal(verificationRoute('E3', true, true), 'human_review'); assert.equal(verificationRoute('E4', true, true), 'sample_audit'); // A13/A14: sistem izi bağımsız kontrolü kaldırmaz
});

test('T-67: yük sınırları domain politikası — 3. aksiyondan sonra ret ve öneri; 2 yerel hedef', () => {
  assert.equal(canOpenAction(2).allowed, true); const r = canOpenAction(3); assert.equal(r.allowed, false); if (!r.allowed) assert.equal(r.reason, 'max_active_actions');
  assert.equal(canAddLocalTarget(2).allowed, false);
});

test('T-66: rol merkezli sahiplik — kişi ayrılınca rol boşalır, iş taşınmaz; vekil öncelikli çözülür', () => {
  const role = { roleId: 'r-konak-mudur', roleType: 'branch_manager', unitId: 'SUBE-KONAK' };
  const holders = [{ roleId: 'r-konak-mudur', personId: 'ayse', from: '2024-01-01', to: '2026-09-12', kind: 'primary' as const }, { roleId: 'r-konak-mudur', personId: 'can', from: '2026-06-01', to: '2026-09-01', kind: 'delegate' as const }];
  assert.deepEqual(resolveAccountable(role, holders, '2026-07-01'), { roleId: 'r-konak-mudur', personId: 'can', kind: 'delegate' });
  assert.deepEqual(resolveAccountable(role, holders, '2026-09-05'), { roleId: 'r-konak-mudur', personId: 'ayse', kind: 'primary' });
  assert.deepEqual(resolveAccountable(role, holders, '2026-09-20'), { roleId: 'r-konak-mudur', personId: null, kind: 'vacant' });
});

test('öneri motoru: uygunluk filtreleri, ≤3, gözlemsel etkinlik son kriter', () => {
  const lib = [
    { code: 'a', version: '1', title: 'A', targetMetrics: ['Güven'], driverItems: [], unitTypes: ['branch'], lever: 'iletisim', accountableRole: 'branch_manager', effort: 'low' as const, cost: 'none' as const, timeToSignalWeeks: 6, evidenceLevel: 'E1' as const, leadingKpi: 'k', observedAssociation: { medianChange: 1, sampleSize: 50 } },
    { code: 'b', version: '1', title: 'B', targetMetrics: ['Güven'], driverItems: [], unitTypes: ['branch'], lever: 'vardiya', accountableRole: 'branch_manager', effort: 'low' as const, cost: 'none' as const, timeToSignalWeeks: 6, evidenceLevel: 'E1' as const, leadingKpi: 'k', observedAssociation: { medianChange: 9, sampleSize: 50 } },
    { code: 'c', version: '1', title: 'C', targetMetrics: ['Güven'], driverItems: [], unitTypes: ['call_center'], lever: 'iletisim', accountableRole: 'branch_manager', effort: 'low' as const, cost: 'none' as const, timeToSignalWeeks: 6, evidenceLevel: 'E1' as const, leadingKpi: 'k' },
  ];
  const unit = { unitType: 'branch', teamSize: 30, activeFlags: [], ownerRoleExists: () => true, controllability: (l: string) => l === 'vardiya' ? 0.2 : 0.9, workload: 0.3, connectors: [] };
  const r = recommendActions('Güven', null, unit, lib);
  assert.equal(r.length, 2); assert.equal(r[0]!.template.code, 'a'); // vardiya kontrol dışında → sahip uygunluğu düşük; gözlemsel +9 onu öne çıkaramaz
});

test('T-60: kural önce — puan yalnız triyaj; sayısal hedefe bağlı yaygın aksiyon E0 olamaz; önceki anomali bir basamak yükseltir', () => {
  const low = evidenceRisk({ criticality: .1, reach: .1, cost: 0, gamingRisk: .1, irreversibility: 0, priorAnomaly: 0 });
  assert.ok(low < 20);
  assert.equal(evidenceLevel(low, { boundToNumericTarget: false, deployedUnits: 1, ownerHasPriorAnomaly: false, reversible: true }), 'E0');
  assert.equal(evidenceLevel(low, { boundToNumericTarget: true, deployedUnits: 400, ownerHasPriorAnomaly: false }), 'E2'); // yaygın → E2 (kural), puan düşük olsa da
  assert.equal(evidenceLevel(low, { boundToNumericTarget: false, deployedUnits: 1, ownerHasPriorAnomaly: true, reversible: true }), 'E1');
  assert.equal(evidenceLevel(99, { boundToNumericTarget: true, deployedUnits: 400, ownerHasPriorAnomaly: false, largeProgram: true }), 'E4');
});

test('T-61/T-69: atıf kanıtı derecesi — önce/sonra C (zamansal ilişki, tahmini etki yok), eşleştirilmiş kıyas B (tahmini etki), karşılaştırılamaz D', () => {
  const base = { baselineN: 650, followupN: 640, itemEquivalence: 'identical' as const, lineageEventsInPeriod: 0, measurementIntervalDays: 365, expectedIntervalDays: 365, qualityFlagCount: 0, minN: 5 };
  const hi = assessComparability(base);
  const c = evaluateOutcome({ baseline: 49, approvedTarget: 55, followup: 57, comparability: hi });
  assert.equal(c.attributionEvidenceGrade, 'C'); assert.equal(c.causalClaim, false); assert.equal(c.estimatedEffect, undefined); assert.equal(c.observedChange, 8);
  const claimOnly = evaluateOutcome({ baseline: 49, approvedTarget: 55, followup: 57, comparability: hi, comparison: { design: 'experimental', comparisonMovement: 3 } });
  assert.equal(claimOnly.attributionEvidenceGrade, 'C'); assert.equal(claimOnly.estimatedEffect, undefined); // yalnız alana 'deneysel' yazmak A/B kazandırmaz
  const b = evaluateOutcome({ baseline: 49, approvedTarget: 55, followup: 57, comparability: hi, comparison: { design: 'matched_did', comparisonMovement: 3, designRecordId: 'd1', comparisonGroupId: 'g1', reviewedBy: 'metodolog' } });
  assert.equal(b.attributionEvidenceGrade, 'B'); assert.equal(b.estimatedEffect, 5);
  const d = evaluateOutcome({ baseline: 49, approvedTarget: 55, followup: 57, comparability: assessComparability({ ...base, itemEquivalence: 'changed' }) });
  assert.equal(d.attributionEvidenceGrade, 'D'); assert.equal(d.attainment, 'NOT_EVALUATED');
});
