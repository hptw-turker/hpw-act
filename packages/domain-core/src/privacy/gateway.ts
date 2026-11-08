/** Gizlilik çıktı kapısı (v2.3.1): VARSAYILAN RET. Bilinmeyen birim, bilinmeyen metrik/dönem, yetersiz yanıt ya da çözümlenemeyen yetki → DENY.
    Skor eşiği ve yorum eşiği ayrı hesaplanır; yalnız `suppressed` bayrağına güvenilmez (n ile birlikte). Her karar kaydedilir.
    Gizli birim hiçbir sayısal türetilmiş çıktı almaz; katkı projeksiyonu birim kapsamında gösterilmez. */
export type OutputType = 'score' | 'baseline' | 'target' | 'target_range' | 'delta' | 'contribution' | 'rank' | 'benchmark_gap' | 'explanation_numeric' | 'response_rate' | 'comment' | 'action_rationale' | 'export';
export interface UnitPrivacy { unitId: string; n: number; suppressed?: boolean; commentN?: number; }
export interface Viewer { id?: string; scope: 'unit' | 'region' | 'company' | 'tenant' | 'platform'; unitId?: string; }
export interface PrivacyPolicy { scoreThreshold: number; commentThreshold: number; }
export const DEFAULT_PRIVACY_POLICY: PrivacyPolicy = { scoreThreshold: 5, commentThreshold: 10 };

export const NUMERIC_OUTPUTS: OutputType[] = ['score', 'baseline', 'target', 'target_range', 'delta', 'contribution', 'rank', 'benchmark_gap', 'explanation_numeric', 'response_rate', 'export'];

/** Gizlilik durumu n'den hesaplanır; bayrak yalnız daha kısıtlayıcı olabilir. */
export function isSuppressed(u: UnitPrivacy, p: PrivacyPolicy = DEFAULT_PRIVACY_POLICY): boolean { return u.suppressed === true || !Number.isFinite(u.n) || u.n < p.scoreThreshold; }
export function canExposeComments(u: UnitPrivacy, p: PrivacyPolicy = DEFAULT_PRIVACY_POLICY): boolean { return !isSuppressed(u, p) && (u.commentN ?? u.n) >= p.commentThreshold; }

export type DenyReason = 'ok' | 'unknown_unit' | 'suppressed_unit' | 'secondary_suppression' | 'differencing' | 'contribution_unit_scope' | 'comment_threshold' | 'unknown_viewer';
export function canExpose(viewer: Viewer, unit: UnitPrivacy | undefined, output: OutputType, p: PrivacyPolicy = DEFAULT_PRIVACY_POLICY): { allowed: boolean; reason: DenyReason } {
  if (!unit) return { allowed: false, reason: 'unknown_unit' };
  if (output === 'comment') return canExposeComments(unit, p) ? { allowed: true, reason: 'ok' } : { allowed: false, reason: isSuppressed(unit, p) ? 'suppressed_unit' : 'comment_threshold' };
  if (isSuppressed(unit, p) && NUMERIC_OUTPUTS.includes(output)) return { allowed: false, reason: 'suppressed_unit' };
  if (output === 'contribution' && viewer.scope === 'unit') return { allowed: false, reason: 'contribution_unit_scope' };
  return { allowed: true, reason: 'ok' };
}

/** İkincil baskılama: üst değer görünür ve alt birimlerden tam biri gizliyse en küçük görünen alt birim de gizlenir. */
export function secondarySuppression(parentVisible: boolean, children: UnitPrivacy[], p: PrivacyPolicy = DEFAULT_PRIVACY_POLICY): { suppressAdditional: string[] } {
  const hidden = children.filter(c => isSuppressed(c, p)); const visible = children.filter(c => !isSuppressed(c, p));
  if (!parentVisible || hidden.length !== 1 || visible.length === 0) return { suppressAdditional: [] };
  const smallest = [...visible].sort((a, b) => a.n - b.n)[0]!;
  return { suppressAdditional: [smallest.unitId] };
}

/** Önceden tanımlı rapor hücreleri üzerinde tamamlayıcı baskılama: iki hücrenin simetrik farkı yalnız gizli birimlerden oluşuyorsa (boş değil), küçük hücre de bastırılır.
    Serbest sorgu analizi yerine yayımlanacak hücreler önceden belirlenir; A04 tipi üç-toplam çıkarımı bu yolla kapanır. */
