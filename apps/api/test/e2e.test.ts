/** Uçtan uca: iki şirket sıfırdan — platform → şirket → organizasyon (Excel) → soru seti → dönem → sonuçlar (Excel) → kullanıcılar (Excel) → davet → kabul → sonuç → hedef → aksiyon → kanıt → takip; tenant izolasyonu ve RLS. Gerçek PostgreSQL. */
import { ensureMfa } from './mfa-helper.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import ExcelJS from 'exceljs';
import pg from 'pg';
import { buildApp } from '../src/server.js';
import { config } from '../src/config.js';

let app: Awaited<ReturnType<typeof buildApp>>;
const cookies: Record<string, string> = {};
function cookieOf(res: { headers: Record<string, unknown> }): string { const sc = res.headers['set-cookie']; const raw = Array.isArray(sc) ? sc[0] : String(sc ?? ''); return raw.split(';')[0]!; }
type Raw = { statusCode: number; headers: Record<string, unknown>; body: string };
async function apiRaw(method: 'GET' | 'POST' | 'PATCH', url: string, body?: unknown, who?: string): Promise<Raw> { const res = await app.inject({ method, url, payload: body as Record<string, unknown> | undefined, headers: who ? { cookie: cookies[who]! } : {} }); return { statusCode: res.statusCode, headers: res.headers as Record<string, unknown>, body: res.body }; }
async function api(method: 'GET' | 'POST' | 'PATCH', url: string, body?: unknown, who?: string) {
  const res = await apiRaw(method, url, body, who); let json: unknown = null; try { json = JSON.parse(res.body); } catch { json = res.body; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.statusCode, body: json as any, res };
}
async function upload(url: string, who: string, buf: Buffer, name = 'dosya.xlsx') {
  const boundary = '----hpwact' + Date.now(); const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`); const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const res = await app.inject({ method: 'POST', url, payload: Buffer.concat([head, buf, tail]), headers: { cookie: cookies[who]!, 'content-type': `multipart/form-data; boundary=${boundary}` } });
  return { status: res.statusCode, body: JSON.parse(res.body) as Record<string, unknown> & Record<string, never> };
}
async function download(url: string, who: string): Promise<ExcelJS.Workbook> { const res = await app.inject({ method: 'GET', url, headers: { cookie: cookies[who]! } }); assert.equal(res.statusCode, 200, res.body.slice(0, 200)); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(res.rawPayload as unknown as ArrayBuffer); return wb; }
async function toBuf(wb: ExcelJS.Workbook): Promise<Buffer> { return Buffer.from(await wb.xlsx.writeBuffer()); }
function fillSheet(wb: ExcelJS.Workbook, name: string, rows: Record<string, unknown>[], clear = false) { const ws = wb.getWorksheet(name)!; const header = (ws.getRow(1).values as unknown[]).slice(1).map(v => String(v ?? '')); if (clear) { while (ws.rowCount > 1) ws.spliceRows(2, 1); } for (const r of rows) ws.addRow(header.map(h => r[h] ?? '')); }
function inviteTokenFor(email: string): string { const dir = config.mailDir; const files = readdirSync(dir).filter(f => f.endsWith('.eml')).map(f => ({ f, t: readFileSync(`${dir}/${f}`, 'utf8') })).filter(x => x.t.includes(`To: ${email}`)).sort((a, b) => a.f < b.f ? 1 : -1); assert.ok(files.length, `davet e-postası yok: ${email}`); const m = /#\/davet\/([A-Za-z0-9_-]+)/.exec(files[0]!.t); assert.ok(m, 'token yok'); return m![1]!; }
async function acceptInvite(email: string, who: string, password = 'Parola12345') { const token = inviteTokenFor(email); const peek = await api('GET', `/api/invitations/${token}`); assert.equal(peek.status, 200); const r = await apiRaw('POST', `/api/invitations/${token}/accept`, { password }); assert.equal(r.statusCode, 200, r.body); cookies[who] = cookieOf(r); const again = await api('GET', `/api/invitations/${token}`); assert.equal(again.status, 404, 'token tek kullanımlık olmalı'); }
async function login(email: string, who: string, password = 'Parola12345') { const r = await apiRaw('POST', '/api/auth/login', { email, password }); assert.equal(r.statusCode, 200, r.body); cookies[who] = cookieOf(r); if (JSON.parse(r.body).realm === 'platform') await ensureMfa((m, u, b) => api(m, u, b, who) as never, email); }

const SFX = Date.now().toString(36).toLocaleUpperCase('en-US').slice(-5);
const T: Record<string, { id: string; code: string; cycle?: string; cycle2?: string; iv?: string; units?: Record<string, string>; target?: string; action?: string; aiPlan?: string; preview?: { plan: string; rec: number; low: number; high: number }; previewTarget?: string; previewStatus?: string }> = {};
before(async () => { rmSync(config.mailDir, { recursive: true, force: true }); mkdirSync(config.mailDir, { recursive: true }); app = await buildApp(); });
after(async () => { await app.close(); });

test('0 platform yöneticisi kurulur ve giriş yapar', async () => {
  const b = await api('POST', '/api/platform/bootstrap', { email: 'platform@hpw.test', password: 'Platform12345', displayName: 'HPW Yönetici' });
  assert.ok([200, 409].includes(b.status), JSON.stringify(b.body));
  await login('platform@hpw.test', 'platform', 'Platform12345');
  const me = await api('GET', '/api/auth/me', undefined, 'platform'); assert.equal(me.body.realm, 'platform');
});
test('1 iki şirket oluşturulur; ilk yetkili daveti kişisel bağlantıyla kabul edilir', async () => {
  for (const [code, name, adminBase] of [['ALFA', 'Alfa Perakende A.Ş.', 'ik@alfa'], ['BETA', 'Beta Sigorta A.Ş.', 'ik@beta']] as const) {
    const admin = `${adminBase}${SFX}.test`.toLocaleLowerCase('en-US'); const tcode = `${code}${SFX}`;
    const r = await api('POST', '/api/platform/tenants', { code: tcode, name, adminEmail: admin, adminName: `${name} İK` }, 'platform'); assert.equal(r.status, 200, JSON.stringify(r.body));
    T[code] = { id: r.body.id as string, code: tcode };
    await api('POST', '/api/auth/switch-tenant', { tenantId: T[code]!.id }, 'platform');
    const send = await api('POST', `/api/t/${T[code]!.id}/invitations/send`, {}, 'platform'); assert.equal(send.status, 200, JSON.stringify(send.body)); assert.equal(send.body.queued, 1); assert.equal((send.body.delivery as { transport: string }).transport, 'sandbox');
    await acceptInvite(admin, `hr-${code}`);
    const me = await api('GET', '/api/auth/me', undefined, `hr-${code}`); assert.equal(me.body.profile, 'HR_ADMIN'); assert.equal(me.body.tenantId, T[code]!.id);
  }
  const dup = await api('POST', '/api/platform/tenants', { code: T['ALFA']!.code, name: 'Yinelenen' }, 'platform'); assert.equal(dup.status, 409); const shortName = await api('POST', '/api/platform/tenants', { code: 'KISA1', name: 'x' }, 'platform'); assert.equal(shortName.status, 400, 'şema: ad en az 2 karakter');
  const weak = await api('POST', '/api/platform/tenants', { code: 'bad code', name: 'x' }, 'platform'); assert.equal(weak.status, 400);
});
test('2 organizasyon: şablon indir → doldur → yükle → hatalı satırlar → düzelt → onayla (iki şirket farklı yapı)', async () => {
  for (const code of ['ALFA', 'BETA']) {
    const who = `hr-${code}`; const tid = T[code]!.id; const tcode = T[code]!.code;
    const wb = await download(`/api/t/${tid}/templates/org.xlsx`, who);
    assert.ok(wb.getWorksheet('Birimler') && wb.getWorksheet('KILAVUZ') && wb.getWorksheet('SOZLUK'));
    const isAlfa = code === 'ALFA';
    fillSheet(wb, 'Birim_Tipleri', isAlfa ? [{ tenant_code: tcode, unit_type_code: 'ROOT', label: 'Genel Müdürlük' }, { tenant_code: tcode, unit_type_code: 'REGION', label: 'Bölge Direktörlüğü' }, { tenant_code: tcode, unit_type_code: 'SITE', label: 'Şube' }] : [{ tenant_code: tcode, unit_type_code: 'ROOT', label: 'Genel Merkez' }, { tenant_code: tcode, unit_type_code: 'FAB', label: 'Fabrika' }], true);
    const units = isAlfa ? [['HQ', 'Genel Müdürlük', 'ROOT', ''], ['EGE', 'Ege Bölge', 'REGION', 'HQ'], ['KONAK', 'Konak Şubesi', 'SITE', 'EGE'], ['ALSANCAK', 'Alsancak Şubesi', 'SITE', 'EGE'], ['KUCUK', 'Küçük Ekip', 'SITE', 'EGE']] : [['GM', 'Genel Merkez', 'ROOT', ''], ['F1', 'Gebze Fabrikası', 'FAB', 'GM'], ['F2', 'İzmir Fabrikası', 'FAB', 'GM']];
    fillSheet(wb, 'Birimler', units.map(u => ({ tenant_code: tcode, operation: 'CREATE', unit_code: u[0], unit_name: u[1], unit_type_code: u[2], timezone: 'Europe/Istanbul', valid_from: '2026-01-01' })).concat([{ tenant_code: tcode, operation: 'CREATE', unit_code: 'HATALI', unit_name: 'Tipi yok', unit_type_code: 'YOK', timezone: '', valid_from: '2026-01-01' }]), true);
    fillSheet(wb, 'Hiyerarsiler', [{ tenant_code: tcode, hierarchy_code: 'SURVEY', label: 'Anket ağacı', purpose: 'SURVEY_ROLLUP' }], true);
    fillSheet(wb, 'Iliskiler', units.filter(u => u[3]).map(u => ({ tenant_code: tcode, operation: 'CREATE', hierarchy_code: 'SURVEY', child_unit: u[0], parent_unit: u[3], relation_type: 'REPORTS_TO', valid_from: '2026-01-01' })), true);
    fillSheet(wb, 'Org_Rolleri', (isAlfa ? [['ROLE_HR', 'HQ', 'İK Direktörü', 'HR_ADMIN'], ['ROLE_EGE', 'EGE', 'Bölge Direktörü', 'REGION_MANAGER'], ['ROLE_KONAK', 'KONAK', 'Şube Müdürü', 'UNIT_MANAGER'], ['ROLE_ALSANCAK', 'ALSANCAK', 'Şube Müdürü', 'UNIT_MANAGER'], ['ROLE_HRBP', 'EGE', 'İK İş Ortağı', 'HR_PARTNER']] : [['ROLE_HR', 'GM', 'İnsan ve Kültür Lideri', 'HR_ADMIN'], ['ROLE_F1', 'F1', 'Fabrika Direktörü', 'UNIT_MANAGER'], ['ROLE_F2', 'F2', 'Fabrika Direktörü', 'UNIT_MANAGER']]).map(r => ({ tenant_code: tcode, operation: 'CREATE', role_code: r[0], unit_code: r[1], title: r[2], permission_profile: r[3], valid_from: '2026-01-01' })), true);
    const bad = await upload(`/api/t/${tid}/imports/org`, who, await toBuf(wb)); assert.equal(bad.status, 200); assert.equal(bad.body.state, 'failed'); assert.ok((bad.body.issues as { code: string }[]).some(i => i.code === 'unit_type_unknown'), JSON.stringify(bad.body.issues));
    const errs = await app.inject({ method: 'GET', url: `/api/t/${tid}/imports/${bad.body.jobId}/errors.xlsx`, headers: { cookie: cookies[who]! } }); assert.equal(errs.statusCode, 200);
    const nc = await api('POST', `/api/t/${tid}/imports/${bad.body.jobId}/commit`, {}, who); assert.equal(nc.status, 409);
    const ws = wb.getWorksheet('Birimler')!; ws.spliceRows(ws.rowCount, 1); // hatalı satırı kaldır, yeniden yükle
    const ok = await upload(`/api/t/${tid}/imports/org`, who, await toBuf(wb)); assert.equal(ok.body.state, 'validated', JSON.stringify(ok.body.issues));
    const c = await api('POST', `/api/t/${tid}/imports/${ok.body.jobId}/commit`, {}, who); assert.equal(c.status, 200, JSON.stringify(c.body));
    const org = await api('GET', `/api/t/${tid}/org`, undefined, who); assert.equal((org.body.units as unknown[]).length, units.length); T[code]!.units = Object.fromEntries((org.body.units as { code: string; id: string }[]).map(u => [u.code, u.id]));
    const again = await upload(`/api/t/${tid}/imports/org`, who, await toBuf(wb)); assert.equal(again.body.state, 'failed'); assert.ok((again.body.issues as { code: string }[]).some(i => i.code === 'unit_exists'));
  }
  const add = await api('POST', `/api/t/${T['ALFA']!.id}/org/units`, { code: 'BORNOVA', name: 'Bornova Şubesi', unitType: 'SITE', parentCode: 'EGE', hierarchyCode: 'SURVEY' }, 'hr-ALFA'); assert.equal(add.status, 200, JSON.stringify(add.body));
  const cyc = await api('POST', `/api/t/${T['ALFA']!.id}/org/units`, { code: 'EGE', name: 'x', unitType: 'SITE' }, 'hr-ALFA'); assert.equal(cyc.status, 422);
});
test('3 soru seti: standart seçimi + ek soru (ekran) ve Excel yolu; desteklenmeyen ölçek reddi; sertifikasyon uygunluğu', async () => {
  const a = T['ALFA']!; const cat = await api('GET', `/api/t/${a.id}/instruments/catalog`, undefined, 'hr-ALFA'); assert.equal((cat.body.items as unknown[]).length, 75);
  const core = (cat.body.items as { code: string; origin: string; dimensionCode: string }[]).filter(i => i.origin === 'core' || ['LID', 'YEK'].includes(i.dimensionCode)).map(i => i.code);
  const badScale = await api('POST', `/api/t/${a.id}/instruments`, { version: '2026-v1', standardItemCodes: core, customItems: [{ code: 'OZL-01', text: 'Şubemdeki kadro planı müşteri yoğunluğuyla uyumludur.', scaleCode: 'MULTI' }] }, 'hr-ALFA'); assert.equal(badScale.status, 422); assert.ok(JSON.stringify(badScale.body).includes('unsupported_scale'));
  const reserved = await api('POST', `/api/t/${a.id}/instruments`, { version: '2026-v1', standardItemCodes: core, customItems: [{ code: 'GUR-01', text: 'Başka bir metin buraya yazıldı.', scaleCode: 'L5' }] }, 'hr-ALFA'); assert.equal(reserved.status, 422);
  const ok = await api('POST', `/api/t/${a.id}/instruments`, { version: '2026-v1', standardItemCodes: core, customItems: [{ code: 'OZL-01', text: 'Şubemdeki kadro planı müşteri yoğunluğuyla uyumludur.', scaleCode: 'L5', dimensionCode: 'OZL', dimensionLabel: 'Şirkete Özel', targetPolicy: 'TARGETABLE', responsibilityCenter: 'central_function' }, { code: 'OZL-02', text: 'Vardiya değişimleri en az bir hafta önceden bildirilir.', scaleCode: 'L5R', dimensionCode: 'OZL' }, { code: 'OZL-03', text: 'İş yerinde fiziksel güvenliğim sağlanıyor.', scaleCode: 'BIN' }] }, 'hr-ALFA');
  assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.equal(ok.body.certificationEligible, true); a.iv = ok.body.instrumentVersionId as string;
  const items = await api('GET', `/api/t/${a.id}/instruments/${a.iv}/items`, undefined, 'hr-ALFA'); assert.equal((items.body as unknown[]).length, core.length + 3);
  // Beta: Excel yolu, Dijital boyutu çıkarılmış ve bir standart metin değiştirilmiş → sertifikasyon uygun değil
  const b = T['BETA']!; const wb = await download(`/api/t/${b.id}/templates/instrument.xlsx`, 'hr-BETA'); const ws = wb.getWorksheet('Maddeler')!;
  ws.eachRow((row, n) => { if (n === 1) return; const code = String(row.getCell(2).value); if (code.startsWith('DIJ-')) row.getCell(8).value = 'EXCLUDED'; if (code === 'GUR-04') row.getCell(5).value = 'Şirketimin adını söylemekten çekinmem.'; });
  ws.addRow([b.code, 'BETA-01', 'CUSTOM', 'OZL', 'Üretim hattında ani duruşlar hızla çözülür.', '', 'L5', 'INCLUDED', 'REVIEW_REQUIRED', 'central_function']);
  const up = await upload(`/api/t/${b.id}/imports/instrument`, 'hr-BETA', await toBuf(wb)); assert.equal(up.body.state, 'validated', JSON.stringify(up.body.issues)); assert.equal((up.body.preview as { certificationEligible: boolean }).certificationEligible, false);
  const c = await api('POST', `/api/t/${b.id}/imports/${up.body.jobId}/commit`, {}, 'hr-BETA'); assert.equal(c.status, 200, JSON.stringify(c.body));
  const list = await api('GET', `/api/t/${b.id}/instruments`, undefined, 'hr-BETA'); b.iv = (list.body as { id: string }[])[0]!.id; assert.equal((list.body as { items: number }[])[0]!.items, 75 - 4 + 1);
});
test('4 dönem + sonuç şablonu → gerçek dosya → doğrulama hataları → yayım (atomik); gizli hücre sayı taşımaz; mutabakat', async () => {
  const a = T['ALFA']!; const cyc = await api('POST', `/api/t/${a.id}/cycles`, { code: '2026-ANA', name: '2026 Ana Ölçüm', periodStart: '2026-04-06', periodEnd: '2026-04-24', instrumentVersionId: a.iv }, 'hr-ALFA'); assert.equal(cyc.status, 200, JSON.stringify(cyc.body)); a.cycle = cyc.body.id as string;
  const noCycle = await app.inject({ method: 'GET', url: `/api/t/${a.id}/templates/results.xlsx`, headers: { cookie: cookies['hr-ALFA']! } }); assert.equal(noCycle.statusCode, 400);
  const wb = await download(`/api/t/${a.id}/templates/results.xlsx?cycleId=${a.cycle}`, 'hr-ALFA'); const ws = wb.getWorksheet('Sonuclar')!; const dws = wb.getWorksheet('Dagilimlar')!;
  const info = wb.getWorksheet('Metrikler_Bilgi')!; const metrics: { code: string; scale: string }[] = []; info.eachRow((r, n) => { if (n > 1) metrics.push({ code: String(r.getCell(1).value), scale: String(r.getCell(4).value) }); });
  assert.ok(metrics.some(m => m.code === 'BAG-03_NPS') && metrics.some(m => m.code === 'OZL-02_TB') && metrics.some(m => m.code === 'OZL-03_TB'));
  const dist = (scale: string, n: number, tb: number): Record<string, number> => { const top = Math.round(n * tb / 100), rest = n - top; if (scale === 'L5' || scale === 'L5R') { const c4 = Math.floor(top / 2), c5 = top - c4, c3 = Math.floor(rest / 2), c2 = Math.floor((rest - c3) / 2), c1 = rest - c3 - c2; return scale === 'L5' ? { '1': c1, '2': c2, '3': c3, '4': c4, '5': c5 } : { '5': c1, '4': c2, '3': c3, '2': c4, '1': c5 }; } if (scale === 'NPS11') return { '0': rest - Math.floor(rest / 2), '7': Math.floor(rest / 2), '9': Math.floor(top / 2), '10': top - Math.floor(top / 2) }; return { 'NO': rest, 'YES': top }; };
  const seed: Record<string, number> = { KONAK: 32, ALSANCAK: 41, BORNOVA: 28, KUCUK: 4 }; let k = 0; const distRows: unknown[][] = []; const itemDist = new Map<string, Record<string, number>>();
  ws.eachRow((row, n) => { if (n === 1) return; const unit = String(row.getCell(3).value), mc = String(row.getCell(4).value); const nn = seed[unit]; if (nn === undefined) return; const m = metrics.find(x => x.code === mc)!; if (nn < 5) { row.getCell(5).value = 'SUPPRESSED'; row.getCell(6).value = nn; return; } const itemKey = `${unit}|${m.code.replace(/_(TB|NPS|IDX)$/, '')}`; let d = itemDist.get(itemKey); if (!d) { const tb = 40 + ((k++ * 7) % 50); d = dist(m.scale, nn, tb); itemDist.set(itemKey, d); } let val: number; if (mc.endsWith('_NPS')) { const top = (d['9'] ?? 0) + (d['10'] ?? 0); val = Math.round(((top - (d['0'] ?? 0)) / nn) * 1000) / 10; } else { const fav = m.scale === 'L5' ? (d['4'] ?? 0) + (d['5'] ?? 0) : m.scale === 'L5R' ? (d['1'] ?? 0) + (d['2'] ?? 0) : m.scale === 'NPS11' ? (d['9'] ?? 0) + (d['10'] ?? 0) : d['YES'] ?? 0; val = Math.round((fav / nn) * 1000) / 10; } row.getCell(5).value = 'OBSERVED'; row.getCell(6).value = nn; row.getCell(7).value = String(val).replace('.', ','); for (const [opt, cnt] of Object.entries(d)) if (cnt > 0) distRows.push([a.code, '2026-ANA', unit, mc, opt, cnt]); });
  for (const r of distRows) dws.addRow(r);
  // hata 1: gizli birime sayı yazılmış; hata 2: beşli ölçekte '6' seçeneği; hata 3: değer dağılımla çelişiyor
  const kucukRow = (() => { let found: ExcelJS.Row | null = null; ws.eachRow(r => { if (String(r.getCell(3).value) === 'KUCUK' && String(r.getCell(4).value) === 'GUR-01_TB') found = r; }); return found!; })(); kucukRow.getCell(7).value = 55;
  dws.addRow([a.code, '2026-ANA', 'KONAK', 'BAS-01_TB', '6', 1]);
  const konakRow = (() => { let found: ExcelJS.Row | null = null; ws.eachRow(r => { if (String(r.getCell(3).value) === 'KONAK' && String(r.getCell(4).value) === 'GUV-01_TB') found = r; }); return found!; })(); const trueVal = konakRow.getCell(7).value; konakRow.getCell(7).value = 99;
  const bad = await upload(`/api/t/${a.id}/imports/results?cycleId=${a.cycle}`, 'hr-ALFA', await toBuf(wb)); assert.equal(bad.body.state, 'failed'); const codes = new Set((bad.body.issues as { code: string }[]).map(i => i.code)); assert.ok(codes.has('suppressed_value_present') && codes.has('invalid_option') && (codes.has('value_mismatch') || codes.has('distribution_n_mismatch')), [...codes].join(','));
  kucukRow.getCell(7).value = null; dws.spliceRows(dws.rowCount, 1); konakRow.getCell(7).value = trueVal;
  // resmî toplam: doğru WBI + yanlış WBI
  const wbiOf = (unit: string) => { const vals: number[] = []; ws.eachRow(r => { if (String(r.getCell(3).value) === unit && /^(BAS|GUR|GUV)-\d\d_TB$/.test(String(r.getCell(4).value))) vals.push(Number(String(r.getCell(7).value).replace(',', '.'))); }); return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100; };
  wb.getWorksheet('Resmi_Toplamlar')!.addRow([a.code, '2026-ANA', 'KONAK', 'WBI', 'HPTW-2026', wbiOf('KONAK'), 'HPTW-RAPOR-2026-04']); wb.getWorksheet('Resmi_Toplamlar')!.addRow([a.code, '2026-ANA', 'ALSANCAK', 'WBI', 'HPTW-2026', wbiOf('ALSANCAK') + 5, 'HPTW-RAPOR-2026-04']);
  wb.getWorksheet('Benchmarklar')!.addRow([a.code, 'GUV-01_TB', 'certified', 66.5]); wb.getWorksheet('Benchmarklar')!.addRow([a.code, 'GUR-03_TB', 'certified', 71.2]);
  const recon = await upload(`/api/t/${a.id}/imports/results?cycleId=${a.cycle}`, 'hr-ALFA', await toBuf(wb)); assert.equal(recon.body.state, 'failed'); assert.ok((recon.body.issues as { code: string }[]).some(i => i.code === 'index_reconciliation_failed'));
  wb.getWorksheet('Resmi_Toplamlar')!.spliceRows(wb.getWorksheet('Resmi_Toplamlar')!.rowCount, 1);
  const ok = await upload(`/api/t/${a.id}/imports/results?cycleId=${a.cycle}`, 'hr-ALFA', await toBuf(wb)); assert.equal(ok.body.state, 'validated', JSON.stringify((ok.body.issues as unknown[]).slice(0, 5))); const pv = ok.body.preview as { suppressed: number; observed: number; indexReconciliation: { ok: boolean }[] }; assert.ok(pv.suppressed > 0 && pv.observed >= 50 && pv.indexReconciliation[0]!.ok, JSON.stringify(pv));
  const before = await api('GET', `/api/t/${a.id}/cycles`, undefined, 'hr-ALFA'); assert.equal((before.body as { active_batch_id: string | null }[])[0]!.active_batch_id, null);
  const c = await api('POST', `/api/t/${a.id}/imports/${ok.body.jobId}/commit`, {}, 'hr-ALFA'); assert.equal(c.status, 200, JSON.stringify(c.body));
  const afterC = await api('GET', `/api/t/${a.id}/cycles`, undefined, 'hr-ALFA'); assert.ok((afterC.body as { active_batch_id: string }[])[0]!.active_batch_id); assert.ok((afterC.body as { result_rows: number }[])[0]!.result_rows >= 100);
  const twice = await api('POST', `/api/t/${a.id}/imports/${ok.body.jobId}/commit`, {}, 'hr-ALFA'); assert.equal(twice.status, 200); assert.equal(twice.body.recovered, true, 'P0-4: ikinci commit yeniden uygulamaz, önceki sonucu döner');
  const lock = await api('PATCH', `/api/t/${a.id}/cycles/${a.cycle}`, { instrumentVersionId: a.iv }, 'hr-ALFA'); assert.equal(lock.status, 409);
});
test('5 kullanıcılar: Excel toplu yükleme (parola sütunu yasak, rol → profil), tek işlemle davet, kabul, giriş, yetki iptali', async () => {
  const a = T['ALFA']!; const wb = await download(`/api/t/${a.id}/templates/users.xlsx`, 'hr-ALFA');
  fillSheet(wb, 'Kullanicilar', [{ tenant_code: a.code, operation: 'CREATE', email: `konak@alfa${SFX.toLocaleLowerCase('en-US')}.test`, display_name: 'Ayşe Yılmaz', locale: 'tr', timezone: 'Europe/Istanbul', login_method: 'LOCAL_PASSWORD', invite_requested: 'YES' }, { tenant_code: a.code, operation: 'CREATE', email: `alsancak@alfa${SFX.toLocaleLowerCase('en-US')}.test`, display_name: 'Mehmet Kaya', locale: 'tr', login_method: 'LOCAL_PASSWORD', invite_requested: 'YES' }, { tenant_code: a.code, operation: 'CREATE', email: `hrbp@alfa${SFX.toLocaleLowerCase('en-US')}.test`, display_name: 'Emre Çelik', locale: 'tr', login_method: 'LOCAL_PASSWORD', invite_requested: 'YES' }, { tenant_code: a.code, operation: 'CREATE', email: `bolge@alfa${SFX.toLocaleLowerCase('en-US')}.test`, display_name: 'Selin Arslan', locale: 'tr', login_method: 'LOCAL_PASSWORD', invite_requested: 'YES' }, { tenant_code: a.code, operation: 'CREATE', email: 'gecersiz-eposta', display_name: 'X', login_method: 'LOCAL_PASSWORD' }], true);
  fillSheet(wb, 'Rol_Atamalari', [{ tenant_code: a.code, operation: 'CREATE', email: `konak@alfa${SFX.toLocaleLowerCase('en-US')}.test`, role_code: 'ROLE_KONAK', assignment_kind: 'PRIMARY', valid_from: '2026-01-01' }, { tenant_code: a.code, operation: 'CREATE', email: `alsancak@alfa${SFX.toLocaleLowerCase('en-US')}.test`, role_code: 'ROLE_ALSANCAK', assignment_kind: 'PRIMARY', valid_from: '2026-01-01' }, { tenant_code: a.code, operation: 'CREATE', email: `hrbp@alfa${SFX.toLocaleLowerCase('en-US')}.test`, role_code: 'ROLE_HRBP', assignment_kind: 'PRIMARY', valid_from: '2026-01-01' }, { tenant_code: a.code, operation: 'CREATE', email: `bolge@alfa${SFX.toLocaleLowerCase('en-US')}.test`, role_code: 'ROLE_EGE', assignment_kind: 'PRIMARY', valid_from: '2026-01-01' }], true);
  const bad = await upload(`/api/t/${a.id}/imports/users`, 'hr-ALFA', await toBuf(wb)); assert.equal(bad.body.state, 'failed'); assert.ok((bad.body.issues as { code: string }[]).some(i => i.code === 'invalid_email'));
  const ws = wb.getWorksheet('Kullanicilar')!; ws.spliceRows(ws.rowCount, 1);
  const ok = await upload(`/api/t/${a.id}/imports/users`, 'hr-ALFA', await toBuf(wb)); assert.equal(ok.body.state, 'validated', JSON.stringify(ok.body.issues)); assert.equal((ok.body.preview as { profiles: Record<string, string> }).profiles[`konak@alfa${SFX.toLocaleLowerCase('en-US')}.test`], 'UNIT_MANAGER');
  const c = await api('POST', `/api/t/${a.id}/imports/${ok.body.jobId}/commit`, {}, 'hr-ALFA'); assert.equal(c.status, 200, JSON.stringify(c.body)); assert.equal((c.body.applied as { created: number }).created, 4);
  const send = await api('POST', `/api/t/${a.id}/invitations/send`, {}, 'hr-ALFA'); assert.equal(send.body.queued, 4);
  const users = await api('GET', `/api/t/${a.id}/users`, undefined, 'hr-ALFA'); const konak = (users.body as { email: string; invitation: { status: string; delivery: string; transport: string } }[]).find(u => u.email === `konak@alfa${SFX.toLocaleLowerCase('en-US')}.test`)!; assert.equal(konak.invitation.status, 'pending'); assert.equal(konak.invitation.delivery, 'sent'); assert.equal(konak.invitation.transport, 'sandbox');
  await acceptInvite(`konak@alfa${SFX.toLocaleLowerCase('en-US')}.test`, 'konak'); await acceptInvite(`alsancak@alfa${SFX.toLocaleLowerCase('en-US')}.test`, 'alsancak'); await acceptInvite(`hrbp@alfa${SFX.toLocaleLowerCase('en-US')}.test`, 'hrbp'); await acceptInvite(`bolge@alfa${SFX.toLocaleLowerCase('en-US')}.test`, 'bolge');
  const me = await api('GET', '/api/auth/me', undefined, 'konak'); assert.equal(me.body.profile, 'UNIT_MANAGER');
  const bad2 = await api('POST', '/api/auth/login', { email: `konak@alfa${SFX.toLocaleLowerCase('en-US')}.test`, password: 'yanlis' }); assert.equal(bad2.status, 401);
  const pw = await api('POST', '/api/invitations/xyz/accept', { password: 'short' }); assert.equal(pw.status, 404, 'geçersiz token parola kontrolünden önce reddedilir');
  // yetki iptali: oturum anında düşer
  const u2 = await api('POST', `/api/t/${a.id}/users`, { email: `gecici@alfa${SFX.toLocaleLowerCase('en-US')}.test`, displayName: 'Geçici', roleCodes: [], invite: true }, 'hr-ALFA'); assert.equal(u2.status, 200, JSON.stringify(u2.body));
  await api('POST', `/api/t/${a.id}/invitations/send`, {}, 'hr-ALFA'); await acceptInvite(`gecici@alfa${SFX.toLocaleLowerCase('en-US')}.test`, 'gecici'); assert.equal((await api('GET', '/api/auth/me', undefined, 'gecici')).status, 200);
  const list = await api('GET', `/api/t/${a.id}/users`, undefined, 'hr-ALFA'); const gm = (list.body as { email: string; membership_id: string }[]).find(u => u.email === `gecici@alfa${SFX.toLocaleLowerCase('en-US')}.test`)!; const rv = await api('POST', `/api/t/${a.id}/users/${gm.membership_id}/revoke`, {}, 'hr-ALFA'); assert.equal(rv.status, 200);
  assert.equal((await api('GET', '/api/auth/me', undefined, 'gecici')).status, 401);
});
test('6 tenant izolasyonu: başka şirket 403; kapsam dışı birim 403; RLS gerçek DB\'de; BYPASSRLS yok', async () => {
  const a = T['ALFA']!, b = T['BETA']!;
  assert.equal((await api('GET', `/api/t/${b.id}/overview`, undefined, 'hr-ALFA')).status, 403);
  assert.equal((await api('GET', `/api/t/${b.id}/org`, undefined, 'hr-ALFA')).status, 403);
  assert.equal((await api('GET', `/api/t/${a.id}/users`, undefined, 'hr-BETA')).status, 403);
  assert.equal((await api('GET', `/api/t/${a.id}/cycles/${a.cycle}/units/${a.units!['ALSANCAK']}/results`, undefined, 'konak')).status, 403, 'şube müdürü başka şubeyi göremez');
  assert.equal((await api('GET', `/api/t/${a.id}/cycles/${a.cycle}/units/${a.units!['KONAK']}/results`, undefined, 'konak')).status, 200);
  assert.equal((await api('GET', `/api/t/${a.id}/cycles/${a.cycle}/units/${a.units!['KONAK']}/results`, undefined, 'bolge')).status, 200, 'bölge direktörü astını görür');
  assert.equal((await api('GET', `/api/t/${a.id}/users`, undefined, 'konak')).status, 403, 'şube müdürü kullanıcı listesini göremez');
  const client = new pg.Client({ connectionString: config.databaseUrl }); await client.connect();
  try {
  const noCtx = await client.query('SELECT COUNT(*)::int AS c FROM org_unit'); assert.equal(noCtx.rows[0].c, 0, 'bağlamsız okuma sıfır satır');
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [b.id]); const asBeta = await client.query('SELECT COUNT(*)::int AS c FROM org_unit WHERE tenant_id = $1', [a.id]); assert.equal(asBeta.rows[0].c, 0, 'Beta bağlamı Alfa satırı göremez');
  const asBetaOwn = await client.query('SELECT COUNT(*)::int AS c FROM org_unit'); assert.equal(asBetaOwn.rows[0].c, 3);
  await assert.rejects(client.query('INSERT INTO org_unit (tenant_id, organization_id, name, unit_type, effective_from) VALUES ($1, gen_random_uuid(), $2, $3, CURRENT_DATE)', [a.id, 'sızma', 'SITE']), /row-level security/, 'başka tenant adına yazma RLS ile reddedilir');
  const bypass = await client.query("SELECT rolname FROM pg_roles WHERE rolbypassrls AND rolname NOT IN ('postgres')"); assert.deepEqual(bypass.rows, [], 'BYPASSRLS rol yok');
  const unprotected = await client.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped) AND NOT (c.relrowsecurity AND c.relforcerowsecurity)`); assert.deepEqual(unprotected.rows.map(r => r.relname), [], 'tenant_id taşıyan her tablo FORCE RLS');
  const noPolicy = await client.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.tablename = c.relname)`); assert.deepEqual(noPolicy.rows.map(r => r.relname), [], 'RLS açık ama politikasız tablo yok');
  } finally { await client.end(); }
});
test('7 zincir: sonuç → hedef → aksiyon → kanıt → beyan → doğrulama (aynı şirket/dönem/birim/madde kimlikleri)', async () => {
  const a = T['ALFA']!; const uid = a.units!['KONAK']!;
  const res = await api('GET', `/api/t/${a.id}/cycles/${a.cycle}/units/${uid}/results`, undefined, 'konak'); assert.equal(res.status, 200);
  const rows = res.body.rows as { itemCode: string; metricCode: string; value: number | null; suppressed: boolean; targetPolicy: string; responsibilityCenter: string; assessment: { decision: string } | null; candidateRoles: { id: string; title: string }[] }[];
  assert.ok(rows.length >= 27, String(rows.length)); assert.ok(rows.every(r => r.value !== null), 'Konak n=32 → hiç gizli satır yok');
  const kucuk = await api('GET', `/api/t/${a.id}/cycles/${a.cycle}/units/${a.units!['KUCUK']}/results`, undefined, 'hr-ALFA'); assert.ok((kucuk.body.rows as { value: number | null; suppressed: boolean }[]).every(r => r.value === null && r.suppressed), 'n=4 birimde sayı yok');
  const gur03 = rows.find(r => r.itemCode === 'GUR-03' && r.metricCode === 'GUR-03_TB')!; assert.equal(gur03.responsibilityCenter, 'talent_system'); assert.ok(gur03.candidateRoles.length >= 1, 'kariyer maddesi için İK aday rolü');
  const bag = rows.find(r => r.itemCode === 'BAG-01')!; assert.equal(bag.targetPolicy, 'MONITOR_ONLY');
  const noT = await api('POST', `/api/t/${a.id}/cycles/${a.cycle}/units/${uid}/targets`, { itemCode: 'BAG-01' }, 'konak'); assert.equal(noT.status, 422);
  const supT = await api('POST', `/api/t/${a.id}/cycles/${a.cycle}/units/${a.units!['KUCUK']}/targets`, { itemCode: 'GUV-01' }, 'hr-ALFA'); assert.equal(supT.status, 422, 'gizli sonuca hedef yok');
  const t1 = await api('POST', `/api/t/${a.id}/cycles/${a.cycle}/units/${uid}/targets`, { itemCode: 'GUV-01' }, 'konak'); assert.equal(t1.status, 200, JSON.stringify(t1.body)); assert.equal(t1.body.status, 'accepted'); assert.equal(t1.body.metric_kind, 'item'); a.target = t1.body.id as string;
  const prop = t1.body.proposal as { low: number; high: number; target: number; source: string }; assert.ok(prop.low <= prop.target && prop.target <= prop.high);
  const oob = await api('POST', `/api/t/${a.id}/cycles/${a.cycle}/units/${uid}/targets`, { itemCode: 'GUR-01', target: 99 }, 'konak'); assert.equal(oob.status, 422);
  const t2 = await api('POST', `/api/t/${a.id}/cycles/${a.cycle}/units/${uid}/targets`, { itemCode: 'GUR-03' }, 'konak'); assert.equal(t2.status, 200, JSON.stringify(t2.body));
  const t3 = await api('POST', `/api/t/${a.id}/cycles/${a.cycle}/units/${uid}/targets`, { itemCode: 'GUR-01' }, 'konak'); assert.equal(t3.status, 409, 'üçüncü hedef sınıra takılır');
  const recs = await api('GET', `/api/t/${a.id}/targets/${a.target}/recommendations`, undefined, 'konak'); assert.ok((recs.body.recommendations as { code: string }[]).some(r => r.code === 'birebir-programi'));
  const wrongTpl = await api('POST', `/api/t/${a.id}/targets/${a.target}/actions`, { templateCode: 'kariyer-gorusmesi' }, 'konak'); assert.equal(wrongTpl.status, 422);
  const act = await api('POST', `/api/t/${a.id}/targets/${a.target}/actions`, { templateCode: 'birebir-programi', startDate: '2026-05-01', dueDate: '2026-09-30' }, 'konak'); assert.equal(act.status, 200, JSON.stringify(act.body)); a.action = act.body.id as string; assert.equal((act.body.requirement as { expected: number }).expected, 5, 'Mayis-Eylul: 5 aylik slot');
  const req_ = act.body.requirement as { expected: number; cadence: string }; assert.equal(req_.cadence, 'monthly'); assert.equal(req_.expected, 5, 'aylik ritim Mayis-Eylul 5 ay -> 5 gerceklesme');
  const e1 = await api('POST', `/api/t/${a.id}/actions/${a.action}/evidence`, { date: '2026-05-12', attendance: 7 }, 'konak'); assert.equal(e1.status, 200); assert.equal(e1.body.validity, 'valid');
  const dup = await api('POST', `/api/t/${a.id}/actions/${a.action}/evidence`, { date: '2026-05-12', attendance: 7 }, 'konak'); assert.equal(dup.body.validity, 'invalid'); assert.equal((dup.body.rejected as { reason: string }).reason, 'duplicate_occurrence');
  const sameDay = await api('POST', `/api/t/${a.id}/actions/${a.action}/evidence`, { date: '2026-05-12', attendance: 5, occurrenceKey: 'ikinci-ekip-2026-05-12' }, 'konak'); assert.equal(sameDay.body.validity, 'valid', 'aynı gün farklı olay occurrenceKey ile sayılır');
  const outW = await api('POST', `/api/t/${a.id}/actions/${a.action}/evidence`, { date: '2026-04-20', attendance: 7 }, 'konak'); assert.equal((outW.body.rejected as { reason: string }).reason, 'out_of_window');
  const fut = await api('POST', `/api/t/${a.id}/actions/${a.action}/evidence`, { date: '2026-12-01', attendance: 7 }, 'konak'); assert.equal(fut.status, 422); assert.equal(fut.body.error, 'future_date', 'R26: gelecek tarihli gerçekleşme reddedilir');
  const slot = await api('POST', `/api/t/${a.id}/actions/${a.action}/evidence`, { date: '2026-05-20', attendance: 7 }, 'konak'); assert.equal(slot.status, 422); assert.equal(slot.body.error, 'slot_taken', 'R26: aynı ay ikinci gerçekleşme occurrenceKey olmadan reddedilir');
  const noAtt = await api('POST', `/api/t/${a.id}/actions/${a.action}/evidence`, { date: '2026-06-10' }, 'konak'); assert.equal(noAtt.status, 422);
  for (const d of ['2026-06-10', '2026-07-08', '2026-08-12', '2026-09-09']) await api('POST', `/api/t/${a.id}/actions/${a.action}/evidence`, { date: d, attendance: 6 }, 'konak');
  const other = await api('POST', `/api/t/${a.id}/actions/${a.action}/evidence`, { date: '2026-06-11', attendance: 6 }, 'alsancak'); assert.equal(other.status, 403, 'başka şubenin müdürü kanıt giremez');
  const decl = await api('POST', `/api/t/${a.id}/actions/${a.action}/declare-complete`, {}, 'konak'); assert.equal(decl.status, 200); assert.equal(decl.body.validCount, 5, 'N23: ayni ay ikinci olay plan slotunu karsilamaz; 6 olay 5 plan ayi eder'); assert.equal(decl.body.verification, 'policy_met', 'N24: E1 politika karsilandi etiketi, bagimsiz dogrulama degil'); assert.equal(decl.body.lifecycle, 'closed', 'N24: politika karsilaninca is kapanir ve yuk disina cikar');
  assert.equal((await api('POST', `/api/t/${a.id}/actions/${a.action}/evidence`, { date: '2026-09-23', attendance: 6 }, 'konak')).status, 409, 'kapali ise kanit eklenmez');
  const noReason = await api('POST', `/api/t/${a.id}/actions/${a.action}/verify`, { ok: true }, 'hrbp'); assert.equal(noReason.status, 400, 'R07: gerekcesiz onay semada reddedilir');
  const strFalse = await api('POST', `/api/t/${a.id}/actions/${a.action}/verify`, { ok: 'false', reason: 'metin false' }, 'hrbp'); assert.equal(strFalse.status, 400, 'R07: ok="false" metni boolean degildir');
  const selfVerify = await api('POST', `/api/t/${a.id}/actions/${a.action}/verify`, { ok: true, reason: 'kendi kanitim' }, 'konak'); assert.equal(selfVerify.status, 403);
  const ver = await api('POST', `/api/t/${a.id}/actions/${a.action}/verify`, { ok: true, reason: 'takvim kayitlariyla orneklem kontrolu' }, 'hrbp'); assert.equal(ver.status, 409, 'politika ile kapanan is yeniden dogrulanmaz');
  const detail = await api('GET', `/api/t/${a.id}/actions/${a.action}`, undefined, 'bolge'); assert.equal(detail.body.lifecycle_state, 'closed'); assert.equal(detail.body.validCount, 5);
  const att = await api('GET', `/api/t/${a.id}/attention`, undefined, 'hr-ALFA'); assert.equal(att.status, 200);
  const sn = await api('POST', `/api/t/${a.id}/attention/${encodeURIComponent('invitations')}/snooze`, { until: '2027-01-01' }, 'hr-ALFA'); assert.equal(sn.status, 200);
});
test('8 takip ölçümü: ikinci dönem sonuçları → karşılaştırılabilirlik → inceleme kapısı → sonuç', async () => {
  const a = T['ALFA']!; const cyc = await api('POST', `/api/t/${a.id}/cycles`, { code: '2027-ANA', name: '2027 Ana Ölçüm', periodStart: '2027-04-05', periodEnd: '2027-04-23', instrumentVersionId: a.iv }, 'hr-ALFA'); a.cycle2 = cyc.body.id as string;
  const wb = await download(`/api/t/${a.id}/templates/results.xlsx?cycleId=${a.cycle2}`, 'hr-ALFA'); const ws = wb.getWorksheet('Sonuclar')!; const dws = wb.getWorksheet('Dagilimlar')!;
  ws.eachRow((row, n) => { if (n === 1) return; const unit = String(row.getCell(3).value), mc = String(row.getCell(4).value); if (unit !== 'KONAK' || !['GUV-01_TB', 'GUR-03_TB'].includes(mc)) return; const nn = 12; row.getCell(5).value = 'OBSERVED'; row.getCell(6).value = nn; row.getCell(7).value = '100'; for (const [o, c] of [['4', 5], ['5', 7]] as const) dws.addRow([a.code, '2027-ANA', 'KONAK', mc, o, c]); }); // takip: hedefin üstünde gözlem, ama n 32→12 inceleme gerektirir
  const up = await upload(`/api/t/${a.id}/imports/results?cycleId=${a.cycle2}`, 'hr-ALFA', await toBuf(wb)); assert.equal(up.body.state, 'validated', JSON.stringify((up.body.issues as unknown[]).slice(0, 3)));
  assert.equal((await api('POST', `/api/t/${a.id}/imports/${up.body.jobId}/commit`, {}, 'hr-ALFA')).status, 200);
  const fuGet = await api('GET', `/api/t/${a.id}/targets/${a.target}/followup?cycleId=${a.cycle2}`, undefined, 'konak'); assert.equal(fuGet.status, 200); assert.equal(fuGet.body.persisted, false, 'GET salt hesap, yazmaz'); const fu = await api('POST', `/api/t/${a.id}/targets/${a.target}/followup/assess`, { cycleId: a.cycle2 }, 'konak'); assert.equal(fu.status, 200, JSON.stringify(fu.body));
  const out = fu.body.outcome as { status: string; attainment: string; observedAboveTarget?: boolean }; const comp = fu.body.comparability as { status: string; version: string };
  assert.equal(comp.status, 'review_required', 'n 32→12 inceleme gerektirir'); assert.equal(out.status, 'PENDING_REVIEW'); assert.equal(out.attainment, 'NOT_EVALUATED'); assert.equal(out.observedAboveTarget, true);
  const noVer = await api('POST', `/api/t/${a.id}/targets/${a.target}/followup/review`, { cycleId: a.cycle2, decision: 'comparable_labeled' }, 'hrbp'); assert.equal(noVer.status, 400, 'sürümsüz onay reddedilir');
  const rev = await api('POST', `/api/t/${a.id}/targets/${a.target}/followup/review`, { cycleId: a.cycle2, decision: 'comparable_labeled', comparabilityVersion: comp.version, resultVersion: (fu.body.followup as { revision: number }).revision ? `R${(fu.body.followup as { revision: number }).revision}` : 'R1' }, 'hrbp'); assert.equal(rev.status, 200);
  const fu2 = await api('POST', `/api/t/${a.id}/targets/${a.target}/followup/assess`, { cycleId: a.cycle2 }, 'konak'); const out2 = fu2.body.outcome as { status: string; attainment: string; attributionEvidenceGrade: string; causalClaim: boolean };
  assert.equal(out2.status, 'EVALUATED'); assert.equal(out2.attainment, 'ACHIEVED'); assert.ok(['C', 'D'].includes(out2.attributionEvidenceGrade)); assert.equal(out2.causalClaim, false);
  const unitMgr = await api('POST', `/api/t/${a.id}/targets/${a.target}/followup/review`, { cycleId: a.cycle2, decision: 'comparable', comparabilityVersion: comp.version, resultVersion: 'R1' }, 'konak'); assert.equal(unitMgr.status, 403, 'şube müdürü inceleme onayı veremez');
});
test('9 sonuç düzeltmesi: yeni paket eski sonucu silmez, revizyon artar, kabul edilmiş hedefler yeniden kontrole düşer', async () => {
  const a = T['ALFA']!; const wb = await download(`/api/t/${a.id}/templates/results.xlsx?cycleId=${a.cycle2}`, 'hr-ALFA'); const ws = wb.getWorksheet('Sonuclar')!; const dws = wb.getWorksheet('Dagilimlar')!;
  wb.getWorksheet('Paket')!.getRow(2).getCell(2).value = 'DUZELTME-2027-B2';
  ws.eachRow((row, n) => { if (n === 1) return; if (String(row.getCell(3).value) !== 'KONAK' || String(row.getCell(4).value) !== 'GUV-01_TB') return; row.getCell(5).value = 'OBSERVED'; row.getCell(6).value = 12; row.getCell(7).value = '50'; for (const [o, c] of [['2', 3], ['3', 3], ['4', 3], ['5', 3]] as const) dws.addRow([a.code, '2027-ANA', 'KONAK', 'GUV-01_TB', o, c]); });
  const up = await upload(`/api/t/${a.id}/imports/results?cycleId=${a.cycle2}`, 'hr-ALFA', await toBuf(wb)); assert.equal(up.body.state, 'validated'); assert.equal((up.body.preview as { supersedesActiveBatch: boolean }).supersedesActiveBatch, true);
  const c = await api('POST', `/api/t/${a.id}/imports/${up.body.jobId}/commit`, {}, 'hr-ALFA'); assert.equal(c.status, 200); assert.equal((c.body.applied as { revision: number }).revision, 2);
  const client = new pg.Client({ connectionString: config.databaseUrl }); await client.connect(); try { await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [a.id]);
  const hist = await client.query('SELECT revision, superseded_by IS NOT NULL AS superseded FROM result WHERE cycle_id = $1 AND metric_code = $2 ORDER BY revision', [a.cycle2, 'GUV-01_TB']); assert.equal(hist.rows.length, 2); assert.equal(hist.rows[0].superseded, true); } finally { await client.end(); }
  const fu = await api('GET', `/api/t/${a.id}/targets/${a.target}/followup?cycleId=${a.cycle2}`, undefined, 'konak'); assert.equal((fu.body.outcome as { status: string }).status, 'PENDING_REVIEW', 'düzeltme eski inceleme onayını geçersiz kılar (sürüm eşleşmez)');
});

// ---------------- v2.13.0: AI Hedef ve Aksiyon Planı (gerçek PostgreSQL + gerçek Fastify; sağlayıcı yerel sahte OpenAI sunucusu) ----------------
import { createServer, type IncomingMessage } from 'node:http';
import { openProviderKey } from '../src/ai/crypto.js';
type AiReq = { auth: string; body: { model: string; store: boolean; input: { role: string; content: string }[]; text: { format: { type: string; strict: boolean; schema: unknown } } } };
const aiCalls: AiReq[] = []; let aiMode: 'valid' | 'range' | 'refusal' | 'invalid' | 'timeout' | 'company' = 'valid'; let aiUrl = '';
const planFor = (ctx: { currentValue: number | null; allowedTargetRange: { low: number; high: number } | null; planHorizonMonths: number }, scope = 'MIXED') => ({
  executiveSummary: 'Özet.', interventionScope: scope, confidence: 'MEDIUM', evidenceSummary: ['Birim değeri pakette verildiği gibi.'], relatedPatterns: [], hypotheses: ['Hipotez: toplantı ritmi düzensiz olabilir.'], validationChecks: ['Ekiple kısa görüşme.'],
  targetRecommendation: { currentValue: ctx.currentValue, allowedRange: ctx.allowedTargetRange, recommendedValue: aiMode === 'range' ? 150 : (ctx.allowedTargetRange ? ctx.allowedTargetRange.low : null), rationale: 'Aralığın alt ucu.' },
  actions: [{ title: 'Aylık birebir görüşme ritmi kur', objective: 'Düzenli geri bildirim', rationale: 'Pakete dayalı', phase: 'QUICK_WIN', cadence: 'biweekly', level: 'UNIT', firstStep: 'İlk hafta takvimi çıkar', expectedOutput: 'Görüşme takvimi', checkpoint: 'Ay sonunda İK ile gözden geçirme', startMonth: 2, endMonth: Math.min(3, ctx.planHorizonMonths), ownerRole: 'Birim yöneticisi', collaborators: ['İK iş ortağı'], steps: ['Takvim çıkar', 'İlk turu yap', 'Notları derle'], indicators: ['Görüşme gerçekleşme oranı'], evidenceRequired: ['Takvim kaydı'], dependencies: [], risks: ['İş yükü'] }],
  companySupportNeeds: ['Şablon desteği'], monitoringPlan: { monthly: 'gerçekleşme', quarterly: 'öncü gösterge', month6: 'ara değerlendirme', month12: 'takip ölçümü' }, guardrails: ['Diğer maddeler düşmesin'], missingData: [], assumptions: [], dataUsed: ['unit.currentValue'], successCriteria: { process: 'Görüşmelerin %90\'ı tamamlandı', quality: 'Ortak standartta', outcome: 'Takip döneminde değer hedefe yaklaşır' } });
const aiServer = createServer(async (req: IncomingMessage, res) => {
  let raw = ''; for await (const ch of req) raw += ch; const body = JSON.parse(raw); aiCalls.push({ auth: String(req.headers.authorization ?? ''), body });
  if (aiMode === 'timeout') { setTimeout(() => { try { res.end('{}'); } catch { /* kapandı */ } }, 3000); return; }
  const ctx = JSON.parse(body.input.find((i: { role: string }) => i.role === 'user').content);
  const content = aiMode === 'refusal' ? [{ type: 'refusal', refusal: 'yanıt verilmiyor' }] : [{ type: 'output_text', text: aiMode === 'invalid' ? '{"executiveSummary": 3}' : JSON.stringify(planFor(ctx, aiMode === 'company' ? 'COMPANY' : 'MIXED')) }];
  res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ status: 'completed', output: [{ type: 'message', content }] }));
});
const count = async (sql: string, args: unknown[] = []) => { const c = new pg.Client({ connectionString: config.migrateUrl }); await c.connect(); try { return Number((await c.query(sql, args)).rows[0].n); } finally { await c.end(); } };
const walk = (o: unknown, f: (x: Record<string, unknown>) => void) => { if (o && typeof o === 'object') { if (!Array.isArray(o)) f(o as Record<string, unknown>); for (const v of Object.values(o as object)) walk(v, f); } };

test('10 AI bağlantısı: yalnız şirket geneli İK yöneticisi; anahtar hiçbir yanıtta yok; şirkete bağlı mühür (A → B açılamaz)', async () => {
  await new Promise<void>(r => aiServer.listen(0, '127.0.0.1', () => r())); aiUrl = `http://127.0.0.1:${(aiServer.address() as { port: number }).port}/v1`;
  process.env.HPW_AI_BASE_URL = aiUrl; process.env.HPW_AI_MODEL = 'hpw-test-model'; process.env.HPW_AI_TIMEOUT_MS = '1500';
  const a = T['ALFA']!, b = T['BETA']!; const KEY = 'sk-test-ALFA-0123456789abcdefWXYZ';
  assert.equal((await api('POST', `/api/t/${a.id}/ai/config`, { apiKey: KEY }, 'konak')).status, 403, 'birim yöneticisi anahtar yönetemez');
  assert.equal((await api('POST', `/api/t/${a.id}/ai/config`, { apiKey: KEY }, 'hr-BETA')).status, 403, 'başka şirketin İK yöneticisi');
  const put = await api('POST', `/api/t/${a.id}/ai/config`, { apiKey: KEY }, 'hr-ALFA'); assert.equal(put.status, 200, JSON.stringify(put.body)); assert.ok(!JSON.stringify(put.body).includes(KEY));
  const st = await api('GET', `/api/t/${a.id}/ai/status`, undefined, 'hr-ALFA'); assert.equal(st.body.available, true); assert.equal(st.body.keyLast4, 'WXYZ'); assert.ok(!JSON.stringify(st.body).includes(KEY));
  const stK = await api('GET', `/api/t/${a.id}/ai/status`, undefined, 'konak'); assert.equal(stK.body.available, true); assert.equal(stK.body.keyLast4, undefined, 'yönetmeyen kullanıcıya son 4 hane bile dönmez');
  const sealed = await (async () => { const c = new pg.Client({ connectionString: config.migrateUrl }); await c.connect(); try { return (await c.query('SELECT key_sealed FROM tenant_ai_config WHERE tenant_id = $1', [a.id])).rows[0].key_sealed as string; } finally { await c.end(); } })();
  assert.ok(!sealed.includes(KEY) && !sealed.includes('WXYZ')); assert.equal(openProviderKey(a.id, sealed), KEY); assert.throws(() => openProviderKey(b.id, sealed), 'A şirketinin mührü B bağlamında açılamaz');
  const stB = await api('GET', `/api/t/${b.id}/ai/status`, undefined, 'hr-BETA'); assert.equal(stB.body.available, false); assert.equal(stB.body.configured, false);
  assert.equal((await api('POST', `/api/t/${b.id}/ai/config/remove`, {}, 'konak')).status, 403, 'başka şirketin kullanıcısı bağlantı kaldıramaz');
  const rm = await api('POST', `/api/t/${b.id}/ai/config/remove`, {}, 'hr-BETA'); assert.equal(rm.status, 200); assert.equal(rm.body.configured, false);
  assert.equal((await api('GET', `/api/t/${a.id}/ai/status`, undefined, 'hr-ALFA')).body.configured, true, 'B şirketindeki kaldırma A bağlantısını etkilemez');
});

