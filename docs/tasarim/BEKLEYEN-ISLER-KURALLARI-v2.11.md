# Bekleyen işler — dokuz kuralın davranışı (v2.11.0)

Dayanak: tasarım v2 §5.5, §7; gereksinimler MP08; iş sahibinin 28.09.2026 koşulları. Uygulama: `db/migrations/0019_v2110_bekleyen_isler.sql`, `apps/api/src/workitems.ts`, `apps/api/src/routes/platform.ts`.

## Ortak kurallar (bütün kurallar için)

**Kapsam.** İş **şirket + kural** düzeyindedir: bir şirkette bir kural için aynı anda en çok bir etkin iş vardır (veritabanında benzersiz kısmi indeks). Kuralın birden çok kayda dokunduğu durumlarda (ör. birden çok başarısız davet, birden çok bekleyen içe aktarma) iş tek kalır; etkilenen kayıtlar işin **kanıt** alanında sayı, kimlik ve kısa özet olarak listelenir (kişisel veri yok: e-posta adresi, dosya içeriği, çalışan adı tutulmaz) ve "kaynağa git" bağlantısı ilgili şirket ekranını açar. Tek tek aksiyonlar merkezde iş olarak listelenmez (tasarım 7.1).

**Durumlar.** `open` (açık) · `claimed` (üstlenildi) · `snoozed` (ertelendi, tarihe kadar) · `dismissed` (reddedildi, en çok 30 gün) · `tenant_inactive` (şirket askıda/arşivde) · `resolved` (kaynakta çözüldü). **Reddedilen iş tamamlanmış iş değildir**: listede "reddedildi (… tarihine kadar)" olarak ayrı görünür; "çözüldü" sayılmaz.

**Değerlendirme — yalnız liste açılışında.** Kurallar bir HPW kullanıcısı bekleyen işler listesini açtığında, o kullanıcının erişebildiği ve son değerlendirmesi 5 dakikadan eski şirketler için çalışır. **Arka planda düzenli çalışan bir değerlendirici yoktur**: panel açılmadığı sürece kurallar değerlendirilmez ve ekrandaki zaman bunu gösterir (açık madde). Bir şirketin değerlendirmesi kilitte 2 sn'den, sorguda 5 sn'den uzun sürerse o şirket için hata kaydedilir; liste isteği toplam 8 sn bütçeyle diğer şirketlere devam eder, bütçe aşılırsa kalan şirketler “ertelendi” olarak işaretlenir ve son bilinen durumlarıyla (zamanıyla) gösterilir. Aynı şirketi eşzamanlı değerlendiren iki işlem şirket başına danışma kilidiyle sıraya girer; benzersiz indeks ikinci bir etkin iş açılmasını ayrıca engeller. Değerlendirme sistem eylemidir: işlem geçmişinde "sistem (kural değerlendirmesi)" olarak ve değerlendirmeyi tetikleyen kullanıcıyla kaydedilir.

**Kaynak okunamazsa ya da kural değerlendirilemezse.** Kuralın sorgusu hata verirse `eval_status = unreadable`; önkoşulu yoksa (ör. izlenen dönem kaldırıldı) `eval_status = not_evaluable` ve neden (`no_tracked_cycle`). İkisinde de: yeni iş açılmaz; **önceden açılmış iş çözülmüş sayılmaz, listede kalır**, durumu (açık/üstlenildi/ertelendi/reddedildi) korunur ve arayüz “kaynak okunamadı” ya da “değerlendirilemedi: izlenen dönem yok” gösterir; **son başarılı doğrulama zamanı değişmez**. Değerlendirme kaydı kural başınadır: aynı şirkette başarıyla değerlendirilen kuralların zamanı, başarısız kuralın zamanını ilerletmez.

**Güncellik.** Her iş ve her şirket+kural değerlendirmesi `last_ok_eval_at` (koşulun gerçekten doğrulandığı an) ve `last_eval_at` (son deneme) taşır. Gösterilen zaman son **başarılı** değerlendirmedir; önbellekteki kayıt yeniden gösterilirken zaman yenilenmez. 5 dakikadan eskiyse "güncel değil" yazılır.

