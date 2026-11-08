import type { ItemScale } from './types.js';
import { invalid, isFiniteNumber } from '../errors.js';
/** Puanlama (HPTW-2026-02): Top Box = 4 ve 5 yanıtlarının payı; NPS = promotör(9–10) − detraktör(0–6); tavsiye maddesi raporda Top Box (7–10 değil: 9–10) ile de puanlanır. */
export interface Distribution { counts: Record<string, number>; }
/** Ölçek sözlüğü: izinli seçenekler ve olumlu seçenekler kutuba göre (ters maddede 1|2). Sözlükte olmayan ölçek/seçenek → hata, sessiz varsayım yok (F11). */
const OPTIONS: Record<string, string[]> = { likert5_topbox: ['1', '2', '3', '4', '5'], likert5_mean: ['1', '2', '3', '4', '5'], nps_0_10: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], binary: ['YES', 'NO'] };
function favorable(scale: ItemScale, polarity: 'positive' | 'negative'): string[] {
  if (scale === 'likert5_topbox') return polarity === 'negative' ? ['1', '2'] : ['4', '5'];
  if (scale === 'nps_0_10') return polarity === 'negative' ? ['0', '1'] : ['9', '10'];
  if (scale === 'binary') return polarity === 'negative' ? ['NO'] : ['YES'];
  throw invalid('unsupported_scale', `Top Box tanımlı değil: ${scale}`);
}
export function topBoxFromDistribution(scale: ItemScale, d: Distribution, polarity: 'positive' | 'negative' = 'positive'): { n: number; topBoxPct: number } {
  const allowed = OPTIONS[scale]; if (!allowed) throw invalid('unsupported_scale', `Ölçek sözlükte yok: ${scale}`);
  const entries = Object.entries(d.counts);
  for (const [k, v] of entries) { if (!allowed.includes(k)) throw invalid('invalid_option', `Ölçek ${scale} için geçersiz seçenek: ${k}`); if (!isFiniteNumber(v) || v < 0 || !Number.isInteger(v)) throw invalid('invalid_distribution', `Sayım geçersiz: ${k}=${v}`); }
  const n = entries.reduce((s, [, v]) => s + v, 0);
  if (n === 0) return { n: 0, topBoxPct: NaN };
  if (scale === 'likert5_mean') { const mean = entries.reduce((s, [k, v]) => s + Number(k) * v, 0) / n; return { n, topBoxPct: Math.round(((mean - 1) / 4) * 1000) / 10 }; } // 0–100'e doğrusal; Top Box değil, ortalama tabanlı
  const top = favorable(scale, polarity);
  const t = entries.filter(([k]) => top.includes(k)).reduce((s, [, v]) => s + v, 0);
  return { n, topBoxPct: Math.round((t / n) * 1000) / 10 };
}
export function npsFromDistribution(d: Distribution): { n: number; nps: number } {
  const n = Object.values(d.counts).reduce((s, v) => s + v, 0); if (n === 0) return { n: 0, nps: NaN };
  const sum = (ks: string[]) => ks.reduce((s, k) => s + (d.counts[k] ?? 0), 0);
  return { n, nps: Math.round(((sum(['9', '10']) - sum(['0', '1', '2', '3', '4', '5', '6'])) / n) * 1000) / 10 };
}
/** İndeks = üye maddelerin (ya da boyutların) ortalaması; resmî toplama kuralı sürümlü; bir üye eksikse indeks "kısmi" işaretlenir, sessizce hesaplanmaz. */
export function indexFromItems(memberCodes: string[], values: Record<string, number | null | undefined>): { value: number | null; missing: string[]; partial: boolean } {
  const missing = memberCodes.filter(c => !isFiniteNumber(values[c] ?? NaN));
  const present = memberCodes.filter(c => !missing.includes(c)).map(c => values[c] as number);
  if (present.length === 0) return { value: null, missing, partial: missing.length > 0 };
  return { value: Math.round((present.reduce((s, v) => s + v, 0) / present.length) * 10) / 10, missing, partial: missing.length > 0 };
}
