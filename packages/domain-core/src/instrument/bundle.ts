/** Sonuç paketi (HPW Act Result Bundle v1): sistem bu formatı algılar, enstrümanı çıkarır, panelleri türetir.
    Dosyalar: manifest.json, instrument.csv, results_item.csv, benchmarks.csv (isteğe bağlı), results_index.csv (isteğe bağlı; resmî HPTW değerleriyle mutabakat). */
import type { InstrumentDimension, InstrumentIndex, InstrumentItem, InstrumentVersion, ItemScale, InteractionArea, ResponsibilityCenter, MetricKind } from './types.js';
import { indexFromItems, topBoxFromDistribution } from './scoring.js';
import { invalid, isFiniteNumber } from '../errors.js';

export interface BundleManifest { format: 'hpw-act-result-bundle'; formatVersion: '1'; tenantCode: string; cycleCode: string; instrumentCode: string; instrumentVersion: string; scoringRuleVersion: string; language: string; exportedAt: string; benchmarkSets?: string[]; }
export interface ItemResultRow { unitId: string; itemCode: string; n: number; topBoxPct?: number; distribution?: Record<string, number>; aggregationWeight?: number; suppressed?: boolean; }
export interface IndexResultRow { unitId: string; indexCode: string; value: number; n: number; }
export interface BenchmarkRow { metricCode: string; set: string; value: number; }
export interface ResultBundle { manifest: BundleManifest; instrument: InstrumentVersion; itemResults: ItemResultRow[]; indexResults: IndexResultRow[]; benchmarks: BenchmarkRow[]; }
export interface BundleFiles { manifest: string; instrument: string; resultsItem: string; benchmarks?: string; resultsIndex?: string; }

