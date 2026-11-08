/** v2.9.0 MFA (K9): RFC 6238 TOTP (HMAC-SHA1, 30 sn, 6 hane, ±1 adım) + tek kullanımlık kurtarma kodları. Sır AES-256-GCM ile şifreli saklanır.
 * Anahtar: HPW_MFA_KEY (üretimde ve yerel paketlerde zorunlu; biçim ve değişim: docs/MFA-ANAHTARI.md). */
import { createHmac, randomBytes, createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'node:crypto';
import { config, mfaKeyProblem, mfaFallbackAllowed } from './config.js';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function b32encode(buf: Buffer): string { let bits = 0, val = 0, out = ''; for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += B32[(val << (5 - bits)) & 31]; return out; }
export function b32decode(s: string): Buffer { const clean = s.replace(/[\s=-]/g, '').toUpperCase(); let bits = 0, val = 0; const out: number[] = []; for (const ch of clean) { const i = B32.indexOf(ch); if (i < 0) throw new Error('bad_base32'); val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
export function totpAt(secret: Buffer, step: number): string { const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step)); const h = createHmac('sha1', secret).update(msg).digest(); const o = h[h.length - 1]! & 15; const code = ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0'); return code; }
export const currentStep = (now = Date.now()) => Math.floor(now / 30000);
/** kod geçerliyse eşleşen adım; değilse null (±1 adım tolerans) */
export function verifyTotp(secret: Buffer, code: string, now = Date.now()): number | null { if (!/^\d{6}$/.test(code)) return null; const s = currentStep(now); for (const st of [s - 1, s, s + 1]) { const c = totpAt(secret, st); if (timingSafeEqual(Buffer.from(c), Buffer.from(code))) return st; } return null; }
/** V290-05: anahtarlar. v2 biçimi: v2.<anahtar kimliği>.<iv>.<etiket>.<şifreli>; anahtar HPW_MFA_KEY (base64url ≥32 bayt).
 * Anahtar değişimi: yeni anahtar HPW_MFA_KEY, eski anahtar HPW_MFA_KEY_PREVIOUS; eski anahtarla mühürlü sır başarılı doğrulamada yeni anahtarla yeniden mühürlenir.
 * v1 (v2.9.0) sırlar okunabilir: HPW_MFA_KEY/PREVIOUS ham değeri ve — yalnız üretim dışı — v2.9.0'ın kurulum kimliğinden türettiği malzeme. Üretimde türetilmiş anahtar hiçbir zaman kullanılmaz. */
type K = { kid: string; key: Buffer };
const v2key = (raw: string): K => { const key = createHash('sha256').update(Buffer.concat([Buffer.from('hpw-mfa-v2|'), Buffer.from(raw, 'base64url')])).digest(); return { kid: createHash('sha256').update(key).digest('hex').slice(0, 12), key }; };
const devKey = (): K => ({ kid: 'dev', key: createHash('sha256').update('hpw-mfa-dev|' + `${config.installId || 'dev'}|${config.databaseUrl}`).digest() });
function currentKey(): K { const raw = process.env.HPW_MFA_KEY; if (raw && !mfaKeyProblem('HPW_MFA_KEY', raw)) return v2key(raw); if (mfaFallbackAllowed()) return devKey(); throw new Error('mfa_key_missing'); }
function readKeys(): K[] { const out: K[] = []; try { out.push(currentKey()); } catch { /* yok */ } const prev = process.env.HPW_MFA_KEY_PREVIOUS; if (prev && !mfaKeyProblem('HPW_MFA_KEY_PREVIOUS', prev)) out.push(v2key(prev)); if (mfaFallbackAllowed() && !out.some(k => k.kid === 'dev')) out.push(devKey()); return out; }
function v1Keys(): Buffer[] { const mats = [process.env.HPW_MFA_KEY, process.env.HPW_MFA_KEY_PREVIOUS].filter((x): x is string => !!x); if (!config.production) mats.push(`${config.installId ?? 'dev'}|${config.databaseUrl}`); return mats.map(m => createHash('sha256').update('hpw-mfa|' + m).digest()); }
export function seal(plain: string): string { const k = currentKey(); const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', k.key, iv); const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]); return `v2.${k.kid}.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`; }
const open = (key: Buffer, iv: string, tag: string, enc: string) => { const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url')); d.setAuthTag(Buffer.from(tag, 'base64url')); return Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8'); };
export function unseal(sealed: string): string {
  const parts = sealed.split('.');
  if (parts[0] === 'v2' && parts.length === 5) { const k = readKeys().find(x => x.kid === parts[1]); if (!k) throw new Error('mfa_key_unknown'); return open(k.key, parts[2]!, parts[3]!, parts[4]!); }
  if (parts[0] === 'v1' && parts.length === 4) { for (const key of v1Keys()) { try { return open(key, parts[1]!, parts[2]!, parts[3]!); } catch { /* sonraki aday */ } } throw new Error('mfa_key_unknown'); }
  throw new Error('bad_seal');
}
/** mevcut anahtarla mühürlü değilse (v1 ya da eski anahtar) yeniden mühürlenmeli */
export function needsReseal(sealed: string): boolean { try { return !sealed.startsWith(`v2.${currentKey().kid}.`); } catch { return false; } }
export const newSecret = () => b32encode(randomBytes(20));
export const recoveryHash = (code: string) => createHash('sha256').update('hpw-rc|' + code.replace(/[\s-]/g, '').toUpperCase()).digest('hex');
export function newRecoveryCodes(n = 10): string[] { return Array.from({ length: n }, () => { const s = b32encode(randomBytes(6)).slice(0, 10); return `${s.slice(0, 5)}-${s.slice(5)}`; }); }
/** hassas işlemler son 10 dakika içinde doğrulanmış oturum ister */
export const REAUTH_WINDOW_MS = 10 * 60 * 1000;
