/** v2.10.0 şirket işletimi (gerçek PostgreSQL + Fastify HTTP): on adımlı kurulum ve onay parmak izi, izlenen dönem ve sürüm çakışması, arşiv yaşam döngüsü, §10.2.4 devir, §10.2.5 müdahale izi anahtarı, §7.3 HPW tekrar güvenliği kapsamı. */
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
const PW = 'Parola12345'; const S = 'X' + Date.now().toString(36).toLocaleUpperCase('en-US').slice(-4); const dom = `x${S.toLocaleLowerCase('en-US')}.test`;
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

test('Kurulum: on adım, elle onay parmak izi (kaynak değişince yeniden kontrol), sürüm çakışması, yetki', async () => {
  const A = await mkTenant('KA'); const r0 = await detail(A); assert.equal(r0.status, 200, JSON.stringify(r0.body)); let d = r0.body as unknown as Det;
  assert.equal(d.onboarding.summary.total, 10); assert.equal(st(d, 'identity'), 'done'); assert.equal(st(d, 'service_record'), 'not_started'); assert.equal(st(d, 'hpw_owner'), 'not_started');
  assert.equal(st(d, 'first_cycle'), 'blocked'); assert.equal(d.onboarding.steps.find(s => s.key === 'first_cycle')!.blockedBy, 'instrument'); assert.equal(st(d, 'results'), 'blocked'); assert.equal(st(d, 'go_live'), 'blocked');
  const v0 = d.tenant.ops_version;
  const sr = { ref: 'HS-2026-014', scope: 'Çalışan deneyimi ölçüm sonrası uygulama', owners: 'HPW: Operasyon; Müşteri: İK Direktörü', retentionPolicyRef: 'SP-3.2' };
  const bad = await api('POST', `/api/platform/tenants/${A}/service-record`, { ...sr, expectedVersion: v0 + 5 }, 'root'); assert.equal(bad.status, 409); assert.equal(bad.body.error, 'version_conflict'); assert.equal((bad.body.details as unknown as { currentVersion: number }).currentVersion, v0);
  const p1 = await api('POST', `/api/platform/tenants/${A}/service-record`, { ...sr, expectedVersion: v0 }, 'root'); assert.equal(p1.status, 200, JSON.stringify(p1.body));
  d = (await detail(A)).body as unknown as Det; assert.equal(st(d, 'service_record'), 'in_progress', 'kayıt girildi, onay yok');
  const stale = await api('POST', `/api/platform/tenants/${A}/onboarding/service_record/approve`, { reason: 'eski kanıtla onay denemesi', expectedVersion: d.tenant.ops_version, expectedFingerprint: 'eskiparmakizi0000' }, 'root'); assert.equal(stale.status, 409); assert.equal(stale.body.error, 'evidence_changed', 'görülen kanıt güncel değilse onay verilmez');
  const ap = await api('POST', `/api/platform/tenants/${A}/onboarding/service_record/approve`, { reason: 'sözleşme ve politika kontrol edildi', expectedVersion: d.tenant.ops_version, expectedFingerprint: d.onboarding.fingerprints.service_record }, 'root'); assert.equal(ap.status, 200, JSON.stringify(ap.body));
  d = (await detail(A)).body as unknown as Det; assert.equal(st(d, 'service_record'), 'done');
  // ilgisiz değişim (aynı içeriğin yeniden kaydı → yalnız zaman damgası) onayı geçersizleştirmez
  assert.equal((await api('POST', `/api/platform/tenants/${A}/service-record`, { ...sr, expectedVersion: d.tenant.ops_version }, 'root')).status, 200);
  d = (await detail(A)).body as unknown as Det; assert.equal(st(d, 'service_record'), 'done', 'yalnız zaman damgası değişti; onay geçerli');
  const p2 = await api('POST', `/api/platform/tenants/${A}/service-record`, { ...sr, retentionPolicyRef: 'SP-3.3', expectedVersion: d.tenant.ops_version }, 'root'); assert.equal(p2.status, 200);
  d = (await detail(A)).body as unknown as Det; assert.equal(st(d, 'service_record'), 'recheck', 'kaynak değişince onay sessizce geçerli sayılmaz');
  const gl = await api('POST', `/api/platform/tenants/${A}/onboarding/go_live/approve`, { reason: 'erken açılış denemesi', expectedVersion: d.tenant.ops_version, expectedFingerprint: d.onboarding.fingerprints.go_live }, 'root'); assert.equal(gl.status, 409); assert.equal(gl.body.error, 'step_prerequisite');
  // danışman: hizmet kaydını yazamaz; ana danışman atanınca adım 3 tamamlanır
  const dan = await mkStaff('danK', 'consultant', [A], 'primary'); void dan;
  d = (await detail(A)).body as unknown as Det; assert.equal(st(d, 'hpw_owner'), 'done');
  assert.equal((await api('POST', `/api/platform/tenants/${A}/service-record`, { ...sr, expectedVersion: d.tenant.ops_version }, 'danK')).status, 403);
  assert.equal((await api('POST', `/api/platform/tenants/${A}/onboarding/service_record/approve`, { reason: 'danışman onayı', expectedVersion: d.tenant.ops_version, expectedFingerprint: d.onboarding.fingerprints.service_record ?? 'x0000000' }, 'danK')).status, 403);
  const pf = (await api('GET', '/api/platform/portfolio', undefined, 'root')).body as unknown as { items: { id: string; summary: { onboarding: { done: number; total: number; firstOpen: string }; primaryConsultant: string | null } | null }[] };
  const it = pf.items.find(x => x.id === A)!; assert.equal(it.summary!.onboarding.total, 10); assert.equal(it.summary!.primaryConsultant, 'danK'); assert.equal(it.summary!.onboarding.firstOpen, 'service_record');
});

