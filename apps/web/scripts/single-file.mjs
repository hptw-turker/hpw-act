// pnpm --filter @hpw-act/web build:single — tek dosyalık prototip: CSS, JS, fontlar ve favicon gömülü; HashRouter; klasik <script>.
// Çıktı: dist/hpw-act-prototip.html (file:// ile açılır, yayımlanabilir).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const d = new URL('../dist-single/', import.meta.url).pathname;
let html = readFileSync(join(d, 'index.html'), 'utf8');
const jsPath = html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
const cssMatch = html.match(/href="(\/assets\/[^"]+\.css)"/);
let js = readFileSync(join(d, jsPath), 'utf8');
let css = cssMatch ? readFileSync(join(d, cssMatch[1]), 'utf8') : '';
const b64 = p => readFileSync(join(d, p)).toString('base64');
const embedFonts = s => {
  for (const f of ['poppins-400-latin-ext', 'poppins-400-latin', 'poppins-700-latin-ext', 'poppins-700-latin']) {
    s = s.split(`/fonts/${f}.woff2`).join(`data:font/woff2;base64,${b64(`fonts/${f}.woff2`)}`);
  }
  return s;
};
js = embedFonts(js).replace(/<\/script>/g, '<\\/script>'); // IIFE derlemesinde CSS JS içinden enjekte edilir
css = embedFonts(css);
html = html.replace(/\s*<link rel="preload"[^>]*>/g, '')
  .replace(/<script type="module" crossorigin src="[^"]+"><\/script>/, '')
  .replace('href="/favicon.svg"', `href="data:image/svg+xml;base64,${b64('favicon.svg')}"`);
// Dikkat: replace'e fonksiyon veriliyor; aksi halde bundle içindeki '$&' gibi kalıplar özel anlam kazanır
if (cssMatch) html = html.replace(`<link rel="stylesheet" crossorigin href="${cssMatch[1]}">`, () => `<style>${css}</style>`);
html = html.replace('</body>', () => `<script>${js}</script>\n</body>`);
if (/\/assets\/|\/fonts\//.test(html)) throw new Error('gömülmemiş kaynak kaldı');
mkdirSync(new URL('../dist/', import.meta.url).pathname, { recursive: true });
const out = new URL('../dist/hpw-act-prototip.html', import.meta.url).pathname;
writeFileSync(out, html);
console.log(`${out} (${Math.round(html.length / 1024)} KB)`);
