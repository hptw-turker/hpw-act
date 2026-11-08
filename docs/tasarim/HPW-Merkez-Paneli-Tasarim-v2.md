<!-- Depo kopyası (v2.9.1). Kaynak: 27.09.2026 tarihinde üretilen “HPW-Merkez-Paneli-Gereklilikler-v2.md” (Tamamlanmış tasarım v2). Onay kaynağı: iş sahibinin aynı gün sohbetteki yazılı talimatı — “Önerdiğin kurguyu birebir uygula. Sadece buna İngilizce Arayüz ekle”. İmzalı ayrı bir karar kaydı yoktur; K1–K12 kararları bu talimatla onaylanmış sayılmıştır. -->

# HPW Act — Merkez Yönetim Paneli
## Tamamlanmış tasarım (v2)

27 Eylül 2026 · Referans kod: HPW Act v2.8.0 / ddfb024fdd9a · v1 tasarım önerisinin yerine geçer

Bu belge v1'deki araştırma ilkelerini ve gereklilik matrisini korur, v1 incelemesinde çıkan eksikleri kapatır ve v2.8.0'da uygulanmış temel paneli başlangıç noktası alır. Kapanmamış karar bırakmamak için her açık ürün sorusuna bir **önerilen karar** yazıldı; bunlar bölüm 0'da toplandı ve iş sahibinin onayını bekler. Onaylanmadan geliştirmeye geçilmez. Uygulama kodu değildir; ekranlar, veri modeli, uçlar ve kabul koşulları geliştirmenin doğrudan girdisidir.

## 0. Karar tablosu (onay bekler)

| No | Soru | Önerilen karar | Gerekçe | Değişirse etkisi |
|---|---|---|---|---|
| K1 | HPW danışmanı müşteri adına yazabilir mi? | Atandığı şirkette **kurulum işlerini** yazar (organizasyon, soru seti, dönem, sonuç yükleme, kullanıcı ve davet). **İşletme kararlarını** (hedef, aksiyon, kanıt doğrulama, kurumsal planlama kararları) yazamaz. | Kurulum HPW'nin verdiği hizmetin kendisi; işletme kararları müşterinin sorumluluğu ve hesap verebilirlik zinciri müşteride kalmalı | İşletme yazması açılırsa denetim ve sorumluluk zinciri yeniden tasarlanır |
| K2 | Şirket başına kaç HPW sorumlusu? | 1 ana danışman + en çok 1 yedek; metodolog ve denetçi ayrıca atanabilir | Tek sahiplik takibi net tutar; yedek izin ve devir sürekliliği sağlar | Kuyruk sahipliği ve devir akışı değişir |
| K3 | Merkezde şirketler arası karşılaştırma? | Yalnız operasyon durumu; anket skoru karşılaştırması ve sıralaması **yok** | Dönem, ölçek sürümü, gizlilik ve veri güveni farkları sıralamayı yanıltır | Metodoloji ve gizlilik tasarımı gerekir |
| K4 | Mevcut platform hesapları hangi role? | Hepsi **HPW Sistem Yöneticisi**; mevcut şirket erişimleri "yönetici kapsamı" olarak taşınır | Bugünkü davranışla uyumlu; kimse erişim kaybetmez | Taşıma betiği rol eşlemesi değişir |
| K5 | BOŞ kurulumunu kim yapar? | İlk hesap (bootstrap) HPW Sistem Yöneticisi olur; şirketi açar ve kurulum işlerini yapar ya da danışmana atar | Mevcut kurulum turu korunur | — |
| K6 | Durdurulan şirkette HPW ne yapabilir? | Müşteri tamamen kapalı; HPW **salt okuma**; tek yazma işlemleri yeniden etkinleştirme ve arşiv | Durdurma "hizmet askıda" demektir; veriyi değiştirmek askıyı anlamsızlaştırır | Kurulum yazması açık kalırsa durdurma yalnız müşteri kilidi olur |
| K7 | İşletme kararına acil müdahale? | Yalnız Sistem Yöneticisi, **müdahale modu** ile: gerekçe zorunlu, en çok 60 dakika, her yazma kayıtlı, şirketin İK yöneticisi kaydı görür | Nadir ama gerçek ihtiyaçlar (yanlış yüklenmiş kayıt, kilitlenmiş akış) kalıcı geniş yetki olmadan karşılanır | Müdahale yoksa bu işler müşteriye yaptırılır |
| K8 | KVKK: HPW'nin müşteri verisine erişimi | Şirketle imzalanan veri işleme sözleşmesine dayanır; kurulumda "sözleşme kaydı" adımı zorunlu; şirkete giriş, müdahale ve dışa aktarma kayıt altında; tek tek okuma kaydı tutulmaz | Hukuki dayanak ile orantılı iz; her okuma kaydı veri hacmini ve gürültüyü gereksiz büyütür | Okuma kaydı istenirse ayrı depolama ve saklama politikası gerekir |
| K9 | MFA yöntemi | Doğrulama uygulaması (TOTP) + tek kullanımlık kurtarma kodları; platform rollerinde zorunlu; hassas işlemlerde yeniden doğrulama | E-posta altyapısına bağımlı değildir; SMTP kararı beklemeden uygulanabilir | E-posta kodu seçilirse SMTP önkoşul olur |
| K10 | Arayüz dili | Türkçe; İngilizce kapsam dışı | Ürün tek dilli ve derleme denetimi İngilizce metni hata sayıyor | Çok dilli altyapı ayrı proje olur |
| K11 | Portföy nasıl hesaplanır? | Doğrudan okuma (eşzamanlılık en çok 3, 60 saniyelik yetki-duyarlı önbellek); özet tablosuna yalnız ölçümde p95 > 1,5 sn çıkarsa geçilir | v2.8.0 sıralı okuması bağlantı havuzunu tüketmiyor; önce ölçüm | Özet tablosu ilk sürüme alınırsa üretim işi ve tutarlılık kuralları eklenir |
| K12 | Arşiv ve veri imhası | Arşiv panelde; **kalıcı imha panelde yok**, ayrı ve çift onaylı prosedür | Geri alınamaz işlem tek tıkla yapılmamalı | — |

