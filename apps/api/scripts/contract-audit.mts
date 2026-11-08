/** R04 kapısı: sözleşmede yalnız-null ya da türsüz dizi elemanı konumu kalmamalı; domain-map'teki her kural kullanılmış ve her belirsiz ad çözülmüş olmalı. */
import { readFileSync } from 'node:fs';
type S = { type?: string | string[]; properties?: Record<string, S>; items?: S; additionalProperties?: S; binary?: string; description?: string };
const R = JSON.parse(readFileSync(new URL('../src/contract/responses.json', import.meta.url), 'utf8')) as Record<string, S>;
const A = JSON.parse(readFileSync(new URL('../src/contract/schema-audit.json', import.meta.url), 'utf8')) as { applied: number; unresolved: string[]; unusedRules: string[] };
const nullOnly: string[] = [], untyped: string[] = [];
function walk(s: S, p: string) { if (!s || s.binary) return; const t = Array.isArray(s.type) ? s.type : s.type ? [s.type] : [];
  if (!t.length && !s.additionalProperties) untyped.push(p); if (t.length === 1 && t[0] === 'null') nullOnly.push(p);
  for (const [k, v] of Object.entries(s.properties ?? {})) walk(v, `${p}.${k}`); if (s.items) walk(s.items, `${p}[]`); if (s.additionalProperties) walk(s.additionalProperties, `${p}.*`); }
for (const [k, v] of Object.entries(R)) if (!k.startsWith('$')) walk(v, k);
const bad = [...nullOnly.map(x => 'yalnız-null: ' + x), ...untyped.map(x => 'türsüz: ' + x), ...A.unresolved.map(x => 'çözümsüz belirsiz ad: ' + x), ...A.unusedRules.map(x => 'kullanılmayan kural: ' + x)];
console.log('SÖZLEŞME KAPSAM DENETİMİ', Object.keys(R).length - 1, 'uç;', A.applied, 'domain kuralı;', bad.length, 'sorun'); if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
