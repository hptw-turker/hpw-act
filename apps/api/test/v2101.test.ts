/** v2.10.1 V210-02 (gerçek PostgreSQL + Fastify HTTP): müşteri teyidi merkezle aynı geçerlilik hesabını kullanır; kaynak değişimleri (hizmet kaydı, sonuç partisi, erişim, izlenen dönem) ve iki bağlantılı yarışlar. */
import { ensureMfa, submitFresh, secretFor } from './mfa-helper.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
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
const PW = 'Parola12345'; const S = 'Y' + Date.now().toString(36).toLocaleUpperCase('en-US').slice(-4); const dom = `y${S.toLocaleLowerCase('en-US')}.test`;
const su = () => new pg.Client({ connectionString: config.migrateUrl });
const one = async (sql: string, args: unknown[] = []) => { const c = su(); await c.connect(); try { return (await c.query(sql, args)).rows; } finally { await c.end(); } };
before(async () => { mkdirSync(config.mailDir, { recursive: true }); app = await buildApp(); await api('POST', '/api/platform/bootstrap', { email: 'platform@hpw.test', password: 'Platform12345', setupKey: config.setupKey }); await login('platform@hpw.test', 'root', 'Platform12345'); });
after(async () => { await app.close(); });
const T: Record<string, string> = {};
const mkTenant = async (k: string) => { const r = await api('POST', '/api/platform/tenants', { code: `${k}${S}`, name: `${k} şirketi` }, 'root'); assert.equal(r.status, 200, JSON.stringify(r.body)); T[k] = r.body.id as string; return T[k]!; };
const mkStaff = async (who: string, role: string, tenants: string[] = [], duty?: string) => { const email = `${who}@hpw.${dom}`; const r = await api('POST', '/api/platform/staff', { email, displayName: who, role, tenantIds: tenants, ...(duty ? { duty } : {}), reason: 'v2.9.1 testi' }, 'root'); assert.equal(r.status, 200, JSON.stringify(r.body)); await api('POST', `/api/auth/reset/${mailTokenFor(email, 'parola')}`, { password: PW }); await login(email, who, PW); return r.body.id as string; };
const duties = async (tid: string) => (await one(`SELECT u.display_name AS n, a.duty, a.revoked_at IS NOT NULL AS rev FROM platform_tenant_access a JOIN app_user u ON u.id = a.user_id WHERE a.tenant_id = $1 ORDER BY u.display_name`, [tid])) as { n: string; duty: string; rev: boolean }[];


const accept = async (email: string, who: string) => { const r = await api('POST', `/api/invitations/${mailTokenFor(email, 'davet')}/accept`, { password: PW }); assert.equal(r.status, 200, JSON.stringify(r.body)); cookies[who] = cookieOf(r.res); };
const detail = async (tid: string, who = 'root') => { const r = await api('GET', `/api/platform/tenants/${tid}`, undefined, who); return r; };
type Det = { tenant: { ops_version: number; tracked_cycle_id: string | null; status: string }; onboarding: { steps: { key: string; state: string; blockedBy: string | null; facts: Record<string, unknown> }[]; summary: { done: number; total: number }; fingerprints: { service_record: string | null; go_live: string } } };
const st = (d: Det, k: string) => d.onboarding.steps.find(s => s.key === k)!.state;


