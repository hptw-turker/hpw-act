/** v2.15.0 — Yol haritası (sunumla birebir) gerçek PostgreSQL + Fastify HTTP testleri.
 * Kapsam: form şablonu; doğrulama (bilinmeyen birim/madde/plan, sayı ve tarih kuralları, dönem uyuşmazlığı); onay (planlar, adımlar, takvim terminleri);
 * yetki (birim yöneticisi yalnız kendi birimi ve yönetim adımları; İK adımı İK'da; çalışan adımı takip edilmez; üst yönetim salt okur); sürüm çakışması;
 * yeniden yükleme (eski sürüm 'superseded', aynı adımın durumu taşınır, eski sürümde yazma 409); şirketler arası yalıtım. Veriler sentetiktir. */
import { ensureMfa } from './mfa-helper.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { buildApp } from '../src/server.js';
import { config } from '../src/config.js';
import { FORM } from '../src/importers/roadmap.js';

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

const ctx: { A?: string; B?: string; cycleA?: string; cycleB?: string; codeA?: string; codeB?: string } = {};
async function company(tag: string) {
  const code = `${tag}${S}`; const hr = `ik@${tag.toLocaleLowerCase('en-US')}.${dom}`;
  const r = await api('POST', '/api/platform/tenants', { code, name: `${tag} şirketi`, adminEmail: hr, adminName: 'İK' }, 'root'); assert.equal(r.status, 200, JSON.stringify(r.body)); const tid = r.body.id as string;
  assert.equal((await api('POST', `/api/t/${tid}/invitations/send`, {}, 'root')).status, 200);
  assert.equal((await api('POST', `/api/invitations/${mailToken(hr)}/accept`, { password: PW })).status, 200); await login(hr, `hr${tag}`, PW);
  // organizasyon: kök + iki birim + roller
  const org = await template(tid, 'org', `hr${tag}`);
  setRows(org, 'Birim_Tipleri', [{ tenant_code: code, unit_type_code: 'ROOT', label: 'Grup' }, { tenant_code: code, unit_type_code: 'SITE', label: 'İşletme' }]);
  setRows(org, 'Birimler', [{ tenant_code: code, operation: 'CREATE', unit_code: 'KOK', unit_name: 'Kök', unit_type_code: 'ROOT', timezone: 'Europe/Istanbul', valid_from: '2026-01-01' }, ...['U1', 'U2'].map(u => ({ tenant_code: code, operation: 'CREATE', unit_code: u, unit_name: `Birim ${u}`, unit_type_code: 'SITE', timezone: 'Europe/Istanbul', valid_from: '2026-01-01' }))]);
  setRows(org, 'Hiyerarsiler', [{ tenant_code: code, hierarchy_code: 'SURVEY', label: 'Anket', purpose: 'SURVEY_ROLLUP' }]);
  setRows(org, 'Iliskiler', ['U1', 'U2'].map(u => ({ tenant_code: code, operation: 'CREATE', hierarchy_code: 'SURVEY', child_unit: u, parent_unit: 'KOK', relation_type: 'REPORTS_TO', valid_from: '2026-01-01' })));
  setRows(org, 'Org_Rolleri', [{ tenant_code: code, operation: 'CREATE', role_code: 'UY', unit_code: 'KOK', title: 'Üst yönetim', permission_profile: 'EXEC', valid_from: '2026-01-01' }, ...['U1', 'U2'].map(u => ({ tenant_code: code, operation: 'CREATE', role_code: `${u}-M`, unit_code: u, title: 'Müdür', permission_profile: 'UNIT_MANAGER', valid_from: '2026-01-01' }))]);
  const o = await upload(tid, 'org', org, `hr${tag}`); assert.equal(o.body.canCommit, true, JSON.stringify(o.body.issues)); await commit(tid, o.body.jobId, `hr${tag}`);
  const ins = await template(tid, 'instrument', `hr${tag}`); const iu = await upload(tid, 'instrument', ins, `hr${tag}`); assert.equal(iu.body.canCommit, true, JSON.stringify(iu.body.issues)); const ic = await commit(tid, iu.body.jobId, `hr${tag}`);
  const cy = await api('POST', `/api/t/${tid}/cycles`, { code: '2026-ANA', periodStart: '2026-09-01', periodEnd: '2026-10-31', instrumentVersionId: (ic.applied as J).instrumentVersionId }, `hr${tag}`); assert.equal(cy.status, 200, JSON.stringify(cy.body));
  for (const [u, role] of [['m1', 'U1-M'], ['m2', 'U2-M'], ['ex', 'UY']] as const) { const email = `${u}@${tag.toLocaleLowerCase('en-US')}.${dom}`; const r2 = await api('POST', `/api/t/${tid}/users`, { email, displayName: u, roleCodes: [role], invite: true }, `hr${tag}`); assert.equal(r2.status, 200, JSON.stringify(r2.body)); }
  assert.equal((await api('POST', `/api/t/${tid}/invitations/send`, {}, `hr${tag}`)).status, 200);
  for (const u of ['m1', 'm2', 'ex']) { const email = `${u}@${tag.toLocaleLowerCase('en-US')}.${dom}`; assert.equal((await api('POST', `/api/invitations/${mailToken(email)}/accept`, { password: PW })).status, 200); await login(email, `${u}${tag}`, PW); }
  return { tid, code, cycleId: cy.body.id as string };
}
/** Sunumla birebir form satırları (sentetik): U1 iki eylem planı, U2 eylem plansız */
function form(code: string, over: Partial<Record<string, Record<string, unknown>[]>> = {}, start = '2026-11-09') {
  const R: Record<string, Record<string, unknown>[]> = {
    Rapor: [{ tenant_code: code, cycle_code: '2026-ANA', report_title: 'Test 2026 Raporu', company_label: 'Test geneli', start_date: start, source_note: 'sentetik' }],
    Birimler: [{ unit_code: 'U1', unit_label: 'Birim U1', sector_label: 'Turizm sektörü', headcount: 30, participants: 28, participation_rate: 93.3, cert_score: 70, conclusion_title: 'ANA SONUÇ', conclusion_headline: 'Katkı isteği güçlüdür.', conclusion_body: 'Birinci paragraf.\nİkinci paragraf.', priority_summary: 'Üç alan birbirini tamamlar.', influence_principle: 'Sayılar bu ölçümün verisidir.', agenda_title: 'Ortak gündem', agenda_subtitle: 'Yorum yazan 27 çalışan', practice_principle: 'Ücret doğrudan artış kararı değildir.', monitoring_approach: 'Kısa aralıklı ölçüm.\nYıllık araştırma.' }, { unit_code: 'U2', unit_label: 'Birim U2', conclusion_headline: 'U2 ana sonuç.' }],
    Guclu_Yonler: [{ unit_code: 'U1', order: 1, title: 'Başarı', text: 'Başarı %86,6.' }],
    Oncelikler: [1, 2, 3].map(n => ({ unit_code: 'U1', priority_no: n, title: `Öncelik ${n}`, short_title: `Ö${n}`, rationale: 'Gerekçe.', finding: 'Bulgu %53,6.', area_label: 'Çalışma Ekosistemi · Alan' })),
    Oncelik_Uygulamalari: [{ unit_code: 'U1', priority_no: 1, kind: 'QUESTION', order: 1, text: 'İhtiyaçlar nelerdir?' }, { unit_code: 'U1', priority_no: 1, kind: 'PRACTICE', order: 1, text: 'Program hazırlanması.' }],
    Etki_Alani: [{ unit_code: 'U1', role_code: 'IK', role_label: 'Test İnsan Kaynakları', tagline: 'Ölçer, araç sağlar', order: 1, duty: 'Nabız anketleri' }, { unit_code: 'U1', role_code: 'YONETIM', role_label: 'Birim U1 Yönetimi', tagline: 'Düzenler', order: 1, duty: 'Birebir görüşmeler' }],
    Roller: [{ unit_code: 'U1', role_code: 'IK', title: 'İK sorumlulukları', description: 'Süreci koordine eder.', note_title: 'İK ROLÜ', note: 'Süreç ve araç.' }],
    Rol_Sorumluluklari: [{ unit_code: 'U1', role_code: 'IK', priority_no: 1, priority_title: 'Eğitim', kind: 'DUTY', order: 1, text: 'İhtiyaç analizi.' }, { unit_code: 'U1', role_code: 'IK', priority_no: 1, priority_title: 'Eğitim', kind: 'EXPECTED', order: 1, text: 'Eğitim planı.' }],
    Rol_Surecleri: [{ unit_code: 'U1', role_code: 'IK', order: 1, phase_label: 'İlk 90 gün', text: 'Toplantıları planlamak.' }],
    Uygulama_Takvimi: [{ unit_code: 'U1', phase_no: 1, phase_label: 'İLK 90 GÜN', phase_title: 'Doğrulama', phase_outcome: 'Uygulama planı.', order: 1, workstream_title: 'Eğitim', workstream_text: 'İhtiyaçların belirlenmesi.' }],
    Gundem: [{ unit_code: 'U1', theme_no: 1, title: 'Takdir ve tanınma', mentions: 4, commenters: 27 }, { unit_code: 'U1', theme_no: 2, title: 'Cumartesi çalışması', mentions: 14, commenters: 27 }],
    Gundem_Gostergeleri: [{ unit_code: 'U1', theme_no: 1, order: 1, label: 'Yöneticinin bireysel ilgisi', item_code: 'GUV-01', unit_value: 50, company_value: 67.6 }, { unit_code: 'U1', theme_no: 2, order: 1, note: 'Ankette doğrudan soru yer almaz.' }],
    Eylem_Planlari: [{ unit_code: 'U1', plan_no: 1, theme_no: 1, title: 'Takdir ve tanınma', headline: 'Takdir ve tanınma: 27 çalışanın 4’ü değiniyor', mentions: 4, commenters: 27, measure_label: 'Yöneticinin bireysel ilgisi', measure_item_code: 'GUV-01', measure_current: 50, measure_company: 67.6, measure_target: 52.5, measure_rule: 'mevcut + 2,5 puan', measure_text: 'Yöneticinin bireysel ilgisi: mevcut %50,0, hedef %52,5.' },
      { unit_code: 'U1', plan_no: 2, theme_no: 2, title: 'Cumartesi çalışması', headline: 'Cumartesi çalışması: 27 çalışanın 14’ü değiniyor', data_note: 'Ankette bu konuya doğrudan soru yer almaz.', measure_text: 'Yorum sayısının izlenmesi.' }],
    Eylem_Dayanaklari: [{ unit_code: 'U1', plan_no: 1, order: 1, label: 'Yöneticinin bireysel ilgisi', item_code: 'GUV-01', unit_value: 50, company_value: 67.6 }, { unit_code: 'U1', plan_no: 1, order: 2, label: 'Temel Beklentiler boyutu', dimension_code: 'TEM', unit_value: 34.8, company_value: 45.1 }],
    Eylem_Adimlari: [{ unit_code: 'U1', plan_no: 1, role_code: 'IK', role_label: 'Test İnsan Kaynakları', order: 1, text: 'Ortak tanınma çerçevesi hazırlamak.' }, { unit_code: 'U1', plan_no: 1, role_code: 'YONETIM', role_label: 'Birim U1 Yönetimi', order: 1, text: 'Ekip başarılarını aylık paylaşmak.' }, { unit_code: 'U1', plan_no: 1, role_code: 'YONETIM', role_label: 'Birim U1 Yönetimi', order: 2, text: 'Dönemsel geri bildirim görüşmesi yapmak.' }, { unit_code: 'U1', plan_no: 1, role_code: 'CALISAN', role_label: 'Çalışanlar', order: 1, text: 'Ekip arkadaşına teşekkür etmek.' },
      { unit_code: 'U1', plan_no: 2, role_code: 'YONETIM', role_label: 'Birim U1 Yönetimi', order: 1, text: 'Cumartesi ihtiyacını netleştirmek.' }],
    Eylem_Takvimi: [{ unit_code: 'U1', plan_no: 1, order: 1, phase_label: 'İlk 30 gün', due_days: 30, text: 'kriterlerin duyurulması.' }, { unit_code: 'U1', plan_no: 1, order: 2, phase_label: '6 ay', due_days: 180, text: 'nabız ölçümü.' }],
    Izleme_Hedefleri: [{ unit_code: 'U1', order: 1, label: 'Akış', current_value: 67.9, company_value: 69.9, target_text: 'Mevcut düzeyin korunması', direction: 'MAINTAIN' }, { unit_code: 'U1', order: 2, label: 'Eğitim olanakları', current_value: 53.6, sector_value: 81.4, company_value: 55.8, target_text: '%56,1', target_value: 56.1, direction: 'INCREASE' }],
  };
  return { ...R, ...over };
}
async function roadmapWb(tid: string, cycleId: string, rows: Record<string, Record<string, unknown>[] | undefined>, who: string) { const wb = await template(tid, 'roadmap', who, cycleId); for (const [k, v] of Object.entries(rows)) if (v) setRows(wb, k, v); return wb; }