v1 incelemesinde özet tablosunun ilk sürüme alınmasını önermiştim (K11). v2.8.0'da şirketler tek tek ve sırayla okunduğu, bağlantı havuzunu tüketmediği için bu öneriyi ölçüm koşuluna bağlayarak geri çekiyorum.

## 1. Başlangıç noktası: v2.8.0'da çalışan

Şirket açma (sınırsız, kod benzersiz, tekrar güvenli), yetkili şirketlerin takip tablosu (durum, 4 adımlı kurulum, üye ve davet, yayımlı dönem, aksiyon, gecikmiş ve doğrulama bekleyen, son hareket, Türkçe arama, satır bazında hata), gerekçeli durdurma ve etkinleştirme (müşteri oturumları anında kapanır, giriş açıklayıcı iletiyle reddedilir), İK yöneticisi daveti (sonradan da, tekrar güvenli), şirket ekranına geçiş ve şirket bağlamındaki platform işlemlerinin işlem geçmişine yazılması. Yeni uçlar domain haritası ve sözleşme kapısından geçiyor.

Eksik olanlar bu belgenin konusudur: platform rolleri ve yazma yetkisinin daraltılması, personel ve atama ekranı, erişim iptali, platform düzeyi işlem geçmişi ve ekranı, kalıcı kurulum adımları, danışman sorumluluğu, bekleyen işler, arşiv, sıralama/filtre/sayfalama, güncellik, MFA, dışa aktarma (P1), ölçek ölçümü, erişilebilirlik ve diğer tarayıcılar.

## 2. Yapılmayacaklar

| Konu | Karar | Neden |
|---|---|---|
| İngilizce arayüz | Yapılmayacak (K10) | Ayrı kapsam; mevcut mekanizma yok |
| Şirketler arası skor karşılaştırması ve sıralaması | Yapılmayacak (K3) | Metodolojik olarak yanıltıcı; gizlilik riski |
| Portföyde birim kırılımı | Yapılmayacak | Gizlilik eşiği altındaki birimler merkezde tekil görünür hale gelir |
| Panelden kalıcı veri silme | Yapılmayacak (K12) | Geri alınamaz; ayrı prosedürle yapılır |
| Şirketler arası toplu işletme işlemleri (toplu hedef kabulü, kanıt onayı, sonuç yayımı) | Yapılmayacak | Her şirketin kararı kendi sorumluluğunda |
| Müşteri kullanıcısı kılığına girme (impersonation) | Yapılmayacak | Aktör her zaman HPW personeli kalmalı; yerine müdahale modu (K7) |
| Her okuma işleminin tek tek kaydı | Yapılmayacak (K8) | Giriş, müdahale ve dışa aktarma kaydı hukuki izi karşılıyor |
| Şirket başına ayrı kurulum ya da mikroservis | Yapılmayacak | 20 şirket için gereksiz; mevcut RLS izolasyonu yeterli |
| E-postayla MFA | Yapılmayacak (K9) | SMTP bağımlılığı |
| Faturalama, CRM, sözleşme ve ödeme | Bu projede yok (P2) | Ayrı iş alanı |
| Periyodik e-posta bildirimleri | SMTP kararına kadar ertelenir (P1) | Gerçek gönderim altyapısı yok |

## 3. Rol ve yetki modeli

### 3.1 Roller ve kapsam

Her HPW personelinin bir **genel rolü** ve atandığı şirketlerde bir **şirket görevi** vardır. Genel rol ne yapabileceğini, şirket ataması nerede yapabileceğini belirler; ikisi birlikte olmadan hiçbir şirket verisine erişilmez.

| Genel rol | Şirket görevleri | Kısa tanım |
|---|---|---|
| HPW Sistem Yöneticisi | yönetici kapsamı | Şirket açar, durdurur, arşivler; personel ve atamaları yönetir; müdahale modunu açabilir |
| HPW Danışmanı | ana danışman, yedek danışman | Atandığı şirketlerde kurulum işlerini yürütür, bekleyen işleri takip eder |
| HPW Metodoloğu | metodolog | Atandığı şirketlerde metodoloji kararlarını verir (madde eşdeğerliği, takip karşılaştırılabilirliği) |
| HPW Denetçisi | denetçi | Atandığı şirketleri ve işlem geçmişini salt okur |

Şirket kullanıcısı merkeze giremez; şirket üyeliği ile platform personelliği birbirine dönüşmez.

### 3.2 Yetenek sınıfları

Şirket içindeki her uç tek bir sınıfa aittir. Sınıflama `openapi-urun.json` üzerinden otomatik denetlenir: sınıfı olmayan yeni uç derlemeyi düşürür.

| Sınıf | Kapsadığı işler |
|---|---|
| Okuma | Şirket içi bütün GET uçları (dışa aktarma hariç) |
| Kurulum | Organizasyon (birim, rol, Excel, taşıma, birleştirme), sorumluluk haritası, soru seti yayımı, dönem açma, sonuç içe aktarma, kullanıcı ekleme, davet gönderme, erişim iptali |
| Metodoloji | Madde eşdeğerlik kararı, takip karşılaştırılabilirlik incelemesi |
| İşletme | Hedef oluşturma/kabul/inceleme/devir, aksiyon ve kanıt işlemleri, doğrulama, kurumsal planlama (istek, kohort, uzlaştırma, ana aksiyon, dağıtım, merkezi karar, kaynak isteği), dikkat erteleme |
| Merkez yönetimi | Şirket açma, durum, arşiv, personel, atama, müdahale |
| Denetim | İşlem geçmişi okuma |

