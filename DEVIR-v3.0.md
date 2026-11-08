# HPW Act v3.0 — yeni oturum için devir belgesi

Bu belge, HPW Act'i devralan yeni bir Claude Code oturumu içindir. Önce bunu oku, sonra `docs/adr/ADR-0043-sade-hpw-act-v3.md` dosyasını oku. Bu ikisi, `CLAUDE.md` ve mimari belgedeki v2 kurallarıyla çelişirse geçerli olan bunlardır. v2 kuralları yalnız kapalı modüllerin içinde geçerlidir.

Tarih: 08.11.2026 · Sürüm: 3.0.0 · Build: `6ca59ed2bcf0` · Ürün sahibi: Türker Baş (Happy Place to Work®, kurucu ve genel müdür)

## 1. Ürün şu an ne

HPW Act, Happy Place to Work'ün (HPTW) her müşteri için hazırladığı raporun yol haritası bölümünü takip eder. Her müşteri için bir kurum raporu ve her işletme için bir işletme raporu vardır. Raporun 8. bölümünde eylem planları, hedefler, rollerin adımları, terminler ve çıktılar yer alır. HPW Act bu bölümü kişilere iş listesi olarak gösterir.

Uygulama hedef önermez, onaylatmaz, değiştirmez. Hedef rapordan gelir. Kişi kendi adımını yaptığında "Yapıldı" diye işaretler. v2.x sahada başarısız oldu: kullanıcılar ekranlarda kayboldu, hedef önerisi, onay, istisna ve kanıt akışlarını reddetti. Bu yüzden v3.0'da ürün yaklaşık %60–70 sadeleştirildi.

Veri modeli iki katmandan oluşur.

- **Kurum yol haritası** kök birime bağlıdır. Rolleri İK, şirket yönetimi ve çalışanlardır.
- **İşletme yol haritaları** her işletmeye ayrıdır. Rolleri İK, işletme yönetimi ve çalışanlardır.
- **Eylem planı** tek bir anket maddesine bağlıdır. Mevcut değer olumlu yanıt sayısı / yanıt sayısı olarak tutulur. Hedef ya olumlu yanıt sayısıdır ya da "İzlenir" (sayısal hedef yok). Kurum hedefi, işletme hedeflerinin toplamıdır.
- **Adım** şu alanları taşır: rol, aşama (30 / 90 / 180 gün; başlangıç = sunum günü), metin, çıktı.
  - Durumu ikilidir: DONE ya da NOT_DONE. Termini geçmiş ve yapılmamış adım "LATE" olarak türetilir.
  - Çalışan adımları bilgi içindir, işaretlenmez.
- **Atıf satırı:** İşletme planındaki "Kurum planı N · İK · İlk 30 gün · Kısa ad" satırı kurum adımına bağlanır. Durumu oradan gelir; işletmede salt okunurdur ve sayımda ikinci kez sayılmaz.

Adımları kimin işaretleyeceği (`apps/api/src/routes/rm2.ts` içinde `RM2_WRITE` ve `RM2_OWN`):

| Kim | İşaretlediği adımlar | Not |
|---|---|---|
| İK (HR_ADMIN, HR_PARTNER) | Kurum ve bütün işletmelerin İK adımları | — |
| Üst yönetim (EXEC) | Kurum planının yönetim adımları | — |
| İşletme müdürü (UNIT_MANAGER), bölge müdürü (REGION_MANAGER) | Kendi işletmesinin yönetim adımları | — |
| HR_ADMIN, ek olarak | Yönetim adımları | Yedek yetki; plan ekranından. Bu adımlar "Bugün" listesine düşmez. |
| İzleyici (VIEWER) | Hiçbiri | — |
| HPW personeli | Hiçbiri | — |

Arayüzde bütün roller aynı mantıkla çalışır. Türker Bey bu tasarımı seçti ve onayladı.

