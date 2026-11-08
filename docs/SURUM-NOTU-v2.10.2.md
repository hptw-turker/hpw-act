# HPW Act v2.10.2 — v2.10.1 yeniden denetiminin düzeltme sürümü

Yalnız V2101-01 ve V2101-02'yi kapatır; yeni özellik ve migrasyon yok. Ayrıntı: `DENETIM-YANITI-v2.10.2.md`.

Hizmet kaydında, önceki bir kaydetmenin geç gelen yanıtı artık kullanıcının sonradan yazdığı taslağı silmez: aynı şirkete geri dönüş eski ziyaretten ayrılır; aynı ekranda gönderimden sonra yapılan değişiklikler formda kalır ve henüz kaydedilmediği açıkça yazılır. Müşteri teyidinde yanıt yolda kaybolursa sonuç güncel kayıttan doğrulanır; doğrulanırsa pencere kapanır, doğrulanamazsa belirsizlik açıkça yazılır ve “Teyit et” aynı işlemi ikinci kez uygulamadan yeniden gönderir. Sunucu başarılı teyidin makbuzunu saklar ve aynı anahtarlı tekrarı güncel yetkiyle yeniden denetleyip aynı sonucu döndürür.

Doğrulama (final paket, build 3040f1ae93df): API 80/80 (gerçek PostgreSQL), 943 yanıt 0 sapma; domain 70/70; ön yüz kapısı (A, R 123/123, C, B — bütün bağımsız karşı örnekler dahil) geçti; BOŞ 52/52; DOLU 8/8; temiz kurulum; v2.9.1'den yükseltme. Test edilmedi: Mac/Safari, Firefox, WebKit, ekran okuyucu, gerçek %200 yakınlaştırma. BOŞ 7h kök nedeni açık.
