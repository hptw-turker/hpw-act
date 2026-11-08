/** v2.9.1 bağımsız denetim kapanışı (gerçek PostgreSQL + Fastify HTTP): V290-04 şirket kapsamı, rol modeli değişmezleri, son yönetici eşzamanlılığı, güncel yetki, V290-06 müdahale izi atomikliği. */
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
const PW = 'Parola12345'; const S = 'W' + Date.now().toString(36).toLocaleUpperCase('en-US').slice(-4); const dom = `w${S.toLocaleLowerCase('en-US')}.test`;
const su = () => new pg.Client({ connectionString: config.migrateUrl });
const one = async (sql: string, args: unknown[] = []) => { const c = su(); await c.connect(); try { return (await c.query(sql, args)).rows; } finally { await c.end(); } };
before(async () => { mkdirSync(config.mailDir, { recursive: true }); app = await buildApp(); await api('POST', '/api/platform/bootstrap', { email: 'platform@hpw.test', password: 'Platform12345', setupKey: config.setupKey }); await login('platform@hpw.test', 'root', 'Platform12345'); });
after(async () => { await app.close(); });
const T: Record<string, string> = {};
const mkTenant = async (k: string) => { const r = await api('POST', '/api/platform/tenants', { code: `${k}${S}`, name: `${k} şirketi` }, 'root'); assert.equal(r.status, 200, JSON.stringify(r.body)); T[k] = r.body.id as string; return T[k]!; };
const mkStaff = async (who: string, role: string, tenants: string[] = [], duty?: string) => { const email = `${who}@hpw.${dom}`; const r = await api('POST', '/api/platform/staff', { email, displayName: who, role, tenantIds: tenants, ...(duty ? { duty } : {}), reason: 'v2.9.1 testi' }, 'root'); assert.equal(r.status, 200, JSON.stringify(r.body)); await api('POST', `/api/auth/reset/${mailTokenFor(email, 'parola')}`, { password: PW }); await login(email, who, PW); return r.body.id as string; };
const duties = async (tid: string) => (await one(`SELECT u.display_name AS n, a.duty, a.revoked_at IS NOT NULL AS rev FROM platform_tenant_access a JOIN app_user u ON u.id = a.user_id WHERE a.tenant_id = $1 ORDER BY u.display_name`, [tid])) as { n: string; duty: string; rev: boolean }[];

test('V290-04 atama bitirme şirket kapsamı: A yöneticisi B atamasını bitiremez (durum değişmez, kayıt yok); B yöneticisi bitirir; yetkisiz ve bilinmeyen kimlik aynı yanıt', async () => {
  const A = await mkTenant('WA'), B = await mkTenant('WB');
  const adminA = await mkStaff('yonetA', 'admin', [A], 'admin_scope'); const adminB = await mkStaff('yonetB', 'admin', [B], 'admin_scope');
  const yedekB = await mkStaff('yedekB', 'consultant', [B], 'backup'); void adminA; void adminB;
  const before = await duties(B); const pae0 = Number((await one(`SELECT COUNT(*) AS n FROM platform_audit_event WHERE action = 'assignment.end' AND tenant_id = $1`, [B]))[0].n);
  const r = await api('POST', `/api/platform/tenants/${B}/assignments/${yedekB}/end`, { reason: 'kapsam dışı deneme' }, 'yonetA');
  assert.equal(r.status, 403, 'A yöneticisi B atamasını bitirememeli: ' + JSON.stringify(r.body)); assert.equal(r.body.error, 'tenant_not_authorized');
  assert.deepEqual(await duties(B), before, 'B atamaları değişmemeli');
  assert.equal(Number((await one(`SELECT COUNT(*) AS n FROM platform_audit_event WHERE action = 'assignment.end' AND tenant_id = $1`, [B]))[0].n), pae0, 'başarı kaydı oluşmamalı');
  const unknown = await api('POST', `/api/platform/tenants/${B}/assignments/00000000-0000-4000-8000-000000000000/end`, { reason: 'kapsam dışı deneme' }, 'yonetA');
  assert.equal(unknown.status, r.status); assert.equal(unknown.body.error, r.body.error, 'bilinmeyen kimlik yetkisiz kimlikle aynı yanıtı alır (varlık sızmaz)');
  // doğrudan SQL yolu da aynı politikayı uygular (SECURITY DEFINER fonksiyonu)
  let sqlDenied = false; try { await one('SELECT platform_unassign($1,$2,$3,$4)', [adminA, yedekB, B, 'doğrudan fonksiyon']); } catch (e) { sqlDenied = /tenant_not_authorized/.test(String((e as Error).message)); } assert.ok(sqlDenied, 'platform_unassign fonksiyonu da şirket erişimini denetlemeli');
  const ok = await api('POST', `/api/platform/tenants/${B}/assignments/${yedekB}/end`, { reason: 'yetkili bitirme' }, 'yonetB'); assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.ok((await duties(B)).find(x => x.n === 'yedekB')?.rev, 'yetkili yönetici bitirebilir');
});

