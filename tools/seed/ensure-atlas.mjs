// F15: ön yüz derlemesi öncesi Atlas fixture'ını (prototip ekranlarının sentetik verisi) deterministik olarak üretir; varsa dokunmaz.
// Ürün arayüzü (src/product) bu veriyi kullanmaz; yalnız prototip modülü (src/api/mock.ts) derleme için ister.
import { existsSync } from 'node:fs'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url'; import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'); const f = resolve(root, 'data/atlas/web-fixture.json');
if (existsSync(f)) { console.log('atlas fixture mevcut:', f); } else { console.log('atlas fixture yok; üretiliyor (seed 20260922)…'); execFileSync(process.execPath, [resolve(root, 'tools/seed/generate-atlas.mjs')], { stdio: 'inherit', cwd: root }); if (!existsSync(f)) { console.error('HATA: fixture üretilemedi'); process.exit(1); } }
