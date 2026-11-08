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

**Build kimliği ile commit aynı tür kimlik değildir.** `6ca59ed2bcf0`, paketleme makinesinde derlenmiş `apps/api/dist`, `apps/web/dist` ve `db/migrations` dosyalarının sha256 özetinin ilk 12 karakteridir (`ops/paketle-v3.sh`). Commit SHA'sı ise kaynak ağacının kimliğidir. `HPW_Act_v3.0.0_6ca59ed2bcf0.zip` (Türker Bey'in Mac'inde `Belgeler/HPW-Act/` altında) bulut oturumunda görülmedi; paket ile kaynak arasındaki eşleşme **doğrulanmadı** ve bu kayıt doğrulama yapılana kadar korunur. Kurulum paketten değil, sabit commit'ten (`9b53f635cf1784057b323713a52bc24506fde9e6`) özgün Dockerfile ile kaynaktan derlemedir. Sunucuda imaj kaynaktan yeniden derlenir; çalışan kod commit'in ürünüdür ve paket build kimliğini taşımaz. Zip daha sonra gelirse eşleşme şöyle denetlenir: zip'teki `GELISTIRICI_KAYNAK` ağacı `git archive 11fd5be` çıktısıyla, `ops/paketle-v3.sh` içindeki dışlamalar uygulanarak dosya dosya karşılaştırılır; `KANITLAR/MANIFEST.json` paket içi bütünlüğü gösterir, kaynak commit'ini göstermez.

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

**Önce sunucuya bakın.** Sunucuda daha önceki bir aktarım varsa (paket içeriği, git klonu ya da elle kopya) aktarım yeniden yapılmaz; aşağıdaki "Mevcut aktarımla karşılaştırma" adımıyla kurulacak commit'ten farkı çıkarılır, veri ve `.env` korunarak o commit'e geçilir.

Arşive aşağıdaki yollar bütünüyle girer (yaklaşık 3,6 MB). Yalnız Docker derlemesinin kullandığı dosyalar değil, bu dizinlerdeki test ve örnek kaynaklar da arşivdedir: `apps/api/test` (API testleri), `packages/domain-core/test` ve altındaki fikstürler, `apps/web/src/fixtures` ve `apps/web/src/api/mock.ts` (sentetik Atlas Holding örnek verisi), `apps/api/scripts`, `apps/web/scripts`, `apps/api/src/seed-*.ts` (sentetik tohum üreticileri). Bunlar imaja girmez ya da çalışma zamanında kullanılmaz; müşteri verisi içermez. Arşive girmeyenler: `docs/`, `tools/`, `data/`, sunum ve Excel şablonları, Ant Yapı dosyaları.

```sh
# Mac'te, depo klonunda
C=9b53f635cf1784057b323713a52bc24506fde9e6
git fetch origin main claude/lucid-hawking-6xigat && git cat-file -e "$C^{commit}"
git archive --format=tar -o "/tmp/hpw-act-$C.tar" "$C" -- tsconfig.base.json packages/domain-core apps/api apps/web db/migrations ops/sunucu ops/docker
git get-tar-commit-id < "/tmp/hpw-act-$C.tar"      # $C yazmalı
tar -tf "/tmp/hpw-act-$C.tar" | grep -ic antyapi  # 0 olmalı
shasum -a 256 "/tmp/hpw-act-$C.tar"
scp -P SSH_PORTU "/tmp/hpw-act-$C.tar" docs/kurulum/kapali-modul-denetimi/sema-ornek.mjs docs/kurulum/kapali-modul-denetimi/gonder.py KULLANICI@SUNUCU:/tmp/
```

İki denetim farklı şeyleri gösterir:

- **Tar başlığındaki commit etiketi** (`git get-tar-commit-id`), arşivi üreten `git archive` komutunun hangi commit'ten çalıştığını söyleyen bir metin alanıdır. Bütünlük kanıtı değildir; içerik değişse de etiket aynı kalabilir.
- **SHA-256 karşılaştırması**, Mac'teki dosya ile sunucuya ulaşan dosyanın bayt bayt aynı olduğunu, yani aktarımda bozulma ya da değişiklik olmadığını gösterir. Hangi commit'ten üretildiğini göstermez.
- İçeriğin gerçekten o commit'in ağacı olduğunu görmek için Mac'te aynı komutla arşiv ikinci kez üretilip sha256 değerleri karşılaştırılır (aynı git sürümünde `git archive` aynı baytları üretir). Farklı git sürümleri farklı sha256 verebilir; bu yüzden karşılaştırma aynı makinede yapılır.

