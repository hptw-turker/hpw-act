# HPW Act v3.0 sunucu kurulumu: yerel oturuma devir (08.11.2026)

Bu belge, bulut oturumunda hazırlanan HPW Act v3.0 sunucu kurulumunu, sunucuya SSH erişimi olan Mac'teki yerel Claude Code oturumunda sürdürmek içindir. Yerel oturum önce `DEVIR-v3.0.md`, `docs/adr/ADR-0043-sade-hpw-act-v3.md` ve `ops/sunucu/SUNUCU-KURULUMU.md` dosyalarını okur, sonra bu belgeyi uygular. Çelişkide DEVIR-v3.0 ve ADR-0043 geçerlidir; bu belge yalnız kurulumun nereden sürdüğünü ve hangi kaynağın kurulacağını sabitler.

Bulut oturumu sunucuya erişemedi: SSH istemcisi yoktu, dış ağ yalnız izinli alan adlarına giden bir HTTPS vekilinden geçiyordu. Gerçek sunucuda henüz hiçbir işlem yapılmadı.

## 1. Kurulacak kaynak

| | |
|---|---|
| Depo | https://github.com/hptw-turker/hpw-act |
| Kurulacak commit | `9b53f635cf1784057b323713a52bc24506fde9e6` (`main`, "Sunucu kurulumu: build kimliği ve kurulum anahtarı ipucu") |
| Üzerine kurulduğu commit | `11fd5be575f1a62d7b76d6b1df4163b833b24abe` ("HPW Act v3.0.0: sade yol haritası takibi (ADR-0043)") |
| Bu belgenin dalı | `claude/lucid-hawking-6xigat`. Dal kurulacak commit'in üzerine yalnız `docs/kurulum/` ekler; sunucuya bu dalın ucu değil, yukarıdaki commit kurulur. |

`9b53f63` commit'i `11fd5be` üzerine yalnız şu beş dosyayı değiştirir; API ve veritabanı kodu aynıdır (`git diff --stat 11fd5be 9b53f63 -- apps/api packages db` boş):

- `ops/sunucu/docker-compose.yml`: `HPW_BUILD_ID` `.env`'den geçirilir (boşsa `3.0.0`); `/api/ready` yanıtındaki `build` alanı boş gelmez.
- `ops/sunucu/env.example`, `ops/sunucu/SUNUCU-KURULUMU.md`: `HPW_BUILD_ID` satırı ve denetimi. `SUNUCU-KURULUMU.pdf` güncellenmedi; geçerli olan `.md`.
- `apps/web/src/product/v3/Login.tsx`, `apps/web/src/product/i18n/en.json`: ilk kurulum formundaki anahtar açıklaması gerçek yöntemle tutarlı: "Kurulum anahtarı (yerel kurulumda CALISTIRMA/ILK_KURULUM_ANAHTARI.txt dosyasında; sunucuda .env dosyasındaki SETUP_KEY satırında)". Üretilen katalog `tools/i18n/all-keys.json` bu commit'te yenilenmedi; denetim betiği onu her koşuda yeniden üretir, kurulumu etkilemez.

Bu commit bulut oturumunda değil, başka bir oturumda yapıldı (commit iletisindeki oturum bağlantısı). Bulut oturumu kaynak kodda değişiklik yapmadı; yalnız `docs/kurulum/` altını ekledi.

**Build kimliği ile commit aynı tür kimlik değildir.** `6ca59ed2bcf0`, paketleme makinesinde derlenmiş `apps/api/dist`, `apps/web/dist` ve `db/migrations` dosyalarının sha256 özetinin ilk 12 karakteridir (`ops/paketle-v3.sh`). Commit SHA'sı ise kaynak ağacının kimliğidir. `HPW_Act_v3.0.0_6ca59ed2bcf0.zip` bu çalışmada görülmedi; paket ile kaynak arasındaki eşleşme **doğrulanmadı**. Sunucuda imaj kaynaktan yeniden derlenir; çalışan kod commit'in ürünüdür ve paket build kimliğini taşımaz. Zip daha sonra gelirse eşleşme şöyle denetlenir: zip'teki `GELISTIRICI_KAYNAK` ağacı `git archive 11fd5be` çıktısıyla, `ops/paketle-v3.sh` içindeki dışlamalar uygulanarak dosya dosya karşılaştırılır; `KANITLAR/MANIFEST.json` paket içi bütünlüğü gösterir, kaynak commit'ini göstermez.