### 3.3 Rol × yetenek matrisi

| Yetenek | Sistem Yöneticisi | Danışman | Metodolog | Denetçi |
|---|---|---|---|---|
| Okuma (atanmış şirket) | Var | Var | Var | Var |
| Kurulum | Var | Var | Yok | Yok |
| Metodoloji | Var | Yok | Var | Yok |
| İşletme | Yalnız müdahale modunda | Yok | Yok | Yok |
| Merkez yönetimi | Var | Yok | Yok | Yok |
| Denetim (işlem geçmişi) | Atanmış + genel olaylar | Atanmış şirketler | Atanmış şirketler | Atanmış şirketler |
| Bekleyen iş üstlenme | Var | Var | Metodoloji işleri | Yok |
| Dışa aktarma (P1) | Ayrı izinle | Yok | Yok | Ayrı izinle |

Durdurulmuş şirkette tüm roller için yalnız okuma geçerlidir (K6). Arşivlenmiş şirkette okuma yalnız Sistem Yöneticisi ve Denetçide kalır.

### 3.4 Üç katmanda uygulama

**API.** `requireProfile` ve `profileForUnit` içindeki platform istisnası kaldırılır. Yerine `requirePlatformCapability(p, tenantId, sınıf)` gelir: genel rol + şirket ataması + şirket durumu + (işletme için) etkin müdahale kaydı birlikte değerlendirilir. Müşteri profilleri için mevcut `PERMISSION_RULES` aynen kalır.

**Veritabanı.** Her şirket tablosuna kısıtlayıcı (RESTRICTIVE) bir yazma politikası eklenir: platform alanında INSERT/UPDATE/DELETE yalnız `app.platform_write = 'on'` iken geçer. API bu değişkeni yalnız yetenek denetimi olumlu çıktığında ve yalnız o işlem için açar. Böylece API'de bir kontrol unutulsa bile salt okunur rol veritabanına yazamaz. Mevcut `platform_access`, `platform_membership`, `platform_invitation` politikaları okuma (FOR SELECT) ve yazma olarak ikiye ayrılır.

**Yetki özeti ucu ve arayüz.** `GET /api/t/:tid/permissions` platform kullanıcısına artık "her şey açık" dönmez; `platformRole`, `capabilities` ve etkin müdahale bilgisini döndürür. Arayüz kurulum ekranlarının düğmelerini kurulum yeteneğine, işletme düğmelerini işletme yeteneğine bağlar. Danışman şirket ekranına girdiğinde hedef ve aksiyon ekranlarını okur ama düğmeleri görmez; ekranın üstündeki bağlam satırı nedenini söyler.

### 3.5 Müdahale modu

Sistem Yöneticisi, şirket ekranındaki bağlam satırından "Müdahale modunu aç" ile başlatır. Gerekçe (en az 20 karakter) ve süre (15/30/60 dakika) seçilir; yeniden doğrulama (MFA) istenir. Müdahale süresince işletme düğmeleri açılır, ekranın üstünde kırmızı olmayan, siyah zeminli kalıcı bir şerit "Müdahale modu · kalan süre · bitir" gösterir. Her yazma işlem geçmişine müdahale kimliğiyle yazılır. Süre dolunca ya da "bitir" ile mod kapanır; açık kalan sekmedeki düğmeler bir sonraki istekte 403 ile durur ve açıklama çıkar. Şirketin İK yöneticisi kendi İşlem geçmişinde müdahaleyi, gerekçesini ve yapılan işlemleri görür.

### 3.6 Erişim iptali

Genel rol kaldırıldığında kullanıcının bütün platform oturumları aynı işlemde silinir. Şirket ataması kaldırıldığında o şirkete erişim bir sonraki istekte reddedilir (bugünkü davranış); ayrıca portföy önbelleği kullanıcının yetki sürümüyle anahtarlandığı için eski özet dönmez, bekleyen dışa aktarma işleri iptal edilir ve indirme bağlantıları geçersizleşir. Şirketin tek ana danışmanı ya da son Sistem Yöneticisi kaldırılamaz; ekran önce devir ister.

### 3.7 MFA ve yeniden doğrulama

Platform rollerinde ilk girişte doğrulama uygulaması kurulumu zorunludur (QR ve elle giriş anahtarı, 10 kurtarma kodu). Şirket durdurma ve arşivleme, personel ve atama değişikliği, müdahale modu ve dışa aktarma son 10 dakika içinde yeniden doğrulama ister. MFA sıfırlama yalnız başka bir Sistem Yöneticisi tarafından yapılır ve kayıt altına alınır.

## 4. Veri modeli (migrasyonlar 0014–0019)

