# v2.11.1 bağımsız kanıt paketi

Hedef: `HPW_Act_TESLIMAT_v2.11.1_962ba299fbce.zip`, SHA-256 `51cdb19878dd59272f767767bc90b55795ce847a089823b439f6a3dbccbd6b5b`.

Ürün paketi bu ZIP'te yok. Testler ürün kaynaklarını değiştirmez. `tests/original` v2.11.0 denetçisinin özgün betikleridir; `pw.cjs` yalnız bu ortamdaki tarayıcı çalıştırıcısını bağlar. `tests/fixture-adapted/independent-ui.cjs` aynı beklentileri korur; yalnız DATA.evaluations fixture'ına yeni sözleşmenin `active_item_state:'open'` alanını ekler. `adaptation.diff` bu değişiklikleri gösterir.

## Çalıştırma

Node ve Playwright bulunan ortamda `pw.cjs` içindeki bağımlılık/Chromium yolunu uyarlayın. Bu denetimde Playwright ile Chromium 133.0.6943.0 kullanıldı. Bağımlılıklar `harness/package-lock.json` ile sabitlenmiştir; browser binary ve node_modules kanıta eklenmez.

Ortam değişkenleri:

- `HPW_SOURCE`: ürünün GELISTIRICI_KAYNAK dizini.
- `WEB_DIST`: ürünün DOLU_DEMO/assets/app/apps/web/dist dizini.
- `HPW_API_RUNTIME`: ürünün DOLU_DEMO/assets/app/apps/api/dist/src dizini.
- `OUT`: her koşu için yeni ve boş kanıt dizini.
- `CODEX_PRIMARY_RUNTIME_NODE_MODULES`: bu ortamda Playwright'ın bulunduğu yer; başka ortamda wrapper'ı uyarlayın.

Komutlar:

```sh
node tests/original/independent-ui.cjs
node tests/fixture-adapted/independent-ui.cjs
node tests/edge-ui.cjs
```

`edge-ui.cjs` 7 senaryo içerir: 3 bozuk DTO, 2 geçerli DTO kontrolü, maksimum tarih tekrarı, normal tarih kontrolü. İsteğe bağlı `TEST_FILTER=RETRY` yalnız yeniden-deneme senaryolarını çalıştırır. `TEST_NOW=2026-09-28T21:30:00Z` iki sürüm karşılaştırmasında kullanılır. v2.11.0 için bu saat önemlidir: eski formun maksimum tarihi de sunucu sınırı içinde kalır. `HPW_SOURCE` ve `WEB_DIST` iki sürüm için kendi paketlerine bağlanmalıdır. v2.11.0 harness'ı `timezoneId` seçeneğini uygulamaz; eski form mutlak bitişi sabit UTC üretir.

Kontrollü HTTP modeli ilk komutu kaydeder, yanıtları düşürür, aynı gövde+anahtarda sonucu tekrar verir; farklı anahtar ve eski sürümde 409 döner. Bunlar gerçek PostgreSQL commit'leri değildir. Tarayıcı testinin esas gözlemi gerçek uygulamanın gönderdiği gövde, anahtar, niyet deposu ve kullanıcı arayüzüdür.

`run-suite.py` mevcut test gruplarının komutlarını içerir. Gerçekte kullanılan mutlak yollar, tarih ve çıkış kodları `evidence/suite/run.json` içindedir. Her tekrar için temiz çıktı dizini ve yeni REG_RUN gerekir. `run-probes.py`, `setup.py` ve `baseline.py` bu denetimdeki ortam/çıkarma işlemlerini gösterir; kaynak ZIP yolları başka ortamda uyarlanmalıdır.

## API sondası

```sh
UI_RESULTS=/absolute/path/fixture-adapted-ui/results.json node tests/cas-api.mjs
```

Bu sonda gerçek Fastify ve evaluateTenant kodunu çalıştırır. Özgün modele `WHERE id=$1 AND version=$8` sürüm koşulu eklenmiştir. FOR UPDATE kilitleri özellikle modellenmez: eski anlık görüntüyle yazım zorlanarak ek sürüm güvencesi sınanır. Bu sıra gerçek v2.11.1 satır kilitleri altında aynı biçimde gerçekleşmek zorunda değildir. Sonuç, PostgreSQL kilit davranışının doğrulanması diye sunulmamalıdır.

Eski tarih gövdesinin 422, tam 30 günlük sınırın 200 alması ve gerçek UI testinden okunan yeni gövdenin 200 alması ayrı kontrol edilir. Özgün API sondası arşivlenmiştir; eski modeli yeni satır kilitlerinin kabulü yerine kullanmayın.

## Kanıt yolları

- `evidence/original-ui/`: özgün fixture ile 4/5.
- `evidence/fixture-adapted-ui/`: yeni alan eklenmiş fixture ile 5/5.
- `evidence/edge-ui-final/`: son 7 yeni senaryo; 4 FAIL, 3 PASS. Dört başarısız kontrol iki ürün bulgusuna karşılık gelir. `edge-ui/` önceki aynı sonuçlu koşudur.
- `evidence/retry-2130-v2.11.0/`: maksimum ve normal tarih 2/2 PASS.
- `evidence/retry-2130-v2.11.1/`: maksimum FAIL, normal PASS.
- `evidence/cas-api/`: 4/4 kontrollü API kontrolü.
- `evidence/suite/`: 144/144 regresyon ve raporda sayılan gruplar.
- `evidence/identity.json`, `migrations.json`, `source-integrity.json`, `web-identity.json`: kimlik/bütünlük karşılaştırmaları.
- `supplier/`: üreticinin yanıtı ve seçili ham logları; bağımsız koşu değildir.

`edge-ui.first-wait-probe.*` ilk test geliştirme koşusudur: 409 sonrası checkbox bekleyişi, pasif modalı kapsamıyordu. Bekleme koşulu düzeltildi; ürün beklentisi aynı. `baseline-edge.log` ilk eski paket çıkarımında eksik sözleşme dosyası yüzünden başlamayan koşudur; tamamlanmış karşılaştırmalar `retry-2130-*` dizinlerinde. Başlangıçtaki Python Brotli modülü eksikliği Node zlib ile çözüldü; ürün dosyaları değiştirilmedi.

Gerçek PostgreSQL sunucusu bu ortamda yoktu. `runuser -u nobody -- id` ortamın grup değiştirme izninde reddedildi. Gerçek PostgreSQL, temiz kurulum, yükseltme, BOŞ/DOLU ve Firefox/WebKit/Safari bağımsız kabulü iddia edilmez.
