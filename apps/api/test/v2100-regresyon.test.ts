/** v2.10.0 üç düzeltmenin ayrı regresyonları (gerçek PostgreSQL + Fastify HTTP). Yalnız v2.9.1'de de var olan uçları kullanır; böylece değiştirilmemiş v2.9.1 üzerinde de koşulabilir.
 * A) ana danışman bütünlüğü (bütün yollar; başarısız işlemde kısmi değişiklik yok)  B) işlem anahtarı ve denetim  C) iki sekme */
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
const PW = 'Parola12345'; const S = 'R' + Date.now().toString(36).toLocaleUpperCase('en-US').slice(-4); const dom = `r${S.toLocaleLowerCase('en-US')}.test`;
const su = () => new pg.Client({ connectionString: config.migrateUrl });
const one = async (sql: string, args: unknown[] = []) => { const c = su(); await c.connect(); try { return (await c.query(sql, args)).rows; } finally { await c.end(); } };
before(async () => { mkdirSync(config.mailDir, { recursive: true }); app = await buildApp(); await api('POST', '/api/platform/bootstrap', { email: 'platform@hpw.test', password: 'Platform12345', setupKey: config.setupKey }); await login('platform@hpw.test', 'root', 'Platform12345'); });
after(async () => { await app.close(); });
const T: Record<string, string> = {};
const mkTenant = async (k: string) => { const r = await api('POST', '/api/platform/tenants', { code: `${k}${S}`, name: `${k} şirketi` }, 'root'); assert.equal(r.status, 200, JSON.stringify(r.body)); T[k] = r.body.id as string; return T[k]!; };
const mkStaff = async (who: string, role: string, tenants: string[] = [], duty?: string) => { const email = `${who}@hpw.${dom}`; const r = await api('POST', '/api/platform/staff', { email, displayName: who, role, tenantIds: tenants, ...(duty ? { duty } : {}), reason: 'v2.9.1 testi' }, 'root'); assert.equal(r.status, 200, JSON.stringify(r.body)); await api('POST', `/api/auth/reset/${mailTokenFor(email, 'parola')}`, { password: PW }); await login(email, who, PW); return r.body.id as string; };
const duties = async (tid: string) => (await one(`SELECT u.display_name AS n, a.duty, a.revoked_at IS NOT NULL AS rev FROM platform_tenant_access a JOIN app_user u ON u.id = a.user_id WHERE a.tenant_id = $1 ORDER BY u.display_name`, [tid])) as { n: string; duty: string; rev: boolean }[];


const snap = async (tid: string) => JSON.stringify(await one(`SELECT user_id, duty, revoked_at IS NOT NULL AS rev, valid_to FROM platform_tenant_access WHERE tenant_id = $1 ORDER BY user_id`, [tid]));
const primaries = async (tid: string) => Number((await one(`SELECT COUNT(*) AS n FROM platform_tenant_access WHERE tenant_id = $1 AND duty = 'primary' AND revoked_at IS NULL`, [tid]))[0].n);