type CG = { state: string; fingerprint: string | null; awaitingCustomer: boolean; customerConfirmedAt: string | null; hpwApprovedAt: string | null };
const cget = async (tid: string, who: string) => (await api('GET', `/api/t/${tid}/onboarding/go-live`, undefined, who)).body as unknown as CG;
const confirmN = async (tid: string) => Number((await one(`SELECT COUNT(*) AS n FROM onboarding_approval WHERE tenant_id = $1 AND step_key = 'go_live_customer'`, [tid]))[0].n);
const auditN = async (tid: string) => Number((await one(`SELECT COUNT(*) AS n FROM audit_event WHERE tenant_id = $1 AND action = 'go_live_customer_confirm'`, [tid]))[0].n);
let G = ''; let cyc = ''; let hr = '';
async function readyTenant() {
  const cand = await one(`SELECT c.tenant_id, c.id FROM survey_cycle c JOIN tenant t ON t.id = c.tenant_id AND t.status = 'active' JOIN platform_tenant_access a ON a.tenant_id = c.tenant_id AND a.revoked_at IS NULL JOIN app_user u ON u.id = a.user_id AND u.email = 'platform@hpw.test' WHERE c.active_batch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM onboarding_approval o WHERE o.tenant_id = c.tenant_id AND o.step_key = 'go_live') ORDER BY c.tenant_id LIMIT 20`) as { tenant_id: string; id: string }[];
  for (const r of cand) { const d = (await detail(r.tenant_id)).body as unknown as Det; if (['customer_admin', 'user_access', 'organization', 'instrument'].every(k => st(d, k) === 'done')) { G = r.tenant_id; cyc = r.id; break; } }
  assert.ok(G, 'tam kurulmuş şirket bulunamadı');
  let d = (await detail(G)).body as unknown as Det;
  assert.equal((await api('PATCH', `/api/platform/tenants/${G}/tracked-cycle`, { cycleId: cyc, expectedVersion: d.tenant.ops_version }, 'root')).status, 200);
  d = (await detail(G)).body as unknown as Det; await api('POST', `/api/platform/tenants/${G}/service-record`, { ref: 'HS-Y', scope: 'kapsam', owners: 'sorumlular', retentionPolicyRef: 'SP-Y', expectedVersion: d.tenant.ops_version }, 'root');
  d = (await detail(G)).body as unknown as Det; await api('POST', `/api/platform/tenants/${G}/onboarding/service_record/approve`, { reason: 'kontrol', expectedVersion: d.tenant.ops_version, expectedFingerprint: d.onboarding.fingerprints.service_record }, 'root');
  if (st((await detail(G)).body as unknown as Det, 'hpw_owner') !== 'done') await mkStaff('anaY1', 'consultant', [G], 'primary');
  const email = `ik@y.${dom}`; await api('POST', `/api/platform/tenants/${G}/admin-invite`, { email, displayName: 'Y İK' }, 'root'); await api('POST', `/api/t/${G}/invitations/send`, {}, 'root'); await accept(email, 'ikY'); hr = 'ikY';
}
const approve = async () => { const d = (await detail(G)).body as unknown as Det; const r = await api('POST', `/api/platform/tenants/${G}/onboarding/go_live/approve`, { reason: 'açılış onayı', expectedVersion: d.tenant.ops_version, expectedFingerprint: d.onboarding.fingerprints.go_live }, 'root'); assert.equal(r.status, 200, JSON.stringify(r.body)); };
const both = async () => ({ central: st((await detail(G)).body as unknown as Det, 'go_live'), customer: await cget(G, hr) });

test('V210-02 kaynak değişimleri: merkez ve müşteri aynı durumu gösterir; geçerliliğini yitirmiş onay teyide açık sunulmaz ve teyit edilemez (409, iz yok)', async () => {
  await readyTenant(); await approve();
  let b = await both(); assert.equal(b.central, 'in_progress'); assert.equal(b.customer.state, 'in_progress'); assert.equal(b.customer.awaitingCustomer, true); const F1 = b.customer.fingerprint!; assert.ok(F1);
  const stale = async (label: string) => { const x = await both(); assert.equal(x.central, 'recheck', label + ': merkez'); assert.equal(x.customer.state, 'recheck', label + ': müşteri merkezle aynı'); assert.equal(x.customer.awaitingCustomer, false, label); assert.equal(x.customer.fingerprint, null, label + ': eski onay güncelmiş gibi sunulmaz'); assert.equal(x.customer.customerConfirmedAt, null, label);
    const n0 = await confirmN(G), a0 = await auditN(G); const r = await api('POST', `/api/t/${G}/onboarding/go-live/confirm`, { reason: 'eski onayı teyit denemesi', expectedFingerprint: F1 }, hr); assert.equal(r.status, 409, label + ': ' + JSON.stringify(r.body)); assert.equal(r.body.error, 'evidence_changed'); assert.equal(await confirmN(G), n0, label + ': teyit kaydı oluşmaz'); assert.equal(await auditN(G), a0, label + ': iz oluşmaz'); };
  // 1) hizmet kaydı değişir
  let d = (await detail(G)).body as unknown as Det; await api('POST', `/api/platform/tenants/${G}/service-record`, { ref: 'HS-Y', scope: 'kapsam değişti', owners: 'sorumlular', retentionPolicyRef: 'SP-Y', expectedVersion: d.tenant.ops_version }, 'root'); await stale('hizmet kaydı');
  d = (await detail(G)).body as unknown as Det; await api('POST', `/api/platform/tenants/${G}/service-record`, { ref: 'HS-Y', scope: 'kapsam', owners: 'sorumlular', retentionPolicyRef: 'SP-Y', expectedVersion: d.tenant.ops_version }, 'root');
  b = await both(); assert.equal(b.central, 'in_progress', 'kaynak onay anındaki haline döndü'); assert.equal(b.customer.fingerprint, F1);
  // 2) sonuç partisi değişir (yayım geri alınır) → önkoşul da bozulur
  const batch = (await one('SELECT active_batch_id FROM survey_cycle WHERE id = $1', [cyc]))[0].active_batch_id; await one('UPDATE survey_cycle SET active_batch_id = NULL WHERE id = $1', [cyc]); await stale('sonuç partisi'); await one('UPDATE survey_cycle SET active_batch_id = $2 WHERE id = $1', [cyc, batch]);
  // 3) izlenen dönem kaldırılır
  d = (await detail(G)).body as unknown as Det; await api('PATCH', `/api/platform/tenants/${G}/tracked-cycle`, { cycleId: null, expectedVersion: d.tenant.ops_version }, 'root'); await stale('izlenen dönem');
  d = (await detail(G)).body as unknown as Det; await api('PATCH', `/api/platform/tenants/${G}/tracked-cycle`, { cycleId: cyc, expectedVersion: d.tenant.ops_version }, 'root'); assert.equal((await both()).customer.state, 'in_progress');
  // 4) gerekli erişim değişir: ana danışman devredilir
  const prim = (await one(`SELECT user_id FROM platform_tenant_access WHERE tenant_id = $1 AND duty = 'primary' AND revoked_at IS NULL`, [G]))[0].user_id as string; const yeni = await mkStaff('anaY2', 'consultant');
  assert.equal((await api('POST', `/api/platform/tenants/${G}/assignments`, { userId: yeni, duty: 'primary', reason: 'devir', handoverFrom: prim }, 'root')).status, 200); await stale('ana danışman');
  // HPW yeniden onaylar → yeni parmak izi; müşteri yeni onayı teyit eder → iki alan da tamamlandı
  await approve(); b = await both(); assert.equal(b.customer.state, 'in_progress'); const F2 = b.customer.fingerprint!; assert.notEqual(F2, F1);
  assert.equal((await api('POST', `/api/t/${G}/onboarding/go-live/confirm`, { reason: 'eski onay', expectedFingerprint: F1 }, hr)).status, 409);
  assert.equal((await api('POST', `/api/t/${G}/onboarding/go-live/confirm`, { reason: 'yeni onay teyit edildi', expectedFingerprint: F2 }, hr)).status, 200);
  b = await both(); assert.equal(b.central, 'done'); assert.equal(b.customer.state, 'done'); assert.ok(b.customer.customerConfirmedAt);
});