| Migrasyon | Tablo / değişiklik | Ana alanlar | Kural |
|---|---|---|---|
| 0014 | `platform_role` | user_id, role (admin/consultant/methodologist/auditor), granted_by, granted_at, revoked_at, revoked_by, reason | Kullanıcı başına bir etkin rol; mevcut platform kullanıcıları admin olarak taşınır |
| 0014 | `platform_tenant_access` (genişletme) | + duty (admin_scope/primary/backup/methodologist/auditor), valid_from, valid_to, granted_by, reason, revoked_at, revoked_by, version | Şirkette en çok bir ana ve bir yedek danışman; mevcut satırlar admin_scope |
| 0014 | Yazma politikaları | RESTRICTIVE politika + `app.platform_write` | Bölüm 3.4 |
| 0015 | `platform_audit_event` | id, occurred_at, actor_id, action, tenant_id (boş olabilir), target_type, target_id, before, after, reason, result, request_id, intervention_id | Yalnız ekleme; RLS: aktörün erişebildiği şirketler + admin için genel olaylar |
| 0015 | `platform_intervention` | id, tenant_id, actor_id, reason, started_at, ends_at, ended_at, ended_by | Şirket başına aynı anda bir etkin müdahale |
| 0016 | `tenant` (genişletme) | + archived_at, archived_by, archive_reason, tracked_cycle_id, dpa_signed_at, dpa_ref, version | Arşiv durumu `status` alanını genişletmez; ayrı sütun |
| 0016 | `onboarding_step` | tenant_id, step_key, state (todo/done/blocked/error), detail, confirmed_by, confirmed_at | Otomatik adımlar türetilir; elle onaylı adımlar burada tutulur |
| 0017 | `hpw_work_item` | id, tenant_id, rule_key, generation, state, claimed_by, claimed_at, due_at, snooze_until, snooze_reason, dismiss_until, dismiss_reason, first_seen_at, last_seen_at, resolved_at, detail | Şirket + kural başına en çok bir açık iş (tekil indeks) |
| 0018 | `platform_mfa` | user_id, secret (şifreli), enabled_at, recovery_hashes, reset_by | Sır uygulama anahtarıyla şifrelenir |
| 0019 (P1) | `export_job` | id, actor_id, scope, state, created_at, expires_at, file_ref | Oluşturma ve indirmede yetki yeniden denetlenir |

Kaynak hedef, aksiyon ve kanıt verisi çoğaltılmaz. Özet tablosu yalnız K11 eşiği aşılırsa eklenir.

## 5. Bilgi mimarisi ve ekranlar

### 5.1 Merkez kabuğu

Mevcut üst çubuk korunur: "Happy Place to Work® Act · HPW Merkezi · ad · rol · çıkış". Altında sekmeli gezinme: Genel bakış · Şirketler · Bekleyen işler · Ekip ve erişim · İşlem geçmişi · Sistem ve teslimatlar. Sekmeler role göre görünür (Ekip ve erişim yalnız Sistem Yöneticisi; Denetçi yalnız Genel bakış, Şirketler ve İşlem geçmişi). Arama, filtre, sıralama ve sayfa adres satırında tutulur; şirket ekranından "Merkeze dön" aynı görünümü açar.

### 5.2 Genel bakış

Tek baskın gösterge **Müdahale gerektiren şirketler** (açık bekleyen işi olan benzersiz şirket sayısı) ve yanında kapsam satırı: "Yetkili olduğunuz 18 şirket · 17'si güncel, 1'inin özeti alınamadı · özet saati 10:15". Altında üç yardımcı sayı: kurulumu eksik, doğrulama bekleyen aksiyonu olan, izlenen dönemi seçilmemiş. Her sayı tıklanınca Şirketler sekmesi aynı filtreyle açılır. Alt bölüm "Önce ilgilenmeniz gereken işler": en eski 10 açık iş (şirket, kural, gerekçe, sorumlu, son tarih, kaynağa git).

### 5.3 Şirketler

Tablo sütunları: Kod · Şirket · Durum · Kurulum aşaması · HPW sorumlusu · İzlenen dönem · Kullanıcılar · Aksiyon (gecikmiş, doğrulama bekleyen) · Açık iş · Son hareket · Güncellik · işlemler. Filtreler: durum (aktif/durdurulmuş/arşiv), kurulum (tamam/eksik), sorumlu, açık işi olan. Sıralama her sütunda; varsayılan "açık işi olan önce, sonra ada göre". Sayfalama 25'li, sabit imleçli. Arama kod ve adda Türkçe büyük/küçük harf duyarsız. Dar ekranda sorumlu, güncellik ve son hareket satır ayrıntısına iner; şirket adı ve durum kaybolmaz.

İşlemler role ve duruma göre: Aç · durdur/etkinleştir · arşivle · yönetici davet et · sorumlu ata. Arşivlenmiş şirketler varsayılan filtrede görünmez.

Boş durumlar ayrıdır: hiç şirket yok ("İlk şirketi açın") / filtrede sonuç yok ("Filtreyi temizle") / bu kapsama yetkiniz yok / özet henüz hazır değil / servis hatası (yeniden dene). Hiçbiri "0" olarak gösterilmez.

### 5.4 Şirket detayı

Şirket satırına tıklanınca açılır; sekmeleri:

**Özet**: durum, izlenen dönem, sayaçlar, son hareket, veri işleme sözleşmesi kaydı. **Kurulum**: bölüm 6'daki adımlar, her birinde durum, eksik nedeni ve "şirket ekranında aç" bağlantısı. **Dönemler ve ilerleme**: dönem listesi, yayım durumu, izlenen dönem seçimi (danışman ya da yönetici; sürüm kontrolüyle). **HPW sorumluları**: ana ve yedek danışman, metodolog, denetçi; geçerlilik tarihleri; "devret" ve "atamayı bitir". **İşlem geçmişi**: bu şirkete ait platform olayları ve müdahaleler.

### 5.5 Bekleyen işler

Tablo: Şirket · Kural · Gerekçe (ör. "12 gecikmiş aksiyon, en eskisi 34 gün") · Durum (açık/üstlenildi/ertelendi) · Takip eden · Son tarih · Kaynağa git. İşlemler: üstlen, bırak, ertele (tarih + neden), reddet (yalnız Sistem Yöneticisi; neden; en çok 30 gün). "Takip için üstlenmek" müşteri tarafındaki aksiyon sahibini değiştirmez. Kaynağa git bağlantısı şirketi, dönemi ve varsa filtreyi taşır (ör. Dikkat ekranı gecikmiş aksiyonlar).

### 5.6 Ekip ve erişim (yalnız Sistem Yöneticisi)

