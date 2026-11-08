# HPW Act v2.11.2 — Bağımsız v2.11.1 yeniden denetimine yanıt (V2111-R1, V2111-R2)

Yanıtlanan: "HPW Act v2.11.1 — bağımsız yeniden denetim" (build 962ba299fbce, SHA-256 `51cdb198…6b5b`). Kapsam yalnız iki bulgu ve regresyonları; yeni özellik yok, yeni migrasyon yok (0001–0019 değişmedi). Ayrıca bu turda BOŞ turu 7h arızasının kök nedeni bulundu (test verisi; ürün kusuru değil).
Kanıt kökü: `GELISTIRICI_KAYNAK/docs/test-ciktilari/v2112/` (aşağıda `v2112/`). Türler: **[DB]** gerçek PostgreSQL + gerçek Fastify HTTP · **[UI]** gerçek tarayıcı + kontrollü HTTP (R1'de kontrollü saat ve Europe/Istanbul saat dilimi) · **[DB-KONTROLLÜ]** gerçek Fastify, sorgular düzenekte (PostgreSQL değil) · **[PAKET]** teslim ZIP'i + gerçek başlatıcı + gerçek PostgreSQL.

## Denetçi testleri

`HPW-v2.11.1-Denetim-Kanitlari.zip` (SHA-256 `6b21f227…32d5`) ve metin kopyası `HPW-v2_11_1-Test-Betikleri.txt`: her dosyanın bayt uzunluğu ve SHA-256 değeri doğrulandı; iki kaynak bayt düzeyinde aynı. Depoya değiştirilmeden alındı: `tools/tests/bagimsiz-v2111/`. Tek ortam uyarlaması kök `pw.cjs` (özgünü `pw.orijinal.cjs`, pakete eklenmemiş bir Chromium ikili dosyasını gösteriyor); açıklama `ADAPTASYON.md`. Fikstürü uyarlanmış UI betiği, `edge-ui.cjs` ve `cas-api.mjs` standart kapıya (B parçası) bağlandı.

## Önce / sonra

| Test | Tür | Değiştirilmemiş v2.11.1 | v2.11.2 (final paket) | Kanıt |
|---|---|---|---|---|
| Denetçi `tests/original/independent-ui.cjs` | [UI] | 4/5 (A: fikstürde yeni alan yok) | 0/5 — **beklenen**: fikstürde artık zorunlu olan `active_item_state` yok; ekran bu yanıtı sağlıklı saymaz, hata + yeniden dene gösterir (R2'nin amacı). Kapıya bağlanmadı | önce: `v2112/baseline-v2111/bagimsiz/original-ui*`; sonra (çalışma alanı derlemesi): `v2112/bagimsiz-calisma-alani/original-ui*` |
| Denetçi `tests/fixture-adapted/independent-ui.cjs` | [UI] | 5/5 | 5/5 | `…/bagimsiz/fixture-adapted-ui*`; `v2112/fe-paket/bagimsiz-v2111/fixture-adapted-ui/` |
| Denetçi `tests/edge-ui.cjs` (R2 ×3 olumsuz, 2 kontrol; R1 son gün tekrarı, normal gün kontrol) | [UI] | **3/7** (DTO-MISSING, -FALSE, -EMPTY, RETRY-MAXIMUM başarısız) | **7/7** | `…/bagimsiz/edge-ui*`; `v2112/fe-paket/bagimsiz-v2111/edge-ui/` |
| Denetçi `tests/cas-api.mjs` | [DB-KONTROLLÜ] | 4/4 | 4/4 | `…/bagimsiz/cas-api*`; `v2112/fe-paket/bagimsiz-v2111/cas-api/` |
| Üretici V2112-R1 ×6 (reddetme/erteleme × son gün/normal gün; ilk komut kaydedildi/kaydedilmedi; 10 sn sonra tekrar; gün değişimi; belirsiz sonuçta alan değişikliği) | [UI] | son gün senaryolarının tamamı başarısız; normal gün geçti | 6/6 | önce: `v2112/baseline-v2111/ui-v2112-v2111-paket.log`; sonra: `v2112/fe-paket/ui-regresyon-sonuc.json` |
| Üretici V2112-R2 ×6 (eksik, boolean, boş, bilinmeyen; geçerli null, geçerli open) | [UI] | 4 olumsuzun 4'ü başarısız | 6/6 | aynı |
| V211-01 yarış (üstlen, bırak, ertele, eski sürümle reddet) — sıra **pg_locks gözlemiyle** doğrulanır | [DB] | (v2.11.0'da 3/3 başarısız; `v2111/baseline-v2110/`) | 4/4; iki sinyal de gözlendi (değerlendirme kaynakta, komut iş satırında bekledi) | `v2112/api-parca2.log` ("SIRA" satırı) |

## Bulgular

| Bulgu | Kök neden | Değişen dosyalar | Sonra |
|---|---|---|---|
| V2111-R1 (P2) | `untilFor` her onayda `Date.now()` ile yeniden hesaplanıyor; `commandApi` işlem kimliğini gövdeden türettiği için zaman ilerleyince anahtar değişiyordu | `apps/web/src/product/pages/WorkItems.tsx` (ilk onaylanan komut `frozen`: gövde + mutlak bitiş anı; sonuç kesinleşene kadar aynı; belirsiz sonuçta alan değişikliği yeni komut göndermez; çatışma kesin sonuçtur, güncel kayda yeniden onay yeni komuttur) | Aynı alanlarla tekrar → aynı gövde ve anahtar → makbuz; 30/90 gün sınırı aynı (`v2111.test.ts` sınır testi [DB]) |
| V2111-R2 (P2) | `DTO.workItems.evaluations` alanı doğrulamıyordu; görünüm truthy/falsy ile karar veriyordu | `apps/web/src/product/dto.ts` (`E()` izin verilen değerler; `active_item_state` zorunlu, yalnız gerçek `null` geçerli; iş ve değerlendirme durumları da doğrulanır), `WorkItems.tsx` (tip zorunlu) | Eksik/boolean/boş/bilinmeyen → anlaşılır hata + yeniden dene; sorunsuzluk üretilmez |

Fikstür uyarlaması (üretici regresyonları): V2110 fikstürüne yalnız yeni zorunlu alan eklendi; özgünü `tools/tests/fe/arsiv/ui-regresyon.v2111-orijinal.cjs`; beklentiler aynı; olumsuz fikstürler otomatik null ile doldurulmadı.

## BOŞ turu 7h — kök neden (test verisi)

Final pakette tur ilk koşuda 7h'de düştü ve bu kez tanı kaydıyla yakalandı (`v2112/bos-7h-tani/`). Açılan aksiyon politika türündeki bir şablondu; eklenen kanıt ürün kuralı gereği aksiyonu doğrudan kapattı (POLICY_MET), İK İş Ortağının doğrulayacağı satır oluşmadı. Tur, sonuç verisini Python `hash()` ile üretiyordu; bu değer her süreçte rastgele tohumlanır, dolayısıyla her koşuda farklı zayıf maddeler, hedefler ve şablonlar seçiliyordu (dört tohumda dört farklı sonuç: `hash-tohum-karsilastirma.txt`). Düzeltme test aracında: kararlı `zlib.crc32` özeti (`tools/scripts/ui-bos-tur.py`; özgünü `tools/scripts/arsiv/ui-bos-tur.v2111-orijinal.py`). Sonra final pakette tur 52/52. Önceki 7h arızalarının da aynı nedenle oluştuğu, o koşuların tam kaydı olmadığı için **kanıtlanmış değildir**.

## Final paket üzerinde koşulanlar (build 39a2d66d1ee2)

| Grup | Sonuç | Tür | Kanıt |
|---|---|---|---|
| API (paketlenen kaynakla; aynı sıra ve veritabanıyla iki parça + sözleşme) | 50/50 + 45/45; 1.142 gerçek yanıt 0 sapma; OpenAPI 112 uç güncel; 152 kural 0 sorun | [DB] | `v2112/api-parca1.log`, `api-parca2.log`, `api-sozlesme.log` |
| DTO ⊆ sözleşme | 32 uç + 5 fixture; 0 uyumsuzluk (R2'nin kanıtı sayılmaz; R2 kanıtı yukarıdaki olumsuz testlerdir) | tip | `v2112/fe-kabul-paket-A.log` |
| Domain | 70/70 | birim | `v2112/domain-test.log` |
| Kapı A (dil 1086/112/103, yetki + uç sınıfı, istemci 5/5 + 10/10, denetçi tarayıcı 26/27 — LOGIN-ENTER belgeli istisna) | geçti | [UI] | `v2112/fe-kabul-paket-A.log` |
| Kapı R (156 regresyon; tek koşu kimliği, üç parça 52+52+52) + C | 156/156; C geçti | [UI] | `v2112/fe-kabul-paket-R0.log`, `-R1.log`, `-R2C.log` |
| Kapı B (bütün bağımsız karşı örnekler + v2.11.1 denetçi betikleri) | geçti | [UI]/[DB-KONTROLLÜ] | `v2112/fe-kabul-paket-B.log` |
| Kritik akışlar (57) | Chromium 57/57 · Firefox 57/57 · **WebKit 56/57 (V2100-URL)** | [UI] | `v2112/motorlar-paket/` |
| BOŞ / DOLU | 52/52 (ilk koşu 7h — yukarıda) · 8/8 | [PAKET] | `v2112/tur-1.log`, `bos-7h-tani/`, `demo-smoke.log` |
| Temiz kurulum | domain, web, API kurulum/derleme, 19 migrasyon, sözleşme --check, yapılandırma: 0 | kaynak | `v2112/temiz-kurulum.log` |
| v2.11.1 → v2.11.2 yükseltme | bütün sayımlar aynı (bekleyen iş ve kural değerlendirmesi dahil); MFA, rol, atama korunmuş | [PAKET] | `v2112/yukseltme-v2111/` |
| Migrasyonlar | 0001–0019 v2.11.1 ile AYNI; yeni yok | SHA-256 | `v2112/migrasyon-karsilastirma/sonuc.txt` |

## Açık kalanlar

- WebKit V2100-URL: açık, neden belirlenemedi. Linux WebKit ≠ Safari.
- 20 şirket yükü, gerçek Safari/cihaz, ekran okuyucu, gerçek %200 yakınlaştırma, Genel bakış, Sistem ve teslimatlar, canlıya çıkış kapıları: açık.
- Düzeltilmiş tur, final pakette bir kez koşuldu; tekrar sayısı bir.
- Sonuçlar üretici koşularıdır; bağımsız yeniden denetim yapılmadı.
