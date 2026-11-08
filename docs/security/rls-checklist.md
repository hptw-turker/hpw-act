# RLS ve tenant izolasyonu kontrol listesi

- [ ] Her tablo `tenant_id uuid not null` taşır ve `(tenant_id, id)` benzersiz.
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY; ALTER TABLE ... FORCE ROW LEVEL SECURITY;` her tabloda.
- [ ] Politika: `USING (tenant_id = current_setting('app.tenant_id')::uuid)` ve aynı `WITH CHECK`.
- [ ] Uygulama rolü `hpw_app`: tablo sahibi DEĞİL, `NOBYPASSRLS`, yalnız DML. Migrasyon rolü `hpw_migrator` ayrı.
- [ ] Her bağlantı `SET LOCAL app.tenant_id = ...` ve `app.actor_id` ayarlar; tenant bağlamı olmadan sorgu atılırsa politika hiçbir satır döndürmez.
- [ ] HPTW danışman çok-tenant görünümü ayrı bir okuma rolü ve açık tenant listesiyle (`app.tenant_ids`), asla BYPASSRLS ile değil.
- [ ] CI `pnpm rls-check`: migrasyonlarda ENABLE+FORCE eksik tablo, `BYPASSRLS` içeren GRANT, `tenant_id` eksik CREATE TABLE → başarısız.
- [ ] T-47 ve T-48 kabul testleri her sürümde koşar.
- [ ] Skor baskılama SQL katmanında da uygulanır: `result_visible` görünümü `n < threshold` satırlarda `normalized_score = NULL`.