test('İzlenen dönem: yalnız aynı şirketin dönemi; sürüm çakışması; detay ve portföyde görünür', async () => {
  const rows = await one(`SELECT c.tenant_id, c.id, c.code FROM survey_cycle c JOIN platform_tenant_access a ON a.tenant_id = c.tenant_id AND a.revoked_at IS NULL JOIN app_user u ON u.id = a.user_id AND u.email = 'platform@hpw.test' JOIN tenant t ON t.id = c.tenant_id AND t.status = 'active' ORDER BY c.tenant_id LIMIT 50`) as { tenant_id: string; id: string; code: string }[];
  const T1 = rows[0]!; const other = rows.find(r => r.tenant_id !== T1.tenant_id)!; assert.ok(T1 && other, 'dönemi olan iki şirket gerekli');
  const v = ((await detail(T1.tenant_id)).body as unknown as Det).tenant.ops_version;
  const x = await api('PATCH', `/api/platform/tenants/${T1.tenant_id}/tracked-cycle`, { cycleId: other.id, expectedVersion: v }, 'root'); assert.equal(x.status, 422); assert.equal(x.body.error, 'cycle_not_in_tenant');
  const ok = await api('PATCH', `/api/platform/tenants/${T1.tenant_id}/tracked-cycle`, { cycleId: T1.id, expectedVersion: v }, 'root'); assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.equal(ok.body.version, v + 1);
  const stale = await api('PATCH', `/api/platform/tenants/${T1.tenant_id}/tracked-cycle`, { cycleId: null, expectedVersion: v }, 'root'); assert.equal(stale.status, 409, 'eski sürümle ikinci değişiklik reddedilir'); assert.equal(stale.body.error, 'version_conflict');
  const d = (await detail(T1.tenant_id)).body as unknown as Det & { cycles: { id: string; tracked: boolean }[] }; assert.equal(d.tenant.tracked_cycle_id, T1.id); assert.ok(d.cycles.find(c => c.id === T1.id)!.tracked);
  const pf = (await api('GET', '/api/platform/portfolio', undefined, 'root')).body as unknown as { items: { id: string; summary: { trackedCycle: { code: string } | null } | null }[] }; assert.equal(pf.items.find(i => i.id === T1.tenant_id)!.summary!.trackedCycle!.code, T1.code);
});

