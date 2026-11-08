# HPW Act v2.6 — Nereden başlarım?

Aynı kaynak ve aynı build iki bağımsız kurulum olarak teslim edilir: **DOLU DEMO** (sentetik iki şirket, 8787) ve **BOŞ BAŞLANGIÇ** (sıfır müşteri verisi, 8788). Fark yalnız ortam dosyası ve başlangıç verisidir; veritabanı, servis hesabı, oturum çerezi, posta dizini ve sırlar ayrıdır.

## Gereksinimler
Node.js 22+, PostgreSQL 16 (yerel `postgres` süper kullanıcısı ile), Python 3 yalnız tarayıcı turu için (isteğe bağlı).

## 1. Bağımlılıklar
```
cd packages/domain-core && npm install && npx tsc -p tsconfig.json
cd ../../apps/api && npm install
cd ../web && npm install && npx vite build && npm run build:single
```

## 2. Ortamı kurun (ayrı DB + ayrı servis hesabı + migrasyon)
```
sh ops/create-env.sh demo <demo_api_parolasi>     # DOLU DEMO
sh ops/create-env.sh bos  <bos_api_parolasi>      # BOŞ BAŞLANGIÇ
```
Örnek ortam dosyalarını kopyalayıp parola/sırları değiştirin: `ops/env.demo.example → apps/api/.env.demo`, `ops/env.bos.example → apps/api/.env.bos`. Üretimde `NODE_ENV=production` ile sunucu SETUP_KEY, COOKIE_SECURE=true, https APP_BASE_URL ve varsayılan olmayan DB parolası olmadan açılmaz.

## 3. DOLU DEMO
```
cd apps/api && HPW_ENV_FILE=.env.demo npm run seed:demo     # ~1 dakika; yalnız HPW_ENV=demo'da çalışır
HPW_ENV_FILE=.env.demo npx tsx src/server.ts                # http://localhost:8787
```
Giriş bilgileri tohum sonunda ekrana ve `apps/api/var/DEMO-GIRIS-BILGILERI.md` dosyasına yazılır (platform, iki İK yöneticisi, HRBP, GMY, bölge/şube müdürleri, ekip lideri, kapsamlı izleyici, aktif ve süresi biten vekil). Davet e-postaları `apps/api/var/mail-demo/*.eml` altında sandbox olarak durur; gerçek alıcıya gönderim yoktur. Demo'yu sıfırlamak: `CONFIRM_RESET=demo sh ops/reset-env.sh demo` sonra 2. adım ve tohum.

## 4. BOŞ BAŞLANGIÇ
```
cd apps/api && HPW_ENV_FILE=.env.bos npx tsx src/server.ts   # http://localhost:8788
```
İlk HPW yöneticisi ekranda değil, tek seferlik ve SETUP_KEY ile açılır:
```
curl -X POST http://localhost:8788/api/platform/bootstrap -H 'content-type: application/json' \
  -d '{"email":"admin@sirketiniz.com","password":"<en az 10 karakter, harf+rakam>","displayName":"HPW Yönetici","setupKey":"<.env.bos içindeki SETUP_KEY>"}'
```
İkinci çağrı 409 ile reddedilir. Sonra tarayıcıda `#/giris` → Müşteriler → Yeni şirket (ilk İK yöneticisi e-postası) → Aç → Genel bakış. Kurulum sırası Genel bakış tablosunda durumuyla görünür: Organizasyon (ekran ya da XLSX) → Soru seti (standart + ek sorular) → Dönemler ve sonuçlar (XLSX indir → doldur → yükle → doğrula → önizle → onayla) → Kullanıcılar (tek tek ya da 500'lük XLSX, rol/kapsam, tek tuşla davet). Kişiler kişisel, süreli, tek kullanımlık bağlantıyla parolalarını kendileri belirler; parola hiçbir zaman e-posta ile gönderilmez. Posta sağlayıcısı yapılandırılana kadar davetler `var/mail-bos` sandbox'ına yazılır ve ekranda öyle etiketlenir.

## 5. Testler (yalnız izole test veritabanı)
```
cd apps/api && npm run typecheck && npm test           # 19 API senaryosu, gerçek PostgreSQL, hpw_act_test
cd packages/domain-core && npx tsx --test test/*.test.ts   # 70 domain testi
BASE=http://localhost:8788 MAIL_DIR=apps/api/var/mail-bos SETUP_KEY=<key> python3 tools/scripts/ui-bos-tur.py   # boş kurulumdan 46 adımlık tarayıcı turu (sonrasında BOŞ ortamı sıfırlayın)
```

## 6. Ayrı onay gerektirenler
Canlı yayın, gerçek toplu e-posta (SMTP_URL + MAIL_FROM + MAIL_ALLOWLIST) ve gerçek veride yıkıcı işlem (`ops/reset-env.sh`, migrasyon geri alma) bu teslimatta yapılmadı; her biri için ayrı onay gerekir.
