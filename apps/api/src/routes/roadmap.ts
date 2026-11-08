import type { FastifyInstance } from 'fastify';
import { withContext, HttpError, type Tx } from '../db.js';
import { requireTenantAsync as requireTenant, requireUnitProfile, profileForUnit, dbCtx, audit, type Principal } from '../auth.js';
import { visibleUnits } from './analysis.js';

/** v2.15.0 — Yol haritası (sunumla birebir). Okuma: birim kapsamı (visibleUnits); yazma: adım ve takvim durumu.
 * Yetki: IK adımı → birimi kapsayan HR_ADMIN / HR_PARTNER; YONETIM adımı ve takvim → HR_ADMIN, HR_PARTNER, REGION_MANAGER, UNIT_MANAGER; CALISAN adımı güncellenmez. */
export const ROADMAP_WRITE = { IK: ['HR_ADMIN', 'HR_PARTNER'], YONETIM: ['HR_ADMIN', 'HR_PARTNER', 'REGION_MANAGER', 'UNIT_MANAGER'], milestone: ['HR_ADMIN', 'HR_PARTNER', 'REGION_MANAGER', 'UNIT_MANAGER'] } as const;
type P = Principal & { tenantId: string };
const UUID = /^[0-9a-f-]{36}$/i;
const today = () => new Date().toISOString().slice(0, 10);
const d10 = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v === null || v === undefined ? null : String(v).slice(0, 10));

async function canSee(tx: Tx, p: P, unitId: string) { const vis = await visibleUnits(tx, p); return vis === 'all' || vis.has(unitId); }
async function writeRights(tx: Tx, p: P, unitId: string) {
  const prof = await profileForUnit(tx, p, unitId);
  const has = (l: readonly string[]) => p.realm !== 'platform' && !!prof && l.includes(prof); // HPW personeli yol haritası takibini arayüzden yazmaz (müşterinin işletme kararı)
  return { IK: has(ROADMAP_WRITE.IK), YONETIM: has(ROADMAP_WRITE.YONETIM), milestone: has(ROADMAP_WRITE.milestone) };
}

async function followup(tx: Tx, tenantId: string, cycleId: string, unitId: string, itemCode: string | null) {
  if (!itemCode) return null;
  const r = (await tx.query(`SELECT c.code, r.favorable_pct, r.suppressed FROM survey_cycle c0 JOIN survey_cycle c ON c.tenant_id = c0.tenant_id AND c.period_start > c0.period_end
      JOIN result r ON r.tenant_id = c.tenant_id AND r.cycle_id = c.id AND r.import_batch_id = c.active_batch_id AND r.unit_id = $3
      JOIN item_metric im ON im.tenant_id = r.tenant_id AND im.instrument_version_id = c.instrument_version_id AND im.metric_code = r.metric_code AND im.item_code = $4
      WHERE c0.tenant_id = $1 AND c0.id = $2 ORDER BY c.period_start LIMIT 1`, [tenantId, cycleId, unitId, itemCode])).rows[0] as { code: string; favorable_pct: string | null; suppressed: boolean } | undefined;
  if (!r) return null;
  return r.suppressed ? { cycle: r.code, suppressed: true, value: null } : { cycle: r.code, suppressed: false, value: r.favorable_pct === null ? null : Number(r.favorable_pct) };
}

