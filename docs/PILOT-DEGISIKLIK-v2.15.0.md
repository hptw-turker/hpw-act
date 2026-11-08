# HPW Act v2.15.0 — Sunumla birebir yol haritası

Tarih: 08.11.2026 · Önceki sürüm: v2.14.2 (build b6471e17ddfe) · Karar: ADR-0042

## Ne değişti

HPTW birim raporunun (sunumun) "Yol Haritası" bölümü HPW Act'e aynen aktarılır ve takip edilir. Şirkete önce sunum verilir; sonra sunumdaki yol haritası forma yazılıp yüklenir; üst yönetim, İK ve birim yöneticileri HPW Act'ten takip eder.

### Veri ve API
- Migrasyon `0023_v2150_yol_haritasi.sql`: `roadmap`, `roadmap_plan`, `roadmap_step`, `roadmap_milestone`; RLS + FORCE; içerik yalnız ekleme, durum alanları sütun düzeyi yetkiyle güncellenir; `import_job.kind` → `roadmap` eklendi. Yayımlanmış migrasyonlara dokunulmadı.
- İçe alım: `roadmap` türü (mevcut doğrula → önizle → onayla hattı). Form 17 sayfa, sunum bölüm sırasıyla (`apps/api/src/importers/roadmap.ts` — şablon, sözlük ve doğrulama tek tablodan).
- Uçlar: `GET /api/t/:tid/roadmaps`, `GET /api/t/:tid/roadmaps/:rid`, `GET /api/t/:tid/roadmap-hr-steps`, `POST /api/t/:tid/roadmap-steps/:sid/status`, `POST /api/t/:tid/roadmap-milestones/:mid/status` (expectedVersion, idempotency, denetim kaydı; platform sınıfı `business`).

### Arayüz (Tasarım B bileşenleriyle)
- Menüde **Yol haritası** (İK, İK iş ortağı, üst yönetim, bölge, birim yöneticisi, izleyici).
- Birden çok birim görenler: üç öncelik, birimler tablosu (adımlar kareyle, takvim, gecikme, sıradaki termin), İK'nın adımları.
- Birim yol haritası: ana sonuç, güçlü yönler ve öncelikler, birimin gündemi, eylem planları (veri dayanağı çubuk tablosu, izlenecek ölçüt ve hedef, rol adımları ve durum seçimi, takvim), uygulama adımları, roller ve sorumluluklar, uygulama takvimi, izleme göstergeleri ve hedefler.
- Giriş ekranlarında (Genel bakış) **Yol haritası** bölümü: birim müdürü ve tek birim görenlerde birim yönetimi adımları, İK adımları, takvim (termini geçen satırlar, sıradaki termin); bölge, İK iş ortağı, üst yönetim ve çok birim gören izleyicide birimler tablosu. Yol haritası yüklenmemiş şirkette bölüm hiç çizilmez; aksiyon sorumlusunda yoktur. "Sıradaki termin" termini henüz gelmemiş en yakın açık satırdır (termini geçenler ayrıca kırmızı sayılır).
- Dönemler ekranında, tablonun altında sonucu yüklenmiş her dönem için "<dönem> için formu yükle" bağlantısı.
- Yol haritası yanıtları ön yüzde biçim denetiminden geçer (`dto.ts`: roadmaps, roadmapDetail, roadmapHrSteps). Bozuk yanıt giriş ekranını çökertmez; bölümde "Sunucudan beklenmeyen biçimde yanıt geldi" iletisi ve yeniden dene görünür (diğer ekranlardaki kuralla aynı).
- Telefon ve tablet (≤820 px): sağ kenardaki "Nasıl okunur?" kulpu içeriğin üstüne biniyordu (ör. iPhone SE'de başlık alt yazısının son kelimesi). İçeriğe kulp genişliği kadar sağ boşluk verildi (`tasarim-b.css`, yalnız ≤820 px; masaüstü değişmedi). Denetim: iPhone SE, iPhone 13, Pixel 5, iPad Mini × 6 kullanıcı × 76 ekranda kulpla çakışan yazı 0, yatay taşma 0 (aynı denetim düzeltme olmadan 19 ekranın 7'sinde çakışma buluyor). Ön yüz kapısı düzeltmeden sonra: çıkış 0, denetçi 26/27 (bilinen LOGIN-ENTER) (`fe-kapi-mobil-kulp.log`).
- Mevcut ekranların tasarımı değişmedi; menüye bir öğe ve giriş ekranına yol haritası bölümü eklendi (bölüm yalnız yol haritası olan şirkette görünür).

### Rol kılavuzları
- Sekiz rol kılavuzuna **6 · Yol haritası** bölümü eklendi (ekranlar, numaralı düğme tabloları, adım adım, sık sorulanlar); kapak, içindekiler ve bütün sayfa altbilgileri v2.15.0. 1–5. bölümler değişmedi (v2.14.2 ekranları). Bölüm 6 ekranları Saha Bankacılık sentetik demo verisi ve sentetik örnek yol haritasıyla alındı; Ant Yapı verisi kullanılmadı. Üretici: `tools/guides/v2150-yol-haritasi/` (`cap.cjs` + `spec.json` ekranlar, `icerik.py` metin, `build.py` birleştirme).
- Standart ve Ant Yapı DOLU DEMO veritabanlarına Saha Bankacılık sentetik örnek yol haritası (5 şube, 14 plan, 96 adım, 42 takvim satırı, örnek ilerleme) yüklendi; kılavuzdaki ekranlar paketteki demoda aynen açılır. Ant Yapı'nın yol haritasında bütün adımlar "Başlamadı".

