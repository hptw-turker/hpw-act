import type { Tx } from '../db.js';
import type { Sheet } from '../xlsx.js';
import type { Report } from '../validation.js';
export interface ImportCtx { tenantId: string; tenantCode: string; organizationId: string; userId: string; cycleId?: string | null; grantable?: string[]; actorProfile?: string; }
export interface ValidationResult { report: Report; payload: Record<string, unknown>; preview: Record<string, unknown>; rowCount: number; templateVersion: string; pinned?: Record<string, string | null>; }
export interface Importer { kind: 'org' | 'users' | 'instrument' | 'results' | 'roadmap' | 'roadmap2'; template(tx: Tx, ctx: ImportCtx): Promise<Buffer>; validate(sheets: Record<string, Sheet>, tx: Tx, ctx: ImportCtx): Promise<ValidationResult>; commit(payload: Record<string, unknown>, tx: Tx, ctx: ImportCtx): Promise<Record<string, unknown>>; /** Doğrulamada pinlenen sürümlerin şu anki değeri (R23) */ pinnedNow?(tx: Tx, ctx: ImportCtx): Promise<Record<string, string | null>>; /** Onay anında yeniden yetkilendirilecek profiller (V07) */ grantsRequired?(payload: Record<string, unknown>): string[]; /** Onay anında kapsam yetkisi istenecek birim kodları (M09); kök birim/şirket düzeyi için '*' */ unitsAffected?(payload: Record<string, unknown>): string[]; }
export const TEMPLATE_VERSION = 'v2.5-1';
export async function tenantInfo(tx: Tx, tenantId: string): Promise<{ code: string; name: string; organizationId: string; locale: string; timezone: string }> {
  const t = (await tx.query('SELECT code, name, locale, timezone FROM tenant WHERE id = $1', [tenantId])).rows[0];
  const o = (await tx.query('SELECT id FROM organization WHERE tenant_id = $1 ORDER BY created_at LIMIT 1', [tenantId])).rows[0];
  if (!t || !o) throw new Error('tenant_not_found');
  return { code: t.code, name: t.name, organizationId: o.id, locale: t.locale, timezone: t.timezone };
}
/** Dosyadaki tenant_code bir kontrol alanıdır; oturumun tenant bağlamını değiştiremez (F: teknik kod yetki vermez). */
export function checkTenantCode(sheets: Record<string, Sheet>, ctx: ImportCtx, rep: Report, sheetNames: string[]) {
  for (const sn of sheetNames) { const s = sheets[sn]; if (!s) continue; for (const r of s.rows) { const tc = r.cells['tenant_code'] ?? ''; if (tc && tc !== ctx.tenantCode) rep.error(sn, r.n, 'tenant_code', 'tenant_code_mismatch', `Dosyadaki şirket kodu (${tc}) oturumdaki şirketle (${ctx.tenantCode}) uyuşmuyor; dosya bu şirkete işlenemez`, tc); } }
}
