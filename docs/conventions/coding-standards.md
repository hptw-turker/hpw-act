# Kodlama standartları

## Adlandırma
- Tanımlayıcılar İngilizce, mimari belgedeki adlarla birebir: `OrgUnit`, `TargetRelationship`, `local_execution`, `evidence_pending`.
- Veritabanı: snake_case tablo/sütun; enum'lar Postgres `text` + CHECK (migrasyon kolaylığı).
- Olay adları `Aggregate.Event`, geçmiş zaman: `Target.Approved`, `Action.EvidenceSubmitted`, `Reorg.Applied`.

## Türkçe karakter
- `toUpperCase/toLowerCase` yasak (i/İ, ı/I). `trUpper/trLower` kullan. `pnpm tr-kontrol` CI'da zorunlu.
- Kullanıcıya görünen tüm metinler `apps/web/src/i18n/tr.json` (ve en/ar) kataloğunda. Kodda Türkçe sabit string yok.
- Sıralama/arama `tr-TR` collation; istemcide `Intl.Collator('tr-TR')`.

## Komut zarfı (her yazma isteği)
Başlıklar: `Idempotency-Key` (uuid v7 = command_id), `If-Match` (aggregate version), `X-Correlation-Id`, `X-Causation-Id`. `actor` ve `acting_for` sunucu tarafında oturumdan ve Delegation'dan türetilir, istemciden alınmaz.
Handler sırası: doğrula → command_log kontrol (varsa önceki sonucu döndür) → aggregate yükle, `version === If-Match` değilse 409 `{currentVersion, yourVersion, changedBy, changedFields}` → domain fonksiyonu → tek transaction'da yaz (+version, outbox, audit, command_log) → 200/201.

## Olay zarfı
`{ event_id, event_type, aggregate_type, aggregate_id, aggregate_version, tenant_id, occurred_at, correlation_id, causation_id, payload }`. Tüketici `processed_events(event_id)` ile tekilleştirir. 5 başarısız denemeden sonra DLQ; replay `pnpm events:replay --from <id>`.

## Durum makineleri
Geçişler tek kaynaktan: `packages/domain-core/src/state/*.ts`. Servisler doğrudan durum yazmaz, `transition(entity, event)` çağırır.

## Sayısal
- Skorlar `numeric(5,2)`; para `bigint` kuruş.
- Yüzde 0–100 (`*_pct`), oran 0–1 (`*_ratio`).

## Test
- domain-core: `node --test` ile, her fonksiyon için sınır ve hata durumları.
- Kabul testleri T-xx: `docs/testing`. Her PR açıklamasında kapsanan T-xx listesi.
- Sentetik veri: `pnpm seed:atlas`; gerçek müşteri verisi depoya girmez.

## Güvenlik
- Baskılanmış skor sunucuda `null` + `suppressed=true` olarak döner; istemci hiçbir zaman ham değeri almaz.
- Politika kararları `packages/policy` üzerinden; controller'da rol kontrolü yazılmaz.
- Kanıt dosyaları: yükleme anında SHA-256, virüs taraması, saklama sınıfı; doğrudan URL yok, imzalı ve süreli bağlantı.
