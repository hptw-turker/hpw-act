# HPW Act v2.7.5 — bağımsız yeniden denetim yanıtı (R01–R04)

Başlangıç: v2.7.4 (46a466f91ccf). Bağımsız denetçinin `edge.cjs` ve `contract-edge.mts` betikleri değiştirilmeden `tools/tests/fe/bagimsiz/` altına alındı ve standart ön yüz test komutuna bağlandı. Önce eski build üzerinde koşuldu: edge.cjs **0/3**, contract-edge.mts **0/3** (R01–R04 yeniden üretildi).

| # | Kök neden | Değişen dosyalar | Düzeltme | Önce → sonra | Kanıt |
|---|---|---|---|---|---|
| **R01 / F04** | Organizasyon, Soru Seti, Dönemler, Kullanıcılar ve Excel Yükleme ekranlarındaki yazma işlemleri (`addUnit`, `addRole`, `publish`, `create`, `add`, `send`, `revoke`, `validate`, `commit`) hiçbir yerde `usePerms()` kullanmıyordu; yalnız rota düzeyindeki menü koruması (`perms.screen()`) vardı, bu da genel oturum profiliyle çalışır ve işlem yetkisi yerine geçmez. | apps/web/src/product/pages/Setup.tsx (Organization, QuestionSet, Cycles, Users, ImportPage) | Her yazma işlemine hem **işleyici düzeyinde** (`if (!allowed) { hata; return; }`) hem **düğme düzeyinde** (`disabled={... || !allowed}`) yetki koşulu eklendi. Yetki servisi hata verdiğinde ortak `PermNoticeInline` bileşeni "Yetki bilgisi alınamadı" + yeniden dene gösteriyor. API yetkileri değiştirilmedi. | V274-PERM-ORG-503: enabled=true,posts=1 → enabled=false,posts=0 | edge-results.json |
| **R02 / F06** | `api.ts`'teki uzlaştırma hatası ayrıntıyı `{ cause: ... }` nesnesiyle taşıyordu; `describeErrorDetail()` bu `cause` içeriğini doğrudan döndürüyor, `receipt_lost` ailesinin asıl (uzlaştırma sonucunu anlatan) dış mesajını eziyordu. Okuma 503 verince kullanıcı "kayıt yeniden okunuyor/okundu" yerine iç servis hatasının metnini ("Servis şu an yanıt vermiyor…") görüyordu — dürüst değildi. | apps/web/src/product/api.ts | `describeErrorDetail()`: kod `receipt_lost` ile başlıyorsa doğrudan `describeError(e)` (dış, uzlaştırma-farkında mesaj) döner; `cause` yalnız string ise dış mesaja parantez içinde eklenir, onu **ezmez**. | V274-RECEIPT-READ-503: hasHonestMessage=false → true | edge-results.json |
| **R03 / F10** | `DTO.org` yalnız `units`/`roles`'ü doğruluyordu; Organizasyon ekranı ayrıca `unitTypes` ve iç alanları (parent_code, effective_to, holders…) kullanıyordu. `{units:[],roles:[]}` gibi eksik bir yanıt DTO'dan geçip render'da `org?.unitTypes.map` patlamasına, oradan da hata sınırına düşüyordu — çökme yoktu ama DTO'nun kendisi "beklenmeyen biçim" demiyordu. | apps/web/src/product/dto.ts, pages/Setup.tsx (Users, ReorgMove'daki diğer `/org` tüketimleri) | `DTO.org` artık `unitTypes`, `units`, `hierarchies`, `roles` ve bunların gerekli iç alanlarını (id, code, name, unit_type, parent_code\|null, effective_to\|null, title, permission_profile, unit_code, holders\|null) kapsıyor. `/org`'u tüketen üç yerin (Organization, Users, ReorgMove) hepsi aynı `DTO.org` ile `checkDto` üzerinden geçiyor. | V274-ORG-MISSING-UNITTYPES: dtoMessage=true, boundary=false (hata sınırına hiç düşmüyor, doğrudan DTO iletisi) | edge-results.json |
| **R04 / F08** | (a) `contract-infer.mts` yalnız yakalanan örneklerden tür çıkarıyordu; `last_login_at`, `cancel_reason` hiç dolu görülmediği için `{type:'null'}`, boş `reasons[]` için eleman şeması "serbest" kalıyordu — geçerli tarih/metin reddediliyor, yanlış nesne kabul ediliyordu. (b) Daha köklü sorun: enum çıkarımı aynı adı taşıyan sütunların (`status`, `state`, `kind`…) CHECK kısıtlarını **bütün tablolar üzerinden birleştiriyordu**; `result.status` alanı bu yüzden 80'den fazla, birbiriyle alakasız değer kabul ediyordu (workflow durumları + reçete durumları + davet durumları…). (c) `harness.cjs`'teki `conform()` yardımcısı, fixture'da geçersiz bir enum değeri varsa bunu sessizce başka bir geçerli değere çeviriyordu; bu da testin bağımsız beklenen değerini gizliyordu. | apps/api/scripts/contract-infer.mts, src/contract/responses.json; tools/tests/fe/harness.cjs (fixture düzeltmesi + conform sadeleştirmesi) | (a) Örneklerde yalnız `null` görülen alanlar artık `information_schema.columns`'tan gerçek PostgreSQL türüyle (ve nullable bilgisiyle) dolduruluyor; kaynak kodda bilinen DB-dışı alanlar (`GET /api/ready`'nin `reasons[]`'ı) açıkça `string[]` olarak sabitlendi. (b) Enum artık yalnız bir sütun adı **tek bir tabloda** ya da **bütün tablolarda aynı kümeyle** geçiyorsa uygulanıyor; adı çakışan ama anlamı farklı 11 alan (status, state, kind, relationship_type, decision, role, reason, purpose, metric_kind…) artık enum'suz, yalnız tür düzeyinde doğrulanıyor. (c) `conform()`'daki sessiz enum-değiştirme satırı tamamen kaldırıldı; tek gerçek uyumsuzluk (fixture'daki `tier:'A'`) kaynağında gerçek domain değeriyle (`tier:'recommended'`) düzeltildi — test verisi artık gerçek anlamını taşıyor, çalışma anında zorlanmıyor. | LAST-LOGIN-VALID-DATE, CANCEL-REASON-VALID-TEXT: reject → accept; READY-REASONS-OBJECT: accept → reject | contract-edge-results.json |

## Bu turda koşulan testler (final paket üzerinde, build a şağıda)

| Grup | Sonuç | Kanıt |
|---|---|---|
| Denetçinin edge.cjs (R01–R03) | 3/3 (önce 0/3) | fe-paket/edge-results.json |
| Denetçinin contract-edge.mts (R04) | 3/3 (önce 0/3) | fe-paket/contract-edge-results.json |
| Bağımsız N01–N03 (v2.7.4 turu, geriye dönük korunuyor) | 3/3 | fe-paket/independent-results.json |
| Denetçinin eski 27 tarayıcı senaryosu | 26/27; LOGIN-ENTER belgeli istisna | fe-paket/ui-results.json |
| Ek tarayıcı regresyonları (F01–F14, N02/N03 olumsuz durumlar dahil) | 63/63 | fe-paket/ui-regresyon-sonuc.json |
| API istemcisi (denetçi 5, ek 10) | 5/5, 10/10 | fe-paket/api-client-*.json |
| Yetki kural sözleşmesi; DTO ⊆ sözleşme + fixture | geçti; 17 uç + 5 fixture, 0 uyumsuzluk | fe-kabul-paket.log |
| API entegrasyonu (gerçek PostgreSQL + HTTP) + sözleşme doğrulaması | 41/41; 545 gerçek yanıt, 0 sapma; sözleşme güncel | api-npm-test.log |
| Domain | 70/70 | domain-test.log |
| BOŞ paket index.html'den gerçek sunucu turu | bkz. aşağıdaki final tablo | tur.log |
| DOLU demo duman testi (iki ortam aynı anda) | bkz. aşağıdaki final tablo | demo-smoke.log |
| Temiz kurulum (ZIP'ten, node_modules ve fixture yok) | bkz. aşağıdaki final tablo | temiz-kurulum.log |

## LOGIN-ENTER (değişmedi)

Denetçinin eski testi geçersiz e-postayla tek istek bekliyor; F14'ün istediği yerel e-posta doğrulaması bu isteği durduruyor. Test değiştirilmedi; geçerli e-posta → 1 istek (F14-ENTER-VALID) ve geçersiz e-posta → 0 istek + ileti (F14-EMAIL-INVALID) ayrı testlerde geçiyor.

## Kapsam notu (R04'ün gösterdiği genel ders)

Enum belirsizliği yalnız üç karşı örnekle sınırlı değildi — çıkarım yöntemindeki yapısal bir kusurdu (adı çakışan sütunların birleşimi). Düzeltme tek tek alan yamalamak yerine **yöntemi** düzeltti: artık `status`, `state`, `kind`, `decision`, `role`, `reason`, `purpose`, `metric_kind`, `relationship_type` gibi 11 çakışan ad hiçbir zaman yanlış bir enum'a zorlanmıyor; yalnız tür düzeyinde doğrulanıyor. Bu, "yalnız üç senaryoyu geçecek yama" değil, sözleşme üretecinin kendisindeki bir kök neden düzeltmesidir.

## Bu turda bağımsız olarak kapatılmayanlar / açık kalanlar

- Mac/Safari ve Firefox: TEST EDİLMEDİ (ortamda yalnız Chromium).
- HPW metodoloji onayları (uzlaştırma yöntemi, kohort tarih esası, gizlilik+görünürlük politikası): dış bağımlılık, değişmedi.
- Canlıya çıkış kapıları (backend hazırlığından ayrı): HTTPS/Mac dağıtımı, Docker temiz kurulum, gerçek SMTP/bounce, upload güvenliği, retention/imha, yedekten dönüş tatbikatı, erişilebilirlik, uzak veritabanıyla yük testi.
- Sözleşmedeki 66 "tek anlamlı" enum alanı tek tek elle iş kuralına karşı doğrulanmadı (yalnız denetçinin verdiği 3 karşı örnek ve gerçek 545 yanıt örneklemesi doğrulandı); kalan enum'ların tamamının doğruluğu iddia edilmiyor.

## Final paket üzerinde koşulan testler (build 13e1b23977dc)

| Grup | Sonuç | Kanıt |
|---|---|---|
| Denetçinin edge.cjs (R01–R03), paketin DOLU_DEMO web paketiyle | 3/3 (önce 0/3) | fe-paket/edge-results.json |
| Denetçinin contract-edge.mts (R04) | 3/3 (önce 0/3) | fe-paket/contract-edge-results.json |
| Bağımsız N01–N03 | 3/3 | fe-paket/independent-results.json |
| Önceki denetçi tarayıcı senaryoları | 26/27; LOGIN-ENTER belgeli istisna | fe-paket/ui-results.json |
| Ek tarayıcı regresyonları | 63/63 | fe-paket/ui-regresyon-sonuc.json |
| API istemcisi (denetçi 5, ek 10) | 5/5, 10/10 | fe-paket/api-client-*.json |
| Yetki kural sözleşmesi; DTO ⊆ sözleşme + fixture | geçti; 17 uç + 5 fixture, 0 uyumsuzluk | fe-kabul-paket.log |
| API entegrasyonu (gerçek PostgreSQL + HTTP) + sözleşme doğrulaması | 41/41; 545 gerçek yanıt, 0 sapma; sözleşme güncel | api-npm-test.log |
| Domain | 70/70 | domain-test.log |
| BOŞ paket index.html'den gerçek sunucu turu | 51/51 | tur.log |
| DOLU demo duman testi (iki ortam aynı anda) | 8/8 | demo-smoke.log |
| Temiz kurulum (ZIP'ten, node_modules ve fixture yok): domain ci+test, web ci+build, API ci+typecheck+build, boş veritabanına 12 migrasyon, sözleşme --check | hepsi 0 çıkış kodu | temiz-kurulum.log |

**Build hatası ve düzeltmesi.** İlk paketleme, sürüm dizesini (2.7.5) içermeyen eski derlenmiş `apps/api/dist` üzerinden yapıldığı için BOŞ turu `/api/ready` yanıtında `"version":"2.7.4"` gösterdi. API yeniden derlenip paket sıfırdan üretildi; final build (13e1b23977dc) hem kapanış manifestinde hem DOLU/BOŞ runtime manifestlerinde hem çalışan sunucunun yanıtında tutarlı.
