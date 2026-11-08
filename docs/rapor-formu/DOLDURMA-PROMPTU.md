# Claude'a verilecek talimat: HPTW birim sunumlarından HPW Act formlarını doldur

Bu metni, birim sunumlarıyla (PPTX) ve HPW Act'ten indirilen boş formlarla birlikte Claude'a olduğu gibi verin. Örnek olarak Ant Yapı için doldurulmuş formlar (`ORNEK_ANTYAPI/`) aynı klasördedir.

---

## GÖREV

Sana bir şirketin HPTW Çalışan Deneyimi ve Bağlılık birim raporları (her birim için bir PPTX sunumu) ve HPW Act'in boş Excel formları veriliyor. Sunumlarda ne yazıyorsa formlara AYNEN aktar. HPW Act bu formları yükleyecek; şirkette üst yönetim, İK ve birim yöneticileri sunumdaki yol haritasını HPW Act'ten takip edecek. Bu yüzden ekranda görünen her metin ve sayı sunumdakiyle birebir aynı olmalı.

## BAĞLAYICI KURALLAR

1. Metni kısaltma, yeniden yazma, düzeltme, yorumlama. Sunumdaki cümleyi noktasına kadar aynen yaz. Yeni içerik üretme.
2. Sayıları yuvarlama. Yüzdeleri 0–100 arası sayı olarak yaz: `%53,6` → `53,6`. Sunumda `-` yazan sektör değeri boş bırakılır.
3. ÇALIŞAN ALINTILARINI ("ÇALIŞANLARIN İFADELERİYLE" kutuları) HİÇBİR FORMA YAZMA. Formda bunun için alan yoktur; başka bir sütuna da sıkıştırma. Kişi adı yazma.
4. Sayfa ve sütun adlarını değiştirme, sütun ekleme ya da silme. Formül yazma; yalnız değer.
5. Bir bilgi sunumda yoksa hücreyi boş bırak; tahmin etme. Zorunlu bir alan sunumda yoksa bunu raporunda ayrıca belirt.
6. Her formu bitirince kendi kontrolünü yap (aşağıdaki "Kontrol listesi") ve bulduğun sorunları ayrı bir liste olarak ver.

## İKİ TUR

HPW Act'te sonuç ve yol haritası formları, organizasyon ve soru seti yüklendikten sonra o şirket için indirilir. Bu yüzden iş iki turdur:

- **1. tur:** `HPW_Act_org.xlsx` (organizasyon) ve `HPW_Act_instrument.xlsx` (soru seti). HPW bunları yükler, dönemi açar, sonra şirkete özel `sonuç` ve `yol haritası` formlarını indirip sana verir.
- **2. tur:** `HPW_Act_results.xlsx` (anket sonuçları) ve `HPW_Act_yol_haritasi_formu.xlsx` (yol haritası).
- Kullanıcılar formu (`HPW_Act_users.xlsx`) sunumdan doldurulmaz; kişi adları ve e-postalar şirketten gelir.

---

## 1. TUR

### Organizasyon (`HPW_Act_org.xlsx`)

- `Birim_Tipleri`: ROOT (Grup) ve sunumlardaki birim türleri (ör. MERKEZ, OTEL, SUITE, KONUT).
- `Birimler`: bir kök birim (şirketin kendisi, `unit_type_code=ROOT`) ve her sunum için bir satır. `operation=CREATE`. `unit_code` büyük harf, Türkçe karaktersiz ve kısa olsun (ör. `ANTASYA`, `RBIA`, `MERKEZ`); bu kodları bütün formlarda aynen kullanacaksın. `unit_name` sunumun kapağındaki birim adıdır. `headcount` "Katılım" slaytındaki kadro sayısıdır. `valid_from`: dönemin başladığı yılın 1 Ocak'ı.
- `Hiyerarsiler`: `SURVEY` (Anket toplama ağacı, SURVEY_ROLLUP).
- `Iliskiler`: her birim → kök birim, `REPORTS_TO`.
- `Org_Rolleri`: kökte İK (`HR_ADMIN`) ve üst yönetim (`EXEC`) rolü; her birimde bir yönetici rolü (`UNIT_MANAGER`). Rol kodu: `<BIRIM>-MUD`.

### Soru seti (`HPW_Act_instrument.xlsx`)

