# HPW Act v2.11.0 — Dilim 3 (günlük takip ve pilot) çalışma planı

Dayanak: tasarım v2 bölüm 5.2, 5.5, 5.8, 7, 8, 12, 13, 15 (onaylı K1–K12) ve "Çok Şirketli Merkez Paneli" gereksinimleri dilim 3 (MP07, MP08, MP10, MP16). Başlangıç: bağımsız kabul almış v2.10.2 (build 3040f1ae93df). v2.10.x düzeltmeleri ve geçen bütün karşı örnekler korunur; 0001–0018 değiştirilmez, yeni şema 0019'dan başlar.

## Kapsam ve kabul koşulları

| # | İş | Kabul koşulu (test türü) |
|---|---|---|
| 1 | **Bekleyen işler (MP08)** — tablo `platform_work_item` (0019): şirket + kural başına tek açık iş; durumlar açık / üstlenildi / ertelendi / kaynakta çözüldü / reddedildi / şirket askıda; dokuz başlangıç kuralı (tasarım 7.1) portföy üretiminde en geç 5 dk'da bir değerlendirilir; hedef süre iş günüyle | tekilleştirme; iki bağlantıyla eşzamanlı üstlenme (biri kazanır); erteleme dönüşü; koşul düzelince kendiliğinden çözülme; durdurulan şirkette "şirket askıda", etkinleşince yeniden değerlendirme; danışman yalnız atandığı şirketlerin işlerini görür; müşteri aksiyon sahibi değişmez [DB] · liste, filtre, üstlen/bırak/ertele/reddet onay penceresiyle, kaynağa git bağlantısı [UI] |
| 2 | **Gösterge sözlüğü ve güncellik (MP07, MP10)** — satır başına üretim zamanı; 5 dk'dan eski satır "güncel değil"; bir şirketin özeti düşerken diğerleri gösterilir; merkezde sözlük bölümü | 20 şirketten biri hata verirken 19 satır doğru, hatalı satır sıfır değil hata gösterir; eski satır etiketi [DB]+[UI]; sözleşmede her göstergenin açıklaması [sözleşme] |
| 3 | **Genel bakış (5.2)** — müdahale gerektiren şirket sayısı, açık işler kurala göre, kurulumu eksik ve durdurulmuş şirketler; her sayı ilgili filtreli listeye gider | sayılar liste sonuçlarıyla aynı; tek "başarı puanı" ya da şirket sıralaması yok (K3) [UI]+[DB] |
| 4 | **Sistem ve teslimatlar (5.8)** — son başarısız içe aktarmalar (dosya içeriği yok), kalıcı başarısız davet sayıları (adres yalnız şirket ekranında), özet üretim hataları; yeniden deneme yalnız şirket ekranından | kişisel veri sızmaz (adres, dosya içeriği yok); yetkisiz rol görmez [DB]+[UI] |
| 5 | **20 şirket üreteci ve yük (tasarım 12)** — `tools/seed/generate-portfolio.mjs`, belirlenimci tohum: 20 şirket × 10 birim × 250 aksiyon × 100 kullanıcı, bir şirkette verinin %50'si; 20 müşteri + 5 HPW oturumu | portföy ve şirket listesi p95 ≤ 1,5 sn; ilk kullanılabilir görünüm ≤ 3 sn; filtre ≤ 1 sn; ölçek altında şirketler arası izolasyon sondaları (RLS) sıfır sızıntı [DB, yük] — ölçüm ortamı ve donanımı raporda |
| 6 | **Erişilebilirlik (MP16, tasarım 13)** — kalan tarayıcı istemleri (görevi bitir, rol değiştir, erişim kaldır, doğrulama sıfırla, yönetici daveti) erişilebilir pencereye; hedef boyut ölçümü (ana düğme ≥ 44×44, tablo içi ≥ 24×24); durum iletileri `aria-live`; şirket açma, durdurma, atama yalnız klavyeyle | ölçüm testleri [UI]; denetçi testlerinden tarayıcı istemine dayananlar (ör. V290-UI-04) yalnız etkileşim yöntemi uyarlanır, özgünleri saklanır ve iş sonucu beklentisi aynı kalır |
| 7 | **Tarayıcı matrisi** — kritik akışlar Chromium, Firefox 142 ve WebKit 26 (Playwright, Linux, başsız) üzerinde | üç motorda aynı senaryolar geçer [UI] |
| 8 | **BOŞ 7h** — tur art arda ve yük altında birden çok kez koşulur; tanı kaydı korunur | arıza yeniden oluşursa ağ/konsol/seçim/DOM kanıtıyla kök neden; oluşmazsa açık belirsizlik olarak kalır |

## Açıkça test edilmeyecek ya da sınırlı kalacaklar

