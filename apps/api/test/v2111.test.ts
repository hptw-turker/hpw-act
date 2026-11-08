/** v2.11.1 V211-01 (gerçek PostgreSQL + Fastify HTTP, iki bağlantı): kural değerlendirmesi ile kullanıcı komutları (üstlen/bırak/ertele) arasında yarış.
 * Değerlendirme, etkin işleri okuduktan sonra kaynak sorgusunda bekletilir (ayrı bağlantı email_outbox tablosunu kilitler); bu sırada komut gönderilir; kilit bırakılınca iki işlem de biter.
 * Beklenen: başarılı kullanıcı komutu değerlendirme tarafından geri alınmaz; sahip, durum, sürüm ve geçmiş tutarlı; eski sürümle gelen komut 409. */
import { ensureMfa, submitFresh, secretFor } from './mfa-helper.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import pg from 'pg';
import { buildApp } from '../src/server.js';
import { config } from '../src/config.js';

let app: Awaited<ReturnType<typeof buildApp>>;
const cookies: Record<string, string> = {};
const cookieOf = (res: { headers: Record<string, unknown> }) => { const sc = res.headers['set-cookie']; const raw = Array.isArray(sc) ? sc[0] : String(sc ?? ''); return raw.split(';')[0]!; };
type J = Record<string, unknown> & Record<string, never>;
async function api(method: 'GET' | 'POST' | 'PATCH', url: string, body?: unknown, who?: string, headers: Record<string, string> = {}) { const res = await app.inject({ method, url, payload: body as Record<string, unknown> | undefined, headers: { ...(who ? { cookie: cookies[who]! } : {}), ...headers } }); let json: unknown = null; try { json = JSON.parse(res.body); } catch { json = res.body; } return { status: res.statusCode, body: json as J, res }; }
function mailTokenFor(email: string, kind: 'davet' | 'parola'): string { const files = readdirSync(config.mailDir).filter(f => f.endsWith('.eml')).map(f => ({ f, t: readFileSync(`${config.mailDir}/${f}`, 'utf8') })).filter(x => x.t.includes(`To: ${email}`) && x.t.includes(`#/${kind}/`)).map(x => ({ ...x, d: /Date: (\S+)/.exec(x.t)?.[1] ?? '' })).sort((a, b) => a.d < b.d ? 1 : -1); assert.ok(files.length, `${kind} e-postası yok: ${email}`); return new RegExp(`#/${kind}/([A-Za-z0-9_-]+)`).exec(files[0]!.t)![1]!; }
async function login(email: string, who: string, password: string) { const r = await api('POST', '/api/auth/login', { email, password }); assert.equal(r.status, 200, JSON.stringify(r.body)); cookies[who] = cookieOf(r.res); if (r.body.realm === 'platform') await ensureMfa((m, u, b) => api(m, u, b, who) as never, email); return r.body; }
const PW = 'Parola12345'; const S = 'E' + Date.now().toString(36).toLocaleUpperCase('en-US').slice(-4); const dom = `e${S.toLocaleLowerCase('en-US')}.test`;
const su = () => new pg.Client({ connectionString: config.migrateUrl });
const one = async (sql: string, args: unknown[] = []) => { const c = su(); await c.connect(); try { return (await c.query(sql, args)).rows; } finally { await c.end(); } };
before(async () => { mkdirSync(config.mailDir, { recursive: true }); app = await buildApp(); await api('POST', '/api/platform/bootstrap', { email: 'platform@hpw.test', password: 'Platform12345', setupKey: config.setupKey }); await login('platform@hpw.test', 'root', 'Platform12345'); });
after(async () => { await app.close(); });
const T: Record<string, string> = {};
const mkTenant = async (k: string) => { const r = await api('POST', '/api/platform/tenants', { code: `${k}${S}`, name: `${k} şirketi` }, 'root'); assert.equal(r.status, 200, JSON.stringify(r.body)); T[k] = r.body.id as string; return T[k]!; };
const mkStaff = async (who: string, role: string, tenants: string[] = [], duty?: string) => { const email = `${who}@hpw.${dom}`; const r = await api('POST', '/api/platform/staff', { email, displayName: who, role, tenantIds: tenants, ...(duty ? { duty } : {}), reason: 'v2.9.1 testi' }, 'root'); assert.equal(r.status, 200, JSON.stringify(r.body)); await api('POST', `/api/auth/reset/${mailTokenFor(email, 'parola')}`, { password: PW }); await login(email, who, PW); return r.body.id as string; };
const duties = async (tid: string) => (await one(`SELECT u.display_name AS n, a.duty, a.revoked_at IS NOT NULL AS rev FROM platform_tenant_access a JOIN app_user u ON u.id = a.user_id WHERE a.tenant_id = $1 ORDER BY u.display_name`, [tid])) as { n: string; duty: string; rev: boolean }[];


