// pnpm tr-kontrol — Türkçe casing denetimi: toUpperCase/toLowerCase yasak, U+0307 ve bozuk büyük harf kalıpları
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['apps', 'packages', 'tools', 'db'];
const exts = ['.ts', '.tsx', '.js', '.mjs', '.json', '.sql', '.md'];
const skip = /node_modules|dist|\.git|turkish\.ts|tr-kontrol\.mjs|brand-qa\.mjs|coding-standards\.md|CLAUDE\.md/;
const badUpper = /\b(BIRIM|HIZMET|ILETIŞ|MEMNUNIYET|KRITIK|ILGILI|ILK|IŞ|YONETICI|YÖNETICI|BILGI|IZIN)\b/;
let failed = false;

function walk(p) {
  for (const f of readdirSync(p)) {
    const fp = join(p, f);
    if (skip.test(fp)) continue;
    if (statSync(fp).isDirectory()) { walk(fp); continue; }
    if (!exts.some(e => fp.endsWith(e))) continue;
    const src = readFileSync(fp, 'utf8');
    if (/\.(toUpperCase|toLowerCase)\(/.test(src) && !fp.endsWith('.md')) { console.error(`TR-KONTROL: ${fp} toUpperCase/toLowerCase kullanıyor → trUpper/trLower`); failed = true; }
    if (src.includes('\u0307')) { console.error(`TR-KONTROL: ${fp} U+0307 (i̇) içeriyor`); failed = true; }
    if (badUpper.test(src)) { console.error(`TR-KONTROL: ${fp} hatalı büyük harf kalıbı (I/İ)`); failed = true; }
  }
}
for (const r of roots) { try { walk(r); } catch { /* yok */ } }
if (failed) process.exit(1);
console.log('TR-KONTROL OK');