test('Rol modeli değişmezleri: ana danışman doğrudan yedeğe çevrilemez, rolü uyumsuz role düşürülemez; görev-rol uyumu bütün yazma yollarında', async () => {
  const C = await mkTenant('WC'); const ana = await mkStaff('anaC', 'consultant', [C], 'primary'); const met = await mkStaff('metC', 'methodologist', [C], 'methodologist');
  const r1 = await api('POST', `/api/platform/tenants/${C}/assignments`, { userId: ana, duty: 'backup', reason: 'devirsiz yedeğe alma denemesi' }, 'root');
  assert.equal(r1.status, 409, 'ana danışman devirsiz yedeğe çevrilemez: ' + JSON.stringify(r1.body)); assert.equal(r1.body.error, 'primary_handover_required');
  const r2 = await api('PATCH', `/api/platform/staff/${ana}`, { role: 'auditor', reason: 'rol düşürme denemesi' }, 'root');
  assert.equal(r2.status, 409, 'ana danışmanın rolü devirsiz denetçiye düşürülemez: ' + JSON.stringify(r2.body));
  const r3 = await api('PATCH', `/api/platform/staff/${met}`, { role: 'auditor', reason: 'rol görev uyumsuzluğu' }, 'root');
  assert.equal(r3.status, 409, 'metodolog görevi varken rol denetçiye çevrilemez: ' + JSON.stringify(r3.body)); assert.equal(r3.body.error, 'role_duty_conflict');
  const d = await duties(C); assert.equal(d.find(x => x.n === 'anaC')?.duty, 'primary'); assert.equal(d.filter(x => x.duty === 'primary' && !x.rev).length, 1, 'şirket sorumlusuz kalmaz');
  const rr = (await one(`SELECT role FROM platform_role WHERE user_id = $1`, [ana]))[0].role; assert.equal(rr, 'consultant');
  // bir şirketin tek yönetici kapsamlı yöneticisi (şirketi başka yönetici göremez) rolden düşürülemez ya da kaldırılamaz: şirket yönetilemez kalmaz
  const F = await mkTenant('WF'); const yF = await mkStaff('yonetF', 'admin', [F], 'admin_scope');
  await one(`UPDATE platform_tenant_access SET revoked_at = now() WHERE tenant_id = $1 AND user_id <> $2`, [F, yF]); // F'de yalnız yonetF kalsın
  const r4 = await api('POST', `/api/platform/staff/${yF}/revoke`, { reason: 'son şirket yöneticisi' }, 'root'); assert.equal(r4.status, 409, 'şirketin son yöneticisi kaldırılamaz: ' + JSON.stringify(r4.body)); assert.equal(r4.body.error, 'last_tenant_admin');
  const r5 = await api('PATCH', `/api/platform/staff/${yF}`, { role: 'consultant', reason: 'son şirket yöneticisi' }, 'root'); assert.equal(r5.status, 409, JSON.stringify(r5.body));
});