test('11 plan üretimi: tek çağrı; store:false + katı şema + sunucu modeli; gizli değer yükte yok; önbellek; açık yeniden oluşturma; bayatlık', async () => {
  const a = T['ALFA']!; aiMode = 'valid'; aiCalls.length = 0;
  assert.equal((await api('POST', `/api/t/${a.id}/targets/${a.target}/ai-plan`, {}, 'hr-BETA')).status, 403, 'başka şirket');
  const r1 = await api('POST', `/api/t/${a.id}/targets/${a.target}/ai-plan`, {}, 'konak'); assert.equal(r1.status, 200, JSON.stringify(r1.body)); assert.equal(aiCalls.length, 1); assert.equal(r1.body.cached, false);
  const q = aiCalls[0]!; assert.equal(q.body.store, false); assert.equal(q.body.model, 'hpw-test-model'); assert.equal(q.body.text.format.type, 'json_schema'); assert.equal(q.body.text.format.strict, true); assert.equal(q.auth, 'Bearer sk-test-ALFA-0123456789abcdefWXYZ');
  const ctx = JSON.parse(q.body.input.find(i => i.role === 'user')!.content); const thr = await count('SELECT confidentiality_threshold AS n FROM survey_cycle WHERE tenant_id = $1 AND id = $2', [a.id, a.cycle]);
  walk(ctx, o => { if (typeof o.n === 'number') assert.ok(o.n >= thr, `küçük grup n=${o.n} yükte`); if (o.hidden === true) assert.ok(o.value === null && (o.n === null || o.n === undefined), 'gizli satırda değer yok'); });
  assert.ok(!JSON.stringify(ctx).match(/"(resultId|userId|email|personId)"/), 'kimlik alanı yok'); assert.equal(ctx.selectedQuestion.code, 'GUV-01');
  const r2 = await api('POST', `/api/t/${a.id}/targets/${a.target}/ai-plan`, {}, 'konak'); assert.equal(r2.status, 200); assert.equal(r2.body.cached, true); assert.equal(aiCalls.length, 1, 'aynı parmak izi yeni çağrı üretmez');
  const g = await api('GET', `/api/t/${a.id}/targets/${a.target}/ai-plan`, undefined, 'konak'); assert.equal(g.body.plan.stale, false); assert.equal(aiCalls.length, 1, 'yeniden açma çağrı yapmaz');
  const r3 = await api('POST', `/api/t/${a.id}/targets/${a.target}/ai-plan`, { regenerate: true }, 'konak'); assert.equal(r3.status, 200); assert.equal(aiCalls.length, 2, 'açık yeniden oluşturma yeni çağrı üretir');
  a.aiPlan = r3.body.plan.id as string;
});

