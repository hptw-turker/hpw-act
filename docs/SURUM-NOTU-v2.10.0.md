# HPW Act v2.10.0 — Şirket işletimi (tasarım v2 dilim 2)

Kapsam: "Çok Şirketli Merkez Paneli" gereksinimleri (27.09.2026) ve tasarım v2 dilim 2 — şirket detayı, on adımlı kalıcı kurulum, izlenen dönem, arşiv ve yaşam döngüsü, filtre/sıralama/sayfalama ve adres çubuğu durumu, derin bağlantılar; bu akışların güvenlik, erişilebilirlik (MP16), sözleşme (MP17) ve regresyon gereklilikleri. 2.11.0 kapsamı (bekleyen işler, gösterge sözlüğünün tamamı, Sistem ve teslimatlar, 20 şirket yük testi, tarayıcı matrisi) bu sürümde yok.

Ayrıntılar: `KURULUM-DURUMLARI-v2.10.0.md` (on adım × beş durum, parmak izleri, kanıt zinciri), `TEST-DEGISIKLIKLERI-v2.10.0.md` (eski/yeni beklentiler, etkileşim uyarlamaları).

## v2.9.1'de bulunan üç hata (v2.9.1 başarısız / v2.10.0 başarılı — gerçek PostgreSQL + HTTP)

| Hata | v2.9.1 | v2.10.0 | Ham kanıt |
|---|---|---|---|
| A) Mevcut ana danışmana yedek görevi devri ana görevini siliyordu | 200 (kabul) | 409, hiçbir atama kısmen değişmez; beş yolun beşi de korunur | `test-ciktilari/v2100/baseline-v291/v2100-regresyon-v291-kaynak.log` ↔ `test-ciktilari/v2100/api-npm-test.log` |
| B) HPW personelinde aynı komut + aynı istemci anahtarı iki iş etkisi üretiyordu (oturumda seçili şirket yokken tekrar güvenliği devre dışı); farklı iki komutta aynı anahtar merkezi izi düşürüyordu | 2 etki | 1 etki; farklı komutta iki iz; farklı içerikte 409; şirket ve kullanıcı kapsamı ayrı; iz yazılamazsa iş geri alınır | aynı |
| C) İki sekme: A komutunun yanıt kaybı sonrası yeniden denemesi A'da ikinci etki üretiyordu | 2 etki | 1 etki, B'de değişiklik yok, kayıtlar A bağlamında, yetki düşünce yeniden deneme 403 | aynı |

v2.9.1 koşusunda yalnız ortam uyarlaması yapıldı (bağımlılık bağlantısı, test dosyasının kopyası, ayrı test veritabanı): `baseline-v291/OKU.md`.

## Gereksinim → değişen dosya → test → ham kanıt

| Gereksinim | Değişen dosyalar | Testler (tür) | Ham kanıt (`test-ciktilari/v2100/`) |
|---|---|---|---|
| MP03 kalıcı kurulum, 5 durum, elle onay parmak izi, kanıt değişimi, eşzamanlılık | `onboarding.ts`, `routes/platform.ts` (detay, hizmet kaydı, onay), 0017 (`onboarding_approval`) | v2100 "Kurulum" + "Kurulum 4 ve 10" [DB]; V2100-KURULUM [UI] | `api-npm-test.log`, `fe-paket/ui-regresyon-sonuc.json` |
| MP03 adım 10 müşteri teyidi (iki taraflı zincir; HPW/müdahale ile verilemez) | `routes/tenant.ts`, `governance.ts`, `pages/GoLiveCard.tsx`, `permissions.ts`, 0017 politikaları | "Kurulum 4 ve 10" [DB]; V2100-MUSTERI-TEYIT [UI] | aynı |
| MP04 bağlam güvenliği (geç yanıt, açık pencerede şirket değişimi, iki sekme) | `pages/PlatformCompany.tsx`, `pages/Platform.tsx`, `Dialog.tsx`, `server.ts` (tekrar güvenliği isteğin şirketine) | regresyon C [DB]; V2100-GEC-YANIT, V2100-DLG-BAGLAM, V2100-IKI-SEKME [UI] | aynı |
| MP07 dönem kapsamı (izlenen dönem yoksa null + gerekçe) | `routes/platform.ts` portföy, 0017 bileşik yabancı anahtar | "Dönem kapsamı" [DB]; V2100-DONEM-YOK [UI]; sözleşme doğrulaması | aynı |
| MP09 sorumluluk bütünlüğü (bütün devir yolları, önizleme) | 0017 `platform_handover`, `pages/Platform.tsx` (devir önizleme penceresi) | regresyon A [DB]; SEC-EKIP [UI] | aynı |
| MP11 yaşam döngüsü (arşiv; oturum, süren yazma, kuyruk, müdahale) | 0017 (`platform_set_tenant_status`, `tenant_status_lock`, `outbox_claim`, erişim fonksiyonu), `db.ts` | "Arşiv yaşam döngüsü" + "Durdurma/arşiv geçişi" [DB]; MP-PANEL-DURDUR [UI] | aynı |
| MP12 işlem bütünlüğü ve iz anahtarı | `db.ts`, `server.ts`, 0017 benzersiz indeks | regresyon B [DB] | aynı |
| MP13/MP14 adres çubuğu durumu, geri/ileri, Merkeze dön, kararlı sıralama | `pages/Platform.tsx`, `App.tsx` | V2100-URL, V2100-MERKEZE-DON [UI] | aynı |
| MP16 erişilebilir onay (klavye, odak tuzağı, Escape, odağın dönüşü, hata iletisi, çift gönderim) | `Dialog.tsx`, `styles/components.css` | V2100-DLG-KLAVYE [UI] | aynı |
| MP17 sözleşme ve DTO (yeni uçlar, null, 409 gövdeleri) | `contract/domain-map.ts`, `scripts/openapi-gen.mts`, `dto.ts`, `tools/tests/fe/dto-contract.mts` | sözleşme doğrulaması (871 gerçek yanıt), kapsam denetimi, DTO⊆sözleşme, V2100-DTO-DETAY [UI] | `api-npm-test.log`, `fe-kabul-paket.log` |
| TR/EN | `i18n/en.json` | dil kapsamı | `fe-kabul-paket.log` |