- Kaynak: her sunumun "EK A · SORU LİSTESİ" slaytları. Bütün sunumlardaki soruları tek listede birleştir.
- `Maddeler` sayfasındaki standart maddeler (origin=STANDARD) önceden yazılıdır. Sunumda olan standart maddeyi `INCLUDED` bırak. Sunumda olmayan standart maddeyi `selection_state=EXCLUDED` yap. Standart maddenin metnini değiştirme; sunumdaki ifade küçük farklarla aynıysa standart satırı kullan.
- Sunumda olup standart listede olmayan her soru bir ek maddedir (`origin=CUSTOM`). Kod: `<ŞİRKET KISA KODU>-01`, `-02`… Sunumda "Ant Yapı'ya özgü" gibi işaretli sorular ve "…'YA ÖZGÜ SORULAR" bölümü ek maddedir.
  - `dimension_code`: soru bir standart boyuttaysa o boyutun kodu (TEM, ERI, ISE, EGI, SAG…). Sunumdaki yeni bir boyutsa `Boyutlar` sayfasına yeni boyut ekle (`module_code=CUSTOM`; ör. CYK "Çalışma ve Yaşam Koşulları").
  - `scale_code=L5`, `target_policy=TARGETABLE` (kalma niyeti/aidiyet gibi sonuç sorularında `MONITOR_ONLY`), `responsibility_center` ve `interaction_area` sözlükteki değerlerden (yemek, temizlik, lojman gibi koşullar için `central_function` / `system`).

---

## 2. TUR

### Anket sonuçları (`HPW_Act_results.xlsx`)

- `Sonuclar` sayfası birim × metrik satırlarıyla önceden yazılıdır. `Metrikler_Bilgi` sayfası her metrik kodunun hangi maddeye ait olduğunu gösterir.
- Her satır için ilgili sunumun "EK A · SORU LİSTESİ"ndeki **İŞLETME** değerini yaz:
  - `status=OFFICIAL`
  - `value`: İşletme sütunundaki yüzde
  - `n_valid` ve `aggregation_weight`: "Katılım" slaytındaki katılımcı sayısı
  - `source_reference`: `<Şirket> <yıl> birim raporu · Ek A soru listesi`
- Sunumda olmayan madde ya da kök birim satırını boş bırak.
- Tavsiye sorusunun `_NPS` metriğini boş bırak; sunum yalnız yüzde (üst kutu) verir, o değer `_TB` metriğine yazılır.
- `Paket` sayfasında `import_mode=FULL_REPLACE`.

### Yol haritası (`HPW_Act_yol_haritasi_formu.xlsx`) — sunumun "8 · Yol Haritası" bölümü

Form sayfaları sunumdaki slayt sırasını izler. Her satır `unit_code` ile bir birime bağlanır.

