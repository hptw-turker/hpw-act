# M01 — Sonuç alma ve eşleme (Ingestion & Mapping)

**Mimari bölüm:** 6 · **Faz:** 0

## Amaç
HPTW native, CSV/Excel ve generic API'den sonuçları alır; maddeleri sürümlü kataloğa, birimleri organizasyon grafına eşler; normalize eder; gizlilik ve baskılama uygular; veri kalite bayrakları üretir.

## Nesneler
SurveyCycle, SurveySource, ItemCatalog/ItemVersion, ItemMapping, Result, Benchmark.

## Kurallar ve algoritmalar
- Normalize: likert5 → (raw−1)/4×100; favorable_pct olduğu gibi; enps ham + ayrı normalized. `raw_score, scale_min, scale_max, metric_type` her zaman saklanır.
- Baskılama: `n < threshold(score=5, comments=10)` → suppressed=true, istemciye NULL. Üst birim çıkarım koruması: üst birim ile alt birimlerin farkından küçük birimin skoru türetilebiliyorsa ikincil baskılama.
- Metrik modeli (ADR-0025): sonuçlar `metric_version`'a bağlanır (item | dimension | index | enps); puanlama kuralı sürümü sonuç dosyasında gelir.
- Madde eşleme: dış madde → MetricVersion; eşlenemeyen "yerel madde", kıyaslamaya girmez. Sürüm değişimi `equivalence_to_previous ∈ {identical, equivalent, changed}` zorunlu (Metodolog).
- Veri kalitesi: eksik birim, ölçek dışı, negatif n, çift kayıt, yanıt oranı %40+ düşüş, sürüm uyuşmazlığı → `quality_flags[]`; satır reddedilmez.
- Roll-up: yalnız dönemin roll-up hiyerarşisinde; `rollup_source` işaretli. `aggregation_weight` zorunlu alan (HPTW resmî ağırlığı); içe alma sonrası üst skor mutabakat testi (T-57) çalışır, tutmuyorsa içe alma 'kalite uyarısı' ile bekletilir.
- İçe alma atomik ve yeniden başlatılabilir toplu iştir (WorkflowInstance); 1M satır hedefi.

## API (özet; tam sözleşme docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz))
POST /cycles · POST /cycles/{id}/imports (multipart csv | json native) → import job · GET /imports/{id} (durum, kalite raporu) · POST /imports/{id}/mappings (madde/birim eşleme kararları) · POST /imports/{id}/commit · GET /units/{id}/results?cycle= (baskılanmış NULL).

## Olaylar
`Import.Received`, `Import.Validated`, `Import.Committed`, `Result.Suppressed`, `ItemVersion.Created`.

## Kabul kriterleri
T-06 (baskılanmış değer sızmaz), T-29 (madde değişimi), T-46 (1M satır atomik, çift yok). CSV şablonu `docs/api/csv-template.md`.
