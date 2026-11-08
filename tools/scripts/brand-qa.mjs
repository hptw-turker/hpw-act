// pnpm brand-qa — Happy Place to Work® marka QA kontrol listesinin kod tarafı (brif: "Marka QA kontrol listesi").
// apps/web altında: yalnız üç hex (tokens.css ve favicon'da), radius 0, gölge/degrade/opaklık yok, yalnız Poppins 400/700, italik yok,
// ikon/emoji yok, aralıklar 12 px tabanında, toUpperCase yok (tr-kontrol ile birlikte).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../../apps/web/', import.meta.url).pathname;
// v2.14 Tasarım B: üç marka rengine ek olarak sarı ve dört gri ton (yalnız tokens.css'te tanımlı; kodda var(--hpw-*) ile kullanılır)
const ALLOWED_HEX = new Set(['#CF051E', '#231A15', '#FFFFFF', '#F2C14E', '#EDEAE7', '#B9B2AD', '#8A817C', '#6B625D']);
const SPACING = new Set([0, 1, 2, 12, 24, 48, 72, 96, 144]);
const problems = [];
const note = (f, msg) => problems.push(`${relative(ROOT, f)}: ${msg}`);

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (/node_modules|dist/.test(p)) continue;
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(css|tsx|ts|html|svg)$/.test(p)) out.push(p);
  }
  return out;
}

for (const f of walk(ROOT)) {
  const src = readFileSync(f, 'utf8');
  const isTokens = f.endsWith('tokens.css'), isFavicon = f.endsWith('favicon.svg');
  // 1) hex renkler
  for (const m of src.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    const hex = m[0].replace(/[a-f]/g, c => String.fromCharCode(c.charCodeAt(0) - 32)); // ASCII hex; toUpperCase yasak
    if (!ALLOWED_HEX.has(hex)) note(f, `izinsiz renk ${m[0]}`);
    else if (!isTokens && !isFavicon) note(f, `sabit hex ${m[0]} — token kullan (var(--hpw-*))`);
  }
  if (/\b(rgba?|hsla?)\(/.test(src)) note(f, 'rgb/hsl renk üretimi');
  // 2) radius, gölge, degrade, blur, opaklık
  for (const m of src.matchAll(/border-radius\s*:\s*([^;]+);/g)) if (!/^\s*0(px)?\s*$/.test(m[1])) note(f, `border-radius ${m[1].trim()}`);
  if (/box-shadow|text-shadow|drop-shadow|blur\(/.test(src)) note(f, 'gölge/blur');
  if (/linear-gradient|radial-gradient|conic-gradient/.test(src)) note(f, 'degrade');
  for (const m of src.matchAll(/opacity\s*:\s*([\d.]+)/g)) if (Number(m[1]) < 1) note(f, `opacity ${m[1]}`);
  // 3) tipografi
  if (/font-style\s*:\s*italic|<em[\s>]|<i[\s>]/.test(src)) note(f, 'italik');
  for (const m of src.matchAll(/font-weight\s*:\s*([^;]+);/g)) { const v = m[1].trim(); if (!/^(400|700|var\(--w-(regular|bold)\)|inherit)$/.test(v)) note(f, `font-weight ${v}`); }
  for (const m of src.matchAll(/font-family\s*:\s*([^;]+);/g)) { const v = m[1].trim(); if (!/^(var\(--font\)|'Poppins'|Poppins, Montserrat, sans-serif|inherit)$/.test(v)) note(f, `font-family ${v}`); }
  // 4) ikon, emoji, illüstrasyon
  // v2.14: veri grafikleri (mermi grafik, takvim) product/ui/charts altında SVG ile çizilir; ikon değildir
  if (!isFavicon && !/product\/ui\/charts\//.test(f) && /<svg[\s>]/.test(src)) note(f, 'SVG/ikon');
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src)) note(f, 'emoji');
  if (/lucide|react-icons|@heroicons|fontawesome/.test(src)) note(f, 'ikon kütüphanesi');
  // 5) aralık tokenları (CSS'te padding/margin/gap/inset literal px)
  if (f.endsWith('.css')) for (const m of src.matchAll(/(padding|margin|gap|inset|top|right|bottom|left)(-[a-z]+)?\s*:\s*([^;]+);/g)) {
    for (const px of m[3].matchAll(/(-?\d+(?:\.\d+)?)px/g)) if (!SPACING.has(Math.abs(Number(px[1])))) note(f, `aralık ${px[0]} 12 px tabanında değil (${m[0].trim()})`);
  }
  // 6) Türkçe casing
  if (/\.(toUpperCase|toLowerCase)\(/.test(src)) note(f, 'toUpperCase/toLowerCase → trUpper/trLower');
}

if (problems.length) { console.error(`BRAND-QA: ${problems.length} sorun`); for (const p of problems) console.error(' - ' + p); process.exit(1); }
console.log('BRAND-QA OK (3 marka rengi + Tasarım B tonları, radius 0, gölgesiz, Poppins 400/700, ikonsuz, 12 px aralık)');
