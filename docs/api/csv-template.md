# CSV sonuç şablonu (survey-agnostic içe alma)

Sütunlar (UTF-8, `;` veya `,` ayraç otomatik algılanır, ondalık `.` veya `,`):

```
cycle_id;unit_external_id;unit_name;parent_external_id;dimension;item_code;item_version;metric_type;raw_score;scale_min;scale_max;favorable_pct;n;response_rate;population;aggregation_weight
2026-ANA;SUBE-KONAK;Konak Şubesi;ALAN-IZMIR;Güven;Q7;3;likert5;2.96;1;5;;27;0.87;31;27
2026-ANA;SUBE-KONAK;Konak Şubesi;ALAN-IZMIR;;ENPS;1;enps;18;-100;100;;27;0.87;31
```

Kurallar
- `parent_external_id` boş = kök; ilişkiler roll-up hiyerarşisine yazılır (diğer ilişkiler ayrı dosya: `relationships.csv`: from;to;type;group).
- `metric_type ∈ {likert5, likert7, favorable_pct, enps, index}`; `favorable_pct` doluysa `raw_score` boş olabilir.
- `aggregation_weight` HPTW üst skor hesabındaki resmî ağırlıktır (yanıt sayısı ise n ile aynı); boşsa içe alma uyarı verir ve n varsayılır, ama mutabakat testi (T-57) geçmeden onaylanmaz.
- `n < 5` satırlar otomatik baskılanır; `population` çalışan sayısı (kohort ağırlığı için yanıt sayısı `n` kullanılır).
- `item_version` bilinmiyorsa boş; sistem son sürümü varsayar ve `equivalence` için Metodolog onayı ister.
- Aynı (cycle, unit, item) tekrarı `quality_flags += duplicate`.
