# -*- coding: utf-8 -*-
"""Yasaklı arayüz terimleri taraması (ADR-0032, docs/design/terminoloji-sozlugu.md).
Kaynak: apps/web/src (tsx, ts, json), tools/guides/content.py, docs/design. Çıkış kodu 1 = ihlal."""
import re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
BANNED = [r"düşen pay", r"payınız", r"senden beklenen", r"kurumsal olarak sizden", r"dağıtımı hesapla", r"hedef dağıtımı", r"\bkota\b", r"\bquota\b",
          r"nedensel güven", r"puan getirdi", r"yine de hedef (ve aksiyon )?alabilir", r"iki hedef", r"katkı tahmini", r"veri güveni\s*%"]
files = list((ROOT/'apps/web/src').rglob('*.tsx')) + list((ROOT/'apps/web/src').rglob('*.ts')) + [ROOT/'apps/web/src/i18n/tr.json', ROOT/'tools/guides/content.py']
bad = 0
for f in files:
    txt = f.read_text(encoding='utf-8')
    for pat in BANNED:
        for m in re.finditer(pat, txt, re.I):
            line = txt[:m.start()].count('\n') + 1
            # sözlük dosyası ve yasak listesinin kendisi hariç
            if 'terminoloji' in f.name or 'ui-kota-dili' in f.name: continue
            print(f"{f.relative_to(ROOT)}:{line}: '{m.group(0)}'"); bad += 1
print('KOTA-DİLİ OK' if not bad else f'KOTA-DİLİ: {bad} ihlal'); sys.exit(1 if bad else 0)
