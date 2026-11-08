# HPW Act v3.0 — kısa kılavuz

HPW Act, rapor sunumunda anlatılan yol haritasının takip aracıdır. Hedefler rapordan gelir; uygulamada hedef yazılmaz, onaylanmaz, değiştirilmez. Her kişi kendi rolündeki adımları görür ve yaptığında işaretler.

## Giriş

Şirketinizin giriş adresi `https://<sunucu>/g/<ŞİRKET KODU>` biçimindedir; adres giriş sayfasında şirketin adını gösterir. Kullanıcı adı e-posta adresinizdir. Parolanızı davet e-postasındaki bağlantıyla siz belirlersiniz. İki adımlı doğrulama yoktur. Parolanızı unutursanız giriş sayfasındaki "Parolamı unuttum" bağlantısını kullanın. "E-postamı bu cihazda hatırla" yalnız e-posta adresini hatırlar, parolayı saklamaz.

## Bugün

Girişte "Bugün" açılır: size ait adımlar termine göre sıralıdır. En üstte geciken adımlar, sonra sıradaki terminler (İlk 30 gün, İlk 90 gün, İlk 6 ay), en altta yapılanlar kapalı durur. Her adımda adımın metni, çıktısı (adımın yapıldığını gösteren sonuç), bağlı olduğu eylem planı ve maddenin mevcut değeri ile hedefi yazar.

Adım yapıldığında "Yapıldı olarak işaretle"ye basın. İsterseniz önce "Not ekle" ile kısa bir not yazın (örnek: "Toplantıya 26 çalışan katıldı."). Sistem kimin ve ne zaman işaretlediğini kaydeder. Yanlışlıkla işaretlediyseniz "Yapılmadı olarak geri al"a basın.

Sağdaki "Planlarım" sütunu planlarınızı gösterir; "Planı incele" planın bütününü açar. Birden fazla yol haritasında adımı olan kişi (İnsan Kaynakları) listeyi "Tarihe göre" ya da "Yol haritasına göre" gruplayabilir.

## Planlar

Tek bir yol haritası gören kişide (işletme müdürü) planlar doğrudan açılır. Birden fazla yol haritası gören kişide (İnsan Kaynakları, üst yönetim) sol bölmede yol haritaları, sağda seçilen yol haritasının planları vardır; telefonda önce liste, dokununca ayrıntı açılır.

Her plan kartında izlenecek anket maddesi, mevcut değer, karşılaştırma (şirket geneli ya da sektör) ve hedef yazar; hedef "İzlenir" ise sayısal hedef yoktur. Altında önce sizin adımlarınız, sonra "Diğer rollerin adımlarını göster" ile öteki rollerin ve çalışanların adımları görünür. Sayfanın sonunda izleme göstergeleri tablosu vardır.

## Kim neyi işaretler

| Kişi | İşaretlediği adımlar |
|---|---|
| İnsan Kaynakları (HR_ADMIN, HR_PARTNER) | Kurum planındaki İK adımları ve bütün işletmelerin İK adımları |
| Üst yönetim (EXEC) | Kurum planındaki yönetim adımları |
| İşletme müdürü (UNIT_MANAGER), bölge müdürü (REGION_MANAGER) | Kendi işletmesinin yönetim adımları |
| İzleyici (VIEWER) | Hiçbiri; yalnız inceler |
| Happy Place to Work | Hiçbiri; kurulum yapar ve inceler |

Çalışan adımları bilgi içindir, işaretlenmez. İşletme planında "Kurum planı 1 · İK · İlk 30 gün · …" diye başlayan satır kurum planındaki bir İK adımıdır; durumu kurum adımı işaretlenince güncellenir, işletmede değiştirilmez. İnsan Kaynakları yöneticisi, gerekirse işletme ve kurum yönetimi adımlarını da plan ekranından işaretleyebilir (yedek yetki).

Durum kelimeyle yazılır: Yapıldı, Yapılmadı, Gecikti (termini geçmiş ve yapılmamış). Kırmızı dolu kare yapılmış adımı, boş kare yapılmamış adımı gösterir.

## Kişiler (İnsan Kaynakları yöneticisi)

"Kişiler" sekmesinde kullanıcılar, rolleri ve davet durumları (davet gönderilmedi, davet gönderildi, giriş yaptı) görünür. "Bekleyen davetleri gönder" gönderilmemiş davetleri yollar; girmemiş bir kişiye "Yeniden gönder" ile yeni bağlantı gider.

## Kurulum (Happy Place to Work sorumlusu)

1. Şirketler → Yeni şirket: şirket kodu (giriş adresinde görünür, sonradan değişmez), şirket adı, şirketin İK yöneticisinin adı ve e-postası.
2. Kurulum ekranında üç dosya sırayla yüklenir. Her dosyada "Boş şablonu indir" ile şablon alınır, doldurulur, "Dosyayı denetle" ile denetlenir; hata yoksa özet görünür ve "Onayla ve yükle" ile yüklenir. Sonuç düğmenin altında yazar.
   - Organizasyon: kurum (kök birim), işletmeler ve roller. Rolün yetki profili kimin hangi adımı işaretleyeceğini belirler.
   - Yol haritası: raporun yol haritası bölümü (planlar, hedefler, adımlar, çıktılar, izleme göstergeleri). Kurallar: `docs/rapor-formu/RAPOR-KURALLARI.md`.
   - Kullanıcılar: kişiler ve rolleri; davet istenen kişilere davet hazırlanır.
3. "Bekleyen davetleri gönder" ile davetler gider. Şirketin giriş adresi ekranın altında yazar; "Adresi kopyala" ile alınıp şirkete iletilir.

Dosyalar sonradan yeniden yüklenebilir. Yeni yol haritası eskisinin yerini alır; aynı adımın (aynı plan, rol, aşama ve metin) durumu korunur. "Şirketin planlarını incele" ile şirket ekranı salt okunur açılır.