test('12 hatalı çıktı: aralık dışı hedef, şema dışı, ret ve zaman aşımında hiçbir iş kaydı yazılmaz', async () => {
  const a = T['ALFA']!; const before = { plan: await count('SELECT count(*) AS n FROM ai_plan'), act: await count('SELECT count(*) AS n FROM action'), tgt: await count('SELECT count(*) AS n FROM local_target') };
  for (const [mode, code] of [['range', 'ai_range_violation'], ['invalid', 'ai_invalid_output'], ['refusal', 'ai_refusal'], ['timeout', 'ai_timeout']] as const) {
    aiMode = mode; const r = await api('POST', `/api/t/${a.id}/targets/${a.target}/ai-plan`, { regenerate: true }, 'konak'); assert.ok(r.status === 502 || r.status === 504, `${mode}: ${r.status}`); assert.equal(r.body.error, code);
  }
  assert.deepEqual({ plan: await count('SELECT count(*) AS n FROM ai_plan'), act: await count('SELECT count(*) AS n FROM action'), tgt: await count('SELECT count(*) AS n FROM local_target') }, before);
  assert.ok(await count("SELECT count(*) AS n FROM ai_call_log WHERE outcome IN ('range_violation','invalid_output','refusal','timeout')") >= 4); aiMode = 'valid';
});

