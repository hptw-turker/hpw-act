# HPW Act v2.10.1 — v2.10.0 bağımsız denetiminin düzeltme sürümü

Yalnız V210-01…06'yı kapatır; yeni özellik yok. Ayrıntılar, kök nedenler, önce/sonra ve ham kanıt yolları: `DENETIM-YANITI-v2.10.1.md`.

Özet: Şirket detayında form, taslak, iletiler, onay penceresi ve bekleyen işlemler şirket bağlamına bağlandı; başka şirkete geçişte sıfırlanır ve önceki şirketin işlemi yeni şirketin ekranını etkilemez. Müşteri alanındaki kullanıma açılış durumu merkezle aynı hesaptan gelir; geçerliliğini yitirmiş HPW onayı teyide açık gösterilmez ve teyit edilemez. Hizmet kaydı çatışmasında uyarı görünür kalır, taslak korunur, güncel kayıt gösterilir. Müşteri teyit kartı yükleme hatasında uyarı ve “Yeniden dene” gösterir. Onay penceresi açıkken sayfanın geri kalanı etkisizdir; gönderim sırasında da odak pencerede kalır. 320 px genişlikte şirket detayı yatay taşmaz.

Veritabanı: yeni migrasyon 0018 (0014–0017 değişmedi). Doğrulama (final paket, build 1d493310fb3d): API 79/79 (gerçek PostgreSQL), 944 yanıt 0 sapma; domain 70/70; ön yüz kapısı (A, iki parça R, B) geçti — denetçinin 8 karşı örneği dahil; BOŞ turu iki temiz kurulumda 52/52; DOLU 8/8; temiz kurulum; v2.9.1'den yükseltme. Test edilmedi: Mac/Safari, Firefox, ekran okuyucu, gerçek %200 yakınlaştırma. BOŞ 7h zaman aşımının kök nedeni açık.