type WI = { id: string; tenant_id: string; rule: string; state: string; version: number; occurrence: number; eval_status: string; claimed_by: string | null; evidence: Record<string, unknown>; last_ok_eval_at: string | null };
const stale = (tid: string) => one(`UPDATE platform_work_eval SET last_attempt_at = now() - interval '10 minutes' WHERE tenant_id = $1`, [tid]);
const list = async (tid: string, who = 'root', extra = '') => { const r = await api('GET', `/api/platform/work-items?tenantId=${tid}${extra}`, undefined, who); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body as unknown as { items: WI[]; evaluations: { rule: string; status: string; detail: string | null; last_ok_at: string | null }[] }; };
const item = async (tid: string, rule: string, who = 'root') => (await list(tid, who)).items.find(i => i.rule === rule);
const act = (id: string, op: string, body: Record<string, unknown>, who = 'root', key?: string) => api('POST', `/api/platform/work-items/${id}/${op}`, body, who, key ? { 'idempotency-key': key } : undefined);
const inviteOf = async (tid: string) => (await one(`SELECT i.id FROM invitation i JOIN membership m ON m.id = i.membership_id WHERE m.tenant_id = $1 ORDER BY i.created_at DESC LIMIT 1`, [tid]))[0].id as string;
const setDelivery = async (T: string, status: string) => one(`UPDATE email_outbox SET status = $2 WHERE invitation_id = $1`, [await inviteOf(T), status]);
async function tenantWithFailedInvite(tag: string) { const r = await api('POST', '/api/platform/tenants', { code: `${tag}${S}`, name: tag, adminEmail: `ik@${tag.toLowerCase()}.${dom}`, adminName: 'İK' }, 'root'); assert.equal(r.status, 200); const T = r.body.id as string; assert.equal((await api('POST', `/api/t/${T}/invitations/send`, {}, 'root')).status, 200); await setDelivery(T, 'perm_fail'); return T; }


const hold = async () => { const c = su(); await c.connect(); await c.query('BEGIN'); await c.query('LOCK TABLE email_outbox IN ACCESS EXCLUSIVE MODE'); return c; };
const evalAsync = (T: string) => { const p = stale(T).then(() => api('GET', `/api/platform/work-items?tenantId=${T}`, undefined, 'root')); return p; };
const hist = async (id: string) => (await one(`SELECT action FROM platform_audit_event WHERE target_id = $1 ORDER BY occurred_at, id`, [id])).map(r => r.action as string);
const row = async (id: string) => (await one('SELECT state, claimed_by, version FROM platform_work_item WHERE id = $1', [id]))[0] as { state: string; claimed_by: string | null; version: number };
/** v2.11.2: sıra sabit bekleme sürelerine değil, kilit beklemesinin gözlenmesine dayanır (pg_locks): (1) değerlendirme email_outbox kilidinde bekliyor — yani etkin işleri kilitleyip okudu;
 *  (2) kullanıcı komutu iş satırının kilidinde bekliyor — yani değerlendirmenin arkasında sıraya girdi. Sinyaller sonuçla birlikte döner ve testte doğrulanır. */
