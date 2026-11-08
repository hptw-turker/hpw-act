import type { Tx } from '../db.js';
import { buildWorkbook, isoDate, type Sheet } from '../xlsx.js';
import { Report, CODE_RE, requireSheet } from '../validation.js';
import { config } from '../config.js';
import { checkTenantCode, TEMPLATE_VERSION, tenantInfo, type Importer, type ImportCtx, type ValidationResult } from './common.js';

const PROFILES = ['HR_ADMIN', 'HR_PARTNER', 'EXEC', 'REGION_MANAGER', 'UNIT_MANAGER', 'ACTION_OWNER', 'VIEWER'];
const PURPOSES = ['SURVEY_ROLLUP', 'RESPONSIBILITY', 'GEOGRAPHIC', 'OTHER'];
const OPS = ['CREATE', 'UPDATE', 'CLOSE'];
type UnitRow = { headcount?: number | null; op: string; code: string; name: string; type: string; timezone: string; from: string; to: string | null; row: number };
type RelRow = { op: string; hierarchy: string; child: string; parent: string; type: string; from: string; to: string | null; row: number };
type RoleRow = { op: string; code: string; unit: string; title: string; profile: string; from: string; to: string | null; row: number };

export const orgImporter: Importer = {
  kind: 'org',
  unitsAffected(payload) { const p = payload as { units?: { code: string; op: string }[]; rels?: { child?: string; parent?: string }[]; roles?: { unit: string }[] }; const set = new Set<string>(); for (const u of p.units ?? []) set.add(u.op === 'CREATE' ? '*' : u.code); for (const r of p.rels ?? []) { if (r.parent) set.add(r.parent); if (r.child) set.add(r.child); } for (const r of p.roles ?? []) set.add(r.unit); return [...set]; },
  grantsRequired(payload) { const p = payload as { roles?: { profile?: string; permissionProfile?: string; permission_profile?: string }[] }; return [...new Set((p.roles ?? []).map(r => r.profile ?? r.permissionProfile ?? r.permission_profile ?? '').filter(x => x && x !== 'VIEWER'))]; },
  async template(tx, ctx) {
    const t = await tenantInfo(tx, ctx.tenantId);
    const types = (await tx.query('SELECT code, label FROM unit_type WHERE tenant_id = $1 ORDER BY code', [ctx.tenantId])).rows;
    const units = (await tx.query('SELECT external_id, name, unit_type, timezone, effective_from, effective_to FROM org_unit WHERE tenant_id = $1 AND external_id IS NOT NULL ORDER BY external_id', [ctx.tenantId])).rows;
    const hier = (await tx.query('SELECT code, name, purpose FROM hierarchy_group WHERE tenant_id = $1 ORDER BY code', [ctx.tenantId])).rows;
    const rels = (await tx.query(`SELECT h.code AS hierarchy, c.external_id AS child, p.external_id AS parent, r.relationship_type, r.effective_from, r.effective_to FROM org_relationship r JOIN hierarchy_group h ON h.tenant_id = r.tenant_id AND h.id = r.hierarchy_group_id JOIN org_unit c ON c.tenant_id = r.tenant_id AND c.id = r.from_unit_id JOIN org_unit p ON p.tenant_id = r.tenant_id AND p.id = r.to_unit_id WHERE r.tenant_id = $1 AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to > CURRENT_DATE) ORDER BY h.code, c.external_id`, [ctx.tenantId])).rows;
    const roles = (await tx.query(`SELECT r.code, u.external_id AS unit, r.title, r.permission_profile, r.effective_from, r.effective_to FROM org_role r JOIN org_unit u ON u.tenant_id = r.tenant_id AND u.id = r.unit_id WHERE r.tenant_id = $1 AND r.code IS NOT NULL ORDER BY r.code`, [ctx.tenantId])).rows;
    const d = (s: unknown) => (s instanceof Date ? s.toISOString().slice(0, 10) : (s ?? ''));
    return buildWorkbook({
      title: 'HPW Act | Şirket ve organizasyon şablonu', version: TEMPLATE_VERSION,
      guide: ['Bu dosya bir DEĞİŞİKLİK dosyasıdır: yalnız operation sütunu dolu satırlar işlenir (CREATE / UPDATE / CLOSE). Dosyada olmayan birimler kapanmış sayılmaz.', 'Mevcut kayıtlar bilgi için doldurulmuştur; değiştirmek için operation=UPDATE, kapatmak için CLOSE yazın.', 'Silme yoktur; kapanış tarihiyle kapatılır. Kod değişikliği ayrı bir eşleme işlemidir; kodu değiştirmek yerine yeni kod ile CREATE ve eski kod ile CLOSE yapın.', 'Formül girmeyin; yalnız değer. Tarihler YYYY-AA-GG. tenant_code bir kontrol alanıdır, yetki vermez.', 'Birim tipleri ve unvanlar şirkete özeldir; permission_profile uygulamanın yetki profilidir ve müşteri unvanından bağımsızdır.'],
      sheets: [
        { name: 'Sirket', columns: [{ key: 'tenant_code', header: 'tenant_code' }, { key: 'company_name', header: 'company_name', width: 30 }, { key: 'locale', header: 'locale' }, { key: 'timezone', header: 'timezone' }], rows: [{ tenant_code: t.code, company_name: t.name, locale: t.locale, timezone: t.timezone }] },
        { name: 'Birim_Tipleri', columns: [{ key: 'tenant_code', header: 'tenant_code' }, { key: 'unit_type_code', header: 'unit_type_code' }, { key: 'label', header: 'label', width: 30 }], rows: types.length ? types.map(x => ({ tenant_code: t.code, unit_type_code: x.code, label: x.label })) : [{ tenant_code: t.code, unit_type_code: 'ROOT', label: 'Genel Merkez' }, { tenant_code: t.code, unit_type_code: 'REGION', label: 'Bölge' }, { tenant_code: t.code, unit_type_code: 'SITE', label: 'Şube' }] },
        { name: 'Birimler', columns: [{ key: 'tenant_code', header: 'tenant_code' }, { key: 'operation', header: 'operation', list: OPS }, { key: 'unit_code', header: 'unit_code' }, { key: 'unit_name', header: 'unit_name', width: 34 }, { key: 'unit_type_code', header: 'unit_type_code' }, { key: 'timezone', header: 'timezone' }, { key: 'valid_from', header: 'valid_from' }, { key: 'valid_to', header: 'valid_to' }, { key: 'headcount', header: 'headcount' }], rows: units.map(u => ({ tenant_code: t.code, operation: '', unit_code: u.external_id, unit_name: u.name, unit_type_code: u.unit_type, timezone: u.timezone, valid_from: d(u.effective_from), valid_to: d(u.effective_to) })) },
        { name: 'Hiyerarsiler', columns: [{ key: 'tenant_code', header: 'tenant_code' }, { key: 'hierarchy_code', header: 'hierarchy_code' }, { key: 'label', header: 'label', width: 30 }, { key: 'purpose', header: 'purpose', list: PURPOSES }], rows: hier.length ? hier.map(h => ({ tenant_code: t.code, hierarchy_code: h.code, label: h.name, purpose: h.purpose })) : [{ tenant_code: t.code, hierarchy_code: 'SURVEY', label: 'Anket toplama ağacı', purpose: 'SURVEY_ROLLUP' }] },
        { name: 'Iliskiler', columns: [{ key: 'tenant_code', header: 'tenant_code' }, { key: 'operation', header: 'operation', list: ['CREATE', 'CLOSE'] }, { key: 'hierarchy_code', header: 'hierarchy_code' }, { key: 'child_unit', header: 'child_unit' }, { key: 'parent_unit', header: 'parent_unit' }, { key: 'relation_type', header: 'relation_type', list: ['REPORTS_TO', 'SUPPORTS'] }, { key: 'valid_from', header: 'valid_from' }, { key: 'valid_to', header: 'valid_to' }], rows: rels.map(r => ({ tenant_code: t.code, operation: '', hierarchy_code: r.hierarchy, child_unit: r.child, parent_unit: r.parent, relation_type: r.relationship_type.toLocaleUpperCase('en-US'), valid_from: d(r.effective_from), valid_to: d(r.effective_to) })) },
        { name: 'Org_Rolleri', columns: [{ key: 'tenant_code', header: 'tenant_code' }, { key: 'operation', header: 'operation', list: OPS }, { key: 'role_code', header: 'role_code' }, { key: 'unit_code', header: 'unit_code' }, { key: 'title', header: 'title', width: 30 }, { key: 'permission_profile', header: 'permission_profile', list: PROFILES.filter(x => config.legacyModules || x !== 'ACTION_OWNER') }, { key: 'valid_from', header: 'valid_from' }, { key: 'valid_to', header: 'valid_to' }], rows: roles.map(r => ({ tenant_code: t.code, operation: '', role_code: r.code, unit_code: r.unit, title: r.title, permission_profile: r.permission_profile, valid_from: d(r.effective_from), valid_to: d(r.effective_to) })) },
      ],
      dictionary: [
        { sheet: 'Birimler', field: 'operation', desc: 'CREATE yeni birim, UPDATE ad/tip/saat dilimi, CLOSE kapanış (valid_to zorunlu).', req: 'Zorunlu (işlenecek satırda)', type: 'seçim', allowed: OPS.join(' / ') },
        { sheet: 'Birimler', field: 'unit_code', desc: 'Şirket içinde tekil kod; harf, rakam, _ . -', req: 'Zorunlu', type: 'kod' },
        { sheet: 'Birimler', field: 'unit_type_code', desc: 'Birim_Tipleri sayfasında tanımlı kod.', req: 'Zorunlu', type: 'kod' },
        { sheet: 'Iliskiler', field: 'relation_type', desc: 'REPORTS_TO idari toplama; SUPPORTS fonksiyonel destek. Bir hiyerarşide bir birimin aynı anda tek REPORTS_TO üstü olur.', req: 'Zorunlu', type: 'seçim', allowed: 'REPORTS_TO / SUPPORTS' },
        { sheet: 'Org_Rolleri', field: 'permission_profile', desc: 'Uygulama yetki profili; unvan (title) serbest metindir ve yetki vermez.', req: 'Zorunlu', type: 'seçim', allowed: PROFILES.join(' / ') },
      ],
    });
  },
  async validate(sheets, tx, ctx): Promise<ValidationResult> {
    const rep = new Report();
    checkTenantCode(sheets, ctx, rep, ['Sirket', 'Birim_Tipleri', 'Birimler', 'Hiyerarsiler', 'Iliskiler', 'Org_Rolleri']);
    const dbTypes = new Map<string, string>((await tx.query('SELECT code, label FROM unit_type WHERE tenant_id = $1', [ctx.tenantId])).rows.map((r: { code: string; label: string }) => [r.code, r.label]));
    const dbUnits = new Map<string, { id: string; name: string; closed: boolean }>((await tx.query('SELECT id, external_id, name, effective_to FROM org_unit WHERE tenant_id = $1 AND external_id IS NOT NULL', [ctx.tenantId])).rows.map((r: { id: string; external_id: string; name: string; effective_to: string | null }) => [r.external_id, { id: r.id, name: r.name, closed: !!r.effective_to }]));
    const dbHier = new Map<string, string>((await tx.query('SELECT id, code FROM hierarchy_group WHERE tenant_id = $1', [ctx.tenantId])).rows.map((r: { id: string; code: string }) => [r.code, r.id]));
    const dbRoles = new Set<string>((await tx.query('SELECT code FROM org_role WHERE tenant_id = $1 AND code IS NOT NULL', [ctx.tenantId])).rows.map((r: { code: string }) => r.code));
    const dbRels = (await tx.query(`SELECT h.code AS hierarchy, c.external_id AS child, p.external_id AS parent FROM org_relationship r JOIN hierarchy_group h ON h.tenant_id = r.tenant_id AND h.id = r.hierarchy_group_id JOIN org_unit c ON c.tenant_id = r.tenant_id AND c.id = r.from_unit_id JOIN org_unit p ON p.tenant_id = r.tenant_id AND p.id = r.to_unit_id WHERE r.tenant_id = $1 AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to > CURRENT_DATE) AND r.relationship_type = 'reports_to'`, [ctx.tenantId])).rows as { hierarchy: string; child: string; parent: string }[];
    const types: { code: string; label: string }[] = []; const units: UnitRow[] = []; const hiers: { code: string; label: string; purpose: string }[] = []; const rels: RelRow[] = []; const roles: RoleRow[] = [];
    // Birim_Tipleri
    if (sheets['Birim_Tipleri'] && requireSheet(sheets, 'Birim_Tipleri', ['unit_type_code', 'label'], rep)) for (const r of sheets['Birim_Tipleri'].rows) { const c = r.cells; if (!CODE_RE.test(c['unit_type_code']!)) rep.error('Birim_Tipleri', r.n, 'unit_type_code', 'invalid_code', 'Geçersiz kod', c['unit_type_code']); else if (!c['label']) rep.error('Birim_Tipleri', r.n, 'label', 'required', 'label zorunlu'); else { types.push({ code: c['unit_type_code']!, label: c['label']! }); dbTypes.set(c['unit_type_code']!, c['label']!); } }
    // Birimler
    const fileUnits = new Map<string, UnitRow>();
    if (sheets['Birimler'] && requireSheet(sheets, 'Birimler', ['operation', 'unit_code', 'unit_name', 'unit_type_code', 'valid_from'], rep)) for (const r of sheets['Birimler']!.rows) {
      const c = r.cells; const op = (c['operation'] ?? '').toLocaleUpperCase('en-US'); if (!op) continue;
      if (!OPS.includes(op)) { rep.error('Birimler', r.n, 'operation', 'invalid_operation', 'operation CREATE/UPDATE/CLOSE olmalı', op); continue; }
      const code = c['unit_code']!; if (!CODE_RE.test(code)) { rep.error('Birimler', r.n, 'unit_code', 'invalid_code', 'Geçersiz birim kodu', code); continue; }
      if (fileUnits.has(code)) { rep.error('Birimler', r.n, 'unit_code', 'duplicate_in_file', 'Aynı kod dosyada iki kez', code); continue; }
      const exists = dbUnits.has(code);
      if (op === 'CREATE' && exists) rep.error('Birimler', r.n, 'unit_code', 'unit_exists', 'Bu kodla birim zaten var; UPDATE ya da CLOSE kullanın', code);
      if (op !== 'CREATE' && !exists) rep.error('Birimler', r.n, 'unit_code', 'unit_not_found', 'Güncellenecek/kapatılacak birim yok', code);
      const from = isoDate(c['valid_from'] ?? ''); const to = isoDate(c['valid_to'] ?? '');
      if (op !== 'CLOSE') { if (!c['unit_name']) rep.error('Birimler', r.n, 'unit_name', 'required', 'unit_name zorunlu'); if (!dbTypes.has(c['unit_type_code']!)) rep.error('Birimler', r.n, 'unit_type_code', 'unit_type_unknown', 'Birim tipi tanımlı değil (Birim_Tipleri)', c['unit_type_code']); if (!from || from === 'INVALID') rep.error('Birimler', r.n, 'valid_from', 'invalid_date', 'valid_from YYYY-AA-GG olmalı', c['valid_from']); }
      if (op === 'CLOSE' && (!to || to === 'INVALID')) rep.error('Birimler', r.n, 'valid_to', 'invalid_date', 'CLOSE için valid_to zorunlu', c['valid_to']);
      const hc = (c['headcount'] ?? '').trim(); if (hc && !/^\d{1,6}$/.test(hc)) rep.error('Birimler', r.n, 'headcount', 'invalid_headcount', 'headcount tam sayı olmalı (anket evreni)', hc);
      const u: UnitRow = { op, code, name: c['unit_name'] ?? '', type: c['unit_type_code'] ?? '', timezone: c['timezone'] || 'Europe/Istanbul', from: from && from !== 'INVALID' ? from : '2026-01-01', to: to && to !== 'INVALID' ? to : null, headcount: hc && /^\d{1,6}$/.test(hc) ? Number(hc) : null, row: r.n };
      fileUnits.set(code, u); units.push(u); if (op === 'CREATE') dbUnits.set(code, { id: '', name: u.name, closed: false });
    }
    // Hiyerarsiler
    if (sheets['Hiyerarsiler'] && requireSheet(sheets, 'Hiyerarsiler', ['hierarchy_code', 'label'], rep)) for (const r of sheets['Hiyerarsiler'].rows) { const c = r.cells; if (!CODE_RE.test(c['hierarchy_code']!)) { rep.error('Hiyerarsiler', r.n, 'hierarchy_code', 'invalid_code', 'Geçersiz kod', c['hierarchy_code']); continue; } const p = (c['purpose'] || 'SURVEY_ROLLUP').toLocaleUpperCase('en-US'); if (!PURPOSES.includes(p)) rep.error('Hiyerarsiler', r.n, 'purpose', 'invalid_purpose', 'purpose geçersiz', p); hiers.push({ code: c['hierarchy_code']!, label: c['label'] || c['hierarchy_code']!, purpose: p }); if (!dbHier.has(c['hierarchy_code']!)) dbHier.set(c['hierarchy_code']!, ''); }
    // Iliskiler
    const edges = new Map<string, Map<string, string>>(); // hierarchy → child → parent (current + file)
    for (const e of dbRels) { if (!edges.has(e.hierarchy)) edges.set(e.hierarchy, new Map()); edges.get(e.hierarchy)!.set(e.child, e.parent); }
    if (sheets['Iliskiler'] && requireSheet(sheets, 'Iliskiler', ['operation', 'hierarchy_code', 'child_unit', 'parent_unit'], rep)) for (const r of sheets['Iliskiler'].rows) {
      const c = r.cells; const op = (c['operation'] ?? '').toLocaleUpperCase('en-US'); if (!op) continue;
      if (!['CREATE', 'CLOSE'].includes(op)) { rep.error('Iliskiler', r.n, 'operation', 'invalid_operation', 'CREATE ya da CLOSE', op); continue; }
      const h = c['hierarchy_code']!, ch = c['child_unit']!, pa = c['parent_unit']!; const type = (c['relation_type'] || 'REPORTS_TO').toLocaleUpperCase('en-US');
      if (!dbHier.has(h)) rep.error('Iliskiler', r.n, 'hierarchy_code', 'hierarchy_unknown', 'Hiyerarşi tanımlı değil', h);
      if (!dbUnits.has(ch)) rep.error('Iliskiler', r.n, 'child_unit', 'unit_not_found', 'Alt birim yok', ch);
      if (!dbUnits.has(pa)) rep.error('Iliskiler', r.n, 'parent_unit', 'unit_not_found', 'Üst birim yok', pa);
      if (ch === pa) rep.error('Iliskiler', r.n, 'parent_unit', 'self_relation', 'Birim kendine bağlanamaz', pa);
      if (!['REPORTS_TO', 'SUPPORTS'].includes(type)) rep.error('Iliskiler', r.n, 'relation_type', 'invalid_relation_type', 'REPORTS_TO ya da SUPPORTS', type);
      const from = isoDate(c['valid_from'] ?? '') ?? '2026-01-01'; const to = isoDate(c['valid_to'] ?? '');
      if (from === 'INVALID') rep.error('Iliskiler', r.n, 'valid_from', 'invalid_date', 'Tarih geçersiz', c['valid_from']);
      if (op === 'CREATE' && type === 'REPORTS_TO') { const m = edges.get(h) ?? new Map(); if (m.has(ch) && m.get(ch) !== pa) rep.error('Iliskiler', r.n, 'child_unit', 'multiple_parents', `Bu hiyerarşide ${ch} zaten ${m.get(ch)} altında; önce CLOSE`, ch); m.set(ch, pa); edges.set(h, m); }
      if (op === 'CLOSE') { const m = edges.get(h); if (!m || m.get(ch) !== pa) rep.error('Iliskiler', r.n, 'child_unit', 'relation_not_found', 'Kapatılacak ilişki yok', `${ch}→${pa}`); else m.delete(ch); }
      rels.push({ op, hierarchy: h, child: ch, parent: pa, type, from: from === 'INVALID' ? '2026-01-01' : from, to: to && to !== 'INVALID' ? to : null, row: r.n });
    }
    for (const [h, m] of edges) for (const start of m.keys()) { let cur: string | undefined = start; const seen = new Set<string>(); while (cur && m.has(cur)) { if (seen.has(cur)) { rep.error('Iliskiler', null, 'child_unit', 'cycle', `${h} hiyerarşisinde döngü: ${[...seen].join(' → ')}`, start); break; } seen.add(cur); cur = m.get(cur); } }
    // Org_Rolleri
    const fileRoles = new Set<string>();
    if (sheets['Org_Rolleri'] && requireSheet(sheets, 'Org_Rolleri', ['operation', 'role_code', 'unit_code', 'title', 'permission_profile'], rep)) for (const r of sheets['Org_Rolleri'].rows) {
      const c = r.cells; const op = (c['operation'] ?? '').toLocaleUpperCase('en-US'); if (!op) continue;
      if (!OPS.includes(op)) { rep.error('Org_Rolleri', r.n, 'operation', 'invalid_operation', 'CREATE/UPDATE/CLOSE', op); continue; }
      const code = c['role_code']!; if (!CODE_RE.test(code)) { rep.error('Org_Rolleri', r.n, 'role_code', 'invalid_code', 'Geçersiz rol kodu', code); continue; }
      if (fileRoles.has(code)) { rep.error('Org_Rolleri', r.n, 'role_code', 'duplicate_in_file', 'Aynı rol kodu dosyada iki kez', code); continue; } fileRoles.add(code);
      if (op === 'CREATE' && dbRoles.has(code)) rep.error('Org_Rolleri', r.n, 'role_code', 'role_exists', 'Rol kodu zaten var', code);
      if (op !== 'CREATE' && !dbRoles.has(code)) rep.error('Org_Rolleri', r.n, 'role_code', 'role_not_found', 'Rol yok', code);
      const prof = (c['permission_profile'] ?? '').toLocaleUpperCase('en-US');
      if (op !== 'CLOSE' && prof === 'ACTION_OWNER' && !config.legacyModules) rep.error('Org_Rolleri', r.n, 'permission_profile', 'profile_disabled', 'ACTION_OWNER (aksiyon sorumlusu) bu sürümde kullanılmıyor; UNIT_MANAGER ya da VIEWER seçin', prof); // ADR-0043
      if (op !== 'CLOSE') { if (!dbUnits.has(c['unit_code']!)) rep.error('Org_Rolleri', r.n, 'unit_code', 'unit_not_found', 'Birim yok', c['unit_code']); if (ctx.grantable && !ctx.grantable.includes(prof)) rep.error('Org_Rolleri', r.n, 'permission_profile', 'grant_not_allowed', `${prof} profilli rol tanımlama/değiştirme yetkiniz yok`, prof); /* N05 */ if (!PROFILES.includes(prof)) rep.error('Org_Rolleri', r.n, 'permission_profile', 'invalid_profile', `Yetki profili: ${PROFILES.join(', ')}`, prof); if (!c['title']) rep.error('Org_Rolleri', r.n, 'title', 'required', 'title zorunlu'); }
      const from = isoDate(c['valid_from'] ?? '') ?? '2026-01-01'; const to = isoDate(c['valid_to'] ?? '');
      roles.push({ op, code, unit: c['unit_code'] ?? '', title: c['title'] ?? '', profile: prof, from: from === 'INVALID' ? '2026-01-01' : from, to: to && to !== 'INVALID' ? to : null, row: r.n });
    }
    const rowCount = types.length + units.length + hiers.length + rels.length + roles.length;
    if (rowCount === 0) rep.error(sheets['Birimler'] ? 'Birimler' : 'Org_Rolleri', null, null, 'empty', 'Dosyada işlenecek satır yok (operation sütunu boş)');
    const preview = { unitTypes: types.length, units: { create: units.filter(u => u.op === 'CREATE').length, update: units.filter(u => u.op === 'UPDATE').length, close: units.filter(u => u.op === 'CLOSE').length }, hierarchies: hiers.length, relationships: { create: rels.filter(x => x.op === 'CREATE').length, close: rels.filter(x => x.op === 'CLOSE').length }, roles: { create: roles.filter(x => x.op === 'CREATE').length, update: roles.filter(x => x.op === 'UPDATE').length, close: roles.filter(x => x.op === 'CLOSE').length } };
    return { report: rep, payload: { types, units, hiers, rels, roles }, preview, rowCount, templateVersion: TEMPLATE_VERSION };
  },
  async commit(payload, tx, ctx) {
    const p = payload as { types: { code: string; label: string }[]; units: UnitRow[]; hiers: { code: string; label: string; purpose: string }[]; rels: RelRow[]; roles: RoleRow[] };
    const org = ctx.organizationId;
    for (const t of p.types) await tx.query('INSERT INTO unit_type (tenant_id, code, label) VALUES ($1,$2,$3) ON CONFLICT (tenant_id, code) DO UPDATE SET label = EXCLUDED.label', [ctx.tenantId, t.code, t.label]);
    for (const u of p.units) {
      if (u.op === 'CREATE') await tx.query('INSERT INTO org_unit (tenant_id, organization_id, external_id, name, unit_type, timezone, effective_from, headcount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [ctx.tenantId, org, u.code, u.name, u.type, u.timezone, u.from, u.headcount ?? null]);
      else if (u.op === 'UPDATE') await tx.query('UPDATE org_unit SET name = $3, unit_type = $4, timezone = $5, headcount = COALESCE($6, headcount), version = version + 1, updated_at = now() WHERE tenant_id = $1 AND external_id = $2', [ctx.tenantId, u.code, u.name, u.type, u.timezone, u.headcount ?? null]);
      else await tx.query('UPDATE org_unit SET effective_to = $3, version = version + 1, updated_at = now() WHERE tenant_id = $1 AND external_id = $2', [ctx.tenantId, u.code, u.to]);
    }
    for (const h of p.hiers) await tx.query('INSERT INTO hierarchy_group (tenant_id, organization_id, code, name, purpose) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name, purpose = EXCLUDED.purpose', [ctx.tenantId, org, h.code, h.label, h.purpose]);
    const uid = async (code: string) => (await tx.query('SELECT id FROM org_unit WHERE tenant_id = $1 AND external_id = $2', [ctx.tenantId, code])).rows[0]?.id as string;
    const hid = async (code: string) => (await tx.query('SELECT id FROM hierarchy_group WHERE tenant_id = $1 AND code = $2', [ctx.tenantId, code])).rows[0]?.id as string;
    for (const r of p.rels) {
      const h = await hid(r.hierarchy), c = await uid(r.child), pa = await uid(r.parent);
      if (r.op === 'CREATE') await tx.query('INSERT INTO org_relationship (tenant_id, hierarchy_group_id, from_unit_id, to_unit_id, relationship_type, effective_from) VALUES ($1,$2,$3,$4,$5,$6)', [ctx.tenantId, h, c, pa, r.type.toLocaleLowerCase('en-US'), r.from]);
      else await tx.query('UPDATE org_relationship SET effective_to = COALESCE($5, CURRENT_DATE), updated_at = now() WHERE tenant_id = $1 AND hierarchy_group_id = $2 AND from_unit_id = $3 AND to_unit_id = $4 AND effective_to IS NULL', [ctx.tenantId, h, c, pa, r.to]);
    }
    for (const r of p.roles) {
      if (r.op === 'CREATE') await tx.query('INSERT INTO org_role (tenant_id, unit_id, role_type, title, effective_from, code, permission_profile) VALUES ($1,$2,$3,$4,$5,$6,$7)', [ctx.tenantId, await uid(r.unit), r.profile.toLocaleLowerCase('en-US'), r.title, r.from, r.code, r.profile]);
      else if (r.op === 'UPDATE') await tx.query('UPDATE org_role SET unit_id = $3, title = $4, permission_profile = $5, role_type = $6 WHERE tenant_id = $1 AND code = $2', [ctx.tenantId, r.code, await uid(r.unit), r.title, r.profile, r.profile.toLocaleLowerCase('en-US')]);
      else await tx.query('UPDATE org_role SET effective_to = COALESCE($3, CURRENT_DATE) WHERE tenant_id = $1 AND code = $2', [ctx.tenantId, r.code, r.to]);
    }
    return { applied: { types: p.types.length, units: p.units.length, hierarchies: p.hiers.length, relationships: p.rels.length, roles: p.roles.length } };
  },
};
