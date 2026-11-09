#!/bin/sh
# Günlük yedek: veritabanının tam dökümü ve (v3.1.0) adım kayıtlarına eklenen dosyaların arşivi. Örnek cron (her gece 03:15): 15 3 * * * cd /opt/hpw-act/ops/sunucu && ./yedekle.sh
set -e; cd "$(dirname "$0")"; mkdir -p yedekler
F="yedekler/hpw_act_$(date +%Y%m%d_%H%M).dump"
docker compose exec -T db pg_dump -U postgres -Fc hpw_act > "$F"
# dosya deposu: veritabanı dökümüyle aynı damga; geri yükleme ikisi birlikte yapılır (SUNUCU-KURULUMU.md §8)
G="yedekler/hpw_act_dosyalar_$(basename "$F" .dump | sed 's/^hpw_act_//').tar.gz"
docker compose exec -T api sh -c 'mkdir -p /data/files && tar -C /data/files -czf - .' > "$G"
find yedekler -name 'hpw_act_*.dump' -mtime +30 -delete
find yedekler -name 'hpw_act_dosyalar_*.tar.gz' -mtime +30 -delete
echo "yedek: $F ($(du -h "$F" | cut -f1)), dosyalar: $G ($(du -h "$G" | cut -f1))"
