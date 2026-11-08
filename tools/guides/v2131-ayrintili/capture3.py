import json
from playwright.sync_api import sync_playwright
src=open('/tmp/k2/capture.py',encoding='utf-8').read(); exec(src[:src.index('with sync_playwright() as p:')])
boxes.update(json.load(open('/tmp/k2/boxes.json')))
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1360,'height':860}, device_scale_factor=1.5); pg=ctx.new_page(); pg.set_default_timeout(6000); pg.on('dialog', lambda d: d.dismiss())
    login(pg,'hrbp'); go(pg,'aksiyonlar',2500); pick(pg,'2025-ANA','SB001'); pg.get_by_role('button',name='aç',exact=True).first.click(); pg.wait_for_timeout(1200)
    d=pg.evaluate("()=>({btn:[...document.querySelectorAll('button')].map(e=>e.textContent.trim()).filter(Boolean), caps:[...document.querySelectorAll('p.caption')].map(e=>e.textContent.trim()).filter(t=>/doğrula|Doğrula|iade|İade/i.test(t)).slice(0,6)})"); print(d)
    shot(pg,'B02-hrbp-dogrulama',[('Doğrula (İK / bölge)','btn=Doğrula (İK / bölge)'),('Reddet (iade)','btn=Reddet'),('Doğrulama durumu açıklaması','css=p.caption:has-text("Doğrulama:")'),('Kanıt listesi','th=Tarih'),('Geçerlilik','th=Geçerlilik')],anchor='btn=Doğrula (İK / bölge)',dy=-300)
    b.close()
json.dump(boxes,open('/tmp/k2/boxes.json','w'),ensure_ascii=False,indent=1); print('\n'.join(log))
