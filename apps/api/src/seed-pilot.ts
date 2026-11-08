/** v2.12 PİLOT tohumu — mevcut DOLU demo veritabanına (SAHA + FABRIKA) 18 küçük pilot şirket ve 10 şirkete atanmış bir HPW danışmanı ekler; toplam 20 şirket.
    seed-demo.ts'ten türetildi (yardımcılar aynı); yalnız HPW_ENV=demo. Gerçek API + toplu yükleyicilerin doğrudan çağrısı. Bütün veriler sentetik. */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { buildApp } from './server.js';
import { join } from 'node:path';
import { config, apiRoot } from './config.js';
import { withContext } from './db.js';
import { orgImporter } from './importers/org.js';
import { usersImporter } from './importers/users.js';
import { resultsImporter } from './importers/results.js';
import { tenantInfo, type ImportCtx } from './importers/common.js';
import type { Sheet } from './xlsx.js';
import { PROFILES } from './auth.js';
import { totpAt, b32decode } from './mfa.js';

if (config.envName !== 'demo') { console.error(`Demo tohumu yalnız HPW_ENV=demo ortamında çalışır (şu an: ${config.envName}). BOŞ BAŞLANGIÇ demo verisi almaz.`); process.exit(2); }
const PLATFORM_EMAIL = process.env.DEMO_PLATFORM_EMAIL ?? 'platform@demo.hpw-act.local', PLATFORM_PW = process.env.DEMO_PLATFORM_PASSWORD ?? 'Demo-Platform-2026';
const USER_PW = process.env.DEMO_USER_PASSWORD ?? 'Demo-Kullanici-2026';
const TODAY = new Date().toISOString().slice(0, 10);
let seed = 20260924; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; // tekrarlanabilir
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
const AD = ['Ayşe', 'Mehmet', 'Elif', 'Can', 'Zeynep', 'Emre', 'Deniz', 'Selin', 'Burak', 'Merve', 'Kerem', 'Ece', 'Murat', 'Gizem', 'Onur', 'Pelin', 'Arda', 'Nazlı', 'Serkan', 'Derya'];
const SOY = ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Koç', 'Kurt', 'Özdemir', 'Yıldız', 'Polat', 'Erdoğan', 'Güneş', 'Acar'];
const IL = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep', 'Kayseri', 'Samsun', 'Trabzon', 'Eskişehir', 'Denizli', 'Mersin', 'Diyarbakır', 'Erzurum', 'Malatya', 'Sakarya', 'Kocaeli', 'Manisa', 'Balıkesir', 'Tekirdağ', 'Aydın', 'Muğla', 'Hatay', 'Van', 'Şanlıurfa', 'Kahramanmaraş', 'Ordu', 'Sivas', 'Elazığ', 'Tokat', 'Zonguldak', 'Çanakkale', 'Edirne'];
const app = await buildApp(); const cookies: Record<string, string> = {};
const cookieOf = (h: Record<string, unknown>) => { const sc = h['set-cookie']; return (Array.isArray(sc) ? sc[0] : String(sc ?? '')).split(';')[0]!; };
async function api<T = Record<string, unknown>>(method: 'GET' | 'POST' | 'PATCH', url: string, body?: unknown, who?: string, allow: number[] = [200]): Promise<T> { const res = await app.inject({ method, url, payload: body as Record<string, unknown> | undefined, headers: who ? { cookie: cookies[who]! } : {} }); if (!allow.includes(res.statusCode)) throw new Error(`${method} ${url} → ${res.statusCode} ${res.body.slice(0, 300)}`); return JSON.parse(res.body) as T; }
async function login(email: string, who: string, pw: string) { const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: pw } }); if (res.statusCode !== 200) throw new Error(`login ${email} ${res.body}`); cookies[who] = cookieOf(res.headers as Record<string, unknown>); }
function tokenFor(email: string, kind: 'davet' | 'parola'): string | null { const files = readdirSync(config.mailDir).filter(f => f.endsWith('.eml')).map(f => readFileSync(`${config.mailDir}/${f}`, 'utf8')).filter(t => t.includes(`To: ${email}\n`) && t.includes(`#/${kind}/`)); if (!files.length) return null; return new RegExp(`#/${kind}/([A-Za-z0-9_-]+)`).exec(files[files.length - 1]!)![1]!; }
async function accept(email: string, who: string) { const tok = tokenFor(email, 'davet'); if (!tok) throw new Error(`davet yok ${email}`); const res = await app.inject({ method: 'POST', url: `/api/invitations/${tok}/accept`, payload: { password: USER_PW } }); if (res.statusCode !== 200) throw new Error(`accept ${email} ${res.body}`); cookies[who] = cookieOf(res.headers as Record<string, unknown>); }
const sheet = (name: string, header: string[], rows: Record<string, unknown>[]): Sheet => ({ name, header, rows: rows.map((r, i) => ({ n: i + 2, cells: Object.fromEntries(header.map(h => [h, r[h] === undefined || r[h] === null ? '' : String(r[h])])) })) });
async function importDirect(kind: 'org' | 'users' | 'results', tenantId: string, platformUserId: string, sheets: Record<string, Sheet>, cycleId: string | null = null) {
  const imp = { org: orgImporter, users: usersImporter, results: resultsImporter }[kind];
  return withContext({ realm: 'platform', userId: platformUserId, tenantId, platformWrite: true }, async tx => { // v2.12: platform yazma koruması (v2.10) için açık yazma bağlamı
    const t = await tenantInfo(tx, tenantId); const ctx: ImportCtx = { tenantId, tenantCode: t.code, organizationId: t.organizationId, userId: platformUserId, cycleId, grantable: PROFILES, actorProfile: 'PLATFORM' };
    const v = await imp.validate(sheets, tx, ctx); if (!v.report.ok) throw new Error(`${kind} doğrulama hatası: ${JSON.stringify(v.report.issues.filter(i => i.severity === 'error').slice(0, 5))}`);
    const hash = createHash('sha256').update(JSON.stringify(sheets)).digest('hex').slice(0, 16);
    await tx.query('INSERT INTO import_job (tenant_id, kind, cycle_id, state, file_name, file_hash, file_size, template_version, row_count, error_count, warning_count, errors, preview, payload, created_by, pinned, committed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now())', [tenantId, kind, cycleId, 'committed', `demo-${kind}.xlsx`, hash, 0, v.templateVersion, v.rowCount, 0, v.report.warnings.length, JSON.stringify(v.report.issues), JSON.stringify(v.preview), '{}', platformUserId, JSON.stringify(v.pinned ?? {})]).catch(() => null);
    const applied = await imp.commit(v.payload, tx, ctx); return { applied, warnings: v.report.warnings.length };
  });
}
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- 0 platform
mkdirSync(config.mailDir, { recursive: true });
const boot = await app.inject({ method: 'POST', url: '/api/platform/bootstrap', payload: { email: PLATFORM_EMAIL, password: PLATFORM_PW, displayName: 'HPW Demo Yönetici', setupKey: config.setupKey } });
if (![200, 409].includes(boot.statusCode)) throw new Error('bootstrap ' + boot.body);
await login(PLATFORM_EMAIL, 'platform', PLATFORM_PW);
// v2.12 pilot: v2.9.0'dan beri HPW personeli için doğrulama zorunlu. Tohum, işlemleri yapabilmek için geçici olarak doğrulamayı kurar;
// sonunda (aşağıda) platform_mfa kayıtları silinir — paketlenen demoda her HPW kullanıcısı ilk girişte kendi doğrulama uygulamasını kurar (tohum anahtarı demoya taşınmaz).
async function mfaEnroll(who: string) { const st = await api<{ secret: string }>('POST', '/api/platform/mfa/setup', {}, who); const code = totpAt(b32decode(st.secret), Math.floor(Date.now() / 30000)); await api('POST', '/api/platform/mfa/verify', { code }, who); }
await mfaEnroll('platform');
const me = await api<{ userId: string }>('GET', '/api/auth/me', undefined, 'platform'); const PUID = me.userId;
const existingP = await api<{ code: string }[]>('GET', '/api/platform/tenants', undefined, 'platform'); if (existingP.some(t => t.code === 'PILOT01')) { console.error('Pilot verisi zaten var (PILOT01).'); process.exit(3); }
type U = [code: string, name: string, type: string, parent: string | null, headcount: number];
const ORG_TYPES: Record<string, [string, string][]> = { SAHA: [['ROOT', 'Genel Müdürlük'], ['GMY', 'Genel Müdür Yardımcılığı'], ['MUDURLUK', 'Bölge Müdürlüğü'], ['SUBE', 'Şube'], ['EKIP', 'Alt Birim / Ekip']], FABRIKA: [['ROOT', 'Genel Merkez'], ['FABRIKA', 'Fabrika'], ['DEPT', 'Departman'], ['VARDIYA', 'Vardiya / Hat']] };
function orgSheets(tcode: string, units: U[], rl: [string, string, string, string][], extraRoles: Record<string, unknown>[] = []): Record<string, Sheet> {
  return {
    Birim_Tipleri: sheet('Birim_Tipleri', ['tenant_code', 'unit_type_code', 'label'], ORG_TYPES[tcode]!.map(t => ({ tenant_code: tcode, unit_type_code: t[0], label: t[1] }))),
    Birimler: sheet('Birimler', ['tenant_code', 'operation', 'unit_code', 'unit_name', 'unit_type_code', 'timezone', 'valid_from', 'valid_to', 'headcount'], units.map(u => ({ tenant_code: tcode, operation: 'CREATE', unit_code: u[0], unit_name: u[1], unit_type_code: u[2], timezone: 'Europe/Istanbul', valid_from: '2025-01-01', headcount: u[4] }))),
    Hiyerarsiler: sheet('Hiyerarsiler', ['tenant_code', 'hierarchy_code', 'label', 'purpose'], [{ tenant_code: tcode, hierarchy_code: 'SURVEY', label: 'Anket ağacı', purpose: 'SURVEY_ROLLUP' }]),
    Iliskiler: sheet('Iliskiler', ['tenant_code', 'operation', 'hierarchy_code', 'child_unit', 'parent_unit', 'relation_type', 'valid_from', 'valid_to'], units.filter(u => u[3]).map(u => ({ tenant_code: tcode, operation: 'CREATE', hierarchy_code: 'SURVEY', child_unit: u[0], parent_unit: u[3], relation_type: 'REPORTS_TO', valid_from: '2025-01-01' }))),
    Org_Rolleri: sheet('Org_Rolleri', ['tenant_code', 'operation', 'role_code', 'unit_code', 'title', 'permission_profile', 'valid_from', 'valid_to'], [...rl.map(r => ({ tenant_code: tcode, operation: 'CREATE', role_code: r[0], unit_code: r[1], title: r[2], permission_profile: r[3], valid_from: '2025-01-01' })), ...extraRoles]),
  };
}
async function cycle(tid: string, who: string, code: string, ps: string, pe: string, iv: string) { return (await api<{ id: string }>('POST', `/api/t/${tid}/cycles`, { code, name: code.replace('-ANA', ' Ana Ölçüm'), periodStart: ps, periodEnd: pe, instrumentVersionId: iv }, who)).id; }
type Metric = { metric_code: string; item_code: string; rule_code: string; scale_code: string };
async function metricsOf(tid: string, iv: string): Promise<Metric[]> { return withContext({ realm: 'platform', userId: PUID, tenantId: tid }, async tx => (await tx.query('SELECT im.metric_code, im.item_code, im.rule_code, ii.scale_code FROM item_metric im JOIN instrument_item ii ON ii.tenant_id = im.tenant_id AND ii.instrument_version_id = im.instrument_version_id AND ii.code = im.item_code WHERE im.tenant_id = $1 AND im.instrument_version_id = $2 AND ii.selection_state = $3', [tid, iv, 'INCLUDED'])).rows); }
function dist(scale: string, n: number, fav: number): Record<string, number> { const top = Math.round(n * fav), rest = n - top; if (scale === 'NPS11') { const det = Math.round(rest * 0.45); return { '0': Math.floor(det / 2), '3': det - Math.floor(det / 2), '7': Math.floor((rest - det) / 2), '8': rest - det - Math.floor((rest - det) / 2), '9': Math.floor(top / 2), '10': top - Math.floor(top / 2) }; } if (scale === 'BIN') return { NO: rest, YES: top }; const c5 = Math.round(top * 0.55), c4 = top - c5, c3 = Math.round(rest * 0.5), c2 = Math.round((rest - c3) * 0.6), c1 = rest - c3 - c2; return scale === 'L5R' ? { '1': c5, '2': c4, '3': c3, '4': c2, '5': c1 } : { '1': c1, '2': c2, '3': c3, '4': c4, '5': c5 }; }
function valueOf(m: Metric, d: Record<string, number>, n: number): number { const g = (k: string) => d[k] ?? 0; if (m.metric_code.endsWith('_NPS')) return Math.round(((g('9') + g('10') - g('0') - g('3')) / n) * 1000) / 10; const fav = m.scale_code === 'L5' ? g('4') + g('5') : m.scale_code === 'L5R' ? g('1') + g('2') : m.scale_code === 'NPS11' ? g('9') + g('10') : g('YES'); return Math.round((fav / n) * 1000) / 10; }
const drift = new Map<string, number>(); // birim bazlı eğilim: iyileşen (+), gerileyen (−), koruyan (0)
function resultSheets(tcode: string, cycleCode: string, units: U[], metrics: Metric[], mode: 'FULL_REPLACE' | 'PATCH', year: 2025 | 2026, skipItems: Set<string> = new Set()): Record<string, Sheet> {
  const rows: Record<string, unknown>[] = [], drows: Record<string, unknown>[] = [];
  for (const u of units) { const leaf = ['SUBE', 'EKIP', 'VARDIYA', 'DEPT'].includes(u[2]); if (!leaf) continue; // şube + alt birim; üst birimler (GMY, müdürlük, fabrika) yaprak toplamından türer (R12)
    const hc = u[4]; const rate = 0.55 + rnd() * 0.4; const n = Math.max(1, Math.round(hc * rate)); const base = 0.42 + rnd() * 0.4; const dr = drift.get(u[0]) ?? (drift.set(u[0], rnd() < 0.3 ? 0.12 : rnd() < 0.5 ? -0.1 : 0.01), drift.get(u[0])!);
    const perItem = new Map<string, Record<string, number>>();
    for (const m of metrics) { if (skipItems.has(m.item_code)) continue; if (n < 5) { rows.push({ tenant_code: tcode, cycle_code: cycleCode, scope_code: u[0], metric_code: m.metric_code, status: 'SUPPRESSED', n_valid: n }); continue; }
      let d = perItem.get(m.item_code); if (!d) { const f = Math.max(0.05, Math.min(0.95, base + (year === 2026 ? dr : 0) + (rnd() - 0.5) * 0.2 + (m.item_code.startsWith('GUV') ? -0.08 : 0))); d = dist(m.scale_code, n, f); perItem.set(m.item_code, d); for (const [o, c] of Object.entries(d)) if (c > 0) drows.push({ tenant_code: tcode, cycle_code: cycleCode, scope_code: u[0], metric_code: m.metric_code, option_code: o, count: c }); }
      else for (const [o, c] of Object.entries(d)) if (c > 0) drows.push({ tenant_code: tcode, cycle_code: cycleCode, scope_code: u[0], metric_code: m.metric_code, option_code: o, count: c });
      rows.push({ tenant_code: tcode, cycle_code: cycleCode, scope_code: u[0], metric_code: m.metric_code, status: 'OBSERVED', n_valid: n, value: String(valueOf(m, d, n)).replace('.', ',') }); }
  }
  return { Paket: sheet('Paket', ['tenant_code', 'bundle_code', 'template_version', 'cycle_code', 'import_mode'], [{ tenant_code: tcode, bundle_code: `${cycleCode}-DEMO`, template_version: 'v2.5-1', cycle_code: cycleCode, import_mode: mode }]), Sonuclar: sheet('Sonuclar', ['tenant_code', 'cycle_code', 'scope_code', 'metric_code', 'status', 'n_valid', 'value', 'aggregation_weight', 'source_reference'], rows), Dagilimlar: sheet('Dagilimlar', ['tenant_code', 'cycle_code', 'scope_code', 'metric_code', 'option_code', 'count'], drows), Resmi_Toplamlar: sheet('Resmi_Toplamlar', ['tenant_code', 'cycle_code', 'scope_code', 'aggregate_code', 'definition_version', 'value', 'source_reference'], []), Benchmarklar: sheet('Benchmarklar', ['tenant_code', 'metric_code', 'set_code', 'value'], []) };
}
function userRows(tcode: string, dom: string, rl: [string, string, string, string][], limit: number, extra: { email: string; name: string; role: string; from: string; to?: string }[] = []) {
  const users: Record<string, unknown>[] = [], assigns: Record<string, unknown>[] = [], seenEmail = new Set<string>(); let i = 0;
  for (const r of rl) { if (r[3] === 'HR_ADMIN') continue; if (users.length >= limit) break; const name = `${pick(AD)} ${pick(SOY)}`; let email = `${r[1].toLocaleLowerCase('en-US')}.${name.split(' ')[1]!.toLocaleLowerCase('tr-TR').replace(/[^a-z]/g, '') || 'kisi'}@${dom}`; while (seenEmail.has(email)) email = email.replace('@', `${++i}@`); seenEmail.add(email); users.push({ tenant_code: tcode, operation: 'CREATE', email, display_name: name, locale: 'tr', timezone: 'Europe/Istanbul', login_method: 'LOCAL_PASSWORD', invite_requested: 'YES' }); assigns.push({ tenant_code: tcode, operation: 'CREATE', email, role_code: r[0], assignment_kind: 'PRIMARY', valid_from: '2025-01-01' }); }
  for (const e of extra) { users.push({ tenant_code: tcode, operation: 'CREATE', email: e.email, display_name: e.name, locale: 'tr', timezone: 'Europe/Istanbul', login_method: 'LOCAL_PASSWORD', invite_requested: 'YES' }); assigns.push({ tenant_code: tcode, operation: 'CREATE', email: e.email, role_code: e.role, assignment_kind: 'DELEGATE', valid_from: e.from, valid_to: e.to ?? '' }); }
  return { users, assigns };
}
const emailOfRole = (rows: Record<string, unknown>[], role: string) => String(rows.find(a => a.role_code === role)!.email);
const unitId = async (tid: string, cid: string, who: string, code: string) => ((await api<{ id: string; code: string }[]>('GET', `/api/t/${tid}/cycles/${cid}/units`, undefined, who)).find(u => u.code === code) ?? (() => { throw new Error('birim yok ' + code); })()).id;
const HR_OF: Record<string, string> = {}; // v2.12 pilot: hedef incelemesini şirketin kendi İK yöneticisi yapar
async function chain(tid: string, cid: string, who: string, unitCode: string, itemCode: string, tpl: string | { title: string; cadence: string }, evidenceDates: string[], finish: 'verified' | 'declared' | 'in_progress' | 'paused' | 'rejected', verifier?: string) {
  const uid = await unitId(tid, cid, who, unitCode);
  const t = await api<{ id: string; status: string }>('POST', `/api/t/${tid}/cycles/${cid}/units/${uid}/targets`, { itemCode }, who, [200, 409, 422]); if (!t.id) return null;
  if (t.status === 'under_review') await api('POST', `/api/t/${tid}/targets/${t.id}/review`, { decision: 'accept', reason: 'demo: yerel hedef metodoloji incelemesinden geçti' }, HR_OF[tid]!);
  const a = await api<{ id: string }>('POST', `/api/t/${tid}/targets/${t.id}/actions`, typeof tpl === 'string' ? { templateCode: tpl, startDate: '2025-05-01', dueDate: '2025-10-31' } : { custom: tpl, startDate: '2025-05-01', dueDate: '2025-10-31' }, who, [200, 409, 422]); if (!a.id) return { target: t.id };
  for (const d of evidenceDates) await api('POST', `/api/t/${tid}/actions/${a.id}/evidence`, { date: d, attendance: 4 + Math.floor(rnd() * 8) }, who, [200, 422]);
  if (finish === 'paused') { await api('POST', `/api/t/${tid}/actions/${a.id}/transition`, { to: 'paused', reason: 'demo: bütçe onayı bekleniyor' }, who); return { target: t.id, action: a.id }; }
  if (finish !== 'in_progress') { await api('POST', `/api/t/${tid}/actions/${a.id}/declare-complete`, {}, who, [200, 409]); }
  if (finish === 'verified' && verifier) await api('POST', `/api/t/${tid}/actions/${a.id}/verify`, { ok: true, reason: 'demo: takvim ve katılım kayıtları örneklemle kontrol edildi' }, verifier, [200, 422]);
  if (finish === 'rejected' && verifier) await api('POST', `/api/t/${tid}/actions/${a.id}/verify`, { ok: false, reason: 'demo: kayıtlar eksik; iş devam etmeli' }, verifier, [200, 422]);
  return { target: t.id, action: a.id };
}
const M6 = ['2025-05-13', '2025-06-10', '2025-07-08', '2025-08-12', '2025-09-09', '2025-10-14'];
let ALL: string[] = []; // standart madde kataloğu: ilk pilot şirketin İK yöneticisiyle okunur
// ---------- 8b PİLOT (v2.12): 18 ek küçük şirket — toplam 20 şirket tek HPW panelinden. Her şirketin kendi İK yöneticisi, birimleri, kullanıcıları, dönemi, sonuçları ve kayıtları var.
// Kurulum ilerlemesi bilerek farklı: 3 şirkette dönem yok (kurulum başında), 3 şirkette sonuç yok; 5 şirketin açılış tarihi geriye alınır (kurulum gecikti işi oluşur). Hepsi sentetik.
const SEKTOR = ['Lojistik', 'Perakende', 'Enerji', 'Gıda', 'Sağlık', 'Tekstil', 'Otomotiv Yan Sanayi', 'Turizm', 'Eğitim', 'Yazılım', 'İnşaat', 'Kimya', 'Sigorta', 'Kargo', 'İlaç Dağıtım', 'Mobilya', 'Tarım', 'Medya'];
const PILOT: { code: string; id: string; hr: string; email: string; mgrEmail?: string }[] = [];
for (let i = 1; i <= 18; i++) {
  const nn = String(i).padStart(2, '0'), code = `PILOT${nn}`, dom = `pilot${nn}.demo.hpw-act.local`, hr = `hr-${code}`;
  const units: U[] = [['GM', 'Genel Müdürlük', 'ROOT', null, 20], ['IK', 'İnsan Kaynakları', 'DEPT', 'GM', 8], ['SAT', 'Satış', 'DEPT', 'GM', 25 + i], ['OPS', 'Operasyon', 'DEPT', 'GM', 40 + 2 * i]];
  for (let b = 1; b <= 2 + (i % 3); b++) units.push([`SB${b}`, `${pick(IL)} Şubesi`, 'SUBE', 'OPS', 12 + Math.floor(rnd() * 30)]);
  const rl: [string, string, string, string][] = [['ROLE_HR', 'GM', 'İK Yöneticisi', 'HR_ADMIN'], ['ROLE_CEO', 'GM', 'Genel Müdür', 'EXEC'], ['ROLE_SAT', 'SAT', 'Satış Müdürü', 'UNIT_MANAGER'], ['ROLE_OPS', 'OPS', 'Operasyon Müdürü', 'UNIT_MANAGER']];
  for (const u of units) if (u[2] === 'SUBE') rl.push([`ROLE_${u[0]}`, u[0], 'Şube Sorumlusu', 'UNIT_MANAGER']);
  ORG_TYPES[code] = [['ROOT', 'Genel Müdürlük'], ['DEPT', 'Departman'], ['SUBE', 'Şube']];
  const email = `ik@${dom}`;
  const t = await api<{ id: string }>('POST', '/api/platform/tenants', { code, name: `Pilot ${nn} ${SEKTOR[i - 1]} A.Ş. (sentetik)`, adminEmail: email, adminName: `Pilot ${nn} İK Yöneticisi` }, 'platform');
  HR_OF[t.id] = hr; PILOT.push({ code, id: t.id, hr, email });
  await importDirect('org', t.id, PUID, orgSheets(code, units, rl));
  await api('POST', `/api/t/${t.id}/invitations/send`, {}, 'platform'); await accept(email, hr);
  if (!ALL.length) ALL = (await api<{ items: { code: string }[] }>('GET', `/api/t/${t.id}/instruments/catalog`, undefined, hr)).items.map(x => x.code);
  const uu = userRows(code, dom, rl, 6);
  await importDirect('users', t.id, PUID, { Kullanicilar: sheet('Kullanicilar', ['tenant_code', 'operation', 'email', 'display_name', 'locale', 'timezone', 'login_method', 'invite_requested'], uu.users), Rol_Atamalari: sheet('Rol_Atamalari', ['tenant_code', 'operation', 'email', 'role_code', 'assignment_kind', 'valid_from', 'valid_to', 'reason'], uu.assigns) });
  await api('POST', `/api/t/${t.id}/invitations/send`, {}, hr);
  const mgr = emailOfRole(uu.assigns, 'ROLE_OPS'); await accept(mgr, `ROLE_OPS-${code}`); PILOT[PILOT.length - 1]!.mgrEmail = mgr;
  if (i <= 3) { log(code, 'kurulum başında (dönem yok)'); continue; }
  const iv = await api<{ instrumentVersionId: string }>('POST', `/api/t/${t.id}/instruments`, { version: '2026-v1', standardItemCodes: ALL, customItems: [] }, hr);
  const c = await cycle(t.id, hr, '2026-ANA', '2026-03-02', '2026-03-20', iv.instrumentVersionId);
  if (i <= 6) { log(code, 'dönem var, sonuç yok'); continue; }
  const m = await metricsOf(t.id, iv.instrumentVersionId);
  await importDirect('results', t.id, PUID, resultSheets(code, '2026-ANA', units, m, 'FULL_REPLACE', 2025), c);
  await chain(t.id, c, `ROLE_OPS-${code}`, 'OPS', 'GUV-01', 'birebir-programi', i % 2 ? M6.slice(0, 3) : M6, i % 2 ? 'in_progress' : 'declared');
  log(code, 'dönem + sonuç + kayıt');
}
// 5 pilot şirketin açılış tarihi 20 gün geri (sentetik): "kurulum gecikti" bekleyen işi oluşsun
// (açılış tarihi geri alma ve tohumun geçici doğrulama kayıtlarının silinmesi: veritabanı sahibi yetkisiyle, çalıştırma betiğinde — uygulama rolünün tenant/platform_mfa üzerinde bu yetkisi yok)
// HPW danışmanı: 10 pilot şirkete ana danışman (kapsam sınırı sınaması için 10 şirketi görür)
const DAN_EMAIL = 'danisman@demo.hpw-act.local';
const dan = await api<{ id: string }>('POST', '/api/platform/staff', { email: DAN_EMAIL, displayName: 'HPW Pilot Danışmanı', role: 'consultant', tenantIds: PILOT.slice(0, 10).map(p => p.id), duty: 'primary', reason: 'pilot: danışman portföyü' }, 'platform');
{ const tok = tokenFor(DAN_EMAIL, 'parola'); if (!tok) throw new Error('danışman parola bağlantısı yok'); const r = await app.inject({ method: 'POST', url: `/api/auth/reset/${tok}`, payload: { password: PLATFORM_PW } }); if (r.statusCode !== 200) throw new Error('danışman parola ' + r.body); }
log('pilot danışman', dan.id);

const prev = process.env.PILOT_CREDS_BASE ? readFileSync(process.env.PILOT_CREDS_BASE, 'utf8') : '';
const credsPilot = (prev || '# DOLU DEMO giriş bilgileri (sentetik)\n') + `\n\n## Pilot (20 şirket; v2.12)\n\nHPW yöneticisi 20 şirketin tamamını görür: ${PLATFORM_EMAIL} / ${PLATFORM_PW}\nHPW danışmanı (yalnız PILOT01–PILOT10): ${DAN_EMAIL} / ${PLATFORM_PW}\nHPW kullanıcıları ilk girişte telefondaki doğrulama uygulamasını kurar.\n\n` + PILOT.map(p => `${p.code} İK yöneticisi: ${p.email} / ${USER_PW}${p.mgrEmail ? ` · Operasyon müdürü: ${p.mgrEmail} / ${USER_PW}` : ''}`).join('\n') + '\n';
mkdirSync(join(apiRoot, 'var'), { recursive: true }); writeFileSync(join(apiRoot, 'var', 'DEMO-GIRIS-BILGILERI.md'), credsPilot); console.log(credsPilot);
await app.close(); process.exit(0);