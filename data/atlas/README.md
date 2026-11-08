# Atlas Holding sentetik veri seti

`pnpm seed:atlas` bu klasöre `org-units.json`, `relationships.json`, `persons.json`, `results-2026-ANA.csv`, `results-2026-ANA.json`, `reorg-events.json`, `scenario.json` üretir. Deterministik (seed 20260922). Gerçek veri değildir.

Üretilen set: 737 birim (400 şube, 35 müdürlük, 200 alt birim, 18 bölge, 54 alan, 4 çağrı merkezi, 6 operasyon merkezi, 3 lojistik, 4 iştirak), ~32.000 çalışan, 2.400 kişi, ~3.350 ilişki (idari/coğrafi/İK/teknoloji grupları + enabled_by), 2026-ANA döneminde 4 boyut + eNPS, `SUBE-KONAK` Güven 49, Ataşehir 74, 25 baskılanacak satır, 5 reorg olayı (biri T-37 için tekrar), 8 ayrılan yönetici, 20 vekâlet. `scenario.json` torture-test vakalarını listeler.
