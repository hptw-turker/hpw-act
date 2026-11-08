import type { FastifyInstance } from 'fastify';
import { withContext, HttpError } from '../db.js';
import { hashPassword, verifyPassword, newToken, tokenHash, setSessionCookie, clearSessionCookie, requireAuth, validatePassword } from '../auth.js';
import { config } from '../config.js';
import { runOutboxOnce } from '../mailer.js';

const S = { login: { body: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', maxLength: 200 }, password: { type: 'string', maxLength: 200 }, tenantCode: { type: 'string', pattern: '^[A-Za-z0-9_-]{3,24}$' } } } }, switchT: { body: { type: 'object', required: ['tenantId'], properties: { tenantId: { type: 'string', format: 'uuid' } } } }, pw: { body: { type: 'object', required: ['password'], properties: { password: { type: 'string', maxLength: 200 } } } }, forgot: { body: { type: 'object', required: ['email'], properties: { email: { type: 'string', maxLength: 200 } } } } };

/** başarılı doğrulamada sayaç sıfırlanır (yalnız başarısız denemeler kilitler) */
export async function rateReset(kind: string, subject: string, ip: string) { await withContext({ realm: 'anon' }, tx => tx.query('SELECT auth_login_attempt($1,true)', [`${kind}|${subject.toLocaleLowerCase('en-US')}|${ip}`])); }
export async function rateLimit(kind: string, subject: string, ip: string) { const ok = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT auth_login_attempt($1,false) AS ok', [`${kind}|${subject.toLocaleLowerCase('en-US')}|${ip}`])).rows[0].ok); if (!ok) throw new HttpError(429, 'too_many_attempts', 'Çok fazla deneme; 15 dakika sonra tekrar deneyin'); }
async function rateClear(kind: string, subject: string, ip: string) { await withContext({ realm: 'anon' }, tx => tx.query('SELECT auth_login_attempt($1,true)', [`${kind}|${subject.toLocaleLowerCase('en-US')}|${ip}`])); }
/** Şirket kodu yalnız ASCII harf/rakam taşır; Türkçe büyük harf dönüşümü burada gerekmez ve kullanılmaz. */
const asciiUpper = (x: string) => x.replace(/[a-z]/g, c => String.fromCharCode(c.charCodeAt(0) - 32));
export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', { schema: S.login }, async (req, reply) => {
    const { email, password, tenantCode } = req.body as { email: string; password: string; tenantCode?: string };
    const key = `${email.toLocaleLowerCase('en-US')}|${req.ip}`;
    const allowed = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT auth_login_attempt($1,false) AS ok', [key])).rows[0].ok); // R35: hız sınırı
    if (!allowed) throw new HttpError(429, 'too_many_attempts', 'Çok fazla deneme; 15 dakika sonra tekrar deneyin');
    const u = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM auth_lookup_user($1)', [email])).rows[0]);
    if (!u || u.status === 'disabled' || !verifyPassword(password, u.password_hash)) throw new HttpError(401, 'invalid_credentials', 'E-posta ya da parola hatalı');
    const memberships = u.realm === 'customer' ? await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM auth_memberships($1)', [u.id])).rows) : []; // R01: dar kapsamlı definer
    if (u.realm === 'customer' && memberships.length === 0) { const susp = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT auth_memberships_suspended($1) AS n', [u.id])).rows[0].n as number); if (susp > 0) throw new HttpError(403, 'tenant_suspended', 'Şirketinizin hizmeti Happy Place to Work tarafından geçici olarak durduruldu. Şirketinizin İK yöneticisine ya da HPW’ye başvurun.'); throw new HttpError(403, 'no_active_membership', 'Aktif bir şirket üyeliğiniz yok'); }
    // v3.0 (ADR-0043): şirkete özel giriş adresinden gelindiyse oturum o şirkette açılır; kullanıcı o şirketin üyesi değilse aynı genel hata döner (şirket üyeliği sızdırılmaz)
    const wanted = tenantCode ? asciiUpper(tenantCode) : null; const pick = wanted && u.realm === 'customer' ? memberships.find((m: { tenant_code: string }) => m.tenant_code === wanted) : memberships[0];
    if (u.realm === 'customer' && !pick) throw new HttpError(401, 'invalid_credentials', 'E-posta ya da parola hatalı');
    const tenantId = u.realm === 'customer' ? pick.tenant_id : null;
    const token = newToken();
    await withContext({ realm: 'anon' }, async tx => { await tx.query('SELECT auth_session_create($1,$2,$3,$4,$5::interval)', [tokenHash(token), u.id, u.realm, tenantId, `${config.sessionTtlHours} hours`]); await tx.query('SELECT auth_login_attempt($1,true)', [key]); });
    setSessionCookie(reply, token);
    return { ok: true, realm: u.realm, memberships: memberships.map((m: { tenant_id: string; tenant_name: string; tenant_code: string; permission_profile: string }) => ({ tenant_id: m.tenant_id, name: m.tenant_name, code: m.tenant_code })) };
  });
  /** v3.0: arayüz kipi — kapalı modüller anahtarı kapalıysa sade arayüz (v3), açıksa eski arayüz */
  app.get('/api/public/app', async () => ({ mode: config.legacyModules ? 'legacy' : 'v3' }));
  /** v3.0: şirkete özel giriş sayfası başlığı (/g/<kod>) — oturumsuz; yalnız etkin şirketin kodu ve adı */
  app.get('/api/public/tenant/:code', async req => {
    const { code } = req.params as { code: string }; if (!/^[A-Za-z0-9_-]{3,24}$/.test(code)) throw new HttpError(404, 'not_found', 'Şirket bulunamadı');
    const r = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM auth_tenant_by_code($1)', [asciiUpper(code)])).rows[0]);
    if (!r) throw new HttpError(404, 'not_found', 'Şirket bulunamadı'); return { code: r.tenant_code, name: r.tenant_name };
  });
  app.post('/api/auth/logout', async (req, reply) => { const raw = req.cookies?.[config.cookieName]; if (raw) await withContext({ realm: 'anon' }, tx => tx.query('SELECT auth_session_revoke($1)', [tokenHash(raw)])); clearSessionCookie(reply); return { ok: true }; });
  app.get('/api/auth/me', async req => { const p = requireAuth(req); const memberships = p.realm === 'customer' ? await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT tenant_id, tenant_name, tenant_code FROM auth_memberships($1)', [p.userId])).rows) : []; return { userId: p.userId, email: p.email, displayName: p.displayName, realm: p.realm, tenantId: p.tenantId, profile: p.profile ?? null, companyWide: p.companyWide ?? false, scopes: p.scopes ?? [], roleUnitIds: p.roleUnitIds ?? [], memberships, env: config.envName }; });
  app.post('/api/auth/switch-tenant', { schema: S.switchT }, async req => { const p = requireAuth(req); const { tenantId } = req.body as { tenantId: string }; const ok = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT auth_session_switch_tenant($1,$2) AS ok', [tokenHash(p.sessionToken), tenantId])).rows[0].ok); if (!ok) throw new HttpError(403, 'tenant_not_authorized', 'Bu şirkette aktif üyeliğiniz ya da yetkiniz yok'); if (p.realm === 'platform') await withContext({ realm: 'platform', userId: p.userId, tenantId }, tx => tx.query('INSERT INTO platform_audit_event (actor_id, action, tenant_id, target_type, target_id) VALUES ($1,$2,$3,$4,$5)', [p.userId, 'tenant.enter', tenantId, 'tenant', tenantId])); return { ok: true }; }); // v2.9.0: HPW personelinin şirket ekranına girişi kayıt altında (K8)
  // parola sıfırlama (R35): e-posta her durumda aynı yanıt; bağlantı süreli ve tek kullanımlık
  app.post('/api/auth/forgot', { schema: S.forgot }, async req => {
    const { email } = req.body as { email: string }; const token = newToken(); await rateLimit('forgot', email, req.ip); // N10
    const u = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM auth_password_token_create($1,$2,$3,$4::interval)', [email, 'reset', tokenHash(token), `${config.resetTtlMinutes} minutes`])).rows[0]);
    if (u) { await withContext({ realm: 'worker' }, tx => tx.query('INSERT INTO email_outbox (to_email, subject, body_text, idempotency_key) VALUES ($1,$2,$3,$4)', [email, 'HPW Act · parola sıfırlama', `Sayın ${u.display_name},\n\nParolanızı sıfırlamak için bağlantınız (${config.resetTtlMinutes} dakika geçerli, tek kullanımlık):\n${config.appBaseUrl}/#/parola/${token}\n\nBu isteği siz yapmadıysanız bu e-postayı yok sayın.`, `reset-${u.user_id}-${Date.now()}`])); await runOutboxOnce(10).catch(() => null); }
    return { ok: true, message: 'Kayıtlı bir hesap varsa sıfırlama bağlantısı gönderildi' };
  });
  app.post('/api/auth/reset/:token', { schema: S.pw }, async (req, reply) => { const { token } = req.params as { token: string }; const { password } = req.body as { password: string }; await rateLimit('reset', token.slice(0, 12), req.ip); /* N10 */ const bad = validatePassword(password); if (bad) throw new HttpError(400, 'weak_password', bad); const r = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM auth_password_token_consume($1,$2)', [tokenHash(token), hashPassword(password)])).rows[0]); if (!r) throw new HttpError(404, 'token_invalid', 'Bağlantı geçersiz, kullanılmış ya da süresi dolmuş'); clearSessionCookie(reply); return { ok: true, email: r.email, next: 'login' }; });
  // davet: GET bakar; POST parola kurar (yeni kimlik) ya da üyeliğe katılır (mevcut parolalı kimlik, R10)
  app.get('/api/invitations/:token', async req => { const { token } = req.params as { token: string }; const row = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM invitation_peek($1)', [tokenHash(token)])).rows[0]); if (!row) throw new HttpError(404, 'invitation_invalid', 'Davet geçersiz ya da süresi dolmuş'); return { tenantName: row.tenant_name, email: row.email, displayName: row.display_name, expiresAt: row.expires_at, hasPassword: row.has_password }; });
  app.post('/api/invitations/:token/accept', async (req, reply) => {
    const { token } = req.params as { token: string }; const { password } = (req.body ?? {}) as { password?: string }; await rateLimit('invite', token.slice(0, 12), req.ip); // N10: mevcut parola doğrulaması da sınırlı
    const peek = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM invitation_peek($1)', [tokenHash(token)])).rows[0]); if (!peek) { const used = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM invitation_used_peek($1)', [tokenHash(token)])).rows[0]).catch(() => null as null | { email: string; status: string; accepted_at: string }); if (used && used.status === 'accepted') throw new HttpError(410, 'invitation_already_accepted', `Bu davet daha önce kabul edilmiş (${String(used.accepted_at).slice(0, 10)}). Yanıt kaybolduysa hesabınız hazırdır: ${used.email} ile belirlediğiniz parolayla giriş yapın ya da parola sıfırlama isteyin`, { email: used.email, acceptedAt: used.accepted_at }); throw new HttpError(404, 'invitation_invalid', 'Davet geçersiz ya da süresi dolmuş'); };
    if (!peek.has_password) { const bad = validatePassword(password ?? ''); if (bad) throw new HttpError(400, 'weak_password', bad); }
    else { if (!password) throw new HttpError(400, 'password_required', 'Mevcut hesabınızın parolasını girin'); const u = await withContext({ realm: 'anon' }, async tx => (await tx.query('SELECT * FROM auth_lookup_user($1)', [peek.email])).rows[0]); if (!u || !verifyPassword(password, u.password_hash)) throw new HttpError(401, 'invalid_credentials', 'Mevcut parola hatalı; davet mevcut hesabınıza bağlanacak'); await rateClear('invite', token.slice(0, 12), req.ip); }
    const row = await withContext({ realm: 'anon' }, async tx => { const r = (await tx.query('SELECT * FROM invitation_accept($1,$2)', [tokenHash(token), peek.has_password ? '' : hashPassword(password!)])).rows[0]; await tx.query('SELECT invitation_mark_consumed($1)', [tokenHash(token)]); return r; }); // P0-3: tüketilen token hash'i aynı transaction'da işaretlenir (yanıt kaybında 410 + e-posta)
    if (!row) throw new HttpError(404, 'invitation_invalid');
    const st = newToken(); await withContext({ realm: 'anon' }, tx => tx.query('SELECT auth_session_create($1,$2,$3,$4,$5::interval)', [tokenHash(st), row.user_id, 'customer', row.tenant_id, `${config.sessionTtlHours} hours`]));
    setSessionCookie(reply, st); return { ok: true, email: row.email, mode: row.mode, tenantId: row.tenant_id };
  });
}