test('13 yetki ve anahtarsız şirket: hedef yetkisi olmayan kullanıcı AI kullanamaz; B şirketi A anahtarıyla çağrı yapamaz; HPW personeli kullanamaz', async () => {
  const a = T['ALFA']!, b = T['BETA']!; const n0 = aiCalls.length;
  const alsancak = await api('POST', `/api/t/${a.id}/targets/${a.target}/ai-plan`, {}, 'alsancak'); assert.ok([403, 404].includes(alsancak.status), `başka birimin yöneticisi: ${alsancak.status}`);
  const hpw = await api('POST', `/api/t/${a.id}/targets/${a.target}/ai-plan`, {}, 'platform'); assert.ok([403, 404].includes(hpw.status), `HPW personeli: ${hpw.status}`);
  const bt = await count('SELECT count(*) AS n FROM local_target WHERE tenant_id = $1', [b.id]);
  if (bt > 0) { const c = new pg.Client({ connectionString: config.migrateUrl }); await c.connect(); const tb = (await c.query('SELECT id FROM local_target WHERE tenant_id = $1 LIMIT 1', [b.id])).rows[0].id; await c.end(); const rb = await api('POST', `/api/t/${b.id}/targets/${tb}/ai-plan`, {}, 'hr-BETA'); assert.equal(rb.status, 409); assert.equal(rb.body.error, 'ai_not_configured'); }
  assert.equal(aiCalls.length, n0, 'hiçbir yetkisiz istek sağlayıcıya ulaşmadı');
});