**Erteleme bitince.** Erteleme tarihi geçince, sonraki değerlendirmede koşul sürüyorsa iş önceki sahibine döner — **yalnız sahibin hesabı etkin, şirkete geçerli ataması var ve rolü Sistem Yöneticisi ya da işin sahip rolüyse**. Değilse iş sahipsiz `open` olur, yetkili kişiler yeniden üstlenebilir ve geçmişe `work_item.owner_lost` yazılır. Aynı sahip denetimi her değerlendirmede üstlenilmiş işler için de yapılır. Koşul düzelmişse `resolved`.

**Reddetme.** Yalnız Sistem Yöneticisi; zorunlu gerekçe; en çok 30 gün. Anlamı: "bu dönem için HPW takibi gerekmiyor". Reddedilmişken aynı şirket+kural için yeni iş açılmaz. Süre bitince koşul sürüyorsa **aynı kayıt** yeniden açılır; koşul reddetme süresinde düzelirse kayıt `resolved` olur.

**Tekrar oluşma.** `resolved` iş kapanmış kalır; son sorun kanıtı (etkilenen kayıt özeti) işte, çözüm anındaki kanıt işlem geçmişinde saklanır. Aynı sorun sonra yeniden oluşursa **yeni kayıt** açılır (`occurrence` bir artar); eski kayıt yeniden açılmaz. Buna karşılık sorun **sürerken** erteleme/reddetme bittiğinde ya da şirket askıdan döndüğünde **aynı kayıt** geri gelir.

**Şirket yaşam döngüsü.** Şirket durdurulur ya da arşivlenirse etkin işler `tenant_inactive` olur (önceki durum saklanır), yeni iş açılmaz, işlemler (üstlen/bırak/ertele/reddet) reddedilir. **Erteleme ve reddetme süreleri askıdayken de takvim zamanıyla işler** (duraklatılmaz). Şirket yeniden etkinleşince önceki durum körlemesine geri yüklenmez: (1) kaynak koşulu değerlendirilir — koşul düzelmişse iş `resolved`; (2) koşul sürüyorsa ya da kaynak okunamıyorsa iş kapanmaz; önceki durumdan başlanır, süresi dolmuş erteleme/reddetme bitmiş sayılır, sahibin güncel yetkisi denetlenir (yetkisi yoksa sahipsiz `open`); (3) kaynak okunamıyorsa belirsizlik `eval_status = unreadable` olarak işte görünür. Geçmişe `work_item.tenant_active` ve gerekiyorsa `snooze_ended`/`dismiss_ended`/`owner_lost` yazılır. Arşivdeki şirketin işlerini yalnız atanmış Sistem Yöneticisi ve Denetçi görür (mevcut erişim kuralı).

**Kim ne yapabilir.** Görme: şirkete geçerli ataması olan bütün HPW rolleri (danışman yalnız atandığı şirketler). Üstlenme, bırakma, erteleme: Sistem Yöneticisi ya da işin sahip rolündeki kişi (danışman kuralları → Danışman; metodoloji kuralı → Metodolog); Denetçi yalnız okur. Reddetme: yalnız Sistem Yöneticisi. Bütün yetkiler sunucuda ve veritabanı politikalarında denetlenir; arayüzde düğmenin gizlenmesi yetki yerine geçmez. Üstlenmek müşteri tarafındaki aksiyon sahibini değiştirmez.

**İşlem güvenliği.** Her işlem `expectedVersion` ister (sürüm çatışması 409). İşlem anahtarıyla (`Idempotency-Key`) tekrar aynı sonucu döndürür, ikinci iş etkisi oluşturmaz; aynı anahtar farklı içerikle 409. Tekrarda güncel erişim ve rol yeniden denetlenir. Eşzamanlı iki üstlenmede yalnız biri başarılı olur; diğeri 409 `work_item_taken`.

