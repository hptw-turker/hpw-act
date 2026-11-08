# HPW Act v2.10.1 — Bağımsız v2.10.0 denetimine yanıt

Yanıtlanan: "HPW Act v2.10.0 bağımsız denetim" (build 372b8231aec0) ve düzeltme görevi. Kapsam yalnız V210-01…06 ve bu dilimin kapanış kontrolleridir; 2.11 kapsamı eklenmedi.
Kanıt kökü: `GELISTIRICI_KAYNAK/docs/test-ciktilari/v2101/` (aşağıda `v2101/`).
Test türleri: **[DB]** gerçek PostgreSQL + gerçek Fastify HTTP; **[UI]** gerçek Chromium + kontrollü HTTP yanıtları (veri izolasyonunu kanıtlamaz); **[DB-KONTROLLÜ]** gerçek Fastify işleyicileri + kurulum hesabı, sorgular denetçi düzeneğinde (gerçek PostgreSQL değil); **[PAKET]** teslim ZIP'inden gerçek başlatıcı + gerçek PostgreSQL.

## 1. Önce: bulguların değiştirilmemiş v2.10.0'da yeniden üretilmesi

Denetçinin `independent-ui.cjs` ve `independent-api.mjs` dosyaları değiştirilmeden, `HPW_Act_TESLIMAT_v2.10.0_372b8231aec0.zip` içindeki web ve API derlemesiyle koşuldu: **7/7 UI senaryosu FAIL, API senaryosu FAIL** (`v2101/baseline-v2100/`).

## 2. Bulgu bazında kapanış

| Bulgu | Kök neden | Değişen dosyalar | Önce → sonra | Testler | Ham kanıt |
|---|---|---|---|---|---|
| V210-01 (P1) | Hizmet kaydı `null` iken form sıfırlanmıyordu; önceki şirketteki işlemin tamamlanması yeni şirketin ortak istek neslini artırıyordu; iletiler/pencere/bekleyen işlem şirketten bağımsızdı | `apps/web/src/product/pages/PlatformCompany.tsx` | B formunda A verisi → boş; A2: B “Yükleniyor”da kalıyordu → B yüklenir | denetçi V210-A, V210-A2 [UI]; V2101-A-DOLU-BOS, V2101-A-SURERKEN [UI] | `v2101/fe-paket/bagimsiz-v2100/ui/`, `v2101/fe-paket/ui-regresyon-sonuc.parca-*.json` |
| V210-02 (P1) | Müşteri uçları yalnız kayıtlı onayların parmak izlerini karşılaştırıyordu; merkezin güncel kanıt hesabını kullanmıyordu | `apps/api/src/routes/tenant.ts`, `apps/api/src/onboarding.ts`, `db/migrations/0018_v2101_denetim_kapanisi.sql` (müşteri yalnız kendi şirketinin HPW atamalarını kanıt alanlarıyla okur) | eski onay “teyit bekleniyor” + teyit 200 → `state: recheck`, `fingerprint: null`, teyit **409** (kayıt ve iz yok) | denetçi V210-F [DB-KONTROLLÜ]; `apps/api/test/v2101.test.ts` iki test [DB]: dört kaynak değişimi (hizmet kaydı, sonuç partisi, izlenen dönem, ana danışman) + iki bağlantılı iki yarış | `v2101/fe-paket/bagimsiz-v2100/api/results.json`, `v2101/api-npm-test.log` |
| V210-03 | İşlem hatası ile okuma hatası aynı durumdaydı; `load()` işlem hatasını siliyordu | `PlatformCompany.tsx` | 409 uyarısı kayboluyordu → uyarı kalır, taslak korunur, sunucudaki güncel kayıt gösterilir, “Taslağı bırak” seçeneği | denetçi V210-B [UI]; V2101-B-TOPARLANMA (409/503/başarılı tekrar), V2101-B-AG (ağ kesintisi) [UI] | aynı |
| V210-04 | Kart hata ve bozuk yanıtta hiç görünmüyordu | `apps/web/src/product/pages/GoLiveCard.tsx`, `dto.ts` | kart kayboluyordu → altı ayrı durum; hata uyarısı + çalışan “Yeniden dene”; başarılı tekrar hatayı temizler | denetçi V210-C-503, V210-C-malformed [UI]; V2101-C-TEKRAR/RECHECK/ONAYYOK/TEYITLI [UI] | aynı |
| V210-05 | Gönderim sırasında pencere kontrolleri `disabled` oluyordu; odak arka plana kaçıyordu | `apps/web/src/product/Dialog.tsx` | Tab arka plana gidiyordu → pencere belge kökünde (portal), uygulama kökü `inert`; gönderimde kontroller salt okunur/aria-disabled, odak pencerede | denetçi V210-D [UI]; V2101-D-ODAK (Tab/Shift+Tab, arka plan tıklaması, hata, başarı, odağın dönüşü) [UI] | aynı |
| V210-06 | `.sr-only` tablo başlığı konumlandırılmamış kaydırma alanının dışına taşıyordu | `apps/web/src/styles/components.css` | 320 px'te belge 539 px → 320 px | denetçi V210-E [UI]; V2101-E-DAR (5 ekran × 320/640 px) [UI] | aynı |

