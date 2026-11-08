# HPW Act v3.0 — sunucuya kurulum (Claude Code için talimat)

Bu belge, HPW Act'i bir Linux sunucusuna Claude Code ile kurmak içindir. Claude Code bu dosyayı baştan sona okuyup adımları sırayla uygular; her adımın sonundaki denetim geçmeden bir sonrakine geçmez. Hesaplar, alan adı, DNS ve SMTP bilgileri Happy Place to Work tarafından verilir. Verinin hangi ülkede ve hangi sağlayıcıda tutulacağı (KVKK) Happy Place to Work'ün kararıdır; Claude Code bu kararı vermez, verilen sunucuya kurar.

## 0. Önce Happy Place to Work'ten alınacaklar

1. Sunucu: Ubuntu 22.04 ya da 24.04, en az 2 vCPU, 4 GB bellek, 40 GB disk; SSH erişimi (kullanıcı adı ve anahtar).
2. Alan adı: örneğin `act.happyplacetowork.com.tr`. DNS'te bu ad için sunucunun IP adresini gösteren bir A kaydı açılmış olmalı.
3. E-posta gönderimi için SMTP bilgisi (sunucu, port, kullanıcı, parola) ve doğrulanmış gönderen adresi. Bu olmadan davet e-postaları gitmez.
4. İlk HPW yöneticisinin e-postası (giriş ekranında tek seferlik formla kurulur).

## 1. Sunucuyu hazırla

```sh
sudo apt-get update && sudo apt-get install -y ca-certificates curl git ufw
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # oturumu kapatıp yeniden açın
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw --force enable
```

Denetim: `docker compose version` bir sürüm yazar; `sudo ufw status` 22, 80, 443 portlarını açık gösterir.

## 2. Kaynağı sunucuya koy

Teslim paketindeki `GELISTIRICI_KAYNAK` klasörünü sunucuda `/opt/hpw-act` altına kopyalayın (scp ya da git). Bu klasörde müşteri verisi yoktur.

```sh
sudo mkdir -p /opt/hpw-act && sudo chown "$USER" /opt/hpw-act
# yerel bilgisayardan: scp -r GELISTIRICI_KAYNAK/* kullanici@sunucu:/opt/hpw-act/
```

Denetim: `/opt/hpw-act/apps/api/Dockerfile` ve `/opt/hpw-act/ops/sunucu/docker-compose.yml` var.

## 3. Sırları üret ve .env dosyasını yaz

```sh
cd /opt/hpw-act/ops/sunucu
cp env.example .env && chmod 600 .env
r() { openssl rand -base64 32 | tr '+/' '-_' | tr -d '='; }
sed -i "s|^PG_PASSWORD=.*|PG_PASSWORD=$(r)|; s|^API_DB_PASSWORD=.*|API_DB_PASSWORD=$(r)|; s|^SETUP_KEY=.*|SETUP_KEY=$(r)|; s|^HPW_MFA_KEY=.*|HPW_MFA_KEY=$(r)|" .env
```

Sonra `.env` içinde `HPW_BUILD_ID` satırına kurulan sürümün kimliğini (depo commit kısaltması ya da paket build kimliği) yazın; `DOMAIN`, `SMTP_URL` ve `MAIL_FROM` satırlarını Happy Place to Work'ün verdiği değerlerle doldurun. `.env` dosyası ekrana, loga, e-postaya ya da depoya konmaz; sunucuda kalır ve yedeklenir.

Denetim: `grep -c '=$' .env` sonucu 0 (boş değer kalmadı).

## 4. Başlat

```sh
cd /opt/hpw-act/ops/sunucu
docker compose up -d --build
docker compose logs -f api   # "HPW Act API [production] :8787" satırı görünene kadar bekleyin, Ctrl+C ile çıkın
```

İlk açılışta veritabanı şeması kurulur. Yapılandırmada eksik ya da güvensiz bir değer varsa sunucu açılmaz ve logda nedenini yazar (örneğin `APP_BASE_URL https olmalı`); nedeni düzeltip `docker compose up -d` ile yeniden başlatın.