test('A) ana danışman bütünlüğü: devir, doğrudan atama, rol değişimi, görev bitirme ve erişim kaldırma yolları; başarısız işlemde hiçbir atama kısmen değişmez', async () => {
  const Y = await mkTenant('RA'); const P = await mkStaff('anaR', 'consultant', [Y], 'primary'); const Bk = await mkStaff('yedR', 'consultant', [Y], 'backup'); const O = await mkStaff('digerR', 'consultant');
  const before = await snap(Y);
  const bad: [string, () => Promise<{ status: number }>][] = [
    ['mevcut ana danışmana yedek görevinin devri', () => api('POST', `/api/platform/tenants/${Y}/assignments`, { userId: P, duty: 'backup', reason: 'devir denemesi', handoverFrom: Bk }, 'root')],
    ['ana danışmanı doğrudan yedeğe çevirme', () => api('POST', `/api/platform/tenants/${Y}/assignments`, { userId: P, duty: 'backup', reason: 'doğrudan çevirme' }, 'root')],
    ['ana danışmanın rolünü denetçiye düşürme', () => api('PATCH', `/api/platform/staff/${P}`, { role: 'auditor', reason: 'rol düşürme' }, 'root')],
    ['ana danışmanın görevini bitirme', () => api('POST', `/api/platform/tenants/${Y}/assignments/${P}/end`, { reason: 'görev bitirme' }, 'root')],
    ['ana danışmanın erişimini kaldırma', () => api('POST', `/api/platform/staff/${P}/revoke`, { reason: 'ayrıldı' }, 'root')],
  ];
  for (const [label, fn] of bad) { const r = await fn(); assert.ok(r.status >= 400 && r.status < 500, `${label}: reddedilmeli (${r.status})`); assert.equal(await snap(Y), before, `${label}: hiçbir atama kısmen değişmemeli`); assert.equal(await primaries(Y), 1, `${label}: tek ana danışman`); }
  // doğru devir: başka danışmana ana görev → önceki ana danışman yedek olur ya da görevden çıkar; her durumda tek ana danışman
  const ok = await api('POST', `/api/platform/tenants/${Y}/assignments`, { userId: O, duty: 'primary', reason: 'planlı devir', handoverFrom: P }, 'root'); assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(await primaries(Y), 1); const d = await one(`SELECT user_id, duty FROM platform_tenant_access WHERE tenant_id = $1 AND revoked_at IS NULL`, [Y]) as { user_id: string; duty: string }[];
  assert.equal(d.find(x => x.user_id === O)?.duty, 'primary'); assert.notEqual(d.find(x => x.user_id === P)?.duty, 'primary');
});

test('B) işlem anahtarı ve denetim: aynı komut+anahtar tek etki; farklı komut+aynı anahtar iki iz; aynı komut+anahtar farklı içerik çatışma; kullanıcı ve şirket kapsamı ayrı; iz yazılamazsa izsiz başarı yok', async () => {
  const Z = await mkTenant('RB'); const Z2 = await mkTenant('RC');
  const iv = await api('POST', `/api/platform/tenants/${Z}/intervention`, { reason: 'regresyon B işlem anahtarı denetimi yapılıyor', minutes: 15 }, 'root'); assert.equal(iv.status, 200); const iid = iv.body.id as string;
  const sn = (tid: string, key: string, idem: string, until = '2027-03-01T00:00:00Z', who = 'root') => api('POST', `/api/t/${tid}/attention/${encodeURIComponent(key)}/snooze`, { until }, who, { 'idempotency-key': idem });
  const auditN = async (tid: string, key: string) => Number((await one(`SELECT COUNT(*) AS n FROM audit_event WHERE tenant_id = $1 AND entity_type = 'attention_item' AND new_value->>'key' = $2`, [tid, key]))[0].n);
  const k1 = `ayni-komut-${S}`; const r1 = await sn(Z, 'b:tek', k1); const r1b = await sn(Z, 'b:tek', k1); assert.equal(r1.status, 200); assert.equal(r1b.status, 200); assert.deepEqual(r1b.body, r1.body); assert.equal(await auditN(Z, 'b:tek'), 1, 'aynı komut ve anahtar tek iş etkisi');
  const k2 = `ortak-${S}`; assert.equal((await sn(Z, 'b:bir', k2)).status, 200); assert.equal((await sn(Z, 'b:iki', k2)).status, 200);
  assert.equal(await auditN(Z, 'b:bir') + await auditN(Z, 'b:iki'), 2, 'farklı iki komutun iki iş etkisi');
  assert.equal(Number((await one(`SELECT COUNT(*) AS n FROM platform_audit_event WHERE intervention_id = $1 AND action = 'intervention.write'`, [iid]))[0].n), 3, 'üç iş etkisinin üç merkezi izi (ikisi aynı istemci anahtarıyla)');
  const c = await sn(Z, 'b:tek', k1, '2027-09-09T00:00:00Z'); assert.equal(c.status, 409, 'aynı komut ve anahtar farklı içerikle: açık çatışma (' + c.status + ' ' + JSON.stringify(c.body) + ')'); assert.equal(await auditN(Z, 'b:tek'), 1, 'çatışmada ikinci etki yok');
  // şirket kapsamı: aynı anahtar başka şirkette ayrı komuttur
  const iv2 = await api('POST', `/api/platform/tenants/${Z2}/intervention`, { reason: 'regresyon B ikinci şirket kapsam denetimi', minutes: 15 }, 'root'); assert.equal(iv2.status, 200);
  assert.equal((await sn(Z2, 'b:tek', k1)).status, 200); assert.equal(await auditN(Z2, 'b:tek'), 1); assert.equal(await auditN(Z, 'b:tek'), 1, 'başka şirketteki aynı anahtar ilk şirketi etkilemez');
  // iz yazılamazsa izsiz başarı yok
  await one('REVOKE INSERT ON platform_audit_event FROM hpw_app');
  try { const f = await sn(Z, 'b:iz', `iz-${S}`); assert.ok(f.status >= 500, 'iz yazılamayınca başarı dönmez: ' + f.status); } finally { await one('GRANT INSERT ON platform_audit_event TO hpw_app'); }
  assert.equal(await auditN(Z, 'b:iz'), 0, 'iş etkisi geri alındı');
  await api('POST', `/api/platform/interventions/${iid}/end`, {}, 'root'); await api('POST', `/api/platform/interventions/${iv2.body.id}/end`, {}, 'root');
});

