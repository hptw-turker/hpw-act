# HPW Act v2.10.2 bağımsız yeniden denetimi

**Karar: V2101-01 ve V2101-02 kapandı. Şirket işletimi düzeltmeleri için OK; sonraki geliştirme aşamasına geçilebilir.** Bu karar aşağıdaki bağımsız test kapsamına aittir. 20 şirketle canlı kullanım, bütün tarayıcılar veya eksiksiz üretim altyapısı kabulü verilmemiştir.

Tarih: 28 Eylül 2026. İncelenen paket: `HPW_Act_TESLIMAT_v2.10.2_3040f1ae93df.zip`. Build: `3040f1ae93df`.

Bağımsız hesaplanan SHA-256: `cabf461fbe2eb499b3a58e4d25990cca5d61cd87f8f83133b90538b5e19f038f`.

Önceki denetimde gösterilen kullanıcı taslağının silinmesi ve tamamlanmış müşteri teyidinin hatalı pencerede kalması, özgün testler değiştirilmeden yeniden sınandı. Üç senaryo da geçti. İlgili tamamlayıcı testler ve önceki karşı örnekler de geçti. Bu turda yeni bir ürün düzeltmesi gerektiren bulgu üretmedim; “kusursuzluk garantisi” veya test edilmemiş alanlar için onay vermiyorum.

**İki bulgunun kapanışı**

| Bulgu | Bağımsız gözlem | Karar |
|---|---|---|
| V2101-01 — eski kaydetme yanıtı yeni taslağı siliyordu | A→B→A dönüşünde ve aynı ekranda gönderimden sonra düzenlemede `SECOND-UNSAVED-DRAFT` korundu. Eski isteğin sunucuya gönderdiği değer ayrı kaldı. Aynı ekranda sonraki düzenlemenin henüz kaydedilmediği açıkça gösterildi. | Kapalı |
| V2101-02 — yanıt/makbuz kaybından sonra teyit penceresi toparlanmıyordu | `receipt_lost` sonrası güncel kayıt `done` olduğunda pencere kapandı; çelişkili hata ve etkisiz teyit düğmesi kalmadı. Okuma başarısızsa veya sonuç doğrulanmazsa yeniden gönderim aynı işlem anahtarıyla gerçekten çalıştı. | Kapalı |

Taslak düzeltmesinde ekran ziyaretinin nesli ve taslak sürümü ayrı izleniyor. Tamamlayıcı regresyonlarda eski ziyaretin 409/503 yanıtı yeni ziyaretin taslağını veya uyarısını değiştirmedi; aynı ekrandaki 409 taslağı korudu. Başarılı ilk gönderimden sonra ikinci kaydetme, yeni taslağı güncel sürüm numarasıyla gönderdi.

Sunucu düzeltmesinde teyit ucunun makbuzu `tenant_wide` kapsamıyla saklanıyor. Teslim edilmiş Fastify kodu üzerindeki bağımsız, kontrollü DB testinde ilk istek 200; aynı anahtar ve aynı gövdeyle tekrar aynı 200 yanıtını verdi. Aynı anahtar/farklı içerik 409; İK yöneticisi profili geri alındıktan sonraki tekrar 403 oldu. Yetki geri gelince aynı makbuz okunabildi. Makbuz kaybı ayrıca taklit edildiğinde komut günlüğü ikinci yazmayı engelledi. Toplam teyit INSERT sayısı bir kaldı.

**Bağımsız test sonuçları**

Aşağıdaki yollar, raporla birlikte verilen kanıt ZIP'inin içindeki yollardır.