const SCALES: ItemScale[] = ['likert5_topbox', 'likert5_mean', 'nps_0_10', 'binary', 'custom'];
const AREAS: InteractionArea[] = ['work', 'manager', 'colleagues', 'employer_brand', 'system', 'self', 'outcome'];
const CENTERS: ResponsibilityCenter[] = ['line_manager', 'team', 'hr_policy', 'talent_system', 'central_function', 'top_management', 'employer_brand', 'outcome', 'individual'];

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const split = (l: string) => { const out: string[] = []; let cur = ''; let q = false; for (let i = 0; i < l.length; i++) { const c = l[i]!; if (c === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (c === ';' && !q) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out.map(s => s.trim()); };
  const head = split(lines[0]!);
  return lines.slice(1).map((l, i) => { const cells = split(l); if (cells.length !== head.length) throw invalid('csv_shape', `Satır ${i + 2}: ${cells.length} sütun, başlık ${head.length}`); return Object.fromEntries(head.map((h, j) => [h, cells[j]!])); });
}

export function parseBundle(files: BundleFiles): ResultBundle {
  let manifest: BundleManifest;
  try { manifest = JSON.parse(files.manifest) as BundleManifest; } catch { throw invalid('manifest_invalid', 'manifest.json çözümlenemedi'); }
  if (manifest.format !== 'hpw-act-result-bundle' || manifest.formatVersion !== '1') throw invalid('manifest_format', 'Tanınmayan paket biçimi');
  for (const k of ['tenantCode', 'cycleCode', 'instrumentCode', 'instrumentVersion', 'scoringRuleVersion'] as const) if (!manifest[k]) throw invalid('manifest_missing', `manifest.${k} eksik`);
  // enstrüman
  const rows = parseCsv(files.instrument);
  const req = ['item_code', 'text', 'dimension_code', 'dimension_name', 'module', 'scale', 'polarity', 'interaction_area', 'responsibility_center', 'origin'];
  for (const r of req) if (rows.length && !(r in rows[0]!)) throw invalid('instrument_columns', `instrument.csv sütunu eksik: ${r}`);
  const items: InstrumentItem[] = []; const dims = new Map<string, InstrumentDimension>(); const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.item_code!)) throw invalid('duplicate_item', `Madde kodu tekrar: ${r.item_code}`); seen.add(r.item_code!);
    if (!SCALES.includes(r.scale as ItemScale)) throw invalid('invalid_scale', `Ölçek geçersiz: ${r.item_code} ${r.scale}`);
    if (!AREAS.includes(r.interaction_area as InteractionArea)) throw invalid('invalid_area', `Etkileşim alanı geçersiz: ${r.item_code}`);
    if (!CENTERS.includes(r.responsibility_center as ResponsibilityCenter)) throw invalid('invalid_center', `Sorumluluk merkezi geçersiz: ${r.item_code}`);
    if (r.dimension_code) dims.set(r.dimension_code, { code: r.dimension_code, name: r.dimension_name || r.dimension_code, module: (r.module as InstrumentDimension['module']) || 'custom', ...(r.category ? { category: r.category } : {}) });
    items.push({ code: r.item_code!, text: r.text!, ...(r.text_en ? { textEn: r.text_en } : {}), ...(r.dimension_code ? { dimensionCode: r.dimension_code } : {}), scale: r.scale as ItemScale, polarity: (r.polarity as 'positive' | 'negative') || 'positive', interactionArea: r.interaction_area as InteractionArea, responsibilityCenter: r.responsibility_center as ResponsibilityCenter, origin: (r.origin as InstrumentItem['origin']) || 'custom', leverTags: (r.lever_tags ?? '').split('|').filter(Boolean) });
  }
  if (items.length === 0) throw invalid('instrument_empty', 'instrument.csv boş');
  const indices: InstrumentIndex[] = [];
  const indexRows = rows.filter(r => r.index_codes);
  const idxMap = new Map<string, string[]>();
  for (const r of indexRows) for (const ic of r.index_codes!.split('|').filter(Boolean)) idxMap.set(ic, [...(idxMap.get(ic) ?? []), r.item_code!]);
  for (const [code, members] of idxMap) indices.push({ code, name: code, rule: 'mean_of_items', members, purpose: code === 'WBI' || code === 'ENG' ? 'certification' : 'report' });
  const instrument: InstrumentVersion = { instrumentCode: manifest.instrumentCode, version: manifest.instrumentVersion, language: manifest.language ?? 'tr', scoringRuleVersion: manifest.scoringRuleVersion, dimensions: [...dims.values()], items, indices };
  // madde sonuçları
  const itemResults: ItemResultRow[] = []; const seenKeys = new Set<string>();
  for (const r of parseCsv(files.resultsItem)) {
    const dupKey = `${r.unit_id}|${r.item_code}`; if (seenKeys.has(dupKey)) throw invalid('duplicate_result', `results_item.csv: ${dupKey} iki kez`); seenKeys.add(dupKey);
    if (!r.unit_id) throw invalid('missing_unit', `results_item.csv: unit_id boş (${r.item_code})`);
    const item = items.find(i => i.code === r.item_code); if (!item) throw invalid('unknown_item', `results_item.csv: enstrümanda olmayan madde ${r.item_code}`);
    const n = Number(r.n); if (!Number.isInteger(n) || n < 0) throw invalid('invalid_n', `n geçersiz: ${r.unit_id}/${r.item_code}`);
    const distKeys = Object.keys(r).filter(k => /^c_\d+$/.test(k) && r[k] !== '');
    const row: ItemResultRow = { unitId: r.unit_id!, itemCode: r.item_code!, n };
    const suppressed = r.suppressed === 'true' || n < 5;
    const hasDistCols = Object.keys(r).some(k => /^c_\d+$/.test(k) && r[k] !== '');
    if (suppressed && (hasDistCols || (r.top_box_pct !== undefined && r.top_box_pct !== ''))) throw invalid('suppressed_data_present', `${r.unit_id}/${r.item_code}: gizli hücre (n<5 ya da suppressed) sayı ya da dağılım taşıyamaz`);
    if (r.top_box_pct !== undefined && r.top_box_pct !== '' && !Number.isFinite(Number(r.top_box_pct))) throw invalid('invalid_topbox', `${r.unit_id}/${r.item_code}: top_box_pct sayısal değil`);
    if (distKeys.length) {
      row.distribution = Object.fromEntries(distKeys.map(k => [k.slice(2), Number(r[k])]));
      const tb = topBoxFromDistribution(item.scale, { counts: row.distribution }, item.polarity);
      if (tb.n !== n) throw invalid('distribution_n_mismatch', `${r.unit_id}/${r.item_code}: dağılım toplamı ${tb.n} ≠ n ${n}`);
      if (r.top_box_pct !== undefined && r.top_box_pct !== '' && Math.abs(Number(r.top_box_pct) - tb.topBoxPct) > 0.15) throw invalid('topbox_mismatch', `${r.unit_id}/${r.item_code}: verilen ${r.top_box_pct} ≠ hesaplanan ${tb.topBoxPct}`);
      row.topBoxPct = tb.topBoxPct;
    } else if (r.top_box_pct !== undefined && r.top_box_pct !== '') { const v = Number(r.top_box_pct); if (!isFiniteNumber(v) || v < 0 || v > 100) throw invalid('out_of_scale', `top_box_pct ölçek dışı: ${r.unit_id}/${r.item_code}`); row.topBoxPct = v; }
    if (r.aggregation_weight !== undefined && r.aggregation_weight !== '') { const w = Number(r.aggregation_weight); if (!isFiniteNumber(w) || w < 0) throw invalid('invalid_weight', `ağırlık geçersiz: ${r.unit_id}/${r.item_code}`); row.aggregationWeight = w; }
    row.suppressed = suppressed; // gizlilik n'den; bayrak yalnız daha kısıtlayıcı; gizli satır sayı/dağılım taşıyamaz (yukarıda reddedilir)
    itemResults.push(row);
  }
  const indexResults: IndexResultRow[] = files.resultsIndex ? parseCsv(files.resultsIndex).map(r => ({ unitId: r.unit_id!, indexCode: r.index_code!, value: Number(r.value), n: Number(r.n) })) : [];
  const benchmarks: BenchmarkRow[] = files.benchmarks ? parseCsv(files.benchmarks).map(r => ({ metricCode: r.metric_code!, set: r.set!, value: Number(r.value) })) : [];
  return { manifest, instrument, itemResults, indexResults, benchmarks };
}