test('Son yönetici eşzamanlılığı: iki yönetici aynı anda birbirini kaldırmaya çalışır (iki DB bağlantısı); en az bir yönetici kalır', async () => {
  // görevsiz iki yeni yönetici; diğer bütün yöneticiler geçici olarak devre dışı (test sonunda geri alınır) → sistemde yalnız bu iki yönetici kalır
  const keep = [await mkStaff('esA', 'admin'), await mkStaff('esB', 'admin')];
  const others = (await one(`SELECT user_id FROM platform_role WHERE role = 'admin' AND revoked_at IS NULL AND NOT (user_id = ANY($1::uuid[]))`, [keep])).map(r => r.user_id as string);
  await one(`UPDATE platform_role SET revoked_at = now() WHERE user_id = ANY($1::uuid[])`, [others]);
  try {
    const [a1, a2] = keep as [string, string]; const c1 = new pg.Client({ connectionString: config.databaseUrl }), c2 = new pg.Client({ connectionString: config.databaseUrl }); await c1.connect(); await c2.connect();
    try {
      await c1.query('BEGIN'); await c2.query('BEGIN');
      const p1 = c1.query('SELECT platform_role_set($1,$2,$3,$4)', [a1, a2, 'consultant', 'eşzamanlı düşürme 1']).then(() => 'ok', e => String(e.message));
      await new Promise(r => setTimeout(r, 150));
      const p2 = c2.query('SELECT platform_role_set($1,$2,$3,$4)', [a2, a1, 'consultant', 'eşzamanlı düşürme 2']).then(() => 'ok', e => String(e.message));
      const r1 = await p1; const c1done = r1 === 'ok' ? c1.query('COMMIT') : c1.query('ROLLBACK'); await c1done; const r2 = await p2; await (r2 === 'ok' ? c2.query('COMMIT') : c2.query('ROLLBACK'));
      const n = Number((await one(`SELECT COUNT(*) AS n FROM platform_role WHERE role = 'admin' AND revoked_at IS NULL`))[0].n);
      assert.ok(n >= 1, `eşzamanlı düşürmede yönetici kalmadı (${r1} / ${r2})`); assert.ok([r1, r2].filter(x => x === 'ok').length === 1 && [r1, r2].some(x => /last_admin|platform_admin_required/.test(x)), `tam biri başarılı olmalı; diğeri kilitten sonra ya son yönetici ya da artık yönetici olmadığı için reddedilmeli: ${r1} / ${r2}`);
    } finally { await c1.end(); await c2.end(); }
  } finally {
    await one(`UPDATE platform_role SET role = 'admin', revoked_at = NULL WHERE user_id = ANY($1::uuid[])`, [keep]); await one(`UPDATE platform_role SET revoked_at = NULL WHERE user_id = ANY($1::uuid[])`, [others]);
    await login('platform@hpw.test', 'root', 'Platform12345'); // rol değişimi oturumları kapatmış olabilir
  }
});

test('Güncel yetki: atama bitince, süre dolunca ve rol iptalinde sonraki istek eski yetkiyle çalışmaz; beyan edilen oturum kapanışı fiilen olur', async () => {
  const D = await mkTenant('WD'); const E = await mkTenant('WE'); const ya = await mkStaff('danD', 'consultant', [D, E], 'backup');
  assert.equal((await api('GET', `/api/t/${D}/overview`, undefined, 'danD')).status, 200);
  assert.equal((await api('POST', `/api/platform/tenants/${D}/assignments/${ya}/end`, { reason: 'görev bitti' }, 'root')).status, 200);
  assert.equal((await api('GET', `/api/t/${D}/overview`, undefined, 'danD')).status, 403, 'atama bitince aynı oturumun sonraki isteği reddedilir');
  assert.equal((await api('GET', `/api/t/${E}/overview`, undefined, 'danD')).status, 200, 'diğer şirket ataması sürer');
  await one(`UPDATE platform_tenant_access SET valid_to = CURRENT_DATE - 1 WHERE user_id = $1 AND tenant_id = $2`, [ya, E]);
  assert.equal((await api('GET', `/api/t/${E}/overview`, undefined, 'danD')).status, 403, 'süresi dolan atama sonraki istekte geçersiz');
  const pf = (await api('GET', '/api/platform/portfolio', undefined, 'danD')).body as unknown as { items: { id: string }[] }; assert.ok(!pf.items.some(x => x.id === D || x.id === E), 'süresi dolan/biten şirket portföyde görünmez');
  assert.equal((await api('POST', `/api/platform/staff/${ya}/revoke`, { reason: 'ayrıldı' }, 'root')).status, 200);
  assert.equal((await api('GET', '/api/platform/me', undefined, 'danD')).status, 401, 'rol iptalinde oturum fiilen kapanır');
  assert.equal(Number((await one(`SELECT COUNT(*) AS n FROM session WHERE user_id = $1 AND realm = 'platform'`, [ya]))[0].n), 0, 'iptal edilen personelin oturum kaydı kalmaz');
});

