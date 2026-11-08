/** N04: gerçek HTTP başarı yanıtı örneklerinden (API testleri, HPW_CONTRACT_CAPTURE) uca özgü yanıt şemaları çıkarır.
 * required = bütün örneklerde bulunan alanlar; null görülen alan nullable (gizlilik: sayılar null, 0 değil); kimlik/tarih biçimleri; enum = veritabanı CHECK kısıtları.
 * Çıktı src/contract/responses.json — sözleşmenin (openapi-urun.json) yanıt kaynağıdır. Kullanım: node --import tsx scripts/contract-infer.mts var/contract-samples.jsonl */
import { readFileSync, writeFileSync } from 'node:fs'; import pg from 'pg';
import { DOMAIN_MAP } from '../src/contract/domain-map.ts';
type J = Record<string, unknown>;
const lines = readFileSync(process.argv[2] ?? 'var/contract-samples.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as { m: string; u: string; b: unknown });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, D = /^\d{4}-\d{2}-\d{2}$/;
function infer(v: unknown): J { if (v === null) return { type: ['null'] }; if (Array.isArray(v)) return { type: ['array'], items: v.length ? v.map(infer).reduce(merge) : {} };
  if (typeof v === 'object') { const o = v as J; return { type: ['object'], properties: Object.fromEntries(Object.entries(o).map(([k, x]) => [k, infer(x)])), required: Object.keys(o).sort() }; }
  if (typeof v === 'string') return { type: ['string'], ...(UUID.test(v) ? { format: 'uuid' } : DT.test(v) ? { format: 'date-time' } : D.test(v) ? { format: 'date' } : {}), 'x-seen': [v] };
  if (typeof v === 'number') return { type: [Number.isInteger(v) ? 'integer' : 'number'] }; return { type: [typeof v] }; }
function merge(a: J, b: J): J { if (!a || !Object.keys(a).length) return b; if (!b || !Object.keys(b).length) return a;
  let t = [...new Set([...(a.type as string[] ?? []), ...(b.type as string[] ?? [])])]; if (t.includes('integer') && t.includes('number')) t = t.filter(x => x !== 'integer');
  const r: J = { type: t };
  if (t.includes('object')) { const pa = (a.properties ?? {}) as J, pb = (b.properties ?? {}) as J; r.properties = Object.fromEntries([...new Set([...Object.keys(pa), ...Object.keys(pb)])].map(k => [k, merge(pa[k] as J, pb[k] as J)])); const ra = a.required as string[] | undefined, rb = b.required as string[] | undefined; r.required = ra && rb ? ra.filter(x => rb.includes(x)) : (ra ?? rb ?? []); }
  if (t.includes('array')) r.items = merge(a.items as J, b.items as J);
  if (a.format && a.format === b.format) r.format = a.format; else if (a.format && !b.format && !(b.type as string[]).includes('string')) r.format = a.format; else if (b.format && !a.format && !(a.type as string[]).includes('string')) r.format = b.format;
  const seen = [...new Set([...(a['x-seen'] as string[] ?? []), ...(b['x-seen'] as string[] ?? [])])]; if (seen.length) r['x-seen'] = seen.slice(0, 40); return r; }
const client = new pg.Client({ connectionString: process.env.MIGRATE_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/hpw_act_test' }); await client.connect();
/** N04/R04: örneklerde yalnız null (ya da hiç örnek) görülen alanlar tahmin edilmez; gerçek veritabanı sütun türünden (information_schema) doldurulur.
 * Aynı adı taşıyan sütunlar farklı türdeyse (belirsiz) alan işaretlenip elle incelenmek üzere bırakılır; sessizce bir türe zorlanmaz. */
const colRows = (await client.query(`SELECT column_name, data_type, udt_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public'`)).rows as { column_name: string; data_type: string; udt_name: string; is_nullable: string }[];
const PG_ELEM: Record<string, { type: string; format?: string }> = { _text: { type: 'string' }, _varchar: { type: 'string' }, _uuid: { type: 'string', format: 'uuid' }, _int4: { type: 'integer' }, _int8: { type: 'integer' }, _numeric: { type: 'string' }, _bool: { type: 'boolean' } };
const PG_JSON: Record<string, { type: string; format?: string }> = { 'character varying': { type: 'string' }, text: { type: 'string' }, uuid: { type: 'string', format: 'uuid' }, date: { type: 'string', format: 'date' }, 'timestamp with time zone': { type: 'string', format: 'date-time' }, 'timestamp without time zone': { type: 'string', format: 'date-time' }, boolean: { type: 'boolean' }, integer: { type: 'integer' }, bigint: { type: 'integer' }, smallint: { type: 'integer' }, numeric: { type: 'string' } /* API'de metin döner (bkz. TESLİMAT notu) */, jsonb: { type: 'object' }, json: { type: 'object' }, ARRAY: { type: 'array' } };
const COLTYPE = new Map<string, { schema: { type: string; format?: string; items?: { type: string; format?: string } }; nullable: boolean; ambiguous: boolean }>();
for (const r of colRows) { const j: { type: string; format?: string; items?: { type: string; format?: string } } | undefined = r.data_type === 'ARRAY' ? (PG_ELEM[r.udt_name] ? { type: 'array', items: PG_ELEM[r.udt_name] } : undefined) : PG_JSON[r.data_type]; if (!j) continue; const cur = COLTYPE.get(r.column_name); const nullable = cur ? cur.nullable || r.is_nullable === 'YES' : r.is_nullable === 'YES'; if (!cur) COLTYPE.set(r.column_name, { schema: j, nullable, ambiguous: false }); else if (cur.schema.type !== j.type) COLTYPE.set(r.column_name, { ...cur, ambiguous: true, nullable }); else COLTYPE.set(r.column_name, { ...cur, nullable }); }
/** Kaynak koddan bilinen, veritabanı sütunu OLMAYAN alanlar (örnekte hiç dolu görülmemiş olabilir) — server.ts/routes içindeki gerçek üretimden */
const KNOWN_NON_COLUMN: Record<string, J> = { 'GET /api/ready.reasons[]': { type: ['string'] } /* server.ts: reasons: string[] */ };

const checks = (await client.query(`SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, pg_get_constraintdef(c.oid) AS def FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) WHERE c.contype = 'c' AND array_length(c.conkey, 1) = 1`)).rows as { tbl: string; col: string; def: string }[]; await client.end();
/** R04: aynı ad birden çok tabloda farklı izin kümesiyle geçiyorsa (ör. "status" onlarca tabloda), enum ANLAMSIZ ve YANLIŞ olur — genel birleşim uygulanmaz, alan yalnız tür düzeyinde doğrulanır. Tek tabloda geçen ya da bütün tablolarda AYNI kümeye sahip adlar için enum uygulanır. */
const PER_TABLE = new Map<string, Map<string, Set<string>>>(); // col -> tbl -> values
for (const r of checks) { const m = [...r.def.matchAll(/'([^']+)'::text/g)].map(x => x[1]); if (m.length >= 1 && /= ANY|IN \(|= '/.test(r.def)) { const byTbl = PER_TABLE.get(r.col) ?? new Map<string, Set<string>>(); const s = byTbl.get(r.tbl) ?? new Set<string>(); m.forEach(x => s.add(x)); byTbl.set(r.tbl, s); PER_TABLE.set(r.col, byTbl); } }
const ENUM = new Map<string, Set<string>>(); const AMBIGUOUS_ENUM: string[] = [];
for (const [col, byTbl] of PER_TABLE) { const sets = [...byTbl.values()].map(s => [...s].sort().join('|')); const distinct = new Set(sets); if (distinct.size === 1) ENUM.set(col, byTbl.values().next().value); else AMBIGUOUS_ENUM.push(`${col} (${byTbl.size} tablo, farklı kümeler)`); }
const camel = (s: string) => s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
const APPLIED: string[] = []; const UNRESOLVED: string[] = [];
function tableEnum(spec: string): string[] | null { const [tbl, col] = spec.split('.'); const byTbl = PER_TABLE.get(col); const set = byTbl?.get(tbl); return set ? [...set].sort() : null; }
/** R04: uç + JSON yolu bazlı domain kuralı (src/contract/domain-map.ts) örnekten çıkarımın önüne geçer */
function applyRule(out: J, path: string): J | null {
  const rule = DOMAIN_MAP[path]; if (!rule) return null; APPLIED.push(path);
  if ('schema' in rule) return { ...rule.schema, 'x-source': rule.source };
  if ('nullable' in rule) { const tt = out.type as string | string[] | undefined; const arr = Array.isArray(tt) ? tt : tt ? [tt] : []; return { ...out, type: arr.includes('null') ? arr : [...arr, 'null'], 'x-source': rule.source }; }
  const t = out.type as string | string[] | undefined; const nullable = Array.isArray(t) ? t.includes('null') : t === 'null';
  if ('freeText' in rule) { const o = { ...out }; delete o.enum; o.type = nullable ? ['string', 'null'] : 'string'; o.description = 'serbest metin (enum değil)'; o['x-source'] = rule.source; return o; }
  if ('enum' in rule) return { ...out, type: nullable ? ['string', 'null'] : 'string', enum: nullable ? [...rule.enum, null] : rule.enum, 'x-source': rule.source };
  const vals = tableEnum(rule.column); if (!vals) { UNRESOLVED.push(`${path}: ${rule.column} CHECK kısıtı bulunamadı`); return null; }
  const all = [...vals, ...(rule.extra ?? [])]; return { ...out, type: nullable ? ['string', 'null'] : 'string', enum: nullable ? [...all, null] : all, 'x-source': rule.source ?? `CHECK ${rule.column}` };
}
function finalize(s: J, name = '', path = ''): J { const t = (s.type as string[] | undefined) ?? []; const out: J = {};
  if (!t.length) { const r = applyRule({}, path); if (r) return r; UNRESOLVED.push(`${path}: örnek elemanı yok, kural yok`); return { description: 'örneklerde boş dizi elemanı yok; eleman biçimi serbest' }; }
  out.type = t.length === 1 ? t[0] : t; if (s.format) out.format = s.format;
  if (t.includes('string') && name && !DOMAIN_MAP[path]) { const e = ENUM.get(name) ?? ENUM.get(camel(name)); const seen = s['x-seen'] as string[] | undefined; if (e && seen && seen.every(v => e.has(v))) out.enum = [...e].sort().concat(t.includes('null') ? [null as unknown as string] : []); }
  if (t.includes('object')) { const props = Object.entries((s.properties ?? {}) as J); const dyn = props.length > 0 && props.some(([k]) => /@|^[0-9a-f]{8}-|^\d+$/i.test(k)); /* anahtarı veri olan sözlükler (e-posta, kimlik, sayı) sabit alan sayılmaz */
    if (dyn) { out.additionalProperties = finalize(props.map(([, v]) => v as J).reduce(merge), '', `${path}.*`); out.description = 'anahtarları veri olan sözlük (ör. e-posta ya da kimlik)'; }
    else { out.properties = Object.fromEntries(props.map(([k, v]) => [k, finalize(v as J, k, `${path}.${k}`)])); out.required = s.required; } }
  if (t.includes('array')) out.items = finalize((s.items ?? {}) as J, name, `${path}[]`);
  if (t.includes('null') && t.some(x => x === 'number' || x === 'integer')) out.description = 'gizlilik eşiği altında ya da tanımsızsa null; asla 0 ile değiştirilmez';
  const r = applyRule(out, path); if (r) return r; if (t.length === 1 && t[0] === 'null') UNRESOLVED.push(`${path}: örneklerde yalnız null, kural yok`); return out; }
const by = new Map<string, J>(); for (const l of lines) { const k = `${l.m} ${l.u}`; by.set(k, merge(by.get(k) as J, infer(l.b))); }
/** Yalnız null görülen ya da hiç örneklenmemiş dizi elemanı alanlarını gerçek şemayla doldur (R04) */
function backfillNulls(node: J, path: string, keyName: string): J {
  const t = (node.type as string[] | undefined) ?? [];
  if (t.length === 1 && t[0] === 'null') { const col = COLTYPE.get(keyName); if (col && !col.ambiguous) return { type: col.nullable ? [col.schema.type, 'null'] : [col.schema.type], format: col.schema.format, 'x-source': 'information_schema' }; return node; }
  if (!t.length) { const known = KNOWN_NON_COLUMN[path]; if (known) return { ...known, 'x-source': 'kaynak kod' }; const col = COLTYPE.get(keyName); if (col && !col.ambiguous) { const el = path.endsWith('[]') && col.schema.type === 'array' && col.schema.items ? col.schema.items : col.schema; /* R04: text[] öğesi string, array değil */ return { type: [el.type], format: el.format, 'x-source': 'information_schema (örnek elemanı yok)' }; } return node; }
  if (t.includes('object')) { const props = (node.properties ?? {}) as J; node.properties = Object.fromEntries(Object.entries(props).map(([k, v]) => [k, backfillNulls(v as J, `${path}.${k}`, k)])); }
  if (t.includes('array') && node.items) node.items = backfillNulls(node.items as J, `${path}[]`, keyName);
  return node;
}
for (const [k, v] of by) by.set(k, backfillNulls(v, k, ''));

const out: J = { $comment: 'Üretildi: gerçek API test yanıtlarından (contract-infer). Elle düzenlemeyin; ürün sürümüyle birlikte yeniden üretin.' };
for (const [k, s] of [...by.entries()].sort()) out[k] = finalize(s, '', k);
const unusedRules = Object.keys(DOMAIN_MAP).filter(k => !APPLIED.includes(k));
if (unusedRules.length) console.log('domain-map kuralı hiçbir yola uygulanmadı:', unusedRules.join('; '));
if (UNRESOLVED.length) console.log('ÇÖZÜMSÜZ konum:', UNRESOLVED.join('; '));
writeFileSync(new URL('../src/contract/schema-audit.json', import.meta.url), JSON.stringify({ applied: APPLIED.length, unresolved: UNRESOLVED, unusedRules }, null, 1));
out['GET /api/t/:tid/templates/:kind.xlsx'] = { binary: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }; out['GET /api/t/:tid/imports/:jid/errors.xlsx'] = { binary: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
writeFileSync(new URL('../src/contract/responses.json', import.meta.url), JSON.stringify(out, null, 1)); if (AMBIGUOUS_ENUM.length) console.log('enum uygulanmadı (tabloya göre farklı izin kümesi):', AMBIGUOUS_ENUM.slice(0, 10).join('; '), AMBIGUOUS_ENUM.length > 10 ? `… (+${AMBIGUOUS_ENUM.length - 10})` : '');
console.log('yanıt şeması', Object.keys(out).length - 1, 'uç; tek anlamlı enum', ENUM.size, '/ belirsiz (uygulanmadı)', AMBIGUOUS_ENUM.length);
