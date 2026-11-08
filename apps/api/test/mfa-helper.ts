/** Test yardımcısı (v2.9.0): platform girişinden sonra MFA kurulum/doğrulama. Sırlar test dosyaları arasında var/test-mfa-secrets.json ile paylaşılır (DB her koşuda sıfırlanır; kurulum yeniden yapılır). */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { b32decode, totpAt, currentStep } from '../src/mfa.js';
const F = new URL('../var/test-mfa-secrets.json', import.meta.url);
const load = (): Record<string, string> => { try { return JSON.parse(readFileSync(F, 'utf8')); } catch { return {}; } };
const save = (email: string, secret: string) => { mkdirSync(new URL('../var/', import.meta.url), { recursive: true }); const m = load(); m[email] = secret; writeFileSync(F, JSON.stringify(m)); };
export const secretFor = (email: string) => load()[email];
export const codeFor = (email: string, dtMs = 0) => totpAt(b32decode(load()[email]!), currentStep(Date.now() + dtMs));
type Call = (method: 'GET' | 'POST', url: string, body?: unknown) => Promise<{ status: number; body: Record<string, unknown> }>;
export async function ensureMfa(call: Call, email: string) {
  const st = await call('GET', '/api/platform/mfa'); if (st.status !== 200) throw new Error('mfa durumu okunamadı: ' + st.status);
  let secret = load()[email];
  if (!st.body.enabled) { const s = await call('POST', '/api/platform/mfa/setup', {}); if (s.status !== 200) throw new Error('mfa kurulumu: ' + JSON.stringify(s.body)); secret = String(s.body.secret); save(email, secret); }
  return submitFresh(call, '/api/platform/mfa/verify', secret!);
}

/** yeniden oynatma koruması nedeniyle aynı zaman adımı iki kez kullanılamaz: şimdiki ve bir sonraki adımı dener; ikisi de kullanılmışsa bir sonraki 30 sn’lik adımı bekler */
export async function submitFresh(call: Call, url: string, secret: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const dt of [0, 30000]) { const r = await call('POST', url, { code: totpAt(b32decode(secret), currentStep(Date.now() + dt)) }); if (r.status === 200) return r.body; if (r.status !== 422) throw new Error(`${url}: ${r.status} ${JSON.stringify(r.body)}`); }
    await new Promise(res => setTimeout(res, 30000 - (Date.now() % 30000) + 200));
  }
  throw new Error('MFA kodu kabul edilmedi: ' + url);
}