## 2. Sınırlar

- Tek üretim ortamı; pilot ya da staging kurulmaz.
- `HPW_LEGACY_MODULES=false`, `HPW_MFA_REQUIRED=false`, `TRUST_PROXY=1` compose dosyasında sabittir.
- İmaj özgün `apps/api/Dockerfile` ile olağan biçimde derlenir. Bulut denemesinde kullanılan vekil sertifikası ve türev dosyalar (`Dockerfile.dry`, `ccr-ca.crt`, `docker-compose.override.yml`) depoda yoktur ve sunucuya taşınmaz. Sunucunun ağı görülmeden derlemede TLS sorunu yaşanmayacağı söylenemez: `npm ci` sertifika hatası verirse TLS doğrulaması kapatılmaz, depoya sertifika eklenmez; durum Türker Bey'e bildirilir.
- Sırlar `ops/sunucu/.env` içinde, `chmod 600`. Parola, anahtar ve `.env` içeriği ekrana, loga, sohbete ya da depoya yazılmaz. `.env` ve Docker birimleri (`pgdata`, `caddy_data`) sonraki kurulumlarda korunur; `docker compose down -v` kullanılmaz.
- Müşteri verisi, Ant Yapı Excel'leri, raporlar ve deneme veritabanı sunucuya taşınmaz. Şirket oluşturma, dosya yükleme ve davetleri HPW sorumlusu uygulamadan yapar.
- Alıcı ve gönderim izni verilmeden dışarı e-posta gönderilmez; SMTP yalnız bağlantı ve kimlik doğrulamasıyla denetlenir.
- Sunucudaki başka hizmetler kesintiye uğratılmaz. 80/443 başka bir hizmetteyse durulur ve sorulur. SSH portu doğrulanmadan güvenlik duvarı etkinleştirilmez. Mevcut veri varsa değişiklikten önce yedeklenir.
- Sağlayıcı ve veri barındırma ülkesi HPW'nin kararıdır.

## 3. Aktarım (Mac → sunucu)

Sunucuya yalnız Docker derlemesinin girdileri ve kurulum dosyaları gider (yaklaşık 3,6 MB; belge, sunum ve demo şablonları gitmez):

```sh
# Mac'te, depo klonunda
C=9b53f635cf1784057b323713a52bc24506fde9e6
git fetch origin main claude/lucid-hawking-6xigat && git cat-file -e "$C^{commit}"
git archive --format=tar -o "/tmp/hpw-act-$C.tar" "$C" -- tsconfig.base.json packages/domain-core apps/api apps/web db/migrations ops/sunucu ops/docker
git get-tar-commit-id < "/tmp/hpw-act-$C.tar"      # $C yazmalı
tar -tf "/tmp/hpw-act-$C.tar" | grep -ic antyapi  # 0 olmalı
shasum -a 256 "/tmp/hpw-act-$C.tar"
scp "/tmp/hpw-act-$C.tar" docs/kurulum/kapali-modul-denetimi/sema-ornek.mjs docs/kurulum/kapali-modul-denetimi/gonder.py KULLANICI@SUNUCU:/tmp/
```

Sunucuda: `sha256sum /tmp/hpw-act-$C.tar` Mac'teki değerle aynı olmalı. `/opt/hpw-act` varsa önce içeriğine bakılır (bölüm 4). Sonra:

```sh
sudo mkdir -p /opt/hpw-act && sudo chown "$USER" /opt/hpw-act
tar -xf "/tmp/hpw-act-$C.tar" -C /opt/hpw-act
echo "$C" > /opt/hpw-act/KAYNAK_COMMIT
```

Arşiv `ops/sunucu/.env` ve `ops/sunucu/yedekler` içermez; güncellemede bunlar korunur. Bulut oturumunda aynı komutla üretilen arşivde Dockerfile'ın 18 `COPY` kaynağının hepsi ve `ops/docker/init-roles.sh` vardı, tar başlığı commit'i taşıyordu. Arşivin sha256 değeri git sürümüne göre değişebilir; bağlayıcı olan tar başlığındaki commit kimliğidir.

## 4. Kurulum sırası

`ops/sunucu/SUNUCU-KURULUMU.md` adımları sunucuya uyarlanarak uygulanır:

