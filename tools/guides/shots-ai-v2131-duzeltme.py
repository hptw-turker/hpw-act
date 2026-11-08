import requests
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:8787'; OUT='/tmp/guide/shots-ai'; PW='Demo-Kullanici-2026'; log=[]
s=requests.Session(); s.post(BASE+'/api/auth/login',json={'email':'ik@saha.demo.hpw-act.local','password':PW}); tid=s.get(BASE+'/api/auth/me').json()['tenantId']
cyc=[c for c in s.get(BASE+f'/api/t/{tid}/cycles').json() if c['code']=='2026-ANA'][0]['id']; uid=[u for u in s.get(BASE+f'/api/t/{tid}/cycles/{cyc}/units').json() if u['code']=='SB002'][0]['id']
ltid=[t for t in s.get(BASE+f'/api/t/{tid}/cycles/{cyc}/units/{uid}/targets').json() if t['item_code']=='GUR-03'][0]['id']
def top(pg, sel, dy=-70, block='start'): pg.locator(sel).first.evaluate(f"e=>e.scrollIntoView({{block:'{block}'}})"); pg.evaluate(f'window.scrollBy(0,{dy})'); pg.wait_for_timeout(500)
def shot(pg, name): pg.screenshot(path=f'{OUT}/{name}.png'); log.append('OK '+name)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1360,'height':860}, device_scale_factor=1.5); pg=ctx.new_page(); pg.set_default_timeout(30000)
    pg.context.clear_cookies(); pg.goto(BASE+'/app.html#/giris'); pg.wait_for_timeout(700); pg.fill('#email','ik@saha.demo.hpw-act.local'); pg.fill('#password',PW); pg.get_by_role('button',name='Giriş yap').click(); pg.wait_for_timeout(1800)
    pg.goto(BASE+f'/app.html#/t/{tid}/'); pg.wait_for_selector('[data-testid=ai-connection]'); pg.wait_for_timeout(800); top(pg,'[data-testid=ai-connection]',-120); shot(pg,'A1-openai-baglanti')
    pg.goto(BASE+f'/app.html#/t/{tid}/hedefler'); pg.wait_for_selector('#cycle'); pg.select_option('#cycle',cyc); pg.wait_for_timeout(600); pg.select_option('#unit',uid); pg.wait_for_timeout(2000)
    pg.select_option('#ai-target',ltid); pg.wait_for_selector('[data-testid=ai-assist] [data-testid=ai-panel]'); pg.wait_for_timeout(1000)
    top(pg,'[data-testid=ai-assist]',-40); shot(pg,'A3-ai-plani-ust')
    top(pg,'[data-testid=ai-assist] [data-testid=ai-action-0]',-110); shot(pg,'A3b-ai-plani-aksiyonlar')
    pg.locator('[data-testid=ai-assist] [data-testid=ai-action-1] input[type=checkbox]').check(); pg.wait_for_timeout(300)
    top(pg,'[data-testid=ai-assist] [data-testid=ai-action-1] input[type=checkbox]',0,'center'); shot(pg,'A5a-aksiyon-secimi')
    top(pg,'[data-testid=ai-assist] [data-testid=ai-use]',120,'end'); shot(pg,'A5-aksiyon-aktarimi')
    pg.goto(BASE+f'/app.html#/t/{tid}/aksiyonlar'); pg.wait_for_timeout(1500); pg.select_option('#cycle',cyc); pg.wait_for_timeout(600); pg.select_option('#unit',uid); pg.wait_for_timeout(1800)
    pg.get_by_role('button',name='aç',exact=True).first.click(); pg.wait_for_timeout(1200); pg.get_by_role('button',name='AI planını gör',exact=True).click(); pg.wait_for_timeout(1200)
    top(pg,'[data-testid=action-ai-plan]',-150); shot(pg,'A6-ai-planini-gor')
    b.close()
print('\n'.join(log))