Sunucuda (commit değişkeni bu oturumda da tanımlanır):

```sh
C=9b53f635cf1784057b323713a52bc24506fde9e6
sha256sum "/tmp/hpw-act-$C.tar"                    # Mac'teki değerle aynı olmalı
git get-tar-commit-id < "/tmp/hpw-act-$C.tar" 2>/dev/null || true   # sunucuda git varsa: $C
```

**Mevcut aktarımla karşılaştırma** (`/opt/hpw-act` varsa; hiçbir şey silinmez):

```sh
C=9b53f635cf1784057b323713a52bc24506fde9e6
cat /opt/hpw-act/KAYNAK_COMMIT 2>/dev/null; git -C /opt/hpw-act rev-parse HEAD 2>/dev/null; git -C /opt/hpw-act status --short 2>/dev/null | head
rm -rf /tmp/hpw-ref && mkdir -p /tmp/hpw-ref && tar -xf "/tmp/hpw-act-$C.tar" -C /tmp/hpw-ref
diff -rq /tmp/hpw-ref /opt/hpw-act | grep -vE '^Only in /opt/hpw-act' | grep -vE 'node_modules|/ops/sunucu/(\.env|yedekler)'
```

`Files ... differ` ve `Only in /tmp/hpw-ref` satırları kurulacak commit'ten farktır; `Only in /opt/hpw-act` satırları (paketten gelen `docs/`, `tools/` gibi ek klasörler, `.env`, yedekler) beklenen ek dosyalardır ve dokunulmaz. Fark varsa önce mevcut kurulumun yedeği alınır (bölüm 4 adım 2). Sunucudaki kopya git klonuysa (`ops/sunucu/.env` ve `yedekler/` git dışıdır) `git -C /opt/hpw-act fetch origin main && git -C /opt/hpw-act checkout --detach "$C"`; değilse arşiv üzerine açılır. Her iki durumda `.env`, yedekler ve Docker birimleri korunur.

İlk kurulumda ya da arşiv üzerine açarken:

```sh
C=9b53f635cf1784057b323713a52bc24506fde9e6
sudo mkdir -p /opt/hpw-act && sudo chown "$USER" /opt/hpw-act
tar -xf "/tmp/hpw-act-$C.tar" -C /opt/hpw-act
echo "$C" > /opt/hpw-act/KAYNAK_COMMIT
```

Arşiv `ops/sunucu/.env` ve `ops/sunucu/yedekler` içermez; üzerine açıldığında bunlar korunur. Bulut oturumunda aynı komutla üretilen arşivde Dockerfile'ın 18 `COPY` kaynağının hepsi ve `ops/docker/init-roles.sh` vardı.

## 4. Kurulum sırası

`ops/sunucu/SUNUCU-KURULUMU.md` adımları sunucuya uyarlanarak uygulanır:

1. **Ön inceleme (değişiklik yapmadan):** `lsb_release -a`, `nproc`, `free -h`, `df -h /`, `timedatectl`, `sudo ss -ltnp` (80/443 kimde), `systemctl list-units --type=service --state=running`, `docker ps -a` ve `docker volume ls` (varsa), `ls -la /opt/hpw-act`, `ls -la /opt/hpw-act/ops/sunucu/.env` (yalnız varlık ve izin; içerik basılmaz), `sudo ufw status verbose`, `sudo sshd -T | grep -iE '^(port|listenaddress) '`, alan adı için `dig +short A acterix.com.tr`, `dig +short AAAA acterix.com.tr`, `dig +short CAA acterix.com.tr` ve sunucunun genel adresleri (`curl -4s https://ifconfig.co`, `curl -6s https://ifconfig.co`).
   - **80/443 başka bir hizmetteyse** (ör. sağlayıcı paneli, nginx, apache) o hizmet durdurulmaz ve yapılandırması onaysız değiştirilmez. Port çakışması yaratmadan ilerlemenin yolu: Caddy başlatılmaz, API yalnız yerel adrese açılır (sunucuda depo dışı `ops/sunucu/docker-compose.override.yml`: `api` için `ports: ["127.0.0.1:8787:8787"]`, `caddy` için `profiles: ["kapali"]`) ve mevcut ters vekilde `acterix.com.tr` için `127.0.0.1:8787`'ye yönlenen, kendi sertifikasını alan bir site tanımlanır. Mevcut vekil tek vekil olduğu için `TRUST_PROXY=1` doğru kalır. Mevcut vekilin yapılandırmasına dokunmadan önce Türker Bey'e ne değişeceği söylenir; bu uyarlama kurulum kaydına yazılır.