Denetçinin testleri depoda `tools/tests/bagimsiz-v2100/` altında **bayt düzeyinde aynı** duruyor ve standart ön yüz kapısına bağlı (`ADAPTASYON.md`: yalnız ortam değişkenleri; sorgu düzeneğinde uyarlama gerekmedi — gerekçesi belgede).

## 3. Kullanıma açılış kanıt zinciri (V210-02) — beklenen durumlar

Müşteri alanı artık merkezle aynı hesabı (`computeOnboarding`) kullanır; `GET /api/t/:tid/onboarding/go-live` → `state ∈ {not_started, blocked, in_progress, done, recheck}`; `fingerprint` yalnız `in_progress` (geçerli HPW onayı, teyit bekleniyor) durumunda dolu. Ayrıntılı tablo: `KURULUM-DURUMLARI-v2.10.0.md` (değişmedi) + aşağıdaki ekler:

- Kaynak değişikliği HPW onayını geçersiz kılınca müşteri alanı da `recheck` gösterir; teyit 409 `evidence_changed`, onay kaydı ve iz oluşmaz.
- Yarış (a): şirket kaydını değiştiren transaction sürerken müşteri teyidi şirket satırındaki paylaşımlı kilitte bekler; değişiklik tamamlanınca güncel kanıtı görür → 409. [DB, iki bağlantı]
- Yarış (b): HPW yeni kanıtı onaylarken müşteri eski parmak iziyle teyit gönderir; ikisi aynı kilitte bekler, hangi sırayla işlenirse işlensin teyit reddedilir, iki alan `in_progress` gösterir. [DB, iki bağlantı]
- Sınır: şirket satırını değiştirmeyen kaynaklar (sonuç yayımı, atama, davet) teyitle aynı anda işlenirse teyit o anki geçerli kanıta bağlanır; değişiklik tamamlanınca iki alan da `recheck` gösterir — adım hiçbir sıralamada güncel olmayan kanıtla `done` görünmez.
- HPW personeli (müdahale modunda da) teyit veremez (v2.10.0 testi korunuyor).

## 4. BOŞ 7h zaman aşımı

İlk v2.10.0 paket koşusunda tur, 7h adımında (İK İş Ortağı aksiyon listesinde "tamamlandı" satırı ve "Aç" düğmesi) 15 sn'de öğe bulamadı. O koşunun tam kaydı **korunmadı** (yalnız hata iletisi). Bu turda: tur, bu adımda hata olursa ağ yanıtlarını (zaman, durum, uç), konsol hatalarını, dönem/birim seçimini, sayfa metnini ve tam sayfa ekran görüntüsünü kaydeder. Sonraki üç temiz koşu (v2.10.0'da 1, v2.10.1 final paketinde 2) 52/52 geçti; hata yeniden oluşmadı. **Kök neden bulunamadı**; olası (kanıtlanmamış) neden: dönem/birim listeleri yüklenmeden birim seçimi. Bekleme süreleri artırılmadı; madde açık belirsizlik olarak kapanış belgesinde.

