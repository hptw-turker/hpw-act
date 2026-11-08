#!/bin/sh
# YIKICI: ortam veritabanını siler. Yalnız demo ya da bos; açık onay ister; diğer ortama dokunmaz.
ENV="$1"; case "$ENV" in demo|bos) ;; *) echo "yalnız demo ya da bos sıfırlanır"; exit 2;; esac
[ "$CONFIRM_RESET" = "$ENV" ] || { echo "onay gerekli: CONFIRM_RESET=$ENV sh ops/reset-env.sh $ENV"; exit 2; }
su postgres -c "psql -q -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='hpw_act_$ENV'\" -c \"DROP DATABASE IF EXISTS hpw_act_$ENV\"" >/dev/null && rm -rf "$(dirname "$0")/../apps/api/var/mail-$ENV" && echo "hpw_act_$ENV silindi (posta dizini dahil)"
