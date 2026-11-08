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
