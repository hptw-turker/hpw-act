# HPW Act API (v2.6) — çalışan ürün dilimi

> v2.6 (24 Eylül 2026): R01–R44 sertleştirmesi. Ortam ayrımı (`HPW_ENV`, `HPW_ENV_FILE`, ayrı DB/servis hesabı/çerez/posta dizini), yetki modeli (rollerden türetilen profil, açık şirket geneli yetkisi, kapsam tablosu), parola sıfırlama ve hız sınırı, sonuç yükleme sözleşmesi (FULL_REPLACE/PATCH, pinleme, soy bilgisi), kanıt ritmi, komut tekilleştirme, denetim izi, kuyruk kirası. Ayrıntı: `docs/R01-R44-kapanis-tablosu.md`, kurulum: kökteki `NEREDEN-BASLARIM.md`.

Fastify + PostgreSQL 16 + exceljs. Tenant izolasyonu satır düzeyi güvenlikle (RLS); uygulama rolü `hpw_api` (∈ hpw_app, NOBYPASSRLS); her istek `app.realm / app.user_id / app.tenant_id` bağlamıyla tek transaction'da çalışır.

## Kurulum
```
createdb hpw_act
psql -d hpw_act -c "CREATE ROLE hpw_api LOGIN PASSWORD 'hpw_api' NOBYPASSRLS;"   # migrasyon hpw_app/hpw_worker rollerini oluşturur
cd apps/api && npm install
MIGRATE_DATABASE_URL=postgres://postgres:postgres@localhost:5432/hpw_act npm run migrate   # db/migrations/*.sql sırayla, schema_migrations defteriyle
psql -d hpw_act -c "GRANT hpw_app TO hpw_api; GRANT hpw_worker TO hpw_api; GRANT USAGE ON SCHEMA public TO hpw_api;"
cd ../web && npm run build            # dist/app.html (ürün) + dist/index.html (prototip, /prototip)
cd ../api && npm start                # :8787 · web dist'i servis eder · SMTP_URL yoksa e-posta sandbox: var/mail/*.eml
```
İlk platform yöneticisi: `POST /api/platform/bootstrap {email, password, displayName}` (yalnız hiç platform kullanıcısı yokken; `SETUP_KEY` ile korunabilir). Sonra `/#/giris` → Müşteriler → Yeni şirket.

Ortam: `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `PORT`, `APP_BASE_URL` (davet bağlantıları), `SMTP_URL`, `SESSION_TTL_HOURS`, `INVITE_TTL_HOURS`, `MAX_UPLOAD_BYTES`, `COOKIE_SECURE=true` (HTTPS arkasında zorunlu).

## Ortamlar (v2.6)
`ops/create-env.sh <demo|bos> <parola>` ayrı veritabanı (`hpw_act_<env>`), ayrı LOGIN NOBYPASSRLS servis hesabı (`hpw_api_<env>`, yalnız kendi DB'sine CONNECT) ve migrasyonu kurar; `ops/reset-env.sh` yalnız `CONFIRM_RESET=<env>` ile siler. Ortam dosyası `HPW_ENV_FILE=.env.demo|.env.bos` ile yüklenir (`ops/env.*.example`). Değişkenler: `HPW_ENV`, `PORT`, `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `APP_BASE_URL`, `COOKIE_NAME` (varsayılan `hpw_session_<env>`), `COOKIE_SECURE`, `SETUP_KEY`, `HPW_DEMO_DATA` (sentetik etki istatistiği yalnız demo), `MAIL_DIR`, `SMTP_URL`, `MAIL_FROM` (SMTP varken zorunlu), `MAIL_ALLOWLIST` (doluysa dışındaki alıcılar `blocked`), `RESET_TTL_MINUTES`. `NODE_ENV=production` fail-closed doğrulama yapar.

## Migrasyonlar
`db/migrations/000{1,2,3}_*.sql` sırayla; `npm run migrate` defteri SHA-256 ile tutar, danışma kilidi alır, uygulanmış dosya değiştiyse durur (ileriye yeni migrasyon eklenir). 0003: `membership.explicit_profile/company_wide`, `membership_scope`, `password_token`, `login_attempt`, `idempotency_key`, `email_outbox.lease_until/next_attempt_at`, `result.source_reference/carried_from_batch_id`, `import_batch.import_mode`, `import_job.pinned`, `local_target.baseline_superseded/measurement_plan`, `action.custom/urgent_reason`, `evidence.slot_key`; yeni definer fonksiyonları (`auth_memberships`, `auth_session_switch_tenant`, `auth_platform_has_tenant`, `auth_password_token_*`, `auth_login_attempt`, `platform_bootstrap`, `outbox_claim/mark`), PUBLIC EXECUTE iptali.