test('V210-02 iki bağlantılı yarışlar: (a) kaynak değişimi sürerken teyit bekler ve sonra 409; (b) HPW yeniden onayı ile eski parmak izli teyit aynı anda — teyit reddedilir, iki alan tutarlı', async () => {
  // başlangıç: geçerli onay + teyit bekleniyor (önceki testte done oldu; kaynağı değiştirip yeniden onaylayarak bekleme durumuna getir)
  let d = (await detail(G)).body as unknown as Det; await api('POST', `/api/platform/tenants/${G}/service-record`, { ref: 'HS-Y2', scope: 'kapsam', owners: 'sorumlular', retentionPolicyRef: 'SP-Y', expectedVersion: d.tenant.ops_version }, 'root');
  d = (await detail(G)).body as unknown as Det; await api('POST', `/api/platform/tenants/${G}/onboarding/service_record/approve`, { reason: 'kontrol', expectedVersion: d.tenant.ops_version, expectedFingerprint: d.onboarding.fingerprints.service_record }, 'root'); await approve();
  let c = await cget(G, hr); assert.equal(c.state, 'in_progress'); const F = c.fingerprint!;
  // (a) C1 şirket kaydını değiştiren transaction'ı açık tutar; müşteri teyidi şirket satırındaki paylaşımlı kilitte bekler; C1 bitince güncel kanıtı görür → 409
  const c1 = su(); await c1.connect(); await c1.query('BEGIN'); await c1.query(`UPDATE tenant SET service_record = jsonb_set(service_record, '{scope}', '"yarış"') WHERE id = $1`, [G]);
  let done = false; const pr = api('POST', `/api/t/${G}/onboarding/go-live/confirm`, { reason: 'yarışta teyit', expectedFingerprint: F }, hr).then(r => { done = true; return r; });
  await new Promise(r => setTimeout(r, 700)); assert.equal(done, false, 'teyit, süren kaynak değişikliğini bekler'); await c1.query('COMMIT'); await c1.end();
  const ra = await pr; assert.equal(ra.status, 409, JSON.stringify(ra.body)); let b = await both(); assert.equal(b.central, 'recheck'); assert.equal(b.customer.state, 'recheck');
  // (b) kaynak zaten değişti; HPW yeni kanıtı onaylarken müşteri eski parmak iziyle teyit gönderir. İkisi de C1'in tuttuğu şirket satırı kilidinde bekler, sonra hangi sırayla koşarsa koşsun teyit reddedilir
  d = (await detail(G)).body as unknown as Det; await api('POST', `/api/platform/tenants/${G}/onboarding/service_record/approve`, { reason: 'kontrol', expectedVersion: d.tenant.ops_version, expectedFingerprint: d.onboarding.fingerprints.service_record }, 'root');
  d = (await detail(G)).body as unknown as Det;
  const c2 = su(); await c2.connect(); await c2.query('BEGIN'); await c2.query('SELECT 1 FROM tenant WHERE id = $1 FOR UPDATE', [G]);
  const pa = api('POST', `/api/platform/tenants/${G}/onboarding/go_live/approve`, { reason: 'yarışta yeniden onay', expectedVersion: d.tenant.ops_version, expectedFingerprint: d.onboarding.fingerprints.go_live }, 'root');
  const pc = api('POST', `/api/t/${G}/onboarding/go-live/confirm`, { reason: 'eski parmak iziyle yarış', expectedFingerprint: F }, hr);
  await new Promise(r => setTimeout(r, 500)); await c2.query('COMMIT'); await c2.end();
  const [xa, xc] = await Promise.all([pa, pc]); assert.equal(xa.status, 200, JSON.stringify(xa.body)); assert.equal(xc.status, 409, 'eski parmak izli teyit her sırada reddedilir: ' + JSON.stringify(xc.body));
  b = await both(); assert.equal(b.central, 'in_progress'); assert.equal(b.customer.state, 'in_progress'); assert.equal(b.customer.awaitingCustomer, true); assert.notEqual(b.customer.fingerprint, F);
});