- **Bugün:** Kişinin kendi rolündeki adımlar, termine göre. Gecikenler üstte, yapılanlar altta kapalı. İşaretleme ve not kartın altında.
- **Planlar:** İki bölme. Solda yol haritaları, sağda plan kartları. Tek yol haritası gören kişide sol bölme yoktur. Plan kartında önce kişinin kendi adımları görünür; diğer roller düğmeyle açılır.
- **Kişiler:** Yalnız HR_ADMIN'de. Davet durumu ve yeniden gönderme.
- **HPW Merkezi:** Şirketler listesi ve üç adımlı kurulum. Kurulum adımları organizasyon dosyası, yol haritası dosyası, kullanıcı dosyası ve davettir. Yerel denemede test posta kutusu da burada görünür.

Giriş e-posta ve parolayladır; iki adımlı doğrulama kaldırıldı. Her şirketin kendi giriş adresi vardır: `/g/<ŞİRKET KODU>` (örnek `/g/ANTYAPI`).

**Kapalı modüller silinmedi, işlevsizdir.**
- Kapsam: yerel hedef ve onay, kurumsal hedef ve uzlaştırma, aksiyon kütüphanesi, kanıt, dikkat kuyruğu, takip ölçümü, yapay zekâ planı, ACTION_OWNER rolü, v2.15 yol haritası formu (yh-1).
- Anahtarlar `HPW_LEGACY_MODULES` ve `HPW_MFA_REQUIRED`. İkisi de varsayılan olarak kapalıdır; yalnız `HPW_ENV=test` ortamında açıktır, böylece eski testler koşmaya devam eder.
- Kapalıyken eski uçlar `404 module_disabled` döner. Frontend `GET /api/public/app` yanıtındaki `{mode}` değerine göre v3 ya da eski arayüzü seçer.
- Yapay zekâ bağlantı noktası korunuyor ama kapalı (R-02).

## 2. Büyük olasılıkla ilk işin: sunucuya kurulum

`ops/sunucu/SUNUCU-KURULUMU.md` dosyasını adım adım uygula. Kurulum dosyaları aynı klasörde: `docker-compose.yml` (PostgreSQL 16 + API + Caddy, otomatik HTTPS), `Caddyfile`, `env.example`, `yedekle.sh`.

**Türker Bey'den istenecekler:**
- sunucu ve SSH erişimi (Ubuntu 22.04/24.04),
- alan adı ve DNS A kaydı,
- SMTP bilgisi ve doğrulanmış gönderen adresi,
- ilk HPW yöneticisinin e-postası.

Verinin hangi ülkede ve hangi sağlayıcıda tutulacağı (KVKK) onun kararıdır; sen karar verme.

**Dikkat:** Geliştirme ortamında Docker yoktu, compose dosyası hiç çalıştırılmadı. İmaj adımları temiz kopyada elle tekrarlandı: `npm ci`, `tsc`, `VITE_APP_ONLY=1 vite build`. Ardından üretim ayarlarıyla boş veritabanında migrasyon yapıldı ve hazır olma denetlendi (`ready=true`, `mode=v3`). Bu yüzden talimattaki denetim adımlarını atlama. Kontroller:
- `/api/ready` yanıtında `version` 3.0.0 olmalı.
- `/api/public/app` `{"mode":"v3"}` dönmeli.
- HTTPS sertifikası alınmış olmalı.
- İlk yönetici formu açılmalı.

Üretimde `HPW_MFA_KEY` hâlâ zorunludur; config doğrulaması bunu ister. Talimattaki betik bu anahtarı üretir. Caddy arkasında hız sınırı gerçek istemci adresiyle çalışsın diye `TRUST_PROXY=1` ayarlanmıştır.

## 3. Pazarlık edilemez kararlar (Türker Bey'in sözleriyle)

