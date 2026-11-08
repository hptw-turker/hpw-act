/** v2.11.0 bekleyen işler (gerçek PostgreSQL + Fastify HTTP): kural açılışı/çözülmesi/tekrar oluşma, okunamayan kaynak, değerlendirilemeyen kural, eşzamanlı değerlendirme ve üstlenme, işlem anahtarı, güncel yetki, şirketler arası ayrım, yaşam döngüsü, erteleme/reddetme bitişi. */
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
const PW = 'Parola12345'; const S = 'B' + Date.now().toString(36).toLocaleUpperCase('en-US').slice(-4); const dom = `b${S.toLocaleLowerCase('en-US')}.test`;
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

test('Kural yaşam döngüsü: açılır, kaynakta çözülür, tekrar oluşunca yeni kayıt; değerlendirilemeyen kural iş açmaz', async () => {
  const T = await tenantWithFailedInvite('WA');
  let w = await item(T, 'invite_failed'); assert.ok(w, 'davet başarısız işi açıldı'); assert.equal(w!.state, 'open'); assert.equal(w!.occurrence, 1); assert.equal((w!.evidence as { failed: number }).failed, 1); assert.ok(w!.last_ok_eval_at);
  assert.ok(!JSON.stringify(w!.evidence).includes('@'), 'kanıtta e-posta adresi yok');
  const ev = (await list(T)).evaluations; assert.equal(ev.find(e => e.rule === 'overdue_actions')!.status, 'not_evaluable', 'izlenen dönem yok'); assert.ok(!(await list(T)).items.some(i => i.rule === 'overdue_actions'));
  await setDelivery(T, 'sent'); await stale(T);
  const all = (await list(T, 'root', '&includeResolved=1')).items.filter(i => i.rule === 'invite_failed'); assert.equal(all.length, 1); assert.equal(all[0]!.state, 'resolved');
  assert.equal((await list(T)).items.filter(i => i.rule === 'invite_failed').length, 0, 'çözülen iş etkin listede yok');
  await setDelivery(T, 'perm_fail'); await stale(T);
  const again = (await list(T, 'root', '&includeResolved=1')).items.filter(i => i.rule === 'invite_failed'); assert.equal(again.length, 2, 'yeni kayıt'); assert.ok(again.some(i => i.state === 'resolved' && i.occurrence === 1) && again.some(i => i.state === 'open' && i.occurrence === 2));
});

test('Kaynak okunamazsa iş kapanmaz (unreadable); yeni iş açılmaz; kaynak dönünce değerlendirme sürer', async () => {
  const T = await mkTenant('WB'); await one(`INSERT INTO cm_central_queue (tenant_id, kind, title, created_at) VALUES ($1, 'decision', 'eski karar', now() - interval '10 days')`, [T]);
  let w = await item(T, 'central_decision'); assert.ok(w); assert.equal(w!.state, 'open'); const okAt = w!.last_ok_eval_at;
  await one('REVOKE SELECT ON cm_central_queue FROM hpw_app');
  try { await stale(T); const l = await list(T); w = l.items.find(i => i.rule === 'central_decision'); assert.equal(w!.state, 'open', 'okunamayan kaynak çözüldü sayılmaz'); assert.equal(w!.eval_status, 'unreadable'); assert.equal(w!.last_ok_eval_at, okAt, 'son başarılı doğrulama zamanı yenilenmez'); assert.equal(l.evaluations.find(e => e.rule === 'central_decision')!.status, 'unreadable'); }
  finally { await one('GRANT SELECT ON cm_central_queue TO hpw_app'); }
  await stale(T); w = await item(T, 'central_decision'); assert.equal(w!.eval_status, 'ok');
});

test('Eşzamanlı değerlendirme mükerrer iş açmaz; veritabanı ikinci etkin işi reddeder', async () => {
  const T = await tenantWithFailedInvite('WC');
  const rs = await Promise.all([1, 2, 3].map(() => api('GET', `/api/platform/work-items?tenantId=${T}`, undefined, 'root'))); assert.ok(rs.every(r => r.status === 200));
  assert.equal(Number((await one(`SELECT COUNT(*) AS n FROM platform_work_item WHERE tenant_id = $1 AND rule = 'invite_failed' AND state <> 'resolved'`, [T]))[0].n), 1);
  let dup = false; try { await one(`INSERT INTO platform_work_item (tenant_id, rule, owner_role, due_at) VALUES ($1, 'invite_failed', 'consultant', now())`, [T]); } catch { dup = true; } assert.ok(dup, 'benzersiz indeks');
});

