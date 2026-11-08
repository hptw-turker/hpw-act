#!/bin/sh
# İki bağımsız teslimat paketi (aynı kaynak/build): HPW_Act_DOLU_DEMO.zip ve HPW_Act_BOS_BASLANGIC.zip
# Ortak: kaynak (node_modules, var, .env.* hariç), derlenmiş web (dist), migrasyonlar, ops, docs, testler.
# DEMO: .env.demo + demo/hpw_act_demo.dump (pg_dump, sentetik) + giriş bilgileri + başlat.sh. BOŞ: .env.bos.example + başlat.sh; hiçbir müşteri verisi, posta ya da test kaydı yok.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; OUT="${OUT:-/mnt/user-data/outputs}"; STAMP="$(date +%Y%m%d)"; TMP="$(mktemp -d)"
mkdir -p "$OUT"
common() { # $1 hedef klasör
  mkdir -p "$1"; cd "$ROOT"
  tar --exclude='node_modules' --exclude='apps/api/var' --exclude='apps/api/.env.*' --exclude='.git' --exclude='*.zip' --exclude='apps/web/node_modules' -cf - apps packages db ops docs tools NEREDEN-BASLARIM.md README.md package.json pnpm-workspace.yaml 2>/dev/null | (cd "$1" && tar -xf -)
  [ -f "$ROOT/apps/web/dist/app.html" ] || { echo "web dist yok: apps/web && npx vite build && npm run build:single"; exit 2; }
}
# DOLU DEMO
D="$TMP/HPW_Act_DOLU_DEMO"; common "$D"
mkdir -p "$D/demo"; cp "$ROOT/apps/api/.env.demo" "$D/apps/api/.env.demo"; cp "$ROOT/apps/api/var/DEMO-GIRIS-BILGILERI.md" "$D/demo/"
su postgres -c "pg_dump -Fc --exclude-table-data=schema_migrations hpw_act_demo" > "$D/demo/hpw_act_demo.dump"   # migrasyon defteri hariç: hedefte migrasyon uygulanmış olur
cat > "$D/BASLAT-DEMO.sh" <<'EOS'
#!/bin/sh
# DOLU DEMO: demo veritabanını yükler (dump) ya da tohumlar, sunucuyu 8787'de açar. Yalnız demo ortamı; gerçek alıcıya posta yok.
set -e; cd "$(dirname "$0")"
PW="${DEMO_API_PASSWORD:-demo-api-2026}"
sh ops/create-env.sh demo "$PW" || true
if [ -f demo/hpw_act_demo.dump ] && [ "$(su postgres -c "psql -d hpw_act_demo -Atc 'select count(*) from tenant'")" = "0" ]; then su postgres -c "pg_restore -a --disable-triggers -d hpw_act_demo" < demo/hpw_act_demo.dump   # yalnız veri; şema migrasyonla kuruldu; echo "demo verisi yüklendi (2 sentetik şirket)"; fi
cd apps/api && HPW_ENV_FILE=.env.demo npx tsx src/server.ts
EOS
chmod +x "$D/BASLAT-DEMO.sh"
(cd "$TMP" && rm -f "$OUT/HPW_Act_DOLU_DEMO.zip" && zip -qr "$OUT/HPW_Act_DOLU_DEMO.zip" HPW_Act_DOLU_DEMO)
# BOŞ BAŞLANGIÇ
B="$TMP/HPW_Act_BOS_BASLANGIC"; common "$B"
rm -rf "$B/docs/DEMO-GIRIS-BILGILERI.md" "$B/docs/test-ciktilari/seed-demo.log" "$B/docs/xlsx-sablonlar-demo"   # demo giriş bilgileri ve tohum günlüğü BOŞ pakete girmez
cat > "$B/BASLAT-BOS.sh" <<'EOS'
#!/bin/sh
# BOŞ BAŞLANGIÇ: boş veritabanı + migrasyon, sunucu 8788. İlk HPW yöneticisi SETUP_KEY ile tek seferlik (NEREDEN-BASLARIM.md §4).
set -e; cd "$(dirname "$0")"
PW="${BOS_API_PASSWORD:-$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)}"
[ -f apps/api/.env.bos ] || { sed "s/BOS_API_PAROLASI/$PW/; s/bos-kurulum-anahtari-degistirin/$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)/" ops/env.bos.example > apps/api/.env.bos; echo "apps/api/.env.bos üretildi (SETUP_KEY ve DB parolası rastgele); saklayın."; }
PW="$(grep '^DATABASE_URL' apps/api/.env.bos | sed 's#.*hpw_api_bos:\([^@]*\)@.*#\1#')"
sh ops/create-env.sh bos "$PW" || true
cd apps/api && HPW_ENV_FILE=.env.bos npx tsx src/server.ts
EOS
chmod +x "$B/BASLAT-BOS.sh"
# BOŞ pakette demo dump/giriş bilgisi/posta olmadığını ve kaynakta demo verisi taşınmadığını doğrula
[ ! -e "$B/demo" ] && [ ! -e "$B/apps/api/var" ] && [ ! -e "$B/apps/api/.env.demo" ] || { echo "BOŞ paket kirli"; exit 3; }
(cd "$TMP" && rm -f "$OUT/HPW_Act_BOS_BASLANGIC.zip" && zip -qr "$OUT/HPW_Act_BOS_BASLANGIC.zip" HPW_Act_BOS_BASLANGIC)
ls -la "$OUT"/HPW_Act_DOLU_DEMO.zip "$OUT"/HPW_Act_BOS_BASLANGIC.zip | awk '{print $5, $9}'; rm -rf "$TMP"
