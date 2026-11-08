# HPW Act — temiz kurulum ve derleme (geliştirici kaynağı)

Bu komutlar teslimat ZIP’inin `GELISTIRICI_KAYNAK` klasöründe, temiz bir makinede (Node ≥ 22, PostgreSQL 16) doğrulanmıştır; sonuç: `KANITLAR/test-ciktilari/v273/temiz-kurulum.log`.

```sh
# 1) Domain çekirdeği (iş kuralları, 70 test)
cd packages/domain-core && npm ci && npm test && cd ../..
# 2) API (Fastify + PostgreSQL)
cd apps/api && npm ci && npm run typecheck && npm run build && cd ../..
# 3) Web: prebuild adımı prototip ekranlarının sentetik Atlas verisini deterministik üretir (seed 20260922); ürün arayüzü bu veriyi kullanmaz
cd apps/web && npm ci && npm run build && cd ../..
# 4) Veritabanı: rolleri ve veritabanını oluşturduktan sonra migrasyonlar (0001–0012)
MIGRATE_DATABASE_URL=postgres://postgres:postgres@localhost:5432/hpw_act npm run db:migrate
# 5) Testler
npm run test:domain          # 70 iş kuralı testi
npm run test:api             # gerçek PostgreSQL + HTTP entegrasyonu (izole hpw_act_test veritabanını sıfırlar)
npm --prefix apps/web test   # marka + yetki sözleşmesi + API istemcisi + tarayıcı regresyonları (Playwright gerekir)
```

- `npm run test:api` yalnız `hpw_act_test` adlı izole test veritabanını sıfırlar (ALLOW_DB_RESET=1); gerçek veriye dokunmaz.
- Tarayıcı regresyonları kontrollü HTTP yanıtlarıyla ön yüz davranışını sınar; gerçek API/DB kabulü `test:api`’dir.
- API sözleşmesi: `docs/api/openapi-urun.json` (`cd apps/api && node --import tsx scripts/openapi-gen.mts --check`).
