/** V290-05 (yapılandırma + şifreleme kodu, ayrı süreçlerde gerçek ortam değişkenleriyle): üretim göstergeleri × MFA anahtarı matrisi, ortam çelişkisi, anahtar değişimi, v1 geriye uyum. Anahtar değerleri çıktıya yazılmaz. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const good = () => randomBytes(32).toString('base64url');
const base = { SETUP_KEY: 'test-only-setup-key-0001', COOKIE_SECURE: 'true', APP_BASE_URL: 'https://hpw.invalid', DATABASE_URL: 'postgres://svc:generated-pw@localhost/x', HPW_INSTALL_ID: 'inst-1' };
function run(env: Record<string, string | undefined>, body: string) {
  const e: Record<string, string> = { PATH: process.env.PATH ?? '' }; for (const [k, v] of Object.entries({ ...base, ...env })) if (v !== undefined) e[k] = v;
  const script = `const c = await import('./src/config.ts'); const m = await import('./src/mfa.ts'); const out = {}; ${body}; console.log(JSON.stringify(out));`;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { env: e, encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname });
  assert.equal(r.status, 0, r.stderr.slice(0, 400)); return JSON.parse(r.stdout.trim().split('\n').pop()!) as Record<string, unknown>;
}
const probs = `out.problems = c.validateConfig(); out.mfa = out.problems.filter(p => p.includes('HPW_MFA_KEY')).length; out.conflict = out.problems.filter(p => p.includes('çelişiyor')).length;`;
for (const [label, key] of [['eksik', undefined], ['boş', ''], ['kısa', 'x'], ['bozuk biçim', 'bu+anahtar/değil=='], ['düşük çeşitlilik', 'A'.repeat(44)]] as [string, string | undefined][]) {
  test(`V290-05 üretimde MFA anahtarı ${label} → başlangıç reddedilir`, () => { const o = run({ NODE_ENV: 'production', HPW_ENV: 'production', HPW_MFA_KEY: key }, probs); assert.equal(o.mfa, 1, JSON.stringify(o.problems)); });
  test(`V290-05 yerel paket (bos) MFA anahtarı ${label} → başlangıç reddedilir`, () => { const o = run({ HPW_ENV: 'bos', HPW_MFA_KEY: key }, probs); assert.equal(o.mfa, 1); });
}
test('V290-05 üretimde geçerli anahtar → sorun yok; mühür v2 ve açılır; türetilmiş anahtar kullanılmaz', () => {
  const o = run({ NODE_ENV: 'production', HPW_ENV: 'production', HPW_MFA_KEY: good() }, probs + ` const s = m.seal('synthetic-seed'); out.v2 = s.startsWith('v2.') && !s.startsWith('v2.dev.'); out.round = m.unseal(s) === 'synthetic-seed';`);
  assert.deepEqual(o.problems, []); assert.equal(o.v2, true); assert.equal(o.round, true);
});
test('V290-05 ortam çelişkisi: NODE_ENV=production + HPW_ENV=bos ve HPW_ENV=production + NODE_ENV yok → reddedilir', () => {
  assert.equal(run({ NODE_ENV: 'production', HPW_ENV: 'bos', HPW_MFA_KEY: good() }, probs).conflict, 1);
  const o = run({ HPW_ENV: 'production', HPW_MFA_KEY: good() }, probs); assert.equal(o.conflict, 1); assert.ok((o.problems as string[]).some(p => p.includes('SETUP_KEY') || p.includes('çelişiyor')));
});
test('V290-05 üretimde anahtar yokken mühürleme çalışmaz (geri dönüş anahtarı sızmaz)', () => {
  const o = run({ NODE_ENV: 'production', HPW_ENV: 'production' }, `try { m.seal('x'); out.sealed = true; } catch (e) { out.err = String(e.message); }`); assert.equal(o.sealed, undefined); assert.equal(o.err, 'mfa_key_missing');
});
test('V290-05 dev/test: anahtarsız geri dönüş yalnız açıkça dev/test ortamında', () => {
  assert.equal(run({ HPW_ENV: 'test' }, probs).mfa, 0); assert.equal(run({ HPW_ENV: 'dev' }, probs).mfa, 0); assert.equal(run({ HPW_ENV: 'demo' }, probs).mfa, 1);
});
test('V290-05 anahtar değişimi: eski anahtar PREVIOUS iken eski mühür açılır, yeniden mühür gerekir; yeni mühür yeni anahtarla; aynı anahtar iki alana yazılamaz', () => {
  const A = good(), B = good();
  const s = String(run({ HPW_ENV: 'bos', HPW_MFA_KEY: A }, `out.s = m.seal('rotation-seed');`).s);
  const o = run({ HPW_ENV: 'bos', HPW_MFA_KEY: B, HPW_MFA_KEY_PREVIOUS: A }, probs + ` out.open = m.unseal(${JSON.stringify(s)}) === 'rotation-seed'; out.need = m.needsReseal(${JSON.stringify(s)}); const n = m.seal('rotation-seed'); out.newNeed = m.needsReseal(n);`);
  assert.deepEqual(o.problems, []); assert.equal(o.open, true); assert.equal(o.need, true); assert.equal(o.newNeed, false);
  const lost = run({ HPW_ENV: 'bos', HPW_MFA_KEY: B }, `try { m.unseal(${JSON.stringify(s)}); out.opened = true; } catch (e) { out.err = String(e.message); }`); assert.equal(lost.err, 'mfa_key_unknown', 'eski anahtar verilmezse eski mühür açılmaz');
  assert.equal(run({ HPW_ENV: 'bos', HPW_MFA_KEY: A, HPW_MFA_KEY_PREVIOUS: A }, probs).mfa, 1);
});
test('V290-05 v2.9.0 (v1) mühürleri: yerel pakette yükseltmede okunur; üretimde türetilmiş malzemeyle okunmaz', async () => {
  const { createCipheriv, createHash, randomBytes: rb } = await import('node:crypto');
  const legacyKey = createHash('sha256').update('hpw-mfa|' + `inst-1|${base.DATABASE_URL}`).digest(); const iv = rb(12); const c = createCipheriv('aes-256-gcm', legacyKey, iv); const enc = Buffer.concat([c.update('legacy-seed', 'utf8'), c.final()]);
  const v1 = `v1.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
  const bos = run({ HPW_ENV: 'bos', HPW_MFA_KEY: good() }, `out.open = m.unseal(${JSON.stringify(v1)}) === 'legacy-seed'; out.need = m.needsReseal(${JSON.stringify(v1)});`); assert.equal(bos.open, true); assert.equal(bos.need, true);
  const prod = run({ NODE_ENV: 'production', HPW_ENV: 'production', HPW_MFA_KEY: good() }, `try { m.unseal(${JSON.stringify(v1)}); out.opened = true; } catch (e) { out.err = String(e.message); }`); assert.equal(prod.err, 'mfa_key_unknown');
});
