/** Rol merkezli sahiplik (v2.3): sorumluluk organizasyonel rolde (Konak Şube Müdürü) durur; kişi effective-dated çözülür. Kişi ayrılınca sorumluluk taşınmaz, rol boşalır ve doldurulur. */
export interface OrgRole { roleId: string; roleType: string; unitId: string; }
export interface RoleHolder { roleId: string; personId: string; from: string; to?: string; kind: 'primary' | 'delegate' | 'acting'; }
export interface Resolution { roleId: string; personId: string | null; kind: RoleHolder['kind'] | 'vacant'; }
import { invalid } from '../errors.js';
const ms = (iso: string): number => { const t = Date.parse(iso); if (!Number.isFinite(t)) throw invalid('invalid_timestamp', `Zaman damgası geçersiz: ${iso}`); return t; };
/** Zamanlar UTC anına çevrilerek kıyaslanır (metin kıyası yok). Aynı türde iki eşzamanlı atama → çakışma hatası (veritabanında EXCLUDE ile de korunur). */
export function resolveAccountable(role: OrgRole, holders: RoleHolder[], asOf: string): Resolution {
  const at = ms(asOf);
  const active = holders.filter(h => h.roleId === role.roleId && ms(h.from) <= at && (!h.to || ms(h.to) > at));
  for (const kind of ['primary', 'delegate', 'acting'] as const) {
    const same = active.filter(h => h.kind === kind);
    if (same.length > 1) throw invalid('assignment_conflict', `Aynı rolde eşzamanlı ${kind} atamaları: ${same.map(h => h.personId).join(', ')}`, { roleId: role.roleId, kind, personIds: same.map(h => h.personId) });
  }
  const primary = active.find(h => h.kind === 'primary'); const delegate = active.find(h => h.kind === 'delegate'); const acting = active.find(h => h.kind === 'acting');
  const pick = delegate ?? acting ?? primary;
  return pick ? { roleId: role.roleId, personId: pick.personId, kind: pick.kind } : { roleId: role.roleId, personId: null, kind: 'vacant' };
}
