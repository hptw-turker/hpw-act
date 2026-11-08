# HPW Act v2.11.6 — Bağımsız v2.11.5 denetimine yanıt (V2115-A01)

Yanıtlanan: "HPW Act v2.11.5 — bağımsız yeniden denetim" (build 0edf9f2a737a; iç ZIP aa7e70cb…d079). Kapsam yalnız V2115-A01; yeni modül/özellik yok; sunucu kuralı ve migrasyon değişikliği yok (0001–0019 ve CHECKSUM_ALIASES.json v2.11.5 ile aynı). V2114-A01 ve önceki kapanışlar korunur. **Bağımsız kabul kararı denetçiye aittir; aşağıdakiler üretici koşularıdır. Teslim, bağımsız yeniden denetime hazır olarak sunulur.**

**Test adayı (sabit):** `HPW_Act_TESLIMAT_v2.11.6_7289361bb090.zip` 162.863.503 bayt, SHA-256 `774e72c6e8ba05df78b790e575c57586cdb93c662602177174b43d3891d10160` (kanıtsız). Build `7289361bb090`. DOLU `assets/app` 5.385 normal dosya, ağaç özeti `7f492293…8433`; test edilen web `apps/web/dist` 11 dosya, özet `7f82629d…8450`; sunucu kaynağı `apps/api/src` `86039b52…46a1` (`v2116/aday-referansi.txt`). Final iç ZIP bu adaydan **yalnız kanıt/belge eklenerek** oluşturuldu (eşitlik: dış paketteki `ADAY-FINAL-ESITLIK-v2.11.6.json`).

**Oturum dışı koşu (önemli):** 2026-09-29 13:03–13:43 UTC arasında bu çalışma ortamında bu oturum dışında bir koşu adayın açılmış kopyasını ve `docs/test-ciktilari/v2116/` dizinini kullandı; kaynağı belirlenemedi. O koşunun bütün çıktıları `v2116/karantina-bilinmeyen-kosu-2026-09-29T1303/` altında ve **bu teslimin kanıtı sayılmadı**; tanı `v2116/cakisma-tanisi/OKU.md`. Aday ZIP'in SHA-256 değeri değişmedi. Bu turun bütün aday testleri adayın **yeni açılmış kopyasında**, yeni koşu kimliği `final2116-1790689661` ve yeni çıktı dizinleriyle baştan koşuldu. O koşu sırasında `tools/tests/fe/kritik-akislar.txt` dosyasına `V2117-` satırı eklenmişti; motor koşuları bu listeyle yapıldı ve final pakette bu hali durur (adaydakiyle tek test dosyası farkı budur; test kodu aynıdır).

Kanıt kökü: `GELISTIRICI_KAYNAK/docs/test-ciktilari/v2116/` (aşağıda `v2116/`). Türler: **[DB]** gerçek PostgreSQL + gerçek Fastify HTTP · **[UI]** gerçek tarayıcı + kontrollü HTTP (V2115-A01 testlerinde kontrollü saat) · **[DB-KONTROLLÜ]** gerçek Fastify, sorgular düzenekte · **[PAKET]** adaydan gerçek başlatıcı + gerçek PostgreSQL · **[ÇALIŞMA ALANI]** depo kaynağı/derlemesi.

## Kök neden ve değişen dosyalar

`supersede()` sonucu belirsiz her eski komutu aynı `|onceki` anahtarına yazıyordu; A → B → C sırasında B'nin taşınması A'nın takibini eziyordu. Düzeltme yalnız `apps/web/src/product/pages/WorkItems.tsx`: her eski komut kendi yuvasında (kapsam + işlem anahtarı); her kayıt yalnız kendi komut kaydı sorgusuyla kapanır; okunamayan sonuç ve erişim kaybında takip ve istemci niyeti korunur; iletiler gönderimi tanıtır (şirket · işlem · bitiş günü · gerekçenin başı) ve birden çok sonuç birlikte görünebilir. Dil: `apps/web/src/product/i18n/en.json`. Sürüm dizesi: `apps/api/src/server.ts`. Üretilen sözleşme: `apps/api/src/contract/responses.json` (44e196c6… → ebb9b619…), `docs/api/openapi-urun.json` (394e0908… → 2c1f4b28…); `schema-audit.json` içerikçe aynı (4a9624bd…). Tam liste: `v2116/DEGISEN-DOSYALAR.md`.

## Sonuçlar

