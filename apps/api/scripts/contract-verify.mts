/** N04: gerçek HTTP başarı yanıtlarını (test örnekleri) sözleşmedeki yanıt şemalarına karşı doğrular; sapma testi düşürür. Kullanım: node --import tsx scripts/contract-verify.mts var/contract-samples.jsonl */
import { readFileSync } from 'node:fs';
type S = { type?: string | string[]; properties?: Record<string, S>; required?: string[]; items?: S; enum?: unknown[]; format?: string; additionalProperties?: S };
const RESP = JSON.parse(readFileSync(new URL('../src/contract/responses.json', import.meta.url), 'utf8')) as Record<string, S>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function check(v: unknown, s: S, p = '$', ignoreIdFormat = false): string | null {
  if (!s || !s.type) return null; const ts = Array.isArray(s.type) ? s.type : [s.type];
  const t = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v;
  if (!ts.includes(t) && !(t === 'integer' && ts.includes('number'))) return `${p}: ${ts.join('|')} bekleniyordu, ${t} geldi`;
  if (s.enum && !s.enum.includes(v as never)) return `${p}: izin verilmeyen değer ${JSON.stringify(v)}`;
  if (!ignoreIdFormat && t === 'string' && s.format === 'uuid' && !UUID.test(v as string)) return `${p}: uuid bekleniyordu`;
  if (t === 'object') { const o = v as Record<string, unknown>; for (const r of s.required ?? []) if (!(r in o)) return `${p}.${r}: zorunlu alan yok`; for (const [k, sub] of Object.entries(s.properties ?? {})) if (k in o) { const e = check(o[k], sub, `${p}.${k}`, ignoreIdFormat); if (e) return e; } if (s.additionalProperties) for (const [k, x] of Object.entries(o)) { const e = check(x, s.additionalProperties, `${p}.${k}`, ignoreIdFormat); if (e) return e; } }
  if (t === 'array' && s.items) for (let i = 0; i < (v as unknown[]).length; i++) { const e = check((v as unknown[])[i], s.items, `${p}[${i}]`, ignoreIdFormat); if (e) return e; }
  return null;
}
if (process.argv[2]) { const lines = readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as { m: string; u: string; b: unknown });
  const errs: string[] = []; let n = 0; for (const l of lines) { const s = RESP[`${l.m} ${l.u}`]; if (!s) { errs.push(`${l.m} ${l.u}: sözleşmede yanıt şeması yok`); continue; } n++; const e = check(l.b, s); if (e) errs.push(`${l.m} ${l.u}: ${e}`); }
  console.log('SÖZLEŞME DOĞRULAMASI', n, 'gerçek yanıt;', errs.length, 'sapma'); if (errs.length) { console.log([...new Set(errs)].slice(0, 20).join('\n')); process.exit(1); } }