Test türleri: [DB] gerçek PostgreSQL + gerçek Fastify HTTP (`apps/api/test/v2100.test.ts`, `v2100-regresyon.test.ts`); [UI] gerçek Chromium + **kontrollü HTTP yanıtları** (`tools/tests/fe/ui-regresyon.cjs`) — UI testleri veri izolasyonunu kanıtlamaz, bu [DB] testlerinin işidir.

## Final paket üzerinde koşulanlar (build 372b8231aec0)

| Grup | Sonuç | Kanıt |
|---|---|---|
| API (gerçek PostgreSQL): eski + v2.9.1 + v2.10.0 + regresyon + yapılandırma | 77/77; 871 gerçek yanıt 0 sapma; OpenAPI 109 uç güncel; kapsam 134 kural 0 sorun | `api-npm-test.log` |
| Domain | 70/70 | `domain-test.log` |
| Ön yüz kabul kapısı (paketin web + API derlemesi) | tamamı geçti: dil kapsamı (994/104/103, eksik 0); yetki ve uç sınıfı sözleşmesi; DTO⊆sözleşme (29 uç); istemci 5/5 + 10/10; denetçi 26/27 (belgeli LOGIN-ENTER); 107 regresyon (10 yeni); N01–N03; R01–R03; R04; bağımsız V290 UI/yapılandırma/API | `fe-kabul-paket.log`, `fe-paket/` |
| BOŞ turu (gerçek sunucu) | 52/52 — **ilk koşuda 7h adımında (İK İş Ortağı aksiyon listesi) zaman aşımı**; aynı paketin temiz ikinci koşusu 52/52; kök neden bulunamadı, tur betiğine tanı çıktısı eklendi | `tur.log` (ikinci koşu) |
| DOLU duman (iki ortam aynı anda) | 8/8 | `demo-smoke.log` |
| Temiz kurulum (ZIP kaynağı, bağımlılık ve fixture yok): domain, web, API kurulum/derleme, boş veritabanına 17 migrasyon, sözleşme --check, yapılandırma testleri | hepsi 0 | `temiz-kurulum.log` |
| v2.9.1 → v2.10.0 yükseltme: veri, roller, atamalar, MFA erişimi, müşteri oturumları | şema dışında bütün sayımlar aynı; MFA girişi, rol ve ana danışman ataması korunmuş | `yukseltme-v291/` |
| 0014–0016 değişmedi (SHA-256; 0001–0013 de aynı) | AYNI | `migrasyon-karsilastirma/sonuc.txt` |

## Test edilmeyenler ve açık kalanlar

- Mac/Safari, Firefox ve WebKit: **test edilmedi**. Ekran okuyucu (VoiceOver/NVDA) ile elle kontrol: **yapılmadı**; erişilebilirlik bu sürümde yalnız yeni onay akışlarında otomatik tarayıcı testleriyle sınandı.
- %200 yakınlaştırma ve 320 px genişlik kontrolleri: yapılmadı (2.11.0).
- "Görevi bitir", rol değiştirme, erişim kaldırma, doğrulama sıfırlama ve yönetici daveti hâlâ tarayıcı istemiyle (bu sürümde değişmeyen akışlar; denetçi testleri bunlara dayanır).
- DOLU demo verisinde izlenen dönem seçili değil: portföyde döneme bağlı sayaçlar "izlenen dönem yok" görünür (kural gereği).
- Bekleyen işler, gösterge sözlüğünün tamamı, Sistem ve teslimatlar, 20 şirket veri üreteci ve yük testi, tarayıcı/erişilebilirlik matrisi: 2.11.0.
- Bağımsız denetim yapılmadı; bu sonuçlar üretici koşularıdır.
