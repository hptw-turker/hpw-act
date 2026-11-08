/** F04/F08 sözleşme testi: ön yüz RULES ile sunucu PERMISSION_RULES birebir aynı olmalı; rules.json (tarayıcı testlerinin sahte /permissions yanıtı) sunucu tablosundan üretilir. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { PERMISSION_RULES, ROUTE_CLASS, PLATFORM_ACTION_CLASS } from '../../../apps/api/src/governance.ts';
import { readFileSync } from 'node:fs';
import { RULES } from '../../../apps/web/src/product/permissions.ts';
const norm = (o: unknown) => JSON.parse(JSON.stringify(o, (_k, v) => (Array.isArray(v) ? [...v].sort() : v)));
assert.deepEqual(norm(RULES), norm(PERMISSION_RULES), 'ön yüz ve sunucu yetki tabloları farklı');
writeFileSync(new URL('./rules.json', import.meta.url), JSON.stringify(PERMISSION_RULES, null, 1));
// v2.9.0: her şirket içi yazma ucunun platform sınıfı var; sınıflı ama sözleşmede olmayan uç yok; her ön yüz işlem anahtarının platform sınıfı var
const spec = JSON.parse(readFileSync(new URL('../../../docs/api/openapi-urun.json', import.meta.url), 'utf8')) as { paths: Record<string, Record<string, unknown>> };
const writes = Object.entries(spec.paths).flatMap(([p, ops]) => Object.keys(ops).filter(m => m !== 'get' && p.startsWith('/api/t/')).map(m => `${m.toUpperCase()} ${p.replace(/\{(\w+)\}/g, ':$1')}`));
const unclassified = writes.filter(w => !(w in ROUTE_CLASS)); const stale = Object.keys(ROUTE_CLASS).filter(k => !writes.includes(k));
assert.deepEqual(unclassified, [], 'sınıfı olmayan şirket içi yazma ucu: ' + unclassified.join(', ')); assert.deepEqual(stale, [], 'sözleşmede olmayan sınıflı uç: ' + stale.join(', '));
const uiKeys = [...Object.keys(RULES.unit), ...Object.keys(RULES.tenant), ...Object.keys(RULES.companyWide)]; const noClass = uiKeys.filter(k => !(k in PLATFORM_ACTION_CLASS)); assert.deepEqual(noClass, [], 'platform sınıfı olmayan işlem anahtarı: ' + noClass.join(', '));
console.log('ROUTE-CLASS PASS', writes.length, 'yazma ucu sınıflı');
console.log('RULES-CONTRACT PASS', Object.keys(PERMISSION_RULES.unit).length + Object.keys(PERMISSION_RULES.companyWide).length + Object.keys(PERMISSION_RULES.screens).length + Object.keys(PERMISSION_RULES.tenant).length, 'kural');
