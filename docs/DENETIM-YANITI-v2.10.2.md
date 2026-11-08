# HPW Act v2.10.2 — Bağımsız v2.10.1 yeniden denetimine yanıt

Yanıtlanan: "HPW Act v2.10.1 bağımsız yeniden denetimi" (build 1d493310fb3d). Kapsam yalnız V2101-01 ve V2101-02 ile regresyonları; 2.11 kapsamı eklenmedi, yeni migrasyon yok.
Kanıt kökü: `GELISTIRICI_KAYNAK/docs/test-ciktilari/v2102/` (aşağıda `v2102/`). Test türleri: **[DB]** gerçek PostgreSQL + Fastify HTTP; **[UI]** gerçek Chromium + kontrollü HTTP; **[DB-KONTROLLÜ]** gerçek Fastify, sorgular test düzeneğinde (PostgreSQL değil); **[PAKET]** teslim ZIP'inden gerçek başlatıcı + gerçek PostgreSQL.

## 1. Başlangıç: değiştirilmemiş v2.10.1'de yeniden üretim

Denetçinin `tests/edge-ui.cjs` ve `tests/receipt-api.mjs` dosyaları değiştirilmeden, `HPW_Act_TESLIMAT_v2.10.1_1d493310fb3d.zip` içindeki web ve API derlemesiyle koşuldu (`v2102/baseline-v2101/`): **V2101-R1, R2, R3: 3/3 FAIL**; makbuz sondası: ilk teyit 200 → aynı anahtarlı tekrar **409 `receipt_lost`** → okuma `done`, kayıt 1 (`receiptLostReachable: true`).

## 2. Bulgular

| Bulgu | Kök neden | Değişen dosyalar | Önce → sonra | Testler | Ham kanıt |
|---|---|---|---|---|---|
| V2101-01 eski kaydetme yanıtı yeni taslağı siliyordu | İşlem dönüşü yalnız şirket kimliğini denetliyordu (aynı şirkete dönüş eski ziyaretten ayrılmıyordu); başarıda taslak koşulsuz temiz sayılıyor, yeniden okuma formu eziyordu | `apps/web/src/product/pages/PlatformCompany.tsx` (ziyaret nesli + taslak sürümü; onay penceresi işlemleri de ziyaret nesline bağlı) | A→B→A ve aynı ekranda gönderim sonrası düzenleme: `SECOND-UNSAVED-DRAFT` → `FIRST-SUBMITTED` idi → taslak korunur. Aynı ziyarette başarılı eski yanıt “gönderdiğiniz kayıt kaydedildi; sonraki değişiklikler formda, henüz kaydedilmedi” der; ikinci kayıt yeni taslağı ve güncel sürümü gönderir. Eski ziyaretin 409/503 yanıtı yeni ziyarete uyarı ya da bekleme durumu taşımaz; aynı ziyaretteki 409 uyarısı ve taslak koruması sürer | denetçi V2101-R1, R2 [UI]; V2102-R1-ESKI-409, V2102-R1-ESKI-503, V2102-R2-409, V2102-R2-BASARI-MESAJ [UI] | `v2102/fe-paket/bagimsiz-v2101/edge-ui/`, `v2102/fe-paket/ui-regresyon-sonuc.json` |
| V2101-02 makbuz kaybında teyit penceresi toparlanmıyordu | (a) Arayüz yeniden okuma sonucunu pencereyle uzlaştırmıyordu; `st.fingerprint` boşken `confirm` sessizce dönüyordu. (b) Uç makbuz kaynağı tanımlamadığı için başarılı teyidin makbuzu saklanmıyor, aynı anahtarlı tekrar `receipt_lost` yoluna düşüyordu | `apps/web/src/product/pages/GoLiveCard.tsx`; `apps/api/src/routes/tenant.ts` (makbuz kaynağı `tenant_wide`); `apps/api/src/server.ts` (tekrarda müşteri alanı + İK yöneticisi profili + şirket geneli yetki yeniden denetlenir); `apps/api/src/auth.ts` (tür) | Teyit, açılıştaki şirket ve onay kanıtıyla gönderilir; aynı gövde → aynı işlem anahtarı. Makbuz kaybında sonuç güncel kayıttan doğrulanır: doğrulanırsa pencere kapanır ve “daha önce kaydedilmişti; doğrulandı” yazılır; doğrulanamazsa pencere belirsizliği söyler ve “Teyit et” aynı anahtarla gerçekten yeniden gönderir. Sunucu: başarılı teyidin makbuzu saklanır; aynı anahtarlı tekrar aynı 200 sonucu döndürür | denetçi V2101-R3 [UI]; V2102-R3-OKUNAMADI, V2102-R3-DOGRULANMADI (aynı anahtarla ikinci gönderim, sonra kapanış) [UI]; `apps/api/test/v2101.test.ts` “V2101-02 makbuz zinciri” [DB] | `v2102/fe-paket/…`, `v2102/api-npm-test.log`, `v2102/receipt-sonda-sonra/` |

