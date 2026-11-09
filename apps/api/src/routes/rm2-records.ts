import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createReadStream } from 'node:fs';
import { withContext, HttpError, type Tx } from '../db.js';
import { requireTenantAsync as requireTenant, profileForUnit, dbCtx, audit, type Principal, type Profile } from '../auth.js';
import { visibleUnits } from './analysis.js';
import { config } from '../config.js';
import { storeFile, removeStored, filePath, storedSize, contentDisposition, INLINE_IMAGE, type StoredFile } from '../filestore.js';

/** v3.1.0 (R-05…R-09) — adım kayıtları: not, gelişme, engel, engelin kaldırılması, dosya.
 * - Kayıt eklemek adımın Yapıldı/Yapılmadı durumunu ve rapordaki termini DEĞİŞTİRMEZ. Kayıtlar yalnız eklenir; önceki kayıtlar korunur.
 * - Kayıt ekleme yetkisi adımı işaretleme yetkisiyle aynıdır (rm2.ts RM2_WRITE, şirket/işletme kapsamı API'de).
 * - Engeli kaldırma ayrı kuraldır (RM2_UNBLOCK): o işletmeyi kapsayan işletme müdürü, bölge müdürü, İK ya da üst yönetim. Çözüm notu zorunludur.
 * - Dosya indirme: adımı görme yetkisi (visibleUnits) — başka şirket RLS ile, kapsam dışı işletme 404 ile reddedilir. */
export const RM2_UNBLOCK: readonly Profile[] = ['UNIT_MANAGER', 'REGION_MANAGER', 'HR_ADMIN', 'HR_PARTNER', 'EXEC'];
const RECORD_KINDS = ['NOTE', 'PROGRESS', 'BLOCKER'] as const;
const UUID = /^[0-9a-f-]{36}$/i;
type P = Principal & { tenantId: string };

export interface RecordFileDto { id: string; name: string; mime: string; size: number; image: boolean }
export interface RecordDto { id: string; kind: string; text: string | null; by: string | null; at: string; blockerId: string | null; files: RecordFileDto[] }
export interface StepRecords { records: RecordDto[]; blockers: { id: string; text: string; by: string | null; at: string }[]; lastProgress: { text: string; by: string | null; at: string } | null }
const ISO = `'YYYY-MM-DD"T"HH24:MI:SS"Z"'`;

/** Adımların kayıt geçmişi (yeniden eskiye), açık engelleri ve son gelişmesi */
export async function loadRecords(tx: Tx, tenantId: string, stepIds: string[]): Promise<Map<string, StepRecords>> {
  const out = new Map<string, StepRecords>(); if (!stepIds.length) return out;
  /* yeniden yüklemede taşınan adımların önceki satırları (carried_from zinciri) da okunur: kayıtlar kopyalanmaz, kaybolmaz */
  const chain = (await tx.query(`WITH RECURSIVE c AS (SELECT id AS root, id, carried_from FROM rm2_step WHERE tenant_id = $1 AND id = ANY($2::uuid[])
    UNION ALL SELECT c.root, s.id, s.carried_from FROM rm2_step s JOIN c ON s.tenant_id = $1 AND s.id = c.carried_from) SELECT root, id FROM c`, [tenantId, stepIds])).rows as { root: string; id: string }[];
  const rootOf = new Map(chain.map(x => [x.id, x.root])); const all = [...rootOf.keys()];
  const recs = (await tx.query(`SELECT r.id, r.step_id, r.kind, r.body, r.blocker_id, to_char(r.created_at AT TIME ZONE 'UTC', ${ISO}) AS at, u.display_name AS by_name
    FROM rm2_step_record r LEFT JOIN app_user u ON u.id = r.created_by WHERE r.tenant_id = $1 AND r.step_id = ANY($2::uuid[]) ORDER BY r.created_at, r.id`, [tenantId, all])).rows.map(r => ({ ...r, step_id: rootOf.get(r.step_id) ?? r.step_id }));
  const files = (await tx.query('SELECT id, record_id, file_name, mime, size_bytes FROM rm2_step_file WHERE tenant_id = $1 AND step_id = ANY($2::uuid[]) ORDER BY created_at, id', [tenantId, all])).rows;
  const byRec = new Map<string, RecordFileDto[]>();
  for (const f of files) byRec.set(f.record_id, [...(byRec.get(f.record_id) ?? []), { id: f.id, name: f.file_name, mime: f.mime, size: Number(f.size_bytes), image: INLINE_IMAGE.has(f.mime) }]);
  for (const id of stepIds) out.set(id, { records: [], blockers: [], lastProgress: null });
  const resolved = new Set(recs.filter(r => r.kind === 'UNBLOCK').map(r => r.blocker_id as string));
  for (const r of recs) {
    const s = out.get(r.step_id)!; const dto: RecordDto = { id: r.id, kind: r.kind, text: r.body ?? null, by: r.by_name ?? null, at: r.at, blockerId: r.blocker_id ?? null, files: byRec.get(r.id) ?? [] };
    s.records.unshift(dto);
    if (r.kind === 'BLOCKER' && !resolved.has(r.id)) s.blockers.push({ id: r.id, text: r.body, by: r.by_name ?? null, at: r.at });
    if (r.kind === 'PROGRESS' && r.body) s.lastProgress = { text: r.body, by: r.by_name ?? null, at: r.at };
  }
  return out;
}
/** Bu işletmede engel kaldırabilir mi (HPW personeli ve izleyici hayır) */
export async function canUnblockUnit(tx: Tx, p: P, unitId: string, cache: Map<string, Profile | null>): Promise<boolean> {
  if (p.realm === 'platform') return false;
  if (!cache.has(unitId)) cache.set(unitId, await profileForUnit(tx, p, unitId));
  const prof = cache.get(unitId); return !!prof && RM2_UNBLOCK.includes(prof);
}