export async function roadmapRoutes(app: FastifyInstance) {
  /** Birim listesi + özet (üst yönetim, İK, bölge ve birim yöneticisi için aynı uç; kapsam sunucuda süzülür) */
  app.get('/api/t/:tid/roadmaps', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); const cycleId = (req.query as { cycleId?: string }).cycleId ?? null;
    if (cycleId && !UUID.test(cycleId)) throw new HttpError(400, 'invalid_cycle');
    return withContext(dbCtx(p), async tx => {
      const vis = await visibleUnits(tx, p);
      const cycles = (await tx.query("SELECT DISTINCT c.id, c.code, c.period_start FROM roadmap r JOIN survey_cycle c ON c.tenant_id = r.tenant_id AND c.id = r.cycle_id WHERE r.tenant_id = $1 AND r.status = 'active' ORDER BY c.period_start DESC", [p.tenantId])).rows as { id: string; code: string }[];
      const cid = cycleId ?? cycles[0]?.id ?? null; if (!cid) return { cycles: [], cycleId: null, units: [], companyPriorities: [], today: today() };
      const rows = (await tx.query(`SELECT r.id, r.unit_id, u.external_id AS unit_code, r.unit_label, r.sector_label, r.report_title, r.company_label, to_char(r.start_date, 'YYYY-MM-DD') AS start_date, r.content->'header' AS header,
          (SELECT COUNT(*) FROM roadmap_plan pl WHERE pl.tenant_id = r.tenant_id AND pl.roadmap_id = r.id)::int AS plans,
          (SELECT COUNT(*) FROM roadmap_step s WHERE s.tenant_id = r.tenant_id AND s.roadmap_id = r.id AND s.role_code = 'YONETIM')::int AS mgmt_total,
          (SELECT COUNT(*) FROM roadmap_step s WHERE s.tenant_id = r.tenant_id AND s.roadmap_id = r.id AND s.role_code = 'YONETIM' AND s.status = 'DONE')::int AS mgmt_done,
          (SELECT COUNT(*) FROM roadmap_step s WHERE s.tenant_id = r.tenant_id AND s.roadmap_id = r.id AND s.role_code = 'YONETIM' AND s.status = 'IN_PROGRESS')::int AS mgmt_progress,
          (SELECT COUNT(*) FROM roadmap_step s WHERE s.tenant_id = r.tenant_id AND s.roadmap_id = r.id AND s.role_code = 'IK')::int AS ik_total,
          (SELECT COUNT(*) FROM roadmap_step s WHERE s.tenant_id = r.tenant_id AND s.roadmap_id = r.id AND s.role_code = 'IK' AND s.status = 'DONE')::int AS ik_done,
          (SELECT COUNT(*) FROM roadmap_milestone m WHERE m.tenant_id = r.tenant_id AND m.roadmap_id = r.id)::int AS ms_total,
          (SELECT COUNT(*) FROM roadmap_milestone m WHERE m.tenant_id = r.tenant_id AND m.roadmap_id = r.id AND m.status = 'DONE')::int AS ms_done,
          (SELECT COUNT(*) FROM roadmap_milestone m WHERE m.tenant_id = r.tenant_id AND m.roadmap_id = r.id AND m.status = 'OPEN' AND m.due_date < CURRENT_DATE)::int AS ms_overdue,
          (SELECT to_char(MIN(m.due_date), 'YYYY-MM-DD') FROM roadmap_milestone m WHERE m.tenant_id = r.tenant_id AND m.roadmap_id = r.id AND m.status = 'OPEN' AND m.due_date >= CURRENT_DATE) AS next_due
        FROM roadmap r JOIN org_unit u ON u.tenant_id = r.tenant_id AND u.id = r.unit_id WHERE r.tenant_id = $1 AND r.cycle_id = $2 AND r.status = 'active' ORDER BY u.external_id`, [p.tenantId, cid])).rows;
      const units = rows.filter(r => vis === 'all' || vis.has(r.unit_id)).map(r => ({ roadmapId: r.id, unitId: r.unit_id, unitCode: r.unit_code, unitLabel: r.unit_label, sectorLabel: r.sector_label, participants: r.header?.participants ?? null, certScore: r.header?.cert_score ?? null, plans: r.plans, management: { total: r.mgmt_total, done: r.mgmt_done, inProgress: r.mgmt_progress }, hr: { total: r.ik_total, done: r.ik_done }, milestones: { total: r.ms_total, done: r.ms_done, overdue: r.ms_overdue, nextDue: d10(r.next_due) }, startDate: d10(r.start_date) }));
      // şirket genelindeki üç öncelik (sunumda her birimde aynı başlıklar): görünen ilk yol haritasından
      const first = rows.find(r => vis === 'all' || vis.has(r.unit_id));
      const pri = first ? ((await tx.query("SELECT content->'priorities' AS p FROM roadmap WHERE tenant_id = $1 AND id = $2", [p.tenantId, first.id])).rows[0]?.p ?? []) as { priority_no: number; title: string; short_title: string | null; rationale: string | null; area_label: string | null }[] : [];
      return { cycles, cycleId: cid, reportTitle: first?.report_title ?? null, companyLabel: first?.company_label ?? null, units, companyPriorities: pri.map(x => ({ no: x.priority_no, title: x.title, shortTitle: x.short_title, rationale: x.rationale, area: x.area_label })), today: today() };
    });
  });

  /** Tek birimin yol haritası: sunumdaki bütün bölümler + takip durumu + kullanıcının yazma hakları */
  app.get('/api/t/:tid/roadmaps/:rid', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); const { rid } = req.params as { rid: string }; if (!UUID.test(rid)) throw new HttpError(404, 'not_found');
    return withContext(dbCtx(p), async tx => {
      const r = (await tx.query("SELECT r.*, to_char(r.start_date, 'YYYY-MM-DD') AS start_ymd, u.external_id AS unit_code, c.code AS cycle_code FROM roadmap r JOIN org_unit u ON u.tenant_id = r.tenant_id AND u.id = r.unit_id JOIN survey_cycle c ON c.tenant_id = r.tenant_id AND c.id = r.cycle_id WHERE r.tenant_id = $1 AND r.id = $2", [p.tenantId, rid])).rows[0];
      if (!r || !(await canSee(tx, p, r.unit_id))) throw new HttpError(404, 'not_found', 'Yol haritası bulunamadı ya da kapsamınızda değil');
      const plans = (await tx.query('SELECT id, plan_no, theme_no, title, headline, mentions, commenters, data_note, indicators, measure FROM roadmap_plan WHERE tenant_id = $1 AND roadmap_id = $2 ORDER BY plan_no', [p.tenantId, rid])).rows;
      const steps = (await tx.query("SELECT id, plan_id, role_code, role_label, ord, text, status, note, version, to_char(status_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS status_at FROM roadmap_step WHERE tenant_id = $1 AND roadmap_id = $2 ORDER BY plan_id, CASE role_code WHEN 'IK' THEN 1 WHEN 'YONETIM' THEN 2 ELSE 3 END, ord", [p.tenantId, rid])).rows;
      const ms = (await tx.query("SELECT id, plan_id, ord, phase_label, due_days, to_char(due_date, 'YYYY-MM-DD') AS due_date, text, status, note, version, to_char(status_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS status_at FROM roadmap_milestone WHERE tenant_id = $1 AND roadmap_id = $2 ORDER BY plan_id, ord", [p.tenantId, rid])).rows;
      const rights = await writeRights(tx, p, r.unit_id);
      const outPlans = [] as unknown[];
      for (const pl of plans) {
        const m = pl.measure as { itemCode?: string | null };
        outPlans.push({ id: pl.id, no: pl.plan_no, themeNo: pl.theme_no, title: pl.title, headline: pl.headline, mentions: pl.mentions, commenters: pl.commenters, dataNote: pl.data_note, indicators: pl.indicators, measure: pl.measure, followup: await followup(tx, p.tenantId, r.cycle_id, r.unit_id, m?.itemCode ?? null),
          steps: steps.filter(s => s.plan_id === pl.id).map(s => ({ id: s.id, role: s.role_code, roleLabel: s.role_label, ord: s.ord, text: s.text, status: s.status, note: s.note, version: s.version, statusAt: s.status_at })),
          milestones: ms.filter(x => x.plan_id === pl.id).map(x => ({ id: x.id, ord: x.ord, phase: x.phase_label, dueDays: x.due_days, dueDate: x.due_date, text: x.text, status: x.status, note: x.note, version: x.version, statusAt: x.status_at, overdue: x.status === 'OPEN' && x.due_date < today() })) });
      }
      const siblings = (await tx.query("SELECT r.id, u.external_id AS code, r.unit_label, r.unit_id FROM roadmap r JOIN org_unit u ON u.tenant_id = r.tenant_id AND u.id = r.unit_id WHERE r.tenant_id = $1 AND r.cycle_id = $2 AND r.status = 'active' ORDER BY u.external_id", [p.tenantId, r.cycle_id])).rows;
      const vis = await visibleUnits(tx, p);
      return { id: r.id, status: r.status, cycleId: r.cycle_id, cycleCode: r.cycle_code, unitId: r.unit_id, unitCode: r.unit_code, unitLabel: r.unit_label, sectorLabel: r.sector_label, reportTitle: r.report_title, companyLabel: r.company_label, startDate: r.start_ymd, content: r.content, plans: outPlans, rights, today: today(),
        siblings: siblings.filter(s => vis === 'all' || vis.has(s.unit_id)).map(s => ({ roadmapId: s.id, unitCode: s.code, unitLabel: s.unit_label })) };
    });
  });

  /** İK'nın işleri: görünür birimlerdeki bütün İK adımları (tek listede takip) */
  app.get('/api/t/:tid/roadmap-hr-steps', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); const cycleId = (req.query as { cycleId?: string }).cycleId ?? null; if (cycleId && !UUID.test(cycleId)) throw new HttpError(400, 'invalid_cycle');
    return withContext(dbCtx(p), async tx => {
      const vis = await visibleUnits(tx, p);
      const rows = (await tx.query(`SELECT s.id, s.unit_id, u.external_id AS unit_code, r.unit_label, r.id AS roadmap_id, pl.plan_no, pl.title AS plan_title, s.ord, s.text, s.status, s.note, s.version FROM roadmap_step s JOIN roadmap r ON r.tenant_id = s.tenant_id AND r.id = s.roadmap_id AND r.status = 'active' JOIN roadmap_plan pl ON pl.tenant_id = s.tenant_id AND pl.id = s.plan_id JOIN org_unit u ON u.tenant_id = s.tenant_id AND u.id = s.unit_id
        WHERE s.tenant_id = $1 AND s.role_code = 'IK' AND ($2::uuid IS NULL OR r.cycle_id = $2) ORDER BY u.external_id, pl.plan_no, s.ord`, [p.tenantId, cycleId])).rows.filter(x => vis === 'all' || vis.has(x.unit_id));
      const units = [...new Set(rows.map(r => r.unit_id))]; const can: Record<string, boolean> = {}; for (const u of units) can[u] = (await writeRights(tx, p, u)).IK;
      return rows.map(r => ({ id: r.id, unitCode: r.unit_code, unitLabel: r.unit_label, roadmapId: r.roadmap_id, planNo: r.plan_no, planTitle: r.plan_title, ord: r.ord, text: r.text, status: r.status, note: r.note, version: r.version, canUpdate: can[r.unit_id] ?? false }));
    });
  });

  app.post('/api/t/:tid/roadmap-steps/:sid/status', { schema: { body: { type: 'object', required: ['status', 'expectedVersion'], properties: { status: { type: 'string', enum: ['NOT_STARTED', 'IN_PROGRESS', 'DONE'] }, note: { type: 'string', maxLength: 1000 }, expectedVersion: { type: 'integer', minimum: 1 } }, additionalProperties: false } } }, async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); const { sid } = req.params as { sid: string }; if (!UUID.test(sid)) throw new HttpError(404, 'not_found');
    const b = req.body as { status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'; note?: string; expectedVersion: number };
    return withContext(dbCtx(p), async tx => {
      const s = (await tx.query("SELECT s.*, r.status AS roadmap_status FROM roadmap_step s JOIN roadmap r ON r.tenant_id = s.tenant_id AND r.id = s.roadmap_id WHERE s.tenant_id = $1 AND s.id = $2 FOR UPDATE OF s", [p.tenantId, sid])).rows[0];
      if (!s || !(await canSee(tx, p, s.unit_id))) throw new HttpError(404, 'not_found');
      if (s.roadmap_status !== 'active') throw new HttpError(409, 'roadmap_superseded', 'Bu yol haritasının yeni bir sürümü yüklendi; sayfayı yenileyin');
      if (s.role_code === 'CALISAN') throw new HttpError(422, 'employee_step_not_tracked', 'Çalışan adımları HPW Act\'te takip edilmez; yalnız gösterilir');
      await requireUnitProfile(tx, p, s.unit_id, ...(s.role_code === 'IK' ? ROADMAP_WRITE.IK : ROADMAP_WRITE.YONETIM));
      req.idempotencyResource = { scope: 'unit', unitId: s.unit_id, profiles: [...(s.role_code === 'IK' ? ROADMAP_WRITE.IK : ROADMAP_WRITE.YONETIM)] };
      if (s.version !== b.expectedVersion) throw new HttpError(409, 'version_conflict', 'Bu adım siz bakarken güncellendi; sayfayı yenileyip yeniden deneyin', { current: { status: s.status, note: s.note, version: s.version } });
      const note = b.note?.trim() || null;
      const u = (await tx.query("UPDATE roadmap_step SET status = $3, note = $4, updated_by = $5, status_at = now(), updated_at = now(), version = version + 1 WHERE tenant_id = $1 AND id = $2 RETURNING status, note, version, to_char(status_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS status_at", [p.tenantId, sid, b.status, note, p.userId])).rows[0];
      await audit(tx, p, 'roadmap_step', sid, 'status', { status: s.status }, { status: b.status }, note ?? undefined);
      return { id: sid, status: u.status, note: u.note, version: u.version, statusAt: u.status_at };
    });
  });

  app.post('/api/t/:tid/roadmap-milestones/:mid/status', { schema: { body: { type: 'object', required: ['status', 'expectedVersion'], properties: { status: { type: 'string', enum: ['OPEN', 'DONE'] }, note: { type: 'string', maxLength: 1000 }, expectedVersion: { type: 'integer', minimum: 1 } }, additionalProperties: false } } }, async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); const { mid } = req.params as { mid: string }; if (!UUID.test(mid)) throw new HttpError(404, 'not_found');
    const b = req.body as { status: 'OPEN' | 'DONE'; note?: string; expectedVersion: number };
    return withContext(dbCtx(p), async tx => {
      const m = (await tx.query("SELECT m.*, r.status AS roadmap_status FROM roadmap_milestone m JOIN roadmap r ON r.tenant_id = m.tenant_id AND r.id = m.roadmap_id WHERE m.tenant_id = $1 AND m.id = $2 FOR UPDATE OF m", [p.tenantId, mid])).rows[0];
      if (!m || !(await canSee(tx, p, m.unit_id))) throw new HttpError(404, 'not_found');
      if (m.roadmap_status !== 'active') throw new HttpError(409, 'roadmap_superseded', 'Bu yol haritasının yeni bir sürümü yüklendi; sayfayı yenileyin');
      await requireUnitProfile(tx, p, m.unit_id, ...ROADMAP_WRITE.milestone); req.idempotencyResource = { scope: 'unit', unitId: m.unit_id, profiles: [...ROADMAP_WRITE.milestone] };
      if (m.version !== b.expectedVersion) throw new HttpError(409, 'version_conflict', 'Bu takvim satırı siz bakarken güncellendi; sayfayı yenileyip yeniden deneyin', { current: { status: m.status, version: m.version } });
      const note = b.note?.trim() || null;
      const u = (await tx.query("UPDATE roadmap_milestone SET status = $3, note = $4, updated_by = $5, status_at = now(), updated_at = now(), version = version + 1 WHERE tenant_id = $1 AND id = $2 RETURNING status, note, version, to_char(status_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS status_at", [p.tenantId, mid, b.status, note, p.userId])).rows[0];
      await audit(tx, p, 'roadmap_milestone', mid, 'status', { status: m.status }, { status: b.status }, note ?? undefined);
      return { id: mid, status: u.status, note: u.note, version: u.version, statusAt: u.status_at };
    });
  });
}
