/** v3.1.0 (R-05…R-09) — adım kayıtları: not, gelişme, engel/çözüm, geri alma, dosya. Gerçek PostgreSQL + Fastify HTTP; veriler sentetiktir.
 * Organizasyon: KOK (üst yönetim) → R1 (bölge müdürü) → U1, U2; U3 doğrudan KOK'a bağlı. İK = şirket yöneticisi (HR_ADMIN). */
import { ensureMfa } from './mfa-helper.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { buildApp } from '../src/server.js';
import { config } from '../src/config.js';

let app: Awaited<ReturnType<typeof buildApp>>;
const cookies: Record<string, string> = {};
const cookieOf = (res: { headers: Record<string, unknown> }) => { const sc = res.headers['set-cookie']; const raw = Array.isArray(sc) ? sc[0] : String(sc ?? ''); return raw.split(';')[0]!; };
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const key = () => randomUUID();
async function api(method: 'GET' | 'POST', url: string, body?: unknown, who?: string, headers: Record<string, string> = {}) { const res = await app.inject({ method, url, payload: body as Record<string, unknown> | undefined, headers: { ...(who ? { cookie: cookies[who]! } : {}), ...headers } }); let json: unknown = null; try { json = JSON.parse(res.body); } catch { json = res.body; } return { status: res.statusCode, body: json as J, raw: res.rawPayload, res }; }
function mailToken(email: string): string { const files = readdirSync(config.mailDir).filter(f => f.endsWith('.eml')).map(f => readFileSync(`${config.mailDir}/${f}`, 'utf8')).filter(t => t.includes(`To: ${email}`) && t.includes('#/davet/')).map(t => ({ t, d: /Date: (\S+)/.exec(t)?.[1] ?? '' })).sort((a, b) => (a.d < b.d ? 1 : -1)); assert.ok(files.length, `davet yok: ${email}`); return /#\/davet\/([A-Za-z0-9_-]+)/.exec(files[0]!.t)![1]!; }
async function login(email: string, who: string, password: string) { const r = await api('POST', '/api/auth/login', { email, password }); assert.equal(r.status, 200, JSON.stringify(r.body)); cookies[who] = cookieOf(r.res); if (r.body.realm === 'platform') await ensureMfa((m, u, b) => api(m as 'GET', u, b, who) as never, email); }
const PW = 'Parola12345'; const S = 'K' + Date.now().toString(36).toLocaleUpperCase('en-US').slice(-4); const dom = `k${S.toLocaleLowerCase('en-US')}.test`;
function multipart(parts: { name: string; value?: string; file?: { name: string; buf: Buffer } }[]) {
  const b = '----hpw' + randomUUID(); const chunks: Buffer[] = [];
  for (const p of parts) {
    if (p.file) chunks.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${p.name}"; filename="${p.file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`), p.file.buf, Buffer.from('\r\n'));
    else chunks.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${p.name}"\r\n\r\n${p.value ?? ''}\r\n`));
  }
  chunks.push(Buffer.from(`--${b}--\r\n`)); return { payload: Buffer.concat(chunks), type: `multipart/form-data; boundary=${b}` };
}
async function upload(tid: string, kind: string, wb: ExcelJS.Workbook, who: string) {
  const m = multipart([{ name: 'file', file: { name: `${kind}.xlsx`, buf: Buffer.from(await wb.xlsx.writeBuffer()) } }]);
  const res = await app.inject({ method: 'POST', url: `/api/t/${tid}/imports/${kind}`, payload: m.payload, headers: { cookie: cookies[who]!, 'content-type': m.type } });
  return { status: res.statusCode, body: JSON.parse(res.body) as J };
}
/** Kayıt gönderimi (not / gelişme / engel + dosyalar) */
async function rec(tid: string, sid: string, who: string, kind: string, text: string, files: { name: string; buf: Buffer }[] = [], k = key()) {
  const m = multipart([{ name: 'kind', value: kind }, { name: 'text', value: text }, ...files.map(f => ({ name: 'files', file: f }))]);
  const res = await app.inject({ method: 'POST', url: `/api/t/${tid}/rm2-steps/${sid}/records`, payload: m.payload, headers: { cookie: cookies[who]!, 'content-type': m.type, 'idempotency-key': k } });
  let body: J = {}; try { body = JSON.parse(res.body); } catch { body = { raw: res.body }; } return { status: res.statusCode, body };
}
const resolve = (tid: string, sid: string, bid: string, who: string, resolution: string, k = key()) => api('POST', `/api/t/${tid}/rm2-steps/${sid}/blockers/${bid}/resolve`, { resolution }, who, { 'Idempotency-Key': k });
const mark = (tid: string, s: J, who: string, done: boolean, k = key()) => api('POST', `/api/t/${tid}/rm2-steps/${s.id}`, { done, expectedVersion: s.version }, who, { 'Idempotency-Key': k });
async function template(tid: string, kind: string, who: string) { const r = await api('GET', `/api/t/${tid}/templates/${kind}.xlsx`, undefined, who); assert.equal(r.status, 200); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(r.raw as unknown as ArrayBuffer); return wb; }
function setRows(wb: ExcelJS.Workbook, sheet: string, rows: Record<string, unknown>[]) { const ws = wb.getWorksheet(sheet)!; const hdr = (ws.getRow(1).values as unknown[]).slice(1).map(String); for (let r = ws.rowCount; r >= 2; r--) ws.spliceRows(r, 1); for (const row of rows) ws.addRow(hdr.map(h => (row[h] === undefined ? null : row[h]))); }
async function commit(tid: string, jobId: string, who: string) { const r = await api('POST', `/api/t/${tid}/imports/${jobId}/commit`, {}, who); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; }

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('sentetik-png-icerigi')]);
const PDF = Buffer.from('%PDF-1.4\n% sentetik tutanak\n%%EOF\n');
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64, 1)]);
const ctx: J = {};

