# v2.13.1 kılavuz AI ekranları (gerçek ürün; AI içeriği kabul testindeki gerçek gpt-6-sol çıktısının yeniden sunumu). Görüntü ölçüsü önceki kılavuzla aynı.
import requests, json
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:8787'; OUT='/tmp/guide/shots-ai'; PW='Demo-Kullanici-2026'; log=[]
s=requests.Session(); s.post(BASE+'/api/auth/login',json={'email':'ik@saha.demo.hpw-act.local','password':PW}); tid=s.get(BASE+'/api/auth/me').json()['tenantId']
cyc=[c for c in s.get(BASE+f'/api/t/{tid}/cycles').json() if c['code']=='2026-ANA'][0]['id']; uid=[u for u in s.get(BASE+f'/api/t/{tid}/cycles/{cyc}/units').json() if u['code']=='SB002'][0]['id']
def login(pg, email, pw=PW):
    pg.context.clear_cookies(); pg.goto(BASE+'/app.html#/giris'); pg.wait_for_timeout(700); pg.fill('#email',email); pg.fill('#password',pw); pg.get_by_role('button',name='Giriş yap').click(); pg.wait_for_timeout(1800)
def shot(pg, name, sel=None, dy=-90):
    if sel: pg.locator(sel).first.scroll_into_view_if_needed(); pg.evaluate(f'window.scrollBy(0,{dy})'); pg.wait_for_timeout(500)
    pg.screenshot(path=f'{OUT}/{name}.png'); log.append('OK '+name)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1360,'height':860}, device_scale_factor=1.5); pg=ctx.new_page(); pg.set_default_timeout(30000); pg.on('dialog', lambda d: d.accept())
    login(pg,'ik@saha.demo.hpw-act.local'); pg.goto(BASE+f'/app.html#/t/{tid}/'); pg.wait_for_selector('[data-testid=ai-connection]'); pg.wait_for_timeout(800)
    pg.fill('#ai-key','sk-kilavuz-ornek-anahtar-000000000000'); pg.get_by_role('button',name='Bağlantıyı kur',exact=True).click(); pg.wait_for_timeout(1500)
    shot(pg,'A1-openai-baglanti','[data-testid=ai-connection]',-60)
    pg.goto(BASE+f'/app.html#/t/{tid}/hedefler'); pg.wait_for_selector('#cycle'); pg.select_option('#cycle',cyc); pg.wait_for_timeout(600); pg.select_option('#unit',uid); pg.wait_for_timeout(2000)
    pg.select_option('#item','GUR-03'); pg.get_by_role('button',name='Öneriyi gör',exact=True).click(); pg.wait_for_selector('[data-testid=ai-preview]'); pg.wait_for_timeout(1200)
    shot(pg,'A2-hedef-oneri-ai-dugmesi','#item',-160)
    pg.locator('[data-testid=ai-preview]').get_by_role('button',name='✨ Yapay zekâdan yardım al',exact=True).click(); pg.wait_for_selector('[data-testid=ai-preview] [data-testid=ai-panel]',timeout=60000); pg.wait_for_timeout(1000)
    shot(pg,'A3-ai-plani-ust','[data-testid=ai-preview] [data-testid=ai-panel]',-120)
    shot(pg,'A3b-ai-plani-aksiyonlar','[data-testid=ai-preview] [data-testid=ai-action-0]',-160)
    pg.locator('[data-testid=ai-use-target]').click(); pg.wait_for_timeout(600)
    shot(pg,'A4-ai-hedefini-kullan','#val',-260)
    pg.get_by_role('button',name='Öneriyi kabul et',exact=True).click(); pg.wait_for_timeout(4000)
    pg.select_option('#ai-target', [t for t in s.get(BASE+f'/api/t/{tid}/cycles/{cyc}/units/{uid}/targets').json() if t['item_code']=='GUR-03'][0]['id']); pg.wait_for_selector('[data-testid=ai-assist] [data-testid=ai-panel]'); pg.wait_for_timeout(800)
    pg.locator('[data-testid=ai-assist] [data-testid=ai-action-0] input[type=checkbox]').check(); pg.wait_for_timeout(300)
    shot(pg,'A5-aksiyon-aktarimi','[data-testid=ai-assist] [data-testid=ai-use]',-420)
    pg.get_by_role('button',name='Seçilen aksiyonları taslağa aktar',exact=True).click(); pg.wait_for_timeout(3000)
    pg.goto(BASE+f'/app.html#/t/{tid}/aksiyonlar'); pg.wait_for_timeout(1500); pg.select_option('#cycle',cyc); pg.wait_for_timeout(600); pg.select_option('#unit',uid); pg.wait_for_timeout(1800)
    pg.get_by_role('button',name='aç',exact=True).first.click(); pg.wait_for_timeout(1200); pg.get_by_role('button',name='AI planını gör',exact=True).click(); pg.wait_for_timeout(1200)
    shot(pg,'A6-ai-planini-gor','[data-testid=action-draft]',-140)
    b.close()
print('\n'.join(log)); open(f'{OUT}/log.txt','w').write('\n'.join(log))