Personel tablosu: ad, e-posta, genel rol, MFA durumu, atandığı şirket sayısı, son giriş, durum. İşlemler: personel ekle (rol seçilir, parola belirleme bağlantısı üretilir), rolü değiştir, erişimi kaldır. Personel satırından atama ekranı: şirket seç (çoklu), görev, başlangıç ve bitiş, gerekçe; kaydetmeden önce önizleme ("3 şirkete ana danışman olarak atanacak; 1'inde mevcut ana danışman yedeğe geçecek"). Erişim kaldırmada açık işleri olan personel için önce devir ekranı açılır.

### 5.7 İşlem geçmişi

Filtreler: şirket, aktör, olay türü, tarih aralığı. Satır: zaman · aktör · şirket · olay · hedef · gerekçe · sonuç. Satır açılınca önce/sonra değerleri. Müşteri verisi içermez; kişisel veri yalnız aktör ve hedef e-postasıyla sınırlıdır.

### 5.8 Sistem ve teslimatlar

Şirketler arası teknik durum: son başarısız içe aktarmalar (şirket, tür, zaman, hata kodu; dosya içeriği yok), kalıcı başarısız davetler (şirket, sayı; e-posta adresleri yalnız ilgili şirketin ekranında), özet üretim hataları. Yeniden deneme yalnız yetkili rolde ve kaynak şirket ekranı üzerinden yapılır.

### 5.9 Şirket ekranında HPW bağlam satırı

Platform kullanıcısı şirket ekranındayken üst çubuğun altında kalıcı satır: "HPW Merkezi olarak görüntülüyorsunuz · Şirket: Migros Ticaret · İzlenen dönem: 2026-ANA · Yetkiniz: kurulum (yazma), işletme (yalnız okuma) · Merkeze dön". Sistem Yöneticisinde sağda "Müdahale modunu aç". Şirketin İK yöneticisi ekranlarında HPW personelinin işlemleri aktör adıyla ve "HPW" etiketiyle görünür.

### 5.10 Görsel ve etkileşim kuralları

Mevcut tasarım sistemi korunur: Poppins 400/700, kırmızı/siyah/beyaz, köşeli kutular, gölgesiz düğmeler, ikon ve renkli durum rozeti yok; durum kelimeyle ve sıralamayla anlatılır. Seçenekler aralıklı ayrı düğmeler, seçimde yalnız renk değişir. Onay gerektiren işlemler tarayıcı istemi yerine modal kullanır: modal kapanınca odak çağıran düğmeye döner, hata girilmiş veriyi silmez.

## 6. Kurulum akışı

| Adım | Tamamlanma kuralı | Kaynak | Kim |
|---|---|---|---|
| 1 Şirket bilgileri | Kod, ad, dil, saat dilimi kayıtlı | tenant | Sistem Yöneticisi |
| 2 Veri işleme sözleşmesi | `dpa_signed_at` ve referans girildi | tenant | Sistem Yöneticisi (elle) |
| 3 HPW sorumlusu | Etkin ana danışman ataması var | platform_tenant_access | Sistem Yöneticisi |
| 4 İlk İK yöneticisi | Üç ayrı durum: davet hazır → gönderildi → kabul edildi; yalnız kabulde tamam | invitation | Yönetici / danışman |
| 5 Organizasyon | En az 1 etkin birim ve 1 rol | org_unit, org_role | Danışman |
| 6 Soru seti | Yayımlanmış sürüm var | instrument_version | Danışman |
| 7 Dönem | Dönem açık ve izlenen dönem seçili | survey_cycle, tenant | Danışman |
| 8 Sonuçlar | İzlenen dönemde etkin sonuç partisi | survey_cycle.active_batch_id | Danışman |
| 9 Kullanıcılar | En az bir davet kabul edilmiş şirket kullanıcısı (İK dışı) | invitation | Danışman / İK |
| 10 Kullanıma hazır | 1–9 tamamken danışman onaylar | onboarding_step | Ana danışman (elle) |

Bir adımın önkoşulu eksikse durum "engelli" ve nedeni yazılır (ör. 8, 6 ve 7 tamamlanmadan engelli). Son içe aktarma başarısızsa ilgili adım "hata" gösterir. Sayfa kapatılıp açıldığında aynı durum okunur; ilerleme verinin kendisinden türetildiği için "yarım kalma" oluşmaz. Davet başarısızlığı şirketi yeniden yaratmaz; aynı adım yeniden denenir.

## 7. Bekleyen işler modeli

### 7.1 Kurallar (başlangıç eşikleri; kullanım verisiyle ayarlanır)

| Kural | Koşul | İş sahibi | Hedef süre |
|---|---|---|---|
| Kurulum gecikti | Şirket açılışından 14 gün sonra 1–9'dan eksik adım | Ana danışman | 3 iş günü |
| Yöneticisiz şirket | İlk İK yöneticisi daveti 7 günde kabul edilmedi | Ana danışman | 2 iş günü |
| Davet başarısız | Kalıcı başarısız davet ≥ 1 | Ana danışman | 2 iş günü |
| İçe aktarma bekliyor | Doğrulanmış ama onaylanmamış içe aktarma 3 günden eski ya da son içe aktarma başarısız | Ana danışman | 2 iş günü |
| Gecikmiş uygulama | İzlenen dönemde gecikmiş aksiyon ≥ 10 ya da uygun aksiyonların ≥ %20'si | Ana danışman | 5 iş günü |
| Doğrulama birikti | Doğrulama bekleyen en eski aksiyon 14 günden eski | Ana danışman | 5 iş günü |
| Merkezi karar bekliyor | Şirketin merkezi kuyruğunda 7 günden eski açık karar | Ana danışman | 5 iş günü |
| Hareketsiz şirket | Yayımlı sonucu olan aktif şirkette 30 gün iş olayı yok | Ana danışman | 10 iş günü |
| Metodoloji kararı | Karar bekleyen madde eşdeğerliği ya da karşılaştırılabilirlik incelemesi | Metodolog | 5 iş günü |