async function company(tag: string) {
  const code = `${tag}${S}`; const t = tag.toLocaleLowerCase('en-US'); const hr = `ik@${t}.${dom}`;
  const r = await api('POST', '/api/platform/tenants', { code, name: `${tag} şirketi`, adminEmail: hr, adminName: 'İK Kişisi' }, 'root'); assert.equal(r.status, 200, JSON.stringify(r.body)); const tid = r.body.id as string;
  assert.equal((await api('POST', `/api/t/${tid}/invitations/send`, {}, 'root')).status, 200);
  assert.equal((await api('POST', `/api/invitations/${mailToken(hr)}/accept`, { password: PW })).status, 200); await login(hr, `hr${tag}`, PW);
  const org = await template(tid, 'org', `hr${tag}`);
  setRows(org, 'Birim_Tipleri', [{ tenant_code: code, unit_type_code: 'ROOT', label: 'Grup' }, { tenant_code: code, unit_type_code: 'REGION', label: 'Bölge' }, { tenant_code: code, unit_type_code: 'SITE', label: 'İşletme' }]);
  setRows(org, 'Birimler', [{ tenant_code: code, operation: 'CREATE', unit_code: 'KOK', unit_name: 'Kök', unit_type_code: 'ROOT', timezone: 'Europe/Istanbul', valid_from: '2026-01-01' }, { tenant_code: code, operation: 'CREATE', unit_code: 'R1', unit_name: 'Bölge 1', unit_type_code: 'REGION', timezone: 'Europe/Istanbul', valid_from: '2026-01-01' }, ...['U1', 'U2', 'U3'].map(u => ({ tenant_code: code, operation: 'CREATE', unit_code: u, unit_name: `Birim ${u}`, unit_type_code: 'SITE', timezone: 'Europe/Istanbul', valid_from: '2026-01-01' }))]);
  setRows(org, 'Hiyerarsiler', [{ tenant_code: code, hierarchy_code: 'SURVEY', label: 'Anket', purpose: 'SURVEY_ROLLUP' }]);
  setRows(org, 'Iliskiler', [{ tenant_code: code, operation: 'CREATE', hierarchy_code: 'SURVEY', child_unit: 'R1', parent_unit: 'KOK', relation_type: 'REPORTS_TO', valid_from: '2026-01-01' }, ...[['U1', 'R1'], ['U2', 'R1'], ['U3', 'KOK']].map(([u, p]) => ({ tenant_code: code, operation: 'CREATE', hierarchy_code: 'SURVEY', child_unit: u, parent_unit: p, relation_type: 'REPORTS_TO', valid_from: '2026-01-01' }))]);
  setRows(org, 'Org_Rolleri', [{ tenant_code: code, operation: 'CREATE', role_code: 'UY', unit_code: 'KOK', title: 'Üst yönetim', permission_profile: 'EXEC', valid_from: '2026-01-01' }, { tenant_code: code, operation: 'CREATE', role_code: 'R1-M', unit_code: 'R1', title: 'Bölge müdürü', permission_profile: 'REGION_MANAGER', valid_from: '2026-01-01' },
    ...['U1', 'U2', 'U3'].map(u => ({ tenant_code: code, operation: 'CREATE', role_code: `${u}-M`, unit_code: u, title: 'Müdür', permission_profile: 'UNIT_MANAGER', valid_from: '2026-01-01' })), { tenant_code: code, operation: 'CREATE', role_code: 'U1-V', unit_code: 'U1', title: 'İzleyici', permission_profile: 'VIEWER', valid_from: '2026-01-01' }]);
  const o = await upload(tid, 'org', org, `hr${tag}`); assert.equal(o.body.canCommit, true, JSON.stringify(o.body.issues)); await commit(tid, o.body.jobId, `hr${tag}`);
  const users = [['m1', 'U1-M'], ['m2', 'U2-M'], ['m3', 'U3-M'], ['rg', 'R1-M'], ['ex', 'UY'], ['vw', 'U1-V']] as const;
  for (const [u, role] of users) { const r2 = await api('POST', `/api/t/${tid}/users`, { email: `${u}@${t}.${dom}`, displayName: `${u} kişisi`, roleCodes: [role], invite: true }, `hr${tag}`); assert.equal(r2.status, 200, JSON.stringify(r2.body)); }
  assert.equal((await api('POST', `/api/t/${tid}/invitations/send`, {}, `hr${tag}`)).status, 200);
  for (const [u] of users) { const email = `${u}@${t}.${dom}`; assert.equal((await api('POST', `/api/invitations/${mailToken(email)}/accept`, { password: PW })).status, 200); await login(email, `${u}${tag}`, PW); }
  return { tid, code };
}
function form(code: string, start = '2026-01-05') {
  const yon = (u: string, ph: number, adim: string) => ({ birim_kodu: u, plan_no: 1, rol: 'YONETIM', rol_adi: `Birim ${u} Yönetimi`, asama_gun: ph, sira: 1, adim, cikti: 'Çıktı.' });
  return {
    Rapor: [{ sirket_kodu: code, donem_kodu: '2026-ANA', rapor_adi: 'Kayıt Testi Raporu', baslangic_tarihi: start, etki_olcum_donemi: '2027 ölçümü' }],
    Birimler: [{ birim_kodu: 'KOK', katman: 'KURUM', birim_adi: 'Test Grup', yanit_sayisi: 100 }, ...['U1', 'U2', 'U3'].map(u => ({ birim_kodu: u, katman: 'ISLETME', birim_adi: `Birim ${u}`, yanit_sayisi: 29, karsilastirma_adi: 'Test geneli' }))],
    Planlar: [{ birim_kodu: 'KOK', plan_no: 1, baslik: 'Eğitim', madde_kodu: 'wp41', madde_metni: 'Eğitim.', mevcut_olumlu: 50, mevcut_yuzde: 50, karsilastirma_yuzde: 60, hedef_turu: 'HEDEF', hedef_olumlu: 56, hedef_yuzde: 56 },
      ...['U1', 'U2', 'U3'].map(u => ({ birim_kodu: u, plan_no: 1, baslik: `Eğitim ${u}`, madde_kodu: 'wp41', madde_metni: 'Eğitim.', mevcut_olumlu: 9, mevcut_yuzde: 31, karsilastirma_yuzde: 50, hedef_turu: 'HEDEF', hedef_olumlu: 11, hedef_yuzde: 37.9 }))],
    Adimlar: [{ birim_kodu: 'KOK', plan_no: 1, rol: 'IK', rol_adi: 'Test İK', asama_gun: 30, sira: 1, adim: 'Kurum İK adımı.', cikti: 'Form.' },
      yon('U1', 30, 'U1 listeleri iletmek.'), yon('U1', 90, 'U1 görüşme yapmak.'), yon('U2', 30, 'U2 soruları toplamak.'), yon('U3', 30, 'U3 duyuru yapmak.')],
    Izleme: [],
  } as Record<string, Record<string, unknown>[]>;
}
async function loadRoadmap(tid: string, code: string, start?: string) { const wb = await template(tid, 'roadmap2', `hr${ctx.tagOf[tid]}`); for (const [s, r] of Object.entries(form(code, start))) setRows(wb, s, r); const u = await upload(tid, 'roadmap2', wb, `hr${ctx.tagOf[tid]}`); assert.equal(u.body.canCommit, true, JSON.stringify(u.body.issues)); return commit(tid, u.body.jobId, `hr${ctx.tagOf[tid]}`); }
const myStep = async (who: string, text: string) => { const r = await api('GET', `/api/t/${ctx.A}/rm2/me`, undefined, who); assert.equal(r.status, 200, JSON.stringify(r.body)); const s = r.body.steps.find((x: J) => x.text === text); assert.ok(s, `adım yok: ${text}`); return { s, me: r.body }; };

