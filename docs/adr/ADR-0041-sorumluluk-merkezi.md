# ADR-0041: Maddenin sorumluluk merkezi ve etkileşim alanı

**Durum:** Kabul edildi (v2.4, 24.09.2026)

## Karar
Her madde bir **etkileşim alanı** (işim, yöneticim, çalışma arkadaşlarım, işveren markası; ek: sistem/politika, kişisel eğilim, sonuç) ve bir **sorumluluk merkezi** taşır: `line_manager`, `team`, `hr_policy`, `talent_system`, `central_function` (kaldıraç etiketiyle IT / tesis / operasyon planlama / İSG), `top_management`, `employer_brand`, `outcome`, `individual`. Sorumluluk merkezi kontrol edilebilirliği ve "müdahaleye yetkili rolü" belirler; "sonucu izleyen rol" her zaman birimin yöneticisidir (ADR-0037). Varsayılan eşleme domain'dedir (`rolesForItem`, `CENTER_LABEL`); tenant kurulumunda `responsibility_center_role` ile şirketin rollerine bağlanır. Eşleme metodoloji kararıdır: HPTW metodoloji ekibi referans enstrümandaki eşlemeyi gözden geçirir ve onaylar; özel maddelerde şirket İK'sı HPTW danışmanıyla belirler.

## Gerekçe
"Yöneticim bana bireysel ilgi gösterir" şubede, "hak ettiğim pozisyonlara geleceğime inanıyorum" kariyer sisteminde, "ani iş yükü artışlarında hızlı çözüm üretiliyor" operasyon planlamada çözülür. Sorumluluk merkezi olmadan öncelik sahibi bulunamaz ve şube müdürü kontrolü dışındaki maddelerden sorumlu tutulur.

## Açık nokta
Referans eşlemedeki tartışmalı maddeler (ör. POZ-03 "yöneticilerime güven duyuyorum" → üst yönetim; ISG-03 "iş yükü dengeli dağıtılıyor" → birim yöneticisi; CES-01 eşit davranılır → İK politikası) metodoloji ekibinin onayına bağlıdır.

## Kanıt
`packages/domain-core/src/instrument/{hptw-2026,responsibility}.ts`; `test/instrument.test.ts` T-76; SQL `instrument_item.responsibility_center`, `responsibility_center_role`.