İşler şirket + kural düzeyindedir; tek tek aksiyonlar merkezde listelenmez. Ayrıntı "kaynağa git" ile şirketin kendi ekranında görülür. Bu seçim HPW'nin müşterinin işini değil, müşterinin durumunu takip ettiğini yansıtır ve tekilleştirmeyi basitleştirir.

### 7.2 Yaşam döngüsü

Kurallar her portföy üretiminde (en geç 5 dakikada bir) değerlendirilir. Koşul ilk kez doğru olduğunda iş **açık** olarak oluşur; şirket + kural için aynı anda yalnız bir açık iş olabilir. Personel işi **üstlenir** ya da bırakır. **Ertelenen** iş tarih ve nedenle saklanır; tarih geldiğinde koşul sürüyorsa yeniden açık olur. Koşul yanlışa döndüğünde iş kendiliğinden **kaynakta çözüldü** olarak kapanır; kimse elle "çözüldü" diyemez. **Reddedilen** iş (yalnız Sistem Yöneticisi, neden zorunlu) en çok 30 gün gizlenir; süre bitince koşul sürüyorsa yeniden açılır. Kapanmış bir işin koşulu sonradan yeniden doğarsa yeni nesil iş açılır; eski kayıt tarihçede kalır. Kaynak şirket durdurulur ya da arşivlenirse açık işleri "şirket askıda" nedeniyle kapanır.

## 8. Gösterge sözlüğü

v1 sözlüğü korunur; eklemeler:

| Gösterge | Tanım | Yanlış yorumun önlenmesi |
|---|---|---|
| İzlenen dönem | Şirkette danışmanın seçtiği `tracked_cycle_id` | Seçilmemişse "dönem seçilmedi"; en son dönem varsayılmaz. Dönem gerektiren sayaçlar "—" |
| Güncellik | Satırın üretildiği an; 5 dakikadan eskiyse "güncel değil" | Okuma hatası sıfır ya da "sorun yok" olarak gösterilmez |
| Müdahale gerektiren şirket | En az bir açık bekleyen işi olan benzersiz şirket | Hangi kuralın tetiklediği satırda yazar |
| Kurulum aşaması | Bölüm 6'daki 10 adımdan tamamlanan sayısı ve ilk eksik adım | Yüzde gösterilmez |

Anket skoru ortalaması, şirket sıralaması ve tek "başarı puanı" yoktur (K3). Gizlilik nedeniyle görünmeyen değer null ve neden taşır, sıfır yapılmaz.

## 9. Şirket yaşam döngüsü

| | Aktif | Durdurulmuş | Arşivlenmiş |
|---|---|---|---|
| Müşteri girişi | Açık | Kapalı (açıklayıcı ileti) | Kapalı |
| Müşteri oturumları | — | Durdurma anında silinir | Silinir |
| HPW okuma | Atanmış roller | Atanmış roller | Yalnız Sistem Yöneticisi ve Denetçi |
| HPW kurulum yazma | Kurulum yeteneği olanlar | Kapalı | Kapalı |
| Müdahale modu | Sistem Yöneticisi | Kapalı | Kapalı |
| Davet gönderimi ve otomasyonlar | Açık | Kapalı | Kapalı |
| Bekleyen iş üretimi | Açık | Kapalı; açık işler kapanır | Kapalı |
| Geçişler | → durdurulmuş (gerekçe, MFA) | → aktif, → arşiv (gerekçe, MFA) | → durdurulmuş (yalnız Sistem Yöneticisi) |

Arşiv, saklama süresinin başlangıcıdır. Kalıcı imha panelde yoktur; saklama süresi dolan şirket için ayrı, iki Sistem Yöneticisi onaylı bir prosedür (betik + tutanak) yürütülür.

## 10. API sözleşmeleri

Bütün yazma uçları `Idempotency-Key` alır, güncellemelerde `expectedVersion` ister, platform işlem geçmişine yazar ve yanıtları domain haritasında uç + JSON yolu bazında tanımlanır (boş başarı şeması derlemeyi düşürür).

| Uç | Durum | Yetki | Açıklama |
|---|---|---|---|
| GET /api/platform/me | Yeni | Tüm platform rolleri | Rol, yetenekler, MFA durumu, yetki sürümü |
| GET /api/platform/tenants | Genişler | Okuma | q, status, stage, owner, hasWork, sort, cursor, limit |
| GET /api/platform/tenants/:tid | Yeni | Okuma | Özet, kurulum adımları, sorumlular |
| PATCH /api/platform/tenants/:tid | Yeni | Kurulum (dönem) / Merkez yönetimi (sözleşme kaydı) | tracked_cycle_id, dpa alanları |
| POST /api/platform/tenants/:tid/status | Var | Merkez yönetimi + MFA | active/suspended |
| POST /api/platform/tenants/:tid/archive | Yeni | Merkez yönetimi + MFA | Arşive alma ve geri alma |
| POST /api/platform/tenants/:tid/onboarding/:step/confirm | Yeni | Ana danışman / yönetici | Elle onaylı adımlar |
| POST /api/platform/tenants/:tid/admin-invite | Var | Kurulum | Tekrar güvenli |
| GET /api/platform/portfolio | Genişler | Okuma | Filtreler, izlenen dönem, güncellik, kapsam |
| GET /api/platform/work-items | Yeni | Okuma | state, rule, tenant, owner, cursor |
| POST /api/platform/work-items/:id/{claim,release,snooze,dismiss} | Yeni | Rol matrisine göre | Bölüm 7.2 |
| GET/POST /api/platform/staff | Genişler | Merkez yönetimi | Personel listesi ve ekleme (rol zorunlu) |
| PATCH /api/platform/staff/:uid | Yeni | Merkez yönetimi + MFA | Rol değişikliği |
| POST /api/platform/staff/:uid/revoke | Yeni | Merkez yönetimi + MFA | Oturumlar silinir; açık işler devir ister |
| GET/POST /api/platform/tenants/:tid/assignments | Yeni | Okuma / Merkez yönetimi | Görev, tarih, gerekçe |
| POST /api/platform/assignments/:aid/{end,handover} | Yeni | Merkez yönetimi | Son sorumlu koruması |
| POST /api/platform/tenants/:tid/intervention | Yeni | Sistem Yöneticisi + MFA | Gerekçe, süre |
| POST /api/platform/interventions/:id/end | Yeni | Başlatan ya da başka yönetici | — |
| GET /api/platform/audit-events | Yeni | Denetim | tenant, actor, action, from, to, cursor |
| GET /api/platform/jobs | Yeni | Okuma | İçe aktarma, davet ve özet hataları; içerik sızdırmadan |
| POST /api/platform/mfa/{setup,verify,recovery} · POST /api/auth/reauth | Yeni | Platform kullanıcısı | TOTP |
| GET /api/t/:tid/permissions | Değişir | — | Platform rolü, yetenekler, müdahale bilgisi |
| POST /api/platform/exports · GET …/:id/download | Yeni (P1) | Dışa aktarma izni | Oluşturma ve indirmede yetki yeniden denetlenir, 24 saat |

