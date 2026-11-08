import pg from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { config, apiRoot } from './config.js';
/** Sürümlü migrasyon (R38): db/migrations/*.sql sırayla; defter + SHA-256; danışma kilidi; uygulanmış dosya değiştiyse durur (ileriye yeni migrasyon eklenir). */
const c = new pg.Client({ connectionString: config.migrateUrl }); await c.connect();
await c.query('SELECT pg_advisory_lock(7712000)');
await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'); await c.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text');
const dir = config.migrationsDir + '/';
const aliases: Record<string, { canonical: string; aliases: Record<string, string> }> = (() => { try { return JSON.parse(readFileSync(dir + 'CHECKSUM_ALIASES.json', 'utf8')); } catch { return {}; } })();
await c.query('CREATE TABLE IF NOT EXISTS schema_migration_event (id bigserial PRIMARY KEY, name text NOT NULL, event text NOT NULL, detail text, at timestamptz NOT NULL DEFAULT now())');
for (const f of readdirSync(dir).filter(x => x.endsWith('.sql')).sort()) {
  const sql = readFileSync(dir + f, 'utf8'); const sum = createHash('sha256').update(sql).digest('hex');
  const row = (await c.query('SELECT checksum FROM schema_migrations WHERE name = $1', [f])).rows[0];
  if (row) {
    if (row.checksum && row.checksum !== sum) { const al = aliases[f]; if (al && al.canonical === sum && al.aliases[row.checksum]) { await c.query('UPDATE schema_migrations SET checksum = $2 WHERE name = $1', [f, sum]); await c.query('INSERT INTO schema_migration_event (name, event, detail) VALUES ($1,$2,$3)', [f, 'checksum_alias_accepted', `${row.checksum} → kanonik (${al.aliases[row.checksum]})`]); console.log('bilinen ara sürüm kabul edildi, defter kanonik checksum\'a çekildi:', f); continue; } console.error('HATA', f, 'uygulanmış migrasyon değiştirilmiş; yeni migrasyon ekleyin'); process.exit(1); }
    if (!row.checksum) await c.query('UPDATE schema_migrations SET checksum = $2 WHERE name = $1', [f, sum]); continue; }
  await c.query('BEGIN'); try { await c.query(sql); await c.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [f, sum]); await c.query('COMMIT'); console.log('uygulandı', f); } catch (e) { await c.query('ROLLBACK'); console.error('HATA', f, (e as Error).message); process.exit(1); }
}
await c.query('SELECT pg_advisory_unlock(7712000)'); const grantTo = process.env.GRANT_APP_ROLES_TO; if (grantTo) { if (!/^[a-z_][a-z0-9_]*$/.test(grantTo)) { console.error('HATA GRANT_APP_ROLES_TO geçersiz rol adı'); process.exit(1); } const exists = (await c.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [grantTo])).rowCount; if (!exists) { console.error('HATA servis rolü yok:', grantTo); process.exit(1); } await c.query(`GRANT hpw_app TO ${grantTo}`); await c.query(`GRANT hpw_worker TO ${grantTo}`); await c.query(`GRANT USAGE ON SCHEMA public TO ${grantTo}`); console.log('servis rolüne uygulama rolleri verildi:', grantTo); } // Docker/HTTPS: grant fail → migrate fail → API başlamaz
await c.end();