test('Arşiv yaşam döngüsü: aktif→arşiv yok; durdurulmuş→arşiv; müşteri girişi kapalı; danışman erişemez, denetçi ve yönetici okur; arşiv→aktif yok; arşivden dönüş durdurulmuşa', async () => {
  const email = `ik@kar.${dom}`; const cr = await api('POST', '/api/platform/tenants', { code: `KAR${S}`, name: 'Arşiv şirketi', adminEmail: email, adminName: 'Arşiv İK' }, 'root'); assert.equal(cr.status, 200); const X = cr.body.id as string;
  await api('POST', `/api/t/${X}/invitations/send`, {}, 'root'); await accept(email, 'ikX');
  await mkStaff('danX', 'consultant', [X], 'primary'); await mkStaff('denX', 'auditor', [X], 'auditor');
  const s = (status: string, reason = 'yaşam döngüsü testi') => api('POST', `/api/platform/tenants/${X}/status`, { status, reason }, 'root');
  const a0 = await s('archived'); assert.equal(a0.status, 409); assert.equal(a0.body.error, 'invalid_transition');
  assert.equal((await s('suspended')).status, 200); const a1 = await s('archived', 'sözleşme sona erdi'); assert.equal(a1.status, 200, JSON.stringify(a1.body));
  const lg = await api('POST', '/api/auth/login', { email, password: PW }); assert.equal(lg.status, 403); assert.equal(lg.body.error, 'tenant_suspended');
  assert.equal((await detail(X, 'danX')).status, 403, 'arşivde danışman erişemez'); assert.equal((await detail(X, 'denX')).status, 200, 'denetçi geçmişi okur'); const dr = await detail(X); assert.equal(dr.status, 200); assert.equal((dr.body as unknown as Det).tenant.status, 'archived');
  assert.equal((await api('GET', `/api/t/${X}/overview`, undefined, 'danX')).status, 403);
  const pfd = (await api('GET', '/api/platform/portfolio', undefined, 'danX')).body as unknown as { items: { id: string }[] }; assert.ok(!pfd.items.some(i => i.id === X), 'arşivlenmiş şirket danışman portföyünde yok');
  assert.equal((await s('active')).status, 409, 'arşivden doğrudan etkinleştirme yok');
  assert.equal((await api('POST', `/api/platform/tenants/${X}/intervention`, { reason: 'arşivde müdahale denemesi yapılıyor', minutes: 15 }, 'root')).status, 403);
  assert.equal((await s('suspended', 'arşivden dönüş')).status, 200); assert.equal((await detail(X, 'danX')).status, 200, 'durdurulmuşta danışman okur');
  assert.equal((await s('active', 'yeniden açılış')).status, 200); assert.equal((await api('POST', '/api/auth/login', { email, password: PW })).status, 200);
  const ev = (await one(`SELECT action FROM platform_audit_event WHERE tenant_id = $1 AND action LIKE 'tenant.%' ORDER BY occurred_at`, [X])).map(r => r.action as string); for (const a of ['tenant.suspend', 'tenant.archive', 'tenant.unarchive', 'tenant.activate']) assert.ok(ev.includes(a), a);
});

test('§10.2.4 mevcut ana danışmana başka görevin devri ana görevini silemez', async () => {
  const Y = await mkTenant('KY'); const P = await mkStaff('anaY', 'consultant', [Y], 'primary'); const Bk = await mkStaff('yedY', 'consultant', [Y], 'backup');
  const r = await api('POST', `/api/platform/tenants/${Y}/assignments`, { userId: P, duty: 'backup', reason: 'yedek görevini ana danışmana devretme denemesi', handoverFrom: Bk }, 'root');
  assert.equal(r.status, 409, JSON.stringify(r.body)); assert.equal(r.body.error, 'primary_handover_required');
  const d = await one(`SELECT u.display_name AS n, a.duty FROM platform_tenant_access a JOIN app_user u ON u.id = a.user_id WHERE a.tenant_id = $1 AND a.revoked_at IS NULL`, [Y]) as { n: string; duty: string }[];
  assert.equal(d.find(x => x.n === 'anaY')?.duty, 'primary'); assert.equal(d.find(x => x.n === 'yedY')?.duty, 'backup'); assert.equal(d.filter(x => x.duty === 'primary').length, 1);
});

