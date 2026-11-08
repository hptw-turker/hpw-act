# HPW Act v2.6.2 — teslimat notu (25 Eylül 2026, build f8c70ceb1359)

**Erişim yolu kararı bekleniyor (M02):** Mac'ten erişim için izinli iki bağımsız HTTPS ortamı tercih edilir; bunun için alan adı, TLS, barındırma/veritabanı hesabı ve yayın izni gerekir — bu ortamda yok, hayali URL üretilmedi. Yerel Mac yolu seçilirse Developer ID imzalama/notarization ve gerçek Mac testi gerekir; bu da burada yapılamaz. Karar sizden bekleniyor.

**Mac açılışı ve HTTPS test ortamları: bu teslimatta yapılmadı.** Gerçek Mac, Apple Developer ID ve yayın izni/altyapısı bu ortamda yok; `.command` Gatekeeper engeli çözülmüş sayılmıyor. Gereken izinler, altyapı ve adımlar `KANITLAR/MAC_VE_HTTPS_TESLIM_PLANI.md` dosyasında. Başlatıcı sertleştirmesi (M03–M08) yalnız Linux'ta gerçek paketle doğrulandı.

Tek ana ZIP `HPW_Act_TESLIMAT_v2.6.2.zip` (+ .sha256): `DOLU_DEMO/` ve `BOS_BASLANGIC/` (köklerinde index.html, NASIL_ACARIM.html, runtime-manifest.json, SABLONLAR, CALISTIRMA başlatıcı; aynı build `4f5dbd7f7ead`), `GELISTIRICI_KAYNAK/` (migrasyonlar 0001–0005, testler), `KANITLAR/` (KAPANIS.json tek kaynak + KAPANIS.md, KABUL_SONUCLARI.json, LINK_DUGME_ENVANTERI.csv, TEST_KOSULARI/, TESLIMAT_MANIFESTI.json).

## Gerçekten çalıştırılanlar (test türlerine göre ayrı)
| Tür | Sonuç | Kanıt |
|---|---|---|
| Mac açılışı | **denenmedi** (M01 açık; karar bekleniyor) | MAC_VE_HTTPS_TESLIM_PLANI.md |
| Y01–Y05 gerçek PostgreSQL: makbuz kapsamı/fail-closed, reorg sonrası 403, atomik devralma yarışı (audit 1), karşılaştırılabilir önceki ölçüm | 29/29 (toplam) | api-npm-test.log |
| İki oturumlu tarayıcı (Y03/Y04): İK düzeltme+rebase sırasında HRBP takip sayfası → NOT_COMMITTED kartı → Hedefler'den taslağı kabul → yeniden değerlendirme | 8/8 | y03-y04-iki-oturum-sonuc.json, y03-taslak.png, y04-not-committed.png |
| Fonksiyon (domain) | 70/70 | TEST_KOSULARI/domain-test.log |
| Gerçek PostgreSQL/HTTP: E2E 10 + R01–R44 9 + V/M/Y 10 (yetki, kimlik bazlı test kutusu, idempotency/rezervasyon, eşzamanlı yayın/kapasite/aynı anahtar, PATCH benchmark ve birleşik küme, olay/slot, hazırlık, onay anı profil+kapsam yetkisi, taslak hedefe ACHIEVED yok, yeniden kabul kapasitesi, kaldırılan başlangıç hücresi, dikkat slot sayımı, tamamlanmış komut kaydının korunması) | 29/29 | api-npm-test.log |
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
