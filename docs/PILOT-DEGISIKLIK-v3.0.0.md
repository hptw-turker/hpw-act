# HPW Act v3.0.0 — değişiklik özeti (08.11.2026)

Karar kaydı: `docs/adr/ADR-0043-sade-hpw-act-v3.md`. Bu sürüm v2.15.0'ın üzerine eklemelidir: eski tablolar, kod ve testler silinmedi; kapalı modüller üretimde işlevsizdir.

## Kullanıcının gördüğü

- Yeni arayüz, bütün rollerde aynı mantık: girişte "Bugün" (kişinin kendi adımları, termine göre), "Planlar" (iki bölme: yol haritaları ve plan kartları), İK yöneticisinde "Kişiler".
- Giriş e-posta ve parolayla; iki adımlı doğrulama yok. Şirkete özel giriş adresi `/g/<şirket kodu>`; giriş sayfası şirketin adını gösterir ve oturumu o şirkette açar.
- Adım durumu ikili (Yapıldı / Yapılmadı); termini geçmiş yapılmamış adım "Gecikti". İsteğe bağlı kısa not; işaretleyen ve tarih kaydedilir.
- Kurum adımına atıf: işletme planındaki "Kurum planı N · İK · aşama · kısa ad" satırı kurum adımına bağlıdır, durumu oradan gelir.
- HPW kurulumu üç adım: organizasyon → yol haritası → kullanıcılar ve davet. Her dosya önce denetlenir, özet gösterilir, sonra onaylanır; sonuç düğmenin altında yazar (R-03).
- Menüde ve ekranlarda yalnız bunlar vardır. Hedef önerisi/onayı, istisna, kurumsal hedef ve uzlaştırma, aksiyon kütüphanesi, kanıt ve doğrulama, dikkat kuyruğu, takip ölçümü ekranı, yapay zekâ planı, aksiyon sorumlusu rolü ve v2.15 yol haritası formu görünmez.

## Sunucu

- Yeni tablolar: `rm2_roadmap`, `rm2_plan`, `rm2_step`, `rm2_item` (migrasyon 0024, eklemeli; RLS FORCE; yalnız adım durumu güncellenebilir).
- Yeni içe alım türü `roadmap2` (form `yh-2`); dönem yoksa yüklemede oluşur; yeniden yüklemede durum taşınır.
- Yeni uçlar: `GET /api/t/:tid/rm2`, `GET /api/t/:tid/rm2/me`, `GET /api/t/:tid/rm2/:rid`, `POST /api/t/:tid/rm2-steps/:sid`, `GET /api/public/app`, `GET /api/public/tenant/:code`; platform şirket ayrıntısına `setup3` özeti; girişte isteğe bağlı `tenantCode`.
- Anahtarlar: `HPW_LEGACY_MODULES` ve `HPW_MFA_REQUIRED` varsayılan kapalı (yalnız `HPW_ENV=test` ortamında açık). Kapalıyken eski uçlar `404 module_disabled`; `ACTION_OWNER` profili organizasyon dosyasında reddedilir; hassas platform işlemlerinde yeniden doğrulama istenmez.
- `TRUST_PROXY`: ters vekil arkasında hız sınırı gerçek istemci adresine göre çalışır.
- Sunucu kurulumu: `ops/sunucu/` (PostgreSQL + API + Caddy, otomatik HTTPS) ve Claude Code için adım adım `ops/sunucu/SUNUCU-KURULUMU.md`. Docker imajı yalnız ürün arayüzünü derler (`VITE_APP_ONLY=1`).

## Testler

- `apps/api/test/v300.test.ts` (8 senaryo, sentetik veri, gerçek PostgreSQL): şablon, doğrulama hataları (kesir–yüzde, gizlilik eşiği, atıf, bilinmeyen birim/plan/aşama, şirket kodu), onay ve dönem oluşturma, terminler, atıf bağlantısı, rollerin "Bugün" listeleri ve işaretleme yetkileri, sürüm çakışması, yeniden yüklemede durum taşıma, kiracı yalıtımı, kapalı modüller, iki adımlı doğrulamanın kapalı olması, şirkete özel giriş, kurulum özeti.
- API paketi 124/125; tek kırmızı test v2.14.2'den beri bilinen, tarihe bağlı `v2.6.9 … weekly 70 gün ≈ 10 slot` testidir (bu sürümde değişmedi).
- Sözleşme: 1518 gerçek yanıt, 0 sapma; OpenAPI güncel; kapsam denetimi 0 sorun.
- Ön yüz kapısı (eski ekranlar, test ortamında anahtar açık) ve v3 ekranlarının uçtan uca denemesi (HPW akışı + dört rol, masaüstü ve telefon, TR/EN): `docs/test-ciktilari/v300/`.