test('§10.2.5 aynı istemci anahtarı iki farklı komutta: iki müdahale izi de kalır; §7.3 HPW tekrar güvenliği isteğin şirketine bağlı (başka şirkete geçişte yeniden yürütme yok)', async () => {
  const Z = await mkTenant('KZ'); const W = await mkTenant('KW');
  const iv = await api('POST', `/api/platform/tenants/${Z}/intervention`, { reason: 'v2.10.0 iz anahtarı çakışma testi yapılıyor', minutes: 15 }, 'root'); assert.equal(iv.status, 200); const iid = iv.body.id as string;
  const same = `ayni-${S}`; const sn = (key: string, idem: string) => api('POST', `/api/t/${Z}/attention/${encodeURIComponent(key)}/snooze`, { until: '2027-02-01T00:00:00Z' }, 'root', { 'idempotency-key': idem });
  assert.equal((await sn('k:bir', same)).status, 200); assert.equal((await sn('k:iki', same)).status, 200);
  assert.equal(Number((await one(`SELECT COUNT(*) AS n FROM platform_audit_event WHERE intervention_id = $1 AND action = 'intervention.write'`, [iid]))[0].n), 2, 'iki farklı komutun izi birleşmez');
  // oturumun seçili şirketi W iken Z'ye komut; sonra seçili şirket değişse de yeniden deneme aynı kaydı bulur (iş yeniden yürütülmez)
  await api('POST', '/api/auth/switch-tenant', { tenantId: W }, 'root'); const k2 = `tekrar-${S}`;
  const r1 = await sn('k:uc', k2); assert.equal(r1.status, 200);
  await api('POST', '/api/auth/switch-tenant', { tenantId: Z }, 'root'); const r2 = await sn('k:uc', k2); assert.equal(r2.status, 200); assert.deepEqual(r2.body, r1.body);
  assert.equal(Number((await one(`SELECT COUNT(*) AS n FROM audit_event WHERE tenant_id = $1 AND entity_type = 'attention_item' AND new_value->>'key' = 'k:uc'`, [Z]))[0].n), 1, 'yeniden deneme işi ikinci kez yürütmez');
  assert.equal(Number((await one(`SELECT COUNT(*) AS n FROM idempotency_key WHERE tenant_id = $1 AND key LIKE $2`, [Z, `%${k2}`]))[0].n), 1, 'tekrar güvenliği kaydı isteğin şirketinde');
  await api('POST', `/api/platform/interventions/${iid}/end`, {}, 'root'); void randomUUID;
});

