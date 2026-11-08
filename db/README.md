# Veritabanı

- PostgreSQL 16. Migrasyonlar `db/migrations/NNNN_*.sql`, Drizzle ile uygulanır (`pnpm db:migrate`).
- Roller: `hpw_migrator` (DDL, tablo sahibi) ve `hpw_app` (yalnız DML, `NOBYPASSRLS`, tablo sahibi değil). Uygulama yalnız `hpw_app` ile bağlanır.
- Her bağlantıda transaction başında `SET LOCAL app.tenant_id = '<uuid>'; SET LOCAL app.actor_id = '<uuid>';`. Tenant bağlamı yoksa politika hiçbir satır döndürmez.
- Her tablo `ENABLE` + `FORCE ROW LEVEL SECURITY` ve `tenant_isolation` politikası. `pnpm rls-check` migrasyonları tarar.
- Baskılanmış skorlar `result_visible` görünümünden okunur; `result` tablosuna doğrudan API erişimi yoktur.
- `audit_event` append-only (UPDATE/DELETE kural ile engellenir). Kişisel veri yalnız referansla.
- `ux_target_relationship_canonical` çift sayımı engeller (T-07). `action` CHECK kısıtları master/local ayrımını zorlar (I-16).
- Collation: `CREATE DATABASE hpwact ... LC_COLLATE='tr_TR.UTF-8' LC_CTYPE='tr_TR.UTF-8'` veya ICU `tr-TR`; metin sıralama `COLLATE "tr-TR-x-icu"`.