## 11. İşlem geçmişi olay kataloğu

| Olay | Şirket | Önce/sonra | Gerekçe |
|---|---|---|---|
| tenant.create, tenant.update | Var | Var | — |
| tenant.suspend, tenant.activate, tenant.archive, tenant.unarchive | Var | Durum | Zorunlu |
| tenant.enter (HPW personeli şirket ekranını açtı) | Var | — | — |
| onboarding.confirm | Var | Adım | — |
| staff.create, staff.role_change, staff.revoke | Yok | Rol | Rol değişikliği ve iptalde zorunlu |
| assignment.grant, assignment.end, assignment.handover | Var | Görev, tarih | Zorunlu |
| intervention.start, intervention.end; müdahale içindeki her yazma | Var | Kaynak kaydın değişikliği | Başlangıçta zorunlu |
| workitem.claim, release, snooze, dismiss | Var | Durum | Erteleme ve retde zorunlu |
| mfa.enable, mfa.reset | Yok | — | Sıfırlamada zorunlu |
| export.create, export.download (P1) | Var | Kapsam | — |
| auth.platform_login, auth.platform_login_failed | Yok | — | — |

Şirket bağlamındaki olaylar ayrıca şirketin kendi `audit_event` kaydına da yazılır; böylece müşteri İK yöneticisi kendi ekranında HPW işlemlerini görür.

## 12. Performans ve ölçek

Referans deneme v1'deki gibi: 20 şirket; her şirkette 10 birim, 250 aksiyon, 100 kullanıcı; bir şirkette toplam verinin %50'si; 20 müşteri oturumu + 5 HPW oturumu. Bunun için `tools/seed/generate-portfolio.mjs` sentetik çok şirketli veri üreteci yazılır (belirlenimci tohum). Hedefler: portföy ve şirket listesi p95 ≤ 1,5 sn, panelin ilk kullanılabilir görünümü ≤ 3 sn, filtre yanıtı ≤ 1 sn. Portföy okuması en çok 3 eşzamanlı şirketle yapılır (havuz 10); sonuç kullanıcının yetki sürümüyle anahtarlanmış 60 saniyelik önbellekte tutulur. Ölçümde hedef aşılırsa şirket başına özet tablosuna geçilir (K11). Test ortamının CPU, bellek ve veritabanı gecikmesi raporda yazılır.

## 13. Erişilebilirlik

Tarayıcı testlerine ölçüm eklenir: ana düğmeler en az 44×44, tablo içi kontroller en az 24×24 CSS piksel (bounding box ile). Odak her zaman görünür ve sabit başlık altında kalmaz. Durum iletileri `aria-live` ile duyurulur. Üç ana akış (şirket açma, durdurma, atama) yalnız klavyeyle tamamlanır. %200 yakınlaştırmada 1280 genişlikte yatay kaydırma olmaz. Ekran okuyucu (VoiceOver, NVDA) kontrolü HPW tarafından elle yapılır ve tutanağa yazılır.

## 14. Test ve kabul

Mevcut bütün kapılar korunur: domain, API entegrasyonu ve sözleşme doğrulaması, domain haritası kapsam denetimi, ön yüz kabul kapısı (denetçi senaryoları, regresyonlar, bağımsız testler), BOŞ ve DOLU turları, temiz kurulum. Her dilime eklenen zorunlu senaryolar:

Yetki: 20 şirket × 4 rol olumlu ve olumsuz matris (liste, sayaç, arama, derin bağlantı, API, veritabanı yazma politikası); salt okunur rolün doğrudan HTTP ile yazma denemesi 403 ve veritabanında yazma reddi; danışmanın işletme düğmesini görmemesi ve API'de 403 alması; müdahale modunun süre dolunca kapanması ve eski sekmede 403 ile açıklama. İptal: rol kaldırmada oturumların silinmesi; atama kaldırmada önbellek ve indirme bağlantısının geçersizleşmesi; son sorumlu koruması. Yaşam döngüsü: durdurma ve arşivde müşteri, HPW ve otomasyon davranışı tablo 9'a birebir uyar. Bekleyen işler: tekilleştirme, kendiliğinden kapanma, erteleme dönüşü, ret süresi, yeni nesil. İşlem geçmişi: katalogdaki her olayın aktör, şirket, gerekçe ve sonuçla yazılması. Kurulum: 10 adımın durumları ve engelli/hata nedenleri. Bağlam: A→B→A şirket geçişi ve iki sekme. Hata yolları: şirket bazlı 503, portföy 503, bozuk yanıt, kısmi yükleme.