before(async () => { mkdirSync(config.mailDir, { recursive: true }); app = await buildApp(); await api('POST', '/api/platform/bootstrap', { email: 'platform@hpw.test', password: 'Platform12345', setupKey: config.setupKey }); await login('platform@hpw.test', 'root', 'Platform12345');
  const a = await company('YA'); ctx.A = a.tid; ctx.codeA = a.code; ctx.cycleA = a.cycleId; const b = await company('YB'); ctx.B = b.tid; ctx.codeB = b.code; ctx.cycleB = b.cycleId; });
after(async () => { await app.close(); });

test('YH-01 form şablonu: sunum bölüm sırasıyla bütün sayfalar ve sözlük; dönem zorunlu', async () => {
  const wb = await template(ctx.A!, 'roadmap', 'hrYA', ctx.cycleA); const names = wb.worksheets.map(w => w.name);
  for (const s of FORM) assert.ok(names.includes(s.name), `sayfa yok: ${s.name}`); assert.ok(names.includes('KILAVUZ') && names.includes('SOZLUK'));
  assert.ok(!names.some(n => /alinti|ifade/i.test(n)), 'çalışan alıntısı için sayfa olmamalı');
  const birim = wb.getWorksheet('Birimler')!; assert.equal(birim.rowCount, 4, 'organizasyondaki üç birim önceden yazılı');
  assert.equal((await api('GET', `/api/t/${ctx.A}/templates/roadmap.xlsx`, undefined, 'hrYA')).status, 400);
});

