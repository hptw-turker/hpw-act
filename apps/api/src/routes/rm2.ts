import type { FastifyInstance } from 'fastify';
import { withContext, HttpError, type Tx } from '../db.js';
import { requireTenantAsync as requireTenant, profileForUnit, dbCtx, audit, type Principal } from '../auth.js';
import { visibleUnits } from './analysis.js';
import { loadRecords, canUnblockUnit, rm2RecordRoutes, type StepRecords } from './rm2-records.js';

/** v3.0.0 (ADR-0043) — Sade yol haritası. Okuma kapsam ile (visibleUnits); yazma: adım durumu (Yapıldı / Yapılmadı).
 * Kim işaretler: IK adımı → HR_ADMIN, HR_PARTNER (kapsam); kurum YONETIM adımı → EXEC, HR_ADMIN; işletme YONETIM adımı → UNIT_MANAGER, REGION_MANAGER, HR_PARTNER, HR_ADMIN (kapsam).
 * Çalışan adımı ve kurum adımına atıf satırı işaretlenmez; HPW personeli (platform) işaretlemez. */
export const RM2_WRITE = { IK: ['HR_ADMIN', 'HR_PARTNER'], KURUM_YONETIM: ['EXEC', 'HR_ADMIN'], ISLETME_YONETIM: ['UNIT_MANAGER', 'REGION_MANAGER', 'HR_PARTNER', 'HR_ADMIN'] } as const;
/** "Bugün" yalnız kişinin kendi rolünün adımlarını gösterir; İK'nın yönetim adımlarını işaretleyebilmesi yedek yetkidir, plan ekranından kullanılır. */
export const RM2_OWN = { IK: ['HR_ADMIN', 'HR_PARTNER'], KURUM_YONETIM: ['EXEC'], ISLETME_YONETIM: ['UNIT_MANAGER', 'REGION_MANAGER'] } as const;
type P = Principal & { tenantId: string };
const UUID = /^[0-9a-f-]{36}$/i;
const today = () => new Date().toISOString().slice(0, 10);
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export function listFor(role: string, layer: string, M: typeof RM2_WRITE | typeof RM2_OWN = RM2_WRITE): readonly string[] { return role === 'IK' ? M.IK : role === 'YONETIM' ? (layer === 'KURUM' ? M.KURUM_YONETIM : M.ISLETME_YONETIM) : []; }
export async function rightsFor(tx: Tx, p: P, unitId: string, layer: string, cache: Map<string, string | null>) {
  if (p.realm === 'platform') return { IK: false, YONETIM: false, ownIK: false, ownYONETIM: false };
  if (!cache.has(unitId)) cache.set(unitId, (await profileForUnit(tx, p, unitId)) ?? null);
  const prof = cache.get(unitId); const has = (l: readonly string[]) => !!prof && l.includes(prof);
  return { IK: has(listFor('IK', layer)), YONETIM: has(listFor('YONETIM', layer)), ownIK: has(listFor('IK', layer, RM2_OWN)), ownYONETIM: has(listFor('YONETIM', layer, RM2_OWN)) };
}
const STEP_SQL = `SELECT s.id, s.roadmap_id, s.plan_id, s.unit_id, s.role_code, s.role_label, s.phase_days, s.ord, s.text, s.output, s.contribution, s.ref_label, s.ref_step_id,
  to_char(s.due_date, 'YYYY-MM-DD') AS due_date, s.status, s.note, s.version, to_char(s.status_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS status_at, us.display_name AS updated_by_name,
  rs.status AS ref_status, to_char(rs.status_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS ref_status_at, rs.text AS ref_text, rs.output AS ref_output, to_char(rs.due_date, 'YYYY-MM-DD') AS ref_due_date
  FROM rm2_step s LEFT JOIN app_user us ON us.id = s.updated_by LEFT JOIN rm2_step rs ON rs.tenant_id = s.tenant_id AND rs.id = s.ref_step_id`;
