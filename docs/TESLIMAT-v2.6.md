# HPW Act v2.6 — teslimat notu (24 Eylül 2026)

## Teslim edilenler
- `HPW_Act_DOLU_DEMO.zip`: aynı kaynak/build + `apps/api/.env.demo` + `demo/hpw_act_demo.dump` (sentetik iki şirket, yalnız veri; şema migrasyonla kurulur) + `demo/DEMO-GIRIS-BILGILERI.md` + `BASLAT-DEMO.sh`. Alternatif: dump yerine `npm run seed:demo` (aynı veriyi gerçek API/yükleyici yoluyla yeniden üretir).
- `HPW_Act_BOS_BASLANGIC.zip`: aynı kaynak/build + `ops/env.bos.example` + `BASLAT-BOS.sh` (rastgele SETUP_KEY ve DB parolası üretir). Müşteri, kullanıcı, sonuç, davet, posta, demo dikkat kaydı, test kaydı **yok**; yalnız migrasyon defteri, güvenlik/izin tanımları, HPW standart soru kataloğu (uygulanmamış), aksiyon şablon kütüphanesi, boş XLSX şablonları (`docs/xlsx-sablonlar-bos`).
- Her iki pakette: `NEREDEN-BASLARIM.md`, `docs/R01-R44-kapanis-tablosu.md`, `apps/api/README.md` (API/migrasyon/yetki/yükleme sözleşmesi), `docs/test-ciktilari/` (gerçek koşu günlükleri ve ekran görüntüleri), `tools/scripts/ui-bos-tur.py`.

## Gerçekten koşturulan testler (bu teslimatta)
| Test | Sonuç | Çıktı |
|---|---|---|
| Domain birim testleri (packages/domain-core) | 70/70 | test-ciktilari/domain-test.log |
| API uçtan uca (iki şirket sıfırdan, Excel turları, RLS) | 10/10 | test-ciktilari/api-npm-test.log |
| API R01–R44 regresyon | 9 senaryo, 9/9 (tek komut: `npm test`, toplam 19/19) | aynı |
| Boş kurulumdan tarayıcı turu (Playwright, gerçek API+DB, iki şirket, iki hedef, XLSX, davet, kanıt, doğrulama, takip, izolasyon, parola sıfırlama, erişim iptali) | 46/46 | test-ciktilari/ui-bos-tur.log, ui-bos-tur-sonuc.json, tur-*.png |
| Prototip düğme testi / Excel akışı | 39/39, 12/12 | test-ciktilari/prototip-*.log |
| DOLU DEMO tohumu (2 şirket, 668 birim, 524 kullanıcı, 96.852 sonuç, 35 hedef, 35 aksiyon, 181 kanıt) | tamamlandı | test-ciktilari/seed-demo.log |
| Demo dump geri yükleme (taze migrasyonlu DB'ye) | 0 hata, 2 şirket / 96.852 sonuç / 35 aksiyon | ops/paketle.sh doğrulaması |
| TR-KONTROL, BRAND-QA, KOTA-DİLİ, `npm run typecheck` | temiz | — |

## Ortam ayrımı (fiilen doğrulandı)
Ayrı veritabanları (`hpw_act_demo`, `hpw_act_bos`), ayrı LOGIN servis hesapları (`hpw_api_demo`, `hpw_api_bos`; diğer DB'ye CONNECT reddedilir — denendi: "permission denied for database"), ayrı portlar (8787/8788), ayrı çerez adları (`hpw_session_demo|bos`), ayrı posta dizinleri (`var/mail-demo|bos`), ayrı SETUP_KEY ve sırlar. Token'lar ortamın DB'sine bağlıdır; diğer ortamda kabul edilmez. Demo sıfırlama BOŞ'a, test sıfırlama (`*_test`) uygulama DB'lerine dokunmaz. Aynı e-posta iki ortamda ayrı hesaptır.

## Bu teslimatta yapılmayanlar / dış bağımlılıklar
- Gerçek e-posta teslimatı: SMTP istemcisi ve MAIL_FROM/MAIL_ALLOWLIST koruması var, ama gerçek sağlayıcıyla gönderim ve teslimat webhook'u denenmedi (R32). Sandbox ekranda açıkça etiketlenir; sahte "gönderildi" yok.
- Docker/compose bu ortamda çalıştırılamadı; kurulum kılavuzu Node + PostgreSQL üzerindendir.
- Açık bulgular: R16 (çoklu kesit), R18 (kısmi indeks adı), R30 (reorg/devir), R31 (ana aksiyon/400'lü dağıtım, merkezi karar kuyruğu), R44 (HPW metodoloji onayı ve gerçek veri pilotu). Kısmen kapatılanlar tabloda.
- Fastify 4 → 5 yükseltmesi ve tek lock dosyası (R39) ayrı iş olarak bırakıldı.
- Standart HPW tanımları müşteriye yeniden yazdırılmaz; katalog sistem referansıdır. Sentetik demo verileri HPW onaylı benchmark değildir ve benchmark olarak gösterilmez.

## Ayrı onay gerektirenler
Canlı yayın; gerçek toplu e-posta (izole test kutusu dışında); gerçek veride yıkıcı işlem (`ops/reset-env.sh`, `test/reset-db.sh` yalnız `*_test`).