before(async () => {
  mkdirSync(config.mailDir, { recursive: true }); process.env.HPW_MFA_REQUIRED = 'true'; app = await buildApp();
  await api('POST', '/api/platform/bootstrap', { email: 'platform@hpw.test', password: 'Platform12345', setupKey: config.setupKey }); await login('platform@hpw.test', 'root', 'Platform12345');
  const a = await company('KA'); const b = await company('KB'); ctx.A = a.tid; ctx.codeA = a.code; ctx.B = b.tid; ctx.codeB = b.code; ctx.tagOf = { [a.tid]: 'KA', [b.tid]: 'KB' };
  await loadRoadmap(ctx.A, ctx.codeA); await loadRoadmap(ctx.B, ctx.codeB);
});
after(async () => { delete process.env.HPW_MFA_REQUIRED; await app.close(); });

test('K-01 R-05/R-06 not ve gelişme adımı tamamlamadan kaydedilir; durum, sürüm ve termin değişmez; önceki kayıt korunur', async () => {
  const { s } = await myStep('m1KA', 'U1 listeleri iletmek.'); assert.equal(s.status, 'LATE'); assert.equal(s.canRecord, true);
  const n1 = await rec(ctx.A, s.id, 'm1KA', 'NOTE', 'Mutfak listesi cuma gelecek.'); assert.equal(n1.status, 200, JSON.stringify(n1.body)); assert.equal(n1.body.record.kind, 'NOTE');
  const n2 = await rec(ctx.A, s.id, 'm1KA', 'NOTE', 'İkinci not.'); assert.equal(n2.status, 200);
  const g = await rec(ctx.A, s.id, 'm1KA', 'PROGRESS', 'Beş departmanın üçünden liste geldi.'); assert.equal(g.status, 200); assert.equal(g.body.record.by, 'm1 kişisi');
  const { s: s2 } = await myStep('m1KA', 'U1 listeleri iletmek.');
  assert.equal(s2.status, 'LATE'); assert.equal(s2.version, s.version); assert.equal(s2.dueDate, s.dueDate);
  assert.deepEqual(s2.records.map((r: J) => r.kind), ['PROGRESS', 'NOTE', 'NOTE']); assert.equal(s2.records[2].text, 'Mutfak listesi cuma gelecek.');
  assert.equal(s2.lastProgress.text, 'Beş departmanın üçünden liste geldi.'); assert.match(s2.records[0].at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  // kullanıcı metni olduğu gibi saklanır (çevrilmez); boş ve geçersiz kayıt reddedilir
  assert.equal((await rec(ctx.A, s.id, 'm1KA', 'NOTE', '   ')).body.error, 'empty_record');
  assert.equal((await rec(ctx.A, s.id, 'm1KA', 'BLOCKER', '')).body.error, 'blocker_text_required');
  assert.equal((await rec(ctx.A, s.id, 'm1KA', 'DONE', 'x')).body.error, 'invalid_kind');
});

test('K-02 R-09 metin ve dosya aynı kayıtta; yalnız dosya kaydedilir; tür, uzantı, adet ve boyut sınırı sunucuda', async () => {
  const { s } = await myStep('m1KA', 'U1 listeleri iletmek.');
  const both = await rec(ctx.A, s.id, 'm1KA', 'PROGRESS', 'Duyuru panoya asıldı.', [{ name: 'duyuru-fotoğrafı.png', buf: PNG }, { name: 'tutanak.pdf', buf: PDF }]);
  assert.equal(both.status, 200, JSON.stringify(both.body)); assert.equal(both.body.record.kind, 'PROGRESS'); assert.equal(both.body.record.text, 'Duyuru panoya asıldı.');
  assert.deepEqual(both.body.record.files.map((f: J) => [f.name, f.mime, f.image]), [['duyuru-fotoğrafı.png', 'image/png', true], ['tutanak.pdf', 'application/pdf', false]]);
  const only = await rec(ctx.A, s.id, 'm1KA', 'NOTE', '', [{ name: 'katilim.pdf', buf: PDF }]); assert.equal(only.status, 200); assert.equal(only.body.record.kind, 'FILE'); assert.equal(only.body.record.text, null);
  ctx.png = both.body.record.files[0].id; ctx.pdf = both.body.record.files[1].id;
  assert.equal((await rec(ctx.A, s.id, 'm1KA', 'NOTE', 'x', [{ name: 'program.pdf', buf: EXE }])).status, 415);
  assert.equal((await rec(ctx.A, s.id, 'm1KA', 'NOTE', 'x', [{ name: 'resim.png', buf: PDF }])).status, 415, 'uzantı içerikle eşleşmeli');
  assert.equal((await rec(ctx.A, s.id, 'm1KA', 'NOTE', 'x', Array.from({ length: 6 }, (_, i) => ({ name: `d${i}.pdf`, buf: PDF })))).status, 413);
  const big = Buffer.concat([PDF, Buffer.alloc(config.recordFileMaxBytes + 10, 32)]); assert.equal((await rec(ctx.A, s.id, 'm1KA', 'NOTE', 'x', [{ name: 'buyuk.pdf', buf: big }])).status, 413);
  // reddedilen gönderimler kayıt da dosya da bırakmaz
  const { s: s2 } = await myStep('m1KA', 'U1 listeleri iletmek.'); assert.equal(s2.records.filter((r: J) => r.files.length).length, 2);
  const dir = join(config.fileDir, ctx.A); assert.equal(readdirSync(dir).length, 3, 'diskte yalnız kaydedilen üç dosya');
});

test('K-03 yeniden girişten sonra kayıtlar ve dosyalar durur; indirme ve fotoğraf önizleme; kapsam ve şirket yalıtımı', async () => {
  await login(`m1@ka.${dom}`, 'm1KA', PW);
  const { s } = await myStep('m1KA', 'U1 listeleri iletmek.'); assert.ok(s.records.length >= 5);
  const dl = await api('GET', `/api/t/${ctx.A}/rm2-files/${ctx.pdf}`, undefined, 'm1KA'); assert.equal(dl.status, 200); assert.ok(Buffer.from(dl.raw).equals(PDF));
  assert.match(String(dl.res.headers['content-disposition']), /^attachment; filename="tutanak.pdf"/); assert.equal(dl.res.headers['content-type'], 'application/octet-stream'); assert.equal(dl.res.headers['x-content-type-options'], 'nosniff');
  const im = await api('GET', `/api/t/${ctx.A}/rm2-files/${ctx.png}?inline=1`, undefined, 'm1KA'); assert.equal(im.res.headers['content-type'], 'image/png'); assert.match(String(im.res.headers['content-disposition']), /^inline;/);
  assert.match(String((await api('GET', `/api/t/${ctx.A}/rm2-files/${ctx.pdf}?inline=1`, undefined, 'm1KA')).res.headers['content-disposition']), /^attachment;/, 'PDF satır içi verilmez');
  // görme yetkisi olanlar indirir: İK, üst yönetim, bölge müdürü, işletme izleyicisi
  for (const who of ['hrKA', 'exKA', 'rgKA', 'vwKA']) assert.equal((await api('GET', `/api/t/${ctx.A}/rm2-files/${ctx.png}`, undefined, who)).status, 200, who);
  // kapsam dışı işletme müdürü ve bölge dışı müdür: 404
  for (const who of ['m2KA', 'm3KA']) assert.equal((await api('GET', `/api/t/${ctx.A}/rm2-files/${ctx.png}`, undefined, who)).status, 404, who);
  // başka şirket: kendi adresiyle de A'nın adresiyle de erişemez
  assert.equal((await api('GET', `/api/t/${ctx.B}/rm2-files/${ctx.png}`, undefined, 'hrKB')).status, 404);
  assert.ok([403, 404].includes((await api('GET', `/api/t/${ctx.A}/rm2-files/${ctx.png}`, undefined, 'hrKB')).status));
  // izleyici ve kapsam dışı kişi kayıt ekleyemez
  assert.equal((await rec(ctx.A, s.id, 'vwKA', 'NOTE', 'izleyici notu')).status, 403);
  assert.equal((await rec(ctx.A, s.id, 'm2KA', 'NOTE', 'başka işletme')).status, 404);
  // dosyalar şirket klasöründe, tahmin edilemez adla; dosya adı diskte yok
  const names = readdirSync(join(config.fileDir, ctx.A)); assert.ok(names.every(n => /^[0-9a-f-]{36}$/.test(n)));
  assert.equal(existsSync(join(config.fileDir, ctx.B)), false);
});

test('K-04 R-07 engel: durumdan ve terminden bağımsız; boş çözüm notu API’de reddedilir; yetkili kaldırır, yetkisiz kaldıramaz; geçmiş korunur', async () => {
  const { s } = await myStep('m1KA', 'U1 görüşme yapmak.');
  const b1 = await rec(ctx.A, s.id, 'm1KA', 'BLOCKER', 'İK’dan ücret tablosunu bekliyoruz.'); assert.equal(b1.status, 200); const bid = b1.body.record.id;
  let { s: cur } = await myStep('m1KA', 'U1 görüşme yapmak.'); assert.equal(cur.blockers.length, 1); assert.equal(cur.dueDate, s.dueDate); assert.equal(cur.status, s.status); assert.equal(cur.canUnblock, true);
  // tamamlamak engeli kaldırmaz
  assert.equal((await mark(ctx.A, cur, 'm1KA', true)).status, 200); ({ s: cur } = await myStep('m1KA', 'U1 görüşme yapmak.')); assert.equal(cur.status, 'DONE'); assert.equal(cur.blockers.length, 1);
  // çözüm notu zorunlu (boş ve yalnız boşluk)
  for (const r of ['', '   ', '\n\t ']) { const x = await resolve(ctx.A, s.id, bid, 'm1KA', r); assert.equal(x.status, 422, r); assert.equal(x.body.error, 'resolution_required'); }
  // yetkisiz: başka işletmenin müdürü (kapsam dışı 404), bölge dışı müdür, izleyici, HPW personeli
  assert.equal((await resolve(ctx.A, s.id, bid, 'm2KA', 'çözüm')).status, 404);
  assert.equal((await resolve(ctx.A, s.id, bid, 'm3KA', 'çözüm')).status, 404);
  assert.equal((await resolve(ctx.A, s.id, bid, 'vwKA', 'çözüm')).status, 403);
  assert.equal((await resolve(ctx.A, s.id, bid, 'root', 'çözüm')).status, 403);
  // İK listesinde görünür (İK'nın kendi adımlarından ayrı)
  const hl = await api('GET', `/api/t/${ctx.A}/rm2/blockers`, undefined, 'hrKA'); assert.equal(hl.body.enabled, true); assert.deepEqual(hl.body.items.map((i: J) => [i.id, i.unitLabel, i.planNo, i.stepId]), [[bid, 'Birim U1', 1, s.id]]);
  assert.equal((await api('GET', `/api/t/${ctx.A}/rm2/blockers`, undefined, 'm1KA')).body.enabled, false);
  // bölge müdürü kaldırır; ikinci kez kaldırılamaz; adım tamamlanmış kalır (kaldırmak durumu değiştirmez)
  const ok = await resolve(ctx.A, s.id, bid, 'rgKA', 'Güncel ücret tablosu e-postayla gönderildi.'); assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.equal(ok.body.record.by, 'rg kişisi');
  assert.equal((await resolve(ctx.A, s.id, bid, 'hrKA', 'tekrar')).status, 409);
  ({ s: cur } = await myStep('m1KA', 'U1 görüşme yapmak.')); assert.equal(cur.blockers.length, 0); assert.equal(cur.status, 'DONE');
  // geri alınca engel durumu değişmez; yeni engeller: üst yönetim, İK ve işletme müdürü kaldırır; yeni engel eski geçmişi silmez
  assert.equal((await mark(ctx.A, cur, 'm1KA', false)).status, 200);
  for (const who of ['exKA', 'hrKA', 'm1KA']) { const b = await rec(ctx.A, s.id, 'm1KA', 'BLOCKER', `engel → ${who}`); assert.equal((await resolve(ctx.A, s.id, b.body.record.id, who, `çözüm ← ${who}`)).status, 200, who); }
  ({ s: cur } = await myStep('m1KA', 'U1 görüşme yapmak.'));
  const kinds = cur.records.map((r: J) => r.kind).reverse(); assert.deepEqual(kinds, ['BLOCKER', 'DONE', 'UNBLOCK', 'UNDO', 'BLOCKER', 'UNBLOCK', 'BLOCKER', 'UNBLOCK', 'BLOCKER', 'UNBLOCK']);
  const first = cur.records.find((r: J) => r.id === bid); assert.equal(first.text, 'İK’dan ücret tablosunu bekliyoruz.'); assert.equal(first.by, 'm1 kişisi');
  const sol = cur.records.find((r: J) => r.kind === 'UNBLOCK' && r.blockerId === bid); assert.equal(sol.text, 'Güncel ücret tablosu e-postayla gönderildi.'); assert.equal(sol.by, 'rg kişisi');
  // bölge dışı işletmede bölge müdürü kaldıramaz
  const { s: s3 } = await myStep('m3KA', 'U3 duyuru yapmak.'); const b3 = await rec(ctx.A, s3.id, 'm3KA', 'BLOCKER', 'U3 engeli');
  assert.equal(b3.status, 200); assert.equal((await resolve(ctx.A, s3.id, b3.body.record.id, 'rgKA', 'x')).status, 404);
});

test('K-05 R-08 geri alma: durum, sayaç ve gecikme güncellenir; tekrar gönderim ve eşzamanlı istek mükerrer kayıt üretmez', async () => {
  const { s, me } = await myStep('m2KA', 'U2 soruları toplamak.'); const done0 = me.counts.done;
  const k = key(); const a = await mark(ctx.A, s, 'm2KA', true, k); assert.equal(a.status, 200); const replay = await mark(ctx.A, s, 'm2KA', true, k); assert.equal(replay.status, 200); assert.deepEqual(replay.body, a.body);
  let st = await myStep('m2KA', 'U2 soruları toplamak.'); assert.equal(st.s.status, 'DONE'); assert.equal(st.me.counts.done, done0 + 1); assert.equal(st.s.records.filter((r: J) => r.kind === 'DONE').length, 1);
  const [x, y] = await Promise.all([mark(ctx.A, st.s, 'm2KA', false), mark(ctx.A, st.s, 'm2KA', false)]); assert.deepEqual([x.status, y.status].sort(), [200, 409]);
  st = await myStep('m2KA', 'U2 soruları toplamak.'); assert.equal(st.s.status, 'LATE', 'termini geçmiş adım geri alınınca Gecikti'); assert.equal(st.me.counts.done, done0); assert.equal(st.me.counts.late, me.counts.late);
  assert.deepEqual(st.s.records.map((r: J) => [r.kind, r.by]), [['UNDO', 'm2 kişisi'], ['DONE', 'm2 kişisi']]);
  // aynı kayıt komutunun tekrarı ikinci kayıt oluşturmaz
  const rk = key(); const r1 = await rec(ctx.A, s.id, 'm2KA', 'NOTE', 'tek not', [], rk); const r2 = await rec(ctx.A, s.id, 'm2KA', 'NOTE', 'tek not', [], rk); assert.equal(r1.status, 200); assert.deepEqual(r2.body, r1.body);
  st = await myStep('m2KA', 'U2 soruları toplamak.'); assert.equal(st.s.records.filter((r: J) => r.kind === 'NOTE').length, 1);
});

test('K-06 yeniden yükleme: kayıtlar, dosyalar ve açık engel yeni adım satırında görünür; engel kaldırılabilir', async () => {
  const before0 = await myStep('m1KA', 'U1 listeleri iletmek.'); const b = await rec(ctx.A, before0.s.id, 'm1KA', 'BLOCKER', 'yükleme öncesi engel'); assert.equal(b.status, 200);
  await loadRoadmap(ctx.A, ctx.codeA, '2026-01-12');
  const after0 = await myStep('m1KA', 'U1 listeleri iletmek.'); assert.notEqual(after0.s.id, before0.s.id);
  assert.equal(after0.s.records.length, before0.s.records.length + 1); assert.equal(after0.s.blockers.length, 1); assert.equal(after0.s.lastProgress.text, before0.s.lastProgress.text);
  const hl = await api('GET', `/api/t/${ctx.A}/rm2/blockers`, undefined, 'hrKA'); const it = hl.body.items.find((i: J) => i.id === b.body.record.id); assert.equal(it.stepId, after0.s.id);
  assert.equal((await resolve(ctx.A, after0.s.id, b.body.record.id, 'hrKA', 'çözüldü')).status, 200);
  assert.equal((await api('GET', `/api/t/${ctx.A}/rm2-files/${ctx.pdf}`, undefined, 'm1KA')).status, 200);
});

test('K-07 plan ekranı: kayıtlar ve yetki bayrakları; atıf ve çalışan satırında kayıt yok; İK yedek yetkisi korunur', async () => {
  const list = await api('GET', `/api/t/${ctx.A}/rm2`, undefined, 'hrKA'); const u1 = list.body.roadmaps.find((r: J) => r.unitCode === 'U1');
  const d = (await api('GET', `/api/t/${ctx.A}/rm2/${u1.id}`, undefined, 'hrKA')).body; const st = d.plans[0].steps.find((s: J) => s.text === 'U1 listeleri iletmek.');
  assert.equal(st.canMark, true, 'HR_ADMIN plan ekranında yönetim adımını işaretleyebilir (yedek yetki)'); assert.equal(st.canRecord, true); assert.equal(st.canUnblock, true); assert.ok(st.records.length > 0);
  const vw = (await api('GET', `/api/t/${ctx.A}/rm2/${u1.id}`, undefined, 'vwKA')).body.plans[0].steps.find((s: J) => s.text === 'U1 listeleri iletmek.');
  assert.equal(vw.canMark, false); assert.equal(vw.canRecord, false); assert.equal(vw.canUnblock, false); assert.ok(vw.records.length > 0, 'izleyici kayıtları görür');
  const rg = (await api('GET', `/api/t/${ctx.A}/rm2/${u1.id}`, undefined, 'rgKA')).body.plans[0].steps.find((s: J) => s.text === 'U1 listeleri iletmek.');
  assert.equal(rg.canMark, true, 'bölge müdürünün mevcut işaretleme yetkisi daralmadı'); assert.equal(rg.canRecord, true); assert.equal(rg.canUnblock, true);
});
