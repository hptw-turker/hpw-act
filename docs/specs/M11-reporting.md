# M11 — Raporlama, Control Tower, açıklanabilirlik

**Mimari bölüm:** 15 · **Faz:** 0 minimal scorecard; Control Tower Faz 1–2

## Amaç
Rol bazlı giriş ekranları, scorecard, program sağlığı, Control Tower 12 sorusu, 'Neden 60?' ve 'Neden ben?' açıklamaları, projeksiyon tazeliği.

## Nesneler
Projeksiyonlar (read model): ScorecardRow, ProgramHealth, ControlTowerAnswer, ExplainTarget, ExplainAction.

## Kurallar ve algoritmalar
- Scorecard sütunları ve filtreler mimari 15; iki görünüm: baseline organizasyonu / bugünkü (kohort politikası).
- Control Tower soru → nesne tablosu mimari 15; 'kim tuttu' Outcome × Comparability × ExecutionConfidence.
- Açıklanabilirlik: ExplainTarget AllocationRun'dan (baseline, aralık, katkı, seçenekler); ExplainAction ResponsibilityAllocation + ResponsibilityMap'ten.
- Projeksiyonlar outbox'tan beslenir; `projection_lag_seconds` metriği ve UI tazelik uyarısı (T-35); yazma projeksiyona bağlı değil.
- Baskılanmış değerler projeksiyonda da NULL; türetilmiş çıktılar (hedef, fark, katkı, açıklama) gizlilik kapısından geçer.
- Şube görünümü: yalnız 'yerel gelişim hedefleriniz' (en fazla iki, ikisi de yerel veriden) ve bilgi satırı 'şirket genelindeki yön'; katkı projeksiyonu yalnız bölge/merkez görünümünde; yasaklı terimler docs/design/terminoloji-sozlugu.md. Kontrol kulesi uygulama × sonuç × atıf üç eksenini ayrı gösterir; 'kim tutturamadı' listesi yoktur.
- Genel Müdür görünümü: 'istenen X / desteklenen Y / azami Z' ve uzlaştırma seçenekleri.

## API (özet; tam sözleşme docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz))
GET /me/home (dikkat + özet) · GET /scorecard?cycle=&group=&node=&view=frozen|current · GET /control-tower · GET /targets/{id}/explain · GET /actions/{id}/explain · GET /reports/export (csv|xlsx|pdf).

## Olaylar
(tüketici) tüm domain olayları → projeksiyon güncellemesi.

## Kabul kriterleri
T-35; scorecard baskılanmış değer sızdırmaz (T-06); 'kim tuttu' karşılaştırılabilirlik etiketiyle.
