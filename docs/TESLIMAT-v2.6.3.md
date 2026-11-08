# HPW Act v__VER__ — teslimat notu (26 Eylül 2026, build __BUILD__)

**Sürüm:** Bu paket v__VER__ (build __BUILD__); dosya adı build kimliğini taşır (`HPW_Act___BUILD__`). Önceki v2.6.2 adıyla dağıtılan farklı build'ler arşivdir ve çıktıdan kaldırılmıştır.

**Birincil erişim yolu kararı bekleniyor:** Mac'ten erişim için izinli iki bağımsız HTTPS ortamı tercih edilir; bunun için alan adı, TLS, barındırma/veritabanı hesabı ve yayın izni gerekir — bu ortamda yok, hayali URL üretilmedi. Yerel Mac yolu seçilirse Developer ID imzalama/notarization ve gerçek Mac testi gerekir; bu da burada yapılamaz. Karar sizden bekleniyor.

**Mac açılışı ve HTTPS test ortamları: bu teslimatta yapılmadı.** Gerçek Mac, Apple Developer ID ve yayın izni/altyapısı bu ortamda yok; `.command` Gatekeeper engeli çözülmüş sayılmıyor. Gereken izinler, altyapı ve adımlar `KANITLAR/MAC_VE_HTTPS_TESLIM_PLANI.md` dosyasında. Başlatıcı sertleştirmesi (M03–M08) yalnız Linux'ta gerçek paketle doğrulandı.

Tek ana ZIP `HPW_Act___BUILD__` (+ .sha256): `DOLU_DEMO/` ve `BOS_BASLANGIC/` (köklerinde index.html, NASIL_ACARIM.html, runtime-manifest.json, SABLONLAR, CALISTIRMA başlatıcı; aynı build `__BUILD__`), `GELISTIRICI_KAYNAK/` (migrasyonlar 0001–0012, testler), `KANITLAR/` (KAPANIS.json tek kaynak + KAPANIS.md, KABUL_SONUCLARI.json, LINK_DUGME_ENVANTERI.csv, TEST_KOSULARI/, TESLIMAT_MANIFESTI.json).

