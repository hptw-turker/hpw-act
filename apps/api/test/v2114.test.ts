/** v2.11.4 (V2113-A01/A02) komut sonucu sorgusu (gerçek PostgreSQL + Fastify HTTP): kanıt komut kimliğine (kullanıcı + işlem anahtarı) bağlı; başka kullanıcının anahtarı ve bilinmeyen anahtar not_found; erişimi kalkan kullanıcı sonucu göremez; başka aktörün aynı duruma geçirmesi komut kaydı üretmez. */
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
const PW = 'Parola12345'; const S = 'F' + Date.now().toString(36).toLocaleUpperCase('en-US').slice(-4); const dom = `f${S.toLocaleLowerCase('en-US')}.test`;
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
test('Komut sonucu: kaydedilen komut applied (iş/işlem yolu ve yanıtıyla); bilinmeyen anahtar not_found; başka kullanıcının anahtarı görünmez', async () => {
  const T = await tenantWithFailedInvite('ZA'); const w = (await item(T, 'invite_failed'))!; const key = `k-own-${S}`;
  const r = await act(w.id, 'snooze', { expectedVersion: w.version, reason: 'kendi komutum', until: new Date(Date.now() + 3 * 86400000).toISOString() }, 'root', key); assert.equal(r.status, 200);
  const o = await outcome(key); assert.equal(o.status, 200); const b = o.body as unknown as { status: string; route: string; tenantId: string; response: { workItem: { state: string } } };
  assert.equal(b.status, 'applied'); assert.equal(b.route, `POST /work-items/${w.id}/snooze`); assert.equal(b.tenantId, T); assert.equal(b.response.workItem.state, 'snoozed');
  const n = await outcome(`k-yok-${S}`); assert.equal(n.status, 200); assert.equal((n.body as unknown as { status: string }).status, 'not_found');
  await mkStaff('zaDan', 'consultant', [T], 'backup'); const other = await outcome(key, 'zaDan'); assert.equal(other.status, 200); assert.equal((other.body as unknown as { status: string }).status, 'not_found', 'anahtar kullanıcıya bağlı');
});
test('Başka aktör aynı duruma geçirirse kullanıcının anahtarı için komut kaydı yok (not_found); erişimi kalkınca sonuç görünmez (404 command_not_visible)', async () => {
  const T = await tenantWithFailedInvite('ZB'); await mkStaff('zbYed', 'consultant', [T], 'backup'); let w = (await item(T, 'invite_failed'))!;
  // kullanıcının komutu hiç ulaşmadı (anahtar üretildi ama gönderilmedi); başka aktör (root) aynı işlemi farklı gerekçeyle yaptı
  const mine = `k-benim-${S}`; assert.equal((await act(w.id, 'dismiss', { expectedVersion: w.version, reason: 'başka yöneticinin gerekçesi', until: new Date(Date.now() + 5 * 86400000).toISOString() }, 'root', `k-root-${S}`)).status, 200);
  w = (await item(T, 'invite_failed'))!; assert.equal(w.state, 'dismissed');
  const o = await outcome(mine, 'zbYed'); assert.equal((o.body as unknown as { status: string }).status, 'not_found', 'aynı durum komut kanıtı değildir');
  // yedek danışman kendi komutunu kaydeder; sonra ataması biter → sonuç görünmez
  const T2 = await tenantWithFailedInvite('ZC'); await mkStaff('zcYed', 'consultant', [T2], 'backup'); const w2 = (await item(T2, 'invite_failed'))!; const k2 = `k-yed-${S}`;
  assert.equal((await act(w2.id, 'claim', { expectedVersion: w2.version }, 'zcYed', k2)).status, 200); assert.equal(((await outcome(k2, 'zcYed')).body as unknown as { status: string }).status, 'applied');
  const uid = (await one(`SELECT id FROM app_user WHERE email = $1`, [`zcYed@hpw.${dom}`]))[0].id as string; assert.equal((await api('POST', `/api/platform/tenants/${T2}/assignments/${uid}/end`, { reason: 'görev bitti' }, 'root')).status, 200);
  const gone = await outcome(k2, 'zcYed'); assert.equal(gone.status, 404); assert.equal((gone.body as unknown as { error: string }).error, 'command_not_visible');
});
