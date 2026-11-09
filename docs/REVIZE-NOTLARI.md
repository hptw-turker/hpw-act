# Revize paketi — biriken notlar

Türker Bey'in notları geldikçe buraya yazılır; toplu revizede birlikte ele alınır. Her not tek tek düzeltilmez.

## R-01 · Hizmet ve veri yönetimi kaydı ekranı anlaşılır değil (08.11.2026)
Ekran: Platform → şirket → Kurulum → "Hizmet ve veri yönetimi kaydı" (`PlatformCompany.tsx`).
Not: "Ben bile dolduramadım."
- **Sorumlular** tek kutu olmasın: **HPW sorumlusu** ve **müşteri sorumlusu** ayrı satırlar (ayrı alanlar) olsun.
- Her alanın adının yanında, parantez içinde ne yazılacağı açıklansın:
  - Kayıt referansı (ör. hizmet sözleşmesi ve veri işleme sözleşmesinin numarası ya da adı)
  - Kapsam (hangi hizmet verilir, HPW Act'te hangi veri işlenir, hangisi işlenmez)
  - Saklama politikası sürümü (verilerin ne kadar saklanıp nasıl imha edileceğini tanımlayan belgenin adı ve sürümü)
  - HPW sorumlusu / müşteri sorumlusu (ad, unvan)
- Revizede dikkat: API'de `owners` tek alan; iki alana bölünürse sözleşme (OpenAPI, domain map, testler) ve kayıtlı eski değerlerin gösterimi birlikte ele alınmalı. Kayıt değişirse onay "yeniden kontrol"e düşer (mevcut kural).

## R-02 · Yapay zekâ kararı mimari belgeye yazılsın (08.11.2026)
Rapor entegrasyonuyla yapay zekâ önerisine şimdilik gerek kalmadı; bağlantı noktası her an entegre edilebilir şekilde korunacak. Mimari belgeye/ADR'ye kısa not: "yapay zekâ şimdilik kapalı, bağlantı noktası korunuyor".

## R-03 · "Kaydı kaydet"e basınca hiçbir şey olmuyor gibi görünüyor (08.11.2026)
Ekran: aynı form. Not: "Kaydı kaydet dedim, hareket yok."
Neden: başarı iletisi (`msg`) ve hata iletisi (`opErr`) sayfanın en üstünde, sekmelerin altında çiziliyor (`PlatformCompany.tsx` satır 88 ve 93). Form sayfanın altında olduğu için kullanıcı iletiyi görmüyor. Kayıt sonrası açılan "Onayla" düğmesi de formun yanında değil, yukarıdaki kurulum tablosunun 2. satırında.
Revize: ileti düğmenin hemen altında (role=status / role=alert) gösterilsin; kayıttan sonra "Şimdi onaylayın" adımı formun altında, düğmesiyle birlikte görünsün; aynı sorun bu sayfadaki diğer formlarda da taransın.

## R-04 · İK adımları işletme bazında ayrı kalır (08.11.2026)
Karar (Türker Bey): her işletmenin hedefi ayrı olduğu için İK'nın o hedefi desteklemek için yapacakları da işletmeye göre farklılaşır. İK adımları işletmeler arasında **birleştirilmez**; aynı cümle iki işletmede geçse bile iki ayrı iş olarak izlenir. İK'nın tek listesi işletmeye göre gruplanır, her adım hangi işletmenin hangi eylem planına ait olduğunu gösterir.

---

## v3.0.0 revizesinde ne oldu (08.11.2026)

- **R-01 · kapandı (ekran kalktı).** "Hizmet ve veri yönetimi kaydı" on adımlı eski kurulumun parçasıydı. v3.0'da HPW kurulumu üç adımdır (organizasyon → yol haritası → kullanıcılar ve davet); bu form v3 ekranlarında yer almaz. Eski ekran kodda durur, kapalı modüller açılırsa (yalnız test ortamı) görünür. Bu kaydın yeniden istenmesi hâlinde iki ayrı sorumlu satırı ve parantez içi açıklamalar bu notta yazıldığı gibi uygulanacak.
- **R-02 · kapandı.** ADR-0043 bölüm 10 ve mimari belgenin başındaki v3.0 notu: yapay zekâ kapalı, bağlantı noktası (`apps/api/src/ai`, `routes/ai.ts`) korunuyor.
- **R-03 · kapandı (ilke olarak bütün v3 formlarına uygulandı).** v3'te her işlemin sonucu düğmenin hemen altında `role=status` / `role=alert` ile görünür: giriş, yeni şirket, üç dosya yükleme (denetim sonucu, "Yüklendi. N satır işlendi."), davet gönderme, adım işaretleme. Kurulum ekranında yükleme sonrası özetin yenilenmesi iletinin kaybolmasına yol açıyordu; deneme sırasında yakalandı ve düzeltildi.
- **R-04 · uygulandı.** İşletme yol haritasındaki İK adımları işletmeye özeldir ve ayrı izlenir. Kurum adımına atıf yalnız "Kurum planı N · İK · aşama · kısa ad" satırında olur; durumu kurum adımından gelir, işletmede salt okunurdur ve sayımda ikinci kez sayılmaz. İK'nın "Bugün" listesi tarihe ya da yol haritasına göre gruplanır; her adım hangi işletmenin hangi planına ait olduğunu yazar.

---

## v3 adım kartı (09.11.2026, Türker Baş — bölge müdürü ekranı üzerinden)

Tasarım prototipi: `HPW_Act_adim_karti_tasarim.html` (A tek kayıt kutusu · B ayrı düğmeler · C iki sütun; seçim bekleniyor).
**Karar (09.11.2026, Türker Baş): A · Tek kayıt kutusu.**

- **R-05 · Notu kaydet.** Ekranda ayrı bir kaydetme düğmesi yok; not yalnız "Yapıldı" ile birlikte gidiyor, tek başına not eklenemiyor. Not, adım işaretlenmeden kaydedilebilmeli ve kaydedildiği açıkça yazmalı.
- **R-06 · Gelişme ekle.** İşin geldiği nokta yazılabilmeli ("Beş departmanın üçünden liste geldi"). Adım yapılmış sayılmaz; son gelişme kartta görünür.
- **R-07 · Engel bildir.** Tamamlanmayı engelleyen durum yazılabilmeli ("İK'dan ücret tablosunu bekliyoruz"). Engel adımla birlikte görünür; rapordaki termin değişmez. Engeli işletme müdürü, üstündeki bölge müdürü, İK ya da üst yönetim kaldırabilir; kaldırırken geliştirilen çözümü yazmak zorunludur (alan: "Çözüm notu (engeli kaldırabilmek için geliştirilen çözüm yazılmalıdır)"; boşsa engel kalkmaz), kimin kaldırdığı kayıtlarda kalır. İK'nın ekranında işletmelerden gelen engeller ayrı liste olarak görünür. Engel kutusunun ve İK listesindeki engellerin sol kenarında kırmızı çizgi olur.
- **R-08 · Tamamlandıyı geri al.** Yanlış işaretlenen adım "Yapılmadı"ya dönebilmeli; işlem geçmişte kalır, düğme değişir.
- **R-09 · Dosya ya da fotoğraf ekle.** Çıktının kendisi (tutanak, duyuru fotoğrafı, katılım listesi). Onay ve inceleme yok. Dosya tıklanınca iner (fotoğraf yeni sekmede de açılır); o işletmeyi görme yetkisi olan herkes (İK, üst yönetim, bölge müdürü) indirebilir, başka şirketten erişilemez. Sunucuda kiracıya bağlı dosya saklama gerekir.

## v3 plan kartı ve izleme göstergeleri (09.11.2026)

- **R-10 · Mevcut genelden düşükse kırmızı.** Madde kutusundaki "Mevcut" çubuğu ve değeri, mevcut değer karşılaştırma değerinin (ör. Ant Yapı geneli) altındaysa kırmızı olur.
- **R-11 · İzleme göstergeleri çok silik.** Tablo okunaklı hale getirilecek; beş alternatif hazırlandı (`HPW_Act_izleme_gostergeleri_5_alternatif.html`: güçlü tablo, madde kartları, ölçek çizgisi, fark odaklı, gruplu). **Karar (09.11.2026): Alternatif 3 · ölçek çizgisi** — mevcut, şirket geneli, sektör ve hedef aynı 0–100 çizgisinde; mevcut genelin altındaysa kırmızı.
- İlerleme kareleri: yapılan adım kırmızı dolar (kodda böyle; değişiklik gerekmiyor).

---

## v3.1.0 revizesinde ne oldu (09.11.2026)

Durum: **hazırlandı ve doğrulandı; canlıya alınmadı** (canlı sürüm eb30925). Kapsam R-05–R-11; R-01–R-04 kararları açılmadı.
Adım kartı yerleşimi: **A · tek kayıt kutusu** (son gelişme → engel → kayıtlar → kayıt ekle → ana eylemler). Prototipteki rol/yerleşim seçicileri, diğer alternatifler ve örnek veriler ürüne alınmadı.
Ana eylem sırası: "Planı incele" (sarı) → "Yapıldı olarak işaretle" (kırmızı; Bugün sayfası) / "Yapılmadı olarak geri al". Yerleşim A'da ayrı "Not ekle" düğmesi yoktur; not, kayıt kutusunun "Not" seçeneğiyle yazılır, kaydet düğmeleri koyu zeminlidir. "Planlarım" sağ sütunu geri gelmedi.

- **R-05 · uygulandı.** "Notu kaydet" adımı işaretlemeden çalışır; durum, sürüm ve termin değişmez; sonuç düğmenin altında (role=status). Not adım satırının üzerine yazılmaz, kayıt geçmişine eklenir. v3.0'da kaydedilmiş notlar ve Yapıldı işaretleri migrasyonla geçmişe bir kez aktarıldı; `rm2_step.note` sütunu korunur.
- **R-06 · uygulandı.** Gelişme kaydı adımı tamamlamaz; son gelişme kartın üstünde "Son gelişme" kutusunda görünür.
- **R-07 · uygulandı.** Engel, Yapıldı/Yapılmadı durumundan ve termin hesabından ayrıdır; kartta "Engel var" etiketi ve sol kenarı kırmızı çizgili kutu. Kaldırma yetkisi o işletmeyi kapsayan işletme müdürü, bölge müdürü, İK (HR_ADMIN/HR_PARTNER) ve üst yönetim (EXEC); kapsam API'de denetlenir, HPW personeli ve izleyici kaldıramaz. "Çözüm notu (engeli kaldırabilmek için geliştirilen çözüm yazılmalıdır)" zorunlu: boş ya da yalnız boşluk API'de 422 `resolution_required`. Bildiren/kaldıran kişi, zaman, açıklama ve çözüm geçmişte kalır; yeni engel eskisini silmez; tamamlamak engeli, engeli kaldırmak adımı değiştirmez. İK'nın Bugün ekranında "İşletmelerden gelen engeller" ayrı liste (kendi adımlarının yerine geçmez).
- **R-08 · uygulandı.** "Yapılmadı olarak geri al": durum, düğme, kareler ve sayaç güncellenir; termini geçmiş adım "Gecikti" olur. Yapıldı ve Geri alındı kişi ve zamanla geçmişte kalır. Sürüm denetimi ve tekrar gönderim koruması aynen; eşzamanlı ikinci istek 409.
- **R-09 · uygulandı.** Dosya yazı kutusunun altında görünür, metni silmez, kaydetmeden kaldırılabilir; metin ve ekler aynı kayıtta; yalnız dosya kaydedilebilir; ikisi de boşsa kayıt yapılmaz; başarısız gönderimde metin ve seçim korunur. Kabul: fotoğraf (JPEG, PNG, WEBP, GIF, HEIC), PDF, Word, Excel, PowerPoint; dosya başına 10 MB, kayıt başına 5 dosya (sunucuda; tür içerikten tanınır ve uzantıyla eşleşmeli). Depo: kalıcı `files` birimi, `/data/files/<şirket>/<rastgele anahtar>`; doğrudan adres yok, indirme/önizleme yetki denetimli uçtan; içerik çalıştırılmaz. `yedekle.sh` dosya arşivini de alır.
- **R-10 · uygulandı.** Plan kartında mevcut değer karşılaştırma değerinin altındaysa çubuk ve rakam kırmızı; karşılaştırma yoksa uyarı üretilmez.
- **R-11 · uygulandı (Alternatif 3 · ölçek çizgisi).** Mevcut, şirket geneli, sektör ve hedef aynı 0–100 çizgisinde, ayrıca açık metinle. Eksik değer çizilmez ve "—" yazılır; "İzlenir" korunur, sayısal işaret çizilmez. Hedef işareti rapordaki hedef metninden yalnız açık bir yüzde okunursa çizilir. Eşit değerler örtüşmesin diye hedef çizginin üstünde, sektör altında, karşılaştırma çizgiyi keser.
- İlerleme kareleri değişmedi: yapılan adım kırmızı dolar; kurum adımına atıf ikinci kez sayılmaz.