## Gerçekten çalıştırılanlar (test türlerine göre ayrı)
| Tür | Sonuç | Kanıt |
|---|---|---|
| Mac açılışı | **denenmedi** (karar bekleniyor) | MAC_VE_HTTPS_TESLIM_PLANI.md |
| Verili migrasyon: 0005 kanonik + 0006; demo DB (ilk paket varyantı) yükseltme; f8c7 varyantı defter simülasyonu → belgeli alias kabulü + 0006 | geçti | migrate çıktıları, KAPANIS Z01 |
| Eşzamanlı idempotency: aynı gövde devralma [200,409], farklı gövde 409, hash/sahiplik ezilmez | geçti | api-npm-test.log (v01-v28 test 9) |
| Crash penceresi (iş commit, makbuz yok): receipt_lost, yeniden yürütme yok | geçti | test 11 |
| İki oturumlu stale hedef sürümü: expectedVersion 409 + güncel taslak; UI yeniler | geçti | test 7, y03-y04-iki-oturum-sonuc.json (10/10) |
| Gizlilik: gizli satırda n/değer/değerlendirme yok; takip gizli kartında n yok | geçti | test 11 |
| v2.7.0 denetimi (test 19–20): kuyruk sözleşmesi, gizli kohort DTO, as-of dağıtım/kohort, küme tabanlı INSERT, aksiyon devri, birleştirme, farklılaştırma | geçti | test 19–20 |
| Ölçek (gerçek HTTP + PostgreSQL, DOLU DEMO kopyası): 200/400/500 dağıtım + 5 ms gecikme benzetimi; 400 şube yaşam döngüsü; tarayıcıdan 400 dağıtım | geçti | olcek-*.json, ui-400-dagitim-sonuc.json |
| v2.6.9 denetimi P0 (test 18): kapat≠kabul, kohort kuralı/çift sayım yok, read-time gizlilik 5→25/25→5, istisna dışlama tek motor, 5 ritim, kapsamlı sayılar, as-of tek motor, karşı teklif aralığı; 400 birim yük (YUK-400 metrikleri); UI: ana aksiyon yayım/sürüm/dağıtım, kaynak isteği, kabul/ret/kapat (ui-kurumsal-v270) | geçti | test 18 |
| v2.6.8 denetimi P0/P1 (test 17): aggregate/kule/kuyruk kapsamı, yönetişim (EXEC), as-of reorg + döngü, merkezi kararın kohortu sonuçlandırması, sürüm kararı, dağıtım kabul/red + yerel taslak, metrik kimliği, kaynak isteği; kurumsal UI panelleri (ui-kurumsal-v269) | geçti | test 17 |
| Tarayıcı (final ZIP): kontrol kulesi, sorumluluk haritası, reorg taşıma, merkezi kuyruk panelleri; uzun offline + manuel yeniden deneme aynı anahtar, tek DB etkisi | 7/7 | ui-kurumsal-offline-sonuc.json |
| P1/P2 (v2.6.7): madde bazlı seçim, interaction_area sözlüğü, Sorumluluk Haritası, official≠derived toplam, çıkarım koruması, reorg/devir/orphan, kurumsal motor zinciri + Control Tower (API+DB, migrasyon 0008) | geçti (API); ekranlar kısmi | test 16 |
| v2.6.5 denetimi P0: dönem bazlı eşik 5→25/25→5, şirket oluşturma ve davet kabulü yanıt kaybı kurtarma, import commit recover, PATCH idempotency | geçti | test 15 |
| P0-1 takip gizliliği tek kapı (threshold 25/n=20: HIDDEN, türetilmiş sayı yok; NOT_COMMITTED observed yok), P0-3 GET yazmaz / POST assess yazar (audit, komut anahtarı) | geçti | test 14 |
| P0-2 ön yüz komutları merkezi commandApi (kararlı anahtar; çift tık/yanıt kaybı/yeniden deneme) — tarayıcı çift tık testi | bkz. TEST_KOSULARI/ui-ciftik-sonuc.json | |
| DB kesintisi/toparlama (A99-19, final ZIP): 503 → hazır demiyor → DB geri → geçiş; süreç düşmüyor (bu turda düzeltildi) | geçti | v02-v03-ui-sonuc.json |
| Üç verili yükseltme + bilinmeyen hash + idempotent (A99-10…14) | geçti | migrasyon-varyant-testi.log |
| Docker temiz derleme (A99-15/16) | **BLOCKED** — Docker bu ortamda yok; Dockerfile/compose düzeltildi ama derlenmedi | — |
| F99: snooze/panel komutları komut günlüğü + crash-window, import makbuzu birim kümesi, eşik bazlı gizlilik, migrasyon varyantları (fail-closed dahil) | geçti | test 12, migrasyon-varyant-testi.log |
| Y01–Y05 gerçek PostgreSQL: makbuz kapsamı/fail-closed, reorg sonrası 403, atomik devralma yarışı (audit 1), karşılaştırılabilir önceki ölçüm | 40/40 (toplam) | api-npm-test.log |
| İki oturumlu tarayıcı (Y03/Y04): İK düzeltme+rebase sırasında HRBP takip sayfası → NOT_COMMITTED kartı → Hedefler'den taslağı kabul → yeniden değerlendirme | 8/8 | y03-y04-iki-oturum-sonuc.json, y03-taslak.png, y04-not-committed.png |
| Fonksiyon (domain) | 70/70 | TEST_KOSULARI/domain-test.log |
| Gerçek PostgreSQL/HTTP: E2E 10 + R01–R44 9 + V/M/Y/F99/P0 14 + textnorm fonksiyon testi (yetki, kimlik bazlı test kutusu, idempotency/rezervasyon, eşzamanlı yayın/kapasite/aynı anahtar, PATCH benchmark ve birleşik küme, olay/slot, hazırlık, onay anı profil+kapsam yetkisi, taslak hedefe ACHIEVED yok, yeniden kabul kapasitesi, kaldırılan başlangıç hücresi, dikkat slot sayımı, tamamlanmış komut kaydının korunması) | 40/40 | api-npm-test.log |
| XLSX gerçek dosya turları (org/kullanıcı/sonuç; hatalı satır, PATCH, FULL_REPLACE) | testler içinde ve tur 3/5/9 | aynı |
| Tarayıcı (Chromium): temiz paketten BOŞ başlatıcı → BOS_BASLANGIC/index.html → 51 adım | 51/51 | ui-bos-tur.log, ui-bos-tur-sonuc.json |
| Tarayıcı: DEMO başlatıcı (dump geri yükleme + 0004/0005 verili yükseltme) → DOLU_DEMO/index.html → 8 adım; iki ortam aynı anda | 8/8 | demo-smoke-sonuc.json, launch-demo.log |
| Başlatıcı/HTML (Linux, gerçek paket): eski build kontrollü geçiş (V01); DB kapalıyken hazır demiyor, geri gelince geçiş (V02); yeniden dene iptali (V03); yarım kurulumdan devam (V05); aynı build+kurulum kimliği hazırlık kontrolü (M03); PG_VERSION'sız dizin korunuyor (M05); yarım restore durduruyor, tam yükleme manifestle (M06); sürüm ön kontrolleri (M07) | geçti | launch-*.log, v02-v03-ui-sonuc.json |
| E-posta | yalnız sandbox kutusu; gerçek sağlayıcı yok | — |
| Mac/Safari | **denenmedi** | — |