test('Üstlenme: eşzamanlı iki danışmandan biri kazanır (409 work_item_taken); sürüm çatışması; işlem anahtarı tekrarı ve çatışması; güncel yetki; denetçi/danışman sınırları', async () => {
  const T = await tenantWithFailedInvite('WD'); const w = (await item(T, 'invite_failed'))!;
  await mkStaff('wdAna', 'consultant', [T], 'primary'); await mkStaff('wdYedek', 'consultant', [T], 'backup'); await mkStaff('wdDen', 'auditor', [T], 'auditor');
  const [a, b] = await Promise.all([act(w.id, 'claim', { expectedVersion: w.version }, 'wdAna'), act(w.id, 'claim', { expectedVersion: w.version }, 'wdYedek')]);
  const st = [a.status, b.status].sort(); assert.deepEqual(st, [200, 409], JSON.stringify([a.body, b.body])); assert.equal((a.status === 409 ? a : b).body.error, 'work_item_taken');
  const cur = (await item(T, 'invite_failed'))!; assert.equal(cur.state, 'claimed');
  const winner = a.status === 200 ? 'wdAna' : 'wdYedek';
  assert.equal((await act(w.id, 'release', { expectedVersion: w.version }, winner)).status, 409, 'eski sürüm'); 
  assert.equal((await act(w.id, 'snooze', { expectedVersion: cur.version, reason: 'denetçi deneme', until: new Date(Date.now() + 86400000).toISOString() }, 'wdDen')).status, 403, 'denetçi işlem yapamaz');
  assert.equal((await act(w.id, 'dismiss', { expectedVersion: cur.version, reason: 'danışman reddi', until: new Date(Date.now() + 86400000).toISOString() }, winner)).status, 403, 'reddetme yalnız yönetici');
  // yönetici bırakır; yedek danışman üstlenir (ana danışmanın ataması devirsiz bitirilemez — v2.9.1 kuralı)
  assert.equal((await act(w.id, 'release', { expectedVersion: cur.version }, 'root')).status, 200); let c2 = (await item(T, 'invite_failed'))!; assert.equal((await act(w.id, 'claim', { expectedVersion: c2.version }, 'wdYedek')).status, 200); c2 = (await item(T, 'invite_failed'))!;
  const holder = 'wdYedek';
  // işlem anahtarı: aynı gövde → aynı sonuç, tek iz; farklı gövde → 409
  const key = `wi-${S}`; const body = { expectedVersion: c2.version, reason: 'müşteri toplantısı sonrası', until: new Date(Date.now() + 3 * 86400000).toISOString() };
  const s1 = await act(w.id, 'snooze', body, holder, key); assert.equal(s1.status, 200, JSON.stringify(s1.body)); const s2 = await act(w.id, 'snooze', body, holder, key); assert.equal(s2.status, 200); assert.deepEqual(s2.body, s1.body);
  assert.equal(Number((await one(`SELECT COUNT(*) AS n FROM platform_audit_event WHERE target_id = $1 AND action = 'work_item.snooze'`, [w.id]))[0].n), 1, 'tekrar ikinci iş etkisi oluşturmaz');
  assert.equal((await act(w.id, 'snooze', { ...body, reason: 'farklı gerekçe' }, holder, key)).status, 409, 'aynı anahtar farklı içerik');
  // güncel yetki: atama bitince aynı anahtarlı tekrar eski sonucu döndürmez
  const uid = (await one(`SELECT id FROM app_user WHERE email = $1`, [`${holder}@hpw.${dom}`]))[0].id as string;
  assert.equal((await api('POST', `/api/platform/tenants/${T}/assignments/${uid}/end`, { reason: 'görev bitti' }, 'root')).status, 200);
  const s3 = await act(w.id, 'snooze', body, holder, key); assert.equal(s3.status, 404, 'yetkisi kalkan kullanıcı işi göremez: ' + JSON.stringify(s3.body));
});

