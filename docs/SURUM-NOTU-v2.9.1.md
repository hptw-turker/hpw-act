# HPW Act v2.9.1 — v2.9.0 bağımsız denetiminin düzeltme sürümü

Yalnız v2.9.0'ın teslim edilmiş güvenlik ve merkez ekranı hatalarını kapatır (V290-01…06 ve rol modeli ek kapanışları). Yeni özellik yoktur; 2.10.0/2.11.0 kapsamı değişmedi. Ayrıntı, kök nedenler, önce/sonra ve ham kanıt yolları: `DENETIM-YANITI-v2.9.1.md`.

Özet: Ekip ve erişim ile işlem geçmişinde geç yanıtlar ve seçim değişimi artık yanlış şirkete işlem ya da yanlış kayıt göstermez; yeni merkez yanıtları çalışma anında doğrulanır; atama bitirme şirket kapsamını hem uçta hem veritabanında denetler; üretim ve yerel paketlerde geçerli MFA şifreleme anahtarı olmadan sunucu başlamaz (anahtar değişimi ve v2.9.0 yükseltmesi desteklenir; bkz. `MFA-ANAHTARI.md`); müdahale kaydı iş etkisiyle aynı transaction'da kalıcılaşır; ana danışman, görev-rol uyumu, son yönetici (eşzamanlılık dahil) ve şirketin tek yöneticisi korunur. Veritabanı: yeni migrasyon 0016 (0014/0015 değişmedi). Yükseltmede başlatıcı eksik MFA anahtarını bir kez üretir.

Doğrulama (final paket, build 4857cd642157): API 66/66 (gerçek PostgreSQL) ve 711 yanıt 0 sapma; domain 70/70; ön yüz kapısı paketin derlemeleriyle tamamı geçti (97 regresyon, denetçinin üç betiği dahil); BOŞ turu 52/52; DOLU 8/8; v2.9.0 → v2.9.1 yükseltmesi; temiz kurulum. Kılavuzlar 2.9.1.
