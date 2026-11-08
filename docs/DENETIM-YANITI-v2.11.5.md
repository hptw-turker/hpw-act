# HPW Act v2.11.5 — Bağımsız v2.11.4 denetimine yanıt (V2114-A01)

Yanıtlanan: "HPW Act v2.11.4 — bağımsız yeniden denetim" (build 8ab25e62e66d). Kapsam yalnız V2114-A01 ve buna bağlı ayrı komut takibi; yeni özellik yok, sunucu ve migrasyon değişikliği yok (0001–0019 değişmedi). Önceki kapanışlar yeniden açılmadı. **Kabul kararı denetçiye aittir; aşağıdakiler üretici koşularıdır.**

**Test adayı (sabit):** build `0edf9f2a737a`; aday ZIP (kanıtsız) `HPW_Act_TESLIMAT_v2.11.5_0edf9f2a737a.zip` 156.510.477 bayt, SHA-256 `d66bb1435d2f763b208c6c01a6a314156697ed16c0d62ef2d47edbef5a5cb428`; DOLU `assets/app` 5.385 normal dosya, ağaç özeti `4d741dea…017f`; test edilen web `apps/web/dist` 11 dosya, özet `50a3a630…fc9d`; paketteki sunucu kaynağı `apps/api/src` özeti `61ef7ff0…fc43` = gerçek PostgreSQL koşusunun kaynağı (`v2115/aday-referansi.txt`). Final teslim ZIP'i bu adaydan **yalnız kanıt/belge eklenerek** oluşturuldu; BOS_BASLANGIC ve DOLU_DEMO dizinleri adayla bayt düzeyinde aynıdır (teslim notunda doğrulama).
Kanıt kökü: `GELISTIRICI_KAYNAK/docs/test-ciktilari/v2115/` (aşağıda `v2115/`). Türler: **[DB]** gerçek PostgreSQL + gerçek Fastify HTTP · **[UI]** gerçek tarayıcı + kontrollü HTTP · **[DB-KONTROLLÜ]** gerçek Fastify, sorgular düzenekte · **[PAKET]** aday ZIP'ten gerçek başlatıcı + gerçek PostgreSQL · **[ÇALIŞMA ALANI]** depo kaynağı/derlemesi.

## Kök neden ve değişen dosyalar

`not_found` sonuç okuması, okunduğu anı aşan kesin sonuç gibi kullanılıyordu; sonraki iş okumasında sürüm artmışsa özgün anahtar yeniden sorgulanmadan "uygulanmadı" denip takip siliniyordu. Değişen dosyalar: `apps/web/src/product/pages/WorkItems.tsx` (sürüm ilerleyince özgün anahtar yeni sürüm görüldükten sonra yeniden sorgulanır; sürüm aynıyken yokluk kesin sayılmaz, takip silinmez; yeni değerler bilinçli ikinci onayla ve özgün komut ayrı takipte; iş okuması başarısızsa belirsizlik korunur; pencere yeniden açılınca yeni değerler için bilgi yeniden verilir; pencere her açılışta yeniden bağlanır), `apps/web/src/product/Dialog.tsx` (alanlar ilk çizimde başlangıç değerleriyle kurulur — ara adayda V2116 bir an önceki taslağı okuyarak düştü, kayıt `v2115/onceki-paket-9005abd7db03-*`).

## Sonuçlar