test('YH-02 doğrulama: bilinmeyen birim/madde/plan, sayı ve dönem hataları onayı kapatır', async () => {
  const bad = form(ctx.codeA!, {
    Rapor: [{ tenant_code: ctx.codeA, cycle_code: '2025-ANA', report_title: 'x', company_label: 'y', start_date: '2026-13-01' }],
    Guclu_Yonler: [{ unit_code: 'YOK', order: 1, title: 'x' }],
    Gundem_Gostergeleri: [{ unit_code: 'U1', theme_no: 1, order: 1, label: 'x', item_code: 'ZZZ-99', unit_value: 150 }],
    Eylem_Takvimi: [{ unit_code: 'U1', plan_no: 9, order: 1, phase_label: 'İlk 30 gün', due_days: 30, text: 'x' }],
  });
  bad.Eylem_Planlari = [{ ...bad.Eylem_Planlari![0]!, mentions: 40, commenters: 27 }, bad.Eylem_Planlari![1]!];
  const r = await upload(ctx.A!, 'roadmap', await roadmapWb(ctx.A!, ctx.cycleA!, bad, 'hrYA'), 'hrYA', ctx.cycleA); assert.equal(r.status, 200);
  assert.equal(r.body.canCommit, false); const codes = new Set((r.body.issues as J[]).map(i => i.code));
  for (const c of ['invalid_date', 'unit_unknown', 'item_unknown', 'out_of_range', 'plan_unknown', 'mentions_gt_commenters']) assert.ok(codes.has(c), `beklenen hata: ${c} · ${[...codes].join(',')}`);
  const r2 = await upload(ctx.A!, 'roadmap', await roadmapWb(ctx.A!, ctx.cycleA!, form(ctx.codeA!, { Rapor: [{ tenant_code: ctx.codeA, cycle_code: '2025-ANA', report_title: 'x', company_label: 'y', start_date: '2026-11-09' }] }), 'hrYA'), 'hrYA', ctx.cycleA);
  assert.ok((r2.body.issues as J[]).some(i => i.code === 'cycle_mismatch'));
  const r3 = await upload(ctx.A!, 'roadmap', await roadmapWb(ctx.A!, ctx.cycleA!, form(ctx.codeB!), 'hrYA'), 'hrYA', ctx.cycleA);
  assert.ok((r3.body.issues as J[]).some(i => i.code === 'tenant_code_mismatch'), 'başka şirketin kodu reddedilir');
  const commitBad = await api('POST', `/api/t/${ctx.A}/imports/${r.body.jobId}/commit`, {}, 'hrYA'); assert.equal(commitBad.status, 409);
});

