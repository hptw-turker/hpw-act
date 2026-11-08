# Sunumdan HPW Act'e: süreç kurgusu (v2.15.0)

**İlke:** Şirkete önce sunum verilir. Sunumdaki yol haritası (eylem planları, hedefler, takvim, roller) HPW Act'e **aynen** aktarılır. Sonra üst yönetim, İK ve birim yöneticileri sunumdakini HPW Act'ten takip eder. HPW Act sunumdaki metni ve sayıları değiştirmez.

## Kim ne yapar

| Adım | Kim | Ne |
|---|---|---|
| 1 | HPW (Claude ile) | Birim raporları (sunumlar) hazırlanır. |
| 2 | HPW | Sunum şirkete yapılır. Sunumun yapıldığı gün yol haritasının **başlangıç günüdür**. |
| 3 | HPW Merkezi | HPW Act'te şirket açılır, İK yöneticisi davet edilir. |
| 4 | Claude (1. tur) | Sunumlardan **Organizasyon** ve **Soru seti** formları doldurulur (`DOLDURMA-PROMPTU.md`). |
| 5 | HPW / İK | İki form yüklenir (doğrula → önizle → onayla); dönem açılır (ör. 2026-ANA). Şirkete özel **Anket sonuçları** ve **Yol haritası** formları indirilir. |
| 6 | Claude (2. tur) | Sunumlardan **Anket sonuçları** ve **Yol haritası** formları doldurulur. |
| 7 | HPW / İK | İki form yüklenir. HPW Act her satırı denetler; hata varsa satır ve sütunuyla gösterir, kabul etmez. |
| 8 | İK | Kullanıcılar formu (üst yönetim, birim yöneticileri, İK) yüklenir; davetler tek tuşla gönderilir. |
| 9 | Herkes | Takip başlar. |

## HPW Act'te kim ne görür

- **Üst yönetim:** "Yol haritası" ekranında üç öncelik, birimler tablosu (her birimin eylem planı sayısı, birim yönetimi ve İK adımları kareyle, takvim satırları, termini geçenler, sıradaki termin) ve İK'nın adımları. Her birimin yol haritasını sunumdaki sırayla açar. Salt okur.
- **İK yöneticisi:** üst yönetimin gördüğü her şey + bütün birimlerdeki İK adımlarını tek listede işaretler (Başlamadı / Devam ediyor / Tamamlandı); takvim satırlarını işaretleyebilir.
- **Birim yöneticisi:** yalnız kendi biriminin yol haritası: ana sonuç, güçlü yönler ve öncelikler, birimin gündemi, eylem planları (veri dayanağı, rol adımları, izlenecek ölçüt, takvim), uygulama adımları, roller ve sorumluluklar, uygulama takvimi, izleme hedefleri. Kendi sütunundaki adımları ve takvim satırlarını işaretler; İK adımlarını izler. Çalışanlar sütunu bilgi içindir.
- **Bölge müdürü / İK iş ortağı:** kapsamındaki birimler; birim yönetimi adımlarını ve takvimi işaretleyebilir.

## Sunumla birebir neler var, neler yok

- **Var (aynen):** ana sonuç, görece güçlü yönler, üç öncelik ve birimdeki bulgular, etki alanı ve rol görevleri, birimin gündemi (yorum sayıları ve göstergeler), eylem planları (başlık cümlesi, veri dayanağı, üç rolün adımları, izlenecek ölçüt ve hedef, takvim), uygulama adımları, roller ve sorumluluklar, uygulama takvimi, izleme göstergeleri ve hedefler.
- **Bilinçli olarak yok:** çalışan alıntıları ("Çalışanların ifadeleriyle"). Küçük birimlerde kişiyi belli edebileceği ve HPW Act birçok yöneticinin kullandığı bir sistem olduğu için alıntılar aktarılmaz; sunumda kalır.
- **Eklenen:** her adımın ve takvim satırının durumu, termin (başlangıç + gün), gecikme, son güncelleme tarihi; bir sonraki ölçüm yüklendiğinde izlenen maddenin takip değeri.

## Düzeltme ve yeni dönem

- Sunumda düzeltme olursa form düzeltilip yeniden yüklenir. Eski sürüm saklanır; değişmeyen adımların durumu korunur, değişen adım yeniden başlar.
- Başlangıç günü değişirse (ör. sunum ertelendi) form yeni `start_date` ile yeniden yüklenir; terminler yeniden hesaplanır, işaretlemeler korunur.
- Sonraki yıl yeni dönem açılır, yeni sonuçlar ve yeni yol haritası o dönem için yüklenir. Önceki yol haritasının izlenecek ölçütü maddeye bağlıysa yeni dönemin değeri "takip ölçümü" olarak eski planda görünür.

## Mevcut HPW Act işleyişiyle ilişki

Yol haritası ayrı bir katmandır. Madde bazlı yerel hedef, aksiyon, kanıt ve doğrulama sistemi aynen çalışmaya devam eder; yol haritası onu ne tetikler ne de değiştirir. Şirket isterse birim yöneticisi sunumdaki bir konu için ayrıca madde bazlı hedef ve kanıtlı aksiyon açabilir.