const waitFor = async (pred: () => Promise<boolean>, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pred()) return true; await new Promise(r => setTimeout(r, 40)); } return false; };
const evalWaiting = async () => Number((await one(`SELECT COUNT(*) AS n FROM pg_locks l JOIN pg_class c ON c.oid = l.relation WHERE NOT l.granted AND c.relname = 'email_outbox'`))[0].n) > 0;
const rowWaiting = async () => Number((await one(`SELECT COUNT(*) AS n FROM pg_locks WHERE NOT granted AND locktype IN ('transactionid', 'tuple')`))[0].n) > 0;
async function race(T: string, cmd: () => Promise<{ status: number; body: unknown }>) {
  const c = await hold(); const ev = evalAsync(T); const s1 = await waitFor(evalWaiting); // değerlendirme etkin işleri okudu ve kaynak sorgusunda bekliyor
  let done = false; const cm = cmd().then(r => { done = true; return r; }); const s2 = await waitFor(async () => done || await rowWaiting(), 1500); const cmdWaited = !done && await rowWaiting();
  await c.query('COMMIT'); await c.end(); const [e, k] = await Promise.all([ev, cm]); return { e, k, signals: { evaluationWaitingOnSource: s1, commandWaitingOnRow: cmdWaited, observed: s2 } };
}
test('V211-01 değerlendirme sürerken üstlenme: başarılı üstlenme geri alınmaz; sürüm ve geçmiş tutarlı', async () => {
  const T = await tenantWithFailedInvite('YA'); const w = (await item(T, 'invite_failed'))!; await stale(T);
  const { e, k, signals } = await race(T, () => act(w.id, 'claim', { expectedVersion: w.version }, 'root'));
  assert.ok(signals.evaluationWaitingOnSource, 'değerlendirmenin kaynakta beklediği gözlendi'); assert.ok(signals.commandWaitingOnRow, 'üstlenmenin değerlendirmenin arkasında satır kilidinde beklediği gözlendi'); console.log('SIRA', JSON.stringify(signals));
  assert.equal(e.status, 200); assert.equal(k.status, 200, JSON.stringify(k.body));
  const r = await row(w.id); const rootId = (await one(`SELECT id FROM app_user WHERE email = 'platform@hpw.test'`))[0].id;
  assert.equal(r.state, 'claimed', 'üstlenme korunur'); assert.equal(r.claimed_by, rootId); assert.equal(r.version, w.version + 1, 'sürüm tek artış');
  const h = await hist(w.id); assert.equal(h.filter(a => a === 'work_item.claim').length, 1); assert.ok(!h.includes('work_item.owner_lost'));
});
test('V211-01 değerlendirme sürerken bırakma ve erteleme: kullanıcı komutunun sonucu kalır', async () => {
  const T = await tenantWithFailedInvite('YB'); let w = (await item(T, 'invite_failed'))!; assert.equal((await act(w.id, 'claim', { expectedVersion: w.version }, 'root')).status, 200); w = (await item(T, 'invite_failed'))!;
  let x = await race(T, () => act(w.id, 'release', { expectedVersion: w.version }, 'root')); assert.ok(x.signals.evaluationWaitingOnSource && x.signals.commandWaitingOnRow, 'sıra gözlendi: ' + JSON.stringify(x.signals)); assert.equal(x.k.status, 200, JSON.stringify(x.k.body));
  let r = await row(w.id); assert.equal(r.state, 'open'); assert.equal(r.claimed_by, null); assert.equal(r.version, w.version + 1);
  w = (await item(T, 'invite_failed'))!; const until = new Date(Date.now() + 2 * 86400000).toISOString();
  x = await race(T, () => act(w.id, 'snooze', { expectedVersion: w.version, reason: 'yarış ertelemesi', until }, 'root')); assert.ok(x.signals.evaluationWaitingOnSource && x.signals.commandWaitingOnRow, 'sıra gözlendi: ' + JSON.stringify(x.signals)); assert.equal(x.k.status, 200, JSON.stringify(x.k.body));
  r = await row(w.id); assert.equal(r.state, 'snoozed', 'erteleme korunur'); assert.equal(r.version, w.version + 1);
  const h = await hist(w.id); assert.equal(h.filter(a => a === 'work_item.release').length, 1); assert.equal(h.filter(a => a === 'work_item.snooze').length, 1);
});
test('V211-01 değerlendirme durumu değiştirirken eski sürümle gelen komut 409 alır (sessiz üzerine yazma yok)', async () => {
  const T = await tenantWithFailedInvite('YC'); let w = (await item(T, 'invite_failed'))!; assert.equal((await act(w.id, 'claim', { expectedVersion: w.version }, 'root')).status, 200); w = (await item(T, 'invite_failed'))!;
  assert.equal((await act(w.id, 'snooze', { expectedVersion: w.version, reason: 'kısa erteleme', until: new Date(Date.now() + 86400000).toISOString() }, 'root')).status, 200); w = (await item(T, 'invite_failed'))!;
  await one(`UPDATE platform_work_item SET snoozed_until = now() - interval '1 minute' WHERE id = $1`, [w.id]); // değerlendirme ertelemeyi bitirecek (durum değişir)
  const x = await race(T, () => act(w.id, 'dismiss', { expectedVersion: w.version, reason: 'eski sürümle reddetme', until: new Date(Date.now() + 86400000).toISOString() }, 'root'));
  assert.ok(x.signals.evaluationWaitingOnSource && x.signals.commandWaitingOnRow, 'sıra gözlendi: ' + JSON.stringify(x.signals));
  const r = await row(w.id);
  if (x.k.status === 200) { assert.equal(r.state, 'dismissed', 'komut önce işlendiyse sonucu kalır'); } else { assert.equal(x.k.status, 409, JSON.stringify(x.k.body)); assert.equal(r.state, 'claimed', 'değerlendirme ertelemeyi bitirdi; eski sürümlü komut reddedildi'); }
  assert.ok(r.version > w.version);
});