| Sayfa | Sunumdaki kaynak |
|---|---|
| `Rapor` | Rapor adı; `company_label` = sunumdaki şirket geneli adı (ör. "Ant Yapı geneli"); `start_date` = HPW'nin vereceği başlangıç günü (sunumun yapılacağı gün) |
| `Birimler` | Kapak (birim adı, karşılaştırma sektörü); Katılım (kadro, katılımcı, oran); Tek bakışta (sertifikasyon puanı); "… YÖNETİMİ İÇİN ANA SONUÇ" (başlık, büyük cümle, paragraflar satır sonuyla); "Güçlü alanlar ve öncelikler" alt paragrafı; "Etki alanı" VERİ İLKESİ; "Birimin gündemi" başlığı ve alt başlığı; "Uygulama adımları" TEMEL İLKE; "İzleme ve hedefler" İZLEME YAKLAŞIMI |
| `Guclu_Yonler` | "GÖRECE GÜÇLÜ YÖNLER" sütunu: başlık + cümle |
| `Oncelikler` | "ÜÇ ÖNCELİĞİN İŞLETMEDEKİ KARŞILIĞI": başlık, gerekçe, "Bulgu:" cümlesi (Bulgu yazmadan); `short_title` = rol slaytlarındaki kısa ad; `area_label` = Uygulama adımları slaytındaki alan etiketi |
| `Oncelik_Uygulamalari` | "UYGULAMA ADIMLARI": her öncelik için değerlendirme soruları (QUESTION) ve önerilen uygulamalar (PRACTICE), her madde bir satır |
| `Etki_Alani` | "ETKİ ALANI" slaytındaki üç rol: rol adı, kısa tanım, görev maddeleri (her madde bir satır) |
| `Gundem` | "BİRİMİN GÜNDEMİ" tablosu: konu numarası, konu adı, "7/27" → mentions=7, commenters=27 |
| `Gundem_Gostergeleri` | Aynı tablodaki her gösterge satırı: ad, İşletme, Genel değerleri. Gösterge yerine "Ankette doğrudan soru yer almaz…" yazıyorsa `note` sütununa |
| `Eylem_Planlari` | Her "EYLEM PLANI · …" slaytı bir plan: başlık (gündemdeki konu adı), slayt başlık cümlesi, değinen/yorum yazan sayıları, varsa "Ankette bu konuya doğrudan soru yer almaz." notu; alttaki İZLENECEK ÖLÇÜT: ölçüt adı, mevcut, şirket geneli, hedef, parantez içindeki kural ("mevcut + 2,5 puan") ve metnin tamamı `measure_text`'e |
| `Eylem_Dayanaklari` | Planın VERİ DAYANAĞI göstergeleri: ad, işletme değeri, genel değer |
| `Eylem_Adimlari` | Planın üç rol sütunu. İnsan Kaynakları sütunu `IK`, birim yönetimi sütunu `YONETIM`, Çalışanlar sütunu `CALISAN`. `role_label` sütun başlığının aynısı. Her madde bir satır, sütundaki sırasıyla |
| `Eylem_Takvimi` | Planın TAKVİM satırı: "İlk 30 gün: …" → phase_label="İlk 30 gün", due_days=30; "İlk 90 gün" → 90; "6 ay" → 180; metin ":" sonrası aynen |
| `Roller` | Üç "ROLLER VE SORUMLULUKLAR" slaytı: başlık, açıklama, alt kutu başlığı ve metni |
| `Rol_Sorumluluklari` | Aynı slaytlarda her öncelik sütunu: sorumluluk maddeleri (DUTY) ve BEKLENEN SONUÇ (EXPECTED) |
| `Rol_Surecleri` | Aynı slaytlarda SÜRECE KATILIM: aşama (İlk 90 gün, 3 - 6 ay, 6 - 12 ay) ve metin |
| `Uygulama_Takvimi` | "UYGULAMA AŞAMALARI": üç aşama (etiket, başlık), her aşamadaki dört iş akışı (başlık, metin); aşamanın alt kutusu `phase_outcome` (aşamanın ilk satırında) |
| `Izleme_Hedefleri` | "İZLEME VE HEDEFLER" tablosu: gösterge, mevcut, sektör, şirket geneli, HEDEF / İZLEME YAKLAŞIMI metni aynen (`target_text`); hedef bir yüzdeyse `target_value`; "…düşürülmesi" → DECREASE, "…korunması" → MAINTAIN, diğerleri INCREASE |

**Madde kodları.** Bir gösterge ya da ölçüt bir ankete sorusuna karşılık geliyorsa (ör. "Yöneticinin bireysel ilgisi" → "Bağlı olduğum yönetici bana bireysel ilgi gösterir…"), soru setindeki madde kodunu `item_code` / `measure_item_code` sütununa yaz. Gösterge bir boyutsa ("Temel Beklentiler boyutu") `dimension_code` yaz. Emin değilsen boş bırak; gösterge yine sunumdaki adı ve değeriyle görünür.

**Eylem planı olmayan birim.** Bazı sunumlarda "Etki alanı", "Birimin gündemi" ve "Eylem planı" slaytları yoktur. O birim için yalnız diğer sayfaları doldur; bu geçerlidir.

---

## KONTROL LİSTESİ (teslimden önce)

- [ ] Her sunum için `Birimler`'de bir satır var; `unit_code`'lar organizasyondakiyle aynı.
- [ ] Eylem planı sayısı, her planın İK / yönetim / çalışan madde sayısı ve takvim satırı sayısı sunumla aynı.
- [ ] Hiçbir hücrede çalışan alıntısı yok.
- [ ] Bütün yüzdeler sayı (yüzde işareti yok), virgül ya da nokta ondalık; 0–100 arası.
- [ ] Değinen sayısı yorum yazan sayısından büyük değil.
- [ ] `Rapor` sayfasında tek satır; `cycle_code` formun üzerindeki dönemle aynı.
- [ ] Sunumda bulunmayan ya da okunamayan her bilgiyi ayrı bir listede bildir.

HPW Act yüklemede bu kuralların hepsini yeniden denetler; hata varsa satır ve sütunuyla gösterir ve formu kabul etmez.