1. **Ön inceleme (değişiklik yapmadan):** `lsb_release -a`, `nproc`, `free -h`, `df -h /`, `timedatectl`, `sudo ss -ltnp` (80/443 kimde), `docker ps -a` ve `docker volume ls` (varsa), `ls -la /opt/hpw-act`, `sudo ufw status verbose`, `sudo sshd -T | grep -iE '^(port|listenaddress) '`. 80/443 başka hizmetteyse durulur.
2. **Yedek:** mevcut HPW Act verisi varsa `cd /opt/hpw-act/ops/sunucu && ./yedekle.sh` ve `.env` kopyası (600). Başka hizmetlerin verisine dokunulmaz.
3. **Docker:** yoksa talimattaki gibi kurulur; `docker compose version` denetlenir.
4. **Güvenlik duvarı:** önce gerçek SSH portu izinli kural olarak eklenir (port 22 değilse `sudo ufw allow <port>/tcp`), sonra 80 ve 443; ufw zaten açıksa mevcut kurallar silinmez. Etkinleştirmeden önce `sudo ufw show added` incelenir.
5. **`.env`:** yalnız yoksa `env.example`'dan üretilir; sırlar talimattaki `openssl rand` satırıyla üretilir. `HPW_BUILD_ID=9b53f635cf1784057b323713a52bc24506fde9e6`, `DOMAIN`, `MAIL_FROM` ve `SMTP_URL` (kullanıcı adı ve sunucu verilen bilgiden) yazılır. SMTP parolası sohbete yazılmaz: Türker Bey `.env` içine kendisi girer ya da yalnız onun okuyabileceği bir dosyaya koyar ve değer ekrana basılmadan oradan aktarılır. `grep -c '=$' .env` 0.
6. **Başlatma:** `docker compose up -d --build`; `docker compose logs api` içinde 24 migrasyon ve `HPW Act API [production] :8787`.
7. **İlk HPW yöneticisi:** Türker Bey aksini söylemedikçe parola sunucuda rastgele üretilir ve `/root/hpw-act-ilk-yonetici.txt` dosyasına (root, 600) yazılır; ekrana basılmaz. Kurulum `https://ALAN_ADI/api/platform/bootstrap` ucuna sunucudan, anahtar ve parola dosyadan okunarak yapılır. Ardından giriş ve `GET /api/platform/tenants` denenir; oturum çerezi dosyası işten sonra silinir ve oturum kapatılır. Şirketler ekranı tarayıcıda açılarak "Yeni şirket" düğmesi görülür (Mac'te Playwright varsa ekran görüntüsü, yoksa Türker Bey'in gözüyle).
8. **Yedek ve zamanlama:** `./yedekle.sh` bir kez çalıştırılır, döküm `pg_restore --list` ile okunur; talimattaki cron satırı eklenir. Cron sunucunun yerel saatiyle çalışır: kayıtta `timedatectl` saat dilimi ve yedek saatinin Türkiye saati (TSİ, UTC+3) karşılığı açıkça yazılır. Sunucunun saat dilimi sorulmadan değiştirilmez. `yedekle.sh` `.env` dosyasını yedeklemez; `.env` kopyasının sunucu dışında nerede tutulacağı HPW'nin kararıdır.

## 5. Kurulumu tamamlayan denetimler