## Kapanış (KAPANIS.json'dan)
M01–M23: 11 doğrulandı, 5 kısmi, 6 açık, 1 dış bağımlılık. V01–V28: 13 doğrulandı, 6 açık, 8 kısmi, 1 dış bağımlılık. N01–N36: 13 doğrulandı, 14 kısmi, 3 uygulandı/doğrulanmadı, 4 açık, 2 dış bağımlılık. R01–R44: 30 doğrulandı, 9 kısmi, 5 açık.

## Sonuç yükleme modları
FULL_REPLACE = dönemin sonuç kümesi ve benchmark setinin tam anlık görüntüsü (dosyada olmayan hücre düşer, boş Benchmarklar = CLEAR; onayda teyit). PATCH = yalnız dosyadaki hücreler ve benchmark satırları (upsert); kardeş gösterge, gizlilik, n ve indeks mutabakatı birleşik küme üzerinde doğrulanır; yalnız başlangıç hücresi değişen hedefler incelemeye düşer.

## Açık kurumsal kapsam (yerel pilot ≠ tam kurumsal kabul)
400 şubelik ana aksiyon dağıtımı ve yerel uygulama, sürüm geçişi, reorg/rol devri, merkezi sorun/karar kuyruğu, kaynak-bütçe/bağımlılık (V21–V23, N33) yapılmadı; 400 şubelik dolu veri bu işlevlerin yerine geçmez. Canlı güvenlik/veri yaşam döngüsü (V26), uzun toplu posta dayanıklılığı ve gerçek teslimat (V24), yükleme güvenliği (N29), çoklu rapor gizliliği (V20), HPW yöntem onayı (V19) açık. Yerel pilot için: BOŞ paketle tek şirket, kendi sonuçlarıyla hedef→aksiyon→kanıt→takip zinciri kullanılabilir; kurumsal kabul ayrı iş.

## Ayrı onay gerektirenler
Canlı yayın, gerçek toplu e-posta (yalnız onaylı alıcıyla), gerçek veride yıkıcı işlem.
