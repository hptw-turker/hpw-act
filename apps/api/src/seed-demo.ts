/** DOLU DEMO tohumu — yalnız HPW_ENV=demo ortamında çalışır (BOŞ ortam demo verisine düşemez). Bütün veriler sentetiktir; gerçek kişi, adres ya da HPW onaylı benchmark içermez.
    Yol: gerçek API (platform → şirket → soru seti → dönem → davet → hedef → aksiyon → kanıt → doğrulama → takip) + toplu yükleyicilerin doğrudan çağrısı (org/kullanıcı/sonuç; XLSX yolu ile aynı doğrulama ve commit kodu).
    Büyük şirket: 12 GMY, 35 müdürlük, 400 şube, 200 alt birim, 500 kullanıcı. Küçük şirket: fabrika-merkez; farklı birim tipleri/unvanlar. */
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
const existing = await api<{ code: string }[]>('GET', '/api/platform/tenants', undefined, 'platform'); if (existing.some(t => t.code === 'SAHA')) { console.error('Demo verisi zaten var (SAHA). Sıfırlamak için demo veritabanını yeniden kurun.'); process.exit(3); }

// ---------- 1 SAHA (büyük saha organizasyonu)
type U = [code: string, name: string, type: string, parent: string | null, headcount: number];
const saha: U[] = [['GM', 'Genel Müdürlük', 'ROOT', null, 120]]; const roles: [string, string, string, string][] = [['ROLE_HR', 'GM', 'İK Direktörü', 'HR_ADMIN'], ['ROLE_GM_CEO', 'GM', 'Genel Müdür', 'EXEC']];
const gmy: string[] = []; const mud: string[] = []; const sube: string[] = []; const alt: string[] = [];
for (let g = 1; g <= 12; g++) { const c = `GMY${String(g).padStart(2, '0')}`; gmy.push(c); saha.push([c, `${pick(IL)} ${g <= 6 ? 'Bölgeler' : 'Kanallar'} GMY-${g}`, 'GMY', 'GM', 8]); roles.push([`ROLE_${c}`, c, 'Genel Müdür Yardımcısı', 'EXEC']); }
for (let m = 1; m <= 35; m++) { const c = `MUD${String(m).padStart(2, '0')}`; mud.push(c); const g = gmy[(m - 1) % 12]!; saha.push([c, `${IL[m - 1]} Bölge Müdürlüğü`, 'MUDURLUK', g, 14]); roles.push([`ROLE_${c}`, c, 'Bölge Müdürü', 'REGION_MANAGER']); }
for (let s = 1; s <= 400; s++) { const c = `SB${String(s).padStart(3, '0')}`; sube.push(c); const m = mud[(s - 1) % 35]!; saha.push([c, `${IL[(s - 1) % 35]} ${['Merkez', 'Çarşı', 'Sanayi', 'Üniversite', 'Liman', 'Otogar', 'Kordon', 'Meydan', 'Cadde', 'Park', 'Yeni', 'Eski'][s % 12]} Şubesi`, 'SUBE', m, 9 + (s % 17)]); roles.push([`ROLE_${c}`, c, 'Şube Müdürü', 'UNIT_MANAGER']); }
for (let a = 1; a <= 200; a++) { const c = `ALT${String(a).padStart(3, '0')}`; alt.push(c); const s = sube[(a - 1) * 2]!; saha.push([c, `${['Gişe', 'Bireysel', 'KOBİ', 'Operasyon'][a % 4]} Ekibi`, 'EKIP', s, a % 9 === 0 ? 3 : 5 + (a % 6)]); roles.push([`ROLE_${c}`, c, 'Ekip Lideri', 'ACTION_OWNER']); }
roles.push(['ROLE_HRBP_1', 'GMY01', 'İK İş Ortağı (GMY-1)', 'HR_PARTNER'], ['ROLE_HRBP_2', 'GMY02', 'İK İş Ortağı (GMY-2)', 'HR_PARTNER'], ['ROLE_HRBP_3', 'GMY07', 'İK İş Ortağı (GMY-7)', 'HR_PARTNER']);
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
const tSaha = await api<{ id: string }>('POST', '/api/platform/tenants', { code: 'SAHA', name: 'Saha Bankacılık A.Ş. (sentetik)', adminEmail: 'ik@saha.demo.hpw-act.local', adminName: 'Saha İK Direktörü' }, 'platform');
log('SAHA şirketi', tSaha.id); const r1 = await importDirect('org', tSaha.id, PUID, orgSheets('SAHA', saha, roles)); log('SAHA org', JSON.stringify(r1.applied));
// ---------- 2 FABRIKA (farklı yapı: fabrika-merkez, departman, vardiya)
const fab: U[] = [['GMZ', 'Genel Merkez', 'ROOT', null, 60], ['F1', 'Gebze Fabrikası', 'FABRIKA', 'GMZ', 820], ['F2', 'Manisa Fabrikası', 'FABRIKA', 'GMZ', 540], ['MRK-FIN', 'Finans Müdürlüğü', 'DEPT', 'GMZ', 6], ['MRK-IK', 'İnsan ve Kültür', 'DEPT', 'GMZ', 9], ['MRK-SAT', 'Satış ve Pazarlama', 'DEPT', 'GMZ', 22]];
for (const f of ['F1', 'F2']) for (const d of [['URT', 'Üretim'], ['BKM', 'Bakım'], ['KAL', 'Kalite'], ['LOJ', 'Lojistik']]) { fab.push([`${f}-${d[0]}`, `${d[1]} (${f})`, 'DEPT', f, f === 'F1' ? 180 : 110]); if (d[0] === 'URT') for (const v of ['A', 'B', 'C']) fab.push([`${f}-URT-${v}`, `${v} Vardiyası (${f})`, 'VARDIYA', `${f}-URT`, f === 'F1' ? 140 : 90]); }
const fabRoles: [string, string, string, string][] = [['ROLE_HR', 'GMZ', 'İnsan ve Kültür Lideri', 'HR_ADMIN'], ['ROLE_CEO', 'GMZ', 'Genel Müdür', 'EXEC'], ['ROLE_F1', 'F1', 'Fabrika Direktörü', 'REGION_MANAGER'], ['ROLE_F2', 'F2', 'Fabrika Direktörü', 'REGION_MANAGER'], ['ROLE_HRBP_F1', 'F1', 'Fabrika İK İş Ortağı', 'HR_PARTNER']];
for (const u of fab) if (u[2] === 'DEPT' && u[0].startsWith('F')) fabRoles.push([`ROLE_${u[0]}`, u[0], `${u[1].split(' (')[0]} Müdürü`, 'UNIT_MANAGER']); else if (u[2] === 'VARDIYA') fabRoles.push([`ROLE_${u[0]}`, u[0], 'Vardiya Amiri', 'ACTION_OWNER']); else if (u[2] === 'DEPT') fabRoles.push([`ROLE_${u[0]}`, u[0], `${u[1]} Müdürü`, 'UNIT_MANAGER']);
const tFab = await api<{ id: string }>('POST', '/api/platform/tenants', { code: 'FABRIKA', name: 'Anka Endüstri Sanayi A.Ş. (sentetik)', adminEmail: 'ik@anka.demo.hpw-act.local', adminName: 'Anka İnsan ve Kültür Lideri' }, 'platform');
log('FABRIKA şirketi', tFab.id); const r2 = await importDirect('org', tFab.id, PUID, orgSheets('FABRIKA', fab, fabRoles)); log('FABRIKA org', JSON.stringify(r2.applied));
// ilk yetkililer davet → kabul
for (const [t, who, email] of [[tSaha.id, 'hr-SAHA', 'ik@saha.demo.hpw-act.local'], [tFab.id, 'hr-FAB', 'ik@anka.demo.hpw-act.local']] as const) { await api('POST', `/api/t/${t}/invitations/send`, {}, 'platform'); await accept(email, who); }
// ---------- 3 soru setleri (standart kütüphane tamamı + özel sorular; 2026 sürümünde bir özel soru metni değişir, biri yeni)
const cat = await api<{ items: { code: string }[] }>('GET', `/api/t/${tSaha.id}/instruments/catalog`, undefined, 'hr-SAHA'); const ALL = cat.items.map(i => i.code);
const sahaCustom = [{ code: 'SAHA-01', text: 'Şubemde müşteri yoğunluğuna göre kadro planlaması yapılır.', scaleCode: 'L5' }, { code: 'SAHA-02', text: 'Kasa açık/fazla süreçleri adil biçimde yönetilir.', scaleCode: 'L5' }];
const iv1 = await api<{ instrumentVersionId: string }>('POST', `/api/t/${tSaha.id}/instruments`, { version: '2025-v1', standardItemCodes: ALL, customItems: sahaCustom }, 'hr-SAHA');
const iv2 = await api<{ instrumentVersionId: string }>('POST', `/api/t/${tSaha.id}/instruments`, { version: '2026-v1', standardItemCodes: ALL, customItems: [sahaCustom[0]!, { code: 'SAHA-02', text: 'Kasa farkı süreçleri şeffaf ve adil yönetilir.', scaleCode: 'L5' }, { code: 'SAHA-03', text: 'Dijital kanal hedefleri şube gerçeğiyle uyumludur.', scaleCode: 'L5' }] }, 'hr-SAHA');
const fabCustom = [{ code: 'FAB-01', text: 'Vardiya planım en az iki hafta önce açıklanır.', scaleCode: 'L5' }, { code: 'FAB-02', text: 'Hattımdaki iş güvenliği önerileri dikkate alınır.', scaleCode: 'L5' }];
const fv1 = await api<{ instrumentVersionId: string }>('POST', `/api/t/${tFab.id}/instruments`, { version: '2025-v1', standardItemCodes: ALL, customItems: fabCustom }, 'hr-FAB');
const fv2 = await api<{ instrumentVersionId: string }>('POST', `/api/t/${tFab.id}/instruments`, { version: '2026-v1', standardItemCodes: ALL, customItems: [fabCustom[0]!, fabCustom[1]!, { code: 'FAB-03', text: 'Bakım duruşları üretim planına zamanında yansıtılır.', scaleCode: 'L5' }] }, 'hr-FAB');
// ---------- 4 dönemler
async function cycle(tid: string, who: string, code: string, ps: string, pe: string, iv: string) { return (await api<{ id: string }>('POST', `/api/t/${tid}/cycles`, { code, name: code.replace('-ANA', ' Ana Ölçüm'), periodStart: ps, periodEnd: pe, instrumentVersionId: iv }, who)).id; }
const sC1 = await cycle(tSaha.id, 'hr-SAHA', '2025-ANA', '2025-04-07', '2025-04-25', iv1.instrumentVersionId), sC2 = await cycle(tSaha.id, 'hr-SAHA', '2026-ANA', '2026-04-06', '2026-04-24', iv2.instrumentVersionId);
const fC1 = await cycle(tFab.id, 'hr-FAB', '2025-ANA', '2025-05-05', '2025-05-23', fv1.instrumentVersionId), fC2 = await cycle(tFab.id, 'hr-FAB', '2026-ANA', '2026-05-04', '2026-05-22', fv2.instrumentVersionId);
// ---------- 5 sonuçlar: birim×madde tek yanıt dağılımı; göstergeler aynı dağılımdan; küçük gruplar gizli; birim bazlı iyileşme/gerileme
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
const sM1 = await metricsOf(tSaha.id, iv1.instrumentVersionId), sM2 = await metricsOf(tSaha.id, iv2.instrumentVersionId);
log('SAHA 2025 sonuçları…'); log(JSON.stringify((await importDirect('results', tSaha.id, PUID, resultSheets('SAHA', '2025-ANA', saha, sM1, 'FULL_REPLACE', 2025), sC1)).applied));
const fM1 = await metricsOf(tFab.id, fv1.instrumentVersionId), fM2 = await metricsOf(tFab.id, fv2.instrumentVersionId);
log('FABRIKA 2025 sonuçları…'); log(JSON.stringify((await importDirect('results', tFab.id, PUID, resultSheets('FABRIKA', '2025-ANA', fab, fM1, 'FULL_REPLACE', 2025), fC1)).applied));
// ---------- 6 kullanıcılar (SAHA 500; FABRIKA ~30): e-posta = kullanıcı adı; rol ve kapsam dosyada; ek erişim HRBP; süresi biten vekâlet
function userRows(tcode: string, dom: string, rl: [string, string, string, string][], limit: number, extra: { email: string; name: string; role: string; from: string; to?: string }[] = []) {
  const users: Record<string, unknown>[] = [], assigns: Record<string, unknown>[] = [], seenEmail = new Set<string>(); let i = 0;
  for (const r of rl) { if (r[3] === 'HR_ADMIN') continue; if (users.length >= limit) break; const name = `${pick(AD)} ${pick(SOY)}`; let email = `${r[1].toLocaleLowerCase('en-US')}.${name.split(' ')[1]!.toLocaleLowerCase('tr-TR').replace(/[^a-z]/g, '') || 'kisi'}@${dom}`; while (seenEmail.has(email)) email = email.replace('@', `${++i}@`); seenEmail.add(email); users.push({ tenant_code: tcode, operation: 'CREATE', email, display_name: name, locale: 'tr', timezone: 'Europe/Istanbul', login_method: 'LOCAL_PASSWORD', invite_requested: 'YES' }); assigns.push({ tenant_code: tcode, operation: 'CREATE', email, role_code: r[0], assignment_kind: 'PRIMARY', valid_from: '2025-01-01' }); }
  for (const e of extra) { users.push({ tenant_code: tcode, operation: 'CREATE', email: e.email, display_name: e.name, locale: 'tr', timezone: 'Europe/Istanbul', login_method: 'LOCAL_PASSWORD', invite_requested: 'YES' }); assigns.push({ tenant_code: tcode, operation: 'CREATE', email: e.email, role_code: e.role, assignment_kind: 'DELEGATE', valid_from: e.from, valid_to: e.to ?? '' }); }
  return { users, assigns };
}
const rolesOrdered = [...roles.filter(r => r[3] !== 'HR_ADMIN' && !r[0].startsWith('ROLE_ALT')), ...roles.filter(r => r[0].startsWith('ROLE_ALT'))]; // 1 GM + 12 GMY + 3 HRBP + 35 MÜD + 400 şube + ilk 47 alt birim = 498 (+ 2 vekil + izleyici + İK = 502)
const sU = userRows('SAHA', 'saha.demo.hpw-act.local', rolesOrdered, 498, [{ email: 'vekil.sb001@saha.demo.hpw-act.local', name: 'Vekil Şube Müdürü (süresi bitti)', role: 'ROLE_SB001', from: '2026-01-15', to: '2026-06-30' }, { email: 'vekil.sb002@saha.demo.hpw-act.local', name: 'Vekil Şube Müdürü (aktif)', role: 'ROLE_SB002', from: '2026-08-01', to: '2026-12-31' }]);
const sUsers: Record<string, Sheet> = { Kullanicilar: sheet('Kullanicilar', ['tenant_code', 'operation', 'email', 'display_name', 'locale', 'timezone', 'login_method', 'invite_requested'], sU.users), Rol_Atamalari: sheet('Rol_Atamalari', ['tenant_code', 'operation', 'email', 'role_code', 'assignment_kind', 'valid_from', 'valid_to'], sU.assigns), Ek_Erisim: sheet('Ek_Erisim', ['tenant_code', 'email', 'scope_code', 'access_profile', 'include_descendants'], [{ tenant_code: 'SAHA', email: 'izleyici.gmy03@saha.demo.hpw-act.local', scope_code: 'GMY03', access_profile: 'VIEWER', include_descendants: 'YES' }]) };
sUsers.Kullanicilar!.rows.push({ n: 9999, cells: { tenant_code: 'SAHA', operation: 'CREATE', email: 'izleyici.gmy03@saha.demo.hpw-act.local', display_name: 'Kapsamlı İzleyici (GMY-3)', locale: 'tr', timezone: 'Europe/Istanbul', login_method: 'LOCAL_PASSWORD', invite_requested: 'YES' } });
log('SAHA kullanıcıları…'); log(JSON.stringify((await importDirect('users', tSaha.id, PUID, sUsers)).applied));
const fU = userRows('FABRIKA', 'anka.demo.hpw-act.local', fabRoles, 60);
log('FABRIKA kullanıcıları…'); log(JSON.stringify((await importDirect('users', tFab.id, PUID, { Kullanicilar: sheet('Kullanicilar', ['tenant_code', 'operation', 'email', 'display_name', 'locale', 'timezone', 'login_method', 'invite_requested'], fU.users), Rol_Atamalari: sheet('Rol_Atamalari', ['tenant_code', 'operation', 'email', 'role_code', 'assignment_kind', 'valid_from', 'valid_to'], fU.assigns), Ek_Erisim: sheet('Ek_Erisim', ['tenant_code', 'email', 'scope_code', 'access_profile', 'include_descendants'], []) })).applied));
// davetler: tümü gönderilir (sandbox kutusu); bir kısmı kabul edilir; birkaçı kalıcı başarısız / gecikmiş bırakılır
const sent1 = await api<{ queued: number; delivery: { processed: number } }>('POST', `/api/t/${tSaha.id}/invitations/send`, {}, 'hr-SAHA'); log('SAHA davet', JSON.stringify(sent1));
const sent2 = await api<{ queued: number }>('POST', `/api/t/${tFab.id}/invitations/send`, {}, 'hr-FAB'); log('FABRIKA davet', JSON.stringify(sent2));
const emailOfRole = (rows: Record<string, unknown>[], role: string) => String(rows.find(a => a.role_code === role)!.email);
const ACCEPT_S = ['ROLE_HRBP_1', 'ROLE_HRBP_2', 'ROLE_GMY01', 'ROLE_MUD01', 'ROLE_MUD02', ...Array.from({ length: 24 }, (_, i) => `ROLE_SB${String(i + 1).padStart(3, '0')}`), 'ROLE_ALT001', 'ROLE_ALT002', 'ROLE_ALT003'];
for (const r of ACCEPT_S) await accept(emailOfRole(sU.assigns, r), r);
await accept('vekil.sb002@saha.demo.hpw-act.local', 'VEKIL2'); await accept('izleyici.gmy03@saha.demo.hpw-act.local', 'IZLEYICI');
const ACCEPT_F = ['ROLE_HRBP_F1', 'ROLE_F1', 'ROLE_F1-URT', 'ROLE_F1-BKM', 'ROLE_F2-URT', 'ROLE_F1-URT-A', 'ROLE_MRK-SAT'];
for (const r of ACCEPT_F) await accept(emailOfRole(fU.assigns, r), r);
await withContext({ realm: 'worker' }, tx => tx.query("UPDATE email_outbox SET status = 'perm_fail', last_error = 'sentetik: alıcı sunucusu adresi reddetti (5.1.1)' WHERE id IN (SELECT id FROM email_outbox WHERE to_email LIKE '%@saha.demo.hpw-act.local' AND status = 'sent' ORDER BY created_at DESC LIMIT 3)"));
await withContext({ realm: 'platform', userId: PUID, tenantId: tSaha.id, platformWrite: true }, tx => tx.query("UPDATE invitation SET expires_at = now() - interval '2 days' WHERE tenant_id = $1 AND status = 'pending' AND id IN (SELECT id FROM invitation WHERE tenant_id = $1 AND status = 'pending' ORDER BY created_at LIMIT 4)", [tSaha.id])); // gecikmiş/süresi dolmuş davetler
// ---------- 7 zincir: 2025 sonucundan hedef → aksiyon → kanıt → beyan → doğrulama (senaryolar)
const unitId = async (tid: string, cid: string, who: string, code: string) => ((await api<{ id: string; code: string }[]>('GET', `/api/t/${tid}/cycles/${cid}/units`, undefined, who)).find(u => u.code === code) ?? (() => { throw new Error('birim yok ' + code); })()).id;
const HR_OF: Record<string, string> = {}; // v2.12 pilot: hedef incelemesini şirketin kendi İK yöneticisi yapar
async function chain(tid: string, cid: string, who: string, unitCode: string, itemCode: string, tpl: string | { title: string; cadence: string }, evidenceDates: string[], finish: 'verified' | 'declared' | 'in_progress' | 'paused' | 'rejected', verifier?: string) {
  const uid = await unitId(tid, cid, who, unitCode);
  const t = await api<{ id: string; status: string }>('POST', `/api/t/${tid}/cycles/${cid}/units/${uid}/targets`, { itemCode }, who, [200, 409, 422]); if (!t.id) return null;
  if (t.status === 'under_review') await api('POST', `/api/t/${tid}/targets/${t.id}/review`, { decision: 'accept', reason: 'demo: yerel hedef metodoloji incelemesinden geçti' }, HR_OF[tid] ?? (tid === tSaha.id ? 'hr-SAHA' : 'hr-FAB'));
  const a = await api<{ id: string }>('POST', `/api/t/${tid}/targets/${t.id}/actions`, typeof tpl === 'string' ? { templateCode: tpl, startDate: '2025-05-01', dueDate: '2025-10-31' } : { custom: tpl, startDate: '2025-05-01', dueDate: '2025-10-31' }, who, [200, 409, 422]); if (!a.id) return { target: t.id };
  for (const d of evidenceDates) await api('POST', `/api/t/${tid}/actions/${a.id}/evidence`, { date: d, attendance: 4 + Math.floor(rnd() * 8) }, who, [200, 422]);
  if (finish === 'paused') { await api('POST', `/api/t/${tid}/actions/${a.id}/transition`, { to: 'paused', reason: 'demo: bütçe onayı bekleniyor' }, who); return { target: t.id, action: a.id }; }
  if (finish !== 'in_progress') { await api('POST', `/api/t/${tid}/actions/${a.id}/declare-complete`, {}, who, [200, 409]); }
  if (finish === 'verified' && verifier) await api('POST', `/api/t/${tid}/actions/${a.id}/verify`, { ok: true, reason: 'demo: takvim ve katılım kayıtları örneklemle kontrol edildi' }, verifier, [200, 422]);
  if (finish === 'rejected' && verifier) await api('POST', `/api/t/${tid}/actions/${a.id}/verify`, { ok: false, reason: 'demo: kayıtlar eksik; iş devam etmeli' }, verifier, [200, 422]);
  return { target: t.id, action: a.id };
}
const M6 = ['2025-05-13', '2025-06-10', '2025-07-08', '2025-08-12', '2025-09-09', '2025-10-14'];
log('SAHA zinciri…');
for (let i = 1; i <= 24; i++) { const code = `SB${String(i).padStart(3, '0')}`, who = `ROLE_${code}`; const gIdx = ((i - 1) % 35) % 12; const verifier = gIdx === 0 ? 'ROLE_HRBP_1' : gIdx === 1 ? 'ROLE_HRBP_2' : 'hr-SAHA'; // doğrulayıcı gerçek ağaçtaki kapsamlı HRBP, yoksa İK yöneticisi
  const finish = i % 6 === 1 ? 'verified' : i % 6 === 2 ? 'declared' : i % 6 === 3 ? 'in_progress' : i % 6 === 4 ? 'paused' : i % 6 === 5 ? 'rejected' : 'verified';
  await chain(tSaha.id, sC1, who, code, 'GUV-01', 'birebir-programi', finish === 'in_progress' ? M6.slice(0, 3) : finish === 'rejected' ? M6.slice(0, 2) : M6, finish as 'verified', verifier);
  if (i % 4 === 0) await chain(tSaha.id, sC1, who, code, 'GUR-01', 'takdir-ritmi', M6, 'declared'); // ikinci hedef: bağımsız doğrulama bekleyen kritik iş
  if (i % 8 === 0) await chain(tSaha.id, sC1, who, code, 'SAHA-01', { title: 'Yoğun saatlerde ek gişe personeli planı (özel madde)', cadence: 'monthly' }, M6.slice(0, 4), 'in_progress'); }
