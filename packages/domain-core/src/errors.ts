/** Domain hataları: geçersiz girdi hiçbir sınırda sessizce geçmez. */
export class DomainError extends Error { code: string; details?: unknown; constructor(code: string, message: string, details?: unknown) { super(`${code}: ${message}`); this.code = code; this.details = details; } }
export const invalid = (code: string, message: string, details?: unknown) => new DomainError(code, message, details);
export const isFiniteNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
