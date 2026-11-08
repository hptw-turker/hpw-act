# HPW Act v2.11.0 — "Bekleyen işler" bölümü teslimi

Kapsam: tasarım v2 §5.5, §7 ve MP08 (bekleyen işler) ile bu bölümün güncellik (MP10 dar kısmı), sözleşme (MP17) ve erişilebilir işlem gereklilikleri; ayrıca bu çalışmada bulunan başarısız davet sayacı hatası (V211-DAVET). **Kapsam dışı ve açık:** yük testi (20 şirket), Sistem ve teslimatlar, Genel bakış, BOŞ 7h, WebKit V2100-URL çökmesi, gerçek Safari/cihaz, ekran okuyucu, gerçek %200 yakınlaştırma, canlıya çıkış kapıları.

Kurallar ve davranış: `docs/tasarim/BEKLEYEN-ISLER-KURALLARI-v2.11.md`. Yük ölçümü tanımı ve kritik akış listesi: `docs/tasarim/PLAN-v2.11.0.md`. Kanıt kökü: `GELISTIRICI_KAYNAK/docs/test-ciktilari/v2110/` (aşağıda `v2110/`).
Test türleri: **[DB]** gerçek PostgreSQL + gerçek Fastify HTTP · **[UI]** gerçek tarayıcı motoru + kontrollü HTTP · **[DB-KONTROLLÜ]** gerçek Fastify, sorgular test düzeneğinde (PostgreSQL değil) · **[PAKET]** teslim ZIP'inden gerçek başlatıcı + gerçek PostgreSQL.

## Gereksinim → dosya → test → kanıt

| Gereksinim | Değişen dosyalar | Testler | Ham kanıt |
|---|---|---|---|
| Dokuz kural; şirket+kural başına tek etkin iş; etkilenen kayıt özeti | `db/migrations/0019_v2110_bekleyen_isler.sql`, `apps/api/src/workitems.ts` | v2110: kural yaşam döngüsü; tek etkin iş (4 durum × eşzamanlı değerlendirme); eşzamanlı değerlendirme [DB] | `v2110/api-npm-test.log` |
| Kaynak okunamadı / değerlendirilemedi ayrımı; iş kapanmaz; son başarılı doğrulama korunur; kural başına güncellik | `workitems.ts`, 0019 (`platform_work_eval`) | v2110: okunamayan kaynak; değerlendirilemeyen kural + mevcut iş [DB]; V2110-LISTE [UI] | aynı; `v2110/fe-paket/ui-regresyon-sonuc.json` |
| Erteleme/reddetme bitişi, sahibin güncel yetkisi, askıdan dönüş (körlemesine geri yükleme yok), askıda süreler | `workitems.ts` | v2110: yaşam döngüsü; sahip yetkisi + askıdan dönüş + okunamayan kaynakta belirsizlik [DB] | aynı |
| Sorun sürerken aynı kayıt; çözülüp tekrar oluşunca yeni kayıt; kanıt ve geçmiş korunur | `workitems.ts` | v2110: kural yaşam döngüsü, yaşam döngüsü [DB] | aynı |
| Üstlen/bırak/ertele/reddet: yetki (sunucu + RLS), sürüm çatışması, eşzamanlı üstlenme, işlem anahtarı tekrarı ve çatışması, güncel yetki, şirketler arası ayrım | `apps/api/src/routes/platform.ts`, 0019 (`platform_command`, RLS) | v2110: üstlenme; şirketler arası ayrım [DB]; V2110-USTLEN-CIFT, -CATISMA, -MAKBUZ, -ERTELE, -BAGLAM, -YETKI [UI] | aynı |
| İşlem geçmişi (kim, ne, ne zaman, gerekçe; sistem olayları) | `routes/platform.ts`, `pages/WorkItems.tsx` | v2110 yaşam döngüsü (8 olay türü) [DB]; V2110-GECMIS [UI] | aynı |
| Değerlendirme yalnız liste açılışında; ilk görünüm değerlendirmeyi beklemez; kısmi hata; süre sınırı sonrası bağlantı/kilit birikmez | `routes/platform.ts` (`evaluate=0`, kilit 2 sn / sorgu 5 sn / liste 8 sn), `workitems.ts`, `pages/WorkItems.tsx` | v2110 kısmi hata: ilk görünüm 112 ms, değerlendirmeli 4,2 sn, açık transaction 0, kilit bekleyen 0 [DB]; V2110-ILK-GORUNUM: satır ve düğme 350 ms'de, değerlendirme 6 sn [UI] — dar senaryo, yük testi değildir | aynı |
| **V211-DAVET** başarısız davet ortak tanımı (portföy, kurulum, kural) | 0019 `tenant_failed_invitations`, `routes/platform.ts`, `onboarding.ts`, `workitems.ts` | `davet-teslimat.test.ts` [DB]: 3 deneme → 1; başarılı teslim 1 → 0 ve 3 geçmiş hata korunur; iptal 0; süresi dolan 0 (kurulumda engel); geri alınınca 1; kabul 1 → 0; başka şirket 0 | `v2110/api-npm-test.log`; önce: `v2110/baseline-v2102/` |
| Erişilebilir işlem pencereleri (tarih + gerekçe, odak, çift gönderim, bağlam değişimi) | `Dialog.tsx` (tarih alanı), `pages/WorkItems.tsx` | V2110-ERTELE (odak tarih alanında, doğrulamalar), -USTLEN-CIFT, -BAGLAM [UI] | `v2110/fe-paket/` |
| Sözleşme ve çalışma anı doğrulaması (iş durumu ≠ değerlendirme durumu; 409 gövdeleri; tekrar; 404) | `contract/domain-map.ts`, `scripts/openapi-gen.mts`, `dto.ts`, `tools/tests/fe/dto-contract.mts` | 1.110 gerçek yanıt 0 sapma; 151 kural 0 sorun; DTO⊆sözleşme 32 uç; V2110-DTO [UI] | `v2110/api-npm-test.log`, `v2110/fe-kabul-paket-A.log` |
| TR/EN | `i18n/en.json` | dil kapsamı (1.080 / 112 / 103; eksik 0) | `v2110/fe-kabul-paket-A.log` |
| Kullanım kılavuzu | `tools/guides/content.py` | — | `docs/guides/v2.11.0/` |

