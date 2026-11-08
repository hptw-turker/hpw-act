import json
from playwright.sync_api import sync_playwright
src=open('/tmp/k2/capture.py',encoding='utf-8').read(); exec(src[:src.index('with sync_playwright() as p:')])
boxes.update(json.load(open('/tmp/k2/boxes.json')))
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1360,'height':860}, device_scale_factor=1.5); pg=ctx.new_page(); pg.set_default_timeout(8000); pg.on('dialog', lambda d: d.dismiss())
    login(pg,'ik'); go(pg,'birimler'); pick(pg,'2026-ANA','SB002')
    shot(pg,'S01c-birim-sonuclari-degerli',[('Dönem','id=cycle'),('Birim','id=unit'),('Başlık: birim · dönem · madde sayısı · yanıt sayısı','css=h1.h2'),('Madde (soru metni ve kodu)','th=Madde'),('Metrik (Top Box)','th=Metrik'),('Değer: birimin Top Box değeri','th=Değer'),('Şirket Δ: birim − şirket farkı','th=Şirket Δ'),('n: yanıt sayısı','th=n'),('Etkileşim alanı','th=Etkileşim'),('Sorumluluk merkezi','th=Sorumluluk merkezi'),('Aday rol','th=Aday rol'),('Karar','th=Karar'),('İlk madde satırı','css=tbody tr')])
    t=pg.evaluate("()=>[...document.querySelectorAll('tbody tr')].slice(0,3).map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim()).join(' | '))"); print('\n'.join(t))
    print('başlık:', pg.locator('h1.h2').inner_text())
    b.close()
json.dump(boxes,open('/tmp/k2/boxes.json','w'),ensure_ascii=False,indent=1); print('\n'.join(log))
