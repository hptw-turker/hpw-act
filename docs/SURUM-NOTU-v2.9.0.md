# HPW Act v2.9.0 — İngilizce arayüz ve HPW merkezi güvenlik dilimi (tasarım v2, dilim 1)

Kapsam: iş sahibinin onayladığı "Merkez Yönetim Paneli — Tamamlanmış tasarım (v2)" belgesinin 1. dilimi (bölüm 3: rol ve yetki modeli, müdahale modu, erişim iptali, MFA; bölüm 11: platform işlem geçmişi; bölüm 5.1/5.6/5.7/5.9 ekranları) ve bütün ekranlarda Türkçe/İngilizce arayüz.

## İngilizce arayüz (TR/EN)

Bütün ürün ekranlarının (HPW merkezi, giriş/davet/parola, İK, yönetici ve saha ekranları) görünen metinleri tek çeviri katmanından geçer (`apps/web/src/product/i18n.ts`, sözlük `i18n/en.json` 955 kayıt, etiketler `i18n/en-labels.json` 103 kayıt). Dil seçici girişte, şirket üst çubuğunda ve merkezde (TR / EN, aralıklı iki düğme; seçim yalnız renkle). Sunucunun Türkçe hata iletileri İngilizce arayüzde çevrilir; sözlükte olmayan ileti Türkçe sızmaz, hata türünün İngilizce genel iletisi gösterilir. Kabul kapısındaki `i18n-coverage` sarılmamış görünen metin, eksik çeviri ya da İngilizcede Türkçe harf bulursa derlemeyi düşürür. Kapsam dışı: veri içeriği (anket maddeleri, birim ve kişi adları), davet e-postaları, Excel şablonları ve kılavuzlar (Türkçe).

## Güvenlik dilimi

| Katman | Değişiklik |
|---|---|
| Veritabanı 0014 | `platform_role` (admin/consultant/methodologist/auditor; mevcut platform hesapları admin — K4); `platform_tenant_access` görev, geçerlilik, iptal; tek ana/tek yedek danışman indeksi; `platform_access_active` (etkin rol + iptal edilmemiş, geçerli atama) bütün erişim fonksiyon ve politikalarında; **platform yazma koruması** (her şirket tablosunda RESTRICTIVE INSERT/UPDATE/DELETE politikası: platform alanında yalnız `app.platform_write='on'`); `platform_intervention`; yalnız ekleme `platform_audit_event`; personel, rol, atama, devir fonksiyonları (son yönetici ve devredilmemiş ana danışman koruması) |
| Veritabanı 0015 | `platform_mfa` (AES-256-GCM şifreli TOTP sırrı, yeniden oynatma koruması, özetlenmiş kurtarma kodları; doğrudan erişim yok); oturumda `mfa_at` |
| API | Şirket içi 39 yazma ucu kurulum/metodoloji/işletme sınıfında (`governance.ts ROUTE_CLASS`; sınıfsız uç testte düşer); HPW personelinin her şirket isteği rol × sınıf × şirket durumu × müdahale ile denetlenir; olumluysa veritabanı yazma bayrağı açılır. Danışman kurulum yazar, işletme yazamaz; denetçi okur; metodolog metodoloji yazar; yönetici işletmeyi yalnız müdahale modunda yazar; durdurulmuş şirkette HPW yalnız okur (K6) |
| MFA (K9) | HPW personeli doğrulama uygulaması kurulmadan ve oturumda kod girilmeden merkez ve şirket uçlarına erişemez; ilk girişte kurulum (anahtar + otpauth bağlantısı + 10 kurtarma kodu); başarısız denemeler hız sınırlı; hassas işlemler (durdurma, personel, rol, atama, devir, müdahale, MFA sıfırlama) son 10 dakikada doğrulama ister; ön yüz kodu sorar ve aynı işlemi aynı anahtarla bir kez yeniden gönderir; sıfırlama yalnız başka bir yönetici |
| Müdahale (K7) | Gerekçe ≥ 20 karakter, 15/30/60 dk; her yazma `intervention.write` olarak kaydedilir; başlangıç ve bitiş şirketin kendi işlem geçmişine de yazılır |
| İşlem geçmişi | tenant.create/suspend/activate/enter/admin_invite, staff.create/role_change/revoke, assignment.grant/handover/end, intervention.start/end/write, mfa.enable/reset/recovery_used; görünürlük veritabanı politikasıyla (atanmış şirketler; genel olaylar yalnız yönetici) |
| Ekranlar | Şirket ekranında HPW bağlam satırı (rol, yetki, merkeze dön, müdahale modu, siyah müdahale şeridi); merkez sekmeleri: Şirketler, Ekip ve erişim (yönetici), İşlem geçmişi; iki adımlı doğrulama ekranı; rol bazlı düğmeler |