test('Şirketler arası ayrım: A işi B danışmanınca görülmez ve değiştirilemez', async () => {
  const A = await tenantWithFailedInvite('WE'); const B = await mkTenant('WF'); await mkStaff('wfDan', 'consultant', [B], 'primary');
  const w = (await item(A, 'invite_failed'))!; const l = await api('GET', '/api/platform/work-items', undefined, 'wfDan'); assert.ok(!(l.body as unknown as { items: WI[] }).items.some(i => i.tenant_id === A));
  const r = await act(w.id, 'claim', { expectedVersion: w.version }, 'wfDan'); assert.equal(r.status, 404); assert.equal((await item(A, 'invite_failed'))!.state, 'open');
  assert.equal((await api('GET', `/api/platform/work-items/${w.id}/history`, undefined, 'wfDan')).status, 404);
});

test('Yaşam döngüsü: durdurmada işler askıda ve işlem yapılamaz; etkinleşince önceki durumlarına döner; erteleme ve reddetme bitişi; reddedilen iş çözülmüş sayılmaz', async () => {
  const T = await tenantWithFailedInvite('WG'); let w = (await item(T, 'invite_failed'))!;
  assert.equal((await act(w.id, 'claim', { expectedVersion: w.version }, 'root')).status, 200); w = (await item(T, 'invite_failed'))!;
  assert.equal((await api('POST', `/api/platform/tenants/${T}/status`, { status: 'suspended', reason: 'askı testi' }, 'root')).status, 200); await stale(T);
  w = (await item(T, 'invite_failed'))!; assert.equal(w.state, 'tenant_inactive');
  assert.equal((await act(w.id, 'release', { expectedVersion: w.version }, 'root')).status, 403, 'askıdaki şirkette işlem yok');
  assert.equal((await api('POST', `/api/platform/tenants/${T}/status`, { status: 'active', reason: 'açılış' }, 'root')).status, 200); await stale(T);
  w = (await item(T, 'invite_failed'))!; assert.equal(w.state, 'claimed', 'önceki sahibine döner');
  // erteleme bitişi (koşul sürüyor) → önceki sahibine döner
  assert.equal((await act(w.id, 'snooze', { expectedVersion: w.version, reason: 'bekleme', until: new Date(Date.now() + 86400000).toISOString() }, 'root')).status, 200);
  await one(`UPDATE platform_work_item SET snoozed_until = now() - interval '1 minute' WHERE id = $1`, [w.id]); await stale(T); w = (await item(T, 'invite_failed'))!; assert.equal(w.state, 'claimed');
  // reddetme: çözülmüş sayılmaz; süre bitince koşul sürüyorsa aynı kayıt yeniden etkin
  assert.equal((await act(w.id, 'dismiss', { expectedVersion: w.version, reason: 'bu dönem takip gerekmiyor', until: new Date(Date.now() + 5 * 86400000).toISOString() }, 'root')).status, 200);
  w = (await item(T, 'invite_failed'))!; assert.equal(w.state, 'dismissed'); assert.equal(Number((await one(`SELECT COUNT(*) AS n FROM platform_work_item WHERE tenant_id = $1 AND rule = 'invite_failed' AND state = 'resolved'`, [T]))[0].n), 0);
  const tooLong = await act(w.id, 'dismiss', { expectedVersion: w.version, reason: 'uzun', until: new Date(Date.now() + 40 * 86400000).toISOString() }, 'root'); assert.ok([409, 422].includes(tooLong.status));
  await one(`UPDATE platform_work_item SET dismissed_until = now() - interval '1 minute' WHERE id = $1`, [w.id]); await stale(T); const back = (await item(T, 'invite_failed'))!; assert.equal(back.id, w.id, 'aynı kayıt'); assert.equal(back.state, 'claimed');
  const hist = (await api('GET', `/api/platform/work-items/${w.id}/history`, undefined, 'root')).body as unknown as { action: string; actor_email: string | null; reason: string | null }[];
  for (const a of ['work_item.opened', 'work_item.claim', 'work_item.tenant_inactive', 'work_item.tenant_active', 'work_item.snooze', 'work_item.snooze_ended', 'work_item.dismiss', 'work_item.dismiss_ended']) assert.ok(hist.some(h => h.action === a), a);
  assert.ok(hist.find(h => h.action === 'work_item.dismiss')!.reason, 'gerekçe kayıtlı');
});