**Hedef süre.** Açılış anından itibaren iş günü (Pzt–Cum) sayılır; resmî tatil takvimi yok (açık madde).

## Kurallar

| Kural (kod) | İş açılır | Kapsam ve kanıt | Sahip rol · hedef | Kendiliğinden kapanır (`resolved`) | Önkoşul yoksa |
|---|---|---|---|---|---|
| Kurulum gecikti (`setup_overdue`) | Şirket açılışından 14 gün geçmiş ve kurulum adımları 1–9'dan en az biri tamamlanmamış | şirket; eksik adımların listesi, açılıştan bu yana gün | Danışman · 3 iş günü | 1–9 tamamlanınca | — |
| Yöneticisiz şirket (`no_admin`) | İK yöneticisi daveti 7 günden eski ve kabul edilmiş etkin İK yöneticisi yok | şirket; en eski bekleyen davet tarihi, bekleyen davet sayısı | Danışman · 2 iş günü | kabul edilmiş etkin İK yöneticisi olunca | İK yöneticisi daveti hiç yoksa kural açmaz (kurulum kuralı kapsar) |
| Davet başarısız (`invite_failed`) | Etkin üyeliklerin son davetlerinden en az biri kalıcı başarısız | şirket; başarısız davet sayısı, profil dağılımı (adres yok) | Danışman · 2 iş günü | kalıcı başarısız son davet kalmayınca | — |
| İçe aktarma bekliyor (`import_pending`) | Doğrulanmış ama onaylanmamış içe aktarma 3 günden eski **ya da** en son içe aktarma başarısız | şirket; bekleyen iş sayısı, tür, yaş; son başarısızın türü ve zamanı (dosya içeriği yok) | Danışman · 2 iş günü | iki koşul da kalmayınca | — |
| Gecikmiş uygulama (`overdue_actions`) | İzlenen dönemde gecikmiş (süren, son tarihi geçmiş) aksiyon ≥ 10 **ya da** uygun aksiyonların ≥ %20'si | şirket + izlenen dönem; gecikmiş/uygun sayısı, en eski gecikme günü, dönem kodu | Danışman · 5 iş günü | eşiklerin altına inince | izlenen dönem yok → `not_evaluable` |
| Doğrulama birikti (`verification_backlog`) | İzlenen dönemde doğrulama bekleyen en eski tamamlanma beyanı 14 günden eski | şirket + izlenen dönem; bekleyen sayı, en eski yaş (beyan zamanı olarak aksiyonun son güncelleme zamanı kullanılır — açık madde) | Danışman · 5 iş günü | 14 günden eski bekleyen kalmayınca | izlenen dönem yok → `not_evaluable` |
| Merkezi karar bekliyor (`central_decision`) | Şirketin merkezi kuyruğunda 7 günden eski açık ya da incelemede karar | şirket; sayı, en eski yaş, tür dağılımı | Danışman · 5 iş günü | 7 günden eski açık karar kalmayınca | — |
| Hareketsiz şirket (`inactive`) | Yayımlı sonucu olan etkin şirkette 30 gündür şirket işlem geçmişinde olay yok | şirket; son olay zamanı | Danışman · 10 iş günü | yeni olay oluşunca | yayımlı sonuç yok → kural açmaz |
| Metodoloji kararı (`methodology`) | Karşılaştırılabilirlik incelemesi gereken ve incelemesi yapılmamış sonuç değerlendirmesi var | şirket; bekleyen inceleme sayısı | Metodolog · 5 iş günü | bekleyen inceleme kalmayınca | — |

Şirket durdurulmuş/arşivlenmişse bütün kurallar için yukarıdaki yaşam döngüsü kuralı uygulanır.

## Kalıcı başarısız davet — ortak tanım (bulgu V211-DAVET)

