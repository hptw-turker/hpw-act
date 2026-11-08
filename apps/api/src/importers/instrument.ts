import type { Tx } from '../db.js';
import { buildWorkbook } from '../xlsx.js';
import { Report, CODE_RE, requireSheet } from '../validation.js';
import { checkTenantCode, TEMPLATE_VERSION, tenantInfo, type Importer, type ImportCtx, type ValidationResult } from './common.js';
import { HPTW_2026, type InstrumentItem } from '@hpw-act/domain-core';
import { SYSTEM_RULES, SYSTEM_SCALES, metricsForScale } from '../scoring.js';

export const STANDARD = HPTW_2026; // HPW onaylı referans katalog (sürüm etiketleri HPW_ONAYI_BEKLIYOR)
const CORE_CODES = STANDARD.items.filter(i => i.origin === 'core').map(i => i.code);
const TARGET_POLICIES = ['TARGETABLE', 'MONITOR_ONLY', 'REVIEW_REQUIRED'];
const defaultTargetPolicy = (i: InstrumentItem) => (i.responsibilityCenter === 'outcome' || i.responsibilityCenter === 'individual' ? 'MONITOR_ONLY' : 'TARGETABLE');
const normText = (s: string) => s.toLocaleLowerCase('en-US').replace(/\s+/g, ' ').replace(/[.,;:!?'"()]/g, '').trim();

export interface ItemSpec { code: string; origin: 'STANDARD' | 'CUSTOM'; dimensionCode: string | null; text: string; textEn: string | null; scaleCode: string; selection: 'INCLUDED' | 'EXCLUDED'; targetPolicy: string; interactionArea: string; responsibilityCenter: string; leverTags: string[]; equivalence: 'identical' | 'changed' | 'custom'; }
export interface DimSpec { code: string; label: string; module: string; category?: string; order: number; }
export interface InstrumentSpec { instrumentCode: string; version: string; dims: DimSpec[]; items: ItemSpec[]; }

/** Standart katalogdan ve özel maddelerden enstrüman spesifikasyonu (ekran ve Excel aynı yolu kullanır). */
const INTERACTION_AREAS = ['work', 'manager', 'colleagues', 'employer_brand', 'system', 'self', 'outcome'] as const; const RESPONSIBILITY_CENTERS = ['line_manager', 'team', 'hr_policy', 'talent_system', 'central_function', 'top_management', 'employer_brand', 'outcome', 'individual'] as const; // HPW sözlüğü (P1-7): serbest metin kabul edilmez
export function buildSpec(rep: Report, input: { standardItemCodes: string[]; customItems: { code: string; text: string; textEn?: string; dimensionCode?: string; dimensionLabel?: string; scaleCode: string; targetPolicy?: string; interactionArea?: string; responsibilityCenter?: string }[]; overrides?: Record<string, { text?: string; targetPolicy?: string; scaleCode?: string }>; version?: string; instrumentCode?: string }, sheet = 'Maddeler'): InstrumentSpec {
  const items: ItemSpec[] = []; const dims = new Map<string, DimSpec>();
  const std = new Set(input.standardItemCodes);
  for (const code of std) {
    const ref = STANDARD.items.find(i => i.code === code); if (!ref) { rep.error(sheet, null, 'item_code', 'standard_unknown', 'Standart katalogda olmayan madde kodu', code); continue; }
    const ov = input.overrides?.[code] ?? {};
    const text = ov.text?.trim() || ref.text; const eq: ItemSpec['equivalence'] = normText(text) === normText(ref.text) ? 'identical' : 'changed';
    if (eq === 'changed') rep.warn(sheet, null, 'text_tr', 'standard_text_changed', `Standart madde metni katalogdan farklı; sertifikasyon eşdeğerliği için HPW onayı gerekir`, code);
    const scale = ov.scaleCode ?? (ref.scale === 'nps_0_10' ? 'NPS11' : 'L5');
    if (ov.scaleCode && ov.scaleCode !== (ref.scale === 'nps_0_10' ? 'NPS11' : 'L5')) rep.error(sheet, null, 'scale_code', 'standard_scale_changed', 'Standart maddenin ölçeği değiştirilemez; özel madde olarak ekleyin', code);
    const tp = (ov.targetPolicy ?? defaultTargetPolicy(ref)).toLocaleUpperCase('en-US'); if (!TARGET_POLICIES.includes(tp)) rep.error(sheet, null, 'target_policy', 'invalid_target_policy', TARGET_POLICIES.join('/'), tp);
    items.push({ code, origin: 'STANDARD', dimensionCode: ref.dimensionCode ?? null, text, textEn: ref.textEn ?? null, scaleCode: scale, selection: 'INCLUDED', targetPolicy: tp, interactionArea: ref.interactionArea, responsibilityCenter: ref.responsibilityCenter, leverTags: ref.leverTags, equivalence: eq });
    const d = STANDARD.dimensions.find(x => x.code === ref.dimensionCode); if (d && !dims.has(d.code)) dims.set(d.code, { code: d.code, label: d.name, module: d.module.toLocaleUpperCase('en-US'), category: d.category, order: dims.size + 1 });
  }
  const seen = new Set(items.map(i => i.code));
  for (const c of input.customItems) {
    const code = (c.code ?? '').trim();
    if (!CODE_RE.test(code)) { rep.error(sheet, null, 'item_code', 'invalid_code', 'Geçersiz madde kodu', code); continue; }
    if (STANDARD.items.some(i => i.code === code)) { rep.error(sheet, null, 'item_code', 'code_reserved', 'Bu kod standart kataloğa aittir; özel madde için farklı kod', code); continue; }
    if (seen.has(code)) { rep.error(sheet, null, 'item_code', 'duplicate_in_file', 'Aynı madde kodu iki kez', code); continue; }
    if (!c.text || c.text.trim().length < 8) { rep.error(sheet, null, 'text_tr', 'text_required', 'Madde metni en az 8 karakter', code); continue; }
    if (!SYSTEM_SCALES.some(s => s.code === c.scaleCode)) { rep.error(sheet, null, 'scale_code', 'unsupported_scale', `Desteklenen ölçekler: ${SYSTEM_SCALES.map(s => s.code).join(', ')} (çoktan seçmeli, serbest metin ve diğer puanlamalar bu sürümde desteklenmez)`, c.scaleCode); continue; }
    const tp = (c.targetPolicy ?? 'REVIEW_REQUIRED').toLocaleUpperCase('en-US'); if (!TARGET_POLICIES.includes(tp)) { rep.error(sheet, null, 'target_policy', 'invalid_target_policy', TARGET_POLICIES.join('/'), tp); continue; }
    const dimCode = c.dimensionCode?.trim() || null;
    if (dimCode) { if (!CODE_RE.test(dimCode)) { rep.error(sheet, null, 'dimension_code', 'invalid_code', 'Geçersiz boyut kodu', dimCode); continue; } if (!dims.has(dimCode)) { const sd = STANDARD.dimensions.find(x => x.code === dimCode); dims.set(dimCode, sd ? { code: sd.code, label: sd.name, module: sd.module.toLocaleUpperCase('en-US'), category: sd.category, order: dims.size + 1 } : { code: dimCode, label: c.dimensionLabel || dimCode, module: 'CUSTOM', order: dims.size + 1 }); } }
    seen.add(code);
    if (c.interactionArea && !(INTERACTION_AREAS as readonly string[]).includes(c.interactionArea)) { rep.error(sheet, null, 'interaction_area', 'invalid_interaction_area', `Etkileşim alanı HPW sözlüğünden olmalı: ${INTERACTION_AREAS.join(', ')}`, code); continue; }
    if (c.responsibilityCenter && !(RESPONSIBILITY_CENTERS as readonly string[]).includes(c.responsibilityCenter)) { rep.error(sheet, null, 'responsibility_center', 'invalid_responsibility_center', `Sorumluluk merkezi HPW sözlüğünden olmalı: ${RESPONSIBILITY_CENTERS.join(', ')}`, code); continue; }
    items.push({ code, origin: 'CUSTOM', dimensionCode: dimCode, text: c.text.trim(), textEn: c.textEn?.trim() || null, scaleCode: c.scaleCode, selection: 'INCLUDED', targetPolicy: tp, interactionArea: c.interactionArea || 'system', responsibilityCenter: c.responsibilityCenter || 'line_manager', leverTags: [], equivalence: 'custom' });
  }
  if (items.length === 0) rep.error(sheet, null, null, 'empty', 'En az bir madde seçilmeli');
  return { instrumentCode: input.instrumentCode || 'HPTW-CBA', version: input.version || `${new Date().getFullYear()}-v1`, dims: [...dims.values()], items };
}

export function certification(spec: InstrumentSpec): { eligible: boolean; notes: string[] } {
  const notes: string[] = [];
  const inc = new Map(spec.items.filter(i => i.selection === 'INCLUDED').map(i => [i.code, i]));
  const missing = CORE_CODES.filter(c => !inc.has(c)); if (missing.length) notes.push(`Sertifikasyon çekirdeği eksik: ${missing.join(', ')}`);
  const changed = CORE_CODES.filter(c => inc.get(c)?.equivalence === 'changed'); if (changed.length) notes.push(`Standart metin değiştirilmiş (HPW eşdeğerlik onayı gerekli): ${changed.join(', ')}`);
  return { eligible: missing.length === 0 && changed.length === 0, notes };
}

/** Enstrüman sürümünü yayımlar: instrument_version, boyutlar, maddeler, ölçekler, kurallar, madde metrikleri, metrik tanım/sürümleri, indeksler (sabit üyelik). */
export async function publishInstrument(tx: Tx, ctx: ImportCtx, spec: InstrumentSpec): Promise<{ instrumentVersionId: string; certificationEligible: boolean; metricCount: number }> {
  const t = ctx.tenantId;
  let inst = (await tx.query('SELECT id FROM survey_instrument WHERE tenant_id = $1 AND code = $2', [t, spec.instrumentCode])).rows[0];
  if (!inst) inst = (await tx.query('INSERT INTO survey_instrument (tenant_id, code, name) VALUES ($1,$2,$3) RETURNING id', [t, spec.instrumentCode, 'HPTW Çalışan Bağlılığı Araştırması'])).rows[0];
  const existing = (await tx.query('SELECT id FROM instrument_version WHERE tenant_id = $1 AND instrument_id = $2 AND version = $3', [t, inst.id, spec.version])).rows[0];
  if (existing) throw Object.assign(new Error('instrument_version_exists'), { status: 409, code: 'instrument_version_exists', message: `Enstrüman sürümü ${spec.version} zaten yayımlı; yeni sürüm kodu verin` });
  const srv = async (code: string) => { let r = (await tx.query('SELECT id FROM scoring_rule_version WHERE tenant_id = $1 AND code = $2', [t, code])).rows[0]; if (!r) r = (await tx.query('INSERT INTO scoring_rule_version (tenant_id, code, formula, aggregation_method, official_source) VALUES ($1,$2,$3,$4,$5) RETURNING id', [t, code, code, 'weighted_mean', 'hptw'])).rows[0]; return r.id as string; };
  const cert = certification(spec);
  const ivId = (await tx.query('INSERT INTO instrument_version (tenant_id, instrument_id, version, language, scoring_rule_version_id, state, certification_eligible, certification_notes, detection) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id', [t, inst.id, spec.version, 'tr', await srv('HPTW-2026-02'), 'PUBLISHED', cert.eligible, cert.notes, JSON.stringify({ standard: spec.items.filter(i => i.origin === 'STANDARD').length, custom: spec.items.filter(i => i.origin === 'CUSTOM').length, dimensions: spec.dims.length })])).rows[0].id as string;
  for (const d of spec.dims) await tx.query('INSERT INTO instrument_dimension (tenant_id, instrument_version_id, code, name, category, module) VALUES ($1,$2,$3,$4,$5,$6)', [t, ivId, d.code, d.label, d.category ?? null, d.module.toLocaleLowerCase('en-US') === 'core' || d.module.toLocaleLowerCase('en-US') === 'engagement' || d.module.toLocaleLowerCase('en-US') === 'ecosystem' ? d.module.toLocaleLowerCase('en-US') : 'custom']);
  for (const s of SYSTEM_SCALES) await tx.query('INSERT INTO instrument_scale (tenant_id, instrument_version_id, code, label, options) VALUES ($1,$2,$3,$4,$5)', [t, ivId, s.code, s.label, JSON.stringify(s.options)]);
  for (const r of SYSTEM_RULES) await tx.query('INSERT INTO scoring_rule (tenant_id, instrument_version_id, code, scale_code, metric_kind, favorable_options, negative_options, min_output, max_output) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [t, ivId, r.code, r.scaleCode, r.metricKind, r.favorable, r.negative, r.minOutput, r.maxOutput]);
  let metricCount = 0; let order = 0;
  for (const i of spec.items) {
    const scaleDomain = i.scaleCode === 'NPS11' ? 'nps_0_10' : i.scaleCode === 'BIN' ? 'binary' : 'likert5_topbox';
    let md = (await tx.query('SELECT id FROM metric_definition WHERE tenant_id = $1 AND code = $2', [t, i.code])).rows[0];
    if (!md) md = (await tx.query('INSERT INTO metric_definition (tenant_id, organization_id, code, metric_type, dimension, item_code, responsibility_center) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [t, ctx.organizationId, i.code, 'item', i.dimensionCode, i.code, i.responsibilityCenter])).rows[0];
    await tx.query('INSERT INTO instrument_item (tenant_id, instrument_version_id, code, text, text_en, dimension_code, scale, polarity, interaction_area, responsibility_center, origin, lever_tags, metric_definition_id, item_version, scale_code, selection_state, target_policy, equivalence, display_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)',
      [t, ivId, i.code, i.text, i.textEn, i.dimensionCode, scaleDomain, i.scaleCode === 'L5R' ? 'negative' : 'positive', i.interactionArea, i.responsibilityCenter, i.origin === 'STANDARD' ? (CORE_CODES.includes(i.code) ? 'core' : 'module') : 'custom', i.leverTags, md.id, i.origin === 'STANDARD' ? 'HPW_ONAYI_BEKLIYOR' : 'CUSTOM-1', i.scaleCode, i.selection, i.targetPolicy, i.equivalence, ++order]);
    for (const m of metricsForScale(i.scaleCode)) {
      const mcode = `${i.code}${m.suffix}`;
      let mdef = (await tx.query('SELECT id FROM metric_definition WHERE tenant_id = $1 AND code = $2', [t, mcode])).rows[0];
      if (!mdef) mdef = (await tx.query('INSERT INTO metric_definition (tenant_id, organization_id, code, metric_type, dimension, item_code, responsibility_center) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [t, ctx.organizationId, mcode, 'item', i.dimensionCode, i.code, i.responsibilityCenter])).rows[0];
      const ver = (await tx.query('SELECT COALESCE(MAX(version),0)+1 AS v FROM metric_version WHERE tenant_id = $1 AND definition_id = $2', [t, mdef.id])).rows[0].v as number;
      const rule = SYSTEM_RULES.find(r => r.code === m.rule)!;
      // R17: sürümler arası eşdeğerlik referans kataloğa değil ÖNCEKİ sürümdeki soru metnine/ölçeğine göre yazılır
      let comparable: string | null = null;
      if (ver > 1) { const prev = (await tx.query('SELECT ii.text, ii.scale_code FROM item_metric im JOIN instrument_item ii ON ii.tenant_id = im.tenant_id AND ii.instrument_version_id = im.instrument_version_id AND ii.code = im.item_code JOIN metric_version mv ON mv.tenant_id = im.tenant_id AND mv.id = im.metric_version_id WHERE im.tenant_id = $1 AND mv.definition_id = $2 ORDER BY mv.version DESC LIMIT 1', [t, mdef.id])).rows[0]; const norm = (x: string) => x.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').replace(/[.,;:!?'"()]/g, '').trim(); comparable = prev && norm(prev.text) === norm(i.text) && prev.scale_code === i.scaleCode ? 'identical' : prev ? 'changed' : 'changed'; }
      const mv = (await tx.query('INSERT INTO metric_version (tenant_id, definition_id, version, label, scoring_rule_version_id, scale_min, scale_max, comparable_to_previous, effective_from) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE) RETURNING id', [t, mdef.id, ver, `${i.code} ${m.suffix.slice(1)} · ${spec.version}`, await srv(m.rule), rule.minOutput, rule.maxOutput, comparable])).rows[0].id;
      await tx.query('INSERT INTO item_metric (tenant_id, instrument_version_id, metric_code, item_code, rule_code, direction, metric_version_id) VALUES ($1,$2,$3,$4,$5,$6,$7)', [t, ivId, mcode, i.code, m.rule, 'HIGHER_BETTER', mv]);
      metricCount++;
    }
  }
  for (const idx of STANDARD.indices.filter(x => x.purpose === 'certification')) {
    await tx.query('INSERT INTO instrument_index (tenant_id, instrument_version_id, code, name, rule, purpose) VALUES ($1,$2,$3,$4,$5,$6)', [t, ivId, idx.code, idx.name, idx.rule, idx.purpose]);
    for (const mcode of idx.members) if (spec.items.some(i => i.code === mcode)) await tx.query('INSERT INTO instrument_index_member (tenant_id, instrument_version_id, index_code, item_code) VALUES ($1,$2,$3,$4)', [t, ivId, idx.code, mcode]);
  }
  return { instrumentVersionId: ivId, certificationEligible: cert.eligible, metricCount };
}

export const instrumentImporter: Importer = {
  kind: 'instrument',
  async template(tx, ctx) {
    const t = await tenantInfo(tx, ctx.tenantId);
    const ver = (await tx.query('SELECT COUNT(*)::int AS c FROM instrument_version WHERE tenant_id = $1', [ctx.tenantId])).rows[0].c as number;
    return buildWorkbook({
      title: 'HPW Act | Standart ve ek sorular şablonu', version: TEMPLATE_VERSION,
      guide: ['Standart maddeler HPW onaylı katalogdan gelir (Maddeler sayfasında origin=STANDARD, dolu). Anketinizde olmayan standart maddeyi selection_state=EXCLUDED yapın; metnini değiştirmeyin (değiştirilirse sertifikasyon için HPW onayı gerekir).', 'Ek soru için yeni satır: origin=CUSTOM, kendi kodunuz (standart kodlar kullanılamaz), text_tr, scale_code (L5 olumlu beşli, L5R ters beşli, NPS11 0–10, BIN evet/hayır), isteğe bağlı dimension_code (yeni boyut için Boyutlar sayfasına ekleyin), target_policy.', 'Desteklenmeyen ölçek (çoktan seçmeli, açık uçlu, farklı puanlama) bu sürümde reddedilir; sistem "custom" yazınca her ölçeği destekliyor iddiasında değildir.', 'Bu dosya anket dağıtmaz; HPW\'de uygulanan anketin sonuçlarını okuyabilmek için tanımını yönetir. Sorumlu merkez öneridir; şirket yetki haritasıyla onaylanır.', 'Formül girmeyin; yalnız değer.'],
      sheets: [
        { name: 'Enstruman', columns: [{ key: 'tenant_code', header: 'tenant_code' }, { key: 'instrument_code', header: 'instrument_code' }, { key: 'instrument_version', header: 'instrument_version' }], rows: [{ tenant_code: t.code, instrument_code: 'HPTW-CBA', instrument_version: `${new Date().getFullYear()}-v${ver + 1}` }] },
        { name: 'Boyutlar', columns: [{ key: 'tenant_code', header: 'tenant_code' }, { key: 'dimension_code', header: 'dimension_code' }, { key: 'label', header: 'label', width: 34 }, { key: 'module_code', header: 'module_code', list: ['CORE', 'ENGAGEMENT', 'ECOSYSTEM', 'CUSTOM'] }, { key: 'display_order', header: 'display_order' }], rows: STANDARD.dimensions.map((d, i) => ({ tenant_code: t.code, dimension_code: d.code, label: d.name, module_code: d.module.toLocaleUpperCase('en-US'), display_order: i + 1 })) },
        { name: 'Maddeler', columns: [{ key: 'tenant_code', header: 'tenant_code' }, { key: 'item_code', header: 'item_code' }, { key: 'origin', header: 'origin', list: ['STANDARD', 'CUSTOM'] }, { key: 'dimension_code', header: 'dimension_code' }, { key: 'text_tr', header: 'text_tr', width: 70 }, { key: 'text_en', header: 'text_en', width: 50 }, { key: 'scale_code', header: 'scale_code', list: ['L5', 'L5R', 'NPS11', 'BIN'] }, { key: 'selection_state', header: 'selection_state', list: ['INCLUDED', 'EXCLUDED'] }, { key: 'target_policy', header: 'target_policy', list: TARGET_POLICIES }, { key: 'responsibility_center', header: 'responsibility_center', list: [...RESPONSIBILITY_CENTERS] }, { key: 'interaction_area', header: 'interaction_area', list: [...INTERACTION_AREAS] }], rows: STANDARD.items.map(i => ({ tenant_code: t.code, item_code: i.code, origin: 'STANDARD', dimension_code: i.dimensionCode ?? '', text_tr: i.text, text_en: i.textEn ?? '', scale_code: i.scale === 'nps_0_10' ? 'NPS11' : 'L5', selection_state: 'INCLUDED', target_policy: defaultTargetPolicy(i), responsibility_center: i.responsibilityCenter, interaction_area: i.interactionArea })) },
        { name: 'Olcekler_Bilgi', columns: [{ key: 'scale_code', header: 'scale_code' }, { key: 'label', header: 'label', width: 40 }, { key: 'options', header: 'options', width: 50 }, { key: 'rules', header: 'rules', width: 40 }], rows: SYSTEM_SCALES.map(s => ({ scale_code: s.code, label: s.label, options: s.options.map(o => `${o.code}=${o.label}`).join(' | '), rules: SYSTEM_RULES.filter(r => r.scaleCode === s.code).map(r => `${r.code} (${r.metricKind}${r.favorable.length ? ' olumlu ' + r.favorable.join('|') : ''})`).join(' ; ') })) },
      ],
      dictionary: [
        { sheet: 'Maddeler', field: 'item_code', desc: 'Standart maddede katalog kodu; özel maddede sizin kodunuz (harf, rakam, _ . -).', req: 'Zorunlu', type: 'kod' },
        { sheet: 'Maddeler', field: 'interaction_area', desc: `Özel maddenin etkileşim alanı (HPW sözlüğü): ${INTERACTION_AREAS.join(' | ')}. Serbest metin kabul edilmez.`, req: 'Özel maddede zorunlu', type: 'liste' },
        { sheet: 'Maddeler', field: 'responsibility_center', desc: `Sorumluluk merkezi (HPW sözlüğü): ${RESPONSIBILITY_CENTERS.join(' | ')}. Şirketin onaylı Sorumluluk Haritası aday rolleri belirler.`, req: 'Özel maddede zorunlu', type: 'liste' },
        { sheet: 'Maddeler', field: 'scale_code', desc: 'L5 olumlu beşli (Top Box 4|5), L5R ters beşli (olumlu 1|2), NPS11 0–10 (Top Box 9|10 ve NPS), BIN evet/hayır.', req: 'Zorunlu', type: 'seçim', allowed: 'L5 / L5R / NPS11 / BIN' },
        { sheet: 'Maddeler', field: 'selection_state', desc: 'INCLUDED anketinizde var; EXCLUDED yok. Çekirdek 15 madde eksikse sertifikasyon kartı yayımlanmaz.', req: 'Zorunlu', type: 'seçim', allowed: 'INCLUDED / EXCLUDED' },
        { sheet: 'Maddeler', field: 'target_policy', desc: 'TARGETABLE hedef konabilir; MONITOR_ONLY yalnız izlenir (sonuç göstergesi); REVIEW_REQUIRED metodoloji incelemesinden sonra.', req: 'Zorunlu', type: 'seçim', allowed: TARGET_POLICIES.join(' / ') },
      ],
    });
  },
  async validate(sheets, tx, ctx): Promise<ValidationResult> {
    const rep = new Report(); checkTenantCode(sheets, ctx, rep, ['Enstruman', 'Boyutlar', 'Maddeler']);
    if (!requireSheet(sheets, 'Maddeler', ['item_code', 'origin', 'text_tr', 'scale_code', 'selection_state'], rep)) return { report: rep, payload: {}, preview: {}, rowCount: 0, templateVersion: TEMPLATE_VERSION };
    const ins = sheets['Enstruman']?.rows[0]?.cells ?? {};
    const version = ins['instrument_version'] || `${new Date().getFullYear()}-v1`;
    if ((await tx.query('SELECT 1 FROM instrument_version WHERE tenant_id = $1 AND version = $2', [ctx.tenantId, version])).rowCount) rep.error('Enstruman', 2, 'instrument_version', 'instrument_version_exists', 'Bu sürüm zaten yayımlı; yeni sürüm kodu verin', version);
    const dimLabels = new Map<string, string>(); for (const r of sheets['Boyutlar']?.rows ?? []) if (r.cells['dimension_code']) dimLabels.set(r.cells['dimension_code'], r.cells['label'] || r.cells['dimension_code']);
    const standardCodes: string[] = []; const overrides: Record<string, { text?: string; targetPolicy?: string; scaleCode?: string }> = {}; const custom: Parameters<typeof buildSpec>[1]['customItems'] = [];
    for (const r of sheets['Maddeler']!.rows) {
      const c = r.cells; const origin = (c['origin'] ?? '').toLocaleUpperCase('en-US'); const sel = (c['selection_state'] || 'INCLUDED').toLocaleUpperCase('en-US');
      if (!['STANDARD', 'CUSTOM'].includes(origin)) { rep.error('Maddeler', r.n, 'origin', 'invalid_origin', 'STANDARD ya da CUSTOM', origin); continue; }
      if (!['INCLUDED', 'EXCLUDED'].includes(sel)) { rep.error('Maddeler', r.n, 'selection_state', 'invalid_selection', 'INCLUDED ya da EXCLUDED', sel); continue; }
      if (sel === 'EXCLUDED') continue;
      if (origin === 'STANDARD') { standardCodes.push(c['item_code']!); overrides[c['item_code']!] = { text: c['text_tr'], targetPolicy: c['target_policy'] || undefined, scaleCode: c['scale_code'] || undefined }; }
      else custom.push({ code: c['item_code']!, text: c['text_tr'] ?? '', textEn: c['text_en'], dimensionCode: c['dimension_code'], dimensionLabel: dimLabels.get(c['dimension_code'] ?? ''), scaleCode: (c['scale_code'] ?? '').toLocaleUpperCase('en-US'), targetPolicy: c['target_policy'] || undefined, interactionArea: c['interaction_area'] || undefined, responsibilityCenter: c['responsibility_center'] || undefined });
    }
    const spec = buildSpec(rep, { standardItemCodes: standardCodes, customItems: custom, overrides, version, instrumentCode: ins['instrument_code'] || 'HPTW-CBA' });
    const cert = certification(spec);
    return { report: rep, payload: spec as unknown as Record<string, unknown>, preview: { version, standard: spec.items.filter(i => i.origin === 'STANDARD').length, custom: spec.items.filter(i => i.origin === 'CUSTOM').length, dimensions: spec.dims.length, certificationEligible: cert.eligible, certificationNotes: cert.notes, metrics: spec.items.reduce((s, i) => s + metricsForScale(i.scaleCode).length, 0) }, rowCount: spec.items.length, templateVersion: TEMPLATE_VERSION };
  },
  async commit(payload, tx, ctx) { const r = await publishInstrument(tx, ctx, payload as unknown as InstrumentSpec); return { applied: r }; },
};
