// Çeviri anahtarlarını kaynaktan toplar: arayüz (tt("…")), sunucu hata iletileri (HttpError), etiketler (labels.ts L).
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'; import { join } from 'node:path';
const walk = (d, out = []) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(tsx?|mts)$/.test(p)) out.push(p); } return out; };
const lit = /tt\(\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
const dec = s => s[0] === '"' ? JSON.parse(s) : s.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
const ui = new Set(); for (const f of walk('apps/web/src/product').filter(x => !x.endsWith('i18n.ts'))) { const s = readFileSync(f, 'utf8'); for (const m of s.matchAll(lit)) ui.add(dec(m[1])); }
// değişkenle çevrilen anahtarlar (tt(st)): kurulum durum kodları
for (const k of ['hazır', 'eksik', 'kısmen', 'kullanılabilir']) ui.add(k);
const api = readFileSync('apps/web/src/product/api.ts', 'utf8'); const fb = api.match(/const fallback: Record<ErrorKind, string> = \{([^}]*)\}/); if (fb) for (const m of fb[1].matchAll(/:\s*'((?:\\'|[^'])*)'/g)) ui.add(m[1]);
const server = new Set(); for (const f of walk('apps/api/src')) { const s = readFileSync(f, 'utf8'); for (const m of s.matchAll(/HttpError\(\s*\d+\s*,\s*'[^']*'\s*,\s*('(?:\\'|[^'])*'|"(?:\\"|[^"])*")/g)) server.add(dec(m[1])); }
const lab = readFileSync('apps/web/src/product/labels.ts', 'utf8'); const labels = {}; const body = lab.slice(lab.indexOf('const L'), lab.indexOf('};', lab.indexOf('const L'))); for (const m of body.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*'((?:\\'|[^'])*)'/g)) labels[m[1]] = m[2];
writeFileSync('tools/i18n/all-keys.json', JSON.stringify({ ui: [...ui].sort(), server: [...server].filter(x => !ui.has(x)).sort(), labels }, null, 1));
console.log('arayüz', ui.size, 'sunucu', server.size, 'etiket', Object.keys(labels).length);
