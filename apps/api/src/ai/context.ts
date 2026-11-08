/** v2.13.0: AI bağlam paketi.
 * Güvence ilkesi: bağlam, kullanıcının kendi oturumuyla MEVCUT okuma uçlarından (app.inject) toplanır. Böylece yetki (hangi birim/soru görünür),
 * şirket ayrımı (RLS) ve gizlilik kapısı (küçük grup, çoklu rapor türetim koruması) yeniden yazılmaz, aynen uygulanır; kullanıcının ekranda göremediği
 * hiçbir değer pakete giremez. Ek olarak her alan bir beyaz listeden geçer (kimlik, ham satır kimliği, kişi adı gönderilmez).
 * Soru seti dinamiktir: soru kodu/metni/ölçeği sonuç satırlarından gelir; katalogda sabit soru adı ya da sayısı yoktur. */
import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PROMPT_VERSION, SCHEMA_VERSION } from './prompt.js';

type Row = { itemCode: string; metricCode: string; text: string; dimensionCode: string | null; dimensionName: string | null; origin: string | null; scaleCode: string | null; n?: number | null; value: number | null; suppressed: boolean; companyValue?: number | null; benchmarkCertified?: number | null; interactionArea?: string | null; responsibilityCenter?: string | null; responsibilityLabel?: string | null; targetPolicy?: string | null; distribution?: unknown; benchmarks?: unknown; assessment?: { decision?: string; priority?: string } | null };
type Target = { id: string; cycle_id: string; unit_id: string; item_code: string; status: string; source: string | null; target_date: string | null; baseline_score: number | null; suggested_target: number | null; lower_feasible: number | null; upper_feasible: number | null; approved_target: number | null; measurement_plan: { followupCycleCode?: string | null; horizonDays?: number } | null; item_text?: string };
export type AiContext = Record<string, unknown> & { allowedTargetRange: { low: number; high: number } | null; currentValue: number | null; planHorizonMonths: number };

export async function injectGet<T>(app: FastifyInstance, req: FastifyRequest, url: string): Promise<{ status: number; body: T | null }> {
  const r = await app.inject({ method: 'GET', url, headers: { cookie: String(req.headers.cookie ?? '') } });
  let body: T | null = null; try { body = JSON.parse(r.body) as T; } catch { body = null; }
  return { status: r.statusCode, body };
}
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
const pickRow = (r: Row) => ({ code: r.itemCode, metric: r.metricCode, text: r.text, scale: r.scaleCode ?? null, origin: r.origin ?? null, dimension: r.dimensionName ?? r.dimensionCode ?? null, interactionArea: r.interactionArea ?? null, responsibilityCenter: r.responsibilityLabel ?? r.responsibilityCenter ?? null, value: r.suppressed ? null : num(r.value), n: r.suppressed ? null : num(r.n), companyValue: r.suppressed ? null : num(r.companyValue), benchmarkCertified: r.suppressed ? null : num(r.benchmarkCertified), hidden: !!r.suppressed });

export type TargetBasis = { cycle_id: string; unit_id: string; item_code: string; range: { low: number; high: number } | null; suggested: number | null; horizonDays: number; followupCycleCode: string | null; status: string | null; targetId: string | null };
/** Kayıtlı hedeften temel: kullanıcının kendi oturumuyla hedef listesi ucundan (görünürlük ve yetki aynen). */
export async function basisFromTarget(app: FastifyInstance, req: FastifyRequest, tid: string, target: { id: string; cycle_id: string; unit_id: string; item_code: string }): Promise<TargetBasis | { error: 'forbidden' | 'not_found' }> {
  const tg = await injectGet<Target[]>(app, req, `/api/t/${tid}/cycles/${target.cycle_id}/units/${target.unit_id}/targets`);
  if (tg.status === 403) return { error: 'forbidden' }; if (tg.status !== 200 || !tg.body) return { error: 'not_found' };
  const t = tg.body.find(x => x.id === target.id); if (!t) return { error: 'not_found' };
  return { cycle_id: target.cycle_id, unit_id: target.unit_id, item_code: t.item_code, range: t.lower_feasible !== null && t.upper_feasible !== null ? { low: Number(t.lower_feasible), high: Number(t.upper_feasible) } : null, suggested: num(t.suggested_target), horizonDays: t.measurement_plan?.horizonDays ?? 365, followupCycleCode: t.measurement_plan?.followupCycleCode ?? null, status: t.status, targetId: t.id };
}
/** v2.13.1: hedef önizlemesinden temel (hedef henüz yok): mevcut önizleme ucu (kayıt yazmaz) kullanıcının oturumuyla çağrılır — yetki, gizlilik ve hedef politikası aynen uygulanır. */
export async function basisFromPreview(app: FastifyInstance, req: FastifyRequest, tid: string, cycleId: string, unitId: string, itemCode: string): Promise<TargetBasis | { error: 'forbidden' | 'not_found' | 'not_targetable'; status?: number; body?: unknown }> {
  const r = await app.inject({ method: 'POST', url: `/api/t/${tid}/cycles/${cycleId}/units/${unitId}/targets?preview=1`, payload: { itemCode }, headers: { cookie: String(req.headers.cookie ?? ''), 'content-type': 'application/json', ...(req.headers.origin ? { origin: String(req.headers.origin) } : {}) } });
  let body: { proposal?: { low: number; high: number; target: number }; measurementPlan?: { followupCycleCode: string | null; horizonDays: number } } | null = null; try { body = JSON.parse(r.body); } catch { body = null; }
  if (r.statusCode === 403) return { error: 'forbidden' }; if (r.statusCode === 404) return { error: 'not_found' };
  if (r.statusCode !== 200 || !body?.proposal) return { error: 'not_targetable', status: r.statusCode, body };
  return { cycle_id: cycleId, unit_id: unitId, item_code: itemCode, range: { low: Number(body.proposal.low), high: Number(body.proposal.high) }, suggested: num(body.proposal.target), horizonDays: body.measurementPlan?.horizonDays ?? 365, followupCycleCode: body.measurementPlan?.followupCycleCode ?? null, status: null, targetId: null };
}