test('V290-06 müdahale izi (gerçek PostgreSQL): iş etkisi ve merkezi kayıt aynı transaction; kayıt yazılamazsa iş geri alınır; makbuz kaybında tekrar çift kayıt üretmez; bağlantı çökmesinde ikisi de kalmaz', async () => {
  const G = await mkTenant('WG');
  const iv = await api('POST', `/api/platform/tenants/${G}/intervention`, { reason: 'v2.9.1 müdahale izi atomiklik testi', minutes: 15 }, 'root'); assert.equal(iv.status, 200, JSON.stringify(iv.body)); const iid = iv.body.id as string;
  const snooze = (key: string, idem: string) => api('POST', `/api/t/${G}/attention/${encodeURIComponent(key)}/snooze`, { until: '2027-01-01T00:00:00Z' }, 'root', { 'idempotency-key': idem });
  // 1) normal yol: iş etkisi + şirket audit'i + merkezi müdahale kaydı, aynı transaction (xmin eşit)
  const k1 = `iv-${S}-1`; const r1 = await snooze('v291:ok', k1); assert.equal(r1.status, 200, JSON.stringify(r1.body));
  const biz = await one(`SELECT xmin::text AS x FROM attention_item WHERE tenant_id = $1 AND dedupe_key = 'v291:ok'`, [G]); const pae = await one(`SELECT xmin::text AS x, request_id FROM platform_audit_event WHERE intervention_id = $1 AND action = 'intervention.write'`, [iid]);
  assert.equal(biz.length, 1); assert.equal(pae.length, 1, 'tek merkezi müdahale kaydı'); assert.equal(pae[0].x, biz[0].x, 'iş etkisi ve merkezi kayıt aynı transaction'); assert.equal(pae[0].request_id, `${k1}#1`);
  // 2) makbuz kaybı: aynı komut anahtarıyla yeniden gönderim çift kayıt üretmez
  const r1b = await snooze('v291:ok', k1); assert.equal(r1b.status, 200); assert.equal(Number((await one(`SELECT COUNT(*) AS n FROM platform_audit_event WHERE intervention_id = $1 AND action = 'intervention.write'`, [iid]))[0].n), 1, 'yeniden denemede çift kayıt yok');
  // 3) arıza enjeksiyonu: merkezi kayıt yazılamazsa (yetki geri alındı) istek başarısız olur ve iş etkisi ile şirket audit'i kalıcılaşmaz
  await one('REVOKE INSERT ON platform_audit_event FROM hpw_app');
  try { const r2 = await snooze('v291:fail', `iv-${S}-2`); assert.ok(r2.status >= 500, 'kayıt yazılamayınca başarı dönmez: ' + r2.status); }
  finally { await one('GRANT INSERT ON platform_audit_event TO hpw_app'); }
  assert.equal((await one(`SELECT COUNT(*) AS n FROM attention_item WHERE tenant_id = $1 AND dedupe_key = 'v291:fail'`, [G]))[0].n, '0', 'iş etkisi geri alındı');
  assert.equal((await one(`SELECT COUNT(*) AS n FROM audit_event WHERE tenant_id = $1 AND entity_type = 'attention_item' AND new_value->>'key' = 'v291:fail'`, [G]))[0].n, '0', 'şirket audit kaydı da geri alındı');
  // arızadan sonra aynı işlem yeniden denenince bir kez uygulanır ve tek kayıt oluşur
  const r3 = await snooze('v291:fail', `iv-${S}-3`); assert.equal(r3.status, 200); assert.equal(Number((await one(`SELECT COUNT(*) AS n FROM platform_audit_event WHERE intervention_id = $1 AND action = 'intervention.write'`, [iid]))[0].n), 2);
  // 4) süreç/bağlantı çökmesi: iş satırı ve merkezi kayıt yazılmış ama COMMIT'ten önce bağlantı düşerse ikisi de kalmaz
  const c = new pg.Client({ connectionString: config.databaseUrl }); await c.connect(); const me = (await api('GET', '/api/platform/me', undefined, 'root')).body as unknown as { userId: string };
  const pid = (await c.query('SELECT pg_backend_pid() AS p')).rows[0].p; await c.query('BEGIN'); await c.query(`SELECT set_config('app.realm','platform',true), set_config('app.user_id',$1,true), set_config('app.tenant_id',$2,true), set_config('app.platform_write','on',true)`, [me.userId, G]);
  await c.query(`INSERT INTO attention_item (tenant_id, audience_person_id, item_type, severity, entity_type, entity_id, dedupe_key, state, sla_due_at) VALUES ($1,$1,'snooze','info','attention',$1,'v291:crash','snoozed','2027-01-01')`, [G]);
  await c.query(`INSERT INTO platform_audit_event (actor_id, action, tenant_id, target_type, target_id, result, request_id, intervention_id) VALUES ($1,'intervention.write',$2,'route','crash','ok','crash#1',$3)`, [me.userId, G, iid]);
  c.on('error', () => null); await one('SELECT pg_terminate_backend($1)', [pid]); await c.query('COMMIT').catch(() => null); await c.end().catch(() => null);
  assert.equal((await one(`SELECT COUNT(*) AS n FROM attention_item WHERE tenant_id = $1 AND dedupe_key = 'v291:crash'`, [G]))[0].n, '0'); assert.equal((await one(`SELECT COUNT(*) AS n FROM platform_audit_event WHERE request_id = 'crash#1'`))[0].n, '0');
  await api('POST', `/api/platform/interventions/${iid}/end`, {}, 'root');
});