- **Excel'leri sen yüklemezsin.** "Ant yapının Excel'lerini sen dolduracaksın… ama bu Excel'leri ben senden aldıktan sonra program üzerinden ben yükleyeceğim… Happy Place to Work'ün sorumlusu yükleyecek. Sen yüklemeyeceksin." Gerçek sunucuya müşteri dosyası yüklemek senin işin değildir. Yalnız kendi deneme kopyanda yükleyebilirsin.
- **Ant Yapı istisnası yalnız deneme içindir.** "Bir deneme için farklı bir şey yapabiliriz… Ant yapıya özel bir durum. Fakat geneldeki süreç az önce bahsettiğim gibi ilerleyecek." Ana pakette ve depoda müşteri verisi bulunmaz. `ops/paketle-v3.sh` bunu denetler ve adında antyapi geçen dosyaları dışarıda bırakır.
- **Modüller silinmez, kapatılır.** "Hepsi tamam silinmesin ama raporda gözükmesin. İşlevsiz olsun tamamen."
- **R-04:** İK adımları işletmeler arasında birleştirilmez. Her işletmenin hedefi ayrı olduğu için İK'nın işi de işletmeye göre farklılaşır.
- **Rapor kuralları sabittir.** Rapor ile uygulama arasındaki sözleşme bütün şirketlerde aynıdır: `docs/rapor-formu/RAPOR-KURALLARI.md`. Ant Yapı'nın son dokuz raporu bundan sonraki bütün şirketlerin yapısıdır.

## 4. Depo haritası (v3 ile gelenler)

