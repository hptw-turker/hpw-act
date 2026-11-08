# HPW Act v2.11.5 bağımsız denetim kanıtları

Bu bir ürün teslimi değildir. İncelenen build `0edf9f2a737a`; iç ZIP SHA-256 `aa7e70cb4e89fbed52f5fe062bc8edd3f96b551ec4fd42a0b45042f4f526d079`. Ürün kodu değiştirilmedi.

`evidence/` bu tur bağımsız üretilen sonuçları içerir. `supplier-evidence/` açıkça ayrılmış üretici kayıtlarıdır. Chromium 133 ile teslim edilen gerçek web derlemesi, kontrollü HTTP ve saat kullanıldı. API sondaları teslim Fastify uygulamasını kontrollü veritabanı modeliyle çalıştırır. Bu tur gerçek PostgreSQL, gerçek sunucuyla BOŞ/DOLU, temiz kurulum, yükseltme, Firefox/WebKit/Safari ve yük ölçümü bağımsız çalıştırılmadı.

## Yeni karşı örnek: V2115-A01

`tests/multi-pending-ui.cjs` üç senaryo içerir:

| Test | Sonuç | Akış |
|---|---|---|
| V2115-MULTI-2-DISMISS | PASS | A belirsiz → B açık ikinci onayla gönderilir → A uygulanır, B çatışır; A sonuçlandırılır |
| V2115-MULTI-3-DISMISS | FAIL | A ve B belirsiz → C açık ikinci onayla gönderilir → A uygulanır, C çatışır; A takibi ezilmiştir |
| V2115-MULTI-3-SNOOZE | FAIL | Aynı üç komut sırası, erteleme |

Komut gövdeleri ve anahtarları sabittir; B ve C için ilk bilgilendirme onayı POST üretmez. İlk komutun commit'i son farklı komutun POST'u sırasında modellenir. Son komut 409 alır. Ekran kapatılır, şirket filtresi değiştirilerek liste yeniden okunur. İlk komut için commit sonrası ürünün sonuç sorgusu sayılır ve istemci niyet kaydı okunur. Son `phase=observer-proof` sorgusu testin doğrulamasıdır, ürünün sorgusu sayılmaz. İki komutlu kontrolde ilk anahtar sonuçlandırılır; üç komutlu durumlarda ilk anahtar sorgulanmaz ve outcome_unknown kalır. Yeni test veri kaybı veya mükerrer iş etkisi iddia etmez.

`evidence/multi-pending-draft/` ilk koşudaki test seçici hatasını korur: gizli `<option>` beklenmiş, üç senaryo ERROR olmuştur. Nihai test aynı beklentilerle görünür tablo hücresini bekler. Bu taslak ürün bulgusu veya kabul sonucuna eklenmez. Nihai sonuç `evidence/multi-pending-ui/` içindedir.

## Çalıştırma

Node, Playwright (clock desteği), Chromium ve teslim kaynağındaki `tools/tests/fe/harness.cjs` gerekir. `pw.cjs` bu denetimin ortam adaptörüdür: `CODEX_PRIMARY_RUNTIME_NODE_MODULES/playwright` ve `browser/chromium` kullanır. Başka ortamda yalnız bu dosyayı kurulu Playwright'ı dışa aktaracak şekilde uyarlayın; örneğin `module.exports=require('playwright')`. Test davranışını ve beklentilerini değiştirmeyin. Tarayıcı ve node_modules kanıt ZIP'inde bulunmaz. Yardımcı bağımlılık kilidi `harness/package-lock.json` içindedir.

```bash
export HPW_SOURCE='/absolute/HPW_Act_TESLIMAT_v2.11.5/GELISTIRICI_KAYNAK'
export WEB_DIST='/absolute/HPW_Act_TESLIMAT_v2.11.5/DOLU_DEMO/assets/app/apps/web/dist'
export HPW_API_RUNTIME='/absolute/HPW_Act_TESLIMAT_v2.11.5/DOLU_DEMO/assets/app/apps/api/dist/src'
export OUT='/absolute/output/multi-pending-ui'
node tests/multi-pending-ui.cjs
```

Her betik için ayrı OUT kullanın. Eski sıralama kontrolü `tests/outcome-order-ui.cjs` bu tur 3/3 geçti. `tests/outcome-api.mjs` gerçek Fastify / kontrollü DB ile 6/6 geçti. `tests/cas-api.mjs` ayrıca `UI_RESULTS` değişkenini uyarlamalı independent-ui çıktısındaki results.json'a ister. Ayrıntılı komutlar `run-*.py` ve koşu kayıtlarındadır. Python koşucuları ürünün `source/HPW_Act_TESLIMAT_v2.11.5/` altında olmasını bekler.

## Özgün testler ve uyarlamalar

Önceki bağımsız testler değiştirilmedi; `evidence/original-test-comparison.json` dosya hash karşılaştırmasını gösterir. `tests/outcome-adapted/reconcile-ui.cjs` daha önce kabul edilen sonuç-ucu fikstür uyarlamasıdır. Bu tur özgün reconcile 2 PASS / 1 FAIL / 1 ERROR, uyarlama 4 PASS verir. Özgünün yeni ucu yanıtlamaması ürün regresyonu sayılmaz. `fixture-adapted/independent-ui.cjs` zorunlu DTO alanı uyarlamasıdır ve 5/5 geçer. `tests/original/independent-api.mjs` tarihsel olarak korunmuştur; bu tur çalıştırılmamıştır.

Üreticinin `ui-audit.hazir-bekleme.cjs` kopyası yalnız DEEP-LINK düğmesi için görünürlük beklemesi ekler. Bağımsız fark dökümü `evidence/legacy-adaptation.diff` içindedir. Özgün legacy betik bu tur yeniden koşulmadı. LOGIN-ENTER geçersiz e-postayla ağ isteği bekleyen eski istisnadır; geçerli e-posta ve geçersiz e-posta davranışlarının regresyonları ayrı değerlendirilir.

TXT test paketi JSON/UTF-8 taşıma biçimidir; JSON'u kod olarak çalıştırmayın. `extract-test-bundle.py` yeni dizine çıkarırken her dosyanın boyutunu ve SHA-256'sını denetler. TXT, testleri ve rapor/sonuç metinlerini taşır; PNG'ler yalnız kanıt ZIP'indedir. ZIP içindeki `SHA256SUMS.json` kendi dışındaki bütün kanıt dosyalarının envanteridir. Taslak/son koşu sonuçları birleştirilmez.