let ridU1 = ''; let ridU2 = '';
test('YH-03 onay: sunumdaki metin ve sayılar aynen; takvim terminleri başlangıç + gün', async () => {
  const r = await upload(ctx.A!, 'roadmap', await roadmapWb(ctx.A!, ctx.cycleA!, form(ctx.codeA!), 'hrYA'), 'hrYA', ctx.cycleA); assert.equal(r.body.canCommit, true, JSON.stringify(r.body.issues));
  const c = await commit(ctx.A!, r.body.jobId, 'hrYA'); assert.equal(c.roadmaps, 2); assert.equal(c.plans, 2); assert.equal(c.steps, 5); assert.equal(c.milestones, 2);
  const L = await api('GET', `/api/t/${ctx.A}/roadmaps`, undefined, 'hrYA'); assert.equal(L.status, 200); assert.equal(L.body.units.length, 2);
  ridU1 = L.body.units.find((u: J) => u.unitCode === 'U1').roadmapId; ridU2 = L.body.units.find((u: J) => u.unitCode === 'U2').roadmapId;
  const d = await api('GET', `/api/t/${ctx.A}/roadmaps/${ridU1}`, undefined, 'hrYA'); assert.equal(d.status, 200);
  assert.equal(d.body.startDate, '2026-11-09'); assert.equal(d.body.content.header.conclusion_body, 'Birinci paragraf.\nİkinci paragraf.');
  const p1 = d.body.plans[0]; assert.equal(p1.headline, 'Takdir ve tanınma: 27 çalışanın 4’ü değiniyor'); assert.equal(p1.measure.target, 52.5); assert.equal(p1.measure.rule, 'mevcut + 2,5 puan');
  assert.deepEqual(p1.milestones.map((m: J) => m.dueDate), ['2026-12-09', '2027-05-08']);
  assert.deepEqual(p1.steps.map((s: J) => s.role), ['IK', 'YONETIM', 'YONETIM', 'CALISAN']);
  assert.equal(d.body.plans[1].dataNote, 'Ankette bu konuya doğrudan soru yer almaz.'); assert.equal(d.body.plans[1].measure.label, null);
  const u2 = await api('GET', `/api/t/${ctx.A}/roadmaps/${ridU2}`, undefined, 'hrYA'); assert.equal(u2.body.plans.length, 0, 'eylem plansız birim geçerli');
});