| Ne | Nerede |
|---|---|
| Karar kaydı | `docs/adr/ADR-0043-sade-hpw-act-v3.md` |
| Migrasyon (eklemeli) | `db/migrations/0024_v300_sade_yol_haritasi.sql`: `rm2_roadmap`, `rm2_plan`, `rm2_step`, `rm2_item`, `auth_tenant_by_code()`. RLS FORCE açık; yalnız adım durumu UPDATE edilebilir. |
| İçe alım (yh-2) | `apps/api/src/importers/roadmap2.ts`. Sayfalar: Rapor, Birimler, Planlar, Adimlar, Izleme. Akış: doğrula → önizle → onayla. Dönem yoksa oluşturur; yeniden yüklemede adım durumunu taşır. |
| Uçlar | `apps/api/src/routes/rm2.ts`: `GET /api/t/:tid/rm2`, `/rm2/me`, `/rm2/:rid`, `POST /api/t/:tid/rm2-steps/:sid` (`{done, note?, expectedVersion}` + Idempotency-Key) |
| Giriş ve kip | `apps/api/src/routes/auth.ts`: girişte isteğe bağlı `tenantCode`, `GET /api/public/tenant/:code`, `GET /api/public/app` |
| Kapalı modül anahtarı | `apps/api/src/server.ts` (onRoute + preHandler), `apps/api/src/config.ts` (`legacyModules`, `mfaRequired`, `trustProxy`) |
| HPW kurulum özeti | `apps/api/src/routes/platform.ts`: `GET /api/platform/tenants/:tid` yanıtında `setup3` |
| v3 arayüzü | `apps/web/src/product/v3/` (`Shell`, `Login`, `Today`, `Plans`, `parts`, `Upload`, `People`, `Hpw`, `v3.css`). Kip seçimi `App.tsx` içinde. **CSS `main.tsx`'te import edilir**: testler `App.tsx`'i tsx ile yükler, `.css` import'u orada kırılır. |
| Rapordan dosya üretici | `tools/rapor-aktarim/yh2_extract.py` (pptx → yh-2 xlsx; geometrik okuma). Kullanım dosyanın başında. |
| Boş şablonlar | `docs/xlsx-sablonlar-bos/` (`HPW_Act_org`, `HPW_Act_yol_haritasi_v3`, `HPW_Act_users`); yh-2 boşu `apps/api/scripts/roadmap2-form.mts` ile üretilir |
| Belgeler | `docs/guides/v3/HPW-Act-v3-Kisa-Kilavuz.md/.pdf`, `docs/PILOT-DEGISIKLIK-v3.0.0.md`, `docs/REVIZE-NOTLARI.md` (R-01..R-04 ve v3'te ne olduğu) |
| Paketleme | `ops/paketle-v3.sh`. İki ZIP üretir: ana paket (müşteri verisi yok) ve isteğe bağlı müşteri deneme paketi (`ANT_DIR`, `ANT_DUMP`, `ANT_SHOTS`...) |

## 5. Çalıştırma ve testler

Yerel geliştirme ortamı:

```sh
service postgresql start
cd apps/api && HPW_ENV_FILE=<env dosyası> npx tsx src/server.ts
```

Env dosyası için örnek `/tmp/...env.v3dene`. v3 için gerekenler:
- `HPW_LEGACY_MODULES=false`, `HPW_MFA_REQUIRED=false`,
- `SETUP_KEY`, `DATABASE_URL`, `MIGRATE_DATABASE_URL`,
- `PORT`, `APP_BASE_URL`, `COOKIE_SECURE=false`, `MAIL_DIR`.

Testler:
- **API:** `cd apps/api && npm test`. Yaklaşık 7 dakika sürer; gerçek PostgreSQL kullanır ve `hpw_act_test` veritabanını sıfırlar.
  - Bilinen tek kırmızı test: `v01-v28.test.ts` içindeki tarihe bağlı "v2.6.9 … weekly 70 gün ≈ 10 slot". v2.14.2'den beri böyle; v3 ile ilgisi yok.
  - Paket koşarken `apps/api/src` altını düzenleme: her test dosyası kaynağı yeniden okur, yarım düzenleme sonraki dosyaları kırar.
- **Yalnız v3 testleri:** `test/v300.test.ts` (8 senaryo, sentetik veri) ve `test/config-mfa.test.ts`.
- **Sözleşme:** `npm run test:sozlesme`. Yeni uç eklersen sırası şu:
  1. testte örnek yanıtı yakala (`HPW_CONTRACT_CAPTURE`),
  2. `npm run contract:infer` çalıştır,
  3. "yalnız-null" alan kalırsa ya örnek veri ver ya da `src/contract/domain-map.ts` dosyasına kural yaz.
- **Ön yüz kapısı:** `cd apps/web && npx vite build && npm test`.
  - Uzun sürer. `FE_PART=A` ile parça parça koşturulabilir.
  - v3 kabul testi `tools/tests/fe/v300-arayuz.cjs`: 15 kontrol, kontrollü HTTP, sentetik veri.
  - Eski ekranlar test ortamında anahtar açıkken denetlenir.
- **Diğer denetimler:** `node tools/scripts/brand-qa.mjs` ve `node tools/tests/fe/i18n-coverage.mjs`. Kod metinleri `tt()` içinde olmalı. İngilizcesi `apps/web/src/product/i18n/en.json` dosyasına yazılır; İngilizce değerde Türkçe harf olmamalı.
- **Veritabanı sıfırlama:** `ALLOW_DB_RESET=1 TEST_DB=<ad>_test sh apps/api/test/reset-db.sh`. Yalnız adı `_test` ile biten veritabanlarını sıfırlar.
- **Yerel başlatıcı denemesi:** `initdb` root olarak çalışmaz; başlatıcıyı yetkisiz bir kullanıcıyla ve erişilebilir bir klasörde (ör. `/var/tmp`) çalıştır.

Son durum:

| Denetim | Sonuç |
|---|---|
| API | 124/125 |
| v3 API | 8/8 |
| Sözleşme | 1518 yanıt, 0 sapma, kapsam 0 sorun |
| Ön yüz kapısı | Bütün parçalar geçti |
| v3 arayüz | 15/15 |
| Paketler | İki paketin başlatıcısı açılıp denendi |

## 6. Tasarım kuralları (Türker Bey'in kalıcı tercihleri)

**Marka ve görünüm:**
- Renkler: kırmızı `#CF051E`, koyu `#231A15`, beyaz. Yardımcı tonlar ve HPW sarısı `#F2C14E` yalnız `apps/web/src/styles/tokens.css` içinde tanımlıdır; kodda `var(--hpw-*)` kullanılır.
- Poppins 400 ve 700. Köşe yuvarlatma, gölge, degrade, ikon ve emoji yok.
- Aralıklar 12 px tabanında.
- Siyah dolu düğme birincil düğmedir; çerçeveli ya da beyaz düğmeler HPW sarısıdır.
- Tarayıcının yerleşik açılır menüsü yerine özel menü kullanılır.

**Ekran içeriği:**
- Ekranda yalnız kişinin işi için gerekli bilgi bulunur ("need to know").
- Metinler kesilmez (üç nokta yok, satır kaydırılır), yazılar iç içe girmez.
- İlerleme yüzde yerine karelerle gösterilir: kırmızı dolu = yapıldı.
- Durum renkle değil kelimeyle yazılır: Yapıldı / Yapılmadı / Gecikti.
- Düğme ne yaptığını söyler ("Yapıldı olarak işaretle", "Planı incele"; "Git"/"Aç" değil). Eylem düğmeleri kutunun altında durur.
- İşlem sonucu düğmenin hemen altında görünür (R-03).
- "Nasıl okunur?" açıklamaları sağ kenardaki kapalı kulptan açılan paneldedir.

**Genel:**
- Yönetici ekranlarında kısaltma, sürüm eki ve teknik terim yok.
- Arayüz TR/EN çalışır, telefonda kusursuzdur, yatay kaydırma yoktur.

## 7. Açık işler

- **Gerçek başlangıç tarihi.** Ant Yapı yol haritası dosyasına başlangıç olarak 16.11.2026 yazıldı ama bu bir varsayım. Sunum günü Türker Bey'den teyit edilmeli; terminler bu tarihten hesaplanır.
- **Ant Yapı kullanıcı dosyası.** `ANTYAPI_03_kullanicilar.xlsx` dosyasında ad ve e-postalar boş; sarı hücreleri Türker Bey ya da müşteri dolduracak. ANT-IK satırına, "Yeni şirket" açılırken girilen İK yöneticisinin e-postası yazılır.
- **Eski stilde kalan iki sayfa.** Davet kabul ve parola sıfırlama sayfaları (`pages/Auth.tsx` içinde `InviteAccept` ve `PasswordReset`) v3 tarzına geçirilmedi. Davetle gelen kişinin ilk gördüğü ekran olduğu için sıradaki iyileştirme adayı bunlar.
- **Davet e-postası metni.** Metin şirketin `/g/<kod>` giriş adresini anmıyor. Eklenmesi faydalı olur.
- **R-01 hizmet kaydı.** v3'te görünmüyor. Yeniden istenirse `docs/REVIZE-NOTLARI.md` dosyasındaki tarife göre yap: iki ayrı sorumlu satırı ve parantez içi açıklamalar.
- **Docker kurulumu.** İlk gerçek kurulumda doğrulanacak (bkz. bölüm 2).

## 8. Türker Bey ile çalışma biçimi

- **Dil ve üslup:** Türkçe, doğal, paragraf halinde yaz. Madde işaretini yalnız gerçekten gerekirse kullan; dolgu ifadesi kullanma.
- **Özerklik:** Kendi başına ilerlemeni bekler. Geri dönüşü pahalı ve belirsiz kararlarda sor; geri kalanı makul varsayımla yap ve varsayımını açıkça söyle.
- **Revize notları:** Notlarını gördükçe paylaşır. Notlar `docs/REVIZE-NOTLARI.md` dosyasına biriktirilir ve toplu revizede ele alınır; tek tek hemen düzeltilmez (acil dediği hariç: "hemen düzelt").
- **Teslimat:** Her teslimde ne değiştiğini, nasıl denendiğini ve neyin denenemediğini dürüstçe yaz.