export interface ReportCell { cellId: string; unitIds: string[]; }
export function planReportCells(cells: ReportCell[], units: Record<string, UnitPrivacy>, p: PrivacyPolicy = DEFAULT_PRIVACY_POLICY): { publish: string[]; suppress: { cellId: string; reason: 'contains_only_hidden' | 'complementary' }[] } {
  const hidden = new Set(Object.values(units).filter(u => isSuppressed(u, p)).map(u => u.unitId));
  const suppress = new Map<string, 'contains_only_hidden' | 'complementary'>();
  for (const c of cells) { const vis = c.unitIds.filter(u => !hidden.has(u)); if (vis.length === 0 || c.unitIds.some(u => !units[u])) suppress.set(c.cellId, 'contains_only_hidden'); }
  // Genel kural (F16): yayımlanan hücrelerin gösterge vektörleri herhangi bir gizli birimin birim vektörünü doğrusal olarak üretebiliyorsa (A+H, B+H, A+B → H=(X+Y−Z)/2 dahil) küme güvenli değildir.
  const allUnits = [...new Set(cells.flatMap(c => c.unitIds))];
  const leaks = (live: ReportCell[]): string | null => { for (const h of allUnits) { if (!hidden.has(h)) continue; if (inSpan(live.map(c => allUnits.map(u => (c.unitIds.includes(u) ? 1 : 0))), allUnits.map(u => (u === h ? 1 : 0)))) return h; } return null; };
  for (;;) {
    const live = cells.filter(c => !suppress.has(c.cellId)); const h = leaks(live); if (!h) break;
    const cand = live.filter(c => c.unitIds.includes(h)).sort((a, b) => a.unitIds.length - b.unitIds.length)[0] ?? [...live].sort((a, b) => a.unitIds.length - b.unitIds.length)[0]!;
    suppress.set(cand.cellId, 'complementary');
  }
  return { publish: cells.filter(c => !suppress.has(c.cellId)).map(c => c.cellId), suppress: [...suppress].map(([cellId, reason]) => ({ cellId, reason })) };
}

/** Gauss eliminasyonu (küçük matris): hedef vektör, satır uzayında mı? */
function inSpan(rows: number[][], target: number[]): boolean {
  const m = rows.map(r => [...r]); const n = target.length; const pivots: number[] = []; let rank = 0;
  for (let col = 0; col < n && rank < m.length; col++) { let piv = -1; for (let r = rank; r < m.length; r++) if (Math.abs(m[r]![col]!) > 1e-9) { piv = r; break; } if (piv < 0) continue; [m[rank], m[piv]] = [m[piv]!, m[rank]!]; const pv = m[rank]![col]!; for (let k = 0; k < n; k++) m[rank]![k] = m[rank]![k]! / pv; for (let r = 0; r < m.length; r++) if (r !== rank && Math.abs(m[r]![col]!) > 1e-9) { const f = m[r]![col]!; for (let k = 0; k < n; k++) m[r]![k] = m[r]![k]! - f * m[rank]![k]!; } pivots.push(col); rank++; }
  const t = [...target]; for (let i = 0; i < rank; i++) { const col = pivots[i]!; const f = t[col]!; if (Math.abs(f) > 1e-9) for (let k = 0; k < n; k++) t[k] = t[k]! - f * m[i]![k]!; }
  return t.every(x => Math.abs(x) < 1e-9);
}
/** Sorgu geçmişiyle fark koruması (ek katman): iki sorgunun farkı yalnız gizli birimlerden oluşuyorsa ikinci sorgu bastırılır. */
export interface AggregateQuery { unitIds: string[]; }
export function differencingRisk(previous: AggregateQuery[], current: AggregateQuery, units: Record<string, UnitPrivacy>, p: PrivacyPolicy = DEFAULT_PRIVACY_POLICY): { blocked: boolean; leakedUnitIds?: string[] } {
  const cur = new Set(current.unitIds);
  for (const q of previous) {
    const prev = new Set(q.unitIds);
    const diff = [...new Set([...cur, ...prev])].filter(u => cur.has(u) !== prev.has(u));
    if (diff.length > 0 && diff.every(u => units[u] && isSuppressed(units[u]!, p))) return { blocked: true, leakedUnitIds: diff };
  }
  return { blocked: false };
}

export interface DisclosureDecision { viewerId: string; output: OutputType; unitIds: string[]; allowed: boolean; reason: DenyReason; at: string; }
export function decide(viewer: Viewer, output: OutputType, query: AggregateQuery, units: Record<string, UnitPrivacy>, history: AggregateQuery[], p: PrivacyPolicy = DEFAULT_PRIVACY_POLICY, now = new Date().toISOString()): DisclosureDecision {
  const base = { viewerId: viewer.id ?? '', output, unitIds: query.unitIds, at: now };
  if (!viewer.id) return { ...base, allowed: false, reason: 'unknown_viewer' };
  if (query.unitIds.length === 0) return { ...base, allowed: false, reason: 'unknown_unit' };
  for (const id of query.unitIds) { const r = canExpose(viewer, units[id], output, p); if (!r.allowed) return { ...base, allowed: false, reason: r.reason }; }
  if (NUMERIC_OUTPUTS.includes(output) && differencingRisk(history, query, units, p).blocked) return { ...base, allowed: false, reason: 'differencing' };
  return { ...base, allowed: true, reason: 'ok' };
}

/** Gizli birim için izin verilen açıklama kalıbı (sayı içermez). */
export function suppressedRationale(parentUnitName: string, metric: string): string {
  return `${parentUnitName} önceliği kapsamında ${metric} için bu yönetim uygulaması öneriliyor.`;
}