| Kontrol | Sonuç | Kanıt |
|---|---|---|
| Son iki bulgunun özgün tarayıcı senaryoları | **3/3 geçti** | `evidence/original-edge/results.json` |
| v2.10.0'dan gelen özgün tarayıcı karşı örnekleri | **7/7 geçti** | `evidence/fresh-suite/old-independent-ui/results.json` |
| Eski HPW onayının müşteri tarafından teyit edilmesi karşı örneği | **1/1 geçti**; eski kanıt reddediliyor | `evidence/fresh-suite/old-independent-api/results.json` |
| Ürünün tarayıcı regresyonları | **123/123 geçti**; 123 farklı kimlik | `evidence/fresh-suite/ui-regresyon-sonuc.json` |
| Eski denetçi tarayıcı paketi | **26/27**, yalnız belgeli LOGIN-ENTER istisnası | `evidence/fresh-suite/ui-results.json` |
| Sonuç kapısı — bu koşunun birleşik sonucu | Geçti | `evidence/fresh-suite/result-gate.log` |
| Sonuç kapısı — eksik birleşik dosya / başka koşu kimliği | İkisi de beklendiği gibi çıkış kodu 1 ile reddedildi | `evidence/gate-incomplete/`, `evidence/gate-stale.json` |
| Yeni makbuz ve güncel yetki kontrolü | **9/9 kontrol geçti**; gerçek Fastify, kontrollü DB | `evidence/receipt-acceptance/results.json` |
| Domain | **70/70 geçti** | `evidence/fresh-suite/domain.log` |
| API istemcisi | **5/5 + 10/10 geçti** | `evidence/fresh-suite/api-client-results.json`, `api-client-extra-results.json` |
| Ön yüz–sunucu yetki ve uç sınıfı sözleşmesi | 40 kural; 40 yazma ucu; geçti | `evidence/rules-contract-retry.log` |
| DTO–sözleşme | 29 uç + 5 fixture; 0 uyumsuzluk | `evidence/fresh-suite/dto-contract.log` |
| Önceki sözleşme karşı örnekleri | **3/3 + 4/4 geçti** | `evidence/fresh-suite/contract-edge.log`, `contract-remaining.log` |
| Sözleşme kapsamı | 112 yanıt girdisi / 135 kural; 0 sorun | `evidence/fresh-suite/contract-audit.log` |
| TR/EN kapsamı | 1004 arayüz, 104 sunucu, 103 etiket; eksik 0 | `evidence/i18n.log` |

LOGIN-ENTER, geçersiz e-posta için bir ağ isteği bekliyor. Yerel doğrulama bu isteği durdurduğu için sonuç 0. Geçerli e-postayla tek istek ve geçersiz e-postayla sıfır istek + alan iletisi kontrolleri aynı 123'lük koşuda geçti. Bu istisnayı 27/27 diye sunmuyorum. Sözleşme kapsamındaki 112 yanıt girdisi ile üreticinin 109 OpenAPI işlemi farklı sayımlardır.

**Paket kimliği ve kanıt bütünlüğü**

- ZIP SHA-256 bildirilen değerle aynı. Kapanış manifesti ile BOŞ ve DOLU runtime manifestleri `3040f1ae93df` gösteriyor.
- BOŞ ve DOLU paketlerin her birinde 5.378 düzenli çalışma zamanı dosyası var; içerik farkı yok. Kanıt: `evidence/identity.json`.
- Dört özgün denetçi test dosyası, saklanan önceki denetim kopyalarıyla ve üreticinin depoya aldığı kopyalarla bayt düzeyinde aynı. Kanıt: `evidence/original-script-comparison.json`.
- Önceki bağımsız denetimde kaydedilmiş 0001–0017 migrasyon hash'leri bu paketle aynı. 0018 için elimde aynı türden önceki bağımsız hash bulunmadığından üreticinin “0001–0018 aynı” beyanını bütünüyle bağımsız doğruladığımı söylemiyorum.
- Testler teslim edilen DOLU web derlemesini kullandı. Arayüzü yeniden derleyip farklı dosyalar test etmedim. Son kaynak karşılaştırmasında ZIP'teki 1.393 geliştirici kaynağı dosyasında içerik değişikliği yok. Kanıt: `evidence/source-integrity.json`.

Üretici, önceki sürümün bir sonuç kontrolünde eski JSON dosyasının okunduğunu açıklamış. Bu turda ayrı ve boş çıktı dizini ile yeni koşu kimliği kullandım: `independent2102-35dc8ed6d968448d8c15f535e9179bec`. İki parça 62 + 61 sonucu birleştirdi; metadata, toplam ve kimlikler kontrol edildi. Eksik birleşik dosya ve farklı koşu kimliği olumsuz denemeleri de doğru şekilde reddedildi. Önceki üretici kanıtındaki sorun bu yeni bağımsız koşuya taşınmadı.

