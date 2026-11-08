# M03 — Analiz, önceliklendirme, segmentasyon

**Mimari bölüm:** 7 · **Faz:** 0

## Amaç
Sinyalleri hesaplar, öncelik skoru üretir, sorunun yerini sınıflandırır, birimleri A–D segmentlerine ayırır, relevance önerisi çıkarır.

## Nesneler
PrioritySignal (hesaplanmış), FocusArea, SegmentAssignment, RelevanceProposal.

## Kurallar ve algoritmalar
- Sinyaller: Gap, Trend (karşılaştırılabilirlik ağırlıklı), RelativeGap, BenchmarkGap, Breadth, Impact (Advanced mod yoksa tahmini, etiketli), Controllability (ResponsibilityMap), ActionLoad, Confidence.
- v2.3: stratejik önem ayrı eksen (şiddete girmez, sıralamayı etkiler); veri güveni kullanıcıya Düşük/Orta/Yüksek etiketiyle.
- v2.2 (ADR-0017): PriorityAssessment dört eksen — Şiddet (need .35, trend .20, göreli açık .15, genişlik .15, etki .10, strateji .05), Veri güveni f(n, yanıt oranı, kalite, tarihsel kararlılık), Kontrol edilebilirlik (ResponsibilityMap), İş yükü (WorkloadIndex). `assessPriority()`.
- Eşikler (başlangıç, tenant ayarı): şiddet ≥75 kritik, 55–74 önerilen, 30–54 izle, <30 yok; "iyi + hızlı bozulma" → önleyici. Karar iki boyutlu: yüksek×yüksek → sayısal hedef + paket; yüksek×düşük → doğrulama gerekli; orta×yüksek → önerilen hedef; düşük → izle/yok.
- Kontrol düşükse sahip hesap veren birim (etkilenen birim ayrı); yük doluysa alternatif sahip / merkezi destek / sonraki dönem; şiddet hiçbir eksenle küçülmez.
- Her birimin kendi öncelik listesi (yerel sorunlar) kurumsal seçimden bağımsız üretilir ve ayrı gösterilir.
- Sorun yeri: etkilenen çalışan payı, yoğunlaşma endeksi, kümelerin ortak kaldıracı → kurumsal / fonksiyonel / yerel / karma.
- Segmentasyon A–D ve relevance türleri (inherited/contribution/support/excluded/monitor) öneri olarak; kullanıcı satır satır değiştirir.

## API (özet; tam sözleşme docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz))
POST /cycles/{id}/analyze (job) · GET /cycles/{id}/priorities?unit= · GET /cycles/{id}/problem-locality?dimension= · GET /targets/{id}/segmentation · GET /targets/{id}/relevance-proposal.

## Olaylar
`Analysis.Completed`, `FocusArea.Proposed`.

## Kabul kriterleri
T-04 ön koşulu; CEO özeti ('%61 etkilenen, %48 yoğunlaşma') üretilir; öncelik hesabı deterministik ve sürümlü.
