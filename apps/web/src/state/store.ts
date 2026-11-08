import { useSyncExternalStore } from 'react';
import type { EvidenceLevel, VerificationRoute, LifecycleState, VerificationState, HealthState } from '@hpw-act/domain-core';
/** Prototip kayıt deposu: hedef kabulünden sonraki bütün ekranlar AYNI kimlikli nesneyi kullanır (hedef → aksiyon → kanıt → sonuç).
    Oturum belleğinde tutulur (sessionStorage; yoksa bellek); gerçek sistemde API + sürümlü kayıt. */
export interface StoredLocalTarget { id: string; version: number; unitId: string; dimension: string; itemCode: string; itemText: string; baseline: number; target: number; low: number; high: number; monitoringRole: string; interventionOwnerRole: string; status: 'accepted' | 'exception_pending'; acceptedAt: string; }
export interface StructuredLog { date: string; occurred: boolean; attendance: number; }
export interface StoredAction { id: string; version: number; targetId: string; title: string; lever: string; ownerRole: string; accountableRole: string; evidenceLevel: EvidenceLevel; rule: string; verificationRoute: VerificationRoute; requirement: { ruleType: 'count' | 'attendance'; expected: number; windowStart: string; windowEnd: string; label: string }; lifecycle: LifecycleState; verification: VerificationState; health: HealthState; logs: StructuredLog[]; acceptedAt: string; }
/** Yönetim (Excel) durumu: prototipte tarayıcı belleğinde; gerçek üründe aynı şablonlar sunucuda PostgreSQL'e yazılır. */
export interface AdminUnit { code: string; name: string; type: string; parent: string | null; closed?: boolean; }
export interface AdminRole { code: string; unit: string; title: string; profile: string; holders: string[]; }
export interface AdminItem { code: string; text: string; dimensionCode: string | null; dimensionLabel: string; scaleCode: string; origin: 'STANDARD' | 'CUSTOM'; targetPolicy: string; responsibilityCenter: string; }
export interface AdminResult { n: number; value: number | null; status: 'OBSERVED' | 'SUPPRESSED' | 'OFFICIAL'; }
export interface AdminMember { email: string; name: string; profile: string; roles: string[]; status: 'active' | 'revoked'; invitation: { status: 'ready' | 'pending' | 'accepted' | 'revoked'; version: number; token?: string; delivery?: string } | null; }
export interface AdminMail { id: string; to: string; subject: string; body: string; at: string; token?: string; }
export interface AdminState { tenantCode: string; tenantName: string; unitTypes: { code: string; label: string }[]; units: AdminUnit[]; hierarchies: { code: string; label: string }[]; roles: AdminRole[]; instrument: { version: string; items: AdminItem[]; certificationEligible: boolean; notes: string[] } | null; cycles: { code: string; results: Record<string, Record<string, AdminResult>>; bundles: number }[]; members: AdminMember[]; mails: AdminMail[]; imports: { kind: string; at: string; rows: number; errors: number; committed: boolean }[]; }
export const EMPTY_ADMIN: AdminState = { tenantCode: 'ATLAS', tenantName: 'Atlas Holding', unitTypes: [], units: [], hierarchies: [], roles: [], instrument: null, cycles: [], members: [], mails: [], imports: [] };
interface State { targets: StoredLocalTarget[]; actions: StoredAction[]; admin: AdminState; }
const KEY = 'hpw-act-proto-store';
let state: State = load();
const subs = new Set<() => void>();
function load(): State { try { const raw = sessionStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw) as State; return { targets: s.targets ?? [], actions: s.actions ?? [], admin: { ...EMPTY_ADMIN, ...(s.admin ?? {}) } }; } } catch { /* bellek */ } return { targets: [], actions: [], admin: { ...EMPTY_ADMIN } }; }
function persist() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* bellek */ } }
function set(next: State) { state = next; persist(); subs.forEach(f => f()); }
export function useStore(): State { return useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => state, () => state); }
export const store = {
  acceptTarget(t: Omit<StoredLocalTarget, 'version' | 'acceptedAt' | 'status'>): StoredLocalTarget {
    const existing = state.targets.find(x => x.id === t.id); if (existing) return existing;
    const rec: StoredLocalTarget = { ...t, version: 1, status: 'accepted', acceptedAt: new Date().toISOString() };
    set({ ...state, targets: [...state.targets, rec] }); return rec;
  },
  acceptAction(a: Omit<StoredAction, 'version' | 'acceptedAt' | 'lifecycle' | 'verification' | 'health' | 'logs'>): StoredAction {
    const existing = state.actions.find(x => x.id === a.id); if (existing) return existing;
    const rec: StoredAction = { ...a, version: 1, lifecycle: 'in_progress', verification: 'pending', health: 'on_track', logs: [], acceptedAt: new Date().toISOString() };
    set({ ...state, actions: [...state.actions, rec] }); return rec;
  },
  addLog(actionId: string, log: StructuredLog) { set({ ...state, actions: state.actions.map(a => a.id === actionId ? { ...a, version: a.version + 1, logs: [...a.logs, log] } : a) }); },
  declareComplete(actionId: string) {
    set({ ...state, actions: state.actions.map(a => a.id === actionId ? { ...a, version: a.version + 1, lifecycle: 'declared_complete', verification: a.verificationRoute === 'none_unless_exception' || a.verificationRoute === 'auto' ? 'auto_verified' : 'pending' } : a) });
  },
  humanVerify(actionId: string, ok: boolean) { set({ ...state, actions: state.actions.map(a => a.id === actionId ? { ...a, version: a.version + 1, verification: ok ? 'human_verified' : 'needs_review', lifecycle: ok ? 'closed' : a.lifecycle } : a) }); },
  reset() { set({ targets: [], actions: [], admin: { ...EMPTY_ADMIN } }); },
  admin(): AdminState { return state.admin; },
  setAdmin(fn: (a: AdminState) => AdminState) { set({ ...state, admin: fn(state.admin) }); },
};