| Test | Sonuç | Tür | Build / koşu | Kanıt |
|---|---|---|---|---|
| Denetçi `multi-pending-ui.cjs` (SHA-256 7fe7db4cdccf1e3fa38c5379d8028a53ef32630e86e9a70542aaa6f1f8109bf8), değiştirilmemiş v2.11.5 final web'i | **1/3** (MULTI-2 PASS; MULTI-3-DISMISS, MULTI-3-SNOOZE FAIL) — davranış başlangıcı | [UI] | 0edf9f2a737a | `v2116/baseline-v2115/multi-pending-ui*` |
| Aynı betik, aday | **3/3** | [UI] | 7289361bb090 · kapı B | `v2116/fe-paket/bagimsiz-v2115/multi-pending-ui/` |
| V2117 (6): UC-KOMUT-RED-ILK, -ERT-ILK (A önce tamamlanır: A komut kaydıyla “kaydedilmişti”, B “uygulanmadı”, C 409), -RED-SON, -ERT-SON (C tamamlanır: A ve B ayrı ayrı “uygulanmadı”), -RED-OKUNAMAZ (A'nın sonucu 503), -ERT-ERISIM (A'nın sonucu 404). Her birinde: üç anahtar/gövde sabitliği, her yeni gönderimden önce bilgi ve gönderimsizlik (ikinci açık onay), komut başına sonuç sorgusu sayısı, istemci niyetinin kapanması/korunması, iki liste yenilemesi, iletinin kendi gerekçesine bağlılığı | **6/6** | [UI] | 7289361bb090 · final2116-1790689661 | `v2116/fe-paket/ui-regresyon-sonuc.json` |
| V2117, değiştirilmemiş v2.11.5 | 6/6 başarısız — kısmen yeni ileti biçimi (gönderimi tanıtma) beklentisinden; davranış başlangıcı için denetçinin 1/3 sonucu esas | [UI] | 0edf9f2a737a | `v2116/baseline-v2115/v2117-regresyon-v2115-paket*` |
| Pencere kapat-aç ile ayrı takibin korunması | V2117'de yok; V2116 (3/3) kapsar | [UI] | 7289361bb090 · final2116-1790689661 | aynı |
| V2114 7/7 · V2115 4/4 · V2116 3/3 (V2114-A01 sıralaması dahil) | geçti | [UI] | 7289361bb090 · final2116-1790689661 | aynı |
| Denetçi `outcome-order-ui` 3/3 · `pending-ui` 3/3 · uyarlamalı `reconcile-ui` 4/4 | geçti | [UI] | 7289361bb090 · kapı B | `v2116/fe-paket/bagimsiz-v211*` |
| Denetçi `outcome-api` | 6/6 | [DB-KONTROLLÜ] | 7289361bb090 · kapı B | `v2116/fe-paket/bagimsiz-v2114/outcome-api/` |
| Kapı A (dil 1101/114/103; yetki + uç sınıfı; DTO⊆sözleşme 33 uç; istemci 5/5 + 10/10; denetçi tarayıcı — DEEP-LINK beklemeli kopya) | 6/6 adım; denetçi tarayıcı 26/27 (LOGIN-ENTER belgeli istisna) | [UI]/tip | 7289361bb090 | `v2116/fe-kabul-paket-A.log` |
| Kapı R (185; altı parça) + C | 185/185; C geçti | [UI] | 7289361bb090 · final2116-1790689661 | `v2116/fe-kabul-paket-R0…R5C.log` |
| Kapı B | 20/20 | [UI]/[DB-KONTROLLÜ] | 7289361bb090 | `v2116/fe-kabul-paket-B.log` |
| Kritik akışlar (86; dört parça) | Chromium 86/86 · Firefox 86/86 · **WebKit 85/86 (V2100-URL, bilinen)**; yeni başarısızlık yok | [UI] | 7289361bb090 | `v2116/motorlar-paket/` |
| API (iki parça) | 50/50 + 50/50; sıralama testleri (ilk okuma not_found → commit → ikinci okuma applied) dahil | [DB] | sunucu kaynağı 86039b52…46a1 = aday | `v2116/api-parca1.log`, `api-parca2.log` |
| Sözleşme, son üretilen dosyalarla (bu tur yeniden) | 1.207 gerçek yanıt 0 sapma; OpenAPI 113 uç güncel; kapsam 116 uç/160 kural 0 sorun; DTO 33 uç 0 uyumsuzluk | [DB] örnekleri + statik | responses.json ebb9b619… | `v2116/sozlesme-son-dogrulama.log`, `sozlesme-kimligi.json`, `api-sozlesme.log` |
| Domain | 70/70 | birim [ÇALIŞMA ALANI] | aynı kaynak | `v2116/domain-test.log` |
| BOŞ / DOLU | 54/54 · 8/8 (yeni açılmış kopya) | [PAKET] | 7289361bb090 | `v2116/tur-1.log`, `demo-smoke.log`; kullanılmış veritabanında düşen deneme `v2116/cakisma-tanisi/` |
| Temiz kurulum | 0 hata; 19 migrasyon | kaynak | aday GELISTIRICI_KAYNAK | `v2116/temiz-kurulum.log` |
| v2.11.5 → v2.11.6 yükseltme | sayımlar aynı; MFA, rol, atama korunmuş; **bekleyen iş** (kurulum gecikti; işlem anahtarıyla üstlenilmiş, sürüm 2) ve üstlenme komutunun `applied` sonucu korunmuş | [PAKET] | 0edf9f2a737a → 7289361bb090 | `v2116/yukseltme-v2115/` |
| Migrasyon + CHECKSUM_ALIASES.json | 20/20 AYNI (kaynak, DOLU, BOŞ kopyaları) | SHA-256 | — | `v2116/migrasyon-karsilastirma/sonuc.txt` |

## Açık kalanlar

WebKit V2100-URL (neden belirlenemedi; Linux WebKit ≠ Safari), 20 şirket yükü, Genel bakış, Sistem ve teslimatlar, gerçek Safari/cihaz, ekran okuyucu, gerçek %200 yakınlaştırma, canlıya çıkış kapıları. Önceki v2.11.4 paketlemesinin kökeni belirsiz; bu turda gözlenen oturum dışı koşunun kaynağı da belirlenemedi.