type StepRow = Record<string, unknown> & { id: string; unit_id: string; role_code: string; due_date: string; status: string; ref_step_id: string | null };
const NO_RECORDS: StepRecords = { records: [], blockers: [], lastProgress: null };
function stepDto(s: StepRow, canMark: boolean, t: string, rec?: StepRecords, canUnblock = false) {
  const done = s.ref_step_id ? s.ref_status === 'DONE' : s.status === 'DONE';
  const due = (s.ref_step_id ? s.ref_due_date : s.due_date) as string;
  return { id: s.id, role: s.role_code, roleLabel: s.role_label, phaseDays: s.phase_days, ord: s.ord, text: s.text, output: s.output ?? null, contribution: s.contribution ?? null,
    dueDate: due, status: s.role_code === 'CALISAN' ? 'INFO' : done ? 'DONE' : due < t ? 'LATE' : 'OPEN', note: s.note ?? null, statusAt: s.ref_step_id ? s.ref_status_at ?? null : s.status_at ?? null,
    updatedBy: s.ref_step_id ? null : s.updated_by_name ?? null, version: s.version, canMark: canMark && !s.ref_step_id && s.role_code !== 'CALISAN',
    ref: s.ref_step_id ? { label: s.ref_label, text: s.ref_text, output: s.ref_output } : null,
    /* v3.1.0 (R-05…R-09): kayıt geçmişi, açık engeller, son gelişme. Atıf ve çalışan satırında kayıt yoktur. Engel durumdan bağımsızdır. */
    ...(rec ? { records: rec.records, blockers: rec.blockers, lastProgress: rec.lastProgress } : { records: NO_RECORDS.records, blockers: NO_RECORDS.blockers, lastProgress: null }),
    canRecord: canMark && !s.ref_step_id && s.role_code !== 'CALISAN', canUnblock: canUnblock && !s.ref_step_id && s.role_code !== 'CALISAN' };
}
function planDto(pl: Record<string, unknown>) {
  return { id: pl.id, no: pl.plan_no, title: pl.title, itemCode: pl.item_code, itemText: pl.item_text, respondents: n(pl.respondents), currentPos: n(pl.current_pos), currentPct: n(pl.current_pct), comparisonPct: n(pl.comparison_pct),
    targetKind: pl.target_kind, targetPos: n(pl.target_pos), targetPct: n(pl.target_pct), responsibility: pl.responsibility ?? null, impact: pl.impact_text ?? null };
}