test('Değerlendirilemeyen kural + mevcut iş: izlenen dönem kaldırılınca iş çözülmez, listede kalır, son başarılı doğrulama korunur; diğer kuralların zamanı bu kuralı güncel göstermez', async () => {
  const c = (await one(`SELECT a.tenant_id, a.cycle_id FROM action a JOIN tenant t ON t.id = a.tenant_id AND t.status = 'active' JOIN platform_tenant_access x ON x.tenant_id = a.tenant_id AND x.revoked_at IS NULL JOIN app_user u ON u.id = x.user_id AND u.email = 'platform@hpw.test' WHERE a.kind <> 'master' GROUP BY 1, 2 ORDER BY COUNT(*) DESC LIMIT 1`))[0] as { tenant_id: string; cycle_id: string }; assert.ok(c, 'aksiyonlu şirket gerekli'); const T = c.tenant_id;
  const d = (await api('GET', `/api/platform/tenants/${T}`, undefined, 'root')).body as unknown as { tenant: { ops_version: number } };
  assert.equal((await api('PATCH', `/api/platform/tenants/${T}/tracked-cycle`, { cycleId: c.cycle_id, expectedVersion: d.tenant.ops_version }, 'root')).status, 200);
  await one(`UPDATE action SET lifecycle_state = 'in_progress', due_date = CURRENT_DATE - 5 WHERE tenant_id = $1 AND cycle_id = $2 AND kind <> 'master'`, [T, c.cycle_id]); await stale(T);
  let w = await item(T, 'overdue_actions'); assert.ok(w, 'gecikmiş uygulama işi'); const okAt = w!.last_ok_eval_at; const okAtOther = (await list(T)).evaluations.find(e => e.rule === 'invite_failed')!.last_ok_at;
  const d2 = (await api('GET', `/api/platform/tenants/${T}`, undefined, 'root')).body as unknown as { tenant: { ops_version: number } };
  assert.equal((await api('PATCH', `/api/platform/tenants/${T}/tracked-cycle`, { cycleId: null, expectedVersion: d2.tenant.ops_version }, 'root')).status, 200);
  await new Promise(r => setTimeout(r, 1100)); await stale(T); const l = await list(T); w = l.items.find(i => i.rule === 'overdue_actions');
  assert.ok(w, 'listeden kaybolmaz'); assert.equal(w!.state, 'open', 'çözülmüş sayılmaz'); assert.equal(w!.eval_status, 'not_evaluable'); assert.equal(w!.last_ok_eval_at, okAt, 'son başarılı doğrulama korunur');
  const ev = l.evaluations.find(e => e.rule === 'overdue_actions')!; assert.equal(ev.status, 'not_evaluable'); assert.equal(ev.detail, 'no_tracked_cycle');
  const other = l.evaluations.find(e => e.rule === 'invite_failed')!; assert.equal(other.status, 'ok'); assert.notEqual(other.last_ok_at, okAtOther, 'başarılı kuralın zamanı ilerledi'); assert.ok(new Date(ev.last_ok_at!).getTime() < new Date(other.last_ok_at!).getTime(), 'başarısız kuralın son başarılı zamanı ilerlemedi');
});

