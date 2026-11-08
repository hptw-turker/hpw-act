#!/bin/sh
# PostgreSQL container ilk kurulumunda (docker-entrypoint-initdb.d): uygulama grup rolleri migrasyonla gelir; servis LOGIN hesabı burada oluşturulur.
# HPW_ENV ve HPW_API_PASSWORD container ortamından gelir; parola dosyaya/imaja yazılmaz.
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='hpw_api_${HPW_ENV}') THEN CREATE ROLE hpw_api_${HPW_ENV} LOGIN NOBYPASSRLS PASSWORD '${HPW_API_PASSWORD}'; END IF; END \$\$;
SQL
# hpw_app/hpw_worker üyelikleri migrasyon (0001/0002) rolleri yarattıktan sonra api container'ının ilk açılışında verilir (bkz. ops/docker/grant-after-migrate.sql)
