#!/bin/sh
# Ortam kurulumu: ayrı veritabanı + ayrı servis hesabı (R36) + migrasyon. Kullanım: sh ops/create-env.sh <env: demo|bos> <api_parolasi>
# postgres süper kullanıcısıyla çalışır (MIGRATE_DATABASE_URL için postgres:postgres varsayılanı yalnız yerel geliştirmedir).
set -e
ENV="$1"; PW="$2"; [ -n "$ENV" ] && [ -n "$PW" ] || { echo "kullanım: ops/create-env.sh <demo|bos> <api_parolasi>"; exit 2; }
DB="hpw_act_$ENV"; ROLE="hpw_api_$ENV"
su postgres -c "psql -v ON_ERROR_STOP=1 -q -c \"SELECT 1 FROM pg_database WHERE datname='$DB'\" -tA" | grep -q 1 && { echo "$DB zaten var; sıfırlamak için önce ops/reset-env.sh $ENV"; exit 3; }
su postgres -c "psql -v ON_ERROR_STOP=1 -q -c \"CREATE DATABASE $DB\""
su postgres -c "psql -v ON_ERROR_STOP=1 -q -c \"DO \\\$\\\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='$ROLE') THEN CREATE ROLE $ROLE LOGIN NOBYPASSRLS PASSWORD '$PW'; ELSE ALTER ROLE $ROLE WITH PASSWORD '$PW'; END IF; END \\\$\\\$;\""
cd "$(dirname "$0")/../apps/api" && MIGRATE_DATABASE_URL="postgres://postgres:postgres@localhost:5432/$DB" npx tsx src/migrate.ts
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -c \"GRANT hpw_app TO $ROLE; GRANT hpw_worker TO $ROLE; GRANT USAGE ON SCHEMA public TO $ROLE; REVOKE CONNECT ON DATABASE $DB FROM PUBLIC; GRANT CONNECT ON DATABASE $DB TO $ROLE;\""
# diğer ortamın servis hesabı bu veritabanına bağlanamaz
for other in demo bos test; do [ "$other" = "$ENV" ] && continue; su postgres -c "psql -q -d $DB -c \"REVOKE CONNECT ON DATABASE $DB FROM hpw_api_$other\"" 2>/dev/null || true; done
echo "hazır: $DB / $ROLE"
