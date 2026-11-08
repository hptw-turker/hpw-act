# HPW Act v2.7.3 — rol ve yetki matrisi (F04)

Tek kaynak: `apps/api/src/governance.ts` (`PERMISSION_RULES`). Ön yüz aynı tabloyu `apps/web/src/product/permissions.ts` içinde taşır; `tools/tests/fe/rules-contract.mts` iki tablonun birebir aynı olduğunu doğrular. Oturumdaki kullanıcı için özet: `GET /api/t/{tid}/permissions?unitId=`. HPW sistem yöneticisi (platform) bütün ekran ve işlemleri görür (sunucu `requireProfile` davranışı). Arayüz görünürlüğü sunucu yetkisinin yerine geçmez; uçlar kendi `requireUnitProfile`/`requireProfile` denetimlerini yapar.

### Ekranlar (menü ve doğrudan adres)

Menüde olmayan ekranın adresi doğrudan açılırsa “Bu ekran rolünüz için açık değil” gösterilir. Kılavuz rol matrisiyle aynıdır; sunucunun okuma izni bazı rollerde daha geniştir (ör. İK iş ortağı kullanıcı listesini API’den okuyabilir), arayüz daha dar olabilir, daha geniş olamaz.

| | İK Yön. | İK İş Ort. | Üst Yön. | Bölge | Birim | Aksiyon S. | İzleyici |
|---|---|---|---|---|---|---|---|
| Genel bakış | ● | ● | ● | ● | ● | ● | ● |
| Dikkat | ● | ● | ● | ● | ● | ● |  |
| Birim sonuçları | ● | ● | ● | ● | ● |  | ● |
| Hedefler | ● | ● |  | ● | ● |  | ● |
| Aksiyonlar ve kanıt | ● | ● |  | ● | ● | ● |  |
| Takip | ● | ● |  | ● | ● |  |  |
| Organizasyon | ● | ● |  |  |  |  |  |
| Soru seti | ● | ● |  |  |  |  |  |
| Dönemler | ● | ● |  |  |  |  |  |
| Excel yükleme | ● | ● |  |  |  |  |  |
| Kullanıcılar | ● |  |  |  |  |  |  |

### Birim bazlı işlemler

Profil, kullanıcının O BİRİMDEKİ en yüksek profilidir (`profileForUnit`: rol kapsamı + alt birimler; şirket geneli İK yöneticisi her birimde İK yöneticisi). Kayıt durumu ayrıca aranır: kanıt ve beyan yalnız devam eden aksiyonda, doğrulama/iade yalnız tamamlandı beyanında, iptal ve devir kapalı/iptal aksiyonda yok.

| | İK Yön. | İK İş Ort. | Üst Yön. | Bölge | Birim | Aksiyon S. | İzleyici |
|---|---|---|---|---|---|---|---|
| Hedef öneri/oluşturma | ● | ● |  | ● | ● |  |  |
| Taslak hedefi kabul/ret | ● | ● |  | ● | ● |  |  |
| İncelemedeki hedefi onay/ret | ● | ● |  |  |  |  |  |
| Hedef sorumlusu devri | ● | ● |  |  |  |  |  |
| Aksiyon açma | ● | ● |  | ● | ● |  |  |
| Kanıt kaydı | ● | ● |  | ● | ● | ● |  |
| Tamamlandı beyanı | ● | ● |  | ● | ● | ● |  |
| Doğrulama / iade | ● | ● |  | ● |  |  |  |
| Duraklat / sürdür | ● | ● |  | ● | ● |  |  |
| Aksiyon iptali | ● | ● |  | ● | ● |  |  |
| Aksiyon sorumlusu devri | ● | ● |  | ● | ● |  |  |
| Takip karşılaştırılabilirlik onayı | ● | ● |  |  |  |  |  |
| Kurumsal karşı teklif / istisna | ● | ● |  | ● | ● |  |  |
| Dağıtım kabul / ret | ● | ● |  | ● | ● |  |  |
| Sürüm geçişi kararı | ● | ● |  | ● | ● |  |  |
| Kaynak isteği | ● | ● |  | ● | ● |  |  |

### Şirket geneli (kurumsal) işlemler

Ayrıca şirket geneli yetki (`companyWide`) gerekir; kapsamlı roller göremez.

| | İK Yön. | İK İş Ort. | Üst Yön. | Bölge | Birim | Aksiyon S. | İzleyici |
|---|---|---|---|---|---|---|---|
| Kontrol kulesi | ● | ● | ● |  |  |  |  |
| Kurumsal planlama listesi | ● | ● | ● |  |  |  |  |
| Kurumsal istek önerme | ● |  | ● |  |  |  |  |
| Kohort dondurma | ● |  |  |  |  |  |  |
| Uzlaştırma | ● |  |  |  |  |  |  |
| Ana aksiyon yayımı | ● |  |  |  |  |  |  |
| Dağıtım | ● |  |  |  |  |  |  |
| Merkezi karar (kabul/ret) | ● |  | ● |  |  |  |  |

### Şirket profiliyle işlemler



| | İK Yön. | İK İş Ort. | Üst Yön. | Bölge | Birim | Aksiyon S. | İzleyici |
|---|---|---|---|---|---|---|---|
| Kurulum ekranlarında yazma | ● | ● |  |  |  |  |  |
| Kullanıcı ekleme / davet | ● |  |  |  |  |  |  |
| Sorumluluk haritası | ● |  |  |  |  |  |  |
| Birim taşıma / birleştirme | ● |  |  |  |  |  |  |