async function lockStep(tx: Tx, p: P, sid: string) {
  const s = (await tx.query('SELECT s.*, r.status AS roadmap_status, r.layer FROM rm2_step s JOIN rm2_roadmap r ON r.tenant_id = s.tenant_id AND r.id = s.roadmap_id WHERE s.tenant_id = $1 AND s.id = $2 FOR UPDATE OF s', [p.tenantId, sid])).rows[0];
  const vis = await visibleUnits(tx, p);
  if (!s || !(vis === 'all' || vis.has(s.unit_id))) throw new HttpError(404, 'not_found', 'Adım bulunamadı ya da kapsamınızda değil');
  if (s.roadmap_status !== 'active') throw new HttpError(409, 'roadmap_superseded', 'Bu yol haritasının yeni bir sürümü yüklendi; sayfayı yenileyin');
  if (s.role_code === 'CALISAN') throw new HttpError(422, 'employee_step_not_tracked', 'Çalışan adımları bilgi içindir; kayıt eklenmez');
  if (s.ref_step_id) throw new HttpError(422, 'reference_step', 'Bu satır kurum planındaki bir adıma bağlı; kayıtlar kurum adımında tutulur');
  return s as { id: string; unit_id: string; roadmap_id: string; role_code: string; layer: string; status: string };
}

/** Çok parçalı gövde: alanlar (kind, text) ve en fazla config.recordFileMaxCount dosya. Sınır aşımı 413, içerik denetimi storeFile içinde. */
async function readRecordForm(req: FastifyRequest) {
  if (!req.isMultipart()) throw new HttpError(415, 'multipart_required', 'Kayıt çok parçalı form olarak gönderilir');
  const fields: Record<string, string> = {}; const files: { name: string; buf: Buffer }[] = [];
  try {
    for await (const part of req.parts({ limits: { files: config.recordFileMaxCount, fileSize: config.recordFileMaxBytes, fields: 4, fieldSize: 8000, parts: config.recordFileMaxCount + 4 } })) {
      if (part.type === 'file') { const buf = await part.toBuffer(); if (part.file.truncated) throw new HttpError(413, 'file_too_large', `Dosya en fazla ${Math.round(config.recordFileMaxBytes / 1048576)} MB olabilir: ${part.filename}`); if (buf.length) files.push({ name: part.filename, buf }); }
      else fields[part.fieldname] = String(part.value ?? '');
    }
  } catch (e) {
    if (e instanceof HttpError) throw e; const code = (e as { code?: string }).code ?? '';
    if (code === 'FST_FILES_LIMIT') throw new HttpError(413, 'too_many_files', `Bir kayda en fazla ${config.recordFileMaxCount} dosya eklenir`);
    if (code === 'FST_REQ_FILE_TOO_LARGE') throw new HttpError(413, 'file_too_large', `Dosya en fazla ${Math.round(config.recordFileMaxBytes / 1048576)} MB olabilir`);
    if (code.startsWith('FST_')) throw new HttpError(400, 'bad_multipart', 'Form okunamadı');
    throw e;
  }
  return { fields, files };
}

