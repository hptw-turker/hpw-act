/** R01–R44 regresyon testleri (gerçek PostgreSQL, hpw_api rolü). Her test bir bulguyu yeniden üretir ve düzeltilmiş davranışı doğrular. */
import { ensureMfa } from './mfa-helper.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import pg from 'pg';
import { buildApp } from '../src/server.js';
import { config } from '../src/config.js';

let app: Awaited<ReturnType<typeof buildApp>>;
const cookies: Record<string, string> = {};
const cookieOf = (res: { headers: Record<string, unknown> }) => { const sc = res.headers['set-cookie']; const raw = Array.isArray(sc) ? sc[0] : String(sc ?? ''); return raw.split(';')[0]!; };
type J = Record<string, unknown> & Record<string, never>;
async function api(method: 'GET' | 'POST' | 'PATCH', url: string, body?: unknown, who?: string, headers: Record<string, string> = {}) { const res = await app.inject({ method, url, payload: body as Record<string, unknown> | undefined, headers: { ...(who ? { cookie: cookies[who]! } : {}), ...headers } }); let json: unknown = null; try { json = JSON.parse(res.body); } catch { json = res.body; } return { status: res.statusCode, body: json as J, res }; }
async function upload(url: string, who: string, buf: Buffer) { const boundary = '----hpw' + Date.now(); const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="d.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`); const res = await app.inject({ method: 'POST', url, payload: Buffer.concat([head, buf, Buffer.from(`\r\n--${boundary}--\r\n`)]), headers: { cookie: cookies[who]!, 'content-type': `multipart/form-data; boundary=${boundary}` } }); return { status: res.statusCode, body: JSON.parse(res.body) as J }; }
async function download(url: string, who: string) { const res = await app.inject({ method: 'GET', url, headers: { cookie: cookies[who]! } }); assert.equal(res.statusCode, 200, res.body.slice(0, 200)); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(res.rawPayload as unknown as ArrayBuffer); return wb; }
const toBuf = async (wb: ExcelJS.Workbook) => Buffer.from(await wb.xlsx.writeBuffer());
function fillSheet(wb: ExcelJS.Workbook, name: string, rows: Record<string, unknown>[], clear = false) { const ws = wb.getWorksheet(name)!; const header = (ws.getRow(1).values as unknown[]).slice(1).map(v => String(v ?? '')); if (clear) while (ws.rowCount > 1) ws.spliceRows(2, 1); for (const r of rows) ws.addRow(header.map(h => r[h] ?? '')); }
function mailTokenFor(email: string, kind: 'davet' | 'parola'): string { const files = readdirSync(config.mailDir).filter(f => f.endsWith('.eml')).map(f => ({ f, t: readFileSync(`${config.mailDir}/${f}`, 'utf8') })).filter(x => x.t.includes(`To: ${email}`) && x.t.includes(`#/${kind}/`)).map(x => ({ ...x, d: /Date: (\S+)/.exec(x.t)?.[1] ?? '' })).sort((a, b) => a.d < b.d ? 1 : -1); assert.ok(files.length, `${kind} e-postası yok: ${email}`); return new RegExp(`#/${kind}/([A-Za-z0-9_-]+)`).exec(files[0]!.t)![1]!; }
async function login(email: string, who: string, password: string) { const r = await api('POST', '/api/auth/login', { email, password }); assert.equal(r.status, 200, JSON.stringify(r.body)); cookies[who] = cookieOf(r.res); if (r.body.realm === 'platform') await ensureMfa((m, u, b) => api(m, u, b, who) as never, email); return r.body; }
async function accept(email: string, who: string, password: string) { const token = mailTokenFor(email, 'davet'); const r = await api('POST', `/api/invitations/${token}/accept`, { password }); assert.equal(r.status, 200, JSON.stringify(r.body)); cookies[who] = cookieOf(r.res); return r.body; }
const S = Date.now().toString(36).toLocaleUpperCase('en-US').slice(-5); const dom = `r${S.toLocaleLowerCase('en-US')}.test`;
const PW = 'Parola12345', PW2 = 'Yeni-Parola-9876';
const T: Record<string, { id: string; code: string; iv?: string; cycle?: string; cycle2?: string; units?: Record<string, string>; target?: string; target2?: string; action?: string }> = {};
before(async () => { mkdirSync(config.mailDir, { recursive: true }); app = await buildApp(); });
after(async () => { await app.close(); });

const ORG = (tcode: string, wb: ExcelJS.Workbook) => {
  fillSheet(wb, 'Birim_Tipleri', [{ tenant_code: tcode, unit_type_code: 'ROOT', label: 'Genel Müdürlük' }, { tenant_code: tcode, unit_type_code: 'REGION', label: 'Bölge' }, { tenant_code: tcode, unit_type_code: 'SITE', label: 'Şube' }], true);
  const units: [string, string, string, string?][] = [['HQ', 'Genel Müdürlük', 'ROOT'], ['A', 'A Bölgesi', 'REGION', 'HQ'], ['B', 'B Bölgesi', 'REGION', 'HQ'], ['A1', 'A1 Şubesi', 'SITE', 'A'], ['A2', 'A2 Şubesi', 'SITE', 'A'], ['B1', 'B1 Şubesi', 'SITE', 'B']];
  fillSheet(wb, 'Birimler', units.map(u => ({ tenant_code: tcode, operation: 'CREATE', unit_code: u[0], unit_name: u[1], unit_type_code: u[2], timezone: 'Europe/Istanbul', valid_from: '2026-01-01', headcount: u[2] === 'SITE' ? 24 : 6 })), true);
  fillSheet(wb, 'Hiyerarsiler', [{ tenant_code: tcode, hierarchy_code: 'SURVEY', label: 'Anket ağacı', purpose: 'SURVEY_ROLLUP' }], true);
  fillSheet(wb, 'Iliskiler', units.filter(u => u[3]).map(u => ({ tenant_code: tcode, operation: 'CREATE', hierarchy_code: 'SURVEY', child_unit: u[0], parent_unit: u[3], relation_type: 'REPORTS_TO', valid_from: '2026-01-01' })), true);
  fillSheet(wb, 'Org_Rolleri', [['ROLE_HR', 'HQ', 'İK Direktörü', 'HR_ADMIN'], ['ROLE_A', 'A', 'A Bölge Direktörü', 'REGION_MANAGER'], ['ROLE_B', 'B', 'B Bölge Direktörü', 'REGION_MANAGER'], ['ROLE_A1', 'A1', 'Şube Müdürü', 'UNIT_MANAGER'], ['ROLE_A2', 'A2', 'Şube Müdürü', 'UNIT_MANAGER'], ['ROLE_B1', 'B1', 'Şube Müdürü', 'UNIT_MANAGER'], ['ROLE_HRBP', 'HQ', 'İK İş Ortağı', 'HR_PARTNER']].map(r => ({ tenant_code: tcode, operation: 'CREATE', role_code: r[0], unit_code: r[1], title: r[2], permission_profile: r[3], valid_from: '2026-01-01' })), true);
};
const usersRows = (tcode: string, list: [string, string, string?][]) => list.map(u => ({ tenant_code: tcode, operation: 'CREATE', email: u[0], display_name: u[1], locale: 'tr', timezone: 'Europe/Istanbul', login_method: 'LOCAL_PASSWORD', invite_requested: 'YES' }));

test('R01 davet kabulü → çıkış → aynı e-posta/parola ile giriş; üyelik sorgusu dar kapsamlı definer ile', async () => {
  const b = await api('POST', '/api/platform/bootstrap', { email: 'platform@hpw.test', password: 'Platform12345' }); assert.ok([200, 409].includes(b.status));
  await login('platform@hpw.test', 'platform', 'Platform12345');
  for (const [k, name] of [['GAMMA', 'Gamma'], ['DELTA', 'Delta']] as const) { const code = `${k}${S}`; const r = await api('POST', '/api/platform/tenants', { code, name, adminEmail: `ik@${k.toLocaleLowerCase('en-US')}.${dom}`, adminName: `${name} İK` }, 'platform'); assert.equal(r.status, 200, JSON.stringify(r.body)); T[k] = { id: r.body.id as string, code }; }
  for (const k of ['GAMMA', 'DELTA']) { const s = await api('POST', `/api/t/${T[k]!.id}/invitations/send`, {}, 'platform'); assert.equal(s.status, 200); await accept(`ik@${k.toLocaleLowerCase('en-US')}.${dom}`, `hr-${k}`, PW); }
  const out = await api('POST', '/api/auth/logout', {}, 'hr-GAMMA'); assert.equal(out.status, 200);
  assert.equal((await api('GET', '/api/auth/me', undefined, 'hr-GAMMA')).status, 401, 'çıkıştan sonra oturum yok');
  const lg = await login(`ik@gamma.${dom}`, 'hr-GAMMA', PW); assert.equal(lg.realm, 'customer'); assert.equal((lg.memberships as { code: string }[])[0]!.code, T['GAMMA']!.code);
  const me = await api('GET', '/api/auth/me', undefined, 'hr-GAMMA'); assert.equal(me.body.profile, 'HR_ADMIN'); assert.equal(me.body.companyWide, true); assert.equal(me.body.tenantId, T['GAMMA']!.id);
  const wrong = await api('POST', '/api/auth/login', { email: `ik@gamma.${dom}`, password: 'yanlis-parola-1' }); assert.equal(wrong.status, 401);
});
test('R02 platform personeli yalnız atandığı müşteriye erişir; parola kurma bağlantısı ile kurulur (R34)', async () => {
  const pu = await api('POST', '/api/platform/users', { email: `analist@hpw.${dom}`, displayName: 'Analist', tenantIds: [T['GAMMA']!.id] }, 'platform'); assert.equal(pu.status, 200, JSON.stringify(pu.body));
  const tok = mailTokenFor(`analist@hpw.${dom}`, 'parola'); const set = await api('POST', `/api/auth/reset/${tok}`, { password: PW }); assert.equal(set.status, 200);
  assert.equal((await api('POST', `/api/auth/reset/${tok}`, { password: PW })).status, 404, 'bağlantı tek kullanımlık');
  await login(`analist@hpw.${dom}`, 'analist', PW);
  assert.equal((await api('GET', `/api/t/${T['GAMMA']!.id}/overview`, undefined, 'analist')).status, 200, 'atanmış müşteri açılır');
  for (const path of ['overview', 'org', 'users', 'cycles', 'actions', 'attention']) assert.equal((await api('GET', `/api/t/${T['DELTA']!.id}/${path}`, undefined, 'analist')).status, 403, `atanmamış müşteri: ${path}`);
  assert.equal((await api('POST', `/api/t/${T['DELTA']!.id}/users`, { email: `x@${dom}`, displayName: 'X' }, 'analist')).status, 403, 'atanmamış müşteriye yazma yok');
  assert.equal((await api('POST', '/api/auth/switch-tenant', { tenantId: T['DELTA']!.id }, 'analist')).status, 403, 'geçiş de reddedilir');
  const users = await api('GET', `/api/t/${T['DELTA']!.id}/users`, undefined, 'hr-DELTA'); assert.equal(users.status, 200); assert.ok(!(users.body as unknown as { email: string }[]).some(u => u.email === `x@${dom}`), 'yazma etkisi yok');
});
test('R03/R05 kapsam: rolsüz kişi sıfır birim; HRBP yalnız kendi bölgesi; rol kapanınca yetki düşer', async () => {
  const t = T['GAMMA']!; const wb = await download(`/api/t/${t.id}/templates/org.xlsx`, 'hr-GAMMA'); ORG(t.code, wb);
  const up = await upload(`/api/t/${t.id}/imports/org`, 'hr-GAMMA', await toBuf(wb)); assert.equal(up.body.state, 'validated', JSON.stringify(up.body.issues)); assert.equal((await api('POST', `/api/t/${t.id}/imports/${up.body.jobId}/commit`, {}, 'hr-GAMMA')).status, 200);
  const inst = await api('POST', `/api/t/${t.id}/instruments`, { version: '2026-v1', standardItemCodes: ['GUV-01', 'GUR-01', 'BAG-03'], customItems: [{ code: 'OZ-01', text: 'Vardiya planım en az iki hafta önce açıklanır', dimension: 'İş yapısı', scaleCode: 'L5' }] }, 'hr-GAMMA'); assert.equal(inst.status, 200, JSON.stringify(inst.body)); t.iv = inst.body.instrumentVersionId as string;
  const cyc = await api('POST', `/api/t/${t.id}/cycles`, { code: '2026-ANA', name: '2026', periodStart: '2026-04-06', periodEnd: '2026-04-24', instrumentVersionId: t.iv }, 'hr-GAMMA'); assert.equal(cyc.status, 200, JSON.stringify(cyc.body)); t.cycle = cyc.body.id as string;
  const units = (await api('GET', `/api/t/${t.id}/cycles/${t.cycle}/units`, undefined, 'hr-GAMMA')).body as unknown as { id: string; code: string }[]; t.units = Object.fromEntries(units.map(u => [u.code, u.id]));
  const uwb = await download(`/api/t/${t.id}/templates/users.xlsx`, 'hr-GAMMA');
  fillSheet(uwb, 'Kullanicilar', usersRows(t.code, [[`izleyici@${dom}`, 'Rolsüz İzleyici'], [`hrbp-a@${dom}`, 'A HRBP'], [`a1@${dom}`, 'A1 Müdürü'], [`b1@${dom}`, 'B1 Müdürü'], [`bolge-a@${dom}`, 'A Direktörü'], [`gecici@${dom}`, 'Geçici Müdür']]), true);
  fillSheet(uwb, 'Rol_Atamalari', [[`a1@${dom}`, 'ROLE_A1'], [`b1@${dom}`, 'ROLE_B1'], [`bolge-a@${dom}`, 'ROLE_A'], [`gecici@${dom}`, 'ROLE_A2']].map(r => ({ tenant_code: t.code, operation: 'CREATE', email: r[0], role_code: r[1], assignment_kind: 'PRIMARY', valid_from: '2026-01-01' })), true);
  fillSheet(uwb, 'Ek_Erisim', [{ tenant_code: t.code, email: `hrbp-a@${dom}`, scope_code: 'A', access_profile: 'HR_PARTNER', include_descendants: 'YES' }], true);
  const uu = await upload(`/api/t/${t.id}/imports/users`, 'hr-GAMMA', await toBuf(uwb)); assert.equal(uu.body.state, 'validated', JSON.stringify(uu.body.issues)); assert.equal((await api('POST', `/api/t/${t.id}/imports/${uu.body.jobId}/commit`, {}, 'hr-GAMMA')).status, 200);
  assert.equal((await api('POST', `/api/t/${t.id}/invitations/send`, {}, 'hr-GAMMA')).status, 200);
  for (const who of ['izleyici', 'hrbp-a', 'a1', 'b1', 'bolge-a', 'gecici']) await accept(`${who}@${dom}`, who, PW);
  const none = await api('GET', `/api/t/${t.id}/cycles/${t.cycle}/units`, undefined, 'izleyici'); assert.equal(none.status, 200); assert.deepEqual(none.body, [], 'R03: rol/kapsam yoksa sıfır birim');
  assert.equal((await api('GET', `/api/t/${t.id}/cycles`, undefined, 'izleyici')).status, 200);
  const hrbpUnits = ((await api('GET', `/api/t/${t.id}/cycles/${t.cycle}/units`, undefined, 'hrbp-a')).body as unknown as { code: string }[]).map(u => u.code).sort(); assert.deepEqual(hrbpUnits, ['A', 'A1', 'A2'], 'R03: kapsamlı HRBP yalnız A ağacı');
  assert.equal((await api('GET', `/api/auth/me`, undefined, 'hrbp-a')).body.profile, 'HR_PARTNER');
  const me = await api('GET', '/api/auth/me', undefined, 'gecici'); assert.equal(me.body.profile, 'UNIT_MANAGER');
  // rol kapatma (org CLOSE) → yetki düşer, oturum açık kalsa da kapsam sıfır (R05)
  const cw = await download(`/api/t/${t.id}/templates/org.xlsx`, 'hr-GAMMA'); for (const sh of ['Birim_Tipleri', 'Birimler', 'Hiyerarsiler', 'Iliskiler']) fillSheet(cw, sh, [], true); fillSheet(cw, 'Org_Rolleri', [{ tenant_code: t.code, operation: 'CLOSE', role_code: 'ROLE_A2', unit_code: 'A2', title: 'Şube Müdürü', permission_profile: 'UNIT_MANAGER', valid_from: '2026-01-01', valid_to: '2026-06-30' }], true);
  const cu = await upload(`/api/t/${t.id}/imports/org`, 'hr-GAMMA', await toBuf(cw)); assert.equal(cu.body.state, 'validated', JSON.stringify(cu.body.issues)); assert.equal((await api('POST', `/api/t/${t.id}/imports/${cu.body.jobId}/commit`, {}, 'hr-GAMMA')).status, 200);
  const after_ = await api('GET', '/api/auth/me', undefined, 'gecici'); assert.equal(after_.body.profile, 'VIEWER', 'R05: rol kapanınca profil düşer'); assert.deepEqual((await api('GET', `/api/t/${t.id}/cycles/${t.cycle}/units`, undefined, 'gecici')).body, [], 'R05: kapsam sıfır');
});
test('R04 HRBP kendisine/başkasına HR_ADMIN veremez: XLSX ve API aynı sonucu verir', async () => {
  const t = T['GAMMA']!; const wb = await download(`/api/t/${t.id}/templates/users.xlsx`, 'hr-GAMMA');
  fillSheet(wb, 'Kullanicilar', usersRows(t.code, [[`yeni-admin@${dom}`, 'Yükseltme Denemesi']]), true); fillSheet(wb, 'Rol_Atamalari', [{ tenant_code: t.code, operation: 'CREATE', email: `yeni-admin@${dom}`, role_code: 'ROLE_HR', assignment_kind: 'PRIMARY', valid_from: '2026-01-01' }], true);
  const byHrbp = await upload(`/api/t/${t.id}/imports/users`, 'hrbp-a', await toBuf(wb)); assert.equal(byHrbp.status, 403, 'kullanıcı yükleme yalnız HR_ADMIN');
  assert.equal((await api('POST', `/api/t/${t.id}/users`, { email: `yeni-admin@${dom}`, displayName: 'x', roleCodes: ['ROLE_HR'] }, 'hrbp-a')).status, 403, 'API tek kullanıcı da 403');
  const byAdmin = await upload(`/api/t/${t.id}/imports/users`, 'hr-GAMMA', await toBuf(wb)); assert.equal(byAdmin.body.state, 'validated', 'HR_ADMIN verebilir');
});
test('R10 ikinci şirket daveti mevcut parolayı değiştirmez; pasif hesap oturum açamaz', async () => {
  const g = T['GAMMA']!, d = T['DELTA']!;
  const dwb = await download(`/api/t/${d.id}/templates/org.xlsx`, 'hr-DELTA'); ORG(d.code, dwb); const du = await upload(`/api/t/${d.id}/imports/org`, 'hr-DELTA', await toBuf(dwb)); assert.equal(du.body.state, 'validated'); await api('POST', `/api/t/${d.id}/imports/${du.body.jobId}/commit`, {}, 'hr-DELTA');
  const inv = await api('POST', `/api/t/${d.id}/users`, { email: `a1@${dom}`, displayName: 'A1 Müdürü (Delta)', roleCodes: ['ROLE_B1'] }, 'hr-DELTA'); assert.equal(inv.status, 200, JSON.stringify(inv.body));
  assert.equal((await api('POST', `/api/t/${d.id}/invitations/send`, {}, 'hr-DELTA')).status, 200);
  const token = mailTokenFor(`a1@${dom}`, 'davet'); const peek = await api('GET', `/api/invitations/${token}`); assert.equal(peek.body.hasPassword, true);
  assert.equal((await api('POST', `/api/invitations/${token}/accept`, { password: 'Baska-Parola-1' })).status, 401, 'yanlış mevcut parola daveti bağlayamaz');
  const ok = await api('POST', `/api/invitations/${token}/accept`, { password: PW }); assert.equal(ok.status, 200); assert.equal(ok.body.mode, 'membership_joined');
  await login(`a1@${dom}`, 'a1', PW); const me = await api('GET', '/api/auth/me', undefined, 'a1'); assert.equal((me.body.memberships as unknown[]).length, 2, 'iki şirket üyeliği');
  assert.equal((await api('POST', '/api/auth/switch-tenant', { tenantId: d.id }, 'a1')).status, 200); assert.equal((await api('GET', '/api/auth/me', undefined, 'a1')).body.tenantId, d.id);
  assert.equal((await api('POST', '/api/auth/switch-tenant', { tenantId: g.id }, 'a1')).status, 200);
  // Delta üyeliği iptal → yalnız Delta erişimi biter
  const mid = ((await api('GET', `/api/t/${d.id}/users`, undefined, 'hr-DELTA')).body as unknown as { membership_id: string; email: string }[]).find(u => u.email === `a1@${dom}`)!.membership_id;
  assert.equal((await api('POST', `/api/t/${d.id}/users/${mid}/revoke`, {}, 'hr-DELTA')).status, 200);
  assert.equal((await api('POST', '/api/auth/switch-tenant', { tenantId: d.id }, 'a1')).status, 403); await login(`a1@${dom}`, 'a1', PW);
});
test('R19/R20/R21/R22/R23/R24 sonuç dosyası sözleşmesi ve yayın soy bilgisi', async () => {
  const t = T['GAMMA']!;
  const build = async (opts: { conflict?: boolean; wrongCycle?: boolean; noPaket?: boolean; bench?: unknown[][]; only?: string[]; mode?: string }) => {
    const wb = await download(`/api/t/${t.id}/templates/results.xlsx?cycleId=${t.cycle}`, 'hr-GAMMA'); const ws = wb.getWorksheet('Sonuclar')!, dws = wb.getWorksheet('Dagilimlar')!;
    if (opts.mode) wb.getWorksheet('Paket')!.getRow(2).getCell(5).value = opts.mode;
    const seen = new Map<string, Record<string, number>>();
    ws.eachRow((row, n) => { if (n === 1) return; const unit = String(row.getCell(3).value), mc = String(row.getCell(4).value); if (!['A1', 'A2', 'B1'].includes(unit) || (opts.only && !opts.only.includes(`${unit}|${mc}`))) return; const item = mc.replace(/_(TB|NPS)$/, ''); const key = `${unit}|${item}`; const nn = 20; let d = seen.get(key); if (!d) { d = item === 'BAG-03' ? { '0': 2, '7': 6, '9': 4, '10': 8 } : { '1': 2, '2': 2, '3': 4, '4': 6, '5': 6 }; seen.set(key, d); } if (opts.conflict && mc === 'BAG-03_NPS') d = { '0': 20 }; const val = mc.endsWith('_NPS') ? Math.round((((d['9'] ?? 0) + (d['10'] ?? 0) - (d['0'] ?? 0)) / nn) * 1000) / 10 : item === 'BAG-03' ? Math.round((((d['9'] ?? 0) + (d['10'] ?? 0)) / nn) * 1000) / 10 : Math.round((((d['4'] ?? 0) + (d['5'] ?? 0)) / nn) * 1000) / 10; row.getCell(5).value = 'OBSERVED'; row.getCell(6).value = nn; row.getCell(7).value = String(val).replace('.', ','); if (opts.wrongCycle && unit === 'B1') row.getCell(2).value = '2025-ANA'; for (const [o, c] of Object.entries(d)) dws.addRow([t.code, '2026-ANA', unit, mc, o, c]); });
    if (opts.noPaket) wb.getWorksheet('Paket')!.getRow(2).getCell(4).value = null;
    for (const b of opts.bench ?? []) wb.getWorksheet('Benchmarklar')!.addRow(b);
    return upload(`/api/t/${t.id}/imports/results?cycleId=${t.cycle}`, 'hr-GAMMA', await toBuf(wb));
  };
  const codes = (r: { body: J }) => new Set((r.body.issues as { code: string }[]).map(i => i.code));
  const cf = codes(await build({ conflict: true })); assert.ok(cf.has('distribution_conflict'), 'R19: aynı sorunun TB ve NPS göstergeleri farklı dağılım taşıyamaz: ' + [...cf].join(','));
  assert.ok(codes(await build({ wrongCycle: true })).has('row_cycle_mismatch'), 'R21: satır düzeyi dönem kontrolü');
  assert.ok(codes(await build({ noPaket: true })).has('header_required'), 'R21: Paket üstbilgisi zorunlu');
  const bc = codes(await build({ bench: [[t.code, 'GUV-01_TB', 'certified', 999], [t.code, 'GUR-01_TB', 'certified', 50], [t.code, 'GUR-01_TB', 'certified', 90]] })); assert.ok(bc.has('out_of_range') && bc.has('duplicate_benchmark'), 'R20: benchmark sınır ve tekillik');
  const ok = await build({ bench: [[t.code, 'GUV-01_TB', 'certified', 66.5]] }); assert.equal(ok.body.state, 'validated', JSON.stringify((ok.body.issues as unknown[]).slice(0, 3)));
  // R23: doğrulamadan sonra soru seti değişirse commit yeniden doğrulama ister
  const inst2 = await api('POST', `/api/t/${t.id}/instruments`, { version: '2026-v2', standardItemCodes: ['GUV-01', 'GUR-01', 'BAG-03', 'GUR-02'], customItems: [] }, 'hr-GAMMA'); assert.equal(inst2.status, 200);
  assert.equal((await api('PATCH', `/api/t/${t.id}/cycles/${t.cycle}`, { instrumentVersionId: inst2.body.instrumentVersionId }, 'hr-GAMMA')).status, 200);
  const stale = await api('POST', `/api/t/${t.id}/imports/${ok.body.jobId}/commit`, {}, 'hr-GAMMA'); assert.equal(stale.status, 409); assert.equal(stale.body.error, 'revalidate_required');
  assert.equal((await api('PATCH', `/api/t/${t.id}/cycles/${t.cycle}`, { instrumentVersionId: t.iv }, 'hr-GAMMA')).status, 200);
  const fresh = await build({ bench: [[t.code, 'GUV-01_TB', 'certified', 66.5]] }); assert.equal(fresh.body.state, 'validated'); const c1 = await api('POST', `/api/t/${t.id}/imports/${fresh.body.jobId}/commit`, {}, 'hr-GAMMA'); assert.equal(c1.status, 200, JSON.stringify(c1.body));
  // R22: FULL_REPLACE eksik hücre → onay ister; PATCH taşır
  const partial = await build({ only: ['A1|GUV-01_TB'], mode: 'FULL_REPLACE' }); assert.equal(partial.body.state, 'validated', JSON.stringify(partial.body.issues)); assert.ok((partial.body.preview as { removedCells: number }).removedCells > 0);
  const c2 = await api('POST', `/api/t/${t.id}/imports/${partial.body.jobId}/commit`, {}, 'hr-GAMMA'); assert.equal(c2.status, 409); assert.equal(c2.body.error, 'confirm_replace_required');
  const patch = await build({ only: ['A1|GUV-01_TB'], mode: 'PATCH' }); assert.equal(patch.body.state, 'validated', JSON.stringify(patch.body.issues)); assert.equal((patch.body.preview as { removedCells: number }).removedCells, 0); assert.ok((patch.body.preview as { carriedCells: number }).carriedCells > 0);
  const c3 = await api('POST', `/api/t/${t.id}/imports/${patch.body.jobId}/commit`, {}, 'hr-GAMMA'); assert.equal(c3.status, 200, JSON.stringify(c3.body)); assert.ok(((c3.body.applied as { carried: number }).carried) > 0, 'R22: PATCH değişmeyen sonuçları taşıdı');
  const res = await api('GET', `/api/t/${t.id}/cycles/${t.cycle}/units/${t.units!['B1']}/results`, undefined, 'hr-GAMMA'); assert.equal(res.status, 200); assert.ok((res.body.rows as unknown[]).length >= 3, 'B1 sonuçları PATCH sonrası aktif kümede');
  // R24: kaynak referansı satırda (doğrudan DB, tenant bağlamıyla)
  const client = new pg.Client({ connectionString: config.databaseUrl }); await client.connect();
  try { await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [t.id]); const r = await client.query("SELECT COUNT(*)::int AS c FROM result WHERE tenant_id = $1 AND carried_from_batch_id IS NOT NULL", [t.id]); assert.ok(r.rows[0].c > 0, 'taşınan satırların soy bilgisi var'); const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'result' AND column_name IN ('source_reference','carried_from_batch_id')"); assert.equal(cols.rowCount, 2); } finally { await client.end(); }
});
test('R06/R07/R08/R14/R15/R25/R26/R27/R28/R29 hedef → aksiyon → kanıt → doğrulama sözleşmeleri', async () => {
  const t = T['GAMMA']!; const uid = t.units!['A1']!;
  const preview = await api('POST', `/api/t/${t.id}/cycles/${t.cycle}/units/${uid}/targets?preview=1`, { itemCode: 'GUV-01' }, 'a1'); assert.equal(preview.status, 200, JSON.stringify(preview.body)); assert.equal(preview.body.preview, true); assert.ok((preview.body.measurementPlan as { horizonDays: number }).horizonDays > 0, 'R14: takvim önizlemede');
  assert.equal(((await api('GET', `/api/t/${t.id}/cycles/${t.cycle}/units/${uid}/targets`, undefined, 'a1')).body as unknown as unknown[]).length, 0, 'önizleme kayıt yazmaz');
  const t1 = await api('POST', `/api/t/${t.id}/cycles/${t.cycle}/units/${uid}/targets`, { itemCode: 'GUV-01' }, 'a1', { 'Idempotency-Key': `hedef-${S}-1` }); assert.equal(t1.status, 200, JSON.stringify(t1.body)); t.target = t1.body.id as string;
  const again = await api('POST', `/api/t/${t.id}/cycles/${t.cycle}/units/${uid}/targets`, { itemCode: 'GUV-01' }, 'a1', { 'Idempotency-Key': `hedef-${S}-1` }); assert.equal(again.status, 200); assert.equal(again.body.id, t.target, 'R28: aynı anahtar aynı yanıt, ikinci kayıt yok');
  const conflict = await api('POST', `/api/t/${t.id}/cycles/${t.cycle}/units/${uid}/targets`, { itemCode: 'GUR-01' }, 'a1', { 'Idempotency-Key': `hedef-${S}-1` }); assert.equal(conflict.status, 409, 'R28: aynı anahtar farklı gövde 409');
  assert.equal((await api('POST', `/api/t/${t.id}/cycles/${t.cycle}/units/${uid}/targets`, { itemCode: 'GUV-01', target: 'seksen' }, 'a1')).status, 400, 'R07: sayı olmayan hedef reddi');
  const t2 = await api('POST', `/api/t/${t.id}/cycles/${t.cycle}/units/${uid}/targets`, { itemCode: 'OZ-01' }, 'a1'); assert.equal(t2.status, 200, JSON.stringify(t2.body)); t.target2 = t2.body.id as string;
  assert.equal(t2.body.status, 'under_review', 'R14: özel/onay gerektiren madde hedefi doğrudan sayısal hedefe geçmez'); const rv = await api('POST', `/api/t/${t.id}/targets/${t.target2}/review`, { decision: 'accept', reason: 'özel madde; yerel hedef uygun' }, 'hr-GAMMA'); assert.equal(rv.status, 200, JSON.stringify(rv.body));
  const list = (await api('GET', `/api/t/${t.id}/cycles/${t.cycle}/units/${uid}/targets`, undefined, 'a1')).body as unknown as { id: string }[]; assert.equal(list.length, 2);
  // R15: özel soru için şablon yok → özel aksiyon
  const recs = await api('GET', `/api/t/${t.id}/targets/${t.target2}/recommendations`, undefined, 'a1'); assert.equal(recs.status, 200); assert.equal(recs.body.customAllowed, true); assert.equal((recs.body.recommendations as unknown[]).length, 0);
  const noTpl = await api('POST', `/api/t/${t.id}/targets/${t.target2}/actions`, { templateCode: 'birebir-programi' }, 'a1'); assert.equal(noTpl.status, 422);
  const custom = await api('POST', `/api/t/${t.id}/targets/${t.target2}/actions`, { custom: { title: 'Vardiya planını her ayın 15\'inde iki hafta önceden yayımla', cadence: 'monthly' }, startDate: '2026-05-01', dueDate: '2026-10-31' }, 'a1'); assert.equal(custom.status, 200, JSON.stringify(custom.body)); assert.equal((custom.body.requirement as { expected: number }).expected, 6);
  const actA = await api('POST', `/api/t/${t.id}/targets/${t.target}/actions`, { templateCode: 'birebir-programi', startDate: '2026-05-01', dueDate: '2026-10-31' }, 'a1'); assert.equal(actA.status, 200, JSON.stringify(actA.body)); t.action = actA.body.id as string;
  // R27: acil bayrağı yetkisiz ve gerekçesiz reddedilir; kapasite duraklatılmışı da sayar
  const urgent = await api('POST', `/api/t/${t.id}/targets/${t.target}/actions`, { templateCode: 'haftalik-ekip-sozu', urgent: true }, 'a1'); assert.equal(urgent.status, 403);
  assert.equal((await api('POST', `/api/t/${t.id}/actions/${custom.body.id}/transition`, { to: 'paused', reason: 'bütçe onayı bekleniyor' }, 'a1')).status, 200);
  const third = await api('POST', `/api/t/${t.id}/targets/${t.target}/actions`, { templateCode: 'haftalik-ekip-sozu', startDate: '2026-05-01', dueDate: '2026-10-31' }, 'a1'); assert.equal(third.status, 200, JSON.stringify(third.body));
  const fourth = await api('POST', `/api/t/${t.id}/targets/${t.target}/actions`, { templateCode: 'yonetici-sahada', startDate: '2026-05-01', dueDate: '2026-10-31' }, 'a1'); assert.equal(fourth.status, 409, 'R27: duraklatılmış aksiyon yükü düşürmez');
  assert.equal((await api('POST', `/api/t/${t.id}/actions/${custom.body.id}/transition`, { to: 'paused' }, 'a1')).status, 400, 'R07: gerekçesiz geçiş şemada reddedilir');
  // R06: 0/6 kanıt ile beyan → onay 422; muafiyet yalnız HR_ADMIN → partial; kapsam dışı bölge yöneticisi doğrulayamaz
  const decl = await api('POST', `/api/t/${t.id}/actions/${t.action}/declare-complete`, {}, 'a1'); assert.equal(decl.status, 200); assert.equal(decl.body.validCount, 0);
  const v0 = await api('POST', `/api/t/${t.id}/actions/${t.action}/verify`, { ok: true, reason: 'göz yumuldu' }, 'hrbp-a'); assert.equal(v0.status, 422); assert.equal(v0.body.error, 'coverage_insufficient');
  assert.equal((await api('POST', `/api/t/${t.id}/actions/${t.action}/verify`, { ok: true, reason: 'muafiyet', exempt: true }, 'hrbp-a')).status, 403, 'muafiyet HRBP\'de yok');
  const ex = await api('POST', `/api/t/${t.id}/actions/${t.action}/verify`, { ok: true, reason: 'şube taşındı; program iptal', exempt: true }, 'hr-GAMMA'); assert.equal(ex.status, 200); assert.equal(ex.body.verification, 'partial', 'R06: muafiyet tamamlanmış değil, kısmi');
  const ex2 = await api('POST', `/api/t/${t.id}/targets/${t.target}/actions`, { templateCode: 'birebir-programi', startDate: '2026-05-01', dueDate: '2026-10-31' }, 'a1'); assert.equal(ex2.status, 200, JSON.stringify(ex2.body)); const a2 = ex2.body.id as string;
  assert.equal((await api('POST', `/api/t/${t.id}/actions/${a2}/evidence`, { date: '2026-05-12', attendance: 7 }, 'a1')).status, 200);
  assert.equal((await api('POST', `/api/t/${t.id}/actions/${a2}/declare-complete`, {}, 'a1')).status, 200);
  // kapsam dışı: B bölgesi olmayan; hrbp-a kapsam içi ama 1/6 → 422; bolge-a başka birimin (B1) işini göremez
  const bUnitAction = await api('GET', `/api/t/${t.id}/actions/${a2}`, undefined, 'b1'); assert.equal(bUnitAction.status, 403, 'R06: kapsam dışı kişi işi göremez');
  assert.equal((await api('POST', `/api/t/${t.id}/actions/${a2}/verify`, { ok: true, reason: 'kapsam dışı deneme' }, 'b1')).status, 403, 'R06: kapsam dışı doğrulama yok');
  const seven = await api('POST', `/api/t/${t.id}/actions/${a2}/verify`, { ok: true, reason: 'kayıtlar incelendi' }, 'hrbp-a'); assert.equal(seven.status, 422, 'R06: 1/6 insan onayıyla 6/6 olmaz');
  const rej = await api('POST', `/api/t/${t.id}/actions/${a2}/verify`, { ok: false, reason: 'gerçekleşme eksik; devam' }, 'hrbp-a'); assert.equal(rej.status, 200); assert.equal(rej.body.verification, 'needs_review');
  // R29: denetim izi gerçek tabloda
  const client = new pg.Client({ connectionString: config.databaseUrl }); await client.connect();
  try { await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [t.id]); const r = await client.query("SELECT action, COUNT(*)::int AS c FROM audit_event WHERE tenant_id = $1 GROUP BY action ORDER BY action", [t.id]); const acts = Object.fromEntries(r.rows.map(x => [x.action, x.c])); assert.ok(acts['create'] >= 3, JSON.stringify(acts)); assert.ok(acts['verify:partial'] === 1 && acts['verify:needs_review'] === 1 && acts['transition:paused'] === 1, 'R29: hedef/aksiyon/kanıt/doğrulama/geçiş denetim izi'); } finally { await client.end(); }
  // R25: başlangıç düzeltmesi → hedef under_review + baseline_superseded; kabul baseline kararı ister; rebase başlangıcı günceller
  const wb = await download(`/api/t/${t.id}/templates/results.xlsx?cycleId=${t.cycle}`, 'hr-GAMMA'); wb.getWorksheet('Paket')!.getRow(2).getCell(5).value = 'PATCH'; const ws = wb.getWorksheet('Sonuclar')!, dws = wb.getWorksheet('Dagilimlar')!;
  ws.eachRow((row, n) => { if (n === 1) return; if (String(row.getCell(3).value) !== 'A1' || String(row.getCell(4).value) !== 'GUV-01_TB') return; row.getCell(5).value = 'OBSERVED'; row.getCell(6).value = 20; row.getCell(7).value = '40'; dws.addRow([t.code, '2026-ANA', 'A1', 'GUV-01_TB', '1', 4]); dws.addRow([t.code, '2026-ANA', 'A1', 'GUV-01_TB', '2', 4]); dws.addRow([t.code, '2026-ANA', 'A1', 'GUV-01_TB', '3', 4]); dws.addRow([t.code, '2026-ANA', 'A1', 'GUV-01_TB', '4', 4]); dws.addRow([t.code, '2026-ANA', 'A1', 'GUV-01_TB', '5', 4]); });
  const corr = await upload(`/api/t/${t.id}/imports/results?cycleId=${t.cycle}`, 'hr-GAMMA', await toBuf(wb)); assert.equal(corr.body.state, 'validated', JSON.stringify(corr.body.issues)); assert.equal((await api('POST', `/api/t/${t.id}/imports/${corr.body.jobId}/commit`, {}, 'hr-GAMMA')).status, 200);
  const tl = ((await api('GET', `/api/t/${t.id}/cycles/${t.cycle}/units/${uid}/targets`, undefined, 'hr-GAMMA')).body as unknown as { id: string; status: string; baseline_superseded: boolean; baseline_score: string }[]); const tt = tl.find(x => x.id === t.target)!; assert.equal(tt.status, 'under_review'); assert.equal(tt.baseline_superseded, true);
  assert.equal((await api('POST', `/api/t/${t.id}/targets/${t.target}/review`, { decision: 'accept' }, 'hr-GAMMA')).status, 400, 'R07: gerekçesiz karar 400');
  const noBase = await api('POST', `/api/t/${t.id}/targets/${t.target}/review`, { decision: 'accept', reason: 'devam' }, 'hr-GAMMA'); assert.equal(noBase.status, 422); assert.equal(noBase.body.error, 'baseline_decision_required');
  const rb = await api('POST', `/api/t/${t.id}/targets/${t.target}/review`, { decision: 'accept', reason: 'düzeltilmiş başlangıçtan devam', baseline: 'rebase' }, 'hr-GAMMA'); assert.equal(rb.status, 200, JSON.stringify(rb.body)); assert.equal((rb.body.rebased as { baseline: number }).baseline, 40);
  const tt2 = ((await api('GET', `/api/t/${t.id}/cycles/${t.cycle}/units/${uid}/targets`, undefined, 'hr-GAMMA')).body as unknown as { id: string; status: string; baseline_score: string; approved_target: string | null; suggested_target: string }[]).find(x => x.id === t.target)!; assert.equal(Number(tt2.baseline_score), 40, 'R25: hedef dayanağı düzeltilmiş sonuca taşındı'); assert.equal(tt2.status, 'pending_acceptance', 'V14: rebase taslak üretir, kabul ayrı'); assert.equal(tt2.approved_target, null);
  assert.equal((await api('POST', `/api/t/${t.id}/targets/${t.target}/actions`, { templateCode: 'birebir-programi' }, 'a1')).status, 409, 'V14: taslak hedefe aksiyon açılmaz');
  const cur0 = ((await api('GET', `/api/t/${t.id}/cycles/${t.cycle}/units/${uid}/targets`, undefined, 'a1')).body as unknown as { id: string; version: number }[]).find(x => x.id === t.target)!; const stale = await api('POST', `/api/t/${t.id}/targets/${t.target}/accept`, { reason: 'eski sürüm', expectedVersion: 1 }, 'a1'); assert.equal(stale.status, 409, 'expectedVersion uyuşmazsa 409 + güncel taslak'); assert.equal(stale.body.error, 'version_changed'); const acc = await api('POST', `/api/t/${t.id}/targets/${t.target}/accept`, { reason: 'yeni öneri uygun', expectedVersion: cur0.version }, 'a1'); assert.equal(acc.status, 200, JSON.stringify(acc.body)); assert.equal(acc.body.status, 'accepted'); assert.equal(Number(acc.body.approvedTarget), Number(tt2.suggested_target));
});
test('R35 hız sınırı ve parola sıfırlama; R38 test sıfırlama yalnız *_test', async () => {
  const email = `b1@${dom}`; let last = 0; for (let i = 0; i < 9; i++) last = (await api('POST', '/api/auth/login', { email, password: 'yanlis-parola-x' })).status; assert.equal(last, 429, 'R35: 8 başarısız deneme sonrası kilit');
  const fg = await api('POST', '/api/auth/forgot', { email: `a1@${dom}` }); assert.equal(fg.status, 200); assert.equal((await api('POST', '/api/auth/forgot', { email: `yok@${dom}` })).status, 200, 'hesap yoksa da aynı yanıt');
  const tok = mailTokenFor(`a1@${dom}`, 'parola'); assert.equal((await api('POST', `/api/auth/reset/${tok}`, { password: 'kisa' })).status, 400);
  assert.equal((await api('POST', `/api/auth/reset/${tok}`, { password: PW2 })).status, 200);
  assert.equal((await api('GET', '/api/auth/me', undefined, 'a1')).status, 401, 'sıfırlama eski oturumları kapatır');
  assert.equal((await api('POST', '/api/auth/login', { email: `a1@${dom}`, password: PW })).status, 401, 'eski parola geçersiz'); await login(`a1@${dom}`, 'a1', PW2);
  const out = execSync('TEST_DB=hpw_act_demo ALLOW_DB_RESET=1 sh test/reset-db.sh || true', { cwd: process.cwd() }).toString(); assert.ok(out.includes('reddedildi'), 'R38: uygulama DB adı reddedilir'); assert.ok(execSync('TEST_DB=hpw_act_test sh test/reset-db.sh || true', { cwd: process.cwd() }).toString().includes('ALLOW_DB_RESET'), 'R38: açık izin gerekir');
});
test('R33 kuyruk kirası: alınan kayıt işlenirken ikinci işçiye verilmez; başarısız gönderim yeniden dener', async () => {
  const client = new pg.Client({ connectionString: config.databaseUrl }); await client.connect();
  try { await client.query("SELECT set_config('app.realm','worker', false)"); const id = (await client.query("INSERT INTO email_outbox (to_email, subject, body_text, idempotency_key) VALUES ('kira@" + dom + "', 'kira', 'x', 'kira-" + S + "') RETURNING id")).rows[0].id; const first = await client.query('SELECT id, status, lease_until FROM outbox_claim(10)'); assert.ok(first.rows.some(r => r.id === id && r.status === 'processing' && r.lease_until), 'atomik kira'); const second = await client.query('SELECT id FROM outbox_claim(10)'); assert.ok(!second.rows.some(r => r.id === id), 'kiralı kayıt ikinci işçiye verilmez'); await client.query("SELECT outbox_mark($1,'temp_fail','smtp',NULL,'deneme')", [id]); const row = (await client.query('SELECT status, attempts, next_attempt_at > now() AS backoff FROM email_outbox WHERE id = $1', [id])).rows[0]; assert.equal(row.status, 'temp_fail'); assert.equal(row.backoff, true, 'üstel bekleme'); } finally { await client.end(); }
});