test('YH-04 yetki: birim yöneticisi yalnız kendi birimini görür; yönetim adımını ve takvimi işaretler, İK adımını işaretleyemez; çalışan adımı takip edilmez; üst yönetim salt okur', async () => {
  const L = await api('GET', `/api/t/${ctx.A}/roadmaps`, undefined, 'm1YA'); assert.deepEqual(L.body.units.map((u: J) => u.unitCode), ['U1']);
  assert.equal((await api('GET', `/api/t/${ctx.A}/roadmaps/${ridU1}`, undefined, 'm2YA')).status, 404, 'başka birimin yol haritası görünmez');
  const d = await api('GET', `/api/t/${ctx.A}/roadmaps/${ridU1}`, undefined, 'm1YA'); assert.deepEqual(d.body.rights, { IK: false, YONETIM: true, milestone: true });
  const steps = d.body.plans[0].steps as J[]; const y = steps.find(s => s.role === 'YONETIM')!; const ik = steps.find(s => s.role === 'IK')!; const ca = steps.find(s => s.role === 'CALISAN')!;
  const ok = await api('POST', `/api/t/${ctx.A}/roadmap-steps/${y.id}/status`, { status: 'DONE', expectedVersion: y.version }, 'm1YA'); assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.equal(ok.body.status, 'DONE'); assert.equal(ok.body.version, 2);
  assert.equal((await api('POST', `/api/t/${ctx.A}/roadmap-steps/${y.id}/status`, { status: 'IN_PROGRESS', expectedVersion: 1 }, 'm1YA')).status, 409, 'eski sürümle yazma çakışma döner');
  assert.equal((await api('POST', `/api/t/${ctx.A}/roadmap-steps/${ik.id}/status`, { status: 'DONE', expectedVersion: ik.version }, 'm1YA')).status, 403);
  assert.equal((await api('POST', `/api/t/${ctx.A}/roadmap-steps/${ca.id}/status`, { status: 'DONE', expectedVersion: ca.version }, 'hrYA')).status, 422);
  assert.equal((await api('POST', `/api/t/${ctx.A}/roadmap-steps/${y.id}/status`, { status: 'DONE', expectedVersion: 2 }, 'm2YA')).status, 404);
  const ikOk = await api('POST', `/api/t/${ctx.A}/roadmap-steps/${ik.id}/status`, { status: 'IN_PROGRESS', expectedVersion: ik.version, note: 'çerçeve taslağı hazır' }, 'hrYA'); assert.equal(ikOk.status, 200);
  const ms = d.body.plans[0].milestones[0]; assert.equal((await api('POST', `/api/t/${ctx.A}/roadmap-milestones/${ms.id}/status`, { status: 'DONE', expectedVersion: ms.version }, 'm1YA')).status, 200);
  const ex = await api('GET', `/api/t/${ctx.A}/roadmaps`, undefined, 'exYA'); assert.equal(ex.body.units.length, 2);
  const exd = await api('GET', `/api/t/${ctx.A}/roadmaps/${ridU1}`, undefined, 'exYA'); assert.deepEqual(exd.body.rights, { IK: false, YONETIM: false, milestone: false });
  assert.equal((await api('POST', `/api/t/${ctx.A}/roadmap-steps/${y.id}/status`, { status: 'NOT_STARTED', expectedVersion: 2 }, 'exYA')).status, 403);
  const hr = await api('GET', `/api/t/${ctx.A}/roadmap-hr-steps`, undefined, 'hrYA'); assert.equal(hr.body.length, 1); assert.equal(hr.body[0].status, 'IN_PROGRESS'); assert.equal(hr.body[0].canUpdate, true);
  const sum = (await api('GET', `/api/t/${ctx.A}/roadmaps`, undefined, 'exYA')).body.units.find((u: J) => u.unitCode === 'U1'); assert.deepEqual(sum.management, { total: 3, done: 1, inProgress: 0 }); assert.equal(sum.milestones.done, 1);
});