test('14 plandan aksiyon: hedef kabulsüzken kayıt yok; seçilenler tek işlemde "planlandı"; kapasite aşılırsa hiçbiri açılmaz; iki kez açılmaz; COMPANY yerel aksiyona çevrilmez; veri değişince plan bayat', async () => {
  const a = T['ALFA']!; const uid = a.units!['KONAK']!;
  const tgt = await count('SELECT count(*) AS n FROM local_target WHERE tenant_id = $1 AND id = $2 AND status IN (\'accepted\',\'active\')', [a.id, a.target]); assert.equal(tgt, 1, 'fikstür: kabul edilmiş hedef');
  const active = await count("SELECT count(*) AS n FROM action WHERE tenant_id = $1 AND unit_id = $2 AND lifecycle_state IN ('planned','in_progress','paused','declared_complete')", [a.id, uid]);
  const nAct0 = await count('SELECT count(*) AS n FROM action WHERE tenant_id = $1', [a.id]);
  const over = await api('POST', `/api/t/${a.id}/ai-plans/${a.aiPlan}/actions`, { indices: [0, 1, 2].slice(0, Math.max(1, 3 - active + 1)) }, 'konak');
  if (3 - active + 1 <= 1) { /* birim zaten dolu */ } else if ((await count('SELECT jsonb_array_length(output->\'actions\') AS n FROM ai_plan WHERE tenant_id = $1 AND id = $2', [a.id, a.aiPlan])) >= 3 - active + 1) { assert.equal(over.status, 409); assert.equal(await count('SELECT count(*) AS n FROM action WHERE tenant_id = $1', [a.id]), nAct0, 'kapasite aşılırsa kısmi oluşturma yok'); }
  const o1 = await api('POST', `/api/t/${a.id}/ai-plans/${a.aiPlan}/actions`, { indices: [0] }, 'konak');
  if (active >= 3) { assert.equal(o1.status, 409); assert.equal(o1.body.error, 'action_limit'); }
  else { assert.equal(o1.status, 200, JSON.stringify(o1.body)); const act = (o1.body.actions as { id: string; lifecycle_state: string }[])[0]!; assert.equal(act.lifecycle_state, 'planned');
    const list = await api('GET', `/api/t/${a.id}/actions?unitId=${uid}`, undefined, 'konak'); assert.ok((list.body as { id: string; from_ai_plan: boolean }[]).some(x => x.id === act.id && x.from_ai_plan === true), 'AI kökenli olduğu görünür');
    const st = await api('POST', `/api/t/${a.id}/actions/${act.id}/transition`, { to: 'in_progress', reason: 'AI planından gelen taslak başlatıldı' }, 'konak'); assert.equal(st.status, 200, 'taslak mevcut geçişle başlatılır');
    const o2 = await api('POST', `/api/t/${a.id}/ai-plans/${a.aiPlan}/actions`, { indices: [0] }, 'konak'); assert.equal(o2.status, 409); assert.equal(o2.body.error, 'already_opened');
    const g = await api('GET', `/api/t/${a.id}/targets/${a.target}/ai-plan`, undefined, 'konak'); assert.equal(g.body.plan.stale, false, 'v2.13.1: planın KENDİ açtığı aksiyon planı bayatlatmaz (kalan aksiyonlar aktarılabilir); temel veri değişimi test 18'); }
  aiMode = 'company'; const rc = await api('POST', `/api/t/${a.id}/targets/${a.target}/ai-plan`, { regenerate: true }, 'konak'); assert.equal(rc.status, 200); aiMode = 'valid';
  const oc = await api('POST', `/api/t/${a.id}/ai-plans/${rc.body.plan.id}/actions`, { indices: [0] }, 'konak'); assert.equal(oc.status, 409); assert.equal(oc.body.error, 'not_local_scope');
});