2. **Yedek:** mevcut HPW Act verisi varsa önce `cd /opt/hpw-act/ops/sunucu && ./yedekle.sh` ve `.env` dosyasının bir kopyası (`cp -p .env yedekler/env.$(date +%Y%m%d_%H%M)`, 600). Başka hizmetlerin verisine dokunulmaz.
3. **Docker:** yoksa talimattaki gibi kurulur; `docker compose version` denetlenir.
4. **Güvenlik duvarı:** önce gerçek SSH portu izinli kural olarak eklenir (port 22 değilse `sudo ufw allow <port>/tcp`), sonra 80 ve 443; ufw zaten açıksa mevcut kurallar silinmez. Etkinleştirmeden önce `sudo ufw show added` incelenir.
5. **`.env`:** mevcutsa korunur; var olan satırlara ve sırlara dokunulmaz, yalnız eksik anahtarlar eklenir ve yalnız eksik ya da boş zorunlu sırlar (`PG_PASSWORD`, `API_DB_PASSWORD`, `SETUP_KEY`, `HPW_MFA_KEY`) talimattaki `openssl rand` satırıyla üretilir. Dikkat: veritabanı birimi zaten varsa `PG_PASSWORD` ve `API_DB_PASSWORD` yeniden üretilmez; birimdeki parolayla uyuşmaz. Yoksa `env.example`'dan üretilir (`chmod 600`). Değerler: `DOMAIN=acterix.com.tr`, `HPW_BUILD_ID=9b53f635cf1784057b323713a52bc24506fde9e6`, `MAIL_FROM` ve `SMTP_URL`. `APP_BASE_URL=https://acterix.com.tr`, `COOKIE_SECURE=true`, `HPW_ENV=production`, `HPW_LEGACY_MODULES=false`, `HPW_MFA_REQUIRED=false` compose dosyasında sabittir (`APP_BASE_URL` `DOMAIN`'den türetilir); `docker compose config | grep -E 'APP_BASE_URL|COOKIE_SECURE|HPW_ENV|HPW_LEGACY|HPW_MFA_REQ|HPW_BUILD_ID'` ile denetlenir (bu çıktı sır içermez; tam `config` çıktısı sır içerir, basılmaz). SMTP parolası sohbete yazılmaz: Türker Bey `.env` içine kendisi girer ya da yalnız onun okuyabileceği bir dosyaya koyar ve değer ekrana basılmadan oradan aktarılır. `grep -c '=$' .env` 0.
6. **Başlatma:** `docker compose up -d --build` (özgün `apps/api/Dockerfile`, kurulacak commit'in kaynağından). `docker compose logs api` içinde migrasyonlar ve `HPW Act API [production] :8787`. Mevcut bir veritabanı biriminde yalnız eksik migrasyonlar uygulanır.
7. **İlk HPW yöneticisi:** parolayı Türker Bey tarayıcıda `https://acterix.com.tr` adresindeki "İlk kurulum · HPW yöneticisi" formunda kendisi belirler. Kurulum anahtarını sunucuda kendi terminalinden okur (`sudo grep '^SETUP_KEY=' /opt/hpw-act/ops/sunucu/.env`); anahtar Claude tarafından ekrana, loga ya da sohbete basılmaz. Önceden `curl -s https://acterix.com.tr/api/platform/bootstrap-status` ile `needsBootstrap` bakılır: `false` ise yönetici zaten kuruludur, form yeniden doldurulmaz. Form sonrası `needsBootstrap:false` denetlenir; giriş ve Şirketler ekranında "Yeni şirket" düğmesi Türker Bey'in girişiyle görülür (Claude yöneticinin parolasını bilmez).
8. **Yedek ve zamanlama:** `./yedekle.sh` bir kez çalıştırılır. Döküm PostgreSQL konteynerinin içindeki `pg_restore` ile okunur (sunucuda PostgreSQL istemcisi gerekmez): `F=$(ls -t yedekler/hpw_act_*.dump | head -1); docker compose exec -T db pg_restore --list < "$F" | grep -c 'TABLE DATA'` (sıfırdan büyük olmalı). Cron satırı yalnız aynı iş yoksa eklenir:

   ```sh
   cd /opt/hpw-act/ops/sunucu
   crontab -l 2>/dev/null | grep -qF 'cd /opt/hpw-act/ops/sunucu && ./yedekle.sh' \
     || ( crontab -l 2>/dev/null; echo "15 3 * * * cd /opt/hpw-act/ops/sunucu && ./yedekle.sh >> yedekler/yedek.log 2>&1" ) | crontab -
   crontab -l | grep -c 'yedekle.sh'   # 1 olmalı
   ```

   Cron sunucunun yerel saatiyle çalışır: kayıtta `timedatectl` saat dilimi ve yedek saatinin Türkiye saati (TSİ, UTC+3) karşılığı açıkça yazılır. Sunucunun saat dilimi sorulmadan değiştirilmez. Cron'u ekleyen kullanıcı `docker` komutunu çalıştırabilmelidir (root ya da `docker` grubunda). `yedekle.sh` `.env` dosyasını yedeklemez; `.env` kopyasının sunucu dışında nerede tutulacağı HPW'nin kararıdır.
9. **Otomatik başlatma:** uygulama Mac'e ya da kurulum oturumuna bağlı değildir; Docker servisi açılışta başlar, konteynerler `restart: unless-stopped` ile geri gelir. Denetim: `systemctl is-enabled docker` → `enabled` (değilse `sudo systemctl enable docker`), `docker inspect -f '{{.Name}} {{.HostConfig.RestartPolicy.Name}}' $(docker compose ps -q)` → üçü de `unless-stopped`. Sunucuyu yeniden başlatarak deneme yalnız Türker Bey'in onayıyla yapılır (sunucudaki başka hizmetler de etkilenir).

## 5. Kurulumu tamamlayan denetimler

| Denetim | Nasıl |
|---|---|
| Servisler çalışıyor, yeniden başlatma döngüsü yok | `docker compose ps`; birkaç dakika sonra `docker inspect -f '{{.Name}} {{.RestartCount}} {{.State.Status}}' $(docker compose ps -q)` |
| Migrasyonlar tamam | API logu ve `/api/ready` yanıtında `schema` = `expectedSchema` = `0024_v300_sade_yol_haritasi.sql` |
| Hazır | `curl -s https://acterix.com.tr/api/ready` → `ready:true`, `version:"3.0.0"`, `build` = kurulan commit |
| v3 kipi | `curl -s https://acterix.com.tr/api/public/app` → `{"mode":"v3"}` |
| HTTPS | `curl -sv https://acterix.com.tr/ -o /dev/null` (sistem CA ile, `-k` olmadan); `openssl s_client -connect acterix.com.tr:443 -servername acterix.com.tr </dev/null 2>/dev/null \| openssl x509 -noout -issuer -enddate` |
| İlk yönetici ve giriş | bölüm 4 adım 7: form öncesi `needsBootstrap:true` (ya da zaten kuruluysa `false`), Türker Bey formu doldurduktan sonra `needsBootstrap:false`; girişi Türker Bey yapar |
| Şirketler ekranı | Türker Bey'in girişinden sonra ekranda "Şirketler" başlığı ve "Yeni şirket" düğmesi |
| Otomatik başlatma | bölüm 4 adım 9: `systemctl is-enabled docker` = `enabled`, üç konteynerde `unless-stopped` |
| DNS | `dig +short A acterix.com.tr` sunucunun IPv4 adresi; AAAA varsa sunucunun IPv6 adresi; CAA varsa `letsencrypt.org` izinli (`dig` yoksa `getent ahosts acterix.com.tr`) |
| Kapalı modüller | `ops/sunucu` içinde: `docker compose cp /tmp/sema-ornek.mjs api:/tmp/sema-ornek.mjs && docker compose exec -T api node /tmp/sema-ornek.mjs > /tmp/ornekler.jsonl && python3 -I /tmp/gonder.py /tmp/ornekler.jsonl https://acterix.com.tr > /tmp/kapali-modul-sonuc.tsv`. 66 isteğin hepsi `404 module_disabled` olmalı (çıkış 0). 400 dönen istek kapı denetimi sayılmaz. Sunucu kendi alan adına ulaşamıyorsa `ornekler.jsonl` Mac'e alınıp `gonder.py` oradan çalıştırılır. |
| Yedek | `./yedekle.sh` çıktısı; `docker compose exec -T db pg_restore --list < "$F" \| grep -c 'TABLE DATA'` (konteyner içinden); `crontab -l \| grep -c yedekle.sh` = 1 |
| SMTP | gönderimsiz doğrulama: `docker compose exec -T api node -e "import('nodemailer').then(m=>m.default.createTransport(process.env.SMTP_URL).verify()).then(()=>console.log('SMTP bağlantı ve kimlik doğrulaması tamam'),e=>{console.log('SMTP hatası:',e.code,e.responseCode);process.exit(1)})"`. Hata iletisinin tamamı basılmaz. Gerçek gönderim yalnız izin ve alıcı verilirse. |

## 6. Kurulum kaydı

Kurulum sonunda sunucuda `/opt/hpw-act/KURULUM-KAYDI.md` yazılır (sır içermez, 644). Değerler komutlarla alınır:

```sh
cd /opt/hpw-act/ops/sunucu
cat /opt/hpw-act/KAYNAK_COMMIT                                          # kaynak commit (tam)
docker image inspect sunucu-api --format '{{.Id}} {{.Created}}'          # derlenen imaj
docker inspect -f '{{.Image}}' "$(docker compose ps -q api)"            # çalışan konteynerin imajı; üsttekiyle aynı olmalı
docker image inspect postgres:16 caddy:2 --format '{{.RepoTags}} {{.Id}} {{.RepoDigests}}'
curl -s https://acterix.com.tr/api/ready
timedatectl | grep -i 'time zone'; crontab -l | grep yedekle
```

Kaydın alanları: tarih (UTC ve TSİ); sunucu ve alan adı; kaynak depo ve tam commit; `/tmp/hpw-act-<commit>.tar` sha256; imaj kimliği ve çalışan konteynerin imaj kimliği; postgres ve caddy imaj kimlikleri; `/api/ready` yanıtı (`build` alanının paket build kimliği değil, kaynak commit'i olduğu notuyla); sertifika sağlayıcısı ve bitiş tarihi; yedek saati, sunucu saat dilimi ve TSİ karşılığı; yapılan değişiklikler (dosya ve neden); çalıştırılan denetimler ve sonuçları; tamamlanamayan işler ve nedenleri. Kaydın bir kopyası daha sonra depoya `docs/kurulum/` altına eklenebilir.

## 7. Bulut denemesinde doğrulananlar

Deneme bu oturumun konteynerinde yapıldı: `localhost`, Caddy'nin iç sertifikası, SMTP boş, sırlar atılmak üzere üretildi ve silindi. İmaj (`sunucu-api`, c9a168a811e2) `11fd5be` kaynağından, bu ortamın TLS vekili yüzünden yalnız derleme aşamasına vekil sertifikası eklenmiş türev bir Dockerfile ile derlendi. API ve veritabanı kodu `9b53f63` ile aynı olduğu için API sonuçları kurulacak commit için de geçerlidir.

Doğrulananlar: 24 migrasyon uygulandı; `/api/ready` `ready:true`, `version:"3.0.0"` (build boş; `9b53f63` öncesi); `/api/public/app` `{"mode":"v3"}`; HTTP istekleri 308 ile HTTPS'e yönlendi; HSTS, nosniff ve referrer başlıkları geldi; ilk kurulum formu tarayıcıda açıldı, yanlış anahtar 403, doğru anahtar 200, ikinci deneme 409; girişten sonra Şirketler ekranı ve "Yeni şirket" düğmesi göründü; `yedekle.sh` döküm aldı, döküm ayrı bir veritabanına `pg_restore` ile geri yüklendi; API yeniden başlatma ve yığın kapatıp açma sonrasında veri korundu; yeniden başlatma sayısı 0.

**Kapalı modüller (düzeltilmiş sonuç).** Kapalı dört rota modülünde (`analysis`, `corporate`, `ai`, `roadmap`) 66 rota-yöntem çifti var, hepsi `/api/t/` altında.

- İlk turda istekler oturumsuz, POST'lar boş `{}` gövdeyle gönderildi: 34 istek `404 module_disabled` döndü ve doğrulanmış sayılır. 32 istek `400 invalid_request` döndü: gövde doğrulamasında takıldılar, kapalı modül kapısına ulaşmadılar; bunlar kapı denetimi olarak **sayılmaz**.
- İkinci turda (`kapali-modul-denetimi/`): rota şemaları çalışan imajdaki derlenmiş koddan çıkarıldı, her rota için şemaya uyan params, sorgu ve gövde üretildi ve Ajv ile önceden doğrulandı (66/66). İstekler Caddy üzerinden oturumsuz gönderildi: 66/66 `404 module_disabled` (gövde şemalı 34, gövdesiz 32). İlk turda 400 dönen 32 istek bu turda kapıya ulaştı ve 404 döndü. Ayrıntı: `kapali-modul-denetimi/sonuc-2026-11-08-bulut-deneme.tsv`.
- Oturumlu kullanıcı yolu yalnız kaynaktan incelendi, oturumlu şirket kullanıcısıyla denenmedi. `server.ts` içinde kapı bir `preHandler` kancasıdır. Ondan önce yalnız oturum yükleme (`onRequest`), HPW personeli MFA kapısı, HPW yetki denetimi ve tekrar-önleme (`Idempotency-Key`) kancaları çalışır. Kapalı modül dosyalarında rota düzeyinde kanca yoktur, işleyiciye kapıdan önce ulaşılmaz. Şirket üyesi olmayan HPW personeli ilk turda yetki kancasında 403 aldı. Not: oturumlu bir kullanıcı `Idempotency-Key` ile POST gönderirse tekrar-önleme kancası kapıdan önce bir rezervasyon kaydı yazar ve aynı anahtarla önceden kaydedilmiş bir yanıt varsa onu döndürebilir; iş etkisi yoktur. Bu sıra kurulacak commit'te (`9b53f63`) düzeltilmedi; bilinen açık olarak kayıtlıdır.

**`9b53f63` için dar denetimler:** `docker compose config` (yer tutucu değerlerle) özgün `apps/api/Dockerfile`'ı, `HPW_BUILD_ID`'nin `.env`'den okunduğunu ve boşsa `3.0.0` olduğunu gösterdi; `node tools/tests/fe/i18n-coverage.mjs` çıkış 0 (eksik çeviri 0, İngilizcede Türkçe harf 0); `VITE_APP_ONLY=1 vite build` geçti ve yeni açıklama derlenmiş pakette var. `9b53f63` Docker'da derlenmedi. Bölüm 5'teki SMTP denetim komutu bu imajda ağsız ve yer tutucu adresle denendi: `nodemailer` üretim imajında var, hata yalnız kodla basıldı (`ESOCKET`), gönderim yapılmadı.

**Denenmeyenler:** gerçek Let's Encrypt sertifikası, SMTP, sunucuya özgü durum (port kullanımı, güvenlik duvarı, mevcut veri, sunucunun dış ağ ve TLS durumu), oturumlu şirket kullanıcısıyla kapalı modül isteği.

## 8. Yerel oturuma verilecek başlangıç iletisi

> HPW Act v3.0 sunucu kurulumunu sürdür. Depo: https://github.com/hptw-turker/hpw-act. Önce `claude/lucid-hawking-6xigat` dalını al ve `DEVIR-v3.0.md`, `docs/adr/ADR-0043-sade-hpw-act-v3.md`, `ops/sunucu/SUNUCU-KURULUMU.md` ve `docs/kurulum/SUNUCU-KURULUMU-DEVIR-2026-11-08.md` dosyalarını oku. Kurulacak kaynak `9b53f635cf1784057b323713a52bc24506fde9e6`; özgün Dockerfile ile kaynaktan derle. Sunucu (Turhost): `<kullanıcı>@<IP>`, SSH portu `<port>`, anahtarla. Alan adı: `acterix.com.tr`, erişim adresi `https://acterix.com.tr`. Önce sunucuyu değişiklik yapmadan incele (bölüm 4 adım 1); daha önce aktarılmış dosya, `.env`, veritabanı ya da Docker birimi varsa koru, yapılmış işi tekrarlama, `docker compose down -v` kullanma. SMTP `.env`'de yoksa bilgisini benden iste; parolayı `.env` içine ben gireceğim. İlk HPW yöneticisinin parolasını kurulum formunda ben belirleyeceğim. Müşteri dosyası yükleme, davet ya da deneme e-postası gönderme. Devir belgesindeki sınırlara uy, sonunda kurulum kaydını yaz ve teslimi kısa bildir.

Bulut oturumunun konuşma geçmişi de gerekirse Mac'te depo klonunun içinde `claude --teleport` ile yerel terminale alınabilir; kurulum için bu belge yeterlidir.