**Bir davranış değişikliği:** Yanlış MFA kodu 422 döner (401 değil); aksi halde ön yüz bunu oturum sonu sayıp çıkış yapıyordu (tarayıcı testi yakaladı).

## Final paket üzerinde koşulanlar (build 119ebdc06f49)

| Grup | Sonuç | Kanıt (test-ciktilari/v290) |
|---|---|---|
| BOŞ paket, index.html'den gerçek sunucu turu (bootstrap, **MFA kurulumu**, şirket açma, kurulum, hedef, aksiyon, kanıt, takip) | 52/52 | tur.log |
| DOLU demo duman testi (iki ortam aynı anda) | 8/8 | demo-smoke.log |
| Ön yüz kabul kapısı, paketin web dosyasıyla | tamamı geçti: dil kapsamı; yetki ve uç sınıfı sözleşmesi; DTO⊆sözleşme; API istemcisi 5/5 ve 10/10; denetçi 26/27 (belgeli LOGIN-ENTER); 85 regresyon (8 EN, 6 güvenlik, 2 MFA dahil); N01–N03; R01–R03; R04 3+4; kapsam denetimi | fe-kabul-paket.log |
| API entegrasyonu (gerçek PostgreSQL) | 45/45 (44: rol matrisi, veritabanı koruması, müdahale, durdurma, devir, iptal, işlem geçmişi görünürlüğü; 45: MFA kurulum, yanlış kod, yeniden oynatma, kurtarma kodu tek kullanım, yeniden doğrulama, sıfırlama); 631 yanıt 0 sapma; 103 uç; kapsam 116 kural 0 sorun | api-npm-test.log |
| Domain | 70/70 | temiz-kurulum.log |
| Temiz kurulum (ZIP'ten, node_modules ve fixture yok): domain, web, API kurulum/derleme, boş veritabanına 15 migrasyon, sözleşme --check | hepsi 0 | temiz-kurulum.log |

## Bilinçli sınırlar

- MFA kurulumunda QR kod yok (anahtar ve otpauth bağlantısı var); üretimde `HPW_MFA_KEY` ortam değişkeni zorunlu, yoksa anahtar kurulum kimliğinden türetilir (demo/test).
- Onay pencereleri tarayıcı istemi (tasarım 5.10 modal ister) — 2.10.0.
- Kılavuzlar güncellenmedi: HPW merkezinin yeni sekmeleri, bağlam satırı, müdahale ve MFA kılavuzda yok; İngilizce kılavuz yok.
- Davet e-postaları ve Excel şablonları yalnız Türkçe.
- Tasarım dilim 2 (2.10.0: kurulum adımları, danışman sorumluluğu ekranı, arşiv, sıralama/filtre/sayfalama, modal) ve dilim 3 (2.11.0: bekleyen işler, gösterge sözlüğü, 20 şirket yük ölçümü, erişilebilirlik ölçümü, Firefox/WebKit) yapılmadı.
- Mac/Safari test edilmedi.
