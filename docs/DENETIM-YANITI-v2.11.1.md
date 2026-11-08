# HPW Act v2.11.1 — Bağımsız v2.11.0 denetimine yanıt (V211-01…06)

Yanıtlanan: "HPW Act v2.11.0 — bağımsız denetim" (build dc29249b210a, SHA-256 `bfaf0f34…7511`). Kapsam yalnız altı bulgu ve regresyonları; yeni özellik yok, yeni migrasyon yok (0001–0019 değişmedi).
Kanıt kökü: `GELISTIRICI_KAYNAK/docs/test-ciktilari/v2111/` (aşağıda `v2111/`). Türler: **[DB]** gerçek PostgreSQL + gerçek Fastify HTTP · **[UI]** gerçek tarayıcı + kontrollü HTTP (V211-05/06'da kontrollü saat, V211-06'da Europe/Istanbul saat dilimi) · **[DB-KONTROLLÜ]** gerçek Fastify, sorgular düzenekte · **[PAKET]** teslim ZIP'i + gerçek başlatıcı + gerçek PostgreSQL.

**Denetçinin kanıt ZIP'i bu turda iletilmedi** (yalnız rapor ve düzeltme istemi yüklendi). Denetçinin `independent-ui.cjs` ve `independent-api.mjs` dosyaları çalıştırılamadı ve depoya alınamadı. Bunların yerine her bulgu için raporda tarif edilen sırayı izleyen karşı örnekler yazıldı ve **önce değiştirilmemiş v2.11.0 üzerinde** koşuldu. Denetçinin özgün betikleri iletildiğinde değiştirilmeden eklenip önce/sonra koşulacaktır.

## Başlangıç (değiştirilmemiş v2.11.0)

| Test | Tür | v2.11.0 sonucu | Kanıt |
|---|---|---|---|
| V211-01 değerlendirme ↔ üstlenme / bırakma / erteleme, reddetme+sürüm (3 test) | [DB], v2.11.0 paketinin kendi kaynağı ve migrasyonları, ayrı veritabanı | **3/3 FAIL**: üstlenme geri alındı (`open`); bırakma geri alındı (`claimed`); reddetme 200 ama sonucu silindi | `v2111/baseline-v2110/v2111-yaris-v2110-kaynak.log` |
| V2111-02-AB / -ABA / -HATA, -03, -04, -05, -06 ×5 (11 senaryo) | [UI], v2.11.0 paketinin DOLU web derlemesi | **10/11 FAIL** (V2111-06-RED-0030 günün o saatinde sınırın içinde kaldığı için geçti: 719,5 sa) | `v2111/baseline-v2110/ui-v2111-v2110-paket.log` |

Ortam uyarlaması (davranış beklentisi değil): v2.11.0 kaynağında `node_modules` bağlantısı ve test dosyasının kopyası; ayrı test veritabanı `hpw_act_e2110_test`.

## Bulgular

