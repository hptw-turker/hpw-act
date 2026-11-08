// TR/EN arayüz kapsamı: (1) görünen her Türkçe metin tt() içinde, (2) her anahtarın İngilizce karşılığı var, (3) İngilizce değerlerde Türkçe harf yok.
import { execFileSync } from 'node:child_process'; import { readFileSync } from 'node:fs';
const files = ['App.tsx', 'v3/Shell.tsx', 'v3/Login.tsx', 'v3/Today.tsx', 'v3/Plans.tsx', 'v3/parts.tsx', 'v3/Upload.tsx', 'v3/People.tsx', 'v3/Hpw.tsx', 'MailSandbox.tsx', 'Dialog.tsx', 'pages/Auth.tsx', 'pages/Chain.tsx', 'pages/ChainB.tsx', 'pages/RoleHomeB.tsx', 'ui/tb.tsx', 'ui/charts/Grafik.tsx', 'pages/Setup.tsx', 'pages/Roadmap.tsx', 'pages/Platform.tsx', 'pages/PlatformCompany.tsx', 'pages/GoLiveCard.tsx', 'pages/WorkItems.tsx', 'api.ts', 'dto.ts'].map(f => 'apps/web/src/product/' + f);
let fail = 0;
try { execFileSync(process.execPath, ['tools/i18n/codemod.mjs', '--check', ...files], { stdio: 'inherit' }); } catch { fail++; }
execFileSync(process.execPath, ['tools/i18n/keys.mjs'], { stdio: 'inherit' });
const k = JSON.parse(readFileSync('tools/i18n/all-keys.json', 'utf8')); const en = JSON.parse(readFileSync('apps/web/src/product/i18n/en.json', 'utf8')); const enl = JSON.parse(readFileSync('apps/web/src/product/i18n/en-labels.json', 'utf8'));
const missing = [...k.ui, ...k.server].filter(x => !(x in en)); const missingL = Object.keys(k.labels).filter(x => !(x in enl));
const TR = /[çğıöşüÇĞİÖŞÜ]/; const trInEn = Object.entries({ ...en, ...enl }).filter(([, v]) => TR.test(v)).map(([key, v]) => `${key} → ${v}`);
console.log('I18N-KAPSAM', `arayüz ${k.ui.length}, sunucu ${k.server.length}, etiket ${Object.keys(k.labels).length};`, 'eksik:', missing.length + missingL.length, '; İngilizcede Türkçe harf:', trInEn.length);
if (missing.length || missingL.length || trInEn.length) { console.log([...missing.slice(0, 15), ...missingL.slice(0, 5), ...trInEn.slice(0, 10)].join('\n')); fail++; }
process.exit(fail ? 1 : 0);