/** Bağlam paketini kurar. Parmak izi yalnız TEMEL VERİDEN hesaplanır: hedefin durumu, seçili maddenin kendi hedef kaydı ve bu planın kendi açtığı aksiyonlar
 * parmak izine girmez — hedefin oluşturulması/kabulü ya da plandan aksiyon açılması planı kendiliğinden bayatlatmaz; sonuç, aralık, dönem, diğer aksiyonlar ya da kurumsal istek değişirse bayatlar. */
export async function buildContext(app: FastifyInstance, req: FastifyRequest, tid: string, b: TargetBasis, opts: { excludeActionIds?: string[] } = {}): Promise<{ ctx: AiContext; fingerprint: string } | { error: 'forbidden' | 'not_found' | 'no_result' }> {
  const base = `/api/t/${tid}`; const target = { cycle_id: b.cycle_id, unit_id: b.unit_id };
  const tg = await injectGet<Target[]>(app, req, `${base}/cycles/${b.cycle_id}/units/${b.unit_id}/targets`);
  if (tg.status === 403) return { error: 'forbidden' }; const tlist = tg.status === 200 && Array.isArray(tg.body) ? tg.body : [];
  const t = { item_code: b.item_code, status: b.status ?? 'preview', suggested_target: b.suggested, measurement_plan: { followupCycleCode: b.followupCycleCode, horizonDays: b.horizonDays } };
  const res = await injectGet<{ cycle: { code: string }; unit: { code?: string; name?: string; unit_type?: string }; rows: Row[] }>(app, req, `${base}/cycles/${target.cycle_id}/units/${target.unit_id}/results`);
  if (res.status !== 200 || !res.body) return { error: res.status === 403 ? 'forbidden' : 'no_result' };
  const rows = res.body.rows; const sel = rows.find(r => r.itemCode === t.item_code && r.metricCode.endsWith('_TB')) ?? rows.find(r => r.itemCode === t.item_code);
  if (!sel) return { error: 'no_result' };
  const missing: string[] = [];
  // önceki karşılaştırılabilir dönemler (aynı birim, aynı soru) — yalnız kullanıcının görebildiği sonuç uçlarından
  const cyc = await injectGet<{ id: string; code: string; period_start: string; period_end: string; status: string }[]>(app, req, `${base}/cycles`);
  const all = (cyc.body ?? []).slice().sort((a, b) => String(a.period_start).localeCompare(String(b.period_start)));
  const curIdx = all.findIndex(c => c.id === target.cycle_id); const prev = curIdx > 0 ? all.slice(Math.max(0, curIdx - 3), curIdx) : [];
  const history: { cycle: string; value: number | null; n: number | null; hidden: boolean }[] = [];
  for (const c of prev) {
    const pr = await injectGet<{ rows: Row[] }>(app, req, `${base}/cycles/${c.id}/units/${target.unit_id}/results`);
    const r = pr.status === 200 ? pr.body?.rows.find(x => x.itemCode === sel.itemCode && x.metricCode === sel.metricCode) : undefined;
    if (r) history.push({ cycle: c.code, value: r.suppressed ? null : num(r.value), n: r.suppressed ? null : num(r.n), hidden: !!r.suppressed });
  }
  if (!history.length) missing.push('Aynı birim ve soru için önceki karşılaştırılabilir dönem sonucu yok (eğilim hesaplanamaz).');
  const s = pickRow(sel);
  if (s.hidden) missing.push('Seçili sorunun birim sonucu gizlilik eşiği nedeniyle gösterilmiyor.');
  const range = b.range && !s.hidden ? b.range : null;
  if (!range) missing.push('Sunucu bu hedef için izinli hedef aralığı vermedi; hedef değeri önerilmez.');
  const horizonDays = t.measurement_plan?.horizonDays ?? 365; const planHorizonMonths = Math.max(1, Math.min(12, Math.round(horizonDays / 30.4)));
  // aynı birimin diğer görünür soruları ve ilgili sorular (aynı boyut / etkileşim alanı / sorumluluk merkezi) — yalnız teşhis bağlamı
  const others = rows.filter(r => r !== sel && r.metricCode.endsWith('_TB')).map(pickRow);
  const related = others.filter(o => (s.dimension && o.dimension === s.dimension) || (s.interactionArea && o.interactionArea === s.interactionArea) || (s.responsibilityCenter && o.responsibilityCenter === s.responsibilityCenter));
  // birimdeki diğer hedefler ve aksiyonlar (özet)
  const acts = await injectGet<{ id: string; title: string; lifecycle_state: string; verification_state?: string; item_code?: string }[]>(app, req, `${base}/actions?unitId=${target.unit_id}&cycleId=${target.cycle_id}`); const excl = new Set(opts.excludeActionIds ?? []);
  const existingTargetsActions = { targets: tlist.filter(x => x.item_code !== b.item_code).map(x => ({ item: x.item_code, status: x.status, approvedTarget: s.hidden ? null : num(x.approved_target) })), actions: acts.status === 200 && Array.isArray(acts.body) ? acts.body.filter(a => !excl.has(a.id)).map(a => ({ title: a.title, state: a.lifecycle_state, verification: a.verification_state ?? null })) : [] };
  if (acts.status !== 200) missing.push('Birimdeki aksiyon özeti bu kullanıcıya görünmüyor.');
  const amb = await injectGet<{ cycle_id?: string; item_code?: string; ambition_value?: number; status?: string }[]>(app, req, `${base}/corporate/ambitions`);
  const ambList = amb.status === 200 ? (Array.isArray(amb.body) ? amb.body : ((amb.body as unknown as { ambitions?: { cycle_id?: string; item_code?: string; ambition_value?: number; status?: string }[] } | null)?.ambitions ?? [])) : []; // v2.13.1: uç { ambitions: [...] } döndürür; v2.13.0'da bu bağlam hep boş kalıyordu
  const corporateContext = ambList.filter(a => a.cycle_id === target.cycle_id && a.item_code === sel.itemCode).map(a => ({ ambitionValue: num(a.ambition_value), status: a.status ?? null }));
  if (amb.status !== 200) missing.push('Kurumsal istek bilgisi bu kullanıcıya görünmüyor.');
  missing.push('Çalışan görüşü (açık uçlu yorum temaları) sistemde bulunmuyor.');
  const ctx: AiContext = {
    selectedQuestion: { code: sel.itemCode, metric: sel.metricCode, text: sel.text, scale: s.scale, standardOrCustom: sel.origin ?? null, dimension: s.dimension, interactionArea: s.interactionArea, responsibilityCenter: s.responsibilityCenter, targetPolicy: sel.targetPolicy ?? null },
    selectedQuestionComparisons: { companyValue: s.companyValue, benchmarkCertified: s.benchmarkCertified },
    unit: { name: res.body.unit?.name ?? null, type: res.body.unit?.unit_type ?? null, cycle: res.body.cycle.code, currentValue: s.value, n: s.n, hidden: s.hidden, companyValue: s.companyValue, companyDelta: s.value !== null && s.companyValue !== null ? Math.round((s.value - s.companyValue) * 10) / 10 : null, history, hpwAssessment: s.hidden ? null : (sel.assessment ? { decision: sel.assessment.decision ?? null, priority: sel.assessment.priority ?? null } : null), targetStatus: t.status, ruleBasedSuggestedTarget: s.hidden ? null : num(t.suggested_target), followUp: { cycle: t.measurement_plan?.followupCycleCode ?? null, horizonDays } },
    unitSurveyContext: others,
    companyContext: { sameQuestionCompanyValue: s.companyValue, note: 'Şirket değeri birim satırındaki yanıt ağırlıklı şirket geneli değeridir.' },
    relatedContext: related,
    existingTargetsActions, corporateContext, employeeVoice: [],
    allowedTargetRange: range, currentValue: s.value, planHorizonMonths, missingData: missing,
  };
  const basisCtx = { ...ctx, unit: { ...(ctx.unit as Record<string, unknown>), targetStatus: undefined } };
  const fingerprint = createHash('sha256').update(JSON.stringify({ PROMPT_VERSION, SCHEMA_VERSION, model: process.env.HPW_AI_MODEL ?? null, ctx: basisCtx })).digest('hex');
  return { ctx, fingerprint };
}
