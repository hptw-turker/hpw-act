# HPW Act v2.6.1 — teslimat notu (24 Eylül 2026)

## Ne teslim edildi
Tek ana ZIP `HPW_Act_TESLIMAT_v2.6.1.zip` (+ .sha256). İçinde açılmış klasörler: `DOLU_DEMO/` ve `BOS_BASLANGIC/` (her birinin kökünde **index.html**, NASIL_ACARIM.html, runtime-manifest.json, SABLONLAR/, CALISTIRMA/ başlatıcı, assets/app aynı build), `GELISTIRICI_KAYNAK/` (kod, migrasyonlar 0001–0004, ops, testler), `KANITLAR/` (LINK_DUGME_ENVANTERI.csv, KABUL_SONUCLARI.json, N01–N36 ve R01–R44 kapanış tabloları, TEST_KOSULARI/ günlük ve ekran görüntüleri, TESLIMAT_MANIFESTI.json dosya checksum listesi).

## index.html nasıl çalışıyor, ne yapmıyor
index.html sır içermez; yalnız yerel servisin `/api/health-probe.js` sondasıyla ortam (demo/bos) ve build kimliğini doğrular, eşleşirse aynı gerçek uygulamaya (DEMO `http://127.0.0.1:8787`, BOŞ `http://localhost:8788`) geçer. Servis kapalıysa açık uyarı verir ve hazır olana kadar yeniden dener; yanlış ortam/sürümde geçiş yapmaz. Tarayıcı güvenliği gevşetilmedi (CORS `*`/Origin:null yok; API isteği file:// kökeninden yapılmaz). Dosya tek başına veritabanı başlatmaz: **tek seferlik ön koşul** Node.js 22+ ve PostgreSQL 16+ kurulumudur; sonrasında kullanıcı yalnız `CALISTIRMA/HPW_Act_<ORTAM>_Baslat.command` dosyasını çift tıklar (macOS ilk açılışta sağ tık → Aç ister). Başlatıcı kendi PostgreSQL kümesini ve servis hesabını kurar, migrasyonu uygular, DEMO'da sentetik veriyi bir kez yükler, sunucuyu açar ve index.html'i açar; ikinci çalıştırma yeni veri/çift sunucu üretmez. Sırlar ilk çalıştırmada üretilip yalnız CALISTIRMA altına yazılır.

## Gerçekten çalıştırılan testler
| Test | Sonuç | Kanıt |
|---|---|---|
| API (E2E 10 + R01–R44 regresyon 9), gerçek PostgreSQL, N23/N24 davranışına göre güncellenmiş | 19/19 | TEST_KOSULARI/api-npm-test.log |
| Temiz klasöre açılan paketten BOŞ başlatıcı (Linux, `postgres` kullanıcısı) → kendi kümesi, migrasyon, servis; build eşleşmesi; prototip 404 | geçti | launch-bos.log |
| Paket kökündeki BOS_BASLANGIC/index.html'den tam tur: ortam doğrulama → gerçek uygulama → giriş ekranından ilk yönetici (yanlış anahtar reddi, ikinci kurulum 409) → şirket → organizasyon (ekran + Excel, hatalı satır) → soru seti → dönem + sonuç Excel → kullanıcılar + davet + uygulama içi test posta kutusu → davet kabulü → iki hedef → aksiyon → kanıt (gelecek tarih ve slot reddi) → beyan → eksik kanıtla onay reddi/iade → ikinci dönem → ikinci hedefin takibi → ikinci şirket ve izolasyon → çıkış/yeniden giriş → parola sıfırlama → erişim iptali | 51/51 | ui-bos-tur.log, ui-bos-tur-sonuc.json, tur-*.png |
| DOLU_DEMO başlatıcı (dump geri yükleme) + DOLU_DEMO/index.html'den giriş: SAHA (648 birim, 502 üye, 2 yayımlı dönem, 30 hedef/aksiyon), FABRIKA; test posta kutusunda 524 sentetik davet; iki ortam aynı anda ayrı host | 8/8 | launch-demo.log, demo-smoke-sonuc.json |
| Domain 70/70, prototip 39/39 ve 12/12, TR-KONTROL/BRAND-QA/KOTA-DİLİ, typecheck | temiz | TEST_KOSULARI |

## Dürüst sınırlar
- macOS'ta gerçek çift tıklama ve Safari denenmedi; başlatıcı Linux'ta aynı POSIX betikle çalıştı, tarayıcı testi Chromium. Windows desteği vaat edilmiyor.
- Gerçek e-posta sağlayıcısı yok; postalar sandbox kutusunda ve ekranda öyle etiketli. Gerçek teslimat/bounce testi yapılmadı (yalnız onaylı alıcıyla ayrı iş).
- K/H manifesti: 28 doğrulandı, 19 uygulandı/doğrulanmadı, 45 kısmi, 21 açık, 3 dış bağımlılık (KABUL_SONUCLARI.json). N01–N36: 8 doğrulandı, 8 uygulandı/doğrulanmadı, 12 kısmi, 6 açık, 2 dış bağımlılık. Açık kalanlar başta N12, N14, N15, N16, N19, N29, N33 ve K-022–K-032, K-064–K-066.
- Sunucuya yayın, gerçek toplu e-posta ve gerçek veride yıkıcı işlem ayrı onay gerektirir.
