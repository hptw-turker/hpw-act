#!/bin/sh
# HPW Act __ENV_TITLE__ başlatıcı — çift tıklayarak çalıştırın (Mac: .command; Linux: sh ile). Terminal komutu yazmanız gerekmez.
# TEK SEFERLİK ÖN KOŞUL (operatör): Node.js 22+ ve PostgreSQL 16+ (Mac: Postgres.app ya da Homebrew "postgresql@16"; Linux: postgresql-16) kurulmuş olmalı.
# Bu başlatıcı: kendi PostgreSQL veri klasörünü (CALISTIRMA/pgdata-__ENV__) ve servis hesabını oluşturur, migrasyonu uygular, (demo ise) sentetik veriyi bir kez yükler,
# uygulamayı __ORIGIN__ adresinde açar ve index.html'i tarayıcıda başlatır. İkinci çalıştırma yeni veri ya da ikinci sunucu oluşturmaz.
set -u
ENV=__ENV__; PORT=__PORT__; HOST=__HOST__; PGPORT=__PGPORT__; ORIGIN=__ORIGIN__
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; RUN="$ROOT/CALISTIRMA"; APP="$ROOT/assets/app"; API="$APP/apps/api"; PGDATA="$RUN/pgdata-$ENV"; SOCK="${TMPDIR:-/tmp}/hpw-act-$ENV-$(id -u)"; LOG="$RUN/server-$ENV.log"   # M07: kısa, boşluksuz socket dizini
mkdir -p "$RUN" "$SOCK"
say() { printf '%s\n' "$*"; }
fail() { say ""; say "DURDU: $*"; say "Bu pencereyi kapatabilirsiniz. Sorun teknik operatöre iletilmeli (CALISTIRMA/*.log)."; say ""; read -r _ 2>/dev/null; exit 1; }
open_url() { if command -v open >/dev/null 2>&1; then open "$1"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1 || true; fi; }
health() { curl -s -m 3 "$ORIGIN/api/health" 2>/dev/null; }
# 0 zaten çalışıyor mu?
BUILD="__BUILD_ID__"; IDFILE="$RUN/KURULUM_KIMLIGI"; [ -f "$IDFILE" ] || { umask 077; head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$IDFILE"; umask 022; }; INSTALL_ID="$(cat "$IDFILE")"
H="$(health)"; if [ -n "$H" ]; then
  case "$H" in *'"env":"'"$ENV"'"'*) ;; *) fail "$PORT portunda başka bir ortam çalışıyor: $H";; esac
  case "$H" in *'"build":"'"$BUILD"'"'*'"install":"'"$INSTALL_ID"'"'*|*'"install":"'"$INSTALL_ID"'"'*'"build":"'"$BUILD"'"'*) R="$(curl -s -m 3 "$ORIGIN/api/ready" 2>/dev/null)"; case "$R" in *'"ready":true'*) say "Bu sürüm ve kurulum zaten çalışıyor ve hazır ($ORIGIN). index.html açılıyor."; open_url "$ROOT/index.html"; exit 0;; *) say "Bu sürüm çalışıyor ama hazır değil: $R"; ;; esac;; esac
  case "$H" in *'"build":"'"$BUILD"'"'*) case "$H" in *'"install":"'"$INSTALL_ID"'"'*) ;; *) fail "$PORT portunda aynı sürümün BAŞKA bir kurulumu çalışıyor (kurulum kimliği farklı). Onu kapatıp bu klasördeki başlatıcıyı yeniden çalıştırın; veri sıfırlanmaz.";; esac;; esac
  # aynı ortam, eski sürüm (V01): bu kurulumun sunucusu = aynı dist yolunu çalıştıran süreç (pid kaydı ya da ps ile bulunur); kontrollü durdur, veri korunur; başka kurulumsa döngü yerine açıklayıcı durdurma
  cwd_of() { if [ -r "/proc/$1/cwd" ]; then readlink "/proc/$1/cwd" 2>/dev/null; else lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1; fi; }
  OWN=""; for pp in $(ps -eo pid=,args= 2>/dev/null | grep "dist/src/server.js" | grep -v grep | awk '{print $1}'); do A="$(ps -o args= -p "$pp" 2>/dev/null)"; case "$A" in *"$API/dist/src/server.js"*) OWN="$OWN $pp";; *) [ "$(cwd_of "$pp")" = "$API" ] && OWN="$OWN $pp";; esac; done
  OLDPID="$(cut -d" " -f1 "$RUN/server-$ENV.pid" 2>/dev/null || true)"; if [ -n "$OLDPID" ] && kill -0 "$OLDPID" 2>/dev/null; then case "$(ps -o args= -p "$OLDPID" 2>/dev/null)" in *"dist/src/server.js"*) OWN="$OWN $OLDPID";; *) say "pid kaydı ($OLDPID) artık bu uygulamaya ait değil; yok sayıldı.";; esac; fi   # M08: PID yeniden kullanımı
  if [ -n "$(echo $OWN)" ]; then say "Eski sürüm çalışıyor (pid $(echo $OWN)); kontrollü durduruluyor, veri korunur."; for pp in $OWN; do kill "$pp" 2>/dev/null; done; i=0; while [ $i -lt 15 ] && [ -n "$(health)" ]; do sleep 1; i=$((i+1)); done; rm -f "$RUN/server-$ENV.pid"
    [ -z "$(health)" ] || fail "$PORT portu hâlâ eski sürümce yanıt veriyor; o süreci kapatıp yeniden başlatın (veri korunur)"
  else fail "$PORT portunda bu kurulumun kaydında olmayan bir $ENV sürümü çalışıyor ($H). Onu kapatıp bu başlatıcıyı yeniden çalıştırın; veri sıfırlanmaz."; fi