**Makbuz zinciri [DB]:** ilk teyit 200 → aynı gövde + aynı anahtar → 200 ve aynı gövde (saklanan makbuz); ikinci teyit kaydı ve iz yok → müşteri ve merkez `done` → aynı anahtar farklı gövde 409 → İK yöneticisi profili geri alınınca aynı anahtarlı tekrar 403. Eski kanıtla teyidin 409 olması ve HPW'nin müşteri adına teyit verememesi önceki testlerle korunuyor.

**Denetçinin makbuz sondası:** değiştirilmedi ve v2.10.2'de de koşuldu (`v2102/receipt-sonda-sonra/`): ilk teyit 200, kayıt 1, okuma `done`; aynı anahtarlı tekrar **500** — sondanın veritabanı düzeneği artık yazılan ve okunan makbuz sorgularını modellemediği için (`UNMOCKED QUERY`). Bu sonuç "geçti" sayılmadı ve sonda kapıya bağlanmadı; gerekçe `tools/tests/bagimsiz-v2101/ADAPTASYON.md`.

## 3. v2.10.1 kanıtında düzeltmem gereken bir nokta

v2.10.1 teslim tablosunda ön yüz kapısının A parçasındaki "denetçi sonuç denetimi ✓" adımı, bu tur ortaya çıktığı üzere, aynı paket üzerinde yarıda kesilmiş ilk kapı koşusunun bıraktığı `ui-regresyon-sonuc.json` dosyasını okumuştu (regresyonlar o koşuda iki parçaya bölünmüştü ve birleşik dosya yoktu). Bu adımın okuduğu kimlikler o dosyada geçiyordu, ancak dosya o turun son regresyon koşusuna ait değildi. v2.10.2'de düzeltildi: regresyon parçaları aynı koşu kimliğiyle (`REG_RUN`) birleştirilir, sonuç denetimi ayrı adımdır (`FE_PART=C`) ve birleşik sonucun o koşuya ait olduğunu doğrular; aksi hâlde başarısız sayılır. v2.10.2'nin ilk A koşusu bu nedenle sonuç denetiminde düştü; log `v2102/fe-kabul-paket-A.ilk-deneme-sonuc-denetimi-eski-yerinde.log` olarak saklandı.

## 4. Final paket üzerinde koşulanlar (build 3040f1ae93df)

| Grup | Sonuç | Tür | Kanıt |
|---|---|---|---|
| API (bütün gruplar + v2.10.2 makbuz zinciri) | 80/80; 943 gerçek yanıt 0 sapma; OpenAPI 109 uç güncel; 135 kural 0 sorun | [DB] | `v2102/api-npm-test.log` |
| Domain | 70/70 | birim | `v2102/domain-test.log` |
| Kapı A: dil (1004/104/103, eksik 0), yetki+uç sınıfı, DTO⊆sözleşme, istemci 5/5 + 10/10, denetçi tarayıcı 26/27 (LOGIN-ENTER belgeli) | geçti | [UI]/tip | `v2102/fe-kabul-paket-A.log` |
| Kapı R: 123 regresyon, iki parça, tek koşu kimliği `final2102` | 123/123 | [UI] | `v2102/fe-kabul-paket-R0.log`, `-R1C.log`, `fe-paket/ui-regresyon-sonuc.json` + `.meta.json` |
| Kapı C: sonuç denetimi (bu koşunun birleşik sonucu) | geçti | — | `v2102/fe-kabul-paket-C.log` |
| Kapı B: N01–N03, R01–R04, kapsam, V290 (3), V210 7 UI + 1 API, V2101 3 UI | geçti | [UI]/[DB-KONTROLLÜ] | `v2102/fe-kabul-paket-B.log` |
| BOŞ turu | 52/52 | [PAKET] | `v2102/tur-1.log` |
| DOLU duman (iki ortam aynı anda) | 8/8 | [PAKET] | `v2102/demo-smoke.log` |
| Temiz kurulum (bağımlılık ve fixture yok) | domain, web, API kurulum/derleme, 18 migrasyon, sözleşme --check, yapılandırma: 0 | kaynak | `v2102/temiz-kurulum.log` |
| v2.9.1 → v2.10.2 yükseltme | şema dışında bütün sayımlar aynı; MFA, rol, atama korunmuş | [PAKET] | `v2102/yukseltme-v291/` |
| Migrasyonlar | 0014–0016 v2.9.1 ile, 0001–0018 v2.10.1 ile AYNI; yeni migrasyon yok | SHA-256 | `v2102/migrasyon-karsilastirma/sonuc.txt` |

Kapı, ortamın 300 sn'lik komut sınırı nedeniyle parçalar hâlinde koşuldu; varsayılan komut (`node tools/tests/fe/run-fe-tests.mjs`) hepsini tek seferde ve aynı sırayla koşar.

## 5. Açık kalanlar

- **BOŞ 7h:** kök neden bulunmadı. İlk arızanın tam kaydı yok; tanı kaydı turda duruyor ve bu turdaki koşuda devreye girmedi (52/52). Başarılı koşular arızayı açıklamaz; madde açık.
- **Test edilmedi:** Mac/Safari, Firefox, WebKit, ekran okuyucu, gerçek %200 yakınlaştırma.
- **Diğer açıklar:** 20 şirket yük testi, v2.11 kapsamı, canlıya çıkış kapıları.
- **Bağımsız tekrar:** sonuçlar üretici koşularıdır; bağımsız tekrar önerilir.