test('YH-05 yeniden yükleme: eski sürüm saklanır, değişmeyen adımın durumu taşınır, değişen adım sıfırdan başlar; eski sürüme yazma reddedilir', async () => {
  const before = await api('GET', `/api/t/${ctx.A}/roadmaps/${ridU1}`, undefined, 'm1YA'); const oldStep = (before.body.plans[0].steps as J[]).find(s => s.role === 'YONETIM' && s.ord === 2)!;
  const rows = form(ctx.codeA!); rows.Eylem_Adimlari = rows.Eylem_Adimlari!.map(s => (s.plan_no === 1 && s.role_code === 'YONETIM' && s.order === 2 ? { ...s, text: 'Dönemsel geri bildirim görüşmesi yapmak (düzeltilmiş).' } : s));
  const r = await upload(ctx.A!, 'roadmap', await roadmapWb(ctx.A!, ctx.cycleA!, rows, 'hrYA'), 'hrYA', ctx.cycleA); const c = await commit(ctx.A!, r.body.jobId, 'hrYA'); assert.ok(Number(c.carriedStatuses) >= 3, JSON.stringify(c));
  const L = await api('GET', `/api/t/${ctx.A}/roadmaps`, undefined, 'm1YA'); const nid = L.body.units[0].roadmapId; assert.notEqual(nid, ridU1);
  const d = await api('GET', `/api/t/${ctx.A}/roadmaps/${nid}`, undefined, 'm1YA'); const st = d.body.plans[0].steps as J[];
  assert.equal(st.find(s => s.role === 'YONETIM' && s.ord === 1)!.status, 'DONE'); assert.equal(st.find(s => s.role === 'IK')!.status, 'IN_PROGRESS'); assert.equal(st.find(s => s.role === 'YONETIM' && s.ord === 2)!.status, 'NOT_STARTED');
  assert.equal(d.body.plans[0].milestones[0].status, 'DONE');
  const old = await api('GET', `/api/t/${ctx.A}/roadmaps/${ridU1}`, undefined, 'hrYA'); assert.equal(old.body.status, 'superseded');
  assert.equal((await api('POST', `/api/t/${ctx.A}/roadmap-steps/${oldStep.id}/status`, { status: 'DONE', expectedVersion: oldStep.version }, 'm1YA')).status, 409);
});

test('YH-06 şirketler arası yalıtım: B şirketi A şirketinin yol haritasını ve adımını göremez, yazamaz', async () => {
  const L = await api('GET', `/api/t/${ctx.A}/roadmaps`, undefined, 'hrYA'); const rid = L.body.units[0].roadmapId; const sid = (await api('GET', `/api/t/${ctx.A}/roadmaps/${rid}`, undefined, 'hrYA')).body.plans[0].steps[0].id;
  assert.equal((await api('GET', `/api/t/${ctx.B}/roadmaps/${rid}`, undefined, 'hrYB')).status, 404);
  assert.notEqual((await api('GET', `/api/t/${ctx.A}/roadmaps/${rid}`, undefined, 'hrYB')).status, 200);
  assert.equal((await api('POST', `/api/t/${ctx.B}/roadmap-steps/${sid}/status`, { status: 'DONE', expectedVersion: 1 }, 'hrYB')).status, 404);
  assert.equal((await api('GET', `/api/t/${ctx.B}/roadmaps`, undefined, 'hrYB')).body.units.length, 0);
});
