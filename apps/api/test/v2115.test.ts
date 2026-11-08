/** v2.11.5 (V2114-A01) gerçek PostgreSQL + Fastify HTTP: sonuç okuması ile iş okuması arasında özgün komutun commit'i. Sıra sabit beklemeyle değil gözlenebilir sinyallerle kurulur:
 * ayrı bağlantı iş satırını kilitler → komut bu kilitte beklerken (pg_locks) ilk sonuç okuması yapılır (not_found) → kilit bırakılır, komut 200 döner (commit) → iş okuması yeni sürümü görür → özgün anahtar yeniden sorgulanır (applied).
 * Test amaçlı kilit yalnız test bağlantısındadır; üretim kodu değişmez. */
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
const PW = 'Parola12345'; const S = 'G' + Date.now().toString(36).toLocaleUpperCase('en-US').slice(-4); const dom = `g${S.toLocaleLowerCase('en-US')}.test`;
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



const outcome = (key: string, who = 'root') => api('GET', `/api/platform/commands/${encodeURIComponent(key)}/outcome`, undefined, who);
const readItem = async (T: string, id: string) => ((await api('GET', `/api/platform/work-items?tenantId=${T}&evaluate=0`, undefined, 'root')).body as unknown as { items: WI[] }).items.find(i => i.id === id)!;
const waitFor = async (pred: () => Promise<boolean>, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pred()) return true; await new Promise(r => setTimeout(r, 40)); } return false; };
const rowWaiting = async () => Number((await one(`SELECT COUNT(*) AS n FROM pg_locks WHERE NOT granted AND locktype IN ('transactionid', 'tuple')`))[0].n) > 0;
for (const op of ['dismiss', 'snooze'] as const) test(`V2114-A01 ${op}: ilk sonuç okuması yokluk görür, özgün komut ardından commit olur; yeni sürüm görüldükten sonra özgün anahtar applied`, async () => {
  const T = await tenantWithFailedInvite(op === 'dismiss' ? 'GA' : 'GB'); const w = (await item(T, 'invite_failed'))!; const key = `k-sira-${op}-${S}`;
  const c = su(); await c.connect(); await c.query('BEGIN'); await c.query('SELECT id FROM platform_work_item WHERE id = $1 FOR UPDATE', [w.id]);
  let done = false; const cmd = act(w.id, op, { expectedVersion: w.version, reason: 'özgün gerekçe', until: new Date(Date.now() + 3 * 86400000).toISOString() }, 'root', key).then(r => { done = true; return r; });
  const waiting = await waitFor(async () => !done && await rowWaiting()); assert.ok(waiting, 'komut iş satırı kilidinde bekliyor (sinyal)');
  const o1 = await outcome(key); assert.equal((o1.body as unknown as { status: string }).status, 'not_found', 'ilk okuma: yokluk (komut henüz commit olmadı)'); assert.equal(done, false);
  await c.query('COMMIT'); await c.end(); const r = await cmd; assert.equal(r.status, 200, 'özgün komut commit oldu');
  const cur = await readItem(T, w.id); assert.equal(cur.version, w.version + 1, 'iş okuması yeni sürümü görür'); assert.equal(cur.state, op === 'dismiss' ? 'dismissed' : 'snoozed');
  const o2 = await outcome(key); const b2 = o2.body as unknown as { status: string; route: string }; assert.equal(b2.status, 'applied', 'yeni sürüm görüldükten sonra özgün anahtar applied'); assert.equal(b2.route, `POST /work-items/${w.id}/${op}`);
  console.log('SIRA-A01', JSON.stringify({ op, waiting, first: 'not_found', commit: r.status, itemVersion: cur.version, second: b2.status }));
});
test('V2114-A01 kontrol: özgün komut hiç ulaşmadı, başka aktör sürümü ilerletti → yeni sürüm görüldükten sonra da özgün anahtar not_found (kesin)', async () => {
  const T = await tenantWithFailedInvite('GC'); const w = (await item(T, 'invite_failed'))!; const mine = `k-ulasmadi-${S}`;
  assert.equal(((await outcome(mine)).body as unknown as { status: string }).status, 'not_found');
  assert.equal((await act(w.id, 'dismiss', { expectedVersion: w.version, reason: 'başka aktör', until: new Date(Date.now() + 5 * 86400000).toISOString() }, 'root', `k-baska-${S}`)).status, 200);
  const cur = await readItem(T, w.id); assert.equal(cur.version, w.version + 1);
  assert.equal(((await outcome(mine)).body as unknown as { status: string }).status, 'not_found', 'sürüm ilerledikten sonra da yok: özgün komut eski sürümle artık uygulanamaz');
  const late = await act(w.id, 'dismiss', { expectedVersion: w.version, reason: 'geç gelen özgün', until: new Date(Date.now() + 3 * 86400000).toISOString() }, 'root', mine); assert.equal(late.status, 409, 'geç gelen özgün komut sürüm denetimiyle reddedilir');
});
