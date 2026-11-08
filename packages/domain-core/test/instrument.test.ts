/** v2.4 — enstrüman-agnostik sonuç paketi, madde düzeyi takip, sorumluluk merkezi. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBundle, detectInstrument, derivePanels, assertTrackable, parseCsv } from '../src/instrument/bundle.js';
import { topBoxFromDistribution, npsFromDistribution, indexFromItems } from '../src/instrument/scoring.js';
import { rolesForItem } from '../src/instrument/responsibility.js';
import { HPTW_2026 } from '../src/instrument/hptw-2026.js';

const f = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const files = { manifest: f('manifest.json'), instrument: f('instrument.csv'), resultsItem: f('results_item.csv'), resultsIndex: f('results_index.csv'), benchmarks: f('benchmarks.csv') };

test('T-70: sonuç paketi çözümlenir; Top Box dağılımdan yeniden hesaplanır ve verilenle eşleşir', () => {
  const b = parseBundle(files);
  assert.equal(b.instrument.items.length, 73); assert.equal(b.instrument.dimensions.length, 19); // 18 referans boyut − Dijital + Şirkete Özel
  const konak = b.itemResults.find(r => r.unitId === 'SUBE-KONAK' && r.itemCode === 'GUR-03')!;
  assert.ok(konak.topBoxPct! > 0 && konak.topBoxPct! < 100); assert.equal(konak.n, 32);
});
test('T-71: enstrüman algılama — çıkarılan boyut, özel maddeler, modüller, ölçekler; sertifikasyon çekirdeği tam', () => {
  const d = detectInstrument(parseBundle(files), HPTW_2026);
  assert.deepEqual(d.removedDimensions.map(x => x.code), ['DIJ']);
  assert.deepEqual(d.customItems.map(x => x.code), ['OZL-01', 'OZL-02']);
  assert.equal(d.modules.core, 15); assert.equal(d.modules.custom, 2); assert.equal(d.scales['nps_0_10'], 1);
  assert.ok(!d.warnings.some(w => w.startsWith('Sertifikasyon çekirdeği eksik')));
});
test('T-72: indeks mutabakatı — resmî WBI ile madde ortalaması ≤ 0,15 farkla eşleşir; sahte resmî değer yakalanır', () => {
  const b = parseBundle(files); const d = detectInstrument(b, HPTW_2026);
  assert.ok(d.indexReconciliation.length >= 2 && d.indexReconciliation.every(x => x.ok), JSON.stringify(d.indexReconciliation));
  const bad = parseBundle({ ...files, resultsIndex: 'unit_id;index_code;value;n\nSUBE-KONAK;WBI;80.0;32\n' });
  const dd = detectInstrument(bad, HPTW_2026); assert.equal(dd.indexReconciliation[0]!.ok, false); assert.ok(dd.warnings.some(w => w.includes('mutabakat')));
});
test('T-73: gizli birim (n<5) paketten sayısal değer taşımaz; tanınmayan madde, dağılım/n uyuşmazlığı ve Top Box uyuşmazlığı reddedilir', () => {
  const b = parseBundle(files);
  const small = b.itemResults.filter(r => r.unitId === 'EKIP-KUCUK'); assert.ok(small.length > 0); assert.ok(small.every(r => r.suppressed && r.topBoxPct === undefined));
  assert.throws(() => parseBundle({ ...files, resultsItem: 'unit_id;item_code;n;top_box_pct\nX;YOK-01;10;50\n' }), /unknown_item/);
  assert.throws(() => parseBundle({ ...files, resultsItem: 'unit_id;item_code;n;top_box_pct;c_1;c_2;c_3;c_4;c_5\nX;BAS-01;10;50;1;1;1;1;1\n' }), /distribution_n_mismatch/);
  assert.throws(() => parseBundle({ ...files, resultsItem: 'unit_id;item_code;n;top_box_pct;c_1;c_2;c_3;c_4;c_5\nX;BAS-01;10;90;2;2;2;2;2\n' }), /topbox_mismatch/);
  assert.throws(() => parseBundle({ ...files, instrument: files.instrument.replace('likert5_topbox;positive;work;line_manager;core', 'likert9;positive;work;line_manager;core') }), /invalid_scale/);
});
test('T-74: paneller enstrümandan türetilir — çıkarılan boyutun paneli yok, özel madde paneli var, NPS paneli var', () => {
  const p = derivePanels(parseBundle(files).instrument);
  assert.ok(!p.some(x => x.id === 'dim-DIJ')); assert.ok(p.some(x => x.id === 'dim-GUR')); assert.ok(p.some(x => x.kind === 'custom_items')); assert.ok(p.some(x => x.kind === 'nps'));
  const noNps = derivePanels({ ...HPTW_2026, items: HPTW_2026.items.filter(i => i.scale !== 'nps_0_10') }); assert.ok(!noNps.some(x => x.kind === 'nps'));
});
test('T-75: takip birimi madde — boyut ya da indeks metriğine hedef bağlanamaz', () => {
  assertTrackable('item', 'GUR-03');
  assert.throws(() => assertTrackable('dimension', 'GUR'), /not_item_level/);
  assert.throws(() => assertTrackable('index', 'WBI'), /not_item_level/);
});
test('T-76: aynı boyutun iki maddesi farklı sorumluluk merkezine ve kontrol edilebilirliğe gider (Gurur: GUR-04 işveren markası, GUR-03 kariyer sistemi, GUR-01 yönetici)', () => {
  const g1 = rolesForItem(HPTW_2026.items.find(i => i.code === 'GUR-01')!, 'Konak Şubesi'); const g3 = rolesForItem(HPTW_2026.items.find(i => i.code === 'GUR-03')!, 'Konak Şubesi'); const g4 = rolesForItem(HPTW_2026.items.find(i => i.code === 'GUR-04')!, 'Konak Şubesi');
  assert.equal(g1.interventionOwnerRole, 'Konak Şubesi Müdürü'); assert.ok(g3.interventionOwnerRole.includes('Yetenek')); assert.ok(g4.interventionOwnerRole.includes('Kurumsal İletişim'));
  assert.ok(g1.controllability > g3.controllability && g3.controllability > g4.controllability);
  assert.equal(rolesForItem(HPTW_2026.items.find(i => i.code === 'BAG-01')!, 'Konak Şubesi').targetable, false); // bağlılık sonuçtur, hedef değil
  assert.equal(rolesForItem(HPTW_2026.items.find(i => i.code === 'GUV-04')!, 'Konak Şubesi').interventionOwnerRole, 'Konak Şubesi Müdürü');
  assert.ok(rolesForItem(HPTW_2026.items.find(i => i.code === 'ISG-04')!, 'Konak Şubesi').interventionOwnerRole.includes('Operasyon Planlama'));
});
test('puanlama: Top Box, NPS, kısmi indeks', () => {
  assert.deepEqual(topBoxFromDistribution('likert5_topbox', { counts: { '1': 1, '2': 1, '3': 2, '4': 3, '5': 3 } }), { n: 10, topBoxPct: 60 });
  assert.deepEqual(npsFromDistribution({ counts: { '0': 1, '6': 1, '7': 2, '8': 1, '9': 2, '10': 3 } }), { n: 10, nps: 30 });
  const idx = indexFromItems(['A', 'B', 'C'], { A: 50, B: 70 }); assert.equal(idx.partial, true); assert.deepEqual(idx.missing, ['C']);
  assert.throws(() => topBoxFromDistribution('likert5_topbox', { counts: { '4': -1 } }), /invalid_distribution/);
  assert.equal(parseCsv('a;b\n"x;y";2\n')[0]!.a, 'x;y');
});
