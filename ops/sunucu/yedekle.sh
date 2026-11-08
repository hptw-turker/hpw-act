#!/bin/sh
# Günlük yedek: veritabanının tam dökümü. Örnek cron (her gece 03:15): 15 3 * * * cd /opt/hpw-act/ops/sunucu && ./yedekle.sh
set -e; cd "$(dirname "$0")"; mkdir -p yedekler
F="yedekler/hpw_act_$(date +%Y%m%d_%H%M).dump"
docker compose exec -T db pg_dump -U postgres -Fc hpw_act > "$F"
find yedekler -name 'hpw_act_*.dump' -mtime +30 -delete
echo "yedek: $F ($(du -h "$F" | cut -f1))"