### Bilinçli sınırlar
- Çalışan alıntıları aktarılmaz (formda alan yok).
- Sunumdaki hedef ("mevcut + 2,5 puan") olduğu gibi gösterilir; HPW Act'in gerçekçi aralığıyla karşılaştırılmaz, istisna akışına girmez.
- Madde bazlı hedef / aksiyon / kanıt sistemi değişmedi; yol haritası ona bağlı değil.
- Termin ve gecikme ekranda gösterilir; bu sürümde e-posta hatırlatması ve dikkat kuyruğu bağlantısı yok.
- Sunumdaki içerik Türkçe'dir; İngilizce arayüzde ekran metinleri İngilizce, sunumdan gelen içerik Türkçe kalır.

## Ant Yapı aktarımı (tek seferlik, ürünün kendi hattıyla)
8 birim sunumu → organizasyon (kök + 8 birim, 10 rol), soru seti (71 standart + 19 ek madde, 2 yeni boyut), 2026-ANA dönemi, sonuçlar (702 hücre, resmî değer, sunumun Ek A listesinden), yol haritası (8 birim, 25 eylem planı, 198 adım, 75 takvim satırı, 72 izleme hedefi), kullanıcılar (İK, üst yönetim, 8 birim yöneticisi). HPW Act'in hesapladığı Ant Yapı geneli değerleri sunumdaki "Ant Yapı geneli" ile eşleşti (ör. bireysel ilgi %67,6, takdir %66,4, yemek kalitesi %52,2; bir göstergede yuvarlama farkı 0,1).

## Testler (koşulanlar)
- API (gerçek PostgreSQL + HTTP): 117 testten 116'sı geçti. Yeni v2150 yol haritası testleri 6/6 (şablon, doğrulama, aynen saklama ve terminler, yetki, yeniden yükleme, şirketler arası yalıtım).
- Tek başarısız: v01-v28 içindeki "weekly 70 gün ≈ 10 slot" kontrolü bugünün tarihiyle 12 slot üretiyor. Değişmemiş v2.14.2 kaynağı aynı tarihte aynı sonucu veriyor (`test-ciktilari/v2150/v2.14.2-kaynak-v01-v28-ayni-tarih.log`): yıl sonunu geçen haftalık pencerede haftalar yılın gününe göre bölündüğü için kısmi haftalar ayrı slot oluyor. Bu sürümle ilgisizdir; test gevşetilmedi; plan dönemi yönteminin karara bağlanması gerekir.
- Domain 70/70. Sözleşme: 1382 gerçek yanıt 0 sapma; OpenAPI güncel; kapsam denetimi 0 sorun.
- Ön yüz kapısı (paketteki web çıktısı üzerinde): çıkış 0; denetçi senaryoları 26/27 (önceki sürümlerdeki bilinen LOGIN-ENTER); v2141 23/23; v2142 35/35.
- Tasarım kilidi (1440 px, aynı veri/rol/dil, v2.14.2 web derlemesiyle): şube müdürü ve GMY ekranlarında tek fark menüdeki yeni öğe; İK ekranlarında menü ikinci satıra geçtiği için içerik 29 px aşağıda, içerik aynı.
- Paket başlatıcı (Ant Yapı paketi): ilk kurulum, veri yükleme, hazır; Ant Yapı İK 8 yol haritası görür; birim müdürü yalnız kendi birimini görür.

### Son tur (giriş ekranı özeti ve kılavuzlar) testleri
- Ön yüz kapısı ilk koşuda 3 eski regresyonda (V2132-EXEC-DURUM-RISK-KARAR, V2132-EXEC-BOS, V2132-SUBE-ANA-EKRAN) kaldı: düzenek bilinmeyen uca `[]` döndürüyor, yeni giriş bölümü bu bozuk yanıtta çöküyordu (`test-ciktilari/v2150/fe-kapi-giris-ozeti-dto-oncesi.log`). Testler değiştirilmedi; ürün düzeltildi (yanıt biçim denetimi). Yeniden koşu: çıkış 0, denetçi 26/27 (bilinen LOGIN-ENTER), v2.7.3 regresyonları geçti (`fe-kapi-son.log`).
- API 117 testten 116 (aynı bilinen haftalık slot kontrolü), sözleşme 1382 yanıt 0 sapma, OpenAPI güncel, kapsam 0 sorun (`api-npm-test-son.log`). TR/EN kapsam eksik 0; marka QA geçti.
- Paketteki web çıktısı üzerinde (build d729d61fa523; sonraki paketlerde JS dosyaları birebir aynı): ön yüz kapısı çıkış 0 (26/27, bilinen LOGIN-ENTER), v2141 23/23, v2142 35/35. Ant Yapı paketi başlatıcı smoke: ilk kurulum, veri yükleme, hazır; Ant Yapı İK 8 yol haritası; Antasya müdürü yalnız kendi birimi; Saha SB003 giriş ekranında yol haritası bölümü, aksiyon sorumlusunda yok (`paket-baslatici-antyapi-smoke-d729d61fa523.log`).
- Yol haritası yanıt biçimleri gerçek yanıtlarla denetlendi: Saha (İK, şube, GMY, aksiyon sorumlusu, izleyici) ve Ant Yapı (8 birim, plansız birim dahil) 0 hata.

## Açık noktalar
- Haftalık slot yöntemi (yukarıda).
- Yol haritası terminleri için hatırlatma / dikkat kuyruğu bağlantısı yok.
