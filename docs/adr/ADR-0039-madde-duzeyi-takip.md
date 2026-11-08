# ADR-0039: Takip birimi boyut değil MADDE

**Durum:** Kabul edildi (v2.4, 24.09.2026)

## Karar
Öncelik, yerel hedef, aksiyon, kanıt ve sonuç yalnız `item` metriğine bağlanır. Boyut ve indeks türetilmiş toplamdır: görünüm, karşılaştırma ve projeksiyon için; hiçbir hedef, aksiyon ya da kanıt boyuta bağlanmaz (`assertTrackable`, SQL `local_target.metric_kind = 'item'`, `priority_assessment.metric_kind = 'item'`). Kurumsal istenen değer madde ya da sertifikasyon indeksi (Wellbeing Index, Bağlılık) üzerinde konabilir; indeks ambition'ı madde hedeflerinin resmî toplama kuralıyla projeksiyonuyla uzlaştırılır. Bağlılık maddeleri (`outcome`) ve kişisel eğilim maddeleri (`individual`) hedef almaz; sonuç ve izleme alanıdır.

## Gerekçe
HPTW enstrümanında aynı boyutun iki maddesi farklı deneyim alanına, farklı sorumluluk merkezine ve farklı kontrol edilebilirliğe gider (Gurur: GUR-04 işveren markası 93, GUR-03 kariyer sistemi 61, GUR-01 yönetici 60). Boyut ortalaması bunu gizler ve yanlış sahibe yanlış aksiyon verdirir. Şirketler boyut çıkarıp madde ekleyebildiği için boyut sabit bir takip birimi de değildir.

## Sonuçlar
Yerel hedef sayısı (≤2) ve aksiyon sayısı (≤3) madde başına değil birim başınadır; program en öncelikli hedeflenebilir maddeleri seçer. Karne ve Control Tower madde düzeyinde okur, boyut özetini "yayılımı gizler" notuyla verir. Aksiyon kütüphanesi şablonları madde kodlarına bağlanır (`targetMetrics: ['GUR-03', …]`).

## Kanıt
`packages/domain-core/src/instrument/`; `test/instrument.test.ts` T-75, T-76; `apps/web/src/api/items.ts`; mimari 6.0, 7.2.