/** Enstrüman algılama: referans enstrümana göre hangi boyutlar var / çıkarılmış, hangi maddeler özel, hangi modüller açık. */
export interface DetectionSummary {
  instrumentCode: string; version: string; itemCount: number; dimensionCount: number;
  modules: { core: number; engagement: number; ecosystem: number; custom: number };
  removedDimensions: { code: string; name: string }[]; customItems: { code: string; text: string; dimensionCode?: string }[]; scales: Record<string, number>;
  indexReconciliation: { indexCode: string; unitId: string; official: number; computed: number | null; delta: number | null; ok: boolean }[];
  warnings: string[];
}
export function detectInstrument(bundle: ResultBundle, reference: InstrumentVersion): DetectionSummary {
  const inst = bundle.instrument; const warnings: string[] = [];
  const refDimCodes = new Set(reference.dimensions.map(d => d.code)); const dimCodes = new Set(inst.dimensions.map(d => d.code));
  const removedDimensions = reference.dimensions.filter(d => !dimCodes.has(d.code)).map(d => ({ code: d.code, name: d.name }));
  const refItems = new Set(reference.items.map(i => i.code));
  const customItems = inst.items.filter(i => !refItems.has(i.code) || i.origin === 'custom').map(i => ({ code: i.code, text: i.text, ...(i.dimensionCode ? { dimensionCode: i.dimensionCode } : {}) }));
  const coreRef = reference.items.filter(i => i.origin === 'core').map(i => i.code); const present = new Set(inst.items.map(i => i.code));
  const missingCore = coreRef.filter(c => !present.has(c)); if (missingCore.length) warnings.push(`Sertifikasyon çekirdeği eksik: ${missingCore.join(', ')}`);
  const modules = { core: inst.items.filter(i => i.origin === 'core').length, engagement: inst.items.filter(i => i.dimensionCode === 'BAG').length, ecosystem: inst.items.filter(i => i.origin === 'module' && i.dimensionCode !== 'BAG').length, custom: inst.items.filter(i => i.origin === 'custom').length };
  const scales: Record<string, number> = {}; for (const i of inst.items) scales[i.scale] = (scales[i.scale] ?? 0) + 1;
  for (const d of inst.dimensions) if (!refDimCodes.has(d.code) && d.module !== 'custom') warnings.push(`Referansta olmayan boyut modül olarak işaretli: ${d.code}`);
  // indeks mutabakatı (T-57'nin madde düzeyi): resmî değer ile madde ortalaması ≤ 0,15 farkla eşleşmeli
  const indexReconciliation: DetectionSummary['indexReconciliation'] = [];
  for (const ir of bundle.indexResults) {
    const idx = inst.indices.find(x => x.code === ir.indexCode) ?? reference.indices.find(x => x.code === ir.indexCode);
    if (!idx) { warnings.push(`Bilinmeyen indeks: ${ir.indexCode}`); continue; }
    const members = idx.members.length ? idx.members : inst.items.filter(i => i.dimensionCode !== 'BAG' || idx.code === 'OVERALL').map(i => i.code);
    const values: Record<string, number | undefined> = {}; for (const c of members) values[c] = bundle.itemResults.find(r => r.unitId === ir.unitId && r.itemCode === c)?.topBoxPct;
    const c = indexFromItems(members, values);
    const delta = c.value === null ? null : Math.round((ir.value - c.value) * 100) / 100;
    indexReconciliation.push({ indexCode: ir.indexCode, unitId: ir.unitId, official: ir.value, computed: c.value, delta, ok: delta !== null && Math.abs(delta) <= 0.15 && !c.partial });
  }
  if (indexReconciliation.some(x => !x.ok)) warnings.push('İndeks mutabakatı başarısız: resmî toplama kuralı ya da eksik madde; içe alma yayımlanamaz');
  return { instrumentCode: inst.instrumentCode, version: inst.version, itemCount: inst.items.length, dimensionCount: inst.dimensions.length, modules, removedDimensions, customItems, scales, indexReconciliation, warnings };
}

