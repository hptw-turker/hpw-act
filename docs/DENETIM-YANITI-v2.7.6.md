# HPW Act v2.7.6 — R04 sözleşme kapanışı (dar kapsam)

Başlangıç: v2.7.5 (13e1b23977dc). Denetçinin `contract-remaining.mts` betiği değiştirilmeden `tools/tests/fe/bagimsiz/` altına alındı; v2.7.5 paketindeki `responses.json` ile koşuldu: **0/4** (`test-ciktilari/v276/baseline/contract-remaining-results.json`). R01–R03 yeniden tasarlanmadı; ekran, marka ve iş kuralı değişmedi.

## Kök neden

`contract-infer.mts` yanıt şemasını yalnız (a) yakalanan örneklerden ve (b) alan ADI ile veritabanı sütunu eşleştirerek üretiyordu. Üç ayrı kusur:
- JSON'da hesaplanan, sütun olmayan alanlar (`measurement_plan.followupCycleCode`, `derivedEstimate`, `official`, `observedAssociation`, `supersededBatch`) örneklerde yalnız null görülünce `{type:'null'}` kalıyordu.
- Boş dizi elemanı tamamlanırken sütunun `ARRAY` türü elemanın türü sayılıyor, `text[]` alanı `array of array` oluyordu (`lever_tags`).
- Adı çakışan alanlarda (status, state, kind, decision, reason, purpose, metric_kind, relationship_type, role, evidence_level, cadence…) enum ya tablolar arası birleşim (v2.7.4) ya da hiç yok (v2.7.5) idi; ikisi de gerçek domain sözleşmesi değildi.

## Düzeltme: uç + JSON yolu + domain kaynağı eşlemesi

Yeni `apps/api/src/contract/domain-map.ts` sözleşmenin kaynağıdır (örnek yakalama yalnız kapsam ve sapma denetimi için kalır). Her kural uç + JSON yolu bazında ve kaynağını belirtir: `column: 'tablo.sütun'` → yalnız o tablonun CHECK kısıtı; `enum` → kod sabitleri (dosya/işlev belirtilir); `freeText` → serbest metin (gerekçe alanları); `schema` → hesaplanan alanın gerçek null/dolu şeması. Toplam **94 kural**, `schema-audit.json`: çözümsüz 0, kullanılmayan kural 0. `contract-infer.mts` ayrıca PostgreSQL dizi sütunlarında `udt_name` üzerinden gerçek eleman türünü çözer (`_text` → `string`).

### Denetçinin 4 karşı örneği → kaynak/test eşlemesi

| JSON yolu | Kaynak | Şema (sonra) | Test |
|---|---|---|---|
| GET targets[].measurement_plan.followupCycleCode | routes/analysis.ts: `followupCycle?.code ?? null` | string \| null | contract-remaining FOLLOWUP-CYCLE; API testi 42 (2027-ANA döneminde açılan hedef → kod dolu) |
| GET aggregates.aggregates[].derivedEstimate | routes/corporate.ts: `complete ? {value, members, label:'derived_estimate', note} : null` | object{value,members,label,note} \| null | contract-remaining AGGREGATE-DERIVED; API testi 42 (resmî toplam/türetilmiş) |
| GET results.rows[].status | result.status CHECK: OBSERVED/SUPPRESSED/OFFICIAL (0002_product.sql) | enum (yalnız result tablosu) | contract-remaining RESULT-INVALID-STATUS; 554 gerçek yanıt |
| POST targets.lever_tags[] | local_target.lever_tags text[] (udt `_text`) | array of string | contract-remaining LEVER-TAGS-TEXT-ARRAY; API testi 42 (`['communication']` yazılıp GET ile okunur) |

### Kalan 6 yalnız-null ve 7 türsüz konum (schema-audit.json) — tek tek

| Konum | Karar | Kaynak |
|---|---|---|
| ambitions/:aid.cohort[].workflow_state | string \| null (gizli satırda null; görünürde cm_ambition_cohort.workflow_state) | routes/corporate.ts okuma-zamanı redaksiyonu |
| aggregates[].official | object{value,definitionVersion,status(result.status),source,label:'official'} \| null | routes/corporate.ts aggregates |
| aggregates[].derivedEstimate | yukarıda | — |
| targets[].measurement_plan.followupCycleCode | yukarıda | — |
| recommendations[].observedAssociation | object{medianChange,sampleSize,…} \| null (yalnız demo verisinde dolu; üretimde null) | routes/analysis.ts recommendations: `config.demoData ? … : null` |
| imports/:jid/commit.applied.applied.supersededBatch | uuid \| null (önceki etkin parti varsa) | importers commit |
| cohort-preview.rule.unitCodes[] | string | routes/corporate.ts cohort rule `unitCodes?: string[]` |
| control-tower.riskyUnits[] | object{unit_code,name,overdue,awaiting_verify} | routes/corporate.ts risky SQL alias'ları |
| results.rows[].distribution[], benchmarks[] | object (rezerve; mevcut sürümde her zaman boş) | routes/analysis.ts results `distribution: [], benchmarks: []` (P1-10) — gerçekten boş, gerekçe: henüz üretilmiyor |
| imports[].preview.indexReconciliation[] | object{unit,code,official,computed,…} | importer results preview |
| instruments.warnings[] | Issue{severity(error\|warning),sheet,row,col,code,message} | domain-core Issue |
| targets.lever_tags[][] | düzeltildi: text[] elemanı string | db/migrations local_target.lever_tags |

