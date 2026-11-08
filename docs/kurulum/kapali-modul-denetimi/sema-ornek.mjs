// Kapalı modül rotalarının şemalarını derlenmiş koddan çıkarır, her rota için şemaya UYAN örnek
// params/querystring/body üretir ve Fastify'ın varsayılan Ajv ayarlarıyla önceden doğrular.
// Çıktı: her satır bir JSON { method, url, path, query, body, ok, errors }
// Kullanım (dosyayı sunucuda /tmp'ye kopyaladıktan sonra /opt/hpw-act/ops/sunucu içinde; yalnız rota kaydını okur, istek atmaz):
//   docker compose cp /tmp/sema-ornek.mjs api:/tmp/sema-ornek.mjs
//   docker compose exec -T api node /tmp/sema-ornek.mjs > /tmp/ornekler.jsonl
// Ardından: python3 -I gonder.py /tmp/ornekler.jsonl https://ALAN_ADI
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const req = createRequire('/app/apps/api/package.json');
const Fastify = req('fastify');
const Ajv = req('ajv').default ?? req('ajv');
const addFormats = req('ajv-formats').default ?? req('ajv-formats');

const ajv = new Ajv({ coerceTypes: 'array', useDefaults: true, removeAdditional: true, allErrors: true, strict: false });
addFormats(ajv);

const routes = [];
const app = Fastify();
app.addHook('onRoute', r => { routes.push({ method: r.method, url: r.url, schema: r.schema ?? {} }); });
for (const m of ['analysis', 'corporate', 'ai', 'roadmap']) {
  const mod = await import(`/app/apps/api/dist/src/routes/${m}.js`);
  const fn = mod[`${m}Routes`];
  if (typeof fn !== 'function') throw new Error(`${m}Routes bulunamadı`);
  await fn(app);
}
await app.ready();

const STR_CANDIDATES = ['ITEM1', 'R1', 'A1', 'a', 'x', '1', 'Q1', '2026-11-08', 'abc_def', 'ABC', 'deneme gerekcesi'];
const valid = (s, v) => ajv.validate(s, v);
function sample(s) {
  if (!s || typeof s !== 'object') return null;
  if ('const' in s) return s.const;
  if (Array.isArray(s.enum)) return s.enum[0];
  if (s.oneOf) return sample(s.oneOf[0]);
  if (s.anyOf) return sample(s.anyOf[0]);
  if (s.allOf) return Object.assign({}, ...s.allOf.map(sample));
  const t = Array.isArray(s.type) ? s.type.find(x => x !== 'null') : s.type;
  if (t === 'object' || (!t && s.properties)) {
    const o = {};
    for (const k of s.required ?? []) o[k] = sample((s.properties ?? {})[k] ?? {});
    return o;
  }
  if (t === 'array') { const n = s.minItems ?? 1; return Array.from({ length: Math.max(n, 1) }, () => sample(s.items ?? { type: 'string' })); }
  if (t === 'integer' || t === 'number') {
    let v = s.minimum ?? (s.exclusiveMinimum !== undefined ? s.exclusiveMinimum + 1 : 1);
    if (s.maximum !== undefined && v > s.maximum) v = s.maximum;
    return t === 'integer' ? Math.ceil(v) : v;
  }
  if (t === 'boolean') return false;
  if (t === 'string') {
    if (s.format === 'uuid') return randomUUID();
    if (s.format === 'email') return 'deneme@example.test';
    if (s.format === 'date') return '2026-11-08';
    if (s.format === 'date-time') return '2026-11-08T10:00:00.000Z';
    const min = s.minLength ?? 0;
    for (const c of STR_CANDIDATES) { const v = c.length >= min ? c : c + 'x'.repeat(min - c.length); if (valid(s, v)) return v; }
    return 'x'.repeat(Math.max(min, 1));
  }
  return null;
}

for (const r of routes) {
  const methods = Array.isArray(r.method) ? r.method : [r.method];
  for (const method of methods) {
    if (method === 'HEAD') continue;
    const sc = r.schema;
    const params = {};
    for (const [, name] of r.url.matchAll(/:([A-Za-z0-9_]+)/g)) params[name] = sc.params?.properties?.[name] ? sample(sc.params.properties[name]) : randomUUID();
    const path = r.url.replace(/:([A-Za-z0-9_]+)/g, (_, n) => encodeURIComponent(String(params[n])));
    const query = sc.querystring ? sample(sc.querystring) : null;
    const body = sc.body ? sample(sc.body) : (method === 'GET' ? null : {});
    const errors = [];
    if (sc.params && !valid(sc.params, { ...params })) errors.push({ part: 'params', e: ajv.errorsText() });
    if (sc.querystring && !valid(sc.querystring, structuredClone(query ?? {}))) errors.push({ part: 'querystring', e: ajv.errorsText() });
    if (sc.body && !valid(sc.body, structuredClone(body))) errors.push({ part: 'body', e: ajv.errorsText() });
    process.stdout.write(JSON.stringify({ method, url: r.url, path, query, body, hasBodySchema: !!sc.body, ok: errors.length === 0, errors }) + '\n');
  }
}
await app.close();
