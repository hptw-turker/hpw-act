/** v3.0.0 (ADR-0043) — Sade yol haritası: gerçek PostgreSQL + Fastify HTTP. Veriler sentetiktir. */
import { ensureMfa } from './mfa-helper.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { buildApp } from '../src/server.js';
import { config } from '../src/config.js';
import { FORM2 } from '../src/importers/roadmap2.js';

let app: Awaited<ReturnType<typeof buildApp>>;
const cookies: Record<string, string> = {};
const cookieOf = (res: { headers: Record<string, unknown> }) => { const sc = res.headers['set-cookie']; const raw = Array.isArray(sc) ? sc[0] : String(sc ?? ''); return raw.split(';')[0]!; };
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function api(method: 'GET' | 'POST', url: string, body?: unknown, who?: string, headers: Record<string, string> = {}) { const res = await app.inject({ method, url, payload: body as Record<string, unknown> | undefined, headers: { ...(who ? { cookie: cookies[who]! } : {}), ...headers } }); let json: unknown = null; try { json = JSON.parse(res.body); } catch { json = res.body; } return { status: res.statusCode, body: json as J, raw: res.rawPayload, res }; }
function mailToken(email: string): string { const files = readdirSync(config.mailDir).filter(f => f.endsWith('.eml')).map(f => readFileSync(`${config.mailDir}/${f}`, 'utf8')).filter(t => t.includes(`To: ${email}`) && t.includes('#/davet/')).map(t => ({ t, d: /Date: (\S+)/.exec(t)?.[1] ?? '' })).sort((a, b) => (a.d < b.d ? 1 : -1)); assert.ok(files.length, `davet yok: ${email}`); return /#\/davet\/([A-Za-z0-9_-]+)/.exec(files[0]!.t)![1]!; }
async function login(email: string, who: string, password: string) { const r = await api('POST', '/api/auth/login', { email, password }); assert.equal(r.status, 200, JSON.stringify(r.body)); cookies[who] = cookieOf(r.res); if (r.body.realm === 'platform') await ensureMfa((m, u, b) => api(m as 'GET', u, b, who) as never, email); }
const PW = 'Parola12345'; const S = 'Y' + Date.now().toString(36).toLocaleUpperCase('en-US').slice(-4); const dom = `y${S.toLocaleLowerCase('en-US')}.test`;
async function upload(tid: string, kind: string, wb: ExcelJS.Workbook, who: string, cycleId?: string) {
  const buf = Buffer.from(await wb.xlsx.writeBuffer()); const b = '----hpw' + Date.now();
  const payload = Buffer.concat([Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${kind}.xlsx"\r\nContent-Type: application/octet-stream\r\n\r\n`), buf, Buffer.from(`\r\n--${b}--\r\n`)]);
  const res = await app.inject({ method: 'POST', url: `/api/t/${tid}/imports/${kind}${cycleId ? `?cycleId=${cycleId}` : ''}`, payload, headers: { cookie: cookies[who]!, 'content-type': `multipart/form-data; boundary=${b}` } });
  return { status: res.statusCode, body: JSON.parse(res.body) as J };
}
async function template(tid: string, kind: string, who: string, cycleId?: string) { const r = await api('GET', `/api/t/${tid}/templates/${kind}.xlsx${cycleId ? `?cycleId=${cycleId}` : ''}`, undefined, who); assert.equal(r.status, 200); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(r.raw as unknown as ArrayBuffer); return wb; }
function setRows(wb: ExcelJS.Workbook, sheet: string, rows: Record<string, unknown>[]) { const ws = wb.getWorksheet(sheet)!; const hdr = (ws.getRow(1).values as unknown[]).slice(1).map(String); for (let r = ws.rowCount; r >= 2; r--) ws.spliceRows(r, 1); for (const row of rows) ws.addRow(hdr.map(h => (row[h] === undefined ? null : row[h]))); }
async function commit(tid: string, jobId: string, who: string) { const r = await api('POST', `/api/t/${tid}/imports/${jobId}/commit`, {}, who); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; }


const ctx: { A?: string; B?: string; codeA?: string; codeB?: string } = {};
async function company(tag: string) {
  const code = `${tag}${S}`; const hr = `ik@${tag.toLocaleLowerCase('en-US')}.${dom}`;
  const r = await api('POST', '/api/platform/tenants', { code, name: `${tag} şirketi`, adminEmail: hr, adminName: 'İK' }, 'root'); assert.equal(r.status, 200, JSON.stringify(r.body)); const tid = r.body.id as string;
  assert.equal((await api('POST', `/api/t/${tid}/invitations/send`, {}, 'root')).status, 200);
  assert.equal((await api('POST', `/api/invitations/${mailToken(hr)}/accept`, { password: PW })).status, 200); await login(hr, `hr${tag}`, PW);
  const org = await template(tid, 'org', `hr${tag}`);
  setRows(org, 'Birim_Tipleri', [{ tenant_code: code, unit_type_code: 'ROOT', label: 'Grup' }, { tenant_code: code, unit_type_code: 'SITE', label: 'İşletme' }]);
  setRows(org, 'Birimler', [{ tenant_code: code, operation: 'CREATE', unit_code: 'KOK', unit_name: 'Kök', unit_type_code: 'ROOT', timezone: 'Europe/Istanbul', valid_from: '2026-01-01' }, ...['U1', 'U2', 'U3'].map(u => ({ tenant_code: code, operation: 'CREATE', unit_code: u, unit_name: `Birim ${u}`, unit_type_code: 'SITE', timezone: 'Europe/Istanbul', valid_from: '2026-01-01' }))]);
  setRows(org, 'Hiyerarsiler', [{ tenant_code: code, hierarchy_code: 'SURVEY', label: 'Anket', purpose: 'SURVEY_ROLLUP' }]);
  setRows(org, 'Iliskiler', ['U1', 'U2', 'U3'].map(u => ({ tenant_code: code, operation: 'CREATE', hierarchy_code: 'SURVEY', child_unit: u, parent_unit: 'KOK', relation_type: 'REPORTS_TO', valid_from: '2026-01-01' })));
  setRows(org, 'Org_Rolleri', [{ tenant_code: code, operation: 'CREATE', role_code: 'UY', unit_code: 'KOK', title: 'Üst yönetim', permission_profile: 'EXEC', valid_from: '2026-01-01' }, ...['U1', 'U2', 'U3'].map(u => ({ tenant_code: code, operation: 'CREATE', role_code: `${u}-M`, unit_code: u, title: 'Müdür', permission_profile: 'UNIT_MANAGER', valid_from: '2026-01-01' }))]);
  const o = await upload(tid, 'org', org, `hr${tag}`); assert.equal(o.body.canCommit, true, JSON.stringify(o.body.issues)); await commit(tid, o.body.jobId, `hr${tag}`);
  for (const [u, role] of [['m1', 'U1-M'], ['m2', 'U2-M'], ['ex', 'UY']] as const) { const email = `${u}@${tag.toLocaleLowerCase('en-US')}.${dom}`; const r2 = await api('POST', `/api/t/${tid}/users`, { email, displayName: u, roleCodes: [role], invite: true }, `hr${tag}`); assert.equal(r2.status, 200, JSON.stringify(r2.body)); }
  assert.equal((await api('POST', `/api/t/${tid}/invitations/send`, {}, `hr${tag}`)).status, 200);
  for (const u of ['m1', 'm2', 'ex']) { const email = `${u}@${tag.toLocaleLowerCase('en-US')}.${dom}`; assert.equal((await api('POST', `/api/invitations/${mailToken(email)}/accept`, { password: PW })).status, 200); await login(email, `${u}${tag}`, PW); }
  return { tid, code };
}
/** Sentetik yol haritası: kurum (KOK) + U1 (hedefli) + U2 (izlenir) ; U3 dosyada yok */
function form(code: string, over: Partial<Record<string, Record<string, unknown>[]>> = {}, start = '2026-11-16') {
  const R: Record<string, Record<string, unknown>[]> = {
    Rapor: [{ sirket_kodu: code, donem_kodu: '2026-ANA', rapor_adi: 'Test 2026 Raporu', baslangic_tarihi: start, etki_olcum_donemi: '2027 ölçümü' }],
    Birimler: [{ birim_kodu: 'KOK', katman: 'KURUM', birim_adi: 'Test Grup', yanit_sayisi: 100, karsilastirma_adi: 'Sektör', ana_sonuc_baslik: 'Katkı isteği güçlü.', ana_sonuc_metin: 'Açıklama.' },
      { birim_kodu: 'U1', katman: 'ISLETME', birim_adi: 'Birim U1', yanit_sayisi: 29, karsilastirma_adi: 'Test geneli', ana_sonuc_baslik: 'U1 sonucu.' },
      { birim_kodu: 'U2', katman: 'ISLETME', birim_adi: 'Birim U2', yanit_sayisi: 4 }],
    Planlar: [{ birim_kodu: 'KOK', plan_no: 1, baslik: 'Eğitim', madde_kodu: 'wp41', madde_metni: 'Eğitim teşvik edilir.', mevcut_olumlu: 50, mevcut_yuzde: 50, karsilastirma_yuzde: 90, hedef_turu: 'HEDEF', hedef_olumlu: 52, hedef_yuzde: 52, sorumluluk: 'İK ve Yönetim', etki_metni: 'wp41 ile izlenir.' },
      { birim_kodu: 'U1', plan_no: 1, baslik: 'Eğitim U1', madde_kodu: 'wp41', madde_metni: 'Eğitim teşvik edilir.', mevcut_olumlu: 9, mevcut_yuzde: 31, karsilastirma_yuzde: 50, hedef_turu: 'HEDEF', hedef_olumlu: 11, hedef_yuzde: 37.9, sorumluluk: 'İşletme yönetimi' },
      { birim_kodu: 'U2', plan_no: 1, baslik: 'Ücret U2', madde_kodu: 'wp07', madde_metni: 'Ücret.', mevcut_yuzde: 25, hedef_turu: 'IZLENIR' }],
    Adimlar: [
      { birim_kodu: 'KOK', plan_no: 1, rol: 'IK', rol_adi: 'Test İK', asama_gun: 30, sira: 1, adim: 'Eğitim ihtiyaç analizini bütün işletmelerde başlatmak.', cikti: 'Form ulaştı.' },
      { birim_kodu: 'KOK', plan_no: 1, rol: 'IK', rol_adi: 'Test İK', asama_gun: 90, sira: 1, adim: 'Yıllık eğitim programını hazırlamak.', cikti: 'Program duyuruldu.' },
      { birim_kodu: 'KOK', plan_no: 1, rol: 'YONETIM', rol_adi: 'Test Yönetimi', asama_gun: 30, sira: 1, adim: 'Analiz kapsamını onaylamak.', cikti: 'Onaylandı.' },
      { birim_kodu: 'KOK', plan_no: 1, rol: 'CALISAN', rol_adi: 'Çalışanlar', asama_gun: 30, sira: 1, adim: 'İhtiyacını bildirmek.', cikti: 'Form dolduruldu.', plana_katkisi: 'Program ihtiyaca göre olur.' },
      { birim_kodu: 'U1', plan_no: 1, rol: 'IK', rol_adi: 'Test İK', asama_gun: 30, sira: 1, adim: 'Kurum planı 1 · İK · İlk 30 gün · Eğitim ihtiyaç analizi', cikti: 'Kurum adımının durumu izlenir.', kurum_atfi: 'Kurum planı 1 · İK · İlk 30 gün · Eğitim ihtiyaç analizi' },
      { birim_kodu: 'U1', plan_no: 1, rol: 'IK', rol_adi: 'Test İK', asama_gun: 90, sira: 1, adim: 'U1 ihtiyaç listelerini toplamak.', cikti: 'Liste toplandı.' },
      { birim_kodu: 'U1', plan_no: 1, rol: 'YONETIM', rol_adi: 'Birim U1 Yönetimi', asama_gun: 30, sira: 1, adim: 'Departman listelerini İK’ya iletmek.', cikti: 'İletildi.' },
      { birim_kodu: 'U1', plan_no: 1, rol: 'YONETIM', rol_adi: 'Birim U1 Yönetimi', asama_gun: 90, sira: 1, adim: 'Gelişim görüşmesi yapmak.', cikti: 'Görüşmeler kayda geçti.' },
      { birim_kodu: 'U2', plan_no: 1, rol: 'YONETIM', rol_adi: 'Birim U2 Yönetimi', asama_gun: 30, sira: 1, adim: 'Soruları toplamak.', cikti: 'Liste.' }],
    Izleme: [{ birim_kodu: 'KOK', sira: 1, madde_kodu: 'wp41', madde_metni: 'Eğitim teşvik edilir.', baglanti: 'Eylem planı 1', mevcut_yuzde: 50, karsilastirma_yuzde: 88, sektor_yuzde: 90, hedef: '%52,0' }],
  };
  return { ...R, ...over };
}
async function rmWb(tid: string, rows: Record<string, Record<string, unknown>[] | undefined>, who: string) { const wb = await template(tid, 'roadmap2', who); for (const [s, r] of Object.entries(rows)) if (r) setRows(wb, s, r); return wb; }
const issues = (b: J) => (b.issues as J[]).map(i => `${i.sheet}:${i.code}`);

before(async () => { mkdirSync(config.mailDir, { recursive: true }); process.env.HPW_LEGACY_MODULES = 'true'; process.env.HPW_MFA_REQUIRED = 'true'; app = await buildApp(); await api('POST', '/api/platform/bootstrap', { email: 'platform@hpw.test', password: 'Platform12345', setupKey: config.setupKey }); await login('platform@hpw.test', 'root', 'Platform12345');
  const a = await company('V3A'); ctx.A = a.tid; ctx.codeA = a.code; const b = await company('V3B'); ctx.B = b.tid; ctx.codeB = b.code; });
after(async () => { delete process.env.HPW_LEGACY_MODULES; delete process.env.HPW_MFA_REQUIRED; await app.close(); });

test('V3-01 şablon: beş sayfa, sözlük; dönem seçmeden indirilir; birimler ön dolu', async () => {
  const wb = await template(ctx.A!, 'roadmap2', 'hrV3A');
  for (const s of FORM2) assert.ok(wb.getWorksheet(s.name), `sayfa yok: ${s.name}`);
  const units = (wb.getWorksheet('Birimler')!.getColumn(1).values as unknown[]).slice(2).map(String); assert.deepEqual(units.sort(), ['KOK', 'U1', 'U2', 'U3']);
});

test('V3-02 doğrulama: kesir–yüzde, gizlilik eşiği, atıf, bilinmeyen birim/plan, şirket kodu', async () => {
  const bad = form(ctx.codeA!, {
    Rapor: [{ sirket_kodu: 'BASKA', donem_kodu: '2026-ANA', rapor_adi: 'X', baslangic_tarihi: '2026-11-16' }],
    Planlar: [...form(ctx.codeA!).Planlar!.slice(0, 2).map((p, i) => i === 1 ? { ...p, hedef_yuzde: 40 } : p), { birim_kodu: 'U2', plan_no: 1, baslik: 'U2', madde_kodu: 'wp07', madde_metni: 'Ücret.', mevcut_olumlu: 1, mevcut_yuzde: 25, hedef_turu: 'HEDEF', hedef_olumlu: 2, hedef_yuzde: 50 }],
    Adimlar: [...form(ctx.codeA!).Adimlar!.map(s => s.kurum_atfi ? { ...s, kurum_atfi: 'Kurum planı 1 · İK · İlk 30 gün · Olmayan adım' } : s), { birim_kodu: 'U9', plan_no: 1, rol: 'IK', rol_adi: 'x', asama_gun: 30, sira: 1, adim: 'x' }, { birim_kodu: 'U1', plan_no: 7, rol: 'IK', rol_adi: 'x', asama_gun: 45, sira: 1, adim: 'x' }],
  });
  const u = await upload(ctx.A!, 'roadmap2', await rmWb(ctx.A!, bad, 'hrV3A'), 'hrV3A'); assert.equal(u.status, 200, JSON.stringify(u.body)); assert.equal(u.body.canCommit, false);
  const got = issues(u.body);
  for (const k of ['Rapor:tenant_code_mismatch', 'Planlar:pct_mismatch', 'Planlar:below_threshold', 'Adimlar:atif_unresolved', 'Adimlar:unit_unknown', 'Adimlar:plan_unknown', 'Adimlar:invalid_phase']) assert.ok(got.includes(k), `${k} yok: ${got.join(', ')}`);
});

test('V3-03 onay: dönem yoksa oluşur; terminler başlangıç + 30/90/180; atıf kurum adımına bağlanır; kurum toplam uyarısı', async () => {
  const u = await upload(ctx.A!, 'roadmap2', await rmWb(ctx.A!, form(ctx.codeA!), 'hrV3A'), 'hrV3A'); assert.equal(u.body.canCommit, true, JSON.stringify(u.body.issues));
  assert.ok(issues(u.body).includes('Planlar:kurum_sum_mismatch') === false, 'KOK +2 = U1 +2 olmalı');
  const c = await commit(ctx.A!, u.body.jobId, 'hrV3A'); assert.equal(c.roadmaps, 3);
  const list = await api('GET', `/api/t/${ctx.A}/rm2`, undefined, 'exV3A'); assert.equal(list.status, 200);
  assert.deepEqual(list.body.roadmaps.map((r: J) => r.layer + ':' + r.unitCode), ['KURUM:KOK', 'ISLETME:U1', 'ISLETME:U2']);
  const u1 = list.body.roadmaps.find((r: J) => r.unitCode === 'U1');
  const d = await api('GET', `/api/t/${ctx.A}/rm2/${u1.id}`, undefined, 'm1V3A'); assert.equal(d.status, 200, JSON.stringify(d.body));
  const p = d.body.plans[0]; assert.equal(p.targetPos, 11); assert.equal(p.targetPct, 37.9); assert.equal(p.currentPos, 9); assert.equal(p.respondents, 29);
  const ref = p.steps.find((s: J) => s.ref); assert.equal(ref.dueDate, '2026-12-16'); assert.equal(ref.canMark, false); assert.equal(ref.ref.text, 'Eğitim ihtiyaç analizini bütün işletmelerde başlatmak.');
  const g90 = p.steps.find((s: J) => s.role === 'YONETIM' && s.phaseDays === 90); assert.equal(g90.dueDate, '2027-02-14'); assert.equal(g90.canMark, true);
});

test('V3-04 Bugün ve yetki: müdür kendi yönetim adımlarını, İK İK adımlarını, üst yönetim kurum yönetim adımlarını görür ve işaretler; çalışan ve atıf işaretlenmez', async () => {
  const me = async (who: string) => (await api('GET', `/api/t/${ctx.A}/rm2/me`, undefined, who)).body;
  const m1 = await me('m1V3A'); assert.deepEqual(m1.steps.map((s: J) => `${s.unitCode}:${s.role}:${s.phaseDays}`), ['U1:YONETIM:30', 'U1:YONETIM:90']);
  const hr = await me('hrV3A'); assert.deepEqual(hr.steps.map((s: J) => `${s.unitCode}:${s.role}:${s.phaseDays}`).sort(), ['KOK:IK:30', 'KOK:IK:90', 'U1:IK:90'].sort());
  const ex = await me('exV3A'); assert.deepEqual(ex.steps.map((s: J) => `${s.unitCode}:${s.role}`), ['KOK:YONETIM']);
  const m2 = await me('m2V3A'); assert.deepEqual(m2.steps.map((s: J) => s.unitCode), ['U2']);
  // müdür U1 kurum yol haritasını göremez
  const list1 = (await api('GET', `/api/t/${ctx.A}/rm2`, undefined, 'm1V3A')).body; assert.deepEqual(list1.roadmaps.map((r: J) => r.unitCode), ['U1']);
  // işaretleme ve atıfa yansıma
  const kokIk = hr.steps.find((s: J) => s.unitCode === 'KOK' && s.phaseDays === 30);
  const mk = await api('POST', `/api/t/${ctx.A}/rm2-steps/${kokIk.id}`, { done: true, note: 'Form gönderildi', expectedVersion: kokIk.version }, 'hrV3A', { 'Idempotency-Key': `k-${Date.now()}` }); assert.equal(mk.status, 200, JSON.stringify(mk.body)); assert.equal(mk.body.status, 'DONE');
  const u1 = (await api('GET', `/api/t/${ctx.A}/rm2`, undefined, 'm1V3A')).body.roadmaps[0];
  const d = (await api('GET', `/api/t/${ctx.A}/rm2/${u1.id}`, undefined, 'm1V3A')).body; const ref = d.plans[0].steps.find((s: J) => s.ref); assert.equal(ref.status, 'DONE');
  const kok = (await api('GET', `/api/t/${ctx.A}/rm2`, undefined, 'hrV3A')).body.roadmaps.find((r: J) => r.layer === 'KURUM'); const kd = (await api('GET', `/api/t/${ctx.A}/rm2/${kok.id}`, undefined, 'hrV3A')).body;
  assert.equal(kd.plans[0].impact, 'wp41 ile izlenir.'); assert.equal(kd.items.length, 1); assert.equal(kd.plans[0].steps.find((s: J) => s.status === 'DONE').updatedBy, 'İK'); { const dn = kd.plans[0].steps.find((s: J) => s.status === 'DONE'); /* v3.1.0 (R-05): not adım satırına değil kayıt geçmişine eklenir */ assert.ok(dn.records.some((r: J) => r.kind === 'NOTE' && r.text === 'Form gönderildi' && r.by === 'İK'), JSON.stringify(dn.records)); assert.ok(dn.records.some((r: J) => r.kind === 'DONE')); }
  // yasaklar
  assert.equal((await api('POST', `/api/t/${ctx.A}/rm2-steps/${ref.id}`, { done: true, expectedVersion: ref.version }, 'hrV3A', { 'Idempotency-Key': `r-${Date.now()}` })).status, 422);
  const emp = (await api('GET', `/api/t/${ctx.A}/rm2/${list1.roadmaps[0].id}`, undefined, 'hrV3A')).body.plans[0].steps.find((s: J) => s.role === 'IK' && !s.ref);
  assert.equal((await api('POST', `/api/t/${ctx.A}/rm2-steps/${emp.id}`, { done: true, expectedVersion: emp.version }, 'm1V3A', { 'Idempotency-Key': `e-${Date.now()}` })).status, 403);
  const kokYon = ex.steps[0]; assert.equal((await api('POST', `/api/t/${ctx.A}/rm2-steps/${kokYon.id}`, { done: true, expectedVersion: kokYon.version }, 'm1V3A', { 'Idempotency-Key': `y-${Date.now()}` })).status, 404);
  assert.equal((await api('POST', `/api/t/${ctx.A}/rm2-steps/${kokYon.id}`, { done: true, expectedVersion: kokYon.version }, 'exV3A', { 'Idempotency-Key': `z-${Date.now()}` })).status, 200);
  assert.equal((await api('POST', `/api/t/${ctx.A}/rm2-steps/${kokYon.id}`, { done: false, expectedVersion: kokYon.version }, 'exV3A', { 'Idempotency-Key': `w-${Date.now()}` })).status, 409);
});

test('V3-05 yeniden yükleme: eski sürüm saklanır, aynı adımın durumu taşınır, atıf yeni kurum adımına bağlanır', async () => {
  const u = await upload(ctx.A!, 'roadmap2', await rmWb(ctx.A!, form(ctx.codeA!, {}, '2026-11-23'), 'hrV3A'), 'hrV3A'); assert.equal(u.body.canCommit, true);
  const c = await commit(ctx.A!, u.body.jobId, 'hrV3A'); assert.ok(Number(c.carriedStatuses) >= 2);
  const hr = (await api('GET', `/api/t/${ctx.A}/rm2/me`, undefined, 'hrV3A')).body; const k = hr.steps.find((s: J) => s.unitCode === 'KOK' && s.phaseDays === 30); assert.equal(k.status, 'DONE'); assert.equal(k.dueDate, '2026-12-23');
  const u1 = (await api('GET', `/api/t/${ctx.A}/rm2`, undefined, 'm1V3A')).body.roadmaps[0]; const d = (await api('GET', `/api/t/${ctx.A}/rm2/${u1.id}`, undefined, 'm1V3A')).body; assert.equal(d.plans[0].steps.find((s: J) => s.ref).status, 'DONE');
});

test('V3-06 yalıtım ve kapalı modüller: B şirketi A yol haritasını göremez; anahtar kapalıyken eski uçlar 404, iki adımlı doğrulama istenmez', async () => {
  const a = (await api('GET', `/api/t/${ctx.A}/rm2`, undefined, 'hrV3A')).body.roadmaps[0];
  assert.equal((await api('GET', `/api/t/${ctx.A}/rm2/${a.id}`, undefined, 'hrV3B')).status, 403);
  assert.equal((await api('GET', `/api/t/${ctx.B}/rm2/${a.id}`, undefined, 'hrV3B')).status, 404);
  assert.equal((await api('GET', `/api/t/${ctx.A}/actions`, undefined, 'hrV3A')).status, 200);
  process.env.HPW_LEGACY_MODULES = 'false';
  try {
    assert.equal((await api('GET', `/api/t/${ctx.A}/actions`, undefined, 'hrV3A')).status, 404);
    assert.equal((await api('GET', `/api/t/${ctx.A}/roadmaps`, undefined, 'hrV3A')).status, 404);
    assert.equal((await api('GET', `/api/t/${ctx.A}/templates/results.xlsx`, undefined, 'hrV3A')).status, 404);
    assert.equal((await api('GET', `/api/t/${ctx.A}/rm2`, undefined, 'hrV3A')).status, 200);
  } finally { process.env.HPW_LEGACY_MODULES = 'true'; }
  process.env.HPW_MFA_REQUIRED = 'false';
  try {
    const r = await api('POST', '/api/auth/login', { email: 'platform@hpw.test', password: 'Platform12345' }); assert.equal(r.status, 200); const ck = cookieOf(r.res);
    const t = await app.inject({ method: 'GET', url: '/api/platform/tenants', headers: { cookie: ck } }); assert.equal(t.statusCode, 200, t.body);
  } finally { process.env.HPW_MFA_REQUIRED = 'true'; }
});

test('V3-07 şirkete özel giriş: kod ile şirket adı okunur; o şirketin üyesi olmayan aynı genel hatayı alır; ACTION_OWNER kapalı', async () => {
  const pub = await api('GET', `/api/public/tenant/${ctx.codeA!.replace(/[A-Z]/g, c => String.fromCharCode(c.charCodeAt(0) + 32))}`); assert.equal(pub.status, 200, JSON.stringify(pub.body)); assert.deepEqual(pub.body, { code: ctx.codeA, name: 'V3A şirketi' });
  assert.equal((await api('GET', '/api/public/tenant/YOKBOYLE1')).status, 404);
  assert.deepEqual((await api('GET', '/api/public/app')).body, { mode: 'legacy' }); process.env.HPW_LEGACY_MODULES = 'false'; try { assert.deepEqual((await api('GET', '/api/public/app')).body, { mode: 'v3' }); } finally { process.env.HPW_LEGACY_MODULES = 'true'; }
  const ok = await api('POST', '/api/auth/login', { email: `m1@v3a.${dom}`, password: PW, tenantCode: ctx.codeA }); assert.equal(ok.status, 200); assert.deepEqual(ok.body.memberships.map((m: J) => m.code), [ctx.codeA]);
  const no = await api('POST', '/api/auth/login', { email: `m1@v3a.${dom}`, password: PW, tenantCode: ctx.codeB }); assert.equal(no.status, 401); assert.equal(no.body.code ?? no.body.error, 'invalid_credentials');
  process.env.HPW_LEGACY_MODULES = 'false';
  try {
    const org = await template(ctx.A!, 'org', 'hrV3A');
    setRows(org, 'Org_Rolleri', [{ tenant_code: ctx.codeA, operation: 'CREATE', role_code: 'U3-AO', unit_code: 'U3', title: 'Sorumlu', permission_profile: 'ACTION_OWNER', valid_from: '2026-01-01' }]);
    const u = await upload(ctx.A!, 'org', org, 'hrV3A'); assert.ok(issues(u.body).includes('Org_Rolleri:profile_disabled'), issues(u.body).join(','));
  } finally { process.env.HPW_LEGACY_MODULES = 'true'; }
});

test('V3-08 HPW kurulum özeti: üç dosya durumu ve şirket giriş adresi', async () => {
  const r = await api('GET', `/api/platform/tenants/${ctx.A}`, undefined, 'root'); assert.equal(r.status, 200, JSON.stringify(r.body));
  const s = r.body.setup3; assert.equal(s.organization.done, true); assert.equal(s.roadmap.roadmaps, 3); assert.equal(s.roadmap.plans, 3); assert.equal(s.roadmap.startDate, '2026-11-23');
  assert.equal(s.users.done, true); assert.equal(s.loginPath, `/g/${ctx.codeA}`);
  const b = (await api('GET', `/api/platform/tenants/${ctx.B}`, undefined, 'root')).body.setup3; assert.equal(b.roadmap.done, false);
});