fi
# 1 araçlar
NODE="$(command -v node 2>/dev/null || true)"; for c in /opt/homebrew/bin/node /usr/local/bin/node; do [ -z "$NODE" ] && [ -x "$c" ] && NODE="$c"; done
[ -n "$NODE" ] || fail "Node.js bulunamadı. Tek seferlik kurulum: Node.js 22+ (https://nodejs.org)."
PGBIN=""; for d in /Applications/Postgres.app/Contents/Versions/*/bin /opt/homebrew/opt/postgresql@17/bin /opt/homebrew/opt/postgresql@16/bin /usr/local/opt/postgresql@16/bin /usr/lib/postgresql/17/bin /usr/lib/postgresql/16/bin; do [ -x "$d/initdb" ] && [ -z "$PGBIN" ] && PGBIN="$d"; done
[ -n "$PGBIN" ] || { command -v initdb >/dev/null 2>&1 && PGBIN="$(dirname "$(command -v initdb)")"; }
[ -n "$PGBIN" ] || fail "PostgreSQL bulunamadı. Tek seferlik kurulum: Postgres.app (Mac) ya da postgresql-16."
NODEV="$("$NODE" -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"; [ "$NODEV" -ge 22 ] 2>/dev/null || fail "Node.js 22+ gerekli (bulunan: $("$NODE" -v 2>/dev/null))"
PGMAJ="$("$PGBIN/initdb" --version 2>/dev/null | sed 's/[^0-9]*\([0-9]*\).*/\1/')"; [ "$PGMAJ" -ge 16 ] 2>/dev/null || fail "PostgreSQL 16+ gerekli (bulunan: $PGMAJ)"
if [ -f "$PGDATA/PG_VERSION" ] && [ "$(cat "$PGDATA/PG_VERSION")" != "$PGMAJ" ]; then fail "Veri dizini PostgreSQL $(cat "$PGDATA/PG_VERSION") ile oluşturulmuş, bulunan sürüm $PGMAJ. Veri silinmez; aynı sürümü kurun ya da pg_upgrade ile yükseltin."; fi   # M07
say "Node: $NODE (v$NODEV) · PostgreSQL: $PGBIN (v$PGMAJ)"
# 2 veritabanı kümesi (yalnız bu ortama ait; ilk çalıştırmada oluşturulur)
SECRET="$RUN/.pg-$ENV.secret"
if [ -d "$PGDATA" ] && [ ! -f "$PGDATA/PG_VERSION" ]; then fail "Veri dizini var ($PGDATA) ama PG_VERSION dosyası yok. Bu bozuk ya da yarım bir küme olabilir; hiçbir şey silinmez. Teşhis: dizini yedekleyip teknik operatöre iletin; boş kurulum için dizini SİZ taşıyın."; fi
if [ -f "$PGDATA/PG_VERSION" ] && [ ! -f "$SECRET" ]; then fail "Veritabanı kümesi var ama sır dosyası ($SECRET) yok. Veri sıfırlanmaz; sır dosyasını yedekten geri koyun ya da teknik operatöre başvurun."; fi
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  say "İlk çalıştırma: veritabanı kümesi oluşturuluyor…"
  umask 077; head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$SECRET"; umask 022
  TMPD="$RUN/.init-$ENV-$$"; rm -rf "$TMPD"; "$PGBIN/initdb" -D "$TMPD" -U postgres -A scram-sha-256 --pwfile="$SECRET" -E UTF8 --locale=C >"$RUN/initdb-$ENV.log" 2>&1 || { rm -rf "$TMPD"; fail "initdb başarısız (CALISTIRMA/initdb-$ENV.log)"; }; mv "$TMPD" "$PGDATA" || fail "veri dizini devreye alınamadı"   # M05: geçici dizinde kur, tamamlanınca atomik taşı
