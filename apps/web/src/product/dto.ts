/** N03/N04: çalışma anı yanıt doğrulaması. Şemalar ürün sözleşmesinin (docs/api/openapi-urun.json) ekranların kullandığı alt kümesidir;
 * tools/tests/fe/dto-contract.mts her alanın sözleşmede aynı türle bulunduğunu doğrular. Beklenmeyen biçim (ör. liste yerine {}) ekranı çökertmez: anlaşılır hata + yeniden dene. */
import { tt } from './i18n';
import { ApiError } from './api';
export type Schema = { type: 'object'; required?: Record<string, Schema> } | { type: 'array'; items?: Schema } | { type: 'string' | 'number' | 'boolean'; nullable?: boolean; enum?: string[] } | { type: 'any' };
const S = (t: 'string' | 'number' | 'boolean', nullable = false): Schema => ({ type: t, nullable });
const O = (required: Record<string, Schema> = {}): Schema => ({ type: 'object', required });
const A = (items?: Schema): Schema => ({ type: 'array', items });
/** v2.11.2 (V2111-R2): izin verilen değerler; boş metin ve bilinmeyen değer hata. nullable=true ise yalnız gerçek null geçerli (alanın yokluğu her zaman hata) */
const E = (values: string[], nullable = false): Schema => ({ type: 'string', nullable, enum: values });
export function validate(v: unknown, s: Schema, path = '$'): string | null {
  if (s.type === 'any') return null;
  if (s.type === 'array') { if (!Array.isArray(v)) return tt("{0}: liste bekleniyordu", path); if (s.items) for (let i = 0; i < v.length; i++) { const e = validate(v[i], s.items, `${path}[${i}]`); if (e) return e; } return null; }
  if (s.type === 'object') { if (v === null || typeof v !== 'object' || Array.isArray(v)) return tt("{0}: nesne bekleniyordu", path); for (const [k, sub] of Object.entries(s.required ?? {})) { const o = v as Record<string, unknown>; if (!(k in o)) return tt("{0}.{1}: zorunlu alan yok", path, k); const e = validate(o[k], sub, `${path}.${k}`); if (e) return e; } return null; }
  if (v === null) return (s as { nullable?: boolean }).nullable ? null : tt("{0}: boş olamaz", path);
  if (typeof v !== s.type) return tt("{0}: {1} bekleniyordu", path, s.type);
  const en = (s as { enum?: string[] }).enum; if (en && !en.includes(v as string)) return tt("{0}: izin verilmeyen değer", path);
  return null;
}
export function checkDto<T>(v: unknown, s: Schema, what: string): T { const e = validate(v, s); if (e) throw new ApiError(502, 'bad_response', tt("Sunucudan beklenmeyen biçimde yanıt geldi ({0} · {1}); yeniden deneyin. Sorun sürerse sistem yöneticisine bildirin.", what.replace(/^\/api\/t\/[^/]+/, ''), e)); return v as T; }
/** Ekranların kullandığı yanıtlar (sözleşmenin alt kümesi) */
export const DTO = {
  me: O({ userId: S('string'), realm: S('string') }),
  overview: O({ tenant: O({ name: S('string'), code: S('string') }) }),
  permissions: O({ profile: S('string', true), companyWide: S('boolean'), unitProfile: S('string', true), rules: O({ unit: O(), tenant: O(), companyWide: O(), screens: O() }) }), // 'contract' sürüm etiketidir; gerçek sunucu her zaman gönderir ama arayüz mantığı buna bağlı değildir, eksikliği mutasyonları kilitli tutmaz
  cycles: A(O({ id: S('string'), code: S('string') })),
  units: A(O({ id: S('string'), code: S('string'), name: S('string') })),
  /** v2.15.0 yol haritası (ADR-0042): bozuk yanıt kontrollü hata olur, ekran çökmez */
  roadmaps: O({ cycles: A(O({ id: S('string'), code: S('string') })), cycleId: S('string', true), companyPriorities: A(), units: A(O({ roadmapId: S('string'), unitCode: S('string'), unitLabel: S('string'), plans: S('number'), management: O({ done: S('number'), total: S('number') }), hr: O({ done: S('number'), total: S('number') }), milestones: O({ done: S('number'), total: S('number'), overdue: S('number') }) })) }),
  roadmapDetail: O({ unitLabel: S('string'), cycleCode: S('string'), startDate: S('string'), content: O({ header: O() }), plans: A(O({ no: S('number'), title: S('string'), steps: A(O({ id: S('string'), role: S('string'), status: S('string'), version: S('number') })), milestones: A(O({ id: S('string'), status: S('string'), dueDate: S('string'), version: S('number') })) })), rights: O({ IK: S('boolean'), YONETIM: S('boolean'), milestone: S('boolean') }) }),
  roadmapHrSteps: A(O({ id: S('string'), status: S('string'), version: S('number') })),
  results: O({ cycle: O({ code: S('string') }), unit: O({ name: S('string') }), rows: A(O({ metricCode: S('string'), itemCode: S('string'), suppressed: S('boolean'), n: S('number', true), value: S('number', true) })) }),
  targets: A(O({ id: S('string'), item_code: S('string'), status: S('string'), version: S('number') })),
  actions: A(O({ id: S('string'), title: S('string'), lifecycle_state: S('string'), requirement: O({ expected: S('number') }), fulfilled_slots: S('number') })), // v2.14.1 A02: karşılanan plan dönemi sayısı sunucudan
  actionDetail: O({ evidence: A(O({ id: S('string') })) }),
  planSteps: O({ fromPlan: S('boolean'), total: S('number'), doneCount: S('number'), steps: A(O({ index: S('number'), text: S('string'), doneAt: S('string', true) })) }), // v2.14.0 pano plan adımları
  recommendations: O({ recommendations: A(O({ code: S('string'), title: S('string') })) }),
  users: A(O({ membership_id: S('string'), email: S('string') })),
  org: O({
    unitTypes: A(O({ code: S('string'), label: S('string') })),
    units: A(O({ id: S('string'), code: S('string'), name: S('string'), unit_type: S('string'), parent_code: S('string', true), effective_to: S('string', true) })),
    hierarchies: A(O({ code: S('string'), name: S('string') })),
    roles: A(O({ id: S('string'), code: S('string'), title: S('string'), permission_profile: S('string'), unit_code: S('string'), holders: S('string', true), effective_to: S('string', true) })),
  }),
  instruments: A(O({ id: S('string'), version: S('string') })),
  attention: A(O({ id: S('string'), title: S('string'), route: S('string') })),
  queue: A(O({ id: S('string'), kind: S('string'), state: S('string') })),
  deployments: A(O({ id: S('string'), code: S('string'), status: S('string') })),
  ambitions: O({ companyWide: S('boolean'), ambitions: A(O({ id: S('string'), status: S('string') })) }),
  // v2.10.0 şirket işletimi
  platformTenantDetail: O({ tenant: O({ id: S('string'), code: S('string'), name: S('string'), status: S('string'), tracked_cycle_id: S('string', true), ops_version: S('number') }), onboarding: O({ steps: A(O({ key: S('string'), no: S('number'), state: S('string'), owner: S('string'), blockedBy: S('string', true) })), summary: O({ done: S('number'), total: S('number') }), fingerprints: O({ service_record: S('string', true), go_live: S('string') }) }), cycles: A(O({ id: S('string'), code: S('string'), name: S('string'), tracked: S('boolean') })), assignments: A(O({ user_id: S('string'), display_name: S('string'), duty: S('string') })), recentEvents: A(O({ id: S('string'), occurred_at: S('string'), action: S('string') })), can: O({ setup: S('boolean'), manage: S('boolean'), approveServiceRecord: S('boolean'), approveGoLive: S('boolean') }) }),
  versionResult: O({ version: S('number') }),
  goLiveCustomer: O({ state: S('string'), hpwApprovedAt: S('string', true), customerConfirmedAt: S('string', true), awaitingCustomer: S('boolean'), fingerprint: S('string', true) }),
  // v2.11.0 bekleyen işler
  workItems: O({ generatedAt: S('string'), items: A(O({ id: S('string'), tenant_id: S('string'), tenant_code: S('string'), tenant_name: S('string'), rule: S('string'), state: E(['open', 'claimed', 'snoozed', 'dismissed', 'tenant_inactive', 'resolved']), version: S('number'), eval_status: E(['ok', 'unreadable', 'not_evaluable']), due_at: S('string'), last_ok_eval_at: S('string', true), claimed_by_name: S('string', true), can: O({ claim: S('boolean'), release: S('boolean'), snooze: S('boolean'), dismiss: S('boolean') }) })), evaluations: A(O({ tenant_id: S('string'), rule: S('string'), status: E(['ok', 'unreadable', 'not_evaluable']), last_ok_at: S('string', true), active_item_state: E(['open', 'claimed', 'snoozed', 'dismissed', 'tenant_inactive'], true) })), evaluationFailures: A(O({ tenantId: S('string') })), evaluationDeferred: A(S('string')) }), // v2.11.2 (V2111-R2): active_item_state zorunlu; eksik/boolean/boş/bilinmeyen → hata
  commandOutcome: O({ key: S('string'), status: E(['applied', 'not_found']), route: S('string', true) }), // v2.11.4 komut sonucu (işlem anahtarına bağlı kanıt)
  workItemHistory: A(O({ id: S('string'), occurred_at: S('string'), action: S('string'), reason: S('string', true) })),
  workItemResult: O({ workItem: O({ id: S('string'), state: S('string'), version: S('number') }) }),
  // v2.9.1 (V290-03): yeni merkez uçları çalışma anında doğrulanır
  platformMe: O({ role: S('string', true), canManage: S('boolean') }),
  platformTenants: A(O({ id: S('string'), code: S('string'), name: S('string') })), // seçicilerde kullanılan alanlar zorunlu
  staff: A(O({ user_id: S('string'), email: S('string'), display_name: S('string'), role: S('string', true), role_revoked_at: S('string', true), user_status: S('string'), last_login_at: S('string', true), tenants: S('number') })),
  assignments: A(O({ user_id: S('string'), email: S('string'), display_name: S('string'), role: S('string', true), duty: S('string'), valid_from: S('string'), valid_to: S('string', true), reason: S('string', true) })),
  auditEvents: O({ items: A(O({ id: S('string'), occurred_at: S('string'), action: S('string'), result: S('string'), actor_email: S('string', true), tenant_code: S('string', true), reason: S('string', true), intervention_id: S('string', true) })), nextBefore: S('string', true) }),
  mfaState: O({ enabled: S('boolean'), pending: S('boolean') }),
  mfaSetup: O({ secret: S('string'), otpauthUri: S('string') }),
  mfaVerify: O({ verified: S('boolean') }),
  portfolio: O({ contract: S('string'), generatedAt: S('string'), scope: O({ tenants: S('number'), failed: S('number') }), items: A(O({ id: S('string'), code: S('string'), name: S('string'), status: S('string'), error: S('string', true) })) }),
};