export async function rm2Routes(app: FastifyInstance) {
  /** Genel bakış: kullanıcının görebildiği yol haritaları (kurum önce), her biri için rol bazında kareler */
  app.get('/api/t/:tid/rm2', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid);
    return withContext(dbCtx(p), async tx => {
      const vis = await visibleUnits(tx, p); const t = today();
      const rows = (await tx.query(`SELECT r.id, r.unit_id, u.external_id AS unit_code, r.layer, r.unit_label, r.respondents, r.report_title, r.headline, to_char(r.start_date, 'YYYY-MM-DD') AS start_date, r.measure_period, c.code AS cycle_code,
          (SELECT COUNT(*) FROM rm2_plan pl WHERE pl.tenant_id = r.tenant_id AND pl.roadmap_id = r.id)::int AS plans,
          (SELECT COUNT(*) FROM rm2_plan pl WHERE pl.tenant_id = r.tenant_id AND pl.roadmap_id = r.id AND pl.target_kind = 'HEDEF')::int AS targets
        FROM rm2_roadmap r JOIN org_unit u ON u.tenant_id = r.tenant_id AND u.id = r.unit_id JOIN survey_cycle c ON c.tenant_id = r.tenant_id AND c.id = r.cycle_id
        WHERE r.tenant_id = $1 AND r.status = 'active' ORDER BY CASE r.layer WHEN 'KURUM' THEN 0 ELSE 1 END, r.unit_label`, [p.tenantId])).rows.filter(r => vis === 'all' || vis.has(r.unit_id));
      if (!rows.length) return { today: t, roadmaps: [] };
      const steps = (await tx.query(`${STEP_SQL} JOIN rm2_roadmap r ON r.tenant_id = s.tenant_id AND r.id = s.roadmap_id AND r.status = 'active' WHERE s.tenant_id = $1 AND s.role_code <> 'CALISAN'`, [p.tenantId])).rows as StepRow[];
      const roadmaps = rows.map(r => {
        const mine = steps.filter(s => s.roadmap_id === r.id).map(s => stepDto(s, false, t));
        const agg = (role: string) => { const x = mine.filter(s => s.role === role && !s.ref); /* atıf satırı kurum adımında sayılır; işletmede ikinci kez sayılmaz */ return { total: x.length, done: x.filter(s => s.status === 'DONE').length, late: x.filter(s => s.status === 'LATE').length }; };
        const open = mine.filter(s => s.status === 'OPEN').map(s => s.dueDate).sort();
        return { id: r.id, layer: r.layer, unitCode: r.unit_code, unitLabel: r.unit_label, respondents: r.respondents, cycleCode: r.cycle_code, reportTitle: r.report_title, headline: r.headline, startDate: r.start_date, measurePeriod: r.measure_period, plans: r.plans, targets: r.targets, ik: agg('IK'), management: agg('YONETIM'), nextDue: open[0] ?? null };
      });
      return { today: t, roadmaps };
    });
  });

  /** Bugün: kullanıcının kendi rolündeki adımlar (geciken → sıradaki → yapılan) */
  app.get('/api/t/:tid/rm2/me', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid);
    return withContext(dbCtx(p), async tx => {
      const vis = await visibleUnits(tx, p); const t = today(); const cache = new Map<string, string | null>();
      const rows = (await tx.query(`${STEP_SQL} JOIN rm2_roadmap r ON r.tenant_id = s.tenant_id AND r.id = s.roadmap_id AND r.status = 'active' WHERE s.tenant_id = $1 AND s.role_code <> 'CALISAN' AND s.ref_step_id IS NULL ORDER BY s.due_date, s.ord`, [p.tenantId])).rows as StepRow[];
      const meta = new Map<string, { layer: string; unitCode: string; unitLabel: string }>((await tx.query("SELECT r.id, r.layer, r.unit_label, u.external_id FROM rm2_roadmap r JOIN org_unit u ON u.tenant_id = r.tenant_id AND u.id = r.unit_id WHERE r.tenant_id = $1 AND r.status = 'active'", [p.tenantId])).rows.map(r => [r.id, { layer: r.layer, unitCode: r.external_id, unitLabel: r.unit_label }]));
      const plans = new Map<string, Record<string, unknown>>((await tx.query("SELECT pl.* FROM rm2_plan pl JOIN rm2_roadmap r ON r.tenant_id = pl.tenant_id AND r.id = pl.roadmap_id AND r.status = 'active' WHERE pl.tenant_id = $1", [p.tenantId])).rows.map(x => [x.id, x]));
      const out = [] as unknown[]; const mine: { s: StepRow; m: { layer: string; unitCode: string; unitLabel: string } }[] = [];
      for (const s of rows) {
        if (vis !== 'all' && !vis.has(s.unit_id)) continue; const m = meta.get(String(s.roadmap_id))!;
        const rights = await rightsFor(tx, p, s.unit_id, m.layer, cache); const can = s.role_code === 'IK' ? rights.ownIK : rights.ownYONETIM;
        if (can) mine.push({ s, m });
      }
      const recs = await loadRecords(tx, p.tenantId, mine.map(x => x.s.id)); const ub = new Map();
      for (const { s, m } of mine) out.push({ ...stepDto(s, true, t, recs.get(s.id), await canUnblockUnit(tx, p, s.unit_id, ub)), roadmapId: s.roadmap_id, layer: m.layer, unitCode: m.unitCode, unitLabel: m.unitLabel, plan: planDto(plans.get(String(s.plan_id))!) });
      // kararlı sıra: termin → kurum önce → birim adı → plan no → adım sırası (aynı terminli adımlar yeniden yüklemede yer değiştirmez)
      type O = { dueDate: string; layer: string; unitLabel: string; plan: { no: number }; ord: number };
      (out as O[]).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.layer === b.layer ? 0 : a.layer === 'KURUM' ? -1 : 1) || a.unitLabel.localeCompare(b.unitLabel, 'tr') || a.plan.no - b.plan.no || a.ord - b.ord);
      const x = out as { status: string }[];
      return { today: t, counts: { total: x.length, done: x.filter(s => s.status === 'DONE').length, late: x.filter(s => s.status === 'LATE').length, open: x.filter(s => s.status === 'OPEN').length }, steps: out };
    });
  });

  /** Tek yol haritası: planlar, bütün rollerin adımları (atıflar kurum adımının durumuyla), izleme maddeleri */
  app.get('/api/t/:tid/rm2/:rid', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); const { rid } = req.params as { rid: string }; if (!UUID.test(rid)) throw new HttpError(404, 'not_found');
    return withContext(dbCtx(p), async tx => {
      const r = (await tx.query("SELECT r.*, to_char(r.start_date, 'YYYY-MM-DD') AS start_ymd, u.external_id AS unit_code, c.code AS cycle_code FROM rm2_roadmap r JOIN org_unit u ON u.tenant_id = r.tenant_id AND u.id = r.unit_id JOIN survey_cycle c ON c.tenant_id = r.tenant_id AND c.id = r.cycle_id WHERE r.tenant_id = $1 AND r.id = $2", [p.tenantId, rid])).rows[0];
      const vis = await visibleUnits(tx, p);
      if (!r || !(vis === 'all' || vis.has(r.unit_id))) throw new HttpError(404, 'not_found', 'Yol haritası bulunamadı ya da kapsamınızda değil');
      const t = today(); const rights = await rightsFor(tx, p, r.unit_id, r.layer, new Map());
      const plans = (await tx.query('SELECT * FROM rm2_plan WHERE tenant_id = $1 AND roadmap_id = $2 ORDER BY plan_no', [p.tenantId, rid])).rows;
      const steps = (await tx.query(`${STEP_SQL} WHERE s.tenant_id = $1 AND s.roadmap_id = $2 ORDER BY CASE s.role_code WHEN 'YONETIM' THEN 1 WHEN 'IK' THEN 2 ELSE 3 END, s.phase_days, s.ord`, [p.tenantId, rid])).rows as StepRow[];
      const recs = await loadRecords(tx, p.tenantId, steps.filter(s => !s.ref_step_id && s.role_code !== 'CALISAN').map(s => s.id)); const canUb = await canUnblockUnit(tx, p, r.unit_id, new Map());
      const items = (await tx.query('SELECT ord, item_code, item_text, link_label, current_pct, comparison_pct, sector_pct, target_label FROM rm2_item WHERE tenant_id = $1 AND roadmap_id = $2 ORDER BY ord', [p.tenantId, rid])).rows;
      return { id: r.id, status: r.status, layer: r.layer, unitCode: r.unit_code, unitLabel: r.unit_label, respondents: r.respondents, comparisonLabel: r.comparison_label, headline: r.headline, summary: r.summary,
        reportTitle: r.report_title, cycleCode: r.cycle_code, startDate: r.start_ymd, measurePeriod: r.measure_period, today: t, rights: { IK: rights.IK, YONETIM: rights.YONETIM },
        plans: plans.map(pl => ({ ...planDto(pl), steps: steps.filter(s => s.plan_id === pl.id).map(s => stepDto(s, s.role_code === 'IK' ? rights.IK : rights.YONETIM, t, recs.get(s.id), canUb)) })),
        items: items.map(i => ({ ord: i.ord, itemCode: i.item_code, itemText: i.item_text, link: i.link_label, currentPct: n(i.current_pct), comparisonPct: n(i.comparison_pct), sectorPct: n(i.sector_pct), target: i.target_label })) };
    });
  });

  app.post('/api/t/:tid/rm2-steps/:sid', { schema: { body: { type: 'object', required: ['done', 'expectedVersion'], properties: { done: { type: 'boolean' }, note: { type: 'string', maxLength: 1000 }, expectedVersion: { type: 'integer', minimum: 1 } }, additionalProperties: false } } }, async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); const { sid } = req.params as { sid: string }; if (!UUID.test(sid)) throw new HttpError(404, 'not_found');
    const b = req.body as { done: boolean; note?: string; expectedVersion: number };
    return withContext(dbCtx(p), async tx => {
      const s = (await tx.query('SELECT s.*, r.status AS roadmap_status, r.layer FROM rm2_step s JOIN rm2_roadmap r ON r.tenant_id = s.tenant_id AND r.id = s.roadmap_id WHERE s.tenant_id = $1 AND s.id = $2 FOR UPDATE OF s', [p.tenantId, sid])).rows[0];
      const vis = await visibleUnits(tx, p);
      if (!s || !(vis === 'all' || vis.has(s.unit_id))) throw new HttpError(404, 'not_found');
      if (s.roadmap_status !== 'active') throw new HttpError(409, 'roadmap_superseded', 'Bu yol haritasının yeni bir sürümü yüklendi; sayfayı yenileyin');
      if (s.role_code === 'CALISAN') throw new HttpError(422, 'employee_step_not_tracked', 'Çalışan adımları işaretlenmez; bilgi içindir');
      if (s.ref_step_id) throw new HttpError(422, 'reference_step', 'Bu satır kurum planındaki bir adıma bağlı; durumu kurum adımında işaretlenir');
      const allowed = listFor(s.role_code, s.layer); const rights = await rightsFor(tx, p, s.unit_id, s.layer, new Map());
      if (!(s.role_code === 'IK' ? rights.IK : rights.YONETIM)) throw new HttpError(403, 'not_allowed', 'Bu adımı işaretleme yetkiniz yok');
      req.idempotencyResource = { scope: 'unit', unitId: s.unit_id, profiles: [...allowed] as never[] };
      if (s.version !== b.expectedVersion) throw new HttpError(409, 'version_conflict', 'Bu adım siz bakarken güncellendi; sayfayı yenileyip yeniden deneyin', { current: { status: s.status, version: s.version } });
      const status = b.done ? 'DONE' : 'NOT_DONE'; const note = b.note?.trim() || null;
      /* v3.1.0 (R-05/R-08): not sütununun üzerine artık yazılmaz; not ve durum değişikliği (Yapıldı / Geri alındı) kayıt geçmişine eklenir. Engel durumu değişmez. */
      const u = (await tx.query("UPDATE rm2_step SET status = $3, updated_by = $4, status_at = now(), updated_at = now(), version = version + 1 WHERE tenant_id = $1 AND id = $2 RETURNING version, to_char(status_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS status_at", [p.tenantId, sid, status, p.userId])).rows[0];
      if (s.status !== status) await tx.query('INSERT INTO rm2_step_record (tenant_id, step_id, roadmap_id, unit_id, kind, created_by) VALUES ($1,$2,$3,$4,$5,$6)', [p.tenantId, sid, s.roadmap_id, s.unit_id, b.done ? 'DONE' : 'UNDO', p.userId]);
      if (note) await tx.query("INSERT INTO rm2_step_record (tenant_id, step_id, roadmap_id, unit_id, kind, body, created_by, created_at) VALUES ($1,$2,$3,$4,'NOTE',$5,$6, now() + interval '1 millisecond')", [p.tenantId, sid, s.roadmap_id, s.unit_id, note, p.userId]);
      await audit(tx, p, 'rm2_step', sid, 'status', { status: s.status }, { status }, note ?? undefined);
      const t = today(); const due = String(s.due_date instanceof Date ? s.due_date.toISOString().slice(0, 10) : s.due_date).slice(0, 10);
      return { id: sid, status: b.done ? 'DONE' : due < t ? 'LATE' : 'OPEN', note, version: u.version, statusAt: u.status_at };
    });
  });

  await rm2RecordRoutes(app, {
    canRecord: async (tx, p, s) => { const r = await rightsFor(tx, p, s.unit_id, s.layer, new Map()); return s.role_code === 'IK' ? r.IK : r.YONETIM; },
    writeProfiles: (role, layer) => listFor(role, layer),
  });
}
