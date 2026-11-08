#!/usr/bin/env bash
# HPW Act — sunucu ön incelemesi (SALT OKUNUR).
# Hiçbir dosyayı, hizmeti, güvenlik duvarını, konteyneri ya da birimi değiştirmez; paket kurmaz.
# Sır basmaz: .env değerleri, konteyner ortam değişkenleri, süreç argümanları, crontab ve yapılandırma içerikleri yazdırılmaz.
# Mac'ten kullanım:  ssh talenthub-prod 'bash -s' < docs/kurulum/sunucu-inceleme-saltokunur.sh | tee ~/Desktop/hpw-sunucu-inceleme.txt
export LC_ALL=C
set +e
H() { printf '\n===== %s =====\n' "$1"; }
has() { command -v "$1" >/dev/null 2>&1; }
# root değilse sudo yalnız parolasız çalışırsa kullanılır; parola istenirse komut atlanır
S() { if [ "$(id -u)" = 0 ]; then "$@"; elif sudo -n true 2>/dev/null; then sudo -n "$@"; else echo "(yetki gerekli, atlandı: $1)"; return 0; fi; }
DOMAIN_ADI="${DOMAIN_ADI:-acterix.com.tr}"

H "Kimlik"
echo "kullanici=$(whoami) uid=$(id -u) host=$(hostname -f 2>/dev/null || hostname) zaman_utc=$(date -u +%FT%TZ)"
uptime

H "Sistem"
. /etc/os-release 2>/dev/null && echo "isletim_sistemi=$PRETTY_NAME"
echo "cpu=$(nproc)"; free -h | sed -n 1,2p
df -h / /opt /var/lib/docker 2>/dev/null | awk 'NR==1 || !seen[$0]++'
timedatectl 2>/dev/null | grep -E 'Time zone|NTP service|synchronized' || date +'saat_dilimi=%Z %z'
echo "systemd_durumu=$(systemctl is-system-running 2>/dev/null)"

H "Ag arayuzleri ve genel adres"
ip -br addr 2>/dev/null | grep -v '^lo'
has curl && { echo "genel_ipv4=$(curl -4s -m 8 https://ifconfig.co 2>/dev/null || echo yok)"; echo "genel_ipv6=$(curl -6s -m 8 https://ifconfig.co 2>/dev/null || echo yok)"; }

H "Dinlenen TCP portlari (surec adi)"
S ss -Hltnp 2>/dev/null | awk '{ split($6,a,"\""); printf "%-28s %s\n", $4, (a[2]==""?"?":a[2]) }' | sort -u

H "SSH ve erisim kisitlari (yalniz okunur)"
S sshd -T 2>/dev/null | grep -iE '^(port|listenaddress|permitrootlogin|passwordauthentication|pubkeyauthentication|allowusers|allowgroups|maxauthtries) '
if has ufw; then S ufw status verbose; else echo "ufw yok"; fi
has firewall-cmd && echo "firewalld=$(systemctl is-active firewalld 2>/dev/null)"
has fail2ban-client && S fail2ban-client status 2>/dev/null | sed -n 1,3p
echo "nftables=$(systemctl is-active nftables 2>/dev/null) iptables_kural_sayisi=$(S iptables -S 2>/dev/null | wc -l)"

H "Calisan hizmetler (web/vekil/veritabani/panel)"
for s in nginx apache2 httpd caddy traefik haproxy postgresql mysql mariadb redis-server docker containerd; do st=$(systemctl is-active "$s" 2>/dev/null); [ "$st" = "active" ] && echo "$s: active ($(systemctl is-enabled "$s" 2>/dev/null))"; done
for p in /usr/local/psa /usr/local/cpanel /usr/local/CyberCP /www/server/panel /etc/webmin; do [ -e "$p" ] && echo "panel_izi: $p"; done
if has nginx; then echo "-- nginx site adlari ve dinleme satirlari (icerik degil):"; S nginx -T 2>/dev/null | grep -E '^\s*(server_name|listen)\s' | sed 's/^\s*//' | sort | uniq -c | head -40; fi
if [ -f /etc/caddy/Caddyfile ]; then echo "-- host Caddyfile site adresleri:"; grep -E '^[^#[:space:]].*\{\s*$' /etc/caddy/Caddyfile | head -20; fi