test('Erteleme bitince yetkisi kalmayan sahibe iş verilmez (owner_lost, açık iş); askıdan dönüşte süreler, kaynak ve sahip yetkisi yeniden değerlendirilir; okunamayan kaynakta belirsizlik korunur', async () => {
  const T = await tenantWithFailedInvite('WH'); await mkStaff('whAna', 'consultant', [T], 'primary'); await mkStaff('whYed', 'consultant', [T], 'backup');
  let w = (await item(T, 'invite_failed'))!; assert.equal((await act(w.id, 'claim', { expectedVersion: w.version }, 'whYed')).status, 200); w = (await item(T, 'invite_failed'))!;
  assert.equal((await act(w.id, 'snooze', { expectedVersion: w.version, reason: 'bekleme', until: new Date(Date.now() + 86400000).toISOString() }, 'whYed')).status, 200);
  const yid = (await one(`SELECT id FROM app_user WHERE email = $1`, [`whYed@hpw.${dom}`]))[0].id as string; assert.equal((await api('POST', `/api/platform/tenants/${T}/assignments/${yid}/end`, { reason: 'görev bitti' }, 'root')).status, 200);
  await one(`UPDATE platform_work_item SET snoozed_until = now() - interval '1 minute' WHERE id = $1`, [w.id]); await stale(T); w = (await item(T, 'invite_failed'))!;
  assert.equal(w.state, 'open', 'yetkisi kalmayan sahibe geri verilmez'); assert.equal(w.claimed_by, null);
  let hist = (await api('GET', `/api/platform/work-items/${w.id}/history`, undefined, 'root')).body as unknown as { action: string }[]; assert.ok(hist.some(h => h.action === 'work_item.owner_lost')); assert.ok(hist.some(h => h.action === 'work_item.snooze_ended'));
  assert.equal((await act(w.id, 'claim', { expectedVersion: w.version }, 'whAna')).status, 200, 'yetkili kişi yeniden üstlenebilir'); w = (await item(T, 'invite_failed'))!;
  // askı: reddetme süresi askıdayken dolar; kaynak askıdayken düzelir → dönüşte çözülür
  assert.equal((await act(w.id, 'dismiss', { expectedVersion: w.version, reason: 'askı öncesi red', until: new Date(Date.now() + 2 * 86400000).toISOString() }, 'root')).status, 200);
  assert.equal((await api('POST', `/api/platform/tenants/${T}/status`, { status: 'suspended', reason: 'askı' }, 'root')).status, 200); await stale(T); w = (await item(T, 'invite_failed'))!; assert.equal(w.state, 'tenant_inactive');
  await one(`UPDATE platform_work_item SET dismissed_until = now() - interval '1 minute' WHERE id = $1`, [w.id]);
  // dönüşte kaynak okunamıyor: iş çözülmez; süre dolduğu için sahibe (yetkili) döner; belirsizlik işaretli
  await one('REVOKE EXECUTE ON FUNCTION tenant_failed_invitations(uuid) FROM hpw_app'); await one('REVOKE EXECUTE ON FUNCTION tenant_failed_invitations(uuid) FROM PUBLIC');
  try { assert.equal((await api('POST', `/api/platform/tenants/${T}/status`, { status: 'active', reason: 'dönüş' }, 'root')).status, 200); await stale(T); w = (await item(T, 'invite_failed'))!;
    assert.equal(w.state, 'claimed', 'süre dolmuş reddetme: yetkili sahibine döner'); assert.equal(w.eval_status, 'unreadable', 'kaynak okunamadı; çözülmüş sayılmaz'); }
  finally { await one('GRANT EXECUTE ON FUNCTION tenant_failed_invitations(uuid) TO hpw_app'); }
  // kaynak düzelir → çözülür; son sorun kanıtı işte kalır, çözüm kanıtı geçmişte
  await setDelivery(T, 'sent'); await stale(T); const all = (await list(T, 'root', '&includeResolved=1')).items.filter(i => i.rule === 'invite_failed'); const res = all.find(i => i.id === w.id)!;
  assert.equal(res.state, 'resolved'); assert.equal((res.evidence as { failed: number }).failed, 1, 'etkilenen kayıt özeti korunur');
  hist = (await api('GET', `/api/platform/work-items/${w.id}/history`, undefined, 'root')).body as unknown as { action: string }[]; for (const a of ['work_item.tenant_inactive', 'work_item.tenant_active', 'work_item.dismiss_ended', 'work_item.resolved']) assert.ok(hist.some(h => h.action === a), a);
});

test('Tek etkin iş: üstlenilmiş, ertelenmiş, reddedilmiş ve askıdaki kayıtlarda eşzamanlı yeniden değerlendirme mükerrer iş açmaz', async () => {
  const T = await tenantWithFailedInvite('WI'); let w = (await item(T, 'invite_failed'))!;
  const hammer = async (label: string) => { await stale(T); await Promise.all([1, 2, 3].map(() => api('GET', `/api/platform/work-items?tenantId=${T}`, undefined, 'root'))); assert.equal(Number((await one(`SELECT COUNT(*) AS n FROM platform_work_item WHERE tenant_id = $1 AND rule = 'invite_failed' AND state <> 'resolved'`, [T]))[0].n), 1, label); };
  assert.equal((await act(w.id, 'claim', { expectedVersion: w.version }, 'root')).status, 200); await hammer('üstlenilmiş'); w = (await item(T, 'invite_failed'))!;
  assert.equal((await act(w.id, 'snooze', { expectedVersion: w.version, reason: 'bekleme', until: new Date(Date.now() + 86400000).toISOString() }, 'root')).status, 200); await hammer('ertelenmiş'); w = (await item(T, 'invite_failed'))!;
  assert.equal((await act(w.id, 'dismiss', { expectedVersion: w.version, reason: 'red gerekçesi', until: new Date(Date.now() + 86400000).toISOString() }, 'root')).status, 200); await hammer('reddedilmiş');
  assert.equal((await api('POST', `/api/platform/tenants/${T}/status`, { status: 'suspended', reason: 'askı' }, 'root')).status, 200); await hammer('askıda');
  assert.equal((await api('POST', `/api/platform/tenants/${T}/status`, { status: 'active', reason: 'dönüş' }, 'root')).status, 200); await hammer('askıdan dönüş');
});