test('V211-06 sunucu sınırı gevşetilmedi: 30/90 günün 1 dk altı kabul, 1 dk üstü 422; formun ürettiği gövde (günün sonu, sınıra kısılmış) kabul', async () => {
  const T = await tenantWithFailedInvite('YD'); let w = (await item(T, 'invite_failed'))!; const now = Date.now(); const D = 86400000;
  assert.equal((await act(w.id, 'dismiss', { expectedVersion: w.version, reason: 'sınır üstü', until: new Date(now + 30 * D + 60000).toISOString() }, 'root')).status, 422, '30 gün + 1 dk reddedilir');
  assert.equal((await act(w.id, 'snooze', { expectedVersion: w.version, reason: 'sınır üstü', until: new Date(now + 90 * D + 60000).toISOString() }, 'root')).status, 422, '90 gün + 1 dk reddedilir');
  // formun hesabı: seçilen günün sonu (yerel 23:59), sınırın 1 dk altına kısılır (apps/web WorkItems.untilFor ile aynı kural)
  const untilFor = (day: string, limit: number) => new Date(Math.min(new Date(`${day}T23:59:00`).getTime(), Date.now() + limit * D - 60000)).toISOString();
  const maxDay = (limit: number) => { const d = new Date(Date.now() + limit * D - 60000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const r1 = await act(w.id, 'snooze', { expectedVersion: w.version, reason: 'formun en son erteleme günü', until: untilFor(maxDay(90), 90) }, 'root'); assert.equal(r1.status, 200, JSON.stringify(r1.body));
  w = (await item(T, 'invite_failed'))!; const r2 = await act(w.id, 'dismiss', { expectedVersion: w.version, reason: 'formun en son reddetme günü', until: untilFor(maxDay(30), 30) }, 'root'); assert.equal(r2.status, 200, JSON.stringify(r2.body));
});
