# HPW Act v2.8.0 — HPW merkez paneli (temel sürüm)

Kapsam: Happy Place to Work yöneticisi sınırsız sayıda müşteri şirketi açar, durumunu tek tablodan izler, durdurur ya da yeniden etkinleştirir ve şirketin İK yöneticisini davet eder. Şirket içi işler (hedef, aksiyon, kanıt, takip, kurumsal planlama) şirketin kendi ekranlarında kalır; HPW yöneticisi "Aç" ile o şirkete geçer. Belgelenen (HPW-Merkez-Paneli-Gereklilikler) tam P0 kapsamındaki danışman rolleri, platform yetki daraltması, bekleyen iş kuyruğu ve işlem geçmişi ekranı bu sürümde yoktur; iş sahibinin kararlarını bekler.

## Değişenler

| Katman | Değişiklik | Kaynak |
|---|---|---|
| Veritabanı | 0013: `tenant.status_reason/status_changed_at/status_changed_by`; `tenant_status()`; `platform_set_tenant_status()` (yetkili platform yöneticisi; durdurmada müşteri oturumları silinir); `auth_memberships_suspended()` | db/migrations/0013_platform_panel.sql |
| API | `GET /api/platform/portfolio` (yetkili şirketlerin özeti; şirket başına ayrı bağlam; hata satır bazında), `POST /api/platform/tenants/:tid/status` (gerekçe zorunlu; işlem geçmişi), `POST /api/platform/tenants/:tid/admin-invite` (tekrar güvenli) | apps/api/src/routes/platform.ts |
| Yetki | Müşteri alanında her istek `tenant_status` denetir: durdurulmuş şirkette okuma ve yazma 403 `tenant_suspended`; girişte açıklayıcı ret; platform alanı etkilenmez | apps/api/src/auth.ts, routes/auth.ts |
| İşlem geçmişi | Şirket oluşturma (yönetici olsun olmasın), durdurma, etkinleştirme ve platform yönetici daveti şirket bağlamında `audit_event` | routes/platform.ts |
| Arayüz | Müşteriler ekranı: takip tablosu (durum, kurulum 4 adım, üye/davet, yayımlı dönem, aksiyon/gecikmiş/doğrulama bekleyen, son hareket), arama, satır bazında özet hatası, durdur/etkinleştir (gerekçe), yönetici davet et; ilk yönetici isteğe bağlı | apps/web/src/product/pages/Platform.tsx |
| Sözleşme | Yeni uçlar domain haritasıyla (11 kural; `nullable` kural türü eklendi) sözleşmede; DTO `portfolio` | apps/api/src/contract/domain-map.ts, docs/api/openapi-urun.json |
| Kılavuz | 01 HPW Sistem Yöneticisi ve 00 Tüm roller: HPW merkezi bölümü yeni ekranla | docs/guides/v2.8.0 |

## Doğrulama

- API (gerçek PostgreSQL + HTTP): 43 test — yeni test 43: yetkisiz şirket sızmaz; gerekçesiz durdurma 400; yetkisiz platform kullanıcısı 403; durdurmada eski oturum 401, yeni giriş 403 `tenant_suspended`, HPW okur; etkinleştirmede müşteri çalışır; yönetici daveti ikinci çağrıda yeni kayıt üretmez; işlem geçmişinde suspend/activate/platform_admin_invite.
- Sözleşme: 564 gerçek yanıt, 0 sapma; 86 uç; kapsam denetimi 105 kural, 0 sorun.
- Ön yüz kabul kapısı: denetçi 27 (26 + belgeli LOGIN-ENTER), ek regresyon 68 (merkez paneli: liste sayaçları ve satır hatası, Türkçe arama, gerekçeli durdurma, 503, bozuk yanıt), N01–N03, R01–R03, R04 karşı örnekleri, DTO ⊆ sözleşme (18 uç + 5 fixture).
- Domain 70/70. Marka/metin denetimi geçti.

## Bilinçli sınırlar

- Portföy şirketleri sırayla okur; belgedeki 20 şirket + 5 eşzamanlı HPW oturumu hedefi ölçülmedi.
- Platform yetkisi daraltılmadı: platform yöneticisi yetkili şirkette hâlâ İK yöneticisi gibi yazabilir (önceki davranış).
- Platform personeli açma/atama için ekran yok (API vardır).
- Mac/Safari ve Firefox test edilmedi.

## Final paket üzerinde koşulanlar (build ddfb024fdd9a)

| Grup | Sonuç | Kanıt |
|---|---|---|
| BOŞ paket index.html'den gerçek sunucu turu (platform girişi, şirket açma, kurulum, hedef, aksiyon, kanıt, takip) | 51/51 | test-ciktilari/v280/tur.log |
| DOLU demo duman testi (iki ortam aynı anda) | 8/8 | demo-smoke.log |
| Ön yüz kabul kapısı, paketin DOLU_DEMO web paketiyle | tamamı geçti (denetçi 26/27 + belgeli istisna; 68 regresyon; N01–N03; R01–R03; R04 3+4; DTO⊆sözleşme; kapsam denetimi 0 sorun) | fe-kabul-paket.log |
| API entegrasyonu (gerçek PostgreSQL) | 43/43; 564 yanıt 0 sapma; sözleşme güncel; kapsam 0 sorun | api-npm-test.log |
| Domain | 70/70 | domain-test.log |
| Temiz kurulum (ZIP'ten, node_modules ve fixture yok): domain ci+test, web ci+build, API ci+typecheck+build, boş veritabanına 13 migrasyon, sözleşme --check | hepsi 0 | temiz-kurulum.log |

Koşulmayan: Mac/Safari ve Firefox (ortamda yok); 20 şirketlik yük ölçümü (sentetik çok şirketli veri üreteci yok).
