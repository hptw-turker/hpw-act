# HPW Act v2.11.4 — Bağımsız v2.11.3 yeniden denetimine yanıt (V2113-A01, V2113-A02)

Yanıtlanan: "HPW Act v2.11.3 — bağımsız yeniden denetim" (build 090687250d70, SHA-256 `4d5ed880…c131`). Kapsam yalnız iki uzlaştırma bulgusu ve regresyonları; yeni özellik yok (yeni API ucu yalnız bu bulguların kanıt kaynağı için), yeni migrasyon yok (0001–0019 değişmedi). Önceki kapanışlar (R1-A, R1-B, R2, BOŞ 7h) yeniden açılmadı. **Kabul kararı denetçiye aittir; bu belge üretici kanıtıdır.**
Kanıt kökü: `GELISTIRICI_KAYNAK/docs/test-ciktilari/v2114/` (aşağıda `v2114/`). Türler: **[DB]** gerçek PostgreSQL + gerçek Fastify HTTP · **[UI]** gerçek tarayıcı + kontrollü HTTP (kontrollü saat, Europe/Istanbul) · **[DB-KONTROLLÜ]** gerçek Fastify, sorgular düzenekte · **[PAKET]** teslim ZIP'i + gerçek başlatıcı + gerçek PostgreSQL.

## Denetçi testleri

`HPW-v2.11.3-Denetim-Kanitlari.zip`: 139 dosyalık envanter kendi `SHA256SUMS.json` listesiyle doğrulandı; önceki betikler depodakilerle aynı. `tests/reconcile-ui.cjs` değiştirilmeden `tools/tests/bagimsiz-v2113/` altında. Kapıya (B) bağlanan: `tests/outcome-adapted/reconcile-ui.cjs` — yalnız yeni sonuç ucu için senaryonun olgusuna uygun düzenek yanıtı ekler (`adaptation.diff`, `ADAPTASYON.md`); senaryolar ve geçiş koşulları aynı.

## Önce / sonra

| Test | Tür | Değiştirilmemiş v2.11.3 | v2.11.4 final paket | Kanıt |
|---|---|---|---|---|
| Denetçi `reconcile-ui.cjs` — özgün | [UI] | **1/4** (OWN-SAVED-CONTROL geçer; OTHER-CLOSE, OTHER-EDIT, EXPIRED-UNREADABLE başarısız) | 2/4: OTHER-CLOSE ve EXPIRED-UNREADABLE geçer; OWN-SAVED-CONTROL başarısız ve OTHER-EDIT zaman aşımı — **tasarım gereği**: özgün düzenek yeni sonuç ucunu yanıtlamaz; alan benzerliği artık kanıt sayılmaz; ürün yanlış başarı göstermez | önce: `v2114/baseline-v2113/reconcile-ui*`; sonra: `v2114/ozgun-reconcile-paket/` |
| Denetçi `reconcile-ui.cjs` — düzenek uyarlamalı | [UI] | — | **4/4** | `v2114/fe-paket/bagimsiz-v2113/reconcile-ui/` |
| Üretici V2114 (7): kendi kaydı (kapalı pencere), başka aktör (kapalı pencere reddetme/erteleme, alan değişimi), süre dolması + okunamama, erişim kaldırıldı, makbuz kaybı | [UI] | — (yeni) | 7/7 | `v2114/fe-paket/ui-regresyon-sonuc.json` |
| Komut sonucu ucu: kendi kaydı `applied` (yol ve yanıtla), bilinmeyen anahtar ve başka kullanıcının anahtarı `not_found`, başka aktörün aynı duruma geçirmesi komut kaydı üretmez, erişim kalkınca 404 `command_not_visible` | [DB] | — (yeni) | 2/2 | `v2114/api-parca2.log` |
| Önceki R1-A/R1-B/R2 (denetçi `pending-ui`, `edge-ui`) | [UI] | 3/3, 7/7 | 3/3, 7/7 | `v2114/fe-paket/bagimsiz-v2112/`, `bagimsiz-v2111/` |

## Bulgular

