/** Ürün arayüzü dil katmanı (TR/EN). Anahtar = Türkçe kaynak metin; İngilizce karşılık en.json'da.
 * Dil sayfa yüklenirken belirlenir (kullanıcı seçimi → tarayıcıda saklı tercih → varsayılan TR); değişimde sayfa yeniden yüklenir,
 * böylece modül düzeyindeki sabit metinler de doğru dilde üretilir. Eksik çeviri Türkçe kalır ve i18n-kapsam testi yakalar. */
import EN from './i18n/en.json';
import ENL from './i18n/en-labels.json';
export type Lang = 'tr' | 'en';
const KEY = 'hpwact.lang';
function initial(): Lang { try { const v = localStorage.getItem(KEY); if (v === 'en' || v === 'tr') return v; } catch { /* depolama kapalı */ } return 'tr'; }
export const LANG: Lang = initial();
if (typeof document !== 'undefined') document.documentElement.lang = LANG;
const D = EN as Record<string, string>; const DL = ENL as Record<string, string>;
/** Görünen metin: tt('Türkçe {0} metin', değer) */
export function tt(key: string, ...args: unknown[]): string {
  const s = LANG === 'en' ? (D[key] ?? key) : key;
  return args.length ? s.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? '')) : s;
}
/** Sunucudan gelen Türkçe ileti: sözlükte varsa çevrilir, yoksa null (çağıran genel İngilizce iletiye düşer) */
export function ttServer(msg: string): string | null { return LANG === 'en' ? (D[msg] ?? null) : msg; }
/** Kod → etiket (labels.ts) İngilizce karşılığı */
export function ttLabel(code: string, trLabel: string): string { return LANG === 'en' ? (DL[code] ?? trLabel) : trLabel; }
export function setLang(l: Lang) { try { localStorage.setItem(KEY, l); } catch { /* yok */ } if (l !== LANG) window.location.reload(); }
export const locale = () => (LANG === 'en' ? 'en-GB' : 'tr-TR');