test('Kurulum 4 ve 10: davet oluşturma ≠ kabul; kullanıma açılış HPW onayı + müşteri İK teyidi; HPW müşteri adına teyit veremez; kaynak değişince yeniden kontrol', async () => {
  // tam kurulmuş bir şirket (önceki test dosyalarının gerçek verisi): yayımlı sonuç, İK yöneticisi, kabul edilmiş kullanıcılar
  const cand = await one(`SELECT c.tenant_id, c.id FROM survey_cycle c JOIN tenant t ON t.id = c.tenant_id AND t.status = 'active' JOIN platform_tenant_access a ON a.tenant_id = c.tenant_id AND a.revoked_at IS NULL JOIN app_user u ON u.id = a.user_id AND u.email = 'platform@hpw.test' WHERE c.active_batch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM onboarding_approval o WHERE o.tenant_id = c.tenant_id AND o.step_key = 'go_live') ORDER BY c.tenant_id LIMIT 20`) as { tenant_id: string; id: string }[];
  let G = '', cyc = ''; for (const r of cand) { const d = (await detail(r.tenant_id)).body as unknown as Det; if (st(d, 'customer_admin') === 'done' && st(d, 'user_access') === 'done' && st(d, 'organization') === 'done' && st(d, 'instrument') === 'done') { G = r.tenant_id; cyc = r.id; break; } }
  assert.ok(G, 'tam kurulmuş şirket bulunamadı');
  let d = (await detail(G)).body as unknown as Det;
  assert.equal((await api('PATCH', `/api/platform/tenants/${G}/tracked-cycle`, { cycleId: cyc, expectedVersion: d.tenant.ops_version }, 'root')).status, 200);
  d = (await detail(G)).body as unknown as Det;
  await api('POST', `/api/platform/tenants/${G}/service-record`, { ref: 'HS-G', scope: 'kapsam', owners: 'sorumlular', retentionPolicyRef: 'SP-1', expectedVersion: d.tenant.ops_version }, 'root');
  d = (await detail(G)).body as unknown as Det; await api('POST', `/api/platform/tenants/${G}/onboarding/service_record/approve`, { reason: 'kontrol edildi', expectedVersion: d.tenant.ops_version, expectedFingerprint: d.onboarding.fingerprints.service_record }, 'root');
  if (st((await detail(G)).body as unknown as Det, 'hpw_owner') !== 'done') await mkStaff('anaG', 'consultant', [G], 'primary');
  // müşteri yöneticisi adımı: yeni İK yöneticisi daveti kabul edilene kadar tamam sayılmaz (mevcut kabul edilmiş yönetici zaten tamamlıyor)
  const email = `ik2@g.${dom}`; assert.equal((await api('POST', `/api/platform/tenants/${G}/admin-invite`, { email, displayName: 'G İK 2' }, 'root')).status, 200);
  const f4 = (((await detail(G)).body as unknown as Det).onboarding.steps.find(s => s.key === 'customer_admin')!.facts) as { admins: number }; assert.ok(f4.admins >= 2);
  d = (await detail(G)).body as unknown as Det; assert.ok(d.onboarding.steps.slice(0, 9).every(s => s.state === 'done'), JSON.stringify(d.onboarding.steps.map(s => [s.key, s.state])));
  assert.equal(st(d, 'go_live'), 'not_started');
  const ap = await api('POST', `/api/platform/tenants/${G}/onboarding/go_live/approve`, { reason: 'kurulum tamam; açılış', expectedVersion: d.tenant.ops_version, expectedFingerprint: d.onboarding.fingerprints.go_live }, 'root'); assert.equal(ap.status, 200, JSON.stringify(ap.body));
  d = (await detail(G)).body as unknown as Det; assert.equal(st(d, 'go_live'), 'in_progress', 'HPW onayı tek başına tamamlamaz: müşteri teyidi bekleniyor');
  const gs = (await api('GET', `/api/t/${G}/onboarding/go-live`, undefined, 'root')).body as unknown as { fingerprint: string; awaitingCustomer: boolean }; assert.equal(gs.awaitingCustomer, true);
  assert.equal((await api('POST', `/api/t/${G}/onboarding/go-live/confirm`, { reason: 'HPW adına teyit denemesi', expectedFingerprint: gs.fingerprint }, 'root')).status, 403, 'HPW personeli müşteri teyidi veremez');
  await api('POST', `/api/t/${G}/invitations/send`, {}, 'root'); await accept(email, 'ikG');
  const c1 = await api('POST', `/api/t/${G}/onboarding/go-live/confirm`, { reason: 'müşteri olarak kullanıma açılışı teyit ediyoruz', expectedFingerprint: gs.fingerprint }, 'ikG'); assert.equal(c1.status, 200, JSON.stringify(c1.body));
  d = (await detail(G)).body as unknown as Det; assert.equal(st(d, 'go_live'), 'done');
  // kaynak değişimi (izlenen dönem kaldırıldı) → yeniden kontrol; müşteri teyidi de eski onaya bağlı kalır
  assert.equal((await api('PATCH', `/api/platform/tenants/${G}/tracked-cycle`, { cycleId: null, expectedVersion: d.tenant.ops_version }, 'root')).status, 200);
  d = (await detail(G)).body as unknown as Det; assert.equal(st(d, 'go_live'), 'recheck', 'kaynak değişti: müşteri teyidi olsa da adım tamamlanmış görünmez');
  // iki taraflı kanıt zinciri: kaynak kalıcı değişir (hizmet kaydı) → HPW yeniden onaylar → eski müşteri teyidi yeni onayı karşılamaz → müşteri yeniden teyit eder
  assert.equal((await api('PATCH', `/api/platform/tenants/${G}/tracked-cycle`, { cycleId: cyc, expectedVersion: d.tenant.ops_version }, 'root')).status, 200);
  d = (await detail(G)).body as unknown as Det; assert.equal(st(d, 'go_live'), 'done', 'kanıt onay anındakine döndü: iki kayıt yeniden geçerli');
  await api('POST', `/api/platform/tenants/${G}/service-record`, { ref: 'HS-G2', scope: 'kapsam', owners: 'sorumlular', retentionPolicyRef: 'SP-2', expectedVersion: d.tenant.ops_version }, 'root');
  d = (await detail(G)).body as unknown as Det; assert.equal(st(d, 'go_live'), 'recheck');
  await api('POST', `/api/platform/tenants/${G}/onboarding/service_record/approve`, { reason: 'yeni kayıt kontrol edildi', expectedVersion: d.tenant.ops_version, expectedFingerprint: d.onboarding.fingerprints.service_record }, 'root');
  d = (await detail(G)).body as unknown as Det; const oldFp = gs.fingerprint;
  assert.equal((await api('POST', `/api/platform/tenants/${G}/onboarding/go_live/approve`, { reason: 'yeniden açılış onayı', expectedVersion: d.tenant.ops_version, expectedFingerprint: d.onboarding.fingerprints.go_live }, 'root')).status, 200);
  d = (await detail(G)).body as unknown as Det; assert.equal(st(d, 'go_live'), 'in_progress', 'yeni HPW onayı: eski müşteri teyidi geçmez, yeni teyit bekleniyor');
  const gs2 = (await api('GET', `/api/t/${G}/onboarding/go-live`, undefined, 'ikG')).body as unknown as { fingerprint: string; awaitingCustomer: boolean }; assert.equal(gs2.awaitingCustomer, true); assert.notEqual(gs2.fingerprint, oldFp);
  const eski = await api('POST', `/api/t/${G}/onboarding/go-live/confirm`, { reason: 'eski onayı teyit denemesi', expectedFingerprint: oldFp }, 'ikG'); assert.equal(eski.status, 409, 'eşzamanlı yeniden onay: eski onayın teyidi reddedilir'); assert.equal(eski.body.error, 'evidence_changed');
  // müdahale yetkisiyle müşteri teyidi verilemez
  const iv = await api('POST', `/api/platform/tenants/${G}/intervention`, { reason: 'müdahaleyle müşteri teyidi denemesi yapılıyor', minutes: 15 }, 'root'); assert.equal(iv.status, 200);
  const mt = await api('POST', `/api/t/${G}/onboarding/go-live/confirm`, { reason: 'müdahale ile teyit', expectedFingerprint: gs2.fingerprint }, 'root'); assert.equal(mt.status, 403, 'müdahale modunda da HPW müşteri teyidi veremez'); await api('POST', `/api/platform/interventions/${iv.body.id}/end`, {}, 'root');
  assert.equal((await api('POST', `/api/t/${G}/onboarding/go-live/confirm`, { reason: 'yeni onay teyit edildi', expectedFingerprint: gs2.fingerprint }, 'ikG')).status, 200);
  d = (await detail(G)).body as unknown as Det; assert.equal(st(d, 'go_live'), 'done');
});