## 5. HTTPS ve hazır olma denetimi

```sh
curl -s https://ALAN_ADI/api/ready
curl -s https://ALAN_ADI/api/public/app
```

Beklenen: ilki `"ready":true`, `"version":"3.0.0"` ve `.env` içindeki `"build"` değerini içerir; ikincisi `{"mode":"v3"}` döner. Sertifika ilk istekte birkaç saniye içinde alınır; alınamazsa DNS A kaydını ve 80/443 portlarını denetleyin.

## 6. İlk HPW yöneticisi

1. Tarayıcıda `https://ALAN_ADI` açın. Giriş ekranı "İlk kurulum · HPW yöneticisi" formunu gösterir.
2. E-posta, ad soyad ve parolayı yazın. "Kurulum anahtarı" alanına sunucuda `grep SETUP_KEY .env` ile görünen değeri yapıştırın.
3. Form bir kez çalışır; ikinci deneme reddedilir. Sonra aynı e-posta ve parolayla giriş yapın; "Şirketler" ekranı açılır.

Denetim: "Şirketler" ekranında "Yeni şirket" düğmesi görünür.

## 7. Bir şirketi açmak (Happy Place to Work sorumlusu yapar)

Şirketler → Yeni şirket (kod, ad, İK yöneticisinin adı ve e-postası) → Kurulum ekranında üç dosya sırayla: organizasyon, yol haritası, kullanıcılar → "Bekleyen davetleri gönder". Şirketin giriş adresi `https://ALAN_ADI/g/<ŞİRKET KODU>` biçimindedir ve Kurulum ekranının altında yazar.

## 8. Yedek

```sh
cd /opt/hpw-act/ops/sunucu && ./yedekle.sh
( crontab -l 2>/dev/null; echo "15 3 * * * cd /opt/hpw-act/ops/sunucu && ./yedekle.sh >> yedekler/yedek.log 2>&1" ) | crontab -
```

Yedekler `ops/sunucu/yedekler` altında 30 gün tutulur. Sunucu dışına (Happy Place to Work'ün seçtiği depoya) ayrıca kopyalanmalıdır. `.env` dosyası da yedeğin parçasıdır; o olmadan yedek açılır ama oturum ve şifreleme anahtarları yeniden üretilmek zorunda kalır.

Geri yükleme (boş bir kuruluma): `docker compose exec -T db pg_restore -U postgres -d hpw_act --clean --if-exists < yedekler/DOSYA.dump` ve ardından `docker compose restart api`.

## 9. Güncelleme

Yeni sürümün `GELISTIRICI_KAYNAK` içeriğini `/opt/hpw-act` üzerine kopyalayın (`ops/sunucu/.env` ve `ops/sunucu/yedekler` korunur), önce `./yedekle.sh`, sonra `docker compose up -d --build`. Şema her açılışta denetlenir ve gerekiyorsa veriyi koruyarak yükseltilir; yükseltme başarısız olursa sunucu açılmaz, eski yedekten geri dönülür.

## Bilinmesi gerekenler

- Kapalı modüller (yerel hedef, aksiyon kütüphanesi, kanıt, dikkat kuyruğu, yapay zekâ planı, v2.15 yol haritası formu) kodda durur ama bu kurulumda kapalıdır: uçları 404 döner, ekranlarda görünmez (`HPW_LEGACY_MODULES=false`).
- İki adımlı doğrulama kapalıdır (`HPW_MFA_REQUIRED=false`). Parola kuralları, oturum süresi ve giriş denemesi sınırı açıktır. Hız sınırı gerçek istemci adresine göre çalışsın diye `TRUST_PROXY=1` (Caddy tek vekil) ayarlıdır.
- Yapay zekâ bağlantı noktası kodda korunur, bu sürümde kapalıdır (ADR-0043, R-02).
- Bu derlemenin geliştirme ortamında Docker yoktu; `docker compose` dosyası çalıştırılarak denenmedi. Aynı uygulama paketi yerel başlatıcıyla ve gerçek PostgreSQL ile uçtan uca denendi. Bu nedenle 4–6. adımların denetimleri atlanmamalıdır.
