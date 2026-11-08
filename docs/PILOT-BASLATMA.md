# HPW Act pilot (v2.13.2) — başlatma ve kullanım

Bu paket değerlendirme içindir; üretim ortamı değildir. Bütün şirketler, kişiler ve sonuçlar sentetiktir.

**Başlatma.** `HPW_Act_TESLIMAT_v2.13.2_6bc2014757e1.zip` dosyasını açın. `DOLU_DEMO/CALISTIRMA/HPW_Act_DEMO_Baslat.command` dosyasını çift tıklayın (Linux'ta `sh HPW_Act_DEMO_Baslat.sh`). İlk açılışta veritabanı kurulur, ardından tarayıcıda uygulama açılır (http://localhost:8787). Pencere açık kaldığı sürece pilot çalışır; kapatınca durur. Önceki teslimlerdeki gibi bilgisayarda Node 22 ve PostgreSQL 16 kurulu olmalıdır. Veriyi başa döndürmek için ZIP'i yeni bir klasöre yeniden açmanız yeterli.

**Girişler.** Bütün girişler `DOLU_DEMO/CALISTIRMA/DEMO-GIRIS-BILGILERI.md` dosyasındadır; pilot için en önemlileri:

| Kim | E-posta | Parola | Ne görür |
|---|---|---|---|
| HPW yöneticisi | platform@demo.hpw-act.local | Demo-Platform-2026 | 20 şirketin tamamı |
| HPW danışmanı | danisman@demo.hpw-act.local | Demo-Platform-2026 | Yalnız PILOT01–PILOT10 |
| Müşteri İK yöneticisi | ik@pilot07.demo.hpw-act.local (PILOT01…PILOT18 için aynı biçim) | Demo-Kullanici-2026 | Yalnız kendi şirketi |
| Müşteri (büyük şirket) | ik@saha.demo.hpw-act.local | Demo-Kullanici-2026 | Yalnız SAHA |

HPW kullanıcıları ilk girişte telefondaki doğrulama uygulamasını (Google Authenticator, Microsoft Authenticator vb.) kurar; ekranda gösterilen 10 kurtarma kodunu saklayın. Müşteri kullanıcılarında doğrulama kodu yoktur.

**Kullanım.** HPW yöneticisi girişte şirket portföyünü görür; bir şirketi seçince o şirketin kurulum ilerlemesi, dönemleri ve danışmanı açılır. "Bekleyen işler" sekmesinde şirket seçerek o şirketin işlerini izler; iş üstlenme, erteleme ve reddetme buradan yapılır. Pilot şirketlerin ilerlemesi bilerek farklıdır: PILOT01–03 kurulumun başında, PILOT04–06'da dönem açık ama sonuç yok, PILOT07–18'de dönem, sonuç ve aksiyon kaydı var; PILOT01, 02, 04, 05 ve 07'de "kurulum gecikti" işi açıktır. Danışmanla girip yalnız atandığı on şirketi gördüğünüzü, müşteri girişiyle yalnız kendi şirketinizi gördüğünüzü deneyebilirsiniz.

**Yapay zekâ desteği (isteğe bağlı, v2.13.0).** Varsayılan olarak kapalıdır; hedef akışı onsuz eksiksiz çalışır. Açmak için pilot kapalıyken `DOLU_DEMO/CALISTIRMA/.env.demo` dosyasına `HPW_AI_MODEL=<OpenAI model adı>` satırını ekleyip pilotu yeniden başlatın. Ardından şirketin İK yöneticisi (ör. ik@saha.demo.hpw-act.local) Kurulum ekranının altındaki "Yapay zekâ bağlantısı (OpenAI)" bölümünden şirketin OpenAI API anahtarını girer; kullanım şirketin kendi OpenAI hesabından ücretlendirilir. Hedefler ekranında "Yeni hedef" formunda madde seçip "Öneriyi gör" dedikten sonra "✨ Yapay zekâdan yardım al" tek çağrıyla planı üretir; "AI hedefini kullan" yalnız Hedef değer alanını doldurur, hedefi "Öneriyi kabul et" ile siz oluşturursunuz ve plan hedefe bağlanır; plan saklanır, sayfa yenilemek yeni çağrı yapmaz. Hedef kabul edildikten sonra plandaki aksiyonlar seçilerek "planlandı" olarak Aksiyonlar ekranına aktarılır ve oradan "Başlat" ile başlatılır.