H "Docker"
if has docker; then
  echo "docker_sunucu=$(S docker version --format '{{.Server.Version}}' 2>/dev/null) compose=$(S docker compose version --short 2>/dev/null) acilista=$(systemctl is-enabled docker 2>/dev/null)"
  echo "-- konteynerler:"; S docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null
  echo "-- yeniden baslatma politikasi:"; for c in $(S docker ps -aq 2>/dev/null); do S docker inspect -f '{{.Name}} {{.HostConfig.RestartPolicy.Name}} label_proje={{index .Config.Labels "com.docker.compose.project"}} dizin={{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$c" 2>/dev/null; done
  echo "-- compose projeleri:"; S docker compose ls -a 2>/dev/null
  echo "-- birimler:"; S docker volume ls --format '{{.Name}}' 2>/dev/null
  echo "-- aglar:"; S docker network ls --format '{{.Name}}\t{{.Driver}}' 2>/dev/null
  echo "-- disk:"; S docker system df 2>/dev/null
  echo "-- imajlar (hpw/sunucu/postgres/caddy):"; S docker images --format '{{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}' 2>/dev/null | grep -iE 'hpw|sunucu|postgres|caddy' | head
else echo "docker kurulu degil"; fi

H "HPW Act izleri"
ls -la /opt 2>/dev/null
for d in /opt/hpw-act /srv/hpw-act /root/hpw-act /home/*/hpw-act /var/www/hpw-act; do
  [ -d "$d" ] || continue; echo "-- dizin: $d"
  [ -f "$d/KAYNAK_COMMIT" ] && echo "KAYNAK_COMMIT=$(cat "$d/KAYNAK_COMMIT")"
  [ -d "$d/.git" ] && echo "git_HEAD=$(git -C "$d" rev-parse HEAD 2>/dev/null) degisiklik=$(git -C "$d" status --short 2>/dev/null | wc -l)"
  for f in apps/api/Dockerfile ops/sunucu/docker-compose.yml ops/sunucu/Caddyfile ops/docker/init-roles.sh DEVIR-v3.0.md OKU-BENI.md; do [ -e "$d/$f" ] && echo "var: $f"; done
  grep -q 'HPW_BUILD_ID' "$d/ops/sunucu/docker-compose.yml" 2>/dev/null && echo "compose HPW_BUILD_ID satiri var (9b53f63 ve sonrasi)" || echo "compose HPW_BUILD_ID satiri yok (9b53f63 oncesi ya da farkli)"
  E="$d/ops/sunucu/.env"
  if [ -f "$E" ]; then
    echo ".env: $(stat -c '%a %U:%G' "$E") satir=$(grep -c '' "$E")"
    echo "-- .env anahtarlari (degerler basilmaz):"; awk -F= '/^[A-Z_][A-Z0-9_]*=/{ v=substr($0,index($0,"=")+1); print "  "$1" "(v==""?"(bos)":"(dolu)") }' "$E"
    grep -E '^(DOMAIN|HPW_BUILD_ID)=' "$E" | sed 's/^/  deger: /'
  else echo ".env yok"; fi
  [ -d "$d/ops/sunucu/yedekler" ] && echo "yedek_sayisi=$(ls "$d/ops/sunucu/yedekler"/hpw_act_*.dump 2>/dev/null | wc -l) son=$(ls -t "$d/ops/sunucu/yedekler"/hpw_act_*.dump 2>/dev/null | head -1)"
done

H "Zamanlanmis isler (icerik basilmaz)"
echo "kullanici_crontab_satir=$(crontab -l 2>/dev/null | grep -cvE '^\s*(#|$)') hpw_yedek_satiri=$(crontab -l 2>/dev/null | grep -c 'yedekle.sh')"
echo "root_crontab_hpw_yedek_satiri=$(S crontab -l -u root 2>/dev/null | grep -c 'yedekle.sh')"
ls /etc/cron.d 2>/dev/null | sed 's/^/cron.d: /'

H "Alan adi ($DOMAIN_ADI)"
getent ahosts "$DOMAIN_ADI" 2>/dev/null | awk '{print $1}' | sort -u | sed 's/^/cozumlenen: /' || true
if has dig; then for t in NS A AAAA CAA; do echo "$t: $(dig +short "$t" "$DOMAIN_ADI" 2>/dev/null | tr '\n' ' ')"; done; else echo "dig yok"; fi

H "Derleme icin dis erisim ve TLS (yalniz okuma istegi)"
for u in registry.npmjs.org registry-1.docker.io production.cloudflare.docker.com acme-v02.api.letsencrypt.org; do
  code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "https://$u/" 2>/dev/null)
  iss=$(echo | openssl s_client -connect "$u:443" -servername "$u" 2>/dev/null | openssl x509 -noout -issuer 2>/dev/null | sed 's/^issuer=//')
  echo "$u http=$code sertifika_veren=${iss:-?}"
done

H "Bitti"
echo "Bu cikti sir icermemelidir; paylasmadan once gozden gecirin."