Tarayıcılar: kabul betikleri Playwright'ın Chromium, Firefox ve WebKit motorlarıyla koşar; gerçek macOS Safari son kontrolü HPW'nin Mac'inde aynı betiklerle yapılır ve sonucu teslimata eklenir. Koşulmayan kontrol "test edilmedi" olarak kalır.

## 15. Teslim dilimleri

| Dilim | Sürüm | İçerik | Kapattığı maddeler |
|---|---|---|---|
| 1 Güvenlik | 2.9.0 | Roller ve yetenekler, API/veritabanı/arayüz uygulaması, müdahale modu, platform işlem geçmişi ve ekranı, personel ve atama ekranı, erişim iptali, MFA, bağlam satırı | MP04, MP05, MP06, MP12, MP15 |
| 2 Kurulum ve sorumluluk | 2.10.0 | Şirket detayı, 10 adımlı kurulum, sözleşme kaydı, izlenen dönem, danışman atama ve devir, arşiv, sıralama/filtre/sayfalama ve adreste durum, derin bağlantılar | MP03, MP09, MP11, MP13, MP14 |
| 3 Takip | 2.11.0 | Bekleyen işler, gösterge sözlüğü ve güncellik, Sistem ve teslimatlar, sentetik 20 şirket üreteci ve yük ölçümü, erişilebilirlik ölçümleri, Firefox ve WebKit | MP07, MP08, MP10, MP16 |
| P1 | ayrı | Dışa aktarma, kayıtlı görünümler, periyodik bildirimler (SMTP sonrası), şablon dağıtımı | MP18–MP21 |

Her dilim kendi kabul kapısından geçer ve final ZIP üzerinde kanıtla teslim edilir. MP01, MP02 ve MP17 v2.8.0'da karşılandı; sonraki dilimlerde regresyon olarak korunur.

## 16. Gereklilik matrisi (güncel)

| Kimlik | Gereklilik | Öncelik | v2.8.0 | Dilim |
|---|---|---|---|---|
| MP01 | Yetkili şirket kataloğu | P0 | Tam | — |
| MP02 | Tekrar güvenli şirket oluşturma | P0 | Tam | — |
| MP03 | Kalıcı kurulum ilerlemesi | P0 | Kısmi | 2 |
| MP04 | Şirket/dönem bağlamı | P0 | Kısmi | 1 |
| MP05 | HPW rol ve şirket atamaları | P0 | Yok | 1 |
| MP06 | Erişim iptali | P0 | Yok | 1 |
| MP07 | Portföy özeti ve metrik tanımları | P0 | Kısmi | 3 |
| MP08 | Birleşik bekleyen işler | P0 | Yok | 3 |
| MP09 | HPW takip sorumluluğu | P0 | Yok | 2 |
| MP10 | Güncellik ve kısmi hata | P0 | Kısmi | 3 |
| MP11 | Şirket yaşam döngüsü | P0 | Kısmi | 2 |
| MP12 | Platform işlem geçmişi | P0 | Kısmi | 1 |
| MP13 | Mevcut ekranlara bağlantı | P0 | Kısmi | 2 |
| MP14 | Arama/filtre/sıralama/sayfalama | P0 | Kısmi | 2 |
| MP15 | Yetkisiz verinin tüm kanallarda ayrımı | P0 | Kısmi | 1 |
| MP16 | Erişilebilir tasarım | P0 | Yok | 3 |
| MP17 | Domain sözleşmesi ve DTO | P0 | Tam | her dilim |
| MP18 | Kontrollü dışa aktarma | P1 | Yok | P1 |
| MP19 | Kayıtlı görünümler | P1 | Yok | P1 |
| MP20 | Periyodik bildirim | P1 | Yok | P1 (SMTP sonrası) |
| MP21 | Şablon/metodoloji dağıtımı | P1 | Yok | P1 |
| MP22 | Faturalama, CRM | P2 | — | Kapsam dışı |

**Teslim tanımı (üç dilim sonunda):** HPW Sistem Yöneticisi tek girişle yetkili bütün şirketleri görür, yeni şirketi on adımda kullanıma açar, ekibini atar ve devreder, müdahale gerektiren işleri görür ve takip eder, şirket ekranında yalnız rolünün izin verdiği işlemi yapar ve yaptığı her işlemi geçmişten doğrular. Danışman kurulumu yürütür ama müşterinin kararlarını veremez. Hiçbir şirket diğerinin verisini göremez; veri eksikliği başarı gibi gösterilmez.

## Kaynaklar

v1 belgesinin kaynakları geçerlidir (erişim 27.09.2026): S1 Microsoft control planes; S2 AWS tenant onboarding; S3 AWS tenant isolation; S4 OWASP Authorization; S5 OWASP Multi-tenant security; S6 Atlassian admin roles; S7 Asana portfolio; S8 Carbon data table; S9–S11 W3C WCAG 2.2 (target size, focus not obscured, status messages); S12 PostgreSQL row security. Kısıtlayıcı yazma politikası (3.4) S12'deki RESTRICTIVE politika davranışına, müdahale modu ve en az ayrıcalık S4'e, erişim iptalinin önbellek ve dışa aktarmayı kapsaması S5'e dayanır.

Yerel kanıtlar (v2.8.0): apps/api/src/auth.ts, routes/platform.ts, routes/auth.ts, governance.ts, db.ts; db/migrations/0002_product.sql, 0003_hardening.sql, 0013_platform_panel.sql; apps/web/src/product/pages/Platform.tsx, permissions.ts; apps/api/src/contract/domain-map.ts.