**Yöntem ve ortam uyarlamaları**

Tarayıcı testleri gerçek Chromium ve kontrollü HTTP yanıtları kullanır. Sunucu karşı örnekleri gerçek paket Fastify işleyicilerini ve kurulum hesaplayıcısını çalıştırır; sorgu yanıtları denetçi düzeneği tarafından sağlanır. Bunlar gerçek PostgreSQL, RLS veya eşzamanlı transaction kabulü değildir.

Özgün `receipt-api.mjs` değiştirilmeden çalıştırıldı. Yeni sürümün sakladığı/okuduğu makbuz sorgularını eski düzenek modellemediği için tekrar isteğinde `UNMOCKED QUERY` kaynaklı 500 görüldü. Bu eski ulaşılabilirlik sondası “geçti” sayılmadı ve bu 500 gerçek veritabanında ürün hatası olarak yorumlanmadı. Ayrı `receipt-acceptance.mjs` dosyasında eksik SQL modeli eklendi; yeni beklentiler ve dokuz kontrol açıkça kaydedildi. Bilinmeyen sorgular hata vermeye devam ediyor. Ayrıntılar `README-denetci.md` içindedir.

Domain/istemci için mevcut TSX; dil kontrolü için mevcut TypeScript kullanıldı. Yetki sözleşmesi ilk denemede eksik React nedeniyle başlamadı. Mevcut React, React DOM ve React Router DOM bağımlılıkları bağlanınca aynı test geçti. İlk hata ve başarılı tekrar korunuyor. Bunlar temiz npm kurulumu kanıtı değildir. Bütün standart `npm test` zincirini bağımsız koştum iddiasında bulunmuyorum; yeniden çalıştırdığım gruplar yukarıda tek tek belirtilmiştir.

**Üreticiden gelen sonuçlar ve açık sınırlar**

Üreticinin API logunda 80/80 test ve 943 gerçek yanıt için 0 sözleşme sapması görülüyor. Grup yapılandırma kontrollerini de içeriyor. Yeni PostgreSQL makbuz testi; aynı yanıtın tekrarını, teyit/audit sayısının artmamasını, merkez–müşteri durum uyumunu, farklı içerik çatışmasını ve yetki geri alınmasını sınayacak şekilde yazılmış. Kaynağı incelendi; burada gerçek PostgreSQL sunucusu olmadığından bu koşuyu bağımsız tekrarlamadım.

Üreticinin BOŞ 52/52, DOLU 8/8, temiz kurulum/18 migrasyon ve v2.9.1 yükseltme sonuçları da üretici kanıtı olarak kalır. Çalışan gerçek PostgreSQL sunucusunun `/api/ready` yanıtını bu ortamda bağımsız doğrulamadım.

| Açık konu | Bu karar üzerindeki sınır |
|---|---|
| Önceki BOŞ turunun 7h arızası | Kök neden hâlâ açık; sonraki başarılı turlar ilk arızayı açıklamıyor. İlk tam iz yok. Tekrarında tanı kanıtı korunmalı. |
| Safari / Firefox / WebKit | Bu bağımsız turda test edilmedi. |
| Ekran okuyucu ve gerçek %200 yakınlaştırma | Test edilmedi; 320/640 CSS px kontrolleri bu kabulün yerine geçmez. |
| 20 şirketle çalışma kapasitesi | Eşzamanlı yük ve ölçek kabulü verilmedi. 30 satırlı kontrollü liste testi, 20 şirket yük testi değildir. |
| v2.11 işlevleri ve canlıya çıkış kapıları | Bu düzeltme sürümünün dışında; önceki durumlarıyla açık. |

Geliştiriciye iletilecek karar: **“v2.10.2'de V2101-01 ve V2101-02 bağımsız testlerle kapandı. Bu düzeltmeleri ve geçen karşı örnekleri koruyarak onaylı sonraki geliştirme dilimine geçebilirsiniz. BOŞ 7h, tarayıcı/erişilebilirlik, gerçek PostgreSQL bağımsız kabulü, 20 şirket yük testi ve canlıya çıkış maddelerini kapalı göstermeyin.”**