| Bulgu | Kök neden | Değişen dosyalar | Sonra |
|---|---|---|---|
| V2113-A01 (başka komut aynı duruma geçince yanlış başarı) | Kapalı pencere uzlaştırması, alan değişimi doğrulaması ve makbuz kaybı doğrulaması yalnız beklenen durum + sürüm artışına bakıyordu | `apps/api/src/routes/platform.ts` (yeni `GET /api/platform/commands/:key/outcome`: kullanıcı + işlem anahtarı; komut kaydı komutla aynı transaction'da yazılır; şirkete güncel erişim yoksa 404 `command_not_visible`), `apps/web/src/product/api.ts` (`intentKeyFor`, `settleIntent`), `apps/web/src/product/pages/WorkItems.tsx` (`outcomeOf`: bütün yollar aynı ilke), `dto.ts` (`commandOutcome`), `contract/domain-map.ts` | Başarı yalnız `applied` ve kaydın yolu iş + işlemi gösterince; ekran deposu ve API istemcisi niyeti birlikte kapanır. `not_found` + sürüm ilerlemiş → "uygulanmadı" + güncel kayıt (inceleme ve yeniden onay); `not_found` + sürüm aynı → "kayıtlı değil", yeni değer ancak ikinci onayla. Sorgu başarısız ya da erişim yok → belirsiz kalır, yeni komut yok |
| V2113-A02 (süre dolup okuma başarısızken bekleyen komut unutuluyor) | Süre dolmuşsa okuma sonucu `null` olsa da bekleyen komut siliniyordu | `WorkItems.tsx` | Süre dolmuş komut yeniden yazılmaz; aynı değerlerle onay yalnız sonucu sorgular. Sorgu başarısızsa komut ve takip bilgisi korunur; pencere kapatılıp açılınca özgün tarih/gerekçe ve "belirsiz" bilgisi gelir; alan değişikliği yeni komut göndermez |

Kendi eski testlerimde (V2110-MAKBUZ, V2112-R1-ALAN-DEGISTI, V2113 matrisi) düzenekler yeni uca uyarlandı ve ileti beklentileri güncellendi; önceki hali `tools/tests/fe/arsiv/ui-regresyon.v2114-oncesi.cjs`, gerekçeler `docs/TEST-DEGISIKLIKLERI-v2.10.0.md` (v2.11.4 ekleri). Arşivleme notu uygulandı: gerçek v2.11.2 kopyası `arsiv/ui-regresyon.v2112-tam-ozgun.cjs` (SHA-256 9c997f27…90eb), yanlış adlandırılmış dosya `arsiv/ui-regresyon.v2113-gelistirme-ara-surum.cjs`.

## Final paket üzerinde koşulanlar (build 8ab25e62e66d)

| Grup | Sonuç | Tür | Kanıt |
|---|---|---|---|
| API (paketlenen kaynakla; iki parça + sözleşme) | 50/50 + 47/47; yarış sırası pg_locks ile gözlendi; 1.188 gerçek yanıt 0 sapma; OpenAPI 113 uç güncel; 160 kural 0 sorun | [DB] | `v2114/api-parca1.log`, `api-parca2.log`, `api-sozlesme.log` |
| DTO ⊆ sözleşme | 33 uç + 5 fixture; 0 uyumsuzluk | tip | `v2114/fe-kabul-paket-A.log` |
| Domain | 70/70 | birim | `v2114/domain-test.log` |
| Kapı A (dil 1095/114/103, yetki + uç sınıfı, istemci 5/5 + 10/10, denetçi tarayıcı 26/27 — LOGIN-ENTER belgeli istisna) | geçti | [UI] | `v2114/fe-kabul-paket-A.log` |
| Kapı R (172 regresyon; tek koşu kimliği, dört parça 43×4) + C | 172/172; C geçti | [UI] | `v2114/fe-kabul-paket-R0…R3C.log` |
| Kapı B (17 adım; bütün bağımsız karşı örnekler) | 17/17 | [UI]/[DB-KONTROLLÜ] | `v2114/fe-kabul-paket-B.log` |
| Kritik akışlar (73; üç parça) | Chromium 73/73 · Firefox 73/73 · **WebKit 72/73 (V2100-URL)** | [UI] | `v2114/motorlar-paket/` |
| BOŞ / DOLU | 54/54 · 8/8 | [PAKET] | `v2114/tur-1.log`, `demo-smoke.log` |
| Temiz kurulum | domain, web, API kurulum/derleme, 19 migrasyon, sözleşme --check, yapılandırma: 0 | kaynak | `v2114/temiz-kurulum.log` |
| v2.11.3 → v2.11.4 yükseltme | bütün sayımlar aynı; MFA, rol, atama, bekleyen iş kayıtları korunmuş; sonuç ucu çalışıyor | [PAKET] | `v2114/yukseltme-v2113/` |
| Migrasyonlar | 0001–0019 v2.11.3 ile AYNI; yeni yok | SHA-256 | `v2114/migrasyon-karsilastirma/sonuc.txt` |

## Açık kalanlar

- WebKit V2100-URL: açık, neden belirlenemedi. Linux WebKit ≠ Safari.
- 20 şirket yükü, gerçek Safari/cihaz, ekran okuyucu, gerçek %200 yakınlaştırma, Genel bakış, Sistem ve teslimatlar, canlıya çıkış kapıları: açık.
- Komut sonucu ucu yalnız merkez (platform) komutları içindir; müşteri tarafı komutların makbuz akışı değişmedi.
