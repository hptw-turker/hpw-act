# ADR-0042 — Sunumla birebir yol haritası (rapor planı katmanı)

Durum: Kabul (kurucu kararı, 07.11.2026) · Sürüm: v2.15.0

## Bağlam

HPTW her müşteri için birim bazında Çalışan Deneyimi ve Bağlılık raporu (sunum) hazırlar. Sunumun "Yol Haritası" bölümü; ana sonucu, görece güçlü yönleri, üç gelişim önceliğini, birimin gündemini (yorum konuları), konu bazlı eylem planlarını (İK / birim yönetimi / çalışanlar adımları, izlenecek ölçüt, 30/90 gün/6 ay takvimi), rol sorumluluklarını, uygulama takvimini ve izleme hedeflerini içerir.

Kurucu kararı: şirkete önce sunum verilir; ardından sunumdaki hedefler ve eylem planları HPW Act'e **aynen** aktarılır ve üst yönetim, İK ve birim yöneticileri sunumdakini HPW Act'ten takip eder. HPW Act sunumla uyumlu çalışmalıdır.

Mevcut model (ADR-0039) takibi madde düzeyinde yapar: yerel hedef bir maddeye bağlıdır, aralık sistemce hesaplanır, aksiyon sıklık/kanıt/doğrulama taşır, yük sınırları 2 hedef / 3 aksiyondur. Sunumun planı ise konu bazlıdır (birden çok madde ve yorumlar), hedef kuralı "mevcut + 2,5 puan"dır, adımlar rol sütunlarında serbest metindir ve birim başına 3–4 plan vardır. Sunumu mevcut modele çevirmek metni ve sayıları değiştirmeyi gerektirir; bu, "aynen aktar" kararıyla çelişir.

## Karar

1. **Ayrı ve değişmez bir "yol haritası" katmanı** eklenir (`roadmap`, `roadmap_plan`, `roadmap_step`, `roadmap_milestone`; migrasyon 0023). Sunumdaki metin ve sayılar olduğu gibi saklanır; HPW Act bunları yeniden hesaplamaz, yuvarlamaz, değiştirmez. İçerik sütunları uygulama hesabı için yalnız INSERT yetkilidir; yalnız durum alanları güncellenebilir (sütun düzeyi GRANT).
2. **Takip edilen nesneler:** eylem planı adımları (rol `IK` ve `YONETIM`) — Başlamadı / Devam ediyor / Tamamlandı; eylem planı takvimi — açık / tamamlandı, termin = yol haritası başlangıcı + gün. `CALISAN` adımları gösterilir, takip edilmez (çalışan sahiplik zincirine girmez, aksiyom 17).
3. **Yetki:** okuma birim kapsamıyla (visibleUnits). `IK` adımı birimi kapsayan HR_ADMIN / HR_PARTNER; `YONETIM` adımı ve takvim HR_ADMIN, HR_PARTNER, REGION_MANAGER, UNIT_MANAGER. EXEC ve VIEWER salt okur. HPW personeli arayüzden yazmaz (müşterinin işletme kararı). Her yazma `expectedVersion`, idempotency anahtarı ve denetim kaydı taşır.
4. **Gizlilik:** çalışan alıntıları forma, veritabanına ve ekrana girmez; formda alan yoktur, ek sütun kabul edilmez. Yorum sayıları (değinen / yorum yazan) sunumdaki gibi gösterilir.
5. **Aktarım:** sunum PPTX'i okunmaz. Raporu hazırlayan (Claude) "Yol haritası formu"nu (17 sayfa, sunum bölüm sırasıyla) doldurur; form mevcut içe alım hattından (doğrula → önizle → onayla) yüklenir. Organizasyon, soru seti ve sonuçlar mevcut şablonlarla yüklenir.
6. **Yeniden yükleme:** düzeltilmiş sunum yeniden yüklenebilir. Eski sürüm `superseded` olur ve okunabilir kalır; aynı plan + rol + sıra + metindeki adımın durumu yeni sürüme taşınır; değişen adım sıfırdan başlar; eski sürüme yazma 409 döner.
7. **Mevcut madde bazlı hedef / aksiyon / kanıt sistemi değişmez.** Yol haritası ona bağlı değildir ve onu tetiklemez. İzlenecek ölçüt bir maddeye bağlıysa (`measure_item_code`) sonraki dönemin sonucu "takip ölçümü" olarak yalnız gösterilir; başarı kararı üretilmez.

## Sonuçlar

- Sunumdaki hedef ("mevcut + 2,5 puan") HPW Act'in gerçekçi aralığıyla karşılaştırılmaz ve istisna akışına girmez; bu katmanda hedef sunumun hedefidir. Madde bazlı yerel hedef kullanılmak istenirse mevcut akış ayrıca kullanılabilir.
- Yük sınırları (2 hedef / 3 aksiyon) yol haritası adımlarına uygulanmaz; sunumdaki plan sayısı korunur.
- Açık konu: yol haritası adımlarının dikkat kuyruğuna (AttentionItem) ve bekleyen işlere bağlanması; termini geçen takvim satırları için hatırlatma. Bu sürümde termin ve gecikme ekranda gösterilir, bildirim üretilmez.
