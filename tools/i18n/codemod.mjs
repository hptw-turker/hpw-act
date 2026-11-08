// Ürün arayüzündeki görünen Türkçe metinleri tt('…') çağrısına sarar (kaynak biçimi korunur; yalnız metin aralıkları değişir).
// Kullanım: node tools/i18n/codemod.mjs [--dry] dosya...   Çıktı: tools/i18n/keys.json (anahtar → dosyalar)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('../../apps/web/node_modules/typescript');
const CHECK = process.argv.includes('--check'); const DRY = process.argv.includes('--dry') || CHECK; let total = 0; const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const DISPLAY_ATTRS = new Set(['label', 'placeholder', 'title', 'aria-label', 'disabledReason', 'hint', 'alt', 'error']);
const UI_CALLS = new Set(['setErr', 'setMsg', 'setDone', 'setLinkNote', 'setValErr', 'setEvErr', 'setEmailErr', 'setLoadErr', 'setOvErr', 'setInfo', 'setNote', 'setWarn', 'prompt', 'confirm', 'alert', 'ok']);
const DISPLAY_PROPS = new Set(['label', 'title', 'message', 'text', 'caption', 'note', 'mailNote', 'hint', 'desc']);
const NO_TRANSLATE = new Set(['Happy Place to Work®', 'Act', 'Happy Place to Work® Act', 'HPW Act', 'HPW Act · ', '/g/', 'TR', 'EN', 'hazır', 'eksik', 'kısmen', 'kullanılabilir']); // marka ve dil kodları; kurulum durum kodları (Setup.tsx) kod olarak kalır, çizimde tt(st) ile çevrilir // marka adı ve dil kodları çevrilmez
const hasLetter = s => /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(s) && !NO_TRANSLATE.has(s.trim());
const codeLike = s => /^[a-z0-9_.:/-]*$/.test(s) && (/[_/.:]/.test(s) || /^[a-z]+-[a-z-]+$/.test(s)) || /^\/|^https?:|^#/.test(s) || /^[A-Z0-9_]+$/.test(s) && s.includes('_');
const keys = JSON.parse(existsSync('tools/i18n/keys.json') ? readFileSync('tools/i18n/keys.json', 'utf8') : '{}');
const addKey = (k, f) => { (keys[k] ??= []); if (!keys[k].includes(f)) keys[k].push(f); };