await chain(tSaha.id, sC1, 'ROLE_SB001', 'ALT001', 'BAS-03', 'hedef-netligi', ['2025-06-03', '2025-09-02'], 'verified', 'ROLE_HRBP_1'); // ALT001 → SB001 → MUD01 → GMY01
log('FABRIKA zinciri…');
await chain(tFab.id, fC1, 'ROLE_F1-URT', 'F1-URT', 'GUV-01', 'birebir-programi', M6, 'verified', 'ROLE_HRBP_F1');
await chain(tFab.id, fC1, 'ROLE_F1-URT', 'F1-URT', 'FAB-01', { title: 'Vardiya planını iki hafta önceden ilan et (özel madde)', cadence: 'biweekly' }, ['2025-05-06', '2025-05-20', '2025-06-03', '2025-06-17', '2025-07-01', '2025-07-15', '2025-07-29', '2025-08-12', '2025-08-26', '2025-09-09', '2025-09-23', '2025-10-07'], 'verified', 'ROLE_HRBP_F1');
await chain(tFab.id, fC1, 'ROLE_F1-BKM', 'F1-BKM', 'ISG-03', 'is-yuku-gozden-gecirme', M6.slice(0, 4), 'in_progress');
await chain(tFab.id, fC1, 'ROLE_F2-URT', 'F2-URT', 'GUR-01', 'takdir-ritmi', M6, 'declared');
await chain(tFab.id, fC1, 'ROLE_MRK-SAT', 'MRK-SAT', 'YET-01', 'yetki-devri', ['2025-06-12'], 'verified', 'hr-FAB');
// ---------- 8 takip dönemi sonuçları (2026) ve takip değerlendirmeleri; bir madde takipte ölçülmedi (SAHA-02 metni değişti → inceleme; GUR-01 bazı birimlerde eksik)
log('SAHA 2026 sonuçları…'); log(JSON.stringify((await importDirect('results', tSaha.id, PUID, resultSheets('SAHA', '2026-ANA', saha, sM2, 'FULL_REPLACE', 2026), sC2)).applied));
log('FABRIKA 2026 sonuçları…'); log(JSON.stringify((await importDirect('results', tFab.id, PUID, resultSheets('FABRIKA', '2026-ANA', fab, fM2, 'FULL_REPLACE', 2026, new Set(['ISG-03'])), fC2)).applied));
for (const [tid, cid, cid2, who, hr, codes] of [[tSaha.id, sC1, sC2, 'hr-SAHA', 'hr-SAHA', ['SB001', 'SB002', 'SB004', 'SB008']], [tFab.id, fC1, fC2, 'hr-FAB', 'hr-FAB', ['F1-URT', 'F1-BKM', 'F2-URT']]] as const) for (const c of codes) {
  const uid = await unitId(tid, cid, who, c); const targets = await api<{ id: string; status: string }[]>('GET', `/api/t/${tid}/cycles/${cid}/units/${uid}/targets`, undefined, who);
  for (const t of targets.filter(x => ['accepted', 'active'].includes(x.status))) { const fu = await api<{ status?: string; outcome?: { status: string }; comparability?: { version: string }; followup?: { revision: number } }>('GET', `/api/t/${tid}/targets/${t.id}/followup?cycleId=${cid2}`, undefined, who, [200, 409, 422]); if (fu.outcome?.status === 'PENDING_REVIEW' && c !== 'SB004') await api('POST', `/api/t/${tid}/targets/${t.id}/followup/review`, { cycleId: cid2, decision: 'comparable_labeled', comparabilityVersion: fu.comparability!.version, resultVersion: `R${fu.followup!.revision}` }, hr, [200, 409, 422]); }
}
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
await withContext({ realm: 'worker' }, tx => tx.query("UPDATE tenant SET created_at = now() - interval '20 days' WHERE code IN ('PILOT01','PILOT02','PILOT04','PILOT05','PILOT07')"));
// HPW danışmanı: 10 pilot şirkete ana danışman (kapsam sınırı sınaması için 10 şirketi görür)
const DAN_EMAIL = 'danisman@demo.hpw-act.local';
const dan = await api<{ id: string }>('POST', '/api/platform/staff', { email: DAN_EMAIL, displayName: 'HPW Pilot Danışmanı', role: 'consultant', tenantIds: PILOT.slice(0, 10).map(p => p.id), duty: 'primary', reason: 'pilot: danışman portföyü' }, 'platform');
{ const tok = tokenFor(DAN_EMAIL, 'parola'); if (!tok) throw new Error('danışman parola bağlantısı yok'); const r = await app.inject({ method: 'POST', url: `/api/auth/reset/${tok}`, payload: { password: PLATFORM_PW } }); if (r.statusCode !== 200) throw new Error('danışman parola ' + r.body); }
log('pilot danışman', dan.id);
await withContext({ realm: 'worker' }, tx => tx.query('DELETE FROM platform_mfa')); // tohumun geçici doğrulama kayıtları: demo ilk girişte kurulur
// ---------- 9 giriş bilgileri dosyası
const creds = `# DOLU DEMO giriş bilgileri (sentetik; yalnız demo ortamı)\n\nPlatform (HPW): ${PLATFORM_EMAIL} / ${PLATFORM_PW}\n(v2.9.0: HPW personeli ilk girişte telefonundaki doğrulama uygulamasını kurar; sonraki girişlerde 6 haneli kod ister. Kurulumda gösterilen 10 kurtarma kodunu saklayın.)\nSAHA İK Direktörü: ik@saha.demo.hpw-act.local / ${USER_PW}\nFABRIKA İnsan ve Kültür Lideri: ik@anka.demo.hpw-act.local / ${USER_PW}\nSAHA HRBP (GMY-1 kapsamı): ${emailOfRole(sU.assigns, 'ROLE_HRBP_1')} / ${USER_PW}\nSAHA GMY-1: ${emailOfRole(sU.assigns, 'ROLE_GMY01')} / ${USER_PW}\nSAHA Bölge Müdürü (MUD01): ${emailOfRole(sU.assigns, 'ROLE_MUD01')} / ${USER_PW}\nSAHA Şube Müdürü (SB001, doğrulanmış iş): ${emailOfRole(sU.assigns, 'ROLE_SB001')} / ${USER_PW}\nSAHA Şube Müdürü (SB002, bağımsız doğrulama bekliyor): ${emailOfRole(sU.assigns, 'ROLE_SB002')} / ${USER_PW}\nSAHA Şube Müdürü (SB003, tamamlanmamış aksiyon): ${emailOfRole(sU.assigns, 'ROLE_SB003')} / ${USER_PW}\nSAHA Ekip Lideri (ALT001): ${emailOfRole(sU.assigns, 'ROLE_ALT001')} / ${USER_PW}\nSAHA kapsamlı izleyici (GMY-3): izleyici.gmy03@saha.demo.hpw-act.local / ${USER_PW}\nSAHA aktif vekil (SB002): vekil.sb002@saha.demo.hpw-act.local / ${USER_PW}\nSAHA süresi biten vekil (SB001): vekil.sb001@saha.demo.hpw-act.local (davet kabul edilmedi; yetkisi 2026-06-30'da bitti)\nFABRIKA HRBP: ${emailOfRole(fU.assigns, 'ROLE_HRBP_F1')} / ${USER_PW}\nFABRIKA Üretim Müdürü (F1-URT): ${emailOfRole(fU.assigns, 'ROLE_F1-URT')} / ${USER_PW}\nFABRIKA Vardiya Amiri (F1-URT-A): ${emailOfRole(fU.assigns, 'ROLE_F1-URT-A')} / ${USER_PW}\n\nDiğer ${sU.users.length - ACCEPT_S.length} SAHA ve ${fU.users.length - ACCEPT_F.length} FABRIKA kullanıcısının daveti gönderildi ama kabul edilmedi (davet e-postaları: ${config.mailDir}). 3 davet kalıcı başarısız, 4 davet süresi dolmuş olarak bırakıldı.\n`;
const credsPilot = creds + `\n\n## Pilot (20 şirket)\n\nHPW danışmanı (10 pilot şirkete atanmış): ${DAN_EMAIL} / ${PLATFORM_PW} (ilk girişte doğrulama uygulaması kurulur)\n` + PILOT.map(p => `${p.code} İK yöneticisi: ${p.email} / ${USER_PW}${p.mgrEmail ? ` · Operasyon müdürü: ${p.mgrEmail} / ${USER_PW}` : ''}`).join('\n') + '\n';
mkdirSync(join(apiRoot, 'var'), { recursive: true }); writeFileSync(join(apiRoot, 'var', 'DEMO-GIRIS-BILGILERI.md'), credsPilot); console.log(credsPilot);
await app.close(); process.exit(0);
