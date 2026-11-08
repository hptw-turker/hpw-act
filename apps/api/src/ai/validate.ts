/** v2.13.0: sağlayıcı çıktısının sunucu doğrulaması. Şemadan geçmeyen ya da iş kurallarını aşan çıktı KAYDEDİLMEZ. */
import AjvMod from 'ajv';
const Ajv = (AjvMod as unknown as { default: typeof AjvMod }).default ?? AjvMod;
import { OUTPUT_SCHEMA, type AiPlanOutput } from './prompt.js';
import type { AiContext } from './context.js';
const ajv = new (Ajv as unknown as new (o: object) => { compile: (s: object) => ((d: unknown) => boolean) & { errors?: { instancePath: string; message?: string }[] | null } })({ allErrors: true, strict: false });
const check = ajv.compile(OUTPUT_SCHEMA);
export type Verdict = { ok: true; plan: AiPlanOutput } | { ok: false; kind: 'invalid_output' | 'range_violation'; errors: string[] };
const eq = (a: number | null | undefined, b: number | null | undefined) => (a === null || a === undefined) ? (b === null || b === undefined) : (b !== null && b !== undefined && Math.abs(Number(a) - Number(b)) < 1e-9);
export function validatePlan(raw: unknown, ctx: AiContext): Verdict {
  if (!check(raw)) return { ok: false, kind: 'invalid_output', errors: (check.errors ?? []).slice(0, 10).map(e => `${e.instancePath || '/'} ${e.message}`) };
  const p = raw as AiPlanOutput; const err: string[] = [];
  if (p.actions.length > 3) err.push('en fazla 3 aksiyon');
  p.actions.forEach((a, i) => {
    if (a.steps.length < 3 || a.steps.length > 6) err.push(`aksiyon ${i + 1}: 3–6 adım`);
    if (!Number.isInteger(a.startMonth) || !Number.isInteger(a.endMonth) || a.startMonth < 1 || a.endMonth > ctx.planHorizonMonths || a.startMonth > a.endMonth) err.push(`aksiyon ${i + 1}: ay aralığı 1–${ctx.planHorizonMonths} ve başlangıç ≤ bitiş olmalı`);
    for (const f of ['title', 'objective', 'rationale', 'ownerRole'] as const) if (!a[f].trim()) err.push(`aksiyon ${i + 1}: ${f} boş`);
    if (!a.indicators.length) err.push(`aksiyon ${i + 1}: en az bir gösterge`);
  });
  if (!p.executiveSummary.trim()) err.push('yönetici özeti boş');
  if (err.length) return { ok: false, kind: 'invalid_output', errors: err };
  const tr = p.targetRecommendation; const r = ctx.allowedTargetRange; const rv: string[] = [];
  if (!eq(tr.currentValue, ctx.currentValue)) rv.push('currentValue sunucunun değeriyle aynı değil');
  if (r === null) { if (tr.allowedRange !== null) rv.push('sunucu aralık vermediği halde aralık döndü'); if (tr.recommendedValue !== null) rv.push('aralık yokken hedef değeri önerildi'); }
  else {
    if (!tr.allowedRange || !eq(tr.allowedRange.low, r.low) || !eq(tr.allowedRange.high, r.high)) rv.push('allowedRange sunucunun aralığıyla aynı değil');
    if (tr.recommendedValue !== null && (tr.recommendedValue < r.low || tr.recommendedValue > r.high)) rv.push(`önerilen hedef ${tr.recommendedValue} izinli aralığın (${r.low}–${r.high}) dışında`);
  }
  if (rv.length) return { ok: false, kind: 'range_violation', errors: rv };
  return { ok: true, plan: p };
}