const CODE_ATTRS = new Set(['className', 'id', 'to', 'type', 'key', 'value', 'name', 'href', 'kind', 'variant', 'role', 'htmlFor', 'inputMode', 'autoComplete', 'style', 'url', 'accept', 'pattern', 'data-testid']);
const CODE_PROPS = new Set(['to', 'screen', 'kind', 'status', 'id', 'code', 'method', 'route', 'type', 'key', 'variant', 'className', 'url', 'path', 'contract', 'error', 'realm', 'profile', 'state', 'decision', 'unitCode', 'itemCode', 'cadence', 'to_status']);
const NON_UI_CALL = /^(api|commandApi|fetch|download|getJson|checkDto|nav|navigate|setSp|sp\.|localStorage|sessionStorage|console|JSON|Number|String|parseNum|registerReconciler|useReconciler|useLoad|document|window\.|addEventListener|setItem|getItem|removeItem|new URLSearchParams|URLSearchParams|RegExp|new RegExp|encodeURIComponent|Date|new Date|trl|setTimeout|Object|Array|Math|Set|new Set|Map|new Map)/;
/** Görüntüleme bağlamı dışında ama açıkça Türkçe görünen metin (boşluklu cümle ya da Türkçe harf): dizi/kayıt verisi olarak ekrana giden satır başlıkları vb. */
function broadText(node) {
  const s = ts.isTemplateExpression(node) ? [node.head.text, ...node.templateSpans.map(x => x.literal.text)].join('') : node.text;
  if (!/[çğıöşüÇĞİÖŞÜ]/.test(s) && !(/\s/.test(s.trim()) && /[a-zA-Z]{3}/.test(s))) return false;
  const head = ts.isTemplateExpression(node) ? node.head.text : s; if ((/^\/|^https?:|^#/.test(head.trim()) || (ts.isTemplateExpression(node) && head === '' && /^[/?&=]/.test(node.templateSpans[0].literal.text))) && !/\s/.test(s.trim())) return false; // adres/sorgu dizgesi (boşluksuz)
  let n = node, p = node.parent;
  while (p && (ts.isParenthesizedExpression(p) || ts.isConditionalExpression(p) || ts.isArrayLiteralExpression(p) || (ts.isBinaryExpression(p) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken].includes(p.operatorToken.kind)))) { if (ts.isConditionalExpression(p) && p.condition === n) return false; n = p; p = p.parent; }
  if (!p) return false;
  if (ts.isBinaryExpression(p)) return false; // === / !== / == karşılaştırmaları ve diğerleri
  if (ts.isCaseClause(p) || ts.isElementAccessExpression(p) || ts.isExportDeclaration(p)) return false;
  if (ts.isPropertyAssignment(p)) { if (p.name === n) return false; if (CODE_PROPS.has(p.name.getText().replace(/['"]/g, ''))) return false; return true; }
  if (ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent) && CODE_ATTRS.has(p.parent.name.getText())) return false;
  if ((ts.isCallExpression(p) || ts.isNewExpression(p)) && p.arguments?.includes(n)) { const callee = (ts.isNewExpression(p) ? 'new ' : '') + p.expression.getText(); if (NON_UI_CALL.test(callee) || /\.(includes|indexOf|startsWith|endsWith|test|match|replace|split|join|localeCompare|querySelector|querySelectorAll|closest|toLocale\w+)$/.test(callee)) return false; return true; }
  if (ts.isVariableDeclaration(p) || ts.isReturnStatement(p) || ts.isArrowFunction(p) || ts.isShorthandPropertyAssignment(p)) return true;
  if (ts.isJsxExpression(p)) return true;
  return false;
}
function displayContext(node) {
  let n = node, p = node.parent;
  for (;;) {
    if (!p) return null;
    if (ts.isParenthesizedExpression(p) || (ts.isConditionalExpression(p) && p.condition !== n) || (ts.isBinaryExpression(p) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.PlusToken].includes(p.operatorToken.kind) && !(p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && p.left === n))) { n = p; p = p.parent; continue; }
    if (ts.isJsxExpression(p)) { const q = p.parent; if (ts.isJsxElement(q) || ts.isJsxFragment(q)) return 'child'; if (ts.isJsxAttribute(q) && DISPLAY_ATTRS.has(q.name.getText())) return 'attr'; return null; }
    if ((ts.isCallExpression(p) || ts.isNewExpression(p)) && p.arguments?.includes(n)) { const callee = p.expression.getText(); const name = callee.split('.').pop(); if (UI_CALLS.has(name)) return 'call'; if (/ApiError$/.test(callee) && p.arguments.indexOf(n) === 2) return 'call'; return null; }
    if (ts.isPropertyAssignment(p) && p.initializer === n && DISPLAY_PROPS.has(p.name.getText().replace(/['"]/g, ''))) return 'prop';
    return null;
  }
}
for (const f of files) {
  const src = readFileSync(f, 'utf8'); const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText() === 'tt') return; // zaten sarılmış
    if (ts.isJsxText(node)) {
      const raw = node.getText(); if (hasLetter(raw)) {
        const core = raw.replace(/\s*\n\s*/g, ' ').trim(); const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
        const keepLead = lead.includes('\n') ? '' : lead ? `{' '}` : '', keepTrail = trail.includes('\n') ? '' : trail ? `{' '}` : '';
        if (!/[{}<>]/.test(core)) { edits.push([node.getStart(), node.getEnd(), `${keepLead}{tt(${JSON.stringify(core)})}${keepTrail}`]); addKey(core, f); }
      }
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && DISPLAY_ATTRS.has(node.name.getText())) {
      const s = node.initializer.text; if (hasLetter(s) && !codeLike(s)) { edits.push([node.initializer.getStart(), node.initializer.getEnd(), `{tt(${JSON.stringify(s)})}`]); addKey(s, f); }
      return;
    } else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !(node.parent && ts.isImportDeclaration(node.parent))) {
      const s = node.text; if (hasLetter(s) && !codeLike(s) && (displayContext(node) || broadText(node))) { edits.push([node.getStart(), node.getEnd(), `tt(${JSON.stringify(s)})`]); addKey(s, f); }
    } else if (ts.isTemplateExpression(node) && (displayContext(node) || broadText(node))) {
      const parts = [node.head.text, ...node.templateSpans.map(s => s.literal.text)]; const statics = parts.join(' ');
      if (hasLetter(statics) && !/^\//.test(node.head.text)) {
        let key = node.head.text.replace(/[{}]/g, ''); const args = [];
        node.templateSpans.forEach((sp, i) => { key += `{${i}}` + sp.literal.text.replace(/[{}]/g, ''); args.push(sp.expression.getText()); });
        if (/[A-Za-zÇĞİÖŞÜçğıöşü]{2}/.test(key.replace(/\{\d+\}/g, ''))) { edits.push([node.getStart(), node.getEnd(), `tt(${JSON.stringify(key)}, ${args.join(', ')})`]); addKey(key, f); return; }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  edits.sort((a, b) => b[0] - a[0]); let out = src; for (const [s, e, r] of edits) out = out.slice(0, s) + r + out.slice(e);
  if (edits.length && !/import \{ tt \} from/.test(out)) { const rel = f.includes('/pages/') ? '../i18n' : './i18n'; const firstImport = out.indexOf('import '); out = out.slice(0, firstImport) + `import { tt } from '${rel}';\n` + out.slice(firstImport); }
  total += edits.length; if (edits.length) console.log(f, edits.length, 'sarılmamış metin', CHECK ? edits.slice(0, 5).map(e => src.slice(e[0], e[1]).slice(0, 60)).join(' | ') : '');
  if (!DRY) writeFileSync(f, out);
}
if (CHECK) { console.log('I18N-SARMA', total ? `BAŞARISIZ: ${total} sarılmamış görünen metin` : 'OK: bütün görünen metinler tt() içinde'); process.exit(total ? 1 : 0); }
writeFileSync('tools/i18n/keys.json', JSON.stringify(keys, null, 1));
console.log('toplam anahtar', Object.keys(keys).length);