test('C) iki sekme: A komutu → başka sekmede B seçilir → A yanıtı kaybolur ve yeniden denenir: A’da ikinci etki yok, B’de değişiklik yok, kayıtlar A bağlamında; yeniden denemede güncel yetki denetlenir', async () => {
  const A = await mkTenant('RD'); const B = await mkTenant('RE');
  const iv = await api('POST', `/api/platform/tenants/${A}/intervention`, { reason: 'regresyon C iki sekme bağlam denetimi', minutes: 15 }, 'root'); assert.equal(iv.status, 200); const iid = iv.body.id as string;
  await api('POST', '/api/auth/switch-tenant', { tenantId: A }, 'root');
  const k = `iki-sekme-${S}`; const cmd = () => api('POST', `/api/t/${A}/attention/${encodeURIComponent('c:komut')}/snooze`, { until: '2027-04-01T00:00:00Z' }, 'root', { 'idempotency-key': k });
  const r1 = await cmd(); assert.equal(r1.status, 200);
  await api('POST', '/api/auth/switch-tenant', { tenantId: B }, 'root'); // ikinci sekme B'yi seçti (oturumun seçili şirketi değişti)
  const r2 = await cmd(); assert.equal(r2.status, 200); assert.deepEqual(r2.body, r1.body, 'yanıt kaybı sonrası yeniden deneme aynı sonucu döner');
  const cnt = async (tid: string) => Number((await one(`SELECT COUNT(*) AS n FROM audit_event WHERE tenant_id = $1 AND entity_type = 'attention_item' AND new_value->>'key' = 'c:komut'`, [tid]))[0].n);
  assert.equal(await cnt(A), 1, 'A’da ikinci iş etkisi yok'); assert.equal(await cnt(B), 0, 'B’de değişiklik yok');
  assert.equal(Number((await one(`SELECT COUNT(*) AS n FROM platform_audit_event WHERE intervention_id = $1 AND tenant_id = $2 AND action = 'intervention.write'`, [iid, A]))[0].n), 1, 'merkezi iz A bağlamında ve tek');
  // güncel yetki: müdahale bitince aynı komutun yeniden denemesi eski yetkiyle sonuç döndürmez
  await api('POST', `/api/platform/interventions/${iid}/end`, {}, 'root'); const r3 = await cmd(); assert.equal(r3.status, 403, 'yetki düştükten sonra yeniden deneme reddedilir (' + r3.status + ')');
});
