# ADR-0040: Anket-agnostik enstrüman, sonuç paketi formatı ve panel türetme

**Durum:** Kabul edildi (v2.4, 24.09.2026)

## Karar
Sistem sabit bir anket varsaymaz. Enstrüman sürümlü bir nesnedir (`instrument_version` + `instrument_dimension` + `instrument_item` + `instrument_index`); referans HPTW-CBA 2026-v3'tür (çekirdek 15 madde sabit, Ekosistem 15 boyut × 4 madde isteğe bağlı, özel madde serbest). Sonuçlar **hpw-act-result-bundle v1** formatında yüklenir: manifest.json, instrument.csv, results_item.csv (yanıt dağılımıyla), results_index.csv (resmî indeks), benchmarks.csv. Sistem paketi çözümler (`parseBundle`), enstrümanı algılar (`detectInstrument`: çıkarılan boyutlar, özel maddeler, modüller, ölçekler, eksik çekirdek) ve panelleri türetir (`derivePanels`). Top Box dağılımdan yeniden hesaplanır ve verilenle çelişirse paket reddedilir; resmî indeks ile madde ortalaması 0,15 içinde eşleşmezse paket yayımlanamaz; gizli birim pakette bile sayı taşımaz. Kalite bayrağı ile red ayrıdır: format ve tutarlılık hataları reddedilir, içerik anomalileri bayraklanır.

## Gerekçe
Şirketler boyut çıkarıp madde ekliyor; paneller elle kurulursa her müşteri ayrı ürün olur. Format önceden belli olursa hem HPTW'nin export'u hem müşteri CSV'si aynı yoldan girer ve eşleme kararı sistemde kalır.

## Sonuçlar
"Boyut yoksa panel yok"; "NPS maddesi yoksa NPS paneli yok"; özel maddeler benchmark'sız. Metrik tanımları paket yayımlanınca madde başına açılır. Enstrüman sürümü değişince madde sürümü ve denklik derecesi (identical/equivalent/changed) karşılaştırılabilirliğe girer.

## Kanıt
`packages/domain-core/src/instrument/bundle.ts`, `test/fixtures/*`, `test/instrument.test.ts` T-70..T-74; SQL enstrüman tabloları, `result_distribution`, `benchmark`, `import_batch.detection`; `docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz)` /cycles/{id}/bundles, /instruments/{id}/panels; prototip `Import.tsx`.
