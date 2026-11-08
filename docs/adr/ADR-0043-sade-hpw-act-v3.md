# ADR-0043 — Sade HPW Act (v3.0): raporun yol haritasını takip aracı

Tarih: 08.11.2026 · Durum: kabul (Türker Baş) · Önceki: ADR-0042 (sunumla birebir yol haritası)

## Bağlam
v2.x saha uygulamasında başarısız oldu: kullanıcılar ekranlarda kayboldu, madde bazlı hedef önerisi, onay, istisna, kanıt ve uzlaştırma akışlarını reddetti. HPTW artık her şirket için kurum raporu ve işletme raporları hazırlıyor; raporun 8. bölümü (yol haritası) hedefleri, eylem planlarını, rollerin adımlarını, terminleri ve çıktıları zaten içeriyor (Ant Yapı 2026, dokuz rapor, son biçim 08.11.2026).

## Karar
1. **HPW Act = rapordaki yol haritasının takip aracıdır.** Hedef rapordan gelir; HPW Act hedef önermez, onaylatmaz, reddettirmez, değiştirmez.
2. **İki katman.** Kurum yol haritası (kök birim; roller: Ant Yapı İnsan Kaynakları, Ant Yapı Yönetimi, Çalışanlar) ve işletme yol haritaları (roller: İK — yalnız işletmeye özel işler ve kurum adımına atıf —, işletme yönetimi, çalışanlar).
3. **Plan.** Eylem planı tek anket maddesine bağlıdır: mevcut (olumlu yanıt / yanıt), Ant Yapı geneli, hedef (olumlu yanıt / yanıt) ya da "izlenir". Kurum hedefi işletme hedeflerinin toplamıdır (rapor yöntemi). Hedefin tutup tutmadığı bir sonraki ölçümde yuvarlanmamış oranla (hedef kesri) değerlendirilir.
4. **Adım.** Rol, aşama (ilk 30 / 90 gün, ilk 6 ay = 30 / 90 / 180 gün), metin, çıktı. Durum ikilidir: Yapıldı / Yapılmadı; termini geçmiş ve yapılmamış adım "gecikti" görünür. İşaretleyen ve tarih saklanır, kısa not isteğe bağlı. Çalışan adımları bilgi içindir, işaretlenmez. İşletme İK sütunundaki atıf ("Kurum planı N · İK · aşama · kısa ad") kurum adımına bağlanır; durum orada bir kez işaretlenir, işletmede salt okunur görünür.
5. **Kim işaretler.** İK: kurum İK adımları ve bütün işletmelerin İK adımları. Üst yönetim: kurum planındaki "Ant Yapı Yönetimi" adımları. Birim (işletme) yöneticisi: kendi işletmesinin yönetim adımları. İzleyici: hiçbiri. HPW personeli: işaretlemez.
6. **Kapatılan modüller (silinmez, işlevsizdir).** Yerel hedef önerisi/onayı/istisnası, kurumsal hedef ve uzlaştırma, katkı projeksiyonu, aksiyon kütüphanesi ve yaygınlaştırma, kanıt ve doğrulama, karşılaştırılabilirlik/metodolog, vekâlet, dikkat kuyruğu, takip ölçümü ekranı, yapay zekâ planı, aksiyon sorumlusu rolü, v2.15 yol haritası (17 sayfalık form). Sunucuda modül anahtarı kapalıdır: uçlar 404 döner, menüde ve ekranlarda görünmez. Kod, tablolar ve testler durur; testler anahtar açık test ortamında koşmaya devam eder.
7. **Giriş.** İki adımlı doğrulama zorunluluğu kaldırıldı (herkes, HPW personeli dahil). Giriş e-posta + parola; şirkete özel giriş adresi (`/g/<şirket kodu>`). Parola kuralları, oturum süresi ve hız sınırı korunur.
8. **Korunan temel.** Kiracı yalıtımı (RLS), roller ve kapsam, organizasyon, kullanıcılar ve davet, soru seti, dönemler ve sonuçlar, Excel içe alım hattı (doğrula → önizle → onayla), gizlilik eşiği, silinemeyen işlem geçmişi, e-posta altyapısı.
9. **Arayüz.** Yeni ve sade tasarım (Tasarım B kilidi bu sürümle kalkar; marka kuralları geçerli). Giriş yapan kişi önce kendi işlerini görür.

10. **Yapay zekâ.** Rapor entegrasyonuyla yapay zekâ önerisine şimdilik gerek kalmadı; bu sürümde kapalıdır. Bağlantı noktası (`apps/api/src/ai`, `routes/ai.ts`, AiPlan arayüzü) kodda korunur ve kapalı modüller anahtarıyla birlikte açılabilir; yapay zekâ yine yalnız öneri üretir, hiçbir nesnenin durumunu değiştirmez (aksiyom 10).
11. **Sunucu.** Tek üretim ortamı: PostgreSQL + API + Caddy (otomatik HTTPS), `ops/sunucu/`. Kapalı modüller ve iki adımlı doğrulama anahtarları varsayılan olarak kapalı, yalnız `HPW_ENV=test` ortamında açıktır (eski testler koşmaya devam eder). Ters vekil arkasında gerçek istemci adresi `TRUST_PROXY` ile alınır.

## Sonuçlar
- Proje talimatındaki 2–5, 9, 11, 14 numaralı ilkeler (hedef ağı, istisna, kanıt, dikkat kuyruğu, ambition) bu sürümde **uykudadır**; kapalı modüllerin içinde geçerlidir.
- Yeni içe alım türü `roadmap2` (form `yh-2`), eski `roadmap` (yh-1) kapalı.
- Rapor hazırlama kuralları: `docs/rapor-formu/RAPOR-KURALLARI.md`.