| Denetim | Nasıl |
|---|---|
| Servisler çalışıyor, yeniden başlatma döngüsü yok | `docker compose ps`; birkaç dakika sonra `docker inspect -f '{{.Name}} {{.RestartCount}} {{.State.Status}}' $(docker compose ps -q)` |
| Migrasyonlar tamam | API logu ve `/api/ready` yanıtında `schema` = `expectedSchema` = `0024_v300_sade_yol_haritasi.sql` |
| Hazır | `curl -s https://ALAN_ADI/api/ready` → `ready:true`, `version:"3.0.0"`, `build` = kurulan commit |
| v3 kipi | `curl -s https://ALAN_ADI/api/public/app` → `{"mode":"v3"}` |
| HTTPS | `curl -sv https://ALAN_ADI/ -o /dev/null` (sistem CA ile, `-k` olmadan); `openssl s_client -connect ALAN_ADI:443 -servername ALAN_ADI </dev/null 2>/dev/null \| openssl x509 -noout -issuer -enddate` |
| İlk yönetici ve giriş | bölüm 4 adım 7: kurulum 200, ikinci deneme 409, giriş 200 |
| Şirketler ekranı | `GET /api/platform/tenants` 200 ve ekranda "Yeni şirket" |
| Kapalı modüller | `ops/sunucu` içinde: `docker compose cp /tmp/sema-ornek.mjs api:/tmp/sema-ornek.mjs && docker compose exec -T api node /tmp/sema-ornek.mjs > /tmp/ornekler.jsonl && python3 -I /tmp/gonder.py /tmp/ornekler.jsonl https://ALAN_ADI > /tmp/kapali-modul-sonuc.tsv`. 66 isteğin hepsi `404 module_disabled` olmalı (çıkış 0). 400 dönen istek kapı denetimi sayılmaz. Sunucu kendi alan adına ulaşamıyorsa `ornekler.jsonl` Mac'e alınıp `gonder.py` oradan çalıştırılır. |
| Yedek | `./yedekle.sh` çıktısı, `pg_restore --list` tablo verisi sayısı, `crontab -l` |
| SMTP | gönderimsiz doğrulama: `docker compose exec -T api node -e "import('nodemailer').then(m=>m.default.createTransport(process.env.SMTP_URL).verify()).then(()=>console.log('SMTP bağlantı ve kimlik doğrulaması tamam'),e=>{console.log('SMTP hatası:',e.code,e.responseCode);process.exit(1)})"`. Hata iletisinin tamamı basılmaz. Gerçek gönderim yalnız izin ve alıcı verilirse. |

## 6. Kurulum kaydı

Kurulum sonunda sunucuda `/opt/hpw-act/KURULUM-KAYDI.md` yazılır (sır içermez, 644). Değerler komutlarla alınır:

```sh
cd /opt/hpw-act/ops/sunucu
cat /opt/hpw-act/KAYNAK_COMMIT                                          # kaynak commit (tam)
docker image inspect sunucu-api --format '{{.Id}} {{.Created}}'          # derlenen imaj
docker inspect -f '{{.Image}}' "$(docker compose ps -q api)"            # çalışan konteynerin imajı; üsttekiyle aynı olmalı
docker image inspect postgres:16 caddy:2 --format '{{.RepoTags}} {{.Id}} {{.RepoDigests}}'
curl -s https://ALAN_ADI/api/ready
timedatectl | grep -i 'time zone'; crontab -l | grep yedekle
```