test('Liste açılışında kısmi hata ve gecikme: bir şirketin değerlendirmesi kilitte beklerken diğer şirketler değerlendirilir ve listelenir; bekleyen şirketin son bilinen işi zamanıyla gösterilir', async () => {
  const X = await tenantWithFailedInvite('WJ'); const Y = await tenantWithFailedInvite('WK'); await list(X); await list(Y);
  const xBefore = (await item(X, 'invite_failed'))!.last_ok_eval_at; const yBefore = (await item(Y, 'invite_failed'))!.last_ok_eval_at; await stale(X); await stale(Y);
  const c = new pg.Client({ connectionString: config.migrateUrl }); await c.connect(); await c.query(`SELECT pg_advisory_lock(hashtext('hpw-work-item:' || $1))`, [X]);
  try { await new Promise(r => setTimeout(r, 1100));
    // ilk görünüm: kayıtlı durum değerlendirmeyi beklemeden döner (kilitteki şirket dahil bütün satırlar, eski zamanlarıyla)
    const f0 = Date.now(); const fast = await api('GET', '/api/platform/work-items?evaluate=0', undefined, 'root'); const fastMs = Date.now() - f0; assert.equal(fast.status, 200);
    const fb = fast.body as unknown as { items: WI[]; evaluated: boolean }; assert.equal(fb.evaluated, false); assert.ok(fastMs < 1000, 'değerlendirmesiz liste kilidi beklemez: ' + fastMs + ' ms');
    assert.ok(fb.items.some(i => i.tenant_id === X) && fb.items.some(i => i.tenant_id === Y), 'iki şirketin satırları ilk görünümde');
    const t0 = Date.now(); const r = await api('GET', '/api/platform/work-items', undefined, 'root'); const ms = Date.now() - t0; assert.equal(r.status, 200); const b = r.body as unknown as { items: WI[]; evaluationFailures: { tenantId: string }[] };
    assert.ok(ms < 12000, 'liste tamamlanır: ' + ms); assert.ok(b.evaluationFailures.some(f => f.tenantId === X), 'kilitteki şirket hata listesinde'); const xi = b.items.find(i => i.tenant_id === X && i.rule === 'invite_failed')!; const yi = b.items.find(i => i.tenant_id === Y && i.rule === 'invite_failed')!;
    assert.ok(xi, 'bekleyen şirketin işi listede'); assert.equal(xi.last_ok_eval_at, xBefore, 'zamanı yenilenmedi'); assert.notEqual(yi.last_ok_eval_at, yBefore, 'diğer şirket değerlendirildi');
    // süre sınırı dolduktan sonra biriken bağlantı ya da kilit bekleyen işlem yok (test bağlantısı hariç)
    const act = await one(`SELECT COUNT(*) FILTER (WHERE state = 'idle in transaction')::int AS idle_tx, COUNT(*) FILTER (WHERE wait_event_type = 'Lock')::int AS waiting FROM pg_stat_activity WHERE usename = 'hpw_api' AND datname = current_database()`);
    assert.equal(act[0].idle_tx, 0, 'açık kalan transaction yok'); assert.equal(act[0].waiting, 0, 'kilit bekleyen işlem yok'); console.log('ÖLÇÜM ilk görünüm (değerlendirmesiz) ms', fastMs, '· değerlendirmeli liste ms', ms); }
  finally { await c.query(`SELECT pg_advisory_unlock(hashtext('hpw-work-item:' || $1))`, [X]); await c.end(); }
});
