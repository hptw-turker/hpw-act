# v2.10.0 — mevcut testlerde yapılan değişiklikler

## 1. Beklenti değişikliği (gerekçeli)

| Test | Eski beklenti | Yeni beklenti | Gerekçe |
|---|---|---|---|
| `apps/api/test/v01-v28.test.ts` — "v2.8.0 MP: HPW merkez paneli…" | İzlenen dönemi seçilmemiş şirkette `summary.counts.overdueActions` **sayı** (bütün dönemlerin toplamı) | Aynı durumda **`null`**; `summary.cycleBound = 'no_tracked_cycle'` (v2.10.0 testleri ayrıca sınar) | İş sahibinin koşulu: döneme bağlı göstergeler bütün dönemlerin toplamı gibi sunulmaz; gereksinimler §6 "izlenen dönem açıkça seçilmelidir". |

## 2. Yalnız etkileşim yöntemi değişen tarayıcı testleri (beklenen iş sonucu ve güvenlik koşulu aynı)

Özgünleri: `tools/tests/fe/arsiv/ui-regresyon.v291-orijinal.cjs`.

| Test | Eski etkileşim | Yeni etkileşim | Değişmeyen beklenti |
|---|---|---|---|
| MP-PANEL-DURDUR | `durdur` → tarayıcı istemi (vazgeç / "ab" / "ödeme yok") | `durdur` → onay penceresi: "Vazgeç"; gerekçe "ab" + "Durdur"; gerekçe "ödeme yok" + "Durdur" | vazgeçince 0 istek; kısa gerekçe hata iletisi ve 0 istek; tek POST gövdesi `reason: 'ödeme yok'`; satırda "durduruldu · ödeme yok"; "etkinleştir" düğmesi |
| MFA-YENIDEN | gerekçe ve kod tarayıcı isteminde | gerekçe pencerede; yeniden doğrulama kodu tarayıcı isteminde (değişmedi) | 2 POST, aynı Idempotency-Key, tek yeniden doğrulama `654321`, başarı iletisi |
| SEC-EKIP | "Atamayı kaydet" doğrudan POST | "Atamayı kaydet" → devir önizleme penceresi → "Devri onayla" | tek POST, `duty: primary`, `handoverFrom` önceki ana danışman |

## 3. Test düzeneği

`tools/tests/fe/harness.cjs`: kontrollü HTTP yakalaması sayfa (`p.route`) yerine tarayıcı bağlamında (`context.route`) — ikinci sekme senaryosu (V2100-IKI-SEKME) aynı yakalamayı kullanabilsin diye. Özgünü: `tools/tests/fe/arsiv/harness.v291-orijinal.cjs`. Diğer bütün testler değişmeden geçer.

## 4. Denetçi testleri

