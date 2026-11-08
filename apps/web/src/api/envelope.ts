/** Komut zarfı — her yazma isteği. actor/acting_for sunucuda türetilir, buradan gönderilmez. */
export interface CommandHeaders { 'Idempotency-Key': string; 'If-Match': string; 'X-Correlation-Id': string; 'X-Causation-Id'?: string; }
export interface VersionConflict { kind: 'version'; currentVersion: number; yourVersion: number; changedBy: string; changedFields: string[]; }
export interface SemanticConflict { kind: 'semantic'; reason: 'aggregate_cancelled' | 'aggregate_closed' | 'unit_closed'; occurredAt: string; options: ('attach_as_comment' | 'discard')[]; }
export type Conflict = VersionConflict | SemanticConflict;

/** UUID v7 (zaman sıralı) — command_id ve correlation için. */
export function uuidv7(): string {
  const ts = BigInt(Date.now());
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  b[0] = Number((ts >> 40n) & 0xffn); b[1] = Number((ts >> 32n) & 0xffn); b[2] = Number((ts >> 24n) & 0xffn);
  b[3] = Number((ts >> 16n) & 0xffn); b[4] = Number((ts >> 8n) & 0xffn); b[5] = Number(ts & 0xffn);
  b[6] = (b[6]! & 0x0f) | 0x70; b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function commandHeaders(expectedVersion: number, correlationId = uuidv7(), causationId?: string): CommandHeaders {
  const h: CommandHeaders = { 'Idempotency-Key': uuidv7(), 'If-Match': String(expectedVersion), 'X-Correlation-Id': correlationId };
  if (causationId) h['X-Causation-Id'] = causationId;
  return h;
}

export class ConflictError extends Error { constructor(public conflict: Conflict) { super(conflict.kind === 'version' ? 'version_conflict' : 'semantic_conflict'); } }

/** Gerçek API için fetch sarmalayıcısı; mock adaptör aynı sözleşmeyi uygular. */
export async function command<T>(url: string, body: unknown, expectedVersion: number): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...commandHeaders(expectedVersion) }, body: JSON.stringify(body) });
  if (res.status === 409) { const c = await res.json(); throw new ConflictError(c.reason ? { kind: 'semantic', ...c } : { kind: 'version', ...c }); }
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.json() as Promise<T>;
}