| Test | Sonuç | Tür | Build / koşu | Kanıt |
|---|---|---|---|---|
| Denetçi `outcome-order-ui.cjs` (SHA-256 9844eddedc1dd43f31e4273bb85855af03756b1e53df47e789573ea908ee45e7), değiştirilmemiş v2.11.4 | 2/3 (COMMIT-BETWEEN-READS FAIL) | [UI] | 8ab25e62e66d | `v2115/baseline-v2114/` |
| Aynı betik, final aday | **3/3** | [UI] | 0edf9f2a737a · kapı B | `v2115/fe-paket/bagimsiz-v2114/outcome-order-ui/` |
| Denetçi `outcome-api.mjs` | **6/6** | [DB-KONTROLLÜ] | 0edf9f2a737a · kapı B | `v2115/fe-paket/bagimsiz-v2114/outcome-api/` |
| V2115 sıralama (reddetme/erteleme × ikinci sorgu applied; 503; erişim yok) | **4/4** | [UI] | 0edf9f2a737a · final2115b-1790661260 | `v2115/fe-paket/ui-regresyon-sonuc.json` |
| V2116 ayrı takip (yeni önce, özgün önce, özgün okunamaz; kapat-aç, ilk görünen değer, iki anahtar/gövde, bilinçli ikinci onay) | **3/3** | [UI] | 0edf9f2a737a · final2115b-1790661260 | aynı |
| Gerçek PostgreSQL sıralama: kilit sinyaliyle ilk sonuç okuması not_found → commit → iş yeni sürüm → ikinci okuma applied (reddetme, erteleme) + kontrol (başka aktör; geç özgün 409) | **3/3** | [DB] | sunucu kaynağı 61ef7ff0…fc43 (adayla aynı; koşudan sonra sunucu kodu değişmedi) | `v2115/api-parca2.log` (SIRA-A01 satırları) |
| API tamamı (iki parça) + sözleşme | 50/50 + 50/50; 1.206 gerçek yanıt 0 sapma; 113 uç; 160 kural 0 sorun | [DB] | aynı kaynak | `v2115/api-parca1.log`, `api-parca2.log`, `api-sozlesme.log` |
| Domain | 70/70 | birim [ÇALIŞMA ALANI] | aynı kaynak | `v2115/domain-test.log` |
| Kapı A (dil, yetki + uç sınıfı, DTO⊆sözleşme 33 uç, istemci 5/5 + 10/10, denetçi tarayıcı — DEEP-LINK beklemeli kopya) | 6/6 adım; denetçi tarayıcı 26/27 (LOGIN-ENTER belgeli istisna) | [UI]/tip | 0edf9f2a737a | `v2115/fe-kabul-paket-A.log` |
| Kapı R (179 regresyon; beş parça) + C | 179/179; C geçti | [UI] | 0edf9f2a737a · final2115b-1790661260 | `v2115/fe-kabul-paket-R0…R4C.log` |
| Kapı B | 19/19 (pending-ui 3/3, uyarlamalı reconcile-ui 4/4, outcome-order 3/3, outcome-api 6/6 ve önceki bütün karşı örnekler) | [UI]/[DB-KONTROLLÜ] | 0edf9f2a737a | `v2115/fe-kabul-paket-B.log` |
| Denetçi `reconcile-ui.cjs` özgün (uyarlamasız) | önceki turdaki gibi 2 PASS / 1 FAIL / 1 ERROR — tasarım gereği (özgün düzenek sonuç ucunu yanıtlamaz); kapıya bağlı değil | [UI] | — | `v2114/ozgun-reconcile-paket/` |
| Kritik akışlar (80) | Chromium 80/80 · Firefox 80/80 · **WebKit 79/80 (V2100-URL)** | [UI] | 0edf9f2a737a | `v2115/motorlar-paket/` |
| BOŞ / DOLU | 54/54 · 8/8 | [PAKET] | 0edf9f2a737a | `v2115/tur-1.log`, `demo-smoke.log` |
| Temiz kurulum | 0 hata; 19 migrasyon | kaynak | aday GELISTIRICI_KAYNAK | `v2115/temiz-kurulum.log` |
| v2.11.4 → v2.11.5 yükseltme | sayımlar aynı; MFA, rol, atama, bekleyen iş korunmuş; sonuç ucu çalışıyor. Doldurma turunun ilk denemesi 12. adımda durdu (neden belirlenmedi), yeni açılışta 54/54 | [PAKET] | 8ab25e62e66d → 0edf9f2a737a | `v2115/yukseltme-v2114/` |
| Migrasyonlar | 0001–0019 v2.11.4 ile AYNI; yeni yok | SHA-256 | — | `v2115/migrasyon-karsilastirma/sonuc.txt` |

DEEP-LINK: özgün `tools/tests/fe/ui-audit.cjs` değişmedi; kapı `ui-audit.hazir-bekleme.cjs` kopyasını koşar (tek fark: "Kaydı ekle" düğmesinin görünür olması en çok 5 sn beklenir; sabit bekleme yok; görünmezse sayım 0 ve senaryo düşer); fark `tools/tests/fe/ui-audit.hazir-bekleme.diff`. Geçmesi performans hedefinin karşılandığı anlamına gelmez.

## Eski v2.11.4 SHA farkı

`v2115/sha-karsilastirma/`: denetçinin `compare-zips.py` çıktısı (`comparison.json`), ek sınıflandırma (`ek-analiz.json`), 24 içerik farkının yol/tür/iki taraf boyut ve SHA tablosu (`ICERIK-FARKI-24.md`, `icerik-farki-24.json`) ve açıklama (`OKU.md`). Özet: envanter aynı; BOŞ+DOLU `assets/app` altındaki 10.768 normal dosya + 20 sembolik bağlantı içerikçe aynı (dizinler hariç); 24 girdi farklı (manifestler, demo dökümü, belge/günlükler); 13.285 girdi yalnız zaman damgası/extra alanında farklı. Çalışma zamanı eşitliği teslim içeriğinin tamamının eşitliği değildir. Denetçideki paketlemenin **kökeni belirlenemedi**.

## Açık kalanlar

WebKit V2100-URL (neden belirlenemedi; Linux WebKit ≠ Safari), 20 şirket yükü, Genel bakış, Sistem ve teslimatlar, gerçek Safari/cihaz, ekran okuyucu ve gerçek %200 yakınlaştırma, canlıya çıkış kapıları.