fi
PGPASS="$(cat "$SECRET")"
if ! "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PGPORT -k '$SOCK' -h 127.0.0.1" -l "$RUN/pg-$ENV.log" -w start >/dev/null 2>&1 || fail "PostgreSQL başlatılamadı (CALISTIRMA/pg-$ENV.log)"; fi
PGURL_ADMIN="postgres://postgres:$PGPASS@127.0.0.1:$PGPORT"
psqla() { PGPASSWORD="$PGPASS" "$PGBIN/psql" -v ON_ERROR_STOP=1 -q -h 127.0.0.1 -p "$PGPORT" -U postgres "$@"; }
ENVFILE="$RUN/.env.$ENV"; LEDGER="$RUN/KURULUM_DEFTERI.json"
if [ ! -f "$ENVFILE" ]; then
  say "İlk çalıştırma: veritabanı, servis hesabı ve sırlar hazırlanıyor…"
  APIPW="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"; SETUP="$(head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  CDB="$(psqla -d postgres -c "CREATE DATABASE hpw_act_$ENV" 2>&1)" || { case "$CDB" in *"already exists"*|*"zaten"*) say "veritabanı zaten var; devam";; *) fail "veritabanı oluşturulamadı: $CDB";; esac; }
  psqla -d postgres -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='hpw_api_$ENV') THEN CREATE ROLE hpw_api_$ENV LOGIN NOBYPASSRLS PASSWORD '$APIPW'; ELSE ALTER ROLE hpw_api_$ENV WITH PASSWORD '$APIPW'; END IF; END \$\$;" >/dev/null || fail "servis hesabı"
  ( cd "$API" && MIGRATE_DATABASE_URL="$PGURL_ADMIN/hpw_act_$ENV" MIGRATIONS_DIR="$APP/db/migrations" "$NODE" dist/src/migrate.js >"$RUN/migrate-$ENV.log" 2>&1 ) || fail "ilk migrasyon (CALISTIRMA/migrate-$ENV.log)"
  psqla -d "hpw_act_$ENV" -c "GRANT hpw_app TO hpw_api_$ENV; GRANT hpw_worker TO hpw_api_$ENV; GRANT USAGE ON SCHEMA public TO hpw_api_$ENV; REVOKE CONNECT ON DATABASE hpw_act_$ENV FROM PUBLIC; GRANT CONNECT ON DATABASE hpw_act_$ENV TO hpw_api_$ENV;" >/dev/null || fail "izinler"
  RDEF="$RUN/RESTORE_DEFTERI.json"
  if [ -f "$RDEF" ] && grep -q '"state":"started"' "$RDEF"; then fail "Önceki demo veri yüklemesi yarım kalmış (CALISTIRMA/RESTORE_DEFTERI.json). Eksik veri tam demo sayılmaz; hiçbir şey silinmez. Teknik operatör: veritabanını yedekleyip boş küme ile yeniden kurun ya da defteri inceleyin."; fi
  if [ "$ENV" = "demo" ] && [ -f "$ROOT/CALISTIRMA/hpw_act_demo.dump" ] && [ ! -f "$RDEF" ]; then say "Sentetik demo verisi yükleniyor (bir kez)…"; printf '{"state":"started","at":"%s"}\n' "$(date -u +%FT%TZ)" > "$RDEF"; PGPASSWORD="$PGPASS" "$PGBIN/pg_restore" -a --disable-triggers -h 127.0.0.1 -p "$PGPORT" -U postgres -d "hpw_act_$ENV" "$ROOT/CALISTIRMA/hpw_act_demo.dump" >"$RUN/restore-demo.log" 2>&1 || fail "demo verisi (CALISTIRMA/restore-demo.log); defter 'started' kaldı"
    # tamamlanma ölçütü: paket manifestindeki satır sayıları (tenant/result/action/evidence) birebir
    OKM=1; for pair in $(cat "$ROOT/CALISTIRMA/demo-manifest.txt" 2>/dev/null); do tbl="${pair%%=*}"; exp="${pair#*=}"; got="$(psqla -d "hpw_act_$ENV" -Atc "SELECT COUNT(*) FROM $tbl" 2>/dev/null)"; [ "$got" = "$exp" ] || { OKM=0; say "eksik: $tbl beklenen $exp bulunan $got"; }; done
    [ "$OKM" = "1" ] || fail "demo verisi manifestle uyuşmuyor; defter 'started' bırakıldı, tam demo sayılmaz"
    # v2.12.1 (pilot): geri yüklemeden sonra planlayıcı istatistikleri yok; ilk büyük sorgular (birim sonuçları, hedef) dakikalar sürüyordu → yükleme bitince ANALYZE
    say "Veritabanı istatistikleri hazırlanıyor…"; psqla -d "hpw_act_$ENV" -c "ANALYZE" >/dev/null 2>&1 || fail "ANALYZE"
    printf '{"state":"done","at":"%s","build":"%s"}\n' "$(date -u +%FT%TZ)" "$BUILD" > "$RDEF"
  elif [ "$ENV" = "demo" ]; then say "Demo verisi defterde tamam; yeniden yüklenmez."; fi
  umask 077
  cat > "$ENVFILE" <<EOT
