/** F08: çalışan ürünün GERÇEK rotalarından tek, sürümlü OpenAPI 3.1 sözleşmesi üretir. Rotalar Fastify onRoute kancasıyla toplanır;
 * istek gövdesi/sorgu şemaları uçların kendi JSON şemalarıdır (sunucu bunlarla doğrular). Ortak yanıt, hata, gizlilik, idempotency ve sürüm çatışması kuralları
 * elle yazılmış ortak bileşenlerdir ve uygulamadaki davranışı anlatır. Kullanım: node --import tsx tools/api/openapi-gen.mts [--check] */
import Fastify from 'fastify';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { authRoutes } from '../src/routes/auth.ts';
import { platformRoutes } from '../src/routes/platform.ts';
import { tenantRoutes } from '../src/routes/tenant.ts';
import { analysisRoutes } from '../src/routes/analysis.ts';
import { corporateRoutes } from '../src/routes/corporate.ts';
import { aiRoutes } from '../src/routes/ai.ts';
import { roadmapRoutes } from '../src/routes/roadmap.ts';
import { rm2Routes } from '../src/routes/rm2.ts';
const VERSION = process.env.HPW_VERSION || (readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8').match(/version: '([0-9.]+)'/)?.[1] ?? '0.0.0'); // ürün sürümüyle aynı kaynak (server.ts)
/** v2.10.0: sürüm ve kanıt çakışmalarının uca özgü 409 gövdeleri (gereksinimler §7.3) */
const vc = { type: 'object', required: ['error', 'message', 'details'], properties: { error: { type: 'string', enum: ['version_conflict'] }, message: { type: 'string' }, details: { type: 'object', required: ['currentVersion'], properties: { currentVersion: { type: 'integer' } } } } };
const ec = { type: 'object', required: ['error', 'message', 'details'], properties: { error: { type: 'string', enum: ['evidence_changed'] }, message: { type: 'string' }, details: { type: ['object', 'null'], properties: { currentFingerprint: { type: 'string' } } } } };
const other = (codes: string[]) => ({ type: 'object', required: ['error', 'message'], properties: { error: { type: 'string', enum: codes }, message: { type: 'string' }, details: {} } });
const r409 = (desc: string, ...schemas: unknown[]) => ({ description: desc, content: { 'application/json': { schema: { oneOf: schemas } } } });
const CONFLICT_409: Record<string, unknown> = {
  'PATCH /api/platform/tenants/:tid/tracked-cycle': r409('Sürüm çakışması: şirket kaydı görüntülendikten sonra değişti', vc),
  'POST /api/platform/tenants/:tid/service-record': r409('Sürüm çakışması', vc),
  'POST /api/platform/tenants/:tid/onboarding/:step/approve': r409('Sürüm ya da kanıt çakışması ya da önkoşul eksik', vc, ec, other(['step_prerequisite'])),
  'POST /api/t/:tid/onboarding/go-live/confirm': r409('Onaylanan kanıt güncel değil ya da HPW onayı yok', ec, other(['hpw_approval_missing'])),
  'POST /api/platform/tenants/:tid/status': r409('İzin verilmeyen durum geçişi', other(['invalid_transition'])),
  'POST /api/platform/work-items/:id/:op': r409('Sürüm çatışması (version_conflict, currentVersion), iş başkasınca üstlenildi (work_item_taken), iş durumu işleme izin vermiyor (invalid_state) ya da işlem anahtarı farklı içerikle kullanılmış (idempotency_conflict). Aynı anahtar + aynı içerik tekrarı 200 ve ilk yanıtı döndürür (idempotent-replay başlığı). Görünmeyen ya da yetkisiz iş: 404 work_item_not_found.', vc, other(['work_item_taken', 'invalid_state', 'idempotency_conflict'])),
  'POST /api/platform/tenants/:tid/assignments': r409('Sorumluluk bütünlüğü: devir gerekir, görev dolu ya da rol-görev uyumsuz', other(['primary_handover_required', 'duty_taken', 'last_admin', 'last_tenant_admin'])),
};
const RESP = JSON.parse(readFileSync(new URL('../src/contract/responses.json', import.meta.url), 'utf8')) as Record<string, Record<string, unknown>>; const empty: string[] = [];
const routes: { method: string; url: string; schema?: { body?: unknown; querystring?: unknown } }[] = [];
const app = Fastify(); app.addHook('onRoute', r => { const ms = Array.isArray(r.method) ? r.method : [r.method]; for (const m of ms) if (m !== 'HEAD' && r.url.startsWith('/api/')) routes.push({ method: m, url: r.url, schema: r.schema as never }); });
await authRoutes(app); await platformRoutes(app); await tenantRoutes(app); await analysisRoutes(app); await corporateRoutes(app); await aiRoutes(app); await roadmapRoutes(app); await rm2Routes(app); await app.ready();
const okResponse = (m: string, u: string) => { const sc = RESP[`${m} ${u}`]; if (!sc || !Object.keys(sc).length) { empty.push(`${m} ${u}`); return { description: 'TANIMSIZ', content: { 'application/json': { schema: {} } } }; } if (typeof sc.binary === 'string') return { description: sc.binary === 'application/octet-stream' ? 'Dosya (indirme; ?inline=1 ile JPEG/PNG/WEBP/GIF satır içi image/*)' : 'Excel dosyası', content: { [sc.binary]: { schema: { type: 'string', format: 'binary' } } } }; return { description: 'Başarılı (şema gerçek API yanıtlarından; src/contract/responses.json)', content: { 'application/json': { schema: sc } } }; };
const toOa = (u: string) => u.replace(/:([A-Za-z]+)/g, '{$1}');
const tag = (u: string) => u.startsWith('/api/auth') || u.startsWith('/api/invitations') ? 'Kimlik ve davet' : u.startsWith('/api/platform') ? 'Platform' : u.includes('/corporate/') || u.includes('/responsibility-map') || u.includes('/absorb') || u.includes('/move') ? 'Kurumsal' : u.includes('/imports') || u.includes('/templates') ? 'Excel içe aktarma' : u.includes('/targets') ? 'Hedef' : u.includes('/actions') ? 'Aksiyon ve kanıt' : u.includes('/followup') ? 'Takip' : 'Kiracı';
const paths: Record<string, Record<string, unknown>> = {};
for (const r of routes.sort((a, b) => (a.url + a.method).localeCompare(b.url + b.method))) {
  const p = toOa(r.url); const params = [...r.url.matchAll(/:([A-Za-z]+)/g)].map(m => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }));
  const q = r.schema?.querystring as { properties?: Record<string, unknown> } | undefined;
  const qp = q?.properties ? Object.entries(q.properties).map(([name, schema]) => ({ name, in: 'query', required: false, schema })) : [];
  const write = r.method !== 'GET'; const tenant = r.url.startsWith('/api/t/');
  const op: Record<string, unknown> = { tags: [tag(r.url)], operationId: `${r.method.toLowerCase()}_${r.url.replace(/[/:{}-]+/g, '_').replace(/^_|_$/g, '')}`, parameters: [...params, ...qp, ...(write && tenant ? [{ $ref: '#/components/parameters/IdempotencyKey' }] : [])], responses: { '200': okResponse(r.method, r.url), ...(r.url.startsWith('/api/auth/login') || r.url.startsWith('/api/invitations') || r.url.startsWith('/api/platform/bootstrap') ? {} : { '401': { $ref: '#/components/responses/Unauthorized' } }), '403': { $ref: '#/components/responses/Forbidden' }, '404': { $ref: '#/components/responses/NotFound' }, ...(write ? { '409': CONFLICT_409[`${r.method} ${r.url}`] ?? { $ref: '#/components/responses/Conflict' }, '422': { $ref: '#/components/responses/Invalid' } } : {}), '429': { $ref: '#/components/responses/RateLimited' }, '500': { $ref: '#/components/responses/ServerError' }, '503': { $ref: '#/components/responses/Unavailable' } } };
  if (r.schema?.body) op.requestBody = { required: true, content: { 'application/json': { schema: r.schema.body } } };
  if (/\/rm2-steps\/:sid\/records$/.test(r.url) && r.method === 'POST') op.requestBody = { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { kind: { type: 'string', enum: ['NOTE', 'PROGRESS', 'BLOCKER'] }, text: { type: 'string', maxLength: 2000 }, files: { type: 'array', maxItems: 5, items: { type: 'string', format: 'binary' } } }, required: ['kind'] } } } }; // v3.1.0: en fazla 5 dosya, dosya başına 10 MB
  if (/\/imports\/:kind$/.test(r.url) && r.method === 'POST') op.requestBody = { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } } } };
  (paths[p] ??= {})[r.method.toLowerCase()] = op;
}
const doc = { openapi: '3.1.0', info: { title: 'HPW Act ürün API sözleşmesi', version: VERSION, description: 'Çalışan ürünün gerçek uçları (Fastify rotalarından üretildi). Taban /api; şirket kapsamlı uçlar /api/t/{tid}/… — /api/v1 kullanılmaz. Oturum: HttpOnly çerez. Önceki docs/api/openapi.yaml (/api/v1) yerine geçer.' },
  servers: [{ url: '/' }], tags: ['Kimlik ve davet', 'Platform', 'Kiracı', 'Excel içe aktarma', 'Hedef', 'Aksiyon ve kanıt', 'Takip', 'Kurumsal'].map(name => ({ name })), paths,
  components: {
    parameters: { IdempotencyKey: { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string', maxLength: 200 }, description: 'Yazma komutlarında kullanıcı niyeti boyunca kararlı anahtar. Aynı anahtar + aynı gövde: ilk sonuç (makbuz) aynen döner; aynı anahtar + farklı gövde: 409 idempotency_conflict; aynı anahtar işlenirken: 409 idempotency_in_progress; iş yapılmış ama makbuz kayıpsa: 409 receipt_lost (istemci kaynağı yeniden okur, yeni anahtarla tekrar göndermez).' } },
    schemas: {
      Error: { type: 'object', required: ['error', 'message'], properties: { error: { type: 'string', description: 'makine kodu (ör. forbidden_profile, unit_not_in_scope, version_changed, receipt_lost, decision_required, unsupported_metric)' }, message: { type: 'string', description: 'Türkçe açıklama' }, details: {} } },
      PrivacySuppressedNumber: { type: ['number', 'null'], description: 'Gizlilik eşiği altındaki ya da çıkarım riskli satırda null döner; ASLA 0 değildir. İstemci null’u “—/gizli” gösterir.' },
      ResultRow: { type: 'object', required: ['resultId', 'metricCode', 'itemCode', 'suppressed'], properties: { resultId: { type: 'string' }, metricCode: { type: 'string' }, itemCode: { type: 'string' }, text: { type: 'string' }, dimensionCode: { type: ['string', 'null'] }, dimensionName: { type: ['string', 'null'] }, n: { $ref: '#/components/schemas/PrivacySuppressedNumber' }, value: { $ref: '#/components/schemas/PrivacySuppressedNumber' }, companyValue: { $ref: '#/components/schemas/PrivacySuppressedNumber' }, suppressed: { type: 'boolean' }, hidden: { type: 'boolean' }, privacy: { type: 'object' }, assessment: { type: ['object', 'null'] }, candidateRoles: { type: 'array' }, interactionArea: { type: ['string', 'null'] }, responsibilityCenter: { type: ['string', 'null'] } } },
      Permissions: { type: 'object', required: ['contract', 'profile', 'companyWide', 'unitProfile', 'rules'], properties: { contract: { const: 'hpw-act-permissions/1' }, realm: { type: 'string' }, profile: { type: ['string', 'null'] }, companyWide: { type: 'boolean' }, unitId: { type: ['string', 'null'] }, unitProfile: { type: ['string', 'null'], description: 'birim kapsam dışıysa null' }, rules: { type: 'object', description: 'apps/api/src/governance.ts PERMISSION_RULES' } } },
    },
    responses: Object.fromEntries([['Unauthorized', 'Oturum yok ya da süresi doldu (error=unauthorized); istemci girişe döner'], ['Forbidden', 'Profil ya da birim kapsamı yetersiz (forbidden_profile, unit_not_in_scope, company_scope_required)'], ['NotFound', 'Kayıt yok, kapalı ya da kapsam dışı'], ['Conflict', 'Sürüm çatışması (version_changed; hedef kabulünde gövdede expectedVersion), iş kuralı çatışması ya da idempotency durumları (idempotency_conflict, idempotency_in_progress, receipt_lost)'], ['Invalid', 'Şema/iş kuralı doğrulaması (400 şema, 422 iş kuralı)'], ['RateLimited', 'Hız sınırı (too_many_attempts)'], ['ServerError', 'Beklenmeyen hata (internal_error)'], ['Unavailable', 'Servis/veritabanı geçici olarak kullanılamıyor']].map(([k, d]) => [k, { description: d, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }])),
  },
  'x-hpw-conventions': { privacy: 'Gizli satırlarda n, value, companyValue, hedef/sonuç sayıları null; türetilmiş durumlar “hidden”.', versioning: 'Hedef kabulü gövdede expectedVersion ister; If-Match başlığı kullanılmaz.', idempotency: 'Bütün /api/t/ POST ve PATCH yazmaları Idempotency-Key kabul eder; platform şirket oluşturma ve davet kabulü kendi doğal tekilliğiyle kurtarılır (tenant_exists, invitation_already_accepted).', routeCount: routes.length },
};
const yaml = JSON.stringify(doc, null, 2); const out = new URL('../../../docs/api/openapi-urun.json', import.meta.url);
if (empty.length) { console.error('BOŞ BAŞARI ŞEMASI:', empty.join(', ')); process.exit(1); }
if (process.argv.includes('--check')) { const cur = existsSync(out) ? readFileSync(out, 'utf8') : ''; if (cur !== yaml) { console.error('SÖZLEŞME GÜNCEL DEĞİL: rotalar değişti; openapi-gen çalıştırın'); process.exit(1); } console.log('SÖZLEŞME GÜNCEL', routes.length, 'uç'); }
else { writeFileSync(out, yaml); console.log('yazıldı', routes.length, 'uç'); }
await app.close(); process.exit(0);
