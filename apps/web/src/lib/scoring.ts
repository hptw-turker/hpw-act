/** Puanlama (F11): ölçek, seçenek kodu, kural ve yön ayrı; bilinmeyen kuralda sonuç üretilmez. */
export interface Scale { code: string; label: string; options: { code: string; label: string; valid: boolean; numeric?: number }[]; }
export interface Rule { code: string; scaleCode: string; metricKind: 'FAVORABLE_PCT' | 'MEAN_0_100' | 'NPS'; favorable: string[]; negative: string[]; minOutput: number; maxOutput: number; }
export const SYSTEM_SCALES: Scale[] = [
  { code: 'L5', label: 'Beşli katılım ölçeği (olumlu yön)', options: [1, 2, 3, 4, 5].map(i => ({ code: String(i), label: ['Tümüyle yanlış', 'Büyük ölçüde yanlış', 'Ne doğru ne yanlış', 'Büyük ölçüde doğru', 'Tümüyle doğru'][i - 1]!, valid: true, numeric: i })) },
  { code: 'L5R', label: 'Beşli katılım ölçeği (ters madde)', options: [1, 2, 3, 4, 5].map(i => ({ code: String(i), label: ['Tümüyle yanlış', 'Büyük ölçüde yanlış', 'Ne doğru ne yanlış', 'Büyük ölçüde doğru', 'Tümüyle doğru'][i - 1]!, valid: true, numeric: i })) },
  { code: 'NPS11', label: '0–10 tavsiye ölçeği', options: Array.from({ length: 11 }, (_, i) => ({ code: String(i), label: String(i), valid: true, numeric: i })) },
  { code: 'BIN', label: 'Evet / Hayır', options: [{ code: 'YES', label: 'Evet', valid: true, numeric: 1 }, { code: 'NO', label: 'Hayır', valid: true, numeric: 0 }] },
];
export const SYSTEM_RULES: Rule[] = [
  { code: 'L5_TOP2', scaleCode: 'L5', metricKind: 'FAVORABLE_PCT', favorable: ['4', '5'], negative: ['1', '2'], minOutput: 0, maxOutput: 100 },
  { code: 'L5R_TOP2', scaleCode: 'L5R', metricKind: 'FAVORABLE_PCT', favorable: ['1', '2'], negative: ['4', '5'], minOutput: 0, maxOutput: 100 }, // ters madde: olumlu seçenekler onaylı politikadan
  { code: 'L5_MEAN', scaleCode: 'L5', metricKind: 'MEAN_0_100', favorable: [], negative: [], minOutput: 0, maxOutput: 100 },
  { code: 'NPS11_TOP2', scaleCode: 'NPS11', metricKind: 'FAVORABLE_PCT', favorable: ['9', '10'], negative: ['0', '1', '2', '3', '4', '5', '6'], minOutput: 0, maxOutput: 100 },
  { code: 'NPS11_NPS', scaleCode: 'NPS11', metricKind: 'NPS', favorable: ['9', '10'], negative: ['0', '1', '2', '3', '4', '5', '6'], minOutput: -100, maxOutput: 100 },
  { code: 'BIN_YES', scaleCode: 'BIN', metricKind: 'FAVORABLE_PCT', favorable: ['YES'], negative: ['NO'], minOutput: 0, maxOutput: 100 },
];
export const scaleByCode = (c: string) => SYSTEM_SCALES.find(s => s.code === c);
export const ruleByCode = (c: string) => SYSTEM_RULES.find(r => r.code === c);
/** Ölçeğin madde metrikleri: her ölçek için Top Box (FAVORABLE_PCT) ve NPS11 için ayrıca NPS. */
export function metricsForScale(scaleCode: string): { suffix: string; rule: string }[] {
  switch (scaleCode) { case 'L5': return [{ suffix: '_TB', rule: 'L5_TOP2' }]; case 'L5R': return [{ suffix: '_TB', rule: 'L5R_TOP2' }]; case 'NPS11': return [{ suffix: '_TB', rule: 'NPS11_TOP2' }, { suffix: '_NPS', rule: 'NPS11_NPS' }]; case 'BIN': return [{ suffix: '_TB', rule: 'BIN_YES' }]; default: return []; }
}
export function computeFromDistribution(rule: Rule, counts: Record<string, number>): { n: number; value: number } | { error: string } {
  const scale = scaleByCode(rule.scaleCode); if (!scale) return { error: 'unknown_scale' };
  const valid = new Set(scale.options.filter(o => o.valid).map(o => o.code));
  let n = 0; for (const [k, v] of Object.entries(counts)) { if (!valid.has(k)) return { error: `invalid_option:${k}` }; if (!Number.isInteger(v) || v < 0) return { error: `invalid_count:${k}` }; n += v; }
  if (n === 0) return { error: 'empty_distribution' };
  const sum = (ks: string[]) => ks.reduce((s, k) => s + (counts[k] ?? 0), 0);
  if (rule.metricKind === 'FAVORABLE_PCT') return { n, value: Math.round((sum(rule.favorable) / n) * 1000) / 10 };
  if (rule.metricKind === 'NPS') return { n, value: Math.round(((sum(rule.favorable) - sum(rule.negative)) / n) * 1000) / 10 };
  const nums = scale.options.filter(o => o.numeric !== undefined); const min = Math.min(...nums.map(o => o.numeric!)), max = Math.max(...nums.map(o => o.numeric!));
  const mean = nums.reduce((s, o) => s + (counts[o.code] ?? 0) * o.numeric!, 0) / n; return { n, value: Math.round(((mean - min) / (max - min)) * 1000) / 10 };
}