### Belirsiz 11 ad → uç/alan bazında çözüm (özet)

`column` kuralı ile tabloya bağlanan yol sayısı: 46; kod sabiti/serbest metin kuralları: 48. Örnekler: results.rows[].status → result.status; targets[].status → local_target.status; cycles[].status → survey_cycle.status; corporate/queue[].kind/state → cm_central_queue; deployments[].status → cm_master_action_deployment; imports[].state/kind → import_job; users[].invitation.status → invitation; actions/:aid.verification.state → evidence_verification; assessment.decision → priority_assessment.decision; followup.review.decision → comparability_review.decision; attention[].kind → kod sabiti (evidence/decision); gerekçe alanları (`reason`) → serbest metin; evidence_level → evidence_requirement CHECK; cadence → rota gövde şeması sabitleri. Tam liste: `apps/api/src/contract/domain-map.ts` (her satırda kaynak).

## Kapılar (standart komutlarda)

- `apps/api npm test`: 42 gerçek PostgreSQL/HTTP testi (42 = dolu varyantlar: takip dönemi kodu, dolu lever_tags, iptal gerekçesi, resmî toplam) → 554 gerçek yanıt sözleşmeye karşı (0 sapma) → OpenAPI güncel → **kapsam denetimi** (yalnız-null 0, türsüz 0, çözümsüz 0, kullanılmayan kural 0).
- `apps/web npm test`: denetçinin contract-edge (3) ve contract-remaining (4) karşı örnekleri + kapsam denetimi + DTO ⊆ sözleşme + fixture uyumu; tarayıcı paketleri (27/26+istisna, 63, N01–N03, R01–R03) korunuyor.
- Fixture düzeltmesi: `harness.cjs` sonuç satırındaki `status:'valid'` gerçek değer değildi; kaynağında `OBSERVED` yapıldı (sessiz dönüştürme yok).

## Bilinçli sınırlar

- `distribution[]` ve `benchmarks[]` mevcut sürümde her zaman boş (rezerve alan); şema `object` olarak işaretli, iç yapısı üretilmediği için tanımlanmadı.
- `observedAssociation` yalnız demo verisinde dolar; gerçek üretimde null. Şema iki durumu da kapsar.
- Enum kaynağı tablo CHECK kısıtı olan alanlarda kısıt değişirse `contract:infer` yeniden üretilmeli; `openapi-gen --check` eskimeyi yakalar.


## Final paket üzerinde koşulan testler (build 3071cd35d74b)

| Grup | Sonuç | Kanıt |
|---|---|---|
| Denetçinin contract-remaining.mts (R04, 4 karşı örnek) | 4/4 (önce 0/4) | fe-paket/contract-remaining-results.json |
| Denetçinin contract-edge.mts (önceki 3) | 3/3 | fe-paket/contract-edge-results.json |
| Sözleşme kapsam denetimi (yalnız-null / türsüz / çözümsüz / kullanılmayan kural) | 0 / 0 / 0 / 0 | fe-kabul-paket.log |
| Bağımsız N01–N03 ve R01–R03 (edge) | 3/3, 3/3 | fe-paket/*.json |
| Denetçi tarayıcı 27 / ek 63 / API istemcisi 5+10 / yetki sözleşmesi / DTO⊆sözleşme | 26/27 (LOGIN-ENTER belgeli), 63/63, 5/5, 10/10, geçti, 17 uç + 5 fixture 0 uyumsuzluk | fe-kabul-paket.log |
| API entegrasyonu (gerçek PostgreSQL + HTTP): 42 test (42: dolu takip dönemi kodu, dolu lever_tags, iptal gerekçesi, resmî toplam) | 42/42; 554 gerçek yanıt, 0 sapma; OpenAPI güncel; kapsam denetimi 0 sorun | api-npm-test.log |
| Domain | 70/70 | domain-test.log |
| BOŞ paket gerçek sunucu turu / DOLU demo duman | 51/51 / 8/8 | tur.log, demo-smoke.log |
| Temiz kurulum (ZIP'ten): domain ci+test, web ci+build (fixture prebuild), API ci+typecheck+build, boş DB'ye 12 migrasyon, sözleşme --check, kapsam denetimi | hepsi 0 | temiz-kurulum.log |

Koşulmayan: Mac/Safari ve Firefox (ortamda yok). Kılavuzlar: bu turda ekran değişmedi; v2.7.4 kılavuzları geçerli. Canlıya çıkış kapıları (HTTPS/Mac, Docker, SMTP, upload güvenliği, retention, yedekten dönüş, yük) backend hazırlığından ayrı ve açık.

**Son düzeltme (aynı build).** `openapi-urun.json` içindeki `info.version` etiketi üretecin sabit varsayılanı yüzünden 2.7.4 kalmıştı; üreteç artık sürümü `server.ts`'ten okuyor (2.7.6). Bu yalnız belge etiketi değişikliğidir: çalışma zamanı dosyaları değişmediği için build kimliği (3071cd35d74b) aynı kaldı; paket bu düzeltmeyle yeniden üretildi, SHA-256 değeri yeni ZIP için güncellendi.
