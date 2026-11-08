import pg from 'pg';
import { config } from './config.js';
/** Her istek bir transaction'da, uygulama rolüyle (hpw_api ∈ hpw_app, NOBYPASSRLS) ve satır güvenliği bağlamıyla çalışır:
    app.realm (customer | platform | worker), app.user_id, app.tenant_id. Bağlam olmadan hiçbir tenant satırı görünmez. */
/** v2.9.1 (V290-06): müdahale modundaki isteğin izi; aynı transaction'da merkezi kayda dönüşür */
export interface InterventionTrace { id: string; requestKey: string; route: string; seq: number }
export interface DbContext { realm: 'customer' | 'platform' | 'platform_admin' | 'worker' | 'anon'; userId?: string | null; tenantId?: string | null; commandKey?: string | null; platformWrite?: boolean; intervention?: InterventionTrace | null; allowInactive?: boolean; }
export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
pool.on('error', e => { console.error('[pg-pool] boşta bağlantı hatası (DB yeniden başlatıldı?):', (e as Error).message); }); // A99-19: DB kesintisinde süreç düşmez; /api/ready 503 döner, DB dönünce kendiliğinden toparlar
export type Tx = pg.PoolClient;
const RETRY = new Set(['57P01', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE']);
export async function withContext<T>(ctx: DbContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  // DB yeniden başladıktan sonra havuzdaki ölü bağlantı ilk kullanımda hata verir; işlem BAŞLAMADAN önce (BEGIN aşamasında) bir kez taze bağlantıyla yeniden denenir (A99-19)
  let client = await pool.connect();
  try { await client.query('BEGIN'); } catch (e) { const code = (e as { code?: string }).code ?? ''; client.release(true); if (!RETRY.has(code) && !/terminat|ECONNRESET|Connection terminated/i.test(String((e as Error).message))) throw e; client = await pool.connect(); await client.query('BEGIN'); }
  try {
    await client.query(`SELECT set_config('app.realm', $1, true), set_config('app.user_id', $2, true), set_config('app.tenant_id', $3, true), set_config('app.platform_write', $4, true)`, [ctx.realm, ctx.userId ?? '', ctx.tenantId ?? '', ctx.platformWrite ? 'on' : 'off']); // v2.9.0: platform yazması yalnız yetenek denetimi olumluyken
    // v2.10.0 (durdurma/arşiv sırasında devam eden yazmalar): müşteri ve HPW yazma transaction'ı şirket satırında paylaşımlı kilit alır; etkin olmayan şirkette yazma başlamaz
    if (ctx.tenantId && (ctx.realm === 'customer' || (ctx.realm === 'platform' && ctx.platformWrite))) { const st = (await client.query('SELECT tenant_status_lock($1) AS s', [ctx.tenantId])).rows[0]?.s as string | null; if (st && st !== 'active' && !ctx.allowInactive) throw new HttpError(403, ctx.realm === 'customer' ? 'tenant_suspended' : 'platform_capability', ctx.realm === 'customer' ? 'Bu şirketin hizmeti Happy Place to Work tarafından geçici olarak durduruldu. Şirketinizin İK yöneticisine ya da HPW’ye başvurun.' : 'Şirket durdurulmuş ya da arşivlenmiş; HPW yalnız okuyabilir'); }
    // V290-06: müdahale modunda veri değiştiren her transaction, merkezi müdahale kaydını İŞ ETKİSİYLE AYNI transaction'da yazar.
    // Kayıt yazılamazsa transaction geri alınır (iş etkisi de kalıcılaşmaz). Aynı komutun yeniden denemesi aynı istek anahtarıyla çift kayıt üretmez.
    let wrote = false; const audits: string[] = [];
    const tracked = ctx.intervention ? new Proxy(client, { get(t, k, r) { if (k === 'query') return (q: unknown, ...rest: unknown[]) => { const sql = typeof q === 'string' ? q : (q as { text?: string })?.text ?? ''; if (/^\s*(INSERT|UPDATE|DELETE|WITH)\b/i.test(sql) && !/^\s*INSERT INTO (command_journal|platform_audit_event)\b/i.test(sql)) wrote = true; if (/^\s*INSERT INTO audit_event\b/i.test(sql)) { const a = rest[0] as unknown[] | undefined; audits.push(`${String(a?.[1] ?? '')}:${String(a?.[3] ?? '')}`); } return (t.query as (...x: unknown[]) => unknown).call(t, q, ...rest); }; const v = Reflect.get(t, k, r); return typeof v === 'function' ? v.bind(t) : v; } }) as Tx : client;
    const out = await fn(tracked);
    if (ctx.intervention && (wrote || audits.length)) { const iv = ctx.intervention; iv.seq += 1; await client.query("INSERT INTO platform_audit_event (actor_id, action, tenant_id, target_type, target_id, after, result, request_id, intervention_id) SELECT $1,'intervention.write',$2,'route',$3,$4::jsonb,'ok',$5,$6 WHERE NOT EXISTS (SELECT 1 FROM platform_audit_event WHERE intervention_id = $6 AND target_id = $3 AND request_id = $5 AND action = 'intervention.write')", [ctx.userId, ctx.tenantId ?? null, iv.route, JSON.stringify({ audits }), `${iv.requestKey}#${iv.seq}`, iv.id]); } // tabloda UPDATE/DELETE kuralı olduğundan ON CONFLICT kullanılamaz; tekillik ayrıca benzersiz indeksle korunur
    if (ctx.commandKey && ctx.tenantId) await client.query('INSERT INTO command_journal (tenant_id, command_key, actor_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [ctx.tenantId, ctx.commandKey, ctx.userId ?? null]); // F99-02: iş etkisiyle AYNI transaction'da komut günlüğü; commit sonrası makbuz kaybında devralan istek işi yeniden yapmaz
    await client.query('COMMIT');
    return out;
  } catch (e) { try { await client.query('ROLLBACK'); } catch { /* noop */ } throw e; } finally { client.release(); }
}
export class HttpError extends Error { status: number; code: string; details?: unknown; constructor(status: number, code: string, message?: string, details?: unknown) { super(message ?? code); this.status = status; this.code = code; this.details = details; } }
export const one = <T = Record<string, unknown>>(r: pg.QueryResult): T => { if (r.rowCount !== 1) throw new HttpError(404, 'not_found'); return r.rows[0] as T; };