`tools/tests/bagimsiz-v290/*` ve daha önceki bağımsız testler **değiştirilmedi** (v2.10.0'da uyarlama gerekmedi: denetçinin kullandığı "görevi bitir" akışı tarayıcı istemiyle aynı kaldı).

## v2.10.1 ekleri

| Test | Değişiklik | Gerekçe |
|---|---|---|
| V2100-MUSTERI-TEYIT (fikstür) | kontrollü `GET /onboarding/go-live` yanıtına `state: 'in_progress'` eklendi; beklenti (kart, pencere, gövdedeki parmak izi) aynı | V210-02: yanıt artık merkezle ortak geçerlilik durumunu taşıyor ve çalışma anı DTO'su bu alanı zorunlu tutuyor |
| V2101-B-TOPARLANMA, V2101-B-AG, V2101-D-ODAK (yeni) | 503/ağ kesintisinden sonra 2,8–4,5 sn bekleme | komut istemcisi geçici hatada iki kez yeniden dener (400 + 800 ms); beklemeler bu davranışı gözlemek için, bir hatayı gizlemek için değil |
| `run-fe-tests.mjs`, `ui-regresyon.cjs` | `FE_PART=A|R|B` ve `REG_SPLIT=k/n` seçenekleri | ortamın 300 sn tek komut sınırı; varsayılan komut hepsini tek seferde koşar |
| `ui-bos-tur.py` | 7h adımında hata olursa ağ, konsol, seçim, sayfa metni ve ekran görüntüsü kaydı | BOŞ 7h zaman aşımının tanısı; bekleme süreleri değiştirilmedi |
| `tools/tests/bagimsiz-v2100/*` | denetçinin dosyaları değiştirilmeden eklendi | V210 karşı örnekleri standart kapıda |

## v2.10.2 ekleri

| Değişiklik | Gerekçe |
|---|---|
| `tools/tests/bagimsiz-v2101/*` denetçinin dosyaları değiştirilmeden eklendi; `edge-ui.cjs` kapıya (B) bağlı; `receipt-api.mjs` bağlanmadı | sonda bir ulaşılabilirlik sondasıdır; düzeltmeden sonra düzeneği makbuz sorgularını modellemediğinden altyapı hatasıyla biter (`ADAPTASYON.md`); kabul testi gerçek PostgreSQL'de |
| `ui-regresyon.cjs`: `REG_RUN` ile parça sonuçları aynı koşuda birleştirilir (`ui-regresyon-sonuc.meta.json`) | v2.10.1'de sonuç denetiminin başka koşunun dosyasını okuması (DENETIM-YANITI-v2.10.2 §3) |
| `run-fe-tests.mjs`: sonuç denetimi ayrı adım `C`; koşu kimliği doğrulanır | aynı |
| 6 yeni tarayıcı senaryosu (V2102-*) | V2101-01/02 kapanışı; beklemeler komut istemcisinin iki yeniden denemesini gözlemek için |

## v2.11.2 ekleri

| Değişiklik | Gerekçe |
|---|---|
| `ui-regresyon.cjs` V2110 fikstürü: `evaluations[0]` nesnesine `active_item_state: 'open'` eklendi (özgünü `arsiv/ui-regresyon.v2111-orijinal.cjs`) | V2111-R2: alan artık zorunlu ve çalışma anında doğrulanıyor; fikstür gerçek sözleşmedeki değeri taşır (listede açık `invite_failed` işi var). Beklentiler değişmedi. Olumsuz testler (eksik/boolean/boş/bilinmeyen) ayrıca V2112-R2-* olarak var; fikstürler otomatik null ile doldurulmadı |
| `apps/api/test/v2111.test.ts` yarış sırası | sabit bekleme (500/400 ms) yerine `pg_locks` gözlemi: değerlendirmenin `email_outbox` kilidinde beklediği ve komutun iş satırı kilidinde beklediği doğrulanıp sinyaller testte kontrol edilir |

## v2.11.3 ekleri

| Değişiklik | Gerekçe |
|---|---|
| `ui-regresyon.cjs` V2112-R1-ALAN-DEGISTI beklentisi (özgünü `arsiv/ui-regresyon.v2112-orijinal.cjs`) | Davranış bilinçli olarak değişti (V2111-R1-A/B): sonuç belirsizken alan değişiminde güncel kayıt okunur; uygulanmamışsa açıkça söylenir ve sonraki onay yeni komuttur. Eski beklenti ("henüz doğrulanmadı" + aynı anahtar) yerine bu davranış sınanır; gönderim yapılmadığı beklentisi korunur |
| `ui-regresyon.cjs` V2113 matrisi (9 senaryo) | reddetme/erteleme × kayıtlı/kayıtsız × en erken/normal/en geç × gece yarısı, Vazgeç, Escape, alan değişimi, çatışma; sabit döngü yerine gözlenebilir olay (uyarı metni, pencerenin kapanması) beklenir |
| `tools/scripts/ui-bos-tur.py` (özgünü `arsiv/ui-bos-tur.v2112-orijinal.py`) | BOŞ 7h: madde ve şablon sabit kodla (GUR-01/`takdir-ritmi` manuel yol; BAS-02/`yetki-devri` politika yolu); bulunamazsa önkoşul hatasıyla durur; "monthly"/ilk şablon yedeği kaldırıldı; takip ölçümü `hash()` → `zlib.crc32`; yeni adımlar 7g2 (manuel yolda beyan doğrulama bekler) ve 7i (politika yolu POLICY_MET ile kapanır); adım sayısı 52 → 54 |
| `ui-regresyon.cjs` V2110-ERTELE odak okuması (önceki hali `arsiv/ui-regresyon.v2113-oncesi.cjs`) | Final paketteki Chromium kritik akış koşusunda bir kez düştü (odak 'button'); tek başına 4/4 geçti. Ürün odağı pencere açıldıktan sonraki ilk tikte verir; test odağı anlık okuyordu. Artık odağın tarih alanına gelmesi 2 sn'ye kadar beklenir; beklenti (odak tarih alanında) aynı. İlk başarısız kayıt: `docs/test-ciktilari/v2113/motorlar-paket/kesilen-kosu/` |

## v2.11.4 ekleri

| Değişiklik | Gerekçe |
|---|---|
| Sonuç kanıtı komut kaydına bağlandı (yeni uç `GET /api/platform/commands/:key/outcome`); V2110-MAKBUZ, V2113 matrisi ve V2112-R1-ALAN-DEGISTI düzenekleri bu uca senaryonun olgusuna uygun yanıt verir (özgün komut kaydedildiyse `applied`, değilse `not_found`); ileti beklentileri yeni metinlere güncellendi (önceki hal: `arsiv/ui-regresyon.v2114-oncesi.cjs`) | V2113-A01: durum/sürüm/alan benzerliği kanıt sayılmaz. Beklentilerin özü aynı: kaydedilen komut başarıyla kapanır; kaydedilmeyen komutta yanlış başarı yok; sonuç doğrulanamıyorsa yeni komut gönderilmez |
| Denetçi `reconcile-ui.cjs`: özgünü değiştirilmeden saklı; `tests/outcome-adapted/reconcile-ui.cjs` yalnız yeni uç için düzenek yanıtı ekler (`adaptation.diff`); beklentiler aynı | Özgün düzenek yeni ucu yanıtlamadığından özgün betikte OWN-SAVED-CONTROL kanıt yokluğu nedeniyle başarısız, OTHER-EDIT liste okumasını beklerken zaman aşımına uğrar — ürün yanlış başarı üretmez |
| Arşiv adı düzeltmesi: `arsiv/ui-regresyon.v2112-orijinal.cjs` → `arsiv/ui-regresyon.v2113-gelistirme-ara-surum.cjs` (dokuz v2.11.3 senaryosunu içeriyordu); gerçek v2.11.2 kopyası `arsiv/ui-regresyon.v2112-tam-ozgun.cjs` (SHA-256 9c997f27…90eb, denetçi referansıyla aynı) | Denetçi arşivleme notu |

## v2.11.5 ekleri

| Değişiklik | Gerekçe |
|---|---|
| Denetçi `outcome-order-ui.cjs` ve `outcome-api.mjs` değiştirilmeden `tools/tests/bagimsiz-v2114/` altında; kapıya (B) bağlı. Tek ortam uyarlaması kök `pw.cjs` | V2114-A01 karşı örneği ve sonuç ucu sondası |
| `ui-regresyon.cjs` V2115 (4): sıralama reddetme/erteleme × ikinci sorgu başarılı; ikinci sorgu 503 (reddetme) ve erişim yok (erteleme) | kalıcı regresyon; sıra düzenekte açık olaylarla kurulur (zaman çizelgesi sonuçta kayıtlı) |
| `apps/api/test/v2115.test.ts` (3) | gerçek PostgreSQL: ayrı bağlantı iş satırını kilitler; komut kilitte beklerken (pg_locks) ilk sonuç okuması `not_found`; kilit bırakılınca komut 200; iş okuması yeni sürüm; ikinci sonuç okuması `applied` — reddetme ve erteleme; kontrol: başka aktörün ilerlettiği sürümden sonra da özgün anahtar `not_found`, geç gelen özgün komut 409 |
| `tools/tests/fe/ui-audit.hazir-bekleme.cjs` (fark `ui-audit.hazir-bekleme.diff`); kapı A bu kopyayı koşar, özgün `ui-audit.cjs` değişmedi | denetçi notu: DEEP-LINK anlık sayımda (250 ms) denetçi ortamında iki kez düştü; kopya düğmenin görünmesini en çok 5 sn bekler, görünmezse sayım 0 kalır ve senaryo düşer (beklenti aynı) |
| `ui-regresyon.cjs` V2116 (3): ayrı takip — özgün belirsizken yeni taslak bilinçli ikinci onayla (YENI-ONCE: yeni tamamlanır, özgün sonra “uygulanmadı”; OZGUN-ONCE: özgün önce tamamlanır, yeni 409, özgün “kaydedilmişti”; OZGUN-OKUNAMAZ: özgünün sonucu okunamaz, belirsiz kalır); her senaryoda kapat-aç sonrası özgün takip ve bilgi, iki farklı anahtar, gövdelerin karışmaması denetlenir | v2.11.5 ayrı takip davranışının kanıtı |
| Ürün düzeltmesi (test değil): `Dialog.tsx` alanları ilk çizimde başlangıç değerleriyle kurar; `WorkItems.tsx` pencereyi her açılışta yeniden bağlar (`key`) | 9005abd7db03 paketindeki kapı R0 koşusunda V2116-AYRI-TAKIP-YENI-ONCE, yeniden açılan pencerede bir an önceki taslağı ('Yeni taslak gerekçe') okuyarak düştü; kök neden alanların etkiyle (effect) sonradan sıfırlanmasıydı. Kayıt: `v2115/onceki-paket-9005abd7db03-*`. Düzeltme sonrası senaryo 3/3; paket yeniden üretildi ve bütün kapılar yeni paket üzerinde baştan koşuldu |

## v2.11.6 ekleri

| Değişiklik | Gerekçe |
|---|---|
| Denetçi `multi-pending-ui.cjs` değiştirilmeden `tools/tests/bagimsiz-v2115/`; kapı B'ye bağlı | V2115-A01 karşı örneği (değiştirilmemiş v2.11.5'te 1/3) |
| `ui-regresyon.cjs` V2117 (6): üç komut A/B/C — reddetme ve erteleme × A önce tamamlanır / C tamamlanır; A'nın sonucu 503 ve erişim yok; her senaryoda iki liste yenilemesi, gövde/anahtar sabitliği, bilinçli ikinci onay ve iletilerin kendi gönderimine ait olması denetlenir | kalıcı regresyon. Değiştirilmemiş v2.11.5'te 6/6 başarısız; bu başarısızlıkların bir kısmı iletinin gönderimi tanıtması (yeni biçim) beklentisinden gelir — davranış başlangıcı için denetçi betiği esas alınır |
