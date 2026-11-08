/** I-10 / T-07: bir (parentTarget, childUnit) çifti için aktif aritmetik kenar en fazla bir. DB'de partial unique index; burada uygulama düzeyi doğrulama. */
export interface TargetEdge {
  parentTargetId: string;
  childUnitId: string;
  relationshipType: string;
  active: boolean;
}
export const ARITHMETIC_EDGE_TYPES = new Set(['inherited', 'shared', 'exception']);

export interface CanonicalViolation { parentTargetId: string; childUnitId: string; count: number; }

export function findCanonicalViolations(edges: TargetEdge[]): CanonicalViolation[] {
  const counts = new Map<string, number>();
  for (const e of edges) {
    if (!e.active || !ARITHMETIC_EDGE_TYPES.has(e.relationshipType)) continue;
    const k = `${e.parentTargetId}::${e.childUnitId}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out: CanonicalViolation[] = [];
  for (const [k, c] of counts) if (c > 1) { const [p, u] = k.split('::'); out.push({ parentTargetId: p!, childUnitId: u!, count: c }); }
  return out;
}

/** Yeni kenar eklemeden önce çağrılır; ihlalde hata fırlatır (`canonical_edge_violation`). */
export function assertCanonicalEdge(existing: TargetEdge[], candidate: TargetEdge): void {
  const v = findCanonicalViolations([...existing, candidate]);
  if (v.length) {
    const err = new Error(`canonical_edge_violation: ${candidate.parentTargetId}/${candidate.childUnitId}`);
    (err as Error & { code: string }).code = 'canonical_edge_violation';
    throw err;
  }
}
