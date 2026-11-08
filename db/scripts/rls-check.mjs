// pnpm rls-check — migrasyonlarda RLS/FORCE/tenant_id denetimi (CI kapısı, T-48)
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../migrations/', import.meta.url).pathname;
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
let sql = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
let failed = false;

// 1) CREATE TABLE ... tenant_id zorunlu (tenant tablosu hariç)
const tables = [...sql.matchAll(/CREATE TABLE\s+(\w+)\s*\(([\s\S]*?)\n\);/g)];
for (const [, name, body] of tables) {
  if (name === 'tenant') continue;
  if (!/tenant_id\s+uuid\s+NOT NULL/i.test(body)) { console.error(`RLS-CHECK: ${name} tenant_id NOT NULL eksik`); failed = true; }
}
// 2) BYPASSRLS grant yasak
if (/GRANT[^;]*BYPASSRLS/i.test(sql) || /ALTER ROLE\s+hpw_app[^;]*\bBYPASSRLS\b/i.test(sql) && !/NOBYPASSRLS/.test(sql)) {
  console.error('RLS-CHECK: BYPASSRLS verilmiş'); failed = true;
}
// 3) FORCE RLS: tablo başına açık ALTER veya toplu DO bloğu
const hasBulkForce = /FORCE ROW LEVEL SECURITY/.test(sql) && /pg_tables/.test(sql);
if (!hasBulkForce) {
  for (const [, name] of tables) {
    if (!new RegExp(`ALTER TABLE ${name} FORCE ROW LEVEL SECURITY`).test(sql)) { console.error(`RLS-CHECK: ${name} FORCE RLS eksik`); failed = true; }
  }
}
// 4) uygulama rolü tablo sahibi olmamalı: OWNER TO hpw_app yasak
if (/OWNER TO hpw_app/i.test(sql)) { console.error('RLS-CHECK: hpw_app tablo sahibi yapılmış'); failed = true; }

if (failed) process.exit(1);
console.log(`RLS-CHECK OK (${tables.length} tablo, ${files.length} migrasyon)`);