/** Panel türetme: enstrümandan hangi panellerin kurulacağı. Boyut yoksa boyut paneli yok; NPS maddesi yoksa NPS paneli yok; özel maddeler ayrı panelde. */
export interface PanelSpec { id: string; kind: 'item_table' | 'dimension_summary' | 'heatmap_unit_item' | 'nps' | 'custom_items' | 'index_card' | 'responsibility_map' | 'interaction_areas'; title: string; metricCodes: string[]; note?: string; }
export function derivePanels(inst: InstrumentVersion): PanelSpec[] {
  const panels: PanelSpec[] = [];
  for (const idx of inst.indices.filter(i => i.purpose === 'certification')) panels.push({ id: `index-${idx.code}`, kind: 'index_card', title: idx.name, metricCodes: idx.members, note: 'sertifikasyon; yalnız görünüm ve projeksiyon, takip birimi değil' });
  for (const d of inst.dimensions) { const codes = inst.items.filter(i => i.dimensionCode === d.code).map(i => i.code); if (codes.length) panels.push({ id: `dim-${d.code}`, kind: 'item_table', title: d.name, metricCodes: codes, ...(d.module === 'ecosystem' ? { note: 'teşhis modülü' } : {}) }); }
  if (inst.dimensions.length >= 2) panels.push({ id: 'dim-summary', kind: 'dimension_summary', title: 'Boyut özeti (türetilmiş)', metricCodes: inst.dimensions.map(d => d.code), note: 'boyut ortalaması boyut içi yayılımı gizler; karar madde düzeyinde' });
  panels.push({ id: 'heatmap', kind: 'heatmap_unit_item', title: 'Birim × madde ısı haritası', metricCodes: inst.items.map(i => i.code) });
  if (inst.items.some(i => i.scale === 'nps_0_10')) panels.push({ id: 'nps', kind: 'nps', title: 'Tavsiye (NPS)', metricCodes: inst.items.filter(i => i.scale === 'nps_0_10').map(i => i.code) });
  const custom = inst.items.filter(i => i.origin === 'custom'); if (custom.length) panels.push({ id: 'custom', kind: 'custom_items', title: 'Şirkete özel maddeler', metricCodes: custom.map(i => i.code), note: 'benchmark yok' });
  panels.push({ id: 'responsibility', kind: 'responsibility_map', title: 'Sorumluluk merkezine göre maddeler', metricCodes: inst.items.map(i => i.code) });
  panels.push({ id: 'areas', kind: 'interaction_areas', title: 'Dört etkileşim alanı', metricCodes: inst.items.filter(i => ['work', 'manager', 'colleagues', 'employer_brand'].includes(i.interactionArea)).map(i => i.code) });
  return panels;
}

/** Takip birimi maddedir: hedef, aksiyon, kanıt ve sonuç yalnız 'item' metriğine bağlanır. */
export function assertTrackable(kind: MetricKind, itemCode?: string): void {
  if (kind !== 'item') throw invalid('not_item_level', `Takip yalnız madde düzeyinde: ${kind}${itemCode ? ' ' + itemCode : ''}`);
}
