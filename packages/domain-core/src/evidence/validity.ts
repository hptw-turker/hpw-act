/** Kanıt geçerliliği ÖNCE (v2.3.1): tür, iş/birim/metrik eşleşmesi, tarih penceresi, kaynak ve tekil gerçekleşme doğrulanır; geçersiz kanıt gereksinime sayılmaz.
    Sıra: geçerlilik → E0–E4 politikası → inceleme önceliği/güven puanı. Yüksek güven puanı yanlış kanıtı telafi etmez. */
import type { EvidenceItem, EvidenceRequirementSpec } from './confidence.js';
export type EvidenceRejection = 'wrong_type' | 'undated' | 'out_of_window' | 'duplicate_occurrence' | 'wrong_scope' | 'scope_missing' | 'stale_metric' | 'outcome_not_execution';
export interface ScopedEvidence extends EvidenceItem { unitId?: string; metricCode?: string; /** Tekil gerçekleşme anahtarı: toplantı için (tarih+birim+olay kimliği); dosya hash'i tek başına olay tanımlamaz */ occurrenceKey?: string; metricPeriod?: string; }
export interface ScopedRequirement extends EvidenceRequirementSpec { unitId?: string; metricCode?: string; period?: string; requiresExecutionEvidence?: boolean; }
export interface ValidityResult { valid: ScopedEvidence[]; rejected: { id: string; reason: EvidenceRejection }[]; }

const TYPE_FOR_RULE: Record<EvidenceRequirementSpec['ruleType'], EvidenceItem['type'][]> = {
  count: ['artifact', 'attestation', 'system_data'], artifact: ['artifact', 'system_data'], attendance: ['system_data', 'attestation', 'artifact'], duration: ['system_data', 'artifact'], attestation: ['attestation'], system_metric: ['system_data'],
};
export function validateEvidence(req: ScopedRequirement, items: ScopedEvidence[]): ValidityResult {
  const valid: ScopedEvidence[] = []; const rejected: ValidityResult['rejected'] = []; const seen = new Set<string>();
  for (const e of items) {
    if (e.type === 'employee_outcome' && req.requiresExecutionEvidence !== false) { rejected.push({ id: e.id, reason: 'outcome_not_execution' }); continue; } // sonuç, uygulama kanıtı değildir
    if (!TYPE_FOR_RULE[req.ruleType].includes(e.type)) { rejected.push({ id: e.id, reason: 'wrong_type' }); continue; }
    if (req.unitId && !e.unitId) { rejected.push({ id: e.id, reason: 'scope_missing' }); continue; } // kapsam boş bırakılarak doğrulama geçilemez (F27)
    if ((req.unitId && e.unitId && e.unitId !== req.unitId) || (req.metricCode && e.metricCode && e.metricCode !== req.metricCode)) { rejected.push({ id: e.id, reason: 'wrong_scope' }); continue; }
    if (e.type === 'system_data' && !e.metricPeriod && !e.date) { rejected.push({ id: e.id, reason: 'undated' }); continue; }
    if (e.type === 'system_data' && e.date && ((req.windowStart && e.date < req.windowStart) || (req.windowEnd && e.date > req.windowEnd))) { rejected.push({ id: e.id, reason: 'out_of_window' }); continue; }
    if (e.type === 'system_data' && req.period && e.metricPeriod && e.metricPeriod !== req.period) { rejected.push({ id: e.id, reason: 'stale_metric' }); continue; }
    if (req.ruleType !== 'attestation' && req.ruleType !== 'system_metric' && e.type !== 'system_data') {
      if (!e.date) { rejected.push({ id: e.id, reason: 'undated' }); continue; }
      if ((req.windowStart && e.date < req.windowStart) || (req.windowEnd && e.date > req.windowEnd)) { rejected.push({ id: e.id, reason: 'out_of_window' }); continue; }
    }
    const key = e.occurrenceKey ?? (e.fileHash ? `hash:${e.fileHash}:${e.date ?? ''}` : `id:${e.id}`);
    if (seen.has(key)) { rejected.push({ id: e.id, reason: 'duplicate_occurrence' }); continue; }
    seen.add(key); valid.push(e);
  }
  return { valid, rejected };
}
