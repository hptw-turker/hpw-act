import json
from playwright.sync_api import sync_playwright
src=open('/tmp/k2/capture.py',encoding='utf-8').read(); exec(src[:src.index('with sync_playwright() as p:')])
boxes.update(json.load(open('/tmp/k2/boxes.json')))
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1360,'height':860}, device_scale_factor=1.5); pg=ctx.new_page(); pg.set_default_timeout(6000); pg.on('dialog', lambda d: d.dismiss())
    go(pg,'aksiyonlar'); pick(pg,'2026-ANA','SB002'); pg.get_by_role('button',name='aç',exact=True).first.click(); pg.wait_for_timeout(1500); pg.get_by_role('button',name='AI planını gör',exact=True).click(); pg.wait_for_timeout(1500)
    shot(pg,'A05-ai-planini-gor',[('Taslak (planlandı) durumu ve AI kökeni notu','css=[data-testid=action-draft]'),('Başlat','btn=Başlat'),('AI planını gizle / gör','btn=AI planını gizle'),('Öneri uyarısı (gerçekleşme ya da kanıt değildir)','css=[data-testid=action-ai-plan] > div > p.caption'),('Plandaki aksiyon kartı (amaç, adımlar, göstergeler, kanıt, risk)','css=[data-testid=action-ai-plan] .ai-card')],anchor='btn=Başlat',dy=-300)
    b.close()
json.dump(boxes,open('/tmp/k2/boxes.json','w'),ensure_ascii=False,indent=1); print('\n'.join(log))
