// Tanı: aynı V2100-URL gezinme dizisi GERÇEK uygulama sunucusuna (gerçek HTTP + gerçek PostgreSQL; kılavuz/demo veritabanı) karşı, istek yakalama OLMADAN.
// Oturum API ile açılır (MFA kurulumu + TOTP), 30'dan fazla şirket yoksa sentetik şirketler API ile açılır; tarayıcıya oturum çerezi verilir.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const PW = require(process.env.PW_MODULE || '/home/claude/.npm-global/lib/node_modules/playwright');
const BASE = process.env.BASE || 'http://localhost:8787'; const EMAIL = process.env.EMAIL || 'platform@demo.hpw-act.local'; const PASS = process.env.PASS || 'Demo-Platform-2026';
const OUT = process.env.OUT || '/tmp/webkit-tani'; fs.mkdirSync(OUT, { recursive: true }); const d = ms => new Promise(r => setTimeout(r, ms));
const b32 = s => { const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''; for (const c of s.replace(/=+$/, '')) bits += a.indexOf(c).toString(2).padStart(5, '0'); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); };
const totp = (sec, dt = 0) => { const h = crypto.createHmac('sha1', b32(sec)).update((() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(Math.floor((Date.now() / 1000 + dt) / 30))); return b; })()).digest(); const o = h[h.length - 1] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0'); };
(async () => {
  let cookie = ''; const call = async (m, u, body) => { const r = await fetch(BASE + u, { method: m, headers: { 'content-type': 'application/json', cookie, 'idempotency-key': crypto.randomUUID() }, body: body ? JSON.stringify(body) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; return { status: r.status, body: await r.json().catch(() => null) }; };
  const lg = await call('POST', '/api/auth/login', { email: EMAIL, password: PASS }); if (lg.status !== 200) throw new Error('giriş ' + lg.status);
  const st = await call('GET', '/api/platform/mfa'); if (!st.body?.enabled) { const s = await call('POST', '/api/platform/mfa/setup', {}); const v = await call('POST', '/api/platform/mfa/verify', { code: totp(s.body.secret) }); if (v.status !== 200) throw new Error('mfa ' + v.status); } else throw new Error('MFA zaten etkin: tanı ortamında sıfırlanmalı');
  const pf = await call('GET', '/api/platform/portfolio'); const need = Math.max(0, 31 - pf.body.items.length);
  for (let i = 0; i < need; i++) await call('POST', '/api/platform/tenants', { code: 'WKT' + String(i).padStart(2, '0') + Date.now().toString(36).slice(-4).toUpperCase(), name: 'WebKit tanı şirketi ' + i });
  const b = await PW[process.env.ENGINE || 'webkit'].launch({ headless: true }); const [name, value] = cookie.split('='); const report = { engine: process.env.ENGINE || 'webkit', version: b.version(), mode: 'gerçek sunucu (istek yakalama yok)', companies: (await call('GET', '/api/platform/portfolio')).body.items.length, runs: [] };
  for (const upto of [3, 4, 5]) { const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } }); await ctx.addCookies([{ name, value, url: BASE }]); const p = await ctx.newPage(); const log = [];
    p.on('console', m => log.push(['console', m.type(), m.text().slice(0, 160)])); p.on('pageerror', e => log.push(['pageerror', String(e).slice(0, 200)])); p.on('crash', () => log.push(['CRASH']));
    p.on('framenavigated', f => { if (f === p.mainFrame()) log.push(['nav', f.url().split('#')[1] ?? f.url()]); });
    let result = 'ok'; try { await p.goto(BASE + '/app.html#/platform'); await d(1500);
      const steps = [() => p.locator('#f-sirala').selectOption('kod'), () => p.locator('#f-yon').selectOption('azalan'), () => p.getByRole('button', { name: 'Sonraki sayfa' }).click(), () => p.goBack(), () => p.goForward()];
      for (const s of steps.slice(0, upto)) { await s(); await d(300); } await p.reload(); await d(1000); log.push(['sonra', p.url().split('#')[1]]); } catch (e) { result = String(e).split('\n')[0]; }
    report.runs.push({ upto, result, log }); console.log(`[${report.engine} gerçek sunucu] adım≤${upto} → ${result}`); await ctx.close().catch(() => null); }
  fs.writeFileSync(path.join(OUT, `tani-${report.engine}-gercek-sunucu.json`), JSON.stringify(report, null, 2)); await b.close();
})().catch(e => { console.error('TANI HATASI', String(e)); process.exitCode = 2; });
