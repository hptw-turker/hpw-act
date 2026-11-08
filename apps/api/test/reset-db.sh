#!/bin/sh
# Test veritabanını sıfırdan kurar (R38): yalnız adı _test ile biten DB, yalnız ALLOW_DB_RESET=1 ile; uygulama DB'leri (hpw_act_demo, hpw_act_bos) asla silinmez.
DB="${TEST_DB:-hpw_act_test}"
case "$DB" in *_test) ;; *) echo "reddedildi: yalnız *_test veritabanı sıfırlanır ($DB)"; exit 2;; esac
[ "$ALLOW_DB_RESET" = "1" ] || { echo "reddedildi: ALLOW_DB_RESET=1 gerekli"; exit 2; }
su postgres -c "psql -q -c 'DROP DATABASE IF EXISTS $DB;' -c 'CREATE DATABASE $DB;'" >/dev/null && MIGRATE_DATABASE_URL="postgres://postgres:postgres@localhost:5432/$DB" npx tsx src/migrate.ts && su postgres -c "psql -q -d $DB -c 'GRANT hpw_app TO hpw_api; GRANT hpw_worker TO hpw_api; GRANT USAGE ON SCHEMA public TO hpw_api;'" >/dev/null