test('14b v2.14.0 plan adımları: AI kökenli aksiyonda adımlar listelenir, yapıldı olarak işaretlenir (append-only, gelecek tarih yok, idempotent); plansız aksiyonda fromPlan=false', async () => {
  const a = T['ALFA']!; const uid = a.units!['KONAK']!;
  const list = await api('GET', `/api/t/${a.id}/actions?unitId=${uid}`, undefined, 'konak'); const acts = list.body as { id: string; from_ai_plan: boolean; lifecycle_state: string }[];
  const ai = acts.find(x => x.from_ai_plan && ['in_progress', 'planned'].includes(x.lifecycle_state)); const plain = acts.find(x => !x.from_ai_plan);
  if (plain) { const g0 = await api('GET', `/api/t/${a.id}/actions/${plain.id}/plan-steps`, undefined, 'konak'); assert.equal(g0.status, 200); assert.equal(g0.body.fromPlan, false); assert.equal(g0.body.total, 0); const d0 = await api('POST', `/api/t/${a.id}/actions/${plain.id}/plan-steps/0/done`, { date: '2026-01-15' }, 'konak'); assert.equal(d0.status, 404); }
  if (!ai) return; // birim doluysa (test 14'te taslak açılamadı) bu bölüm atlanır
  const g = await api('GET', `/api/t/${a.id}/actions/${ai.id}/plan-steps`, undefined, 'konak'); assert.equal(g.status, 200, JSON.stringify(g.body)); assert.equal(g.body.fromPlan, true); assert.ok(g.body.total >= 1); assert.equal(g.body.doneCount, 0); assert.equal(g.body.steps[0].doneAt, null); assert.equal(typeof g.body.steps[0].text, 'string');
  const fut = await api('POST', `/api/t/${a.id}/actions/${ai.id}/plan-steps/0/done`, { date: '2099-01-01' }, 'konak'); assert.equal(fut.status, 422); assert.equal(fut.body.error, 'future_date');
  const yok = await api('POST', `/api/t/${a.id}/actions/${ai.id}/plan-steps/49/done`, { date: '2026-01-15' }, 'konak'); assert.equal(yok.status, 404);
  const d1 = await api('POST', `/api/t/${a.id}/actions/${ai.id}/plan-steps/0/done`, { date: '2026-01-15', note: 'Yoğunluk listesi çıkarıldı' }, 'konak'); assert.equal(d1.status, 200, JSON.stringify(d1.body)); assert.equal(d1.body.alreadyDone, false); assert.equal(d1.body.doneAt, '2026-01-15');
  const d2 = await api('POST', `/api/t/${a.id}/actions/${ai.id}/plan-steps/0/done`, { date: '2026-02-01' }, 'konak'); assert.equal(d2.status, 200); assert.equal(d2.body.alreadyDone, true); assert.equal(d2.body.doneAt, '2026-01-15', 'ilk kayıt korunur; değiştirilmez');
  const g2 = await api('GET', `/api/t/${a.id}/actions/${ai.id}/plan-steps`, undefined, 'konak'); assert.equal(g2.body.doneCount, 1); assert.equal(g2.body.steps[0].doneAt, '2026-01-15'); assert.equal(g2.body.steps[0].note, 'Yoğunluk listesi çıkarıldı');
  const audit_ = await count("SELECT count(*) AS n FROM audit_event WHERE tenant_id = $1 AND entity_id = $2 AND action = 'plan_step_done'", [a.id, ai.id]); assert.equal(audit_, 1, 'tek işlem kaydı');
  const ev = await api('GET', `/api/t/${a.id}/actions/${ai.id}`, undefined, 'konak'); assert.equal((ev.body.evidence as unknown[]).length, 0, 'plan adımı gerçekleşme (kanıt) kaydı üretmez');
});

