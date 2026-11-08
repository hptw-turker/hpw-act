# HPW Act v2.7.4 — bağımsız yeniden denetim yanıtı (N01–N04)

Başlangıç: v2.7.3 (a7de42e2b635). Bağımsız denetçinin `independent.cjs` betiği değiştirilmeden `tools/tests/fe/bagimsiz/` altına alındı ve standart ön yüz test komutuna bağlandı. Önce eski build üzerinde koşuldu: **0/3** (N01, N02, N03 yeniden üretildi; `docs/test-ciktilari/v274/baseline/independent-results.json`). N04 kaynak/sözleşme incelemesiyle doğrulandı (83/83 boş başarı şeması).

| # | Kök neden | Değişen dosyalar | Düzeltme | Önce → sonra (test) | Kanıt |
|---|---|---|---|---|---|
| **N01 / F06** receipt_lost | Uzlaştırıcı yokken `Promise.all([])` başarı sayılıyordu; okuma yapılsa bile işlemin sonucu doğrulanmadan niyet kapanıyordu; Organizasyon ekranında okuyucu yoktu. | apps/web/src/product/api.ts, hooks.ts, pages/Setup.tsx, pages/Chain.tsx | Uzlaştırma komutun başladığı oturum/şirket ve ekran bağlamına bağlandı (okuyucular bağlam anahtarıyla kaydolur; bağlam değişmişse ya da okuyucu yoksa uzlaştırılmaz). Niyet yalnız işlemin sonucu kayıtta doğrulanınca (`verify`, ör. yeni birim kodu okunan listede var) kapanır; yalnız okuma yapıldıysa ya da okuma başarısızsa anahtar korunur ve dürüst ileti gösterilir. Organizasyon, soru seti, dönemler, kullanıcılar, dikkat, merkezi kuyruk ve dağıtım ekranlarına gerçek okuyucu eklendi. | N01-RECEIPT-ORG false → true; api-client-extra: N01-NO-RECONCILER-KEEPS-KEY, N01-VERIFY-FALSE-KEEPS-KEY, N01-CONTEXT-CHANGED, RECEIPT-LOST-READ-FAIL-KEEPS-KEY; F06-RECEIPT-OK/FAILREAD | v274/fe/independent-results.json, api-client-extra-results.json |
| **N02 / F04** yetki servisi hatası | Yetki yanıtı geçersizse yerel tabloya ve genel profile dönülüyor, birim yetkisi genel profilden türetiliyordu; test düzeneği /permissions için sessizce [] dönüyordu. | permissions.ts, dto.ts, pages/Chain.tsx (PermNotice); tools/tests/fe/harness.cjs ve ui-audit.cjs (geçerli varsayılan yanıt) | Yüklenirken, 403/503/ağ hatası, null, boş dizi, kuralları eksik yanıt ya da başka birime ait yanıtta bütün mutasyon kontrolleri kapalı; “Yetki bilgisi alınamadı” + yeniden dene. Menü yalnız görüntüleme olduğundan oturum profiliyle çizilir. Başarılı yanıt DTO doğrulamasından geçer. API yetkileri değişmedi. | N02-PERMISSIONS-503 false → true; N02-403/503/AG/NULL/BOS-DIZI/KURALSIZ/YAVAS | ui-regresyon-sonuc.json |
| **N03 / F10** DTO | Ağdan gelen veri çalışma anında doğrulanmıyor, TypeScript türü güvence sanılıyordu. | dto.ts (yeni), hooks.ts, App.tsx (ScreenBoundary), Setup.tsx, Chain.tsx | Ekranların kullandığı 17 yanıt çalışma anında doğrulanır; {}, null, yanlış liste elemanı, eksik zorunlu alan, yanlış tür → “beklenmeyen biçimde yanıt” + yeniden dene. Ek koruma olarak ekran hata sınırı. | N03-USERS-OBJECT false → true; N03-USERS-OBJ/NULL/ELEM/EKSIK, RESULTS-TUR, ACTIONS-OBJ, ORG-EKSIK, ATTENTION-OBJ | ui-regresyon-sonuc.json |
| **N04 / F08** sözleşme | Başarı yanıtları tanımlanmamıştı. | apps/api/scripts/contract-infer.mts, contract-verify.mts, openapi-gen.mts, src/contract/responses.json, server.ts (test örneklemesi), package.json; tools/tests/fe/dto-contract.mts | 83 işlemin tamamı uca özgü yanıt şemasıyla (0 boş): gerçek API test yanıtlarından çıkarıldı; zorunlu/nullable, uuid/tarih biçimleri, veritabanı CHECK kısıtlarından enum, gizli sayıların null kuralı, veri anahtarlı sözlükler. `npm test` (API) gerçek yanıtları sözleşmeye karşı doğrular ve sözleşme eskiyse ya da boş şema varsa düşer. Ön yüz DTO’ları sözleşmenin alt kümesi olarak doğrulanır; test yanıtları (fixture) sözleşmeye uyar. | boş şema 83 → 0; 545 gerçek yanıt, 0 sapma; DTO 17 uç + 5 fixture, 0 uyumsuzluk | v274/api-npm-test.log, fe-kabul.log |