## 5. Final paket üzerinde koşulanlar (build 1d493310fb3d)

| Grup | Sonuç | Tür | Kanıt |
|---|---|---|---|
| API (eski + v2.9.1 + v2.10.0 + regresyon + v2.10.1 + yapılandırma) | 79/79; 944 gerçek yanıt 0 sapma; OpenAPI 109 uç güncel; 135 kural 0 sorun | [DB] | `v2101/api-npm-test.log` |
| Domain | 70/70 | birim | `v2101/domain-test.log` |
| Ön yüz kapısı — A: dil (1001/104/103), yetki+uç sınıfı, DTO⊆sözleşme (29 uç), istemci 5/5+10/10, denetçi 26/27 (LOGIN-ENTER belgeli) | geçti | [UI]/tip | `v2101/fe-kabul-paket-A.log` |
| Ön yüz kapısı — R: 117 tarayıcı regresyonu (iki parça: 59 + 58) | 0 başarısız | [UI] | `v2101/fe-kabul-paket-R0.log`, `-R1.log` |
| Ön yüz kapısı — B: N01–N03, R01–R04, kapsam, V290 (3), V210 UI 7/7, V210 API 1/1 | geçti | [UI]/[DB-KONTROLLÜ] | `v2101/fe-kabul-paket-B.log` |
| BOŞ turu, iki ayrı temiz kurulum | 52/52 ve 52/52 | [PAKET] | `v2101/tur-1.log`, `v2101/tur-2.log` |
| DOLU duman (iki ortam aynı anda) | 8/8 | [PAKET] | `v2101/demo-smoke.log` |
| Temiz kurulum (ZIP kaynağı; bağımlılık ve fixture yok) | domain, web, API kurulum/derleme, 18 migrasyon, sözleşme --check, yapılandırma: hepsi 0 | kaynak | `v2101/temiz-kurulum.log` |
| v2.9.1 → v2.10.1 yükseltme | şema dışında bütün sayımlar aynı; MFA, rol, atama korunmuş | [PAKET] | `v2101/yukseltme-v291/` |
| 0014–0016 (v2.9.1 ile) ve 0017 (v2.10.0 ile) değişmedi | AYNI | SHA-256 | `v2101/migrasyon-karsilastirma/sonuc.txt` |

Ön yüz kapısı bu ortamın 300 sn'lik tek komut sınırı nedeniyle parçalar hâlinde koşuldu (`FE_PART=A|R|B`, regresyonlar `REG_SPLIT=k/2`); varsayılan komut (`node tools/tests/fe/run-fe-tests.mjs`) değişmeden hepsini koşar.

## 6. Test edilmeyenler ve açık kalanlar

- Mac/Safari, Firefox, WebKit, gerçek dokunmatik cihaz, ekran okuyucu (VoiceOver/NVDA) ile elle kontrol: **test edilmedi**.
- Gerçek tarayıcı yakınlaştırması (%200): **test edilmedi**; 640 CSS px genişliği (1280 px'te %200'e karşılık gelen genişlik) ölçüldü.
- BOŞ 7h: kök neden açık (bölüm 4).
- Değişmeyen akışlar (görevi bitirme, rol değiştirme, erişim kaldırma, doğrulama sıfırlama, yönetici daveti) hâlâ tarayıcı istemiyle.
- Canlıya çıkış kapıları ve 2.11 kapsamı: açık.
- Sonuçlar üretici koşularıdır; bağımsız tekrar önerilir.