test('15 özel (şirkete özel) soru: sabit soru listesi yok; aynı motor çalışır', async () => {
  const a = T['ALFA']!; const uid = a.units!['ALSANCAK']!;
  const t = await api('POST', `/api/t/${a.id}/cycles/${a.cycle}/units/${uid}/targets`, { itemCode: 'OZL-01' }, 'hr-ALFA');
  assert.ok(t.status === 200 || t.status === 409, JSON.stringify(t.body));
  const tid = t.status === 200 ? t.body.id as string : await (async () => { const c = new pg.Client({ connectionString: config.migrateUrl }); await c.connect(); try { return (await c.query("SELECT id FROM local_target WHERE tenant_id = $1 AND unit_id = $2 AND item_code = 'OZL-01' ORDER BY created_at DESC LIMIT 1", [a.id, uid])).rows[0].id as string; } finally { await c.end(); } })();
  const n0 = aiCalls.length; const r = await api('POST', `/api/t/${a.id}/targets/${tid}/ai-plan`, {}, 'hr-ALFA'); assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(aiCalls.length, n0 + 1);
  const ctx = JSON.parse(aiCalls[aiCalls.length - 1]!.body.input.find(i => i.role === 'user')!.content); assert.equal(ctx.selectedQuestion.code, 'OZL-01');
  const st = await count('SELECT count(*) AS n FROM local_target WHERE tenant_id = $1 AND id = $2 AND status IN (\'accepted\',\'active\')', [a.id, tid]);
  if (st === 0) { const n0a = await count('SELECT count(*) AS n FROM action WHERE tenant_id = $1', [a.id]); const x = await api('POST', `/api/t/${a.id}/ai-plans/${r.body.plan.id}/actions`, { indices: [0] }, 'hr-ALFA'); assert.equal(x.status, 409); assert.equal(x.body.error, 'target_not_accepted'); assert.equal(await count('SELECT count(*) AS n FROM action WHERE tenant_id = $1', [a.id]), n0a); } assert.ok(String(ctx.selectedQuestion.text).length > 5);
});