HPW_ENV=$ENV
PORT=$PORT
HOST=$HOST
DATABASE_URL=postgres://hpw_api_$ENV:$APIPW@127.0.0.1:$PGPORT/hpw_act_$ENV
MIGRATE_DATABASE_URL=$PGURL_ADMIN/hpw_act_$ENV
APP_BASE_URL=$ORIGIN
COOKIE_NAME=hpw_session_$ENV
COOKIE_SECURE=false
SETUP_KEY=$SETUP
HPW_DEMO_DATA=__DEMO_DATA__
HPW_TEST_OPERATOR_MAILBOX=1
EOT
  umask 022
  if [ "$ENV" = "bos" ]; then umask 077; printf '%s\n' "$SETUP" > "$RUN/ILK_KURULUM_ANAHTARI.txt"; umask 022; say "İlk HPW yöneticisi kurulum anahtarı: CALISTIRMA/ILK_KURULUM_ANAHTARI.txt (giriş ekranındaki tek seferlik formda istenir)"; fi
fi
# v2.9.1 (V290-05): MFA sırlarının şifreleme anahtarı; yeni kurulumda üretilir, eski kurulumun ortam dosyasına bir kez eklenir. Değer ekrana ve loglara yazılmaz; CALISTIRMA yedeğiyle birlikte saklanmalıdır.
if ! grep -q '^HPW_MFA_KEY=' "$ENVFILE"; then umask 077; printf 'HPW_MFA_KEY=%s\n' "$(head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n')" >> "$ENVFILE"; umask 022; say "MFA şifreleme anahtarı oluşturuldu (CALISTIRMA/.env.$ENV içinde; bu klasörü yedeklerken birlikte saklayın)."; fi
# her açılışta şema kontrolü/yükseltme (V05): migrasyon defteri SHA-256 ile tekrarlanabilir; veri korunur; başarısızsa sunucu açılmaz
( cd "$API" && MIGRATE_DATABASE_URL="$PGURL_ADMIN/hpw_act_$ENV" MIGRATIONS_DIR="$APP/db/migrations" "$NODE" dist/src/migrate.js >"$RUN/migrate-$ENV.log" 2>&1 ) || fail "migrasyon başarısız; yarım şema üzerinde sunucu açılmaz (CALISTIRMA/migrate-$ENV.log)"
PREVB="$(sed -n 's/.*"build":"\([^"]*\)".*/\1/p' "$LEDGER" 2>/dev/null)"; [ -n "$PREVB" ] && [ "$PREVB" != "$BUILD" ] && say "Verili yükseltme: $PREVB → $BUILD (veri ve sırlar korunur; şema kontrol edildi)"
printf '{"env":"%s","install":"%s","build":"%s","previous_build":"%s","schema":"%s","app_root":"%s","last_start":"%s"}\n' "$ENV" "$INSTALL_ID" "$BUILD" "$PREVB" "$(ls "$APP/db/migrations" | sort | tail -1)" "$APP" "$(date -u +%FT%TZ)" > "$LEDGER"
# 3 uygulama sunucusu (arka planda; log CALISTIRMA/server-<env>.log)
say "Uygulama başlatılıyor: $ORIGIN"
( cd "$API" && HPW_ENV_FILE="$ENVFILE" HPW_BUILD_ID="$BUILD" HPW_INSTALL_ID="$INSTALL_ID" WEB_DIST="$APP/apps/web/dist" MIGRATIONS_DIR="$APP/db/migrations" MAIL_DIR="$RUN/mail-$ENV" nohup "$NODE" "$API/dist/src/server.js" >>"$LOG" 2>&1 & echo "$! $(date +%s)" > "$RUN/server-$ENV.pid" )   # M04: dağıtıma bağlı yollar/build her açılışta; .env yalnız kalıcı sırlar
i=0; R=""; while [ $i -lt 40 ]; do sleep 1; R="$(curl -s -m 3 "$ORIGIN/api/ready" 2>/dev/null)"; case "$R" in *'"ready":true'*'"build":"'"$BUILD"'"'*|*'"build":"'"$BUILD"'"'*'"ready":true'*) break;; esac; i=$((i+1)); done
case "$R" in *'"ready":true'*) case "$R" in *'"build":"'"$BUILD"'"'*) ;; *) fail "portta başka bir sürüm yanıt veriyor: $R";; esac;; *) fail "uygulama hazır değil: ${R:-yanıt yok} (CALISTIRMA/server-$ENV.log)";; esac
say "Hazır. Tarayıcıda index.html açılıyor. Bu pencereyi kapatmayın; kapatınca servis durur (pencereyi kapatmak yerine küçültün)."
open_url "$ROOT/index.html"
# 4 pencere açık kaldığı sürece servis çalışır; kapanınca uygulama ve veritabanı düzgün durdurulur
trap 'say ""; say "Durduruluyor…"; kill "$(cut -d" " -f1 "$RUN/server-$ENV.pid" 2>/dev/null)" 2>/dev/null; "$PGBIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null 2>&1; exit 0' INT TERM HUP
while :; do sleep 60; done
