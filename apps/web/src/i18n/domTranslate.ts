/** İngilizce mod: ekrandaki metin düğümleri, sayıları yer tutucuya çevirerek sözlükten karşılığını alır.
    Anahtar = Türkçe metin (sayılar '#' ile), değer = İngilizce (aynı sırada '#'). Sözlük: en-dom.json.
    Türkçe kaynak metin kodda kalır; İngilizce sözlük ayrı dosyada büyür. Eksik anahtar Türkçe kalır (ui-dil-tara yakalar). */
import dict from './en-dom.json';

const DICT = dict as Record<string, string>;
const NUM = /\d[\d.,:/]*/g;
const originals = new WeakMap<Text, string>();
let observer: MutationObserver | null = null;

export function normalize(s: string): string { return s.replace(/\s+/g, ' ').trim().replace(NUM, '#'); }

export function translateString(s: string): string {
  const lead = s.match(/^\s*/)![0], trail = s.match(/\s*$/)![0];
  const key = normalize(s); if (!key) return s;
  const en = DICT[key]; if (!en) return s;
  const nums = s.match(NUM) ?? []; let i = 0;
  return lead + en.replace(/#/g, () => nums[i++] ?? '#') + trail;
}

function translateNode(n: Text) {
  const cur = n.data; if (!cur.trim()) return;
  const orig = originals.get(n);
  if (orig !== undefined && orig === cur) return;            // zaten çevrildi mi? (orijinal saklı ve değişmemiş)
  const src = orig !== undefined && translateString(orig) === cur ? orig : cur; // React metni değiştirdiyse yeni kaynak
  originals.set(n, src);
  const en = translateString(src); if (en !== cur) n.data = en;
}

export function translateTree(root: Node) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = []; let t: Node | null;
  while ((t = w.nextNode())) nodes.push(t as Text);
  nodes.forEach(translateNode);
}

export function enableDomTranslation() {
  translateTree(document.body);
  observer?.disconnect();
  observer = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData') translateNode(m.target as Text);
      m.addedNodes.forEach(n => { if (n.nodeType === Node.TEXT_NODE) translateNode(n as Text); else translateTree(n); });
    }
  });
  observer.observe(document.body, { childList: true, characterData: true, subtree: true });
}

export function disableDomTranslation() {
  observer?.disconnect(); observer = null;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let t: Node | null;
  while ((t = w.nextNode())) {
    const node = t as Text; const o = originals.get(node);
    if (o !== undefined) { const en = translateString(o); if (node.data === en && en !== o) node.data = o; originals.delete(node); } // React zaten değiştirdiyse dokunma
  }
}