| Bulgu | Kök neden | Değişen dosyalar | Sonra | Testler | Kanıt |
|---|---|---|---|---|---|
| V211-01 (P1) | Değerlendirme etkin işleri kilitsiz okuyup eski durumla koşulsuz yazıyordu; kullanıcı komutları değerlendirme kilidini almıyordu | `apps/api/src/workitems.ts` (etkin işler `FOR UPDATE`; durum yazımları sürüm koşullu) | Komut değerlendirme bitene kadar bekler ve güncel sürümü görür; üstlenme/bırakma/erteleme korunur; eski sürümlü komut 409; geçmiş ve sürüm tutarlı | `apps/api/test/v2111.test.ts` 3 yarış testi [DB, iki bağlantı: ayrı bağlantı `email_outbox`'ı kilitleyerek değerlendirmeyi okuma sonrasında bekletir] | `v2111/api-parca2.log` |
| V211-02 (P1) | Filtre değişince önceki veri ve düğmeler kalıyordu | `apps/web/src/product/pages/WorkItems.tsx` (veri yüklendiği sorgu anahtarına bağlı; bağlam değişince temizlenir; şirket seçenekleri birikir) | Yeni bağlamın ilk yanıtına kadar satır ve işlem yok; A→B, A→B→A ve yükleme hatasında POST 0 | V2111-02-AB, -ABA, -HATA [UI] | `v2111/fe-paket/ui-regresyon-sonuc.json` |
| V211-03 (P2) | "Sorun yok", filtrelenmiş `items` dizisinden türetiliyordu | `apps/api/src/routes/platform.ts` (`evaluations[].active_item_state`), `WorkItems.tsx`, `contract/domain-map.ts` | Sorun var/yok sunucunun kural sonucundan; filtre/sayfalamadan bağımsız | V2111-03 [UI]; sözleşme kuralı | aynı |
| V211-04 (P2) | Pencere eski iş nesnesinin sürümünü kullanıyordu | `WorkItems.tsx`, `apps/web/src/product/Dialog.tsx` (`requireAck`) | 409'da taslak korunur, fark gösterilir ("sürüm 3 → 4"); "Güncel kaydı inceledim" işaretlenmeden gönderim yok; işaretlenince güncel sürüm gider; işlem artık yapılamıyorsa düğme kapalı | V2111-04 [UI] | aynı |
| V211-05 (P2) | Yaş yalnız ilk çizimde hesaplanıyordu | `WorkItems.tsx` (30 sn'de bir ve `visibilitychange`/`focus` ile yeniden çizim) | 6 dk sonra "güncel değil"; kurallar yeniden değerlendirilmedi (ek istek yok) | V2111-05 [UI, kontrollü saat] | aynı |
| V211-06 (P2) | Takvim günü UTC ile, bitiş anı sabit 21:00Z ile üretiliyordu | `WorkItems.tsx` (`untilFor`: yerel gün, günün sonu, sınırın 1 dk altına kısma; `max` yerel gün) | Formun en son günü sunucuda kabul; sunucu sınırı aynı (30/90 gün + 1 dk → 422) | V2111-06 ×5 (reddetme 10:00Z, 20:30Z, 21:30Z; erteleme 10:00Z, 20:30Z) [UI]; v2111 sınır testi [DB] | `v2111/fe-paket/…`, `v2111/api-parca2.log` |

## Final paket üzerinde koşulanlar (build 962ba299fbce)

| Grup | Sonuç | Tür | Kanıt |
|---|---|---|---|
| API (paketlenen kaynakla; ortam sınırı nedeniyle aynı sıra ve veritabanıyla iki parça + sözleşme) | 50/50 + 45/45; 1.142 gerçek yanıt 0 sapma; OpenAPI 112 uç güncel; 152 kural 0 sorun | [DB] | `v2111/api-parca1.log`, `api-parca2.log`, `api-sozlesme.log` |
| Domain | 70/70 | birim | `v2111/domain-test.log` |
| Kapı A (dil 1084/112/103, yetki + uç sınıfı, DTO⊆sözleşme 32 uç, istemci 5/5 + 10/10, denetçi tarayıcı) | geçti — **ilk koşuda denetçi tarayıcı paketinde DEEP-LINK de düştü** (2 başarısız: LOGIN-ENTER belgeli + DEEP-LINK); senaryo iki ayrı tekrarda geçti; A yeniden koşuldu: 26/27 (yalnız LOGIN-ENTER). DEEP-LINK, sayfaya gittikten hemen sonra düğme sayar (beklemesiz); neden zamanlama olabilir, kanıtlanmadı; test değiştirilmedi | [UI] | `v2111/fe-kabul-paket-A.ilk-kosu-DEEP-LINK-basarisiz.log`, `ui-results.ilk-kosu-DEEP-LINK-basarisiz.json`, `fe-kabul-paket-A.log` |
| Kapı R (144 regresyon; tek koşu kimliği, üç parça 48+48+48) + C (bu koşunun birleşik sonucuyla) | 144/144; C geçti | [UI] | `v2111/fe-kabul-paket-R0.log`, `-R1.log`, `-R2C.log`, `-C.log`, `fe-paket/ui-regresyon-sonuc.json` + `.meta.json` |
| Kapı B (N01–N03, R01–R04, kapsam, V290 ×3, V210 7 + 1, V2101 3, makbuz kabulü 9) | geçti | [UI]/[DB-KONTROLLÜ] | `v2111/fe-kabul-paket-B.log` |
| Kritik akışlar (45) | Chromium 45/45 · Firefox ilk koşu 44/45 (V2102-R3-DOGRULANMADI: sayfa/bağlam kapandı; tek başına 3/3, tam tekrar 45/45) · **WebKit 44/45 (V2100-URL çökmesi)** | [UI] | `v2111/motorlar-paket/` |
| BOŞ / DOLU | 52/52 · 8/8 | [PAKET] | `v2111/tur-1.log`, `demo-smoke.log` |
| Temiz kurulum | domain, web, API kurulum/derleme, 19 migrasyon, sözleşme --check, yapılandırma: 0 | kaynak | `v2111/temiz-kurulum.log` |
| v2.11.0 → v2.11.1 yükseltme | bütün sayımlar aynı (bekleyen iş ve kural değerlendirmesi kayıtları dahil); MFA, rol, atama korunmuş | [PAKET] | `v2111/yukseltme-v2110/` |
| Migrasyonlar | 0001–0019 v2.11.0 ile AYNI; yeni yok | SHA-256 | `v2111/migrasyon-karsilastirma/sonuc.txt` |

## Test düzeneği değişiklikleri

`tools/tests/fe/harness.cjs`: isteğe bağlı `timezoneId` (V211-06 İstanbul saat dilimi); verilmezse davranış aynı. Özgünü: `tools/tests/fe/arsiv/harness.v2110-orijinal.cjs`. `apps/api/package.json`: `test:parca1`, `test:parca2`, `test:sozlesme` (varsayılan `npm test` zinciri değişmedi). Denetçi testlerine dokunulmadı.

## Açık kalanlar

- Denetçinin v2.11.0 kanıt ZIP'i (özgün `independent-ui.cjs`, `independent-api.mjs`) iletilmedi; özgün betiklerle önce/sonra koşusu yapılamadı.
- WebKit V2100-URL: açık, neden belirlenemedi; bu turda yeni inceleme yapılmadı. Linux WebKit ≠ Safari.
- Kapı A'daki bir kerelik DEEP-LINK ve Firefox'taki bir kerelik bağlam kapanması: yeniden üretilemedi; neden belirlenmedi.
- 20 şirket yükü, BOŞ 7h, gerçek Safari/cihaz, ekran okuyucu, gerçek %200 yakınlaştırma, Genel bakış, Sistem ve teslimatlar, canlıya çıkış kapıları: açık.
