# N01–N36 kapanış tablosu (v2.6.1, 24 Eylül 2026)

Durumlar: **Doğrulandı** = kodda giderildi ve çalıştırılan testle kanıtlandı; **Uygulandı/doğrulanmadı** = kodda giderildi, hedefli test yazılmadı; **Kısmi**; **Açık**; **Dış bağımlılık**. Kanıt referansları: E2E-n / R-n (apps/api/test), Tur (paket index.html'den 51 adım, KANITLAR/TEST_KOSULARI/ui-bos-tur.log), D (demo smoke), launch-*.log.

| # | Öncelik | Durum | Ne yapıldı | Kanıt |
|---|---|---|---|---|
| N01 | P0 | Doğrulandı | Başlatıcı şablondan üretilir, paketlemede `sh -n`; temiz klasörden gerçek açılış | launch-bos.log, launch-demo.log |
| N02 | P0 | Kısmi | tsconfig.base.json, lock dosyaları ve migrasyonlar pakette; çalışma zamanı bağımlılık kapısı var; paket kökünden derleme testi yok | ops/paketle-teslimat.sh |
| N03 | P1 | Doğrulandı | Prototip ürün static kökünden kaldırıldı, sunucu 404 döner (HPW_SERVE_PROTOTYPE yalnız geliştirme) | launch-bos çıktısı: 404 prototip |
| N04 | P0 | Kısmi | HPW_ENV_FILE yoksa dur; DEMO+SMTP yalnız allowlist ile; ayrı host (127.0.0.1 / localhost) ve ayrı çerez adı; canlı için host-only Secure/prefix çerez yapılmadı | D8, config.ts |
| N05 | P0 | Uygulandı/doğrulanmadı | Org_Rolleri (XLSX) ve /org/roles aynı grant politikası (ctx.grantable) | org.ts |
| N06 | P0 | Doğrulandı (kısmen) | Kaynak bazlı yetki `profileForUnit/requireUnitProfile`; yazma yollarında kapsam dışı 403 | Tur 8, 10b/10c; A-yönetici+B-izleyici birleşik testi yok |
| N07 | P0 | Uygulandı/doğrulanmadı | review/followup-review kapsam kontrolü; dikkat listesi kapsam filtreli, unitId korunur | analysis.ts |
| N08 | P0 | Kısmi | Rol effective_from/to ve atama tarihleri birlikte, takvim geçerliliği; CREATE ilişki/rol valid_to yazımı hâlâ eksik | auth.ts, xlsx.ts |
| N09 | P0 | Uygulandı/doğrulanmadı | Ek_Erisim bağımsız CREATE/UPDATE/CLOSE gerçek upsert; gelecek tarihli atama CLOSE | users.ts |
| N10 | P0 | Uygulandı/doğrulanmadı | forgot/reset/davet kabulünde hız sınırı; reset pasif hesabı etkinleştirmez (0004) | auth.ts, 0004 |
| N11 | P0 | Uygulandı/doğrulanmadı | Anahtar aktör+yöntem+yol bağlı; ön yüz hedef/aksiyon oluşturmada anahtar gönderir | server.ts, Chain.tsx; R-7 aynı aktör |
| N12 | P0 | Açık | Dönem yayını kilidi, hedef limiti DB zorlaması, expected_version yok | — |
| N13 | P0 | Uygulandı/doğrulanmadı | FULL_REPLACE boş benchmarkı temizler; PATCH korur | results.ts |
| N14 | P0 | Açık | PATCH kardeş gösterge birleşik doğrulama yok | — |
| N15 | P0 | Açık | PATCH indeks mutabakatı birleşik küme ile değil | — |
| N16 | P1 | Açık | Tek hücre düzeltmesi bütün hedefleri incelemeye düşürür | — |
| N17 | P0 | Kısmi | Rebase yeni taslak öneri (approved boş), keep/rebase tarihçesi; ekranda ayrı yeniden kabul akışı yok | R-7 (başlangıç 40) |
| N18 | P0 | Uygulandı/doğrulanmadı | Dagilimlar/Resmi_Toplamlar satır dönemi; tanım sürümü katalog seti; takvim geçerliliği | results.ts; Sonuclar için R-6 |
| N19 | P0 | Açık | Kısmi indeks/yöntem eşdeğerliği | — |
| N20 | P0 | Kısmi | Yaprak kuralı; HPW referans mutabakatı yok | — |
| N21 | P1 | Kısmi | Ufuk takip döneminden; varsayımlar API'de | — |
| N22 | P1 | Kısmi | Özel plan var; birim tipi eşlemesi ve merkezi sorumluluk ayrımı yok | — |
| N23 | P0 | Doğrulandı | Gerçekleşme kimliği ile plan slotu ayrıldı; ek olay slotu karşılamaz | E2E-7 (5/5), Tur 7f2 |
| N24 | P0 | Doğrulandı | E0/E1 politika karşılanınca iş kapanır ve yükten düşer; etiket policy_met | E2E-7 |
| N25 | P0 | Uygulandı/doğrulanmadı | Onay canlı değerlendirme kimliği/sürümüne bağlı (assessment_stale); incelemede GET yazmaz; zaman yönü 422 | analysis.ts |
| N26 | P0 | Kısmi | Audit olayları işlemle aynı transaction; değerlendirmeler hâlâ upsert | — |
| N27 | P0 | Kısmi | Kira + üstel bekleme + perm_fail (R-9); uzun toplu posta simülasyonu yok | R-9 |
| N28 | P0 | Kısmi | Ortam başına servis hesabı, PUBLIC EXECUTE iptali; salt okunur platform denetçisi yok | ops/create-env.sh |
| N29 | P0 | Açık | Zip bombası/işçi izolasyonu/formül politikası | — |
| N30 | P1 | Kısmi | Test posta kutusu ve ilk kurulum formu eklendi; kayıt seçili derin link yok | Tur 6c2, E3 |
| N31 | P1 | Doğrulandı (Linux) | İlk admin giriş ekranından (kurulum anahtarı yerel dosyada); teknik ön koşul NASIL_ACARIM'da; dinamik şablon ürün içinde | Tur E3–E5 |
| N32 | P0 | Kısmi | Tek çalışma zamanı (node dist), runtime-manifest, hash manifesti; API route manifesti yok | KANITLAR/TESLIMAT_MANIFESTI.json |
| N33 | P0 | Açık | 400 birimli ana aksiyon dağıtımı yok | — |
| N34 | P1 | Kısmi | Sayılar satırlardan; her satırda negatif test yok | bu tablo |
| N35 | P0 | Dış bağımlılık | HPW yöntem onayı ve gerçek müşteri doğrulaması | — |
| N36 | P0 | Dış bağımlılık | Pilot, yedekten kurtarma tatbikatı (demo dump geri yükleme doğrulandı) | — |

Doğrulandı 8 (biri kısmen) · Uygulandı/doğrulanmadı 8 · Kısmi 12 · Açık 6 · Dış bağımlılık 2.