// ---------------- v2.13.1: hedef ÖNCESİ AI planı, hedefe bağlama, bayat plan koruması, plan tarihli/sıklıklı aksiyon aktarımı (gerçek PostgreSQL; sahte OpenAI)
test('16 hedef öncesi plan: önizleme bağlamında tek çağrı; hedef kaydı yok; yenileme çağrı üretmez; yetkisiz/başka şirket/küçük grup çağrı üretmez', async () => {
  aiServer.listening || await new Promise<void>(r => aiServer.listen(0, '127.0.0.1', () => r())); process.env.HPW_AI_BASE_URL = `http://127.0.0.1:${(aiServer.address() as { port: number }).port}/v1`; aiMode = 'valid';
  const a = T['ALFA']!; const uid = a.units!['ALSANCAK']!; const url = `/api/t/${a.id}/cycles/${a.cycle}/units/${uid}/items/GUV-01/ai-plan`;
  const tgt0 = await count("SELECT count(*) AS n FROM local_target WHERE tenant_id = $1 AND unit_id = $2 AND item_code = 'GUV-01'", [a.id, uid]); assert.equal(tgt0, 0, 'fikstür: bu madde için hedef yok');
  const n0 = aiCalls.length;
  assert.equal((await api('POST', url, {}, 'hr-BETA')).status, 403, 'başka şirket'); assert.equal((await api('POST', url, {}, 'konak')).status, 403, 'başka birimin yöneticisi');
  const small = await api('POST', `/api/t/${a.id}/cycles/${a.cycle}/units/${a.units!['KUCUK']!}/items/GUV-01/ai-plan`, {}, 'hr-ALFA'); assert.ok(small.status >= 400 && small.status < 500, `küçük grup: ${small.status}`);
  assert.equal(aiCalls.length, n0, 'yetkisiz/gizli istekler sağlayıcıya ulaşmadı');
  const r1 = await api('POST', url, {}, 'hr-ALFA'); assert.equal(r1.status, 200, JSON.stringify(r1.body)); assert.equal(aiCalls.length, n0 + 1); assert.equal(r1.body.plan.plan.actions[0].cadence, 'biweekly');
  const ctx = JSON.parse(aiCalls[aiCalls.length - 1]!.body.input.find(i => i.role === 'user')!.content); assert.equal(ctx.selectedQuestion.code, 'GUV-01'); assert.ok('selectedQuestionComparisons' in ctx && 'benchmarkCertified' in ctx.selectedQuestionComparisons, 'şirket değeri ve kıyas açık');
  assert.ok(ctx.unitSurveyContext.every((o: { companyValue?: unknown }) => 'companyValue' in o), 'diğer görünür soruların şirket değeri korunur');
  assert.equal(await count("SELECT count(*) AS n FROM local_target WHERE tenant_id = $1 AND unit_id = $2 AND item_code = 'GUV-01'", [a.id, uid]), 0, 'AI hedef kaydı yazmaz');
  assert.equal(await count('SELECT count(*) AS n FROM ai_plan WHERE tenant_id = $1 AND id = $2 AND target_id IS NULL', [a.id, r1.body.plan.id]), 1, 'plan hedefe bağlı değil');
  const r2 = await api('POST', url, {}, 'hr-ALFA'); assert.equal(r2.body.cached, true); const g = await api('GET', url, undefined, 'hr-ALFA'); assert.equal(g.body.plan.id, r1.body.plan.id); assert.equal(g.body.plan.stale, false); assert.equal(aiCalls.length, n0 + 1, 'yenileme ve yeniden açma çağrı üretmez');
  a.preview = { plan: r1.body.plan.id as string, rec: r1.body.plan.plan.targetRecommendation.recommendedValue as number, low: g.body.allowedTargetRange.low as number, high: g.body.allowedTargetRange.high as number };
});

test('17 hedef oluşturulunca önizleme planı yeni çağrı olmadan hedefe bağlanır; başka kapsama bağlanamaz; bağlı plan bayat değil', async () => {
  const a = T['ALFA']!; const uid = a.units!['ALSANCAK']!; const n0 = aiCalls.length; assert.ok(a.preview!.rec >= a.preview!.low && a.preview!.rec <= a.preview!.high, 'AI hedefi izinli aralıkta');
  const t = await api('POST', `/api/t/${a.id}/cycles/${a.cycle}/units/${uid}/targets`, { itemCode: 'GUV-01', target: a.preview!.rec }, 'hr-ALFA'); assert.equal(t.status, 200, JSON.stringify(t.body)); const ltid = t.body.id as string;
  const wrong = await api('POST', `/api/t/${a.id}/ai-plans/${a.preview!.plan}/bind`, { targetId: a.target }, 'hr-ALFA'); assert.equal(wrong.status, 409, 'başka madde/birim hedefine bağlanamaz');
  const bnd = await api('POST', `/api/t/${a.id}/ai-plans/${a.preview!.plan}/bind`, { targetId: ltid }, 'hr-ALFA'); assert.equal(bnd.status, 200, JSON.stringify(bnd.body));
  assert.equal(await count('SELECT count(*) AS n FROM ai_plan WHERE tenant_id = $1 AND id = $2 AND target_id = $3', [a.id, a.preview!.plan, ltid]), 1);
  const g = await api('GET', `/api/t/${a.id}/targets/${ltid}/ai-plan`, undefined, 'hr-ALFA'); assert.equal(g.body.plan.id, a.preview!.plan); assert.equal(g.body.plan.stale, false, 'hedefin oluşması planı bayatlatmaz'); assert.equal(aiCalls.length, n0, 'bağlama için sağlayıcı çağrısı yok');
  assert.equal((await api('POST', `/api/t/${a.id}/ai-plans/${a.preview!.plan}/bind`, { targetId: ltid }, 'hr-BETA')).status, 403, 'başka şirket bağlayamaz');
  a.previewTarget = ltid; a.previewStatus = t.body.status as string;
});

test('18 aktarım: bayat plan aksiyon açamaz; güncel plandan tarih ve sıklık plandan (kabul tarihi çıpası, ufuk sınırı); aksiyondan plan ayrıntısı', async () => {
  const a = T['ALFA']!; const ltid = a.previewTarget!;
  const st = await count("SELECT count(*) AS n FROM local_target WHERE tenant_id = $1 AND id = $2 AND status IN ('accepted','active')", [a.id, ltid]);
  if (st === 0) { const x = await api('POST', `/api/t/${a.id}/ai-plans/${a.preview!.plan}/actions`, { indices: [0] }, 'hr-ALFA'); assert.equal(x.status, 409); assert.equal(x.body.error, 'target_not_accepted'); return; }
  const amb = await api('POST', `/api/t/${a.id}/corporate/ambitions`, { cycleId: a.cycle, itemCode: 'GUV-01', ambitionValue: 70, rationale: 'bayatlık sınaması için kurumsal istek' }, 'hr-ALFA'); assert.equal(amb.status, 200, JSON.stringify(amb.body));
  const g = await api('GET', `/api/t/${a.id}/targets/${ltid}/ai-plan`, undefined, 'hr-ALFA'); assert.equal(g.body.plan.stale, true, 'temel veri değişti: plan bayat');
  const n0act = await count('SELECT count(*) AS n FROM action WHERE tenant_id = $1', [a.id]);
  const x = await api('POST', `/api/t/${a.id}/ai-plans/${a.preview!.plan}/actions`, { indices: [0] }, 'hr-ALFA'); assert.equal(x.status, 409); assert.equal(x.body.error, 'plan_stale'); assert.equal(await count('SELECT count(*) AS n FROM action WHERE tenant_id = $1', [a.id]), n0act, 'bayat plandan kayıt yok');
  const rg = await api('POST', `/api/t/${a.id}/targets/${ltid}/ai-plan`, { regenerate: true }, 'hr-ALFA'); assert.equal(rg.status, 200); const pid = rg.body.plan.id as string;
  const o = await api('POST', `/api/t/${a.id}/ai-plans/${pid}/actions`, { indices: [0] }, 'hr-ALFA'); assert.equal(o.status, 200, JSON.stringify(o.body));
  const w = (o.body.actions as { id: string; plannedWindow: { startDate: string; dueDate: string; cadence: string; anchor: string } }[])[0]!;
  const c = new pg.Client({ connectionString: config.migrateUrl }); await c.connect(); const row = (await c.query('SELECT start_date::text AS s, due_date::text AS d, requirement->>\'cadence\' AS cad, lifecycle_state FROM action WHERE tenant_id = $1 AND id = $2', [a.id, w.id])).rows[0]; await c.end();
  const add = (iso: string, m: number) => { const [y, mo, d] = iso.split('-').map(Number) as [number, number, number]; const t = new Date(Date.UTC(y, mo - 1 + m, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(d, last)); return t.toISOString().slice(0, 10); };
  assert.equal(row.s, add(w.plannedWindow.anchor, 1), 'startMonth 2 → çıpa + 1 ay'); assert.equal(row.cad, 'biweekly', 'sıklık plandan'); assert.equal(row.lifecycle_state, 'planned'); assert.ok(row.d <= add(w.plannedWindow.anchor, 12) && row.d > row.s, 'bitiş ufku aşmaz');
  const det = await api('GET', `/api/t/${a.id}/actions/${w.id}/ai-plan`, undefined, 'hr-ALFA'); assert.equal(det.status, 200); assert.equal(det.body.action.title, 'Aylık birebir görüşme ritmi kur'); assert.ok(det.body.action.steps.length >= 3 && det.body.action.evidenceRequired.length >= 1); assert.match(det.body.note, /gerçekleşme ya da kanıt değildir/);
  assert.equal((await api('GET', `/api/t/${a.id}/actions/${w.id}/ai-plan`, undefined, 'hr-BETA')).status, 403, 'başka şirket plan ayrıntısını göremez');
});

test('19 sahte sağlayıcı kapanır', async () => { await new Promise<void>(res => aiServer.close(() => res())); });
