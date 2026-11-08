# v2.10.1 bağımsız yeniden denetim kanıtları

Tarih 28.09.2026 (Türkiye). Build `1d493310fb3d`.

Ürün kaynakları bu kanıt paketinde yeniden dağıtılmıyor. Testler ürünün DOLU_DEMO içindeki web ve API derlemesiyle çalışır. Gerçek PostgreSQL bu denetimde kullanılmadı. `receipt-api.mjs` ve önceki `independent-api.mjs` yalnız `pool.connect` düzeyinde kontrollü DB yanıtları verir; diğer sunucu işleyicileri teslim edilmiş koddur.

## Yeni testleri çalıştırma

```bash
export HPW_SOURCE=/absolute/path/HPW_Act_TESLIMAT_v2.10.1/GELISTIRICI_KAYNAK
export WEB_DIST=/absolute/path/HPW_Act_TESLIMAT_v2.10.1/DOLU_DEMO/assets/app/apps/web/dist
export HPW_API_RUNTIME=/absolute/path/HPW_Act_TESLIMAT_v2.10.1/DOLU_DEMO/assets/app/apps/api/dist/src
export PLAYWRIGHT_MODULE=/absolute/path/to/node_modules/playwright
export CHROMIUM_PATH=/absolute/path/to/chromium
export OUT=/absolute/path/to/new-results
node tests/edge-ui.cjs
node tests/receipt-api.mjs
```

UI betiği üç kabul beklentisini kontrol eder; mevcut v2.10.1'de üçü de FAIL. API betiği bir ulaşılabilirlik probudur: başarı kodu 0, mevcut sunucu akışının `receipt_lost` ve ardından `done` sonucunu ürettiğinin gösterildiği anlamına gelir; ürünün düzeldiği anlamına gelmez. Düzeltme sonrasında bu proba yeni beklenen davranış için ayrı regresyon testi eklenmelidir. UNMOCKED QUERY veya 500 başarılı sonuç sayılmaz.

İsteğe bağlı `TEST_FILTER` UI test kimliğinin bir parçasıdır. Testler orijinal kanıtın üzerine yazmasın diye yeniden koşuda OUT kullanın.

## Önceki testler

`previous/evidence-pack/tests/` dizinindeki üç dosya önceki denetim paketinden değiştirilmeden alındı. Üreticinin bu sürüme aldığı kopyalarla aynı oldukları `evidence/unchanged-tests.json` içinde SHA-256 ile kayıtlıdır. Yukarıdaki ortam değişkenleriyle:

```bash
node previous/evidence-pack/tests/independent-ui.cjs
node previous/evidence-pack/tests/independent-api.mjs
```

Önceki UI paketi 7/7, API karşı örneği 1/1 geçti. Bu sonuçlar yeni üç senaryonun geçmesi anlamına gelmez.

## Mevcut ürün testleri ve ortam

`ui-regresyon.cjs` ve `ui-audit.cjs` ürün kaynağından değiştirilmeden çalıştırıldı. `PW_MODULE` burada bulunan `previous/evidence-pack/tests/pw.cjs` dosyasına, `WEB_DIST` ZIP'in DOLU_DEMO web derlemesine ve `OUT` bağımsız kanıt dizinine ayarlandı. Esas ayrıntılı sonuçlar `evidence/regressions/ui-regresyon-sonuc.json` (117/117) ve `evidence/legacy-audit/` (26/27) içindedir.

Node 24.19 ve Chromium 153 kullanıldı. Chromium yereldeki mevcut Brotli paketinden açıldı; `--single-process` kullanılmadı. Domain ve istemci TypeScript testleri mevcut TSX yükleyicisiyle çalıştı. Dil kapsam testine, pakette kurulmamış geliştirme bağımlılığı için mevcut TypeScript dizini bağlandı. Bu işlem temiz kurulum testi değildir. İlk dil testi yanlış çalışma dizini / eksik bağımlılık nedeniyle çalışmadı; doğru dizin ve bağımlılıkla `i18n-final.log` sonucu alındı.

Kaynak dosyalara ürün düzeltmesi yapılmadı. Çalışma sonunda ZIP'teki 1.289 düzenli geliştirici kaynağı dosyasının tamamı karşılaştırıldı; içerik farkı yok (`source-integrity.json`).

## Kanıtları yorumlama

- `identity.json`: paket SHA, BOŞ/DOLU dosya sayımı ve manifest build kimlikleri.
- `migrations.json`: 0001–0017'nin önceki denetimde kaydedilen hash'lerle karşılaştırması.
- `original-ui/`, `original-api/`: önceki karşı örneklerin bu sürümdeki bağımsız sonuçları.
- `edge-ui/`: yeni iki bulguyu gösteren üç senaryo, ağ gövdeleri, önce/sonra görüntüler.
- `receipt-api/`: teslim edilmiş sunucu kodunun aynı anahtarlı teyit tekrarı, sorgu izi ve sonuç okuması.
- `regressions/`, `legacy-audit/`, domain/istemci/sözleşme/dil sonuçları: bağımsız koşular.
- `summary.json`: aynı kanıt dosyalarından hesaplanan sonuç özeti ve test edilen web dosyalarının SHA-256 değerleri.
- `reports/`: kabul raporu ve Claude düzeltme istemi.

Üreticinin 79 API testi, 944 gerçek yanıt, BOŞ/DOLU turları ve yükseltme beyanları bu paketin bağımsız PostgreSQL kanıtı değildir. Açık sınırlar raporda belirtilmiştir.