- WebKit (Linux) Safari (macOS/iOS) değildir; Safari ve gerçek mobil cihazlar test edilmemiş kalır.
- Ekran okuyucu (VoiceOver/NVDA) ile elle kontrol bu ortamda yapılamaz; açık kalır.
- Gerçek tarayıcı %200 yakınlaştırması başsız ortamda yapılamaz; 640 CSS px karşılığı ölçülür ve öyle adlandırılır.
- Yük ölçümü bu sandbox'ta tek makinede yapılır; üretim donanımı ve ağ koşullarının yerine geçmez.
- Canlı SMTP, yükleme güvenliği, saklama uygulaması, yedekten dönüş: canlıya çıkış kapıları olarak açık kalır.

## Sıra

1 → 2 → 3 → 4 (merkez ekranları ve 0019), sonra 5 (üreteç ve yük; 1–4'ün ölçek altında sınanması), sonra 6 ve 7 (erişilebilirlik ve tarayıcı matrisi bütün yeni ekranları kapsasın diye en sonda), 8 bütün süreç boyunca. Teslim: her zamanki final paket kontrolleri (API/gerçek PostgreSQL, ön yüz kapısı, BOŞ/DOLU turları, temiz kurulum, v2.10.2'den yükseltme), gereksinim → dosya → test → kanıt eşlemesi.

## Yük ölçümünün tanımı (ölçümden önce sabitlenir; iş sahibi koşulları 28.09.2026)

- **Ölçülen uçlar ve akışlar.** HPW: `GET /api/platform/portfolio`, `GET /api/platform/work-items` (değerlendirme dahil ve güncel önbellekle ayrı ayrı), `GET /api/platform/tenants/:tid`, filtre değişimi (istemci tarafı; ölçüm tarayıcıda). Müşteri: genel bakış, aksiyon listesi, hedef listesi ve bir yazma (erteleme) akışı. Her akış için uç bazında süre dağılımı (p50/p95/p99, en büyük) ve hata oranı ayrı raporlanır.
- **Veri miktarı.** 20 şirket; şirket başına 10 birim, 250 aksiyon, 100 kullanıcı, bir izlenen dönem ve yayımlı sonuç; bir şirkette toplam verinin %50'si (çarpık dağılım). Belirlenimci tohumla üretilir; üretilen satır sayıları rapora yazılır.
- **Eşzamanlılık ve rol dağılımı.** 20 müşteri oturumu (şirket başına bir; 10 İK yöneticisi, 10 birim yöneticisi) + 5 HPW oturumu (1 Sistem Yöneticisi, 3 Danışman, 1 Denetçi). Oturumlar gerçek giriş (HPW'de MFA) ile açılır.
- **Süre, istek sayısı, hata oranı.** Isınma 1 dk + ölçüm 10 dk; toplam istek sayısı, saniyedeki istek, 4xx/5xx oranı ayrı. Hata oranı %1'i aşarsa ölçüm geçersiz sayılır.
- **Soğuk ve sıcak.** Soğuk: sunucu ve PostgreSQL yeniden başlatıldıktan sonra ilk 60 sn; sıcak: ısınma sonrası. İki sonuç ayrı raporlanır; bekleyen işlerde "değerlendirme yapılan" ve "5 dk içindeki değerlendirme yeniden kullanılan" istekler ayrı.
- **İlk görünüm.** Tarayıcıda merkez açılışından şirket tablosunun ilk satırı ve filtre alanları etkileşime hazır olana kadar geçen süre (Playwright ile `table tbody tr` görünür ve `#f-durum` etkin); bekleyen işler için iş tablosunun ilk satırı.
- **Ortam.** İşlemci, bellek, PostgreSQL sürümü ve ayarları, düğüm sürümü raporda yazılır. Sonuç **test ortamı ölçümüdür**; üretim kapasitesi garantisi olarak etiketlenmez.
- **Yük altında ayrım.** Ölçüm sırasında her müşteri oturumu kendi şirketi dışındaki bir şirketin uçlarına düzenli istek yapar (beklenen 403); HPW danışman oturumları atanmadıkları şirketlere istek yapar (beklenen 403/404). Sıfırdan farklı sızıntı ölçümü geçersiz kılar.

## Tarayıcı motorları için kritik akış listesi (her motor ayrı raporlanır)

1. Giriş ve HPW MFA doğrulaması. 2. Şirketler listesi: filtre, sıralama, sayfa, adres çubuğu ve geri/ileri. 3. Şirket detayı: bölümler ve Merkeze dön. 4. Durum geçişi onay penceresi (klavye, odak tuzağı, Escape, çift gönderim). 5. Kurulum onayı ve izlenen dönem seçimi. 6. Devir önizlemesi. 7. Bekleyen işler: listeleme, üstlen/bırak/ertele/reddet pencereleri, sürüm çatışması iletisi. 8. Müşteri: genel bakış ve kullanıma açılış teyidi. 9. 320 px ve 640 px'te belge taşması.

Motorlar: Chromium (Playwright yerleşik), Firefox 142 ve WebKit 26 (Playwright; Linux, başsız). **Linux WebKit sonucu macOS/iOS Safari kabulü değildir.**