export async function rm2RecordRoutes(app: FastifyInstance, deps: { canRecord: (tx: Tx, p: P, step: { unit_id: string; role_code: string; layer: string }) => Promise<boolean>; writeProfiles: (role: string, layer: string) => readonly string[] }) {
  /** R-05/R-06/R-07/R-09: not, gelişme ya da engel kaydı (isteğe bağlı dosyalarla). Adımın durumunu değiştirmez. */
  app.post('/api/t/:tid/rm2-steps/:sid/records', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); const { sid } = req.params as { sid: string }; if (!UUID.test(sid)) throw new HttpError(404, 'not_found');
    const { fields, files } = await readRecordForm(req);
    const kind = String(fields.kind ?? ''); const text = String(fields.text ?? '').trim();
    if (!(RECORD_KINDS as readonly string[]).includes(kind)) throw new HttpError(422, 'invalid_kind', 'Kayıt türü not, gelişme ya da engel olmalı');
    if (text.length > 2000) throw new HttpError(422, 'text_too_long', 'Kayıt en fazla 2000 karakter olabilir');
    if (kind === 'BLOCKER' && !text) throw new HttpError(422, 'blocker_text_required', 'Engeli bildirmek için adımı neyin durdurduğunu yazın');
    if (!text && !files.length) throw new HttpError(422, 'empty_record', 'Kaydetmek için bir şey yazın ya da dosya ekleyin');
    const stored: StoredFile[] = [];
    try {
      return await withContext(dbCtx(p), async tx => {
        const s = await lockStep(tx, p, sid);
        if (!(await deps.canRecord(tx, p, s))) throw new HttpError(403, 'not_allowed', 'Bu adıma kayıt ekleme yetkiniz yok');
        req.idempotencyResource = { scope: 'unit', unitId: s.unit_id, profiles: [...deps.writeProfiles(s.role_code, s.layer)] as Profile[] };
        for (const f of files) stored.push(storeFile(p.tenantId, f.buf, f.name));
        const finalKind = text ? kind : 'FILE'; // yalnız dosya: metinsiz not/gelişme "Dosya" kaydı olur
        const r = (await tx.query(`INSERT INTO rm2_step_record (tenant_id, step_id, roadmap_id, unit_id, kind, body, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, to_char(created_at AT TIME ZONE 'UTC', ${ISO}) AS at`, [p.tenantId, sid, s.roadmap_id, s.unit_id, finalKind, text || null, p.userId])).rows[0];
        const fileDtos: RecordFileDto[] = [];
        for (const f of stored) {
          const fr = (await tx.query('INSERT INTO rm2_step_file (tenant_id, record_id, step_id, unit_id, file_name, mime, size_bytes, sha256, storage_key, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id', [p.tenantId, r.id, sid, s.unit_id, f.fileName, f.mime, f.size, f.sha256, f.storageKey, p.userId])).rows[0];
          fileDtos.push({ id: fr.id, name: f.fileName, mime: f.mime, size: f.size, image: INLINE_IMAGE.has(f.mime) });
        }
        await audit(tx, p, 'rm2_step', sid, `record_${finalKind.toLocaleLowerCase('en-US')}`, null, { recordId: r.id, files: stored.length });
        const rec: RecordDto = { id: r.id, kind: finalKind, text: text || null, by: p.displayName, at: r.at, blockerId: null, files: fileDtos };
        return { stepId: sid, record: rec, status: s.status };
      });
    } catch (e) { removeStored(p.tenantId, stored.map(f => f.storageKey)); throw e; }
  });

  /** R-07: engeli kaldır — çözüm notu zorunlu (yalnız boşluk da boş sayılır). Adımı tamamlamaz; termin değişmez. */
  app.post('/api/t/:tid/rm2-steps/:sid/blockers/:bid/resolve', { schema: { body: { type: 'object', required: ['resolution'], properties: { resolution: { type: 'string', maxLength: 2000 } }, additionalProperties: false } } }, async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); const { sid, bid } = req.params as { sid: string; bid: string }; if (!UUID.test(sid) || !UUID.test(bid)) throw new HttpError(404, 'not_found');
    const resolution = String((req.body as { resolution: string }).resolution ?? '').trim();
    return withContext(dbCtx(p), async tx => {
      const s = await lockStep(tx, p, sid);
      if (!(await canUnblockUnit(tx, p, s.unit_id, new Map()))) throw new HttpError(403, 'not_allowed', 'Bu engeli kaldırma yetkiniz yok');
      req.idempotencyResource = { scope: 'unit', unitId: s.unit_id, profiles: [...RM2_UNBLOCK] };
      const b = (await tx.query(`WITH RECURSIVE c AS (SELECT id, carried_from FROM rm2_step WHERE tenant_id = $1 AND id = $3 UNION ALL SELECT s.id, s.carried_from FROM rm2_step s JOIN c ON s.tenant_id = $1 AND s.id = c.carried_from)
        SELECT r.id FROM rm2_step_record r WHERE r.tenant_id = $1 AND r.id = $2 AND r.kind = 'BLOCKER' AND r.step_id IN (SELECT id FROM c)`, [p.tenantId, bid, sid])).rows[0];
      if (!b) throw new HttpError(404, 'not_found', 'Engel bulunamadı');
      if ((await tx.query("SELECT 1 FROM rm2_step_record WHERE tenant_id = $1 AND blocker_id = $2 AND kind = 'UNBLOCK'", [p.tenantId, bid])).rowCount) throw new HttpError(409, 'blocker_already_resolved', 'Bu engel daha önce kaldırıldı; sayfayı yenileyin');
      if (!resolution) throw new HttpError(422, 'resolution_required', 'Engeli kaldırmak için önce geliştirilen çözümü yazın.');
      let r;
      try { r = (await tx.query(`INSERT INTO rm2_step_record (tenant_id, step_id, roadmap_id, unit_id, kind, body, blocker_id, created_by) VALUES ($1,$2,$3,$4,'UNBLOCK',$5,$6,$7) RETURNING id, to_char(created_at AT TIME ZONE 'UTC', ${ISO}) AS at`, [p.tenantId, sid, s.roadmap_id, s.unit_id, resolution, bid, p.userId])).rows[0]; }
      catch (e) { if ((e as { code?: string }).code === '23505') throw new HttpError(409, 'blocker_already_resolved', 'Bu engel daha önce kaldırıldı; sayfayı yenileyin'); throw e; }
      await audit(tx, p, 'rm2_step', sid, 'record_unblock', null, { recordId: r.id, blockerId: bid });
      return { stepId: sid, record: { id: r.id, kind: 'UNBLOCK', text: resolution, by: p.displayName, at: r.at, blockerId: bid, files: [] } as RecordDto, status: s.status };
    });
  });

  /** R-07: İK ekranı — yetkili olduğu işletmelerden gelen açık engeller (İK'nın kendi adımlarından ayrı liste) */
  app.get('/api/t/:tid/rm2/blockers', async req => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid);
    const hr = p.realm === 'customer' && ((p.companyWide && p.profile === 'HR_ADMIN') || (p.grants ?? []).some(g => g.profile === 'HR_ADMIN' || g.profile === 'HR_PARTNER'));
    if (!hr) return { enabled: false, items: [] };
    return withContext(dbCtx(p), async tx => {
      const vis = await visibleUnits(tx, p); const cache = new Map<string, Profile | null>();
      /* engel, bildirildiği adımın yeniden yüklemede taşındığı güncel satırına (carried_from zinciri ileri) bağlanır */
      const rows = (await tx.query(`WITH RECURSIVE ob AS (SELECT b.id AS bid, b.step_id AS sid FROM rm2_step_record b WHERE b.tenant_id = $1 AND b.kind = 'BLOCKER'
          AND NOT EXISTS (SELECT 1 FROM rm2_step_record x WHERE x.tenant_id = b.tenant_id AND x.blocker_id = b.id AND x.kind = 'UNBLOCK')
        UNION ALL SELECT ob.bid, s.id FROM rm2_step s JOIN ob ON s.tenant_id = $1 AND s.carried_from = ob.sid)
        SELECT b.id, s.id AS step_id, b.body, to_char(b.created_at AT TIME ZONE 'UTC', ${ISO}) AS at, u.display_name AS by_name, s.unit_id, s.roadmap_id, s.text AS step_text, s.role_label, pl.plan_no, r.unit_label, r.layer
        FROM ob JOIN rm2_step_record b ON b.tenant_id = $1 AND b.id = ob.bid JOIN rm2_step s ON s.tenant_id = $1 AND s.id = ob.sid JOIN rm2_plan pl ON pl.tenant_id = s.tenant_id AND pl.id = s.plan_id
        JOIN rm2_roadmap r ON r.tenant_id = s.tenant_id AND r.id = s.roadmap_id AND r.status = 'active' LEFT JOIN app_user u ON u.id = b.created_by
        ORDER BY b.created_at`, [p.tenantId])).rows;
      const items = [] as unknown[];
      for (const b of rows) {
        if (vis !== 'all' && !vis.has(b.unit_id)) continue;
        if (!cache.has(b.unit_id)) cache.set(b.unit_id, await profileForUnit(tx, p, b.unit_id));
        const prof = cache.get(b.unit_id); if (prof !== 'HR_ADMIN' && prof !== 'HR_PARTNER') continue;
        items.push({ id: b.id, stepId: b.step_id, roadmapId: b.roadmap_id, planNo: b.plan_no, unitLabel: b.unit_label, layer: b.layer, roleLabel: b.role_label, stepText: b.step_text, text: b.body, by: b.by_name ?? null, at: b.at });
      }
      return { enabled: true, items };
    });
  });

  /** R-09: dosya indirme / görüntü önizleme — adımı görme yetkisiyle. İçerik her zaman indirme olarak ya da yalnız güvenli görüntü türünde satır içi verilir; çalıştırılmaz. */
  app.get('/api/t/:tid/rm2-files/:fid', async (req, reply) => {
    const p = await requireTenant(req, (req.params as { tid: string }).tid); const { fid } = req.params as { fid: string }; if (!UUID.test(fid)) throw new HttpError(404, 'not_found');
    const inline = (req.query as { inline?: string }).inline === '1';
    const f = await withContext(dbCtx(p), async tx => {
      const row = (await tx.query('SELECT id, unit_id, file_name, mime, size_bytes, storage_key FROM rm2_step_file WHERE tenant_id = $1 AND id = $2', [p.tenantId, fid])).rows[0];
      const vis = await visibleUnits(tx, p);
      if (!row || !(vis === 'all' || vis.has(row.unit_id))) throw new HttpError(404, 'not_found', 'Dosya bulunamadı ya da kapsamınızda değil');
      return row as { file_name: string; mime: string; size_bytes: number; storage_key: string };
    });
    const size = storedSize(p.tenantId, f.storage_key); if (size === null) throw new HttpError(410, 'file_missing', 'Dosya sunucuda bulunamadı');
    const asImage = inline && INLINE_IMAGE.has(f.mime);
    reply.header('Content-Type', asImage ? f.mime : 'application/octet-stream').header('Content-Length', String(size))
      .header('Content-Disposition', contentDisposition(asImage ? 'inline' : 'attachment', f.file_name))
      .header('X-Content-Type-Options', 'nosniff').header('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox").header('Cache-Control', 'private, no-store');
    return reply.send(createReadStream(filePath(p.tenantId, f.storage_key)));
  });
}