test('V2101-02 makbuz zinciri: başarılı teyit → aynı anahtarlı tekrar aynı sonucu döndürür (ikinci etki yok) → farklı içerik çatışma → güncel yetki kaybında tekrar reddedilir', async () => {
  let c = await cget(G, hr); assert.equal(c.state, 'in_progress', 'önceki test teyit bekleme durumunda bırakır'); const F = c.fingerprint!;
  const n0 = await confirmN(G), a0 = await auditN(G); const key = `makbuz-${S}`; const body = { reason: 'makbuz zinciri teyidi', expectedFingerprint: F };
  const r1 = await api('POST', `/api/t/${G}/onboarding/go-live/confirm`, body, hr, { 'idempotency-key': key }); assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.equal(await confirmN(G), n0 + 1); assert.equal(await auditN(G), a0 + 1);
  // yanıt kayboldu: aynı gövde + aynı anahtar → saklanan makbuz; iş yeniden yapılmaz
  const r2 = await api('POST', `/api/t/${G}/onboarding/go-live/confirm`, body, hr, { 'idempotency-key': key }); assert.equal(r2.status, 200, 'makbuz tekrarı: ' + JSON.stringify(r2.body)); assert.deepEqual(r2.body, r1.body);
  assert.equal(await confirmN(G), n0 + 1, 'ikinci teyit kaydı yok'); assert.equal(await auditN(G), a0 + 1, 'ikinci iz yok');
  c = await cget(G, hr); assert.equal(c.state, 'done'); assert.ok(c.customerConfirmedAt); assert.equal(st((await detail(G)).body as unknown as Det, 'go_live'), 'done', 'merkez aynı sonucu gösterir');
  // aynı anahtar, farklı içerik → açık çatışma
  const r3 = await api('POST', `/api/t/${G}/onboarding/go-live/confirm`, { ...body, reason: 'farklı gerekçe' }, hr, { 'idempotency-key': key }); assert.equal(r3.status, 409, JSON.stringify(r3.body));
  // güncel yetki kaybı: İK yöneticisi profili geri alınır → aynı anahtarlı tekrar eski makbuzu döndürmez
  const mem = (await one(`SELECT m.id, m.permission_profile FROM membership m JOIN app_user u ON u.id = m.user_id WHERE m.tenant_id = $1 AND u.email = $2`, [G, `ik@y.${dom}`]))[0] as { id: string; permission_profile: string };
  await one(`UPDATE membership SET permission_profile = 'HR_PARTNER' WHERE id = $1`, [mem.id]);
  try { const r4 = await api('POST', `/api/t/${G}/onboarding/go-live/confirm`, body, hr, { 'idempotency-key': key }); assert.equal(r4.status, 403, 'yetki düştükten sonra makbuz tekrarı reddedilir: ' + JSON.stringify(r4.body)); }
  finally { await one(`UPDATE membership SET permission_profile = $2 WHERE id = $1`, [mem.id, mem.permission_profile]); }
  assert.equal(await confirmN(G), n0 + 1); assert.equal(await auditN(G), a0 + 1);
});
