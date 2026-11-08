/** Kalıcı başarısız davet ortak tanımı (gerçek PostgreSQL + Fastify HTTP). Yalnız v2.10.2'de de var olan uçları (portföy, şirket detayı) kullanır; v2.10.2 üzerinde önce/sonra kanıtı için koşulabilir. */
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
const PW = 'Parola12345'; const S = 'D' + Date.now().toString(36).toLocaleUpperCase('en-US').slice(-4); const dom = `d${S.toLocaleLowerCase('en-US')}.test`;
const su = () => new pg.Client({ connectionString: config.migrateUrl });
const one = async (sql: string, args: unknown[] = []) => { const c = su(); await c.connect(); try { return (await c.query(sql, args)).rows; } finally { await c.end(); } };
before(async () => { mkdirSync(config.mailDir, { recursive: true }); app = await buildApp(); await api('POST', '/api/platform/bootstrap', { email: 'platform@hpw.test', password: 'Platform12345', setupKey: config.setupKey }); await login('platform@hpw.test', 'root', 'Platform12345'); });
after(async () => { await app.close(); });
const T: Record<string, string> = {};
const mkTenant = async (k: string) => { const r = await api('POST', '/api/platform/tenants', { code: `${k}${S}`, name: `${k} şirketi` }, 'root'); assert.equal(r.status, 200, JSON.stringify(r.body)); T[k] = r.body.id as string; return T[k]!; };
const mkStaff = async (who: string, role: string, tenants: string[] = [], duty?: string) => { const email = `${who}@hpw.${dom}`; const r = await api('POST', '/api/platform/staff', { email, displayName: who, role, tenantIds: tenants, ...(duty ? { duty } : {}), reason: 'v2.9.1 testi' }, 'root'); assert.equal(r.status, 200, JSON.stringify(r.body)); await api('POST', `/api/auth/reset/${mailTokenFor(email, 'parola')}`, { password: PW }); await login(email, who, PW); return r.body.id as string; };
const duties = async (tid: string) => (await one(`SELECT u.display_name AS n, a.duty, a.revoked_at IS NOT NULL AS rev FROM platform_tenant_access a JOIN app_user u ON u.id = a.user_id WHERE a.tenant_id = $1 ORDER BY u.display_name`, [tid])) as { n: string; duty: string; rev: boolean }[];



const inviteOf = async (tid: string) => (await one(`SELECT i.id FROM invitation i JOIN membership m ON m.id = i.membership_id WHERE m.tenant_id = $1 ORDER BY i.created_at DESC LIMIT 1`, [tid]))[0].id as string;
const addDelivery = (tid: string, inv: string, status: string, ago: string) => one(`INSERT INTO email_outbox (tenant_id, invitation_id, to_email, subject, body_text, status, created_at) VALUES ($1,$2,'ornek@x.test','davet','davet',$3, now() - $4::interval)`, [tid, inv, status, ago]);
const failed = async (tid: string) => { const pf = (await api('GET', '/api/platform/portfolio', undefined, 'root')).body as unknown as { items: { id: string; summary: { counts: { failedInvites: number } } | null }[] }; return pf.items.find(i => i.id === tid)!.summary!.counts.failedInvites; };
const adminStep = async (tid: string) => { const d = (await api('GET', `/api/platform/tenants/${tid}`, undefined, 'root')).body as unknown as { onboarding: { steps: { key: string; state: string }[] } }; return d.onboarding.steps.find(s => s.key === 'customer_admin')!.state; };
test('Kalıcı başarısız davet ortak tanımı: tekrar denemeler şişirmez; sonraki başarı/kabul/iptal/süre dolması eski hatayı gölgelemez; başka şirketin kaydı girmez; portföy ve kurulum aynı tanımı kullanır', async () => {
  const r = await api('POST', '/api/platform/tenants', { code: `DV${S}`, name: 'Davet', adminEmail: `ik@dv.${dom}`, adminName: 'İK' }, 'root'); assert.equal(r.status, 200); const T = r.body.id as string; const O = await mkTenant('DO');
  const inv = await inviteOf(T); await one(`DELETE FROM email_outbox WHERE invitation_id = $1`, [inv]);
  for (const ago of ['3 hours', '2 hours', '1 hour']) await addDelivery(T, inv, 'perm_fail', ago);
  assert.equal(await failed(T), 1, 'aynı davetin üç kalıcı hatası tek sayılır'); assert.equal(await adminStep(T), 'blocked', 'kurulum aynı tanımla engelli');
  // sonradan başarılı teslim: güncel müdahale sayacı 1 → 0; geçmiş teslimat hataları kayıtlarda korunur
  const before = await failed(T); await addDelivery(T, inv, 'sent', '10 minutes'); const after = await failed(T);
  assert.deepEqual([before, after], [1, 0], 'başarılı teslim sonrası güncel sayaçta kalmaz (önce 1, sonra 0)'); assert.equal(await adminStep(T), 'in_progress');
  assert.equal(Number((await one(`SELECT COUNT(*) AS n FROM email_outbox WHERE invitation_id = $1 AND status = 'perm_fail'`, [inv]))[0].n), 3, 'geçmiş teslimat hataları korunur');
  await addDelivery(T, inv, 'perm_fail', '1 minute'); assert.equal(await failed(T), 1, 'en son deneme yeniden kalıcı hata');
  await one(`UPDATE invitation SET status = 'revoked' WHERE id = $1`, [inv]); assert.equal(await failed(T), 0, 'iptal edilen davet sayılmaz');
  await one(`UPDATE invitation SET status = 'expired' WHERE id = $1`, [inv]); assert.equal(await failed(T), 0, 'süresi dolan davet teslimat hatası değildir'); assert.equal(await adminStep(T), 'blocked', 'süresi dolan yönetici daveti kurulumda engel');
  await one(`UPDATE invitation SET status = 'ready' WHERE id = $1`, [inv]); assert.equal(await failed(T), 1, 'süresi dolma geri alınınca en son deneme yine kalıcı hata (1)');
  await one(`UPDATE invitation SET status = 'accepted' WHERE id = $1`, [inv]); assert.equal(await failed(T), 0, 'kabul edilen davet güncel sayaçta kalmaz (1 → 0)');
  await one(`UPDATE invitation SET status = 'ready' WHERE id = $1`, [inv]); await one(`DELETE FROM email_outbox WHERE invitation_id = $1`, [inv]); await addDelivery(T, inv, 'sent', '5 minutes');
  await one(`INSERT INTO email_outbox (tenant_id, invitation_id, to_email, subject, body_text, status) VALUES ($1,$2,'x@x.test','x','x','perm_fail')`, [O, inv]);
  assert.equal(await failed(T), 0, 'başka şirkete ait teslimat kaydı hesaba girmez'); assert.equal(await failed(O), 0);
});