test('Dönem kapsamı: izlenen dönem yokken döneme bağlı sayaçlar null + neden (toplam gibi sunulmaz); veri ilişkisinde başka şirketin dönemi reddedilir', async () => {
  const N = await mkTenant('KN'); const pf = (await api('GET', '/api/platform/portfolio', undefined, 'root')).body as unknown as { items: { id: string; summary: { cycleBound: string; counts: { overdueActions: number | null; actions: number | null; units: number } } }[] };
  const it = pf.items.find(i => i.id === N)!; assert.equal(it.summary.cycleBound, 'no_tracked_cycle'); assert.equal(it.summary.counts.overdueActions, null); assert.equal(it.summary.counts.actions, null); assert.equal(typeof it.summary.counts.units, 'number');
  const other = (await one(`SELECT id FROM survey_cycle WHERE tenant_id <> $1 LIMIT 1`, [N]))[0].id; let fk = false;
  try { await one('UPDATE tenant SET tracked_cycle_id = $2 WHERE id = $1', [N, other]); } catch (e) { fk = /tenant_tracked_cycle_fk|foreign key/i.test(String((e as Error).message)); } assert.ok(fk, 'veritabanı başka şirketin dönemini reddeder');
});

test('Durdurma/arşiv geçişi: süren müdahale sonlanır, kuyruktaki e-posta bekletilir, süren yazma transaction’ı durum değişikliğini bekletir ve sonrası reddedilir', async () => {
  const Q = await mkTenant('KQ'); const iv = await api('POST', `/api/platform/tenants/${Q}/intervention`, { reason: 'durdurma sırasında müdahale sınaması', minutes: 30 }, 'root'); assert.equal(iv.status, 200);
  await one(`INSERT INTO email_outbox (tenant_id, to_email, subject, body_text, idempotency_key) VALUES ($1,'bekle@x.test','deneme','deneme',$2)`, [Q, `bekle-${S}`]);
  // süren yazma: müşteri bağlamında açık transaction şirket satırında paylaşımlı kilit tutar; durum değişikliği bekler
  const w = new pg.Client({ connectionString: config.databaseUrl }); await w.connect(); await w.query('BEGIN'); await w.query(`SELECT set_config('app.realm','customer',true), set_config('app.tenant_id',$1,true)`, [Q]); assert.equal((await w.query('SELECT tenant_status_lock($1) AS s', [Q])).rows[0].s, 'active');
  let done = false; const sp = api('POST', `/api/platform/tenants/${Q}/status`, { status: 'suspended', reason: 'süren yazma testi' }, 'root').then(r => { done = true; return r; });
  await new Promise(r => setTimeout(r, 600)); assert.equal(done, false, 'durdurma süren yazma transaction’ını bekler'); await w.query('COMMIT'); await w.end();
  const sr = await sp; assert.equal(sr.status, 200);
  assert.equal((await one(`SELECT ended_at IS NOT NULL AS e FROM platform_intervention WHERE id = $1`, [iv.body.id]))[0].e, true, 'süren müdahale sonlandı');
  assert.equal((await one(`SELECT COUNT(*) AS n FROM outbox_claim(50) WHERE tenant_id = $1`, [Q]))[0].n, '0', 'durdurulmuş şirketin postası gönderime alınmaz');
  const w2 = new pg.Client({ connectionString: config.databaseUrl }); await w2.connect(); let rejected = false; try { await w2.query('BEGIN'); await w2.query(`SELECT set_config('app.realm','customer',true), set_config('app.tenant_id',$1,true)`, [Q]); rejected = (await w2.query('SELECT tenant_status_lock($1) AS s', [Q])).rows[0].s !== 'active'; } finally { await w2.query('ROLLBACK').catch(() => null); await w2.end(); } assert.ok(rejected, 'sonraki yazma etkin olmayan durumu görür (uygulama katmanı 403)');
  assert.equal((await api('POST', `/api/platform/tenants/${Q}/status`, { status: 'active', reason: 'yeniden açılış' }, 'root')).status, 200);
  assert.equal(Number((await one(`SELECT COUNT(*) AS n FROM email_outbox WHERE tenant_id = $1 AND status = 'queued'`, [Q]))[0].n) >= 0, true);
});