`tenant_failed_invitations(tenant)` (0019): etkin üyeliğin **en son** daveti kabul edilmemiş, iptal edilmemiş ve süresi dolmamış **ve** o davetin **en son** teslimat denemesi (`email_outbox`) kalıcı başarısız. Aynı davetin birden çok denemesi tek sayılır; sonradan başarılı teslim ya da kabul eski hatayı gölgelemez; iptal ve süresi dolan davet teslimat hatası sayılmaz (süresi dolan yönetici daveti kurulum adımı 4'te ayrıca “engelli”); başka şirkete ait teslimat kayıtları şirket eşleşmesiyle dışlanır. Portföyün başarısız davet sayısı, kurulum hesabı (adım 4 ve 9) ve `invite_failed` kuralı aynı fonksiyonu kullanır.

Önceki davranış (v2.8.0–v2.10.2): portföy ve kurulum `invitation.status = 'perm_fail'` arıyordu; bu değer davet tablosunun durum kısıtında olmadığı için başarısız davet sayısı her zaman 0'dı. Kanıt: `docs/test-ciktilari/v2110/baseline-v2102/`.

## v2.11.1 ekleri (bağımsız denetim V211-01…06)

- **Eşzamanlılık (V211-01).** Değerlendirme, şirketin etkin işlerini satır kilidiyle (`FOR UPDATE`) okur; kullanıcı komutları (üstlen/bırak/ertele/reddet) aynı satırı `FOR UPDATE` ile kilitler. Değerlendirme sürerken gelen komut değerlendirmenin bitmesini bekler ve güncel sürümü görür; komutun `expectedVersion` değeri değerlendirmenin değiştirdiği sürüme uymuyorsa 409 döner. Değerlendirmenin durum yazımları ayrıca sürüm koşullu (`WHERE id AND version`). Değerlendirme bir satır kilidini 2 sn içinde alamazsa o şirketin değerlendirmesi hata olarak listelenir.
- **Sorun var / yok (V211-03).** Kural değerlendirmesinin sonucu (`evaluations[].active_item_state`) tablo filtresinden ve sayfalamadan bağımsızdır: o şirket+kural için etkin iş varsa "sorun var (durum)", yoksa ve değerlendirme başarılıysa "sorun yok". "Başarıyla değerlendirildi" tek başına "sorun yok" anlamına gelmez.
- **Çatışma sonrası (V211-04).** 409'da pencere açık kalır, taslak (tarih, gerekçe) korunur, güncel kayıt okunur ve fark (durum, sürüm, üstlenen) gösterilir; kullanıcı "Güncel kaydı inceledim" kutusunu işaretlemeden gönderim yapılmaz. İşlem güncel kayıtta artık yapılamıyorsa düğme kapalıdır ve pencereyi kapatıp güncel satırı incelemesi söylenir.
- **Güncellik yaşlanması (V211-05).** Açık ekranda etiket 30 sn'de bir ve sekmeye dönüldüğünde yeniden hesaplanır; kurallar yeniden değerlendirilmez, son başarılı doğrulama zamanı değişmez.
- **Tarih sınırları (V211-06).** Takvim günü kullanıcının yerel saat dilimindedir. Gönderilen bitiş anı seçilen günün sonudur (yerel 23:59) ve iş kuralının sınırına (reddetme 30 gün, erteleme 90 gün; 1 dk pay) kısılır. Formun sunduğu en son gün, sınırın içinde kalan son yerel gündür. Sunucu sınırı değişmedi (30/90 günün 1 dk üstü 422).

## v2.11.2 ekleri (bağımsız yeniden denetim V2111-R1, R2)

- **İlk onaylanan komut sabittir (V2111-R1).** Kullanıcının onayladığı komutun gövdesi — mutlak bitiş anı dahil — ve dolayısıyla işlem anahtarı, sonuç kesinleşene kadar korunur. Yanıt kaybından sonra alanlar değiştirilmeden yeniden basılırsa aynı gövde ve aynı anahtar gider; sunucu kaydedilmişse makbuzu döndürür, kaydedilmemişse işlem bir kez uygulanır. Zamanın ilerlemesi (saniyeler, gün değişimi) yeni işlem niyeti oluşturmaz. Önceki gönderimin sonucu belirsizken alan değiştirilirse yeni komut gönderilmez; kullanıcıdan önce aynı işlemi yeniden göndermesi istenir. Çatışma (409) kesin bir sonuçtur: güncel kaydın incelenip yeniden onaylanması yeni bir komuttur (yeni sürüm, yeni anahtar). Sunucunun 30/90 günlük sınırı değişmedi.
- **Kural alanı çalışma anında doğrulanır (V2111-R2).** `evaluations[].active_item_state` zorunludur; izin verilen değerler `open`, `claimed`, `snoozed`, `dismissed`, `tenant_inactive` ya da `null`. Alanın yokluğu, boolean, boş metin ve bilinmeyen değer yanıtı geçersiz kılar: ekran anlaşılır hata ve “Yeniden dene” gösterir, “sorun yok” üretmez. İş durumu ve değerlendirme durumu alanları da izin verilen değerlerle doğrulanır.

## v2.11.3 ekleri (bağımsız yeniden denetim V2111-R1-A, R1-B)

- **Bekleyen komut pencereden bağımsızdır.** Sonucu belirsiz komut (gövde, mutlak bitiş anı, dolayısıyla işlem anahtarı) sayfa düzeyinde tutulur; kapsamı kullanıcı + şirket + iş + işlemdir. Vazgeç ya da Escape pencereyi kapatır; sunucudaki işlemi iptal etmez ve bekleyen komutu silmez. Pencere yeniden açılınca özgün tarih ve gerekçe doldurulur ve "sonucu henüz belirsiz bir gönderiminiz var" bilgisi gösterilir.
- **Gün değişimi (R1-A).** Tarih aralığı yeni komutlar içindir. Aynı değerlerle yapılan onay özgün komutun aynen yeniden gönderimidir: özgün bitiş anı hâlâ gelecekteyse aralık denetimi uygulanmaz ve aynı gövde/anahtar gider. Bitiş anı geçmişse yeniden gönderim yapılmaz (sunucu reddederdi); sonuç güncel kayıttan doğrulanır, uygulanmamışsa yeni tarihle yeni onay istenir.
- **Alan değişimi.** Sonuç belirsizken alan değiştirilirse önce güncel kayıt okunur: özgün işlem uygulanmışsa pencere sonuçla kapanır ve yeni değerler gönderilmez; uygulanmamışsa bu açıkça yazılır, gönderim yapılmaz ve ancak ikinci bir onayla yeni komut gönderilir (yeni sürüm denetimi aynı iş etkisinin iki kez oluşmasını ayrıca engeller). Güncel kayıt okunamazsa yeni komut gönderilmez.
- **Kapalı pencerede uzlaştırma.** Güncel liste, işin beklenen duruma daha yüksek sürümle geçtiğini gösterirse bekleyen komut uzlaştırılır ve kullanıcıya bildirilir. Açık pencerenin komutu kullanıcının eylemiyle sürdürülür.
- **Çatışma** (409) kesin sonuçtur; güncel kayıt incelenip yeniden onaylanması yeni komuttur. Sunucunun 30/90 günlük sınırı değişmedi.

## v2.11.4 ekleri (bağımsız yeniden denetim V2113-A01, A02)

- **Sonuç kanıtı komut kaydıdır (A01).** Sonucu belirsiz bir komutun uygulanıp uygulanmadığı yalnız sunucudaki komut kaydından anlaşılır: `GET /api/platform/commands/:key/outcome` — kullanıcı + işlem anahtarı; kayıt komutla aynı transaction içinde yazılır. `applied` ve kaydın yolu işi ve işlemi gösteriyorsa başarı bildirilir; işin durumu, sürümü ya da alanlarının aynı olması tek başına kanıt sayılmaz. Komutun şirketine güncel erişim yoksa sonuç görünmez (404 `command_not_visible`) ve belirsiz kalır.
- **Aynı ilke bütün yollarda.** Kapalı pencere (liste işin sürümünün ilerlediğini gösterince sorgulanır), alan değişimi, süre dolması ve makbuz kaybı (`receipt_lost`) yolları aynı sorguyu kullanır. `applied` → ekrandaki bekleyen komut ve API istemcisinin niyet kaydı birlikte kapanır. `not_found` ve işin sürümü ilerlemişse → özgün komut artık uygulanamaz (sürüm denetimi); "uygulanmadı" ve güncel kayıt gösterilir, niyet kapanır, yeni komut ancak güncel kaydı inceleyip yeniden onayla. `not_found` ve sürüm aynıysa → kayıt yok denir; yeni değerler ancak ikinci onayla gönderilir. Sorgu başarısızsa → sonuç belirsiz kalır, komut ve takip bilgisi korunur, yeni komut gönderilmez.
- **Süre dolması ve okunamama (A02).** Özgün bitiş anı geçtiyse komut yeniden yazılmaz; aynı değerlerle onay yalnız sonucu yeniden sorgular. Sorgu başarısızsa bekleyen komut silinmez: pencere kapatılıp açılsa da özgün tarih ve gerekçe ile "sonucu belirsiz" bilgisi gelir ve alan değişikliği yeni komut göndermez.

## v2.11.5 eki (bağımsız yeniden denetim V2114-A01)

- **Yokluk yanıtı okuma anına aittir.** Sonuç sorgusunun `not_found` yanıtı yalnız o anda bu anahtarla kaydedilmiş komut olmadığını söyler; ardından özgün komut commit olabilir. İş okuması sürümün ilerlediğini gösterirse özgün anahtar **yeni sürüm görüldükten sonra yeniden sorgulanır**: komut kaydı iş güncellemesiyle aynı transaction'da yazıldığından bu ikinci okuma, yeni sürümü üreten commit özgün komutsa onun kaydını görür. `applied` → "kaydedilmişti" (değiştirilen taslak gönderilmez); yine `not_found` → sürüm başka işlemle ilerlemiştir, özgün komut eski sürümle artık uygulanamaz → "uygulanmadı" (kesin); sorgu başarısız ya da erişim yok → belirsiz kalır, anahtar/gövde/takip korunur.
- **Sürüm aynıyken yokluk kesin değildir.** Özgün komut henüz tamamlanmamış olabilir: takip silinmez; yeni değerler ancak bu bilgi verildikten sonra açık bir ikinci onayla ayrı komut olarak gönderilir ve özgün komut ayrı takipte kalır (sonradan tamamlanırsa yeni komut sürüm denetimiyle reddedilir, özgün sonuç kapalı pencere uzlaştırmasında bildirilir).
- Aynı ilke süre dolması yolunda da uygulanır. İş okuması başarısızsa belirsizlik korunur.
- Pencere yeniden açıldığında yeni değerler için verilmiş önceki bilgi geçersiz sayılır: yeni değerlerle ilk onayda sonuç yeniden doğrulanır ve bilgi yeniden verilir; yeni komut ikinci onayla gider.

## v2.11.6 eki (bağımsız yeniden denetim V2115-A01)

- **Birden çok belirsiz eski komut ayrı tutulur.** Kullanıcı bilinçli ikinci onayla yeni bir komut gönderdiğinde, sonucu belirsiz her eski komut kendi yuvasında (kapsam + işlem anahtarı) saklanır; yeni bir komut ya da başka bir komutun sonuçlanması önceki belirsiz komutları silmez. Her kayıt yalnız kendi komut kaydı sorgusuyla (`applied` / sürüm ilerledikten sonra `not_found`) kapanır; sonuç okunamıyor ya da erişim yoksa kayıt ve istemci niyeti belirsiz kalır ve sonraki liste okumalarında yeniden sorgulanır.
- **Hangi gönderim?** Kapalı pencere uzlaştırmasının iletileri gönderimi tanıtır (şirket · işlem · bitiş günü · gerekçenin başı) ve birden çok sonuç aynı anda gösterilebilir; bir komutun sonucu başka bir komuta atfedilmez.