Kaydın alanları: tarih (UTC ve TSİ); sunucu ve alan adı; kaynak depo ve tam commit; `/tmp/hpw-act-<commit>.tar` sha256; imaj kimliği ve çalışan konteynerin imaj kimliği; postgres ve caddy imaj kimlikleri; `/api/ready` yanıtı (`build` alanının paket build kimliği değil, kaynak commit'i olduğu notuyla); sertifika sağlayıcısı ve bitiş tarihi; yedek saati, sunucu saat dilimi ve TSİ karşılığı; yapılan değişiklikler (dosya ve neden); çalıştırılan denetimler ve sonuçları; tamamlanamayan işler ve nedenleri. Kaydın bir kopyası daha sonra depoya `docs/kurulum/` altına eklenebilir.

## 7. Bulut denemesinde doğrulananlar

Deneme bu oturumun konteynerinde yapıldı: `localhost`, Caddy'nin iç sertifikası, SMTP boş, sırlar atılmak üzere üretildi ve silindi. İmaj (`sunucu-api`, c9a168a811e2) `11fd5be` kaynağından, bu ortamın TLS vekili yüzünden yalnız derleme aşamasına vekil sertifikası eklenmiş türev bir Dockerfile ile derlendi. API ve veritabanı kodu `9b53f63` ile aynı olduğu için API sonuçları kurulacak commit için de geçerlidir.

Doğrulananlar: 24 migrasyon uygulandı; `/api/ready` `ready:true`, `version:"3.0.0"` (build boş; `9b53f63` öncesi); `/api/public/app` `{"mode":"v3"}`; HTTP istekleri 308 ile HTTPS'e yönlendi; HSTS, nosniff ve referrer başlıkları geldi; ilk kurulum formu tarayıcıda açıldı, yanlış anahtar 403, doğru anahtar 200, ikinci deneme 409; girişten sonra Şirketler ekranı ve "Yeni şirket" düğmesi göründü; `yedekle.sh` döküm aldı, döküm ayrı bir veritabanına `pg_restore` ile geri yüklendi; API yeniden başlatma ve yığın kapatıp açma sonrasında veri korundu; yeniden başlatma sayısı 0.

**Kapalı modüller (düzeltilmiş sonuç).** Kapalı dört rota modülünde (`analysis`, `corporate`, `ai`, `roadmap`) 66 rota-yöntem çifti var, hepsi `/api/t/` altında.

- İlk turda istekler oturumsuz, POST'lar boş `{}` gövdeyle gönderildi: 34 istek `404 module_disabled` döndü ve doğrulanmış sayılır. 32 istek `400 invalid_request` döndü: gövde doğrulamasında takıldılar, kapalı modül kapısına ulaşmadılar; bunlar kapı denetimi olarak **sayılmaz**.
- İkinci turda (`kapali-modul-denetimi/`): rota şemaları çalışan imajdaki derlenmiş koddan çıkarıldı, her rota için şemaya uyan params, sorgu ve gövde üretildi ve Ajv ile önceden doğrulandı (66/66). İstekler Caddy üzerinden oturumsuz gönderildi: 66/66 `404 module_disabled` (gövde şemalı 34, gövdesiz 32). İlk turda 400 dönen 32 istek bu turda kapıya ulaştı ve 404 döndü. Ayrıntı: `kapali-modul-denetimi/sonuc-2026-11-08-bulut-deneme.tsv`.
- Oturumlu kullanıcı yolu yalnız kaynaktan incelendi, oturumlu şirket kullanıcısıyla denenmedi. `server.ts` içinde kapı bir `preHandler` kancasıdır. Ondan önce yalnız oturum yükleme (`onRequest`), HPW personeli MFA kapısı, HPW yetki denetimi ve tekrar-önleme (`Idempotency-Key`) kancaları çalışır. Kapalı modül dosyalarında rota düzeyinde kanca yoktur, işleyiciye kapıdan önce ulaşılmaz. Şirket üyesi olmayan HPW personeli ilk turda yetki kancasında 403 aldı. Not: oturumlu bir kullanıcı `Idempotency-Key` ile POST gönderirse tekrar-önleme kancası kapıdan önce bir rezervasyon kaydı yazar; iş etkisi yoktur.

**`9b53f63` için dar denetimler:** `docker compose config` (yer tutucu değerlerle) özgün `apps/api/Dockerfile`'ı, `HPW_BUILD_ID`'nin `.env`'den okunduğunu ve boşsa `3.0.0` olduğunu gösterdi; `node tools/tests/fe/i18n-coverage.mjs` çıkış 0 (eksik çeviri 0, İngilizcede Türkçe harf 0); `VITE_APP_ONLY=1 vite build` geçti ve yeni açıklama derlenmiş pakette var. `9b53f63` Docker'da derlenmedi. Bölüm 5'teki SMTP denetim komutu bu imajda ağsız ve yer tutucu adresle denendi: `nodemailer` üretim imajında var, hata yalnız kodla basıldı (`ESOCKET`), gönderim yapılmadı.

**Denenmeyenler:** gerçek Let's Encrypt sertifikası, SMTP, sunucuya özgü durum (port kullanımı, güvenlik duvarı, mevcut veri, sunucunun dış ağ ve TLS durumu), oturumlu şirket kullanıcısıyla kapalı modül isteği.

## 8. Yerel oturuma verilecek başlangıç iletisi

> HPW Act v3.0 sunucu kurulumunu sürdür. Depo: https://github.com/hptw-turker/hpw-act. Önce `claude/lucid-hawking-6xigat` dalını al ve `DEVIR-v3.0.md`, `docs/adr/ADR-0043-sade-hpw-act-v3.md`, `ops/sunucu/SUNUCU-KURULUMU.md` ve `docs/kurulum/SUNUCU-KURULUMU-DEVIR-2026-11-08.md` dosyalarını oku. Kurulacak kaynak `9b53f635cf1784057b323713a52bc24506fde9e6`. Sunucu: `<kullanıcı>@<IP>`, SSH anahtarla. Alan adı: `<alan adı>`. SMTP: `<sunucu>:<port>`, kullanıcı `<kullanıcı>`, gönderen `<adres>`; parolayı `.env` içine ben gireceğim. İlk HPW yöneticisi: `<e-posta>`. Devir belgesindeki sınırlara uy, sonunda kurulum kaydını yaz ve teslimi kısa bildir.

Bulut oturumunun konuşma geçmişi de gerekirse Mac'te depo klonunun içinde `claude --teleport` ile yerel terminale alınabilir; kurulum için bu belge yeterlidir.