## Önceki başarısız davranış kanıtları

- **V211-DAVET:** aynı test değiştirilmemiş v2.10.2 kaynağında (ayrı veritabanı, v2.10.2 migrasyonları) **ilk doğrulamada** başarısız: kalıcı hatalı davet için portföy 0 (beklenen 1). Test orada durduğu için diğer senaryolar v2.10.2'de ayrıca gözlenmedi. `v2110/baseline-v2102/`.
- Bekleyen işler yeni bir bölümdür; önceki sürümde karşılığı yoktur.

## Final paket üzerinde koşulanlar

| Grup | Sonuç | Tür | Kanıt |
|---|---|---|---|
| API (bütün gruplar; v2110 10, davet 1 dahil) — paketlenen kaynakla | 91/91; 1.110 yanıt 0 sapma; OpenAPI 112 uç güncel; 151 kural 0 sorun | [DB] | `v2110/api-npm-test.log` |
| Domain | 70/70 | birim | `v2110/domain-test.log` |
| Ön yüz kapısı A (dil, yetki + uç sınıfı, DTO⊆sözleşme, istemci 5/5 + 10/10, denetçi tarayıcı 26/27 — LOGIN-ENTER belgeli istisna) | geçti | [UI]/tip | `v2110/fe-kabul-paket-A.log` |
| Ön yüz kapısı R (133 regresyon; tek koşu kimliği, iki parça 67 + 66) + C (sonuç denetimi bu koşunun birleşik sonucuyla) | 133/133; geçti | [UI] | `v2110/fe-kabul-paket-R0.log`, `-R1C.log`, `fe-paket/ui-regresyon-sonuc.json` + `.meta.json` |
| Ön yüz kapısı B (N01–N03, R01–R04, kapsam, V290 ×3, V210 7 UI + 1 API, V2101 3 UI, makbuz kabulü 9 kontrol) | geçti | [UI]/[DB-KONTROLLÜ] | `v2110/fe-kabul-paket-B.log` |
| Kritik akışlar (34), motor başına | Chromium 34/34 · Firefox 34/34 · **WebKit 33/34 (V2100-URL çökmesi)** | [UI] | `v2110/motorlar-paket/` |
| BOŞ turu | 52/52 | [PAKET] | `v2110/tur-1.log` |
| DOLU duman (iki ortam aynı anda) | 8/8 | [PAKET] | `v2110/demo-smoke.log` |
| Temiz kurulum | domain, web, API kurulum/derleme, 19 migrasyon, sözleşme --check, yapılandırma: 0 | kaynak | `v2110/temiz-kurulum.log` |
| v2.10.2 → v2.11.0 yükseltme | şema dışında sayımlar aynı; MFA, rol, atama korunmuş; bekleyen işler 200 | [PAKET] | `v2110/yukseltme-v2102/` |
| Migrasyonlar | 0001–0018 v2.10.2 ile AYNI; 0014–0016 v2.9.1 ile AYNI; yeni: 0019 | SHA-256 | `v2110/migrasyon-karsilastirma/sonuc.txt` |

Ön yüz kapısı ortamın 300 sn komut sınırı nedeniyle parçalar hâlinde koşuldu; her parça bu tur için yeni çıktı dizininde ve tek regresyon koşu kimliğiyle; varsayılan komut hepsini tek seferde koşar.

## Açık ve çalıştırılmamış maddeler

- **WebKit V2100-URL:** açık; neden belirlenemedi (`v2110/webkit-tani/OKU.md`). WebKit 33/34; tarayıcı kabulü tamamlanmış sayılmaz. Linux WebKit ≠ Safari.
- **Çalıştırılmadı:** 20 şirket yük testi (ölçüm tanımı yazıldı, ölçüm yapılmadı); gerçek Safari/iOS ve cihazlar; ekran okuyucu; gerçek %200 yakınlaştırma.
- **Bu bölümün sınırları:** arka plan değerlendiricisi yok (değerlendirme liste açılışında); resmî tatil takvimi yok; "doğrulama birikti" kuralında beyan zamanı olarak aksiyonun son güncelleme zamanı kullanılıyor.
- **Sonraki aşamalar:** Genel bakış, Sistem ve teslimatlar, yük testi, erişilebilirlik ölçümleri; BOŞ 7h ve canlıya çıkış kapıları açık.
- Sonuçlar üretici koşularıdır; bağımsız denetim yapılmadı.
