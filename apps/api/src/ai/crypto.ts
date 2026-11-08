/** v2.13.0: şirket bazında yapay zekâ sağlayıcı anahtarının mühürlenmesi.
 * AES-256-GCM; anahtar malzemesi HPW_MFA_KEY'den alan ayrımıyla türetilir ('hpw-ai-provider-key-v1|'), MFA sırlarıyla aynı anahtarı kullanmaz.
 * Ek doğrulanmış veri (AAD) = şirket kimliği: A şirketi için mühürlenen anahtar B şirketi bağlamında açılamaz (etiket doğrulaması düşer). */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config, mfaKeyProblem, mfaFallbackAllowed } from '../config.js';
type K = { kid: string; key: Buffer };
const derive = (raw: Buffer): K => { const key = createHash('sha256').update(Buffer.concat([Buffer.from('hpw-ai-provider-key-v1|'), raw])).digest(); return { kid: createHash('sha256').update(key).digest('hex').slice(0, 12), key }; };
function keys(): K[] {
  const out: K[] = [];
  for (const name of ['HPW_MFA_KEY', 'HPW_MFA_KEY_PREVIOUS'] as const) { const v = process.env[name]; if (v && !mfaKeyProblem(name, v)) out.push(derive(Buffer.from(v, 'base64url'))); }
  if (!out.length && mfaFallbackAllowed()) out.push(derive(Buffer.from(`hpw-ai-dev|${config.installId || 'dev'}|${config.databaseUrl}`)));
  if (!out.length) throw new Error('ai_key_material_missing');
  return out;
}
const aad = (tenantId: string) => Buffer.from(`tenant:${tenantId}`);
export function sealProviderKey(tenantId: string, plain: string): string {
  const k = keys()[0]!; const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', k.key, iv); c.setAAD(aad(tenantId));
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `a1.${k.kid}.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}
export function openProviderKey(tenantId: string, sealed: string): string {
  const p = sealed.split('.'); if (p[0] !== 'a1' || p.length !== 5) throw new Error('ai_key_format');
  const k = keys().find(x => x.kid === p[1]); if (!k) throw new Error('ai_key_unknown');
  const d = createDecipheriv('aes-256-gcm', k.key, Buffer.from(p[2]!, 'base64url')); d.setAAD(aad(tenantId)); d.setAuthTag(Buffer.from(p[3]!, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(p[4]!, 'base64url')), d.final()]).toString('utf8');
}