## Kimlik ve yetki (v2.6)
- Etkin profil her istekte çözülür: açık profil (platformca verilen HR_ADMIN) ya da bugün geçerli rol atamalarının en genişi + `membership_scope`. Rol/kapsam yoksa sıfır birim. Şirket geneli görünüm yalnız `company_wide` (HR_ADMIN, EXEC).
- Platform personeli her `/api/t/:tid/*` isteğinde `platform_tenant_access` ile denetlenir.
- Kim ne verebilir: HR_ADMIN hepsi; HR_PARTNER yalnız REGION_MANAGER/UNIT_MANAGER/ACTION_OWNER/VIEWER; kullanıcı XLSX yüklemesi yalnız HR_ADMIN.
- `POST /api/auth/login` (8 başarısız/15 dk → 429), `/logout`, `/me` (profil, kapsam, üyelikler, env), `/switch-tenant`, `/forgot` (her durumda 200), `/reset/:token`; davet `GET/POST /api/invitations/:token[/accept]` — mevcut parolalı hesapta parola değişmez (`mode: membership_joined`).
- Yazma isteklerinde `Idempotency-Key` başlığı: aynı anahtar+gövde önceki yanıt, farklı gövde 409.

## Sonuç yükleme sözleşmesi (v2.6)
Paket sayfası zorunlu (`tenant_code`, `cycle_code`, `import_mode` = FULL_REPLACE | PATCH); her satırda `cycle_code` kontrolü; aynı sorunun göstergeleri tek dağılımdan (`distribution_conflict`); benchmark ölçek sınırı ve tekilliği, paketle gelen anlık görüntü. Doğrulama enstrüman ve aktif paketi pinler; commit'te değiştiyse `409 revalidate_required`. FULL_REPLACE aktif hücre düşürecekse `409 confirm_replace_required` → `{confirmReplace:true}`; PATCH değişmeyen sonuçları `carried_from_batch_id` ile yeni sürüme taşır. `source_reference` satırda kalıcı. Yeni sürüm bu dönemi başlangıç alan hedefleri `under_review` + `baseline_superseded` yapar; inceleme `{decision, reason, baseline: keep|rebase}` ister.

## Hedef → aksiyon → kanıt → doğrulama (v2.6)
`POST .../targets?preview=1` öneri (kayıt yazmaz: aralık, takip dönemi, ufuk, aday roller) → `POST .../targets` kabul (aday olmayan rol 422; düşük güven/REVIEW_REQUIRED → under_review). Aksiyon: şablon ya da `custom:{title,cadence}`; kapasite duraklatılmış/beyan edilmiş işleri sayar; `urgent` yalnız HR_ADMIN + `urgentReason`. Kanıt: gelecek tarih 422, ritim slotu başına tek gerçekleşme (telafi `occurrenceKey`). `verify {ok:boolean, reason, exempt?}`: kapsam + görev ayrımı; eksik gerçekleşme onayla tamamlanmaz (422 coverage_insufficient); muafiyet yalnız HR_ADMIN → `partial`. Takip yanıtı `targetId/cycleId`, gizli sonuçta sayısal alan null, `NOT_MEASURED` açık durum.

## Testler
```
npm run typecheck
npm test           # test/e2e.test.ts (10) + test/r01-r44.test.ts (9), sırayla, yalnız hpw_act_test (ALLOW_DB_RESET=1)
```
Tarayıcı turu: `tools/scripts/ui-bos-tur.py` (BOŞ kurulumdan 46 adım; sonrasında BOŞ ortamı sıfırlayın). Demo tohumu: `HPW_ENV_FILE=.env.demo npm run seed:demo` (yalnız demo).

## Akışlar (API)
- Platform: `POST /api/platform/tenants` (şirket + ilk İK yöneticisi daveti), `GET /api/platform/tenants`, `POST /api/auth/switch-tenant`.
- Şablonlar: `GET /api/t/:tid/templates/{org|users|instrument|results}.xlsx` (results için `?cycleId=`); yükleme `POST /api/t/:tid/imports/:kind` (multipart) → doğrulama raporu (kod + sayfa + satır + sütun) → `GET .../imports/:jid/errors.xlsx` → `POST .../imports/:jid/commit` (hata varken 409).
- Organizasyon/rol tek kayıt: `POST /api/t/:tid/org/units`, `/org/roles`. Soru seti: `GET .../instruments/catalog`, `POST .../instruments` (standart seçim + ek soru). Dönemler: `POST .../cycles`. Kullanıcılar: `POST .../users`, `POST .../invitations/send` (tek işlem, kişi başına token + outbox), `POST .../users/:mid/revoke`.
- Zincir: `GET .../cycles/:cid/units/:uid/results` → `POST .../targets` → `GET .../targets/:id/recommendations` → `POST .../targets/:id/actions` → `POST .../actions/:id/evidence` → `declare-complete` → `verify` (görev ayrılığı) → `GET .../targets/:id/followup?cycleId=` → `followup/review`.