**Sözleşmenin ortaya çıkardığı gerçek:** PostgreSQL `numeric` alanları (ör. `baseline_score`, `approved_target`) API’de metin olarak döner; sözleşme bunu olduğu gibi tanımlar, ön yüz bu alanları sayıya çevirerek gösterir. Sayısal türe geçiş bir backend kararıdır.

**Bilinçli sınırlar.** Test fixture kimlikleri kısa simgelerdir (u1, a1); fixture denetiminde yalnız uuid biçimi denetlenmez (tür, zorunlu alan, enum denetlenir). Enum kaynağı veritabanı CHECK kısıtlarının aynı adlı sütunlarıdır; genel adlı alanlarda (ör. status) izin kümesi tablolar arası birleşimdir.

**LOGIN-ENTER.** Denetçinin eski testi geçersiz e-postayla tek istek bekler; yerel e-posta doğrulaması isteği durdurur. Test değiştirilmedi; geçerli e-posta → 1 istek (F14-ENTER-VALID) ve geçersiz e-posta → 0 istek + ileti (F14-EMAIL-INVALID) ayrı testlerde; tek istisna yalnız bu ikisi geçtiyse kabul edilir.


## Final paket üzerinde koşulan testler (build 46a466f91ccf)

| Grup | Sonuç | Kanıt |
|---|---|---|
| Bağımsız denetçi N01–N03 (paketin DOLU_DEMO web paketi) | 3/3 (önce 0/3) | test-ciktilari/v274/fe-paket/independent-results.json |
| Önceki denetçi tarayıcı senaryoları | 26/27; LOGIN-ENTER belgeli istisna | fe-paket/ui-results.json, fe-kabul-paket.log |
| Ek tarayıcı regresyonları (N02 olumsuz yetki 7, N03 bozuk DTO 8 dahil) | 63/63 | fe-paket/ui-regresyon-sonuc.json |
| API istemcisi (denetçi 5, ek 10) | 5/5, 10/10 | fe-paket/api-client-*.json |
| Yetki kural sözleşmesi; DTO ⊆ sözleşme + fixture | geçti; 17 uç + 5 fixture, 0 uyumsuzluk | fe-kabul-paket.log |
| API entegrasyonu (gerçek PostgreSQL + HTTP) + sözleşme doğrulaması | 41/41; 545 gerçek yanıt, 0 sapma; sözleşme güncel | api-npm-test.log |
| Domain | 70/70 | domain-test.log |
| BOŞ paket index.html’den gerçek sunucu turu | 51/51 | tur.log |
| DOLU demo duman testi (iki ortam aynı anda) | 8/8 | demo-smoke.log |
| Temiz kurulum (ZIP’ten, node_modules ve fixture yok): domain ci+test, web ci+build (prebuild fixture üretti), API ci+typecheck+build, boş veritabanına 12 migrasyon, sözleşme --check | hepsi 0 çıkış kodu | temiz-kurulum.log |

**Tur betiği düzeltmesi.** BOŞ turunun 8. adımı (İK iş ortağı doğrulaması) tablonun ilk satırını açıyordu; ilk satır doğrulanacak aksiyon olmadığında düğme pasif kalıyordu (v2.7.2’deki tek seferlik düşüşün de nedeni). Adım artık “tamamlandı beyanı” durumundaki aksiyonu açıkça seçiyor; beklenen davranış (eksik kanıtla onay tamamlanmaz) değişmedi.

## Koşulmayan / açık

- Mac/Safari ve Firefox: TEST EDİLMEDİ (ortamda yalnız Chromium).
- Backend hazırlığı için açık bulgu kalmadı; kanıt bağımsız yeniden denetime bağlıdır.
- Canlıya çıkış kapıları (backend hazırlığından ayrı): HTTPS/Mac dağıtımı, Docker temiz kurulum, gerçek SMTP/bounce, upload güvenliği, retention/imha, yedekten dönüş tatbikatı, erişilebilirlik, uzak veritabanıyla yük testi, HPW metodoloji onayları.
