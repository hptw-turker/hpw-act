"""v2.13.0 paket görsel kontrolü (gerçek sunucu, gerçek veri): v2.12.1 düzeltmeleri + AI yüzeyleri, 375/390/768/1190/1440 px.
Kullanım: BASE=http://127.0.0.1:8787 OUT=<dizin> [AI=1] python3 gorsel-kontrol.py"""
import requests, os, json
from playwright.sync_api import sync_playwright
B = os.environ.get('BASE', 'http://127.0.0.1:8787'); O = os.environ['OUT']; os.makedirs(O, exist_ok=True); AI = os.environ.get('AI') == '1'
s = requests.Session(); assert s.post(B + '/api/auth/login', json={'email': 'ik@saha.demo.hpw-act.local', 'password': 'Demo-Kullanici-2026'}).status_code == 200; tid = s.get(B + '/api/auth/me').json()['tenantId']
res = {}; ok = True
def over(pg): return pg.evaluate("document.documentElement.scrollWidth") - pg.evaluate("innerWidth")
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W in (375, 390, 768, 1190, 1440):
        ctx = b.new_context(viewport={'width': W, 'height': 900}); pg = ctx.new_page(); r = {}
        pg.goto(B + '/app.html#/giris'); pg.wait_for_selector('h1'); pg.wait_for_timeout(500)
        r['giris_satirlar'] = pg.evaluate("""()=>{const h=document.querySelector('h1');const tn=h.firstChild;const t=tn.textContent;const rg=document.createRange();const out=[];let top=null,cur='';for(let k=0;k<t.length;k++){rg.setStart(tn,k);rg.setEnd(tn,k+1);const rc=rg.getClientRects()[0];if(!rc)continue;if(top===null||Math.abs(rc.top-top)>5){if(cur)out.push(cur);cur='';top=rc.top}cur+=t[k]}out.push(cur);return out}""")
        r['giris_bolunmuyor'] = all(not l.strip() or l.strip().split(' ')[-1] in ('Sonuç', 'bir', 'başlangıçtır.') or l.strip() in ('Sonuç bir', 'başlangıçtır.', 'Sonuç', 'bir başlangıçtır.') for l in r['giris_satirlar']); r['giris_tasma'] = over(pg); pg.screenshot(path=f'{O}/giris-{W}.png')
        ctx.add_cookies([{'name': k, 'value': v, 'domain': '127.0.0.1', 'path': '/'} for k, v in s.cookies.get_dict().items()]); pg.close(); pg = ctx.new_page()
        pg.goto(B + f'/app.html#/t/{tid}/'); pg.wait_for_selector('.steps', timeout=20000); pg.wait_for_timeout(800)
        r['kurulum_adim'] = pg.locator('.steps__row').count(); r['kurulum_tasma'] = over(pg)
        al = pg.evaluate("""()=>{const el=['amb-cycle','amb-item','amb-val','amb-why'].map(i=>document.getElementById(i));if(el.some(x=>!x))return null;const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='İstek öner');const lab=document.getElementById('amb-val').closest('label').querySelector('.field__label');return {alt:el.map(e=>Math.round(e.getBoundingClientRect().bottom)),dugme:btn?Math.round(btn.getBoundingClientRect().bottom):null,etiket_yuks:Math.round(lab.getBoundingClientRect().height)}}""")
        r['kurumsal'] = al; r['ai_baglanti_paneli'] = pg.locator('[data-testid=ai-connection]').count(); r['ai_baglanti_metni'] = pg.locator('[data-testid=ai-connection]').inner_text()[:160] if r['ai_baglanti_paneli'] else None
        pg.screenshot(path=f'{O}/kurulum-{W}.png', full_page=True)
        pg.goto(B + f'/app.html#/t/{tid}/birimler'); pg.wait_for_selector('select', timeout=15000); sels = pg.locator('select'); sels.nth(0).select_option(label='2026-ANA'); pg.wait_for_timeout(800)
        opts = sels.nth(1).locator('option'); val = [opts.nth(i).get_attribute('value') for i in range(opts.count()) if 'ALT001' in opts.nth(i).inner_text()][0]; sels.nth(1).select_option(val); pg.wait_for_selector('h1.h2', timeout=20000); pg.wait_for_timeout(600)
        r['birim'] = pg.evaluate("""()=>{const h=document.querySelector('h1.h2');const p=h.nextElementSibling;return {bosluk:Math.round(p.getBoundingClientRect().top-h.getBoundingClientRect().bottom),topbox:document.body.innerText.includes('TOP BOX')||document.body.innerText.includes('Top Box'),eski:document.body.innerText.toLowerCase().includes('olumlu yanıt oranı')}}"""); r['birim_tasma'] = over(pg); pg.screenshot(path=f'{O}/birim-{W}.png')
        acts = s.get(B + f'/api/t/{tid}/actions').json(); cyc = acts[0]['cycle_id']; uid = acts[0]['unit_id']  # hedefi olan birim ve dönem
        pg.goto(B + f'/app.html#/t/{tid}/hedefler'); pg.wait_for_selector('select', timeout=15000); sels = pg.locator('select'); sels.nth(0).select_option(cyc); pg.wait_for_timeout(500); sels.nth(1).select_option(uid); pg.wait_for_timeout(1500)
        r['hedef_ai_blogu'] = pg.locator('[data-testid=ai-assist]').count(); r['hedef_ai_pasif_aciklama'] = pg.locator('[data-testid=ai-unavailable]').count(); r['hedef_tasma'] = over(pg)
        if AI and r['hedef_ai_blogu']:
            opt = pg.locator('#ai-target option').nth(1).get_attribute('value'); pg.select_option('#ai-target', opt); pg.wait_for_timeout(800)
            if not pg.locator('[data-testid=ai-panel]').count(): pg.get_by_role('button', name='✨ Yapay zekâdan yardım al', exact=True).click(); pg.locator('[data-testid=ai-panel]').wait_for(timeout=30000)
            pg.wait_for_timeout(400); r['ai_panel_tasma'] = over(pg); r['ai_bolum'] = pg.locator('.ai-sec').count(); pg.locator('[data-testid=ai-panel]').screenshot(path=f'{O}/ai-panel-{W}.png')
        pg.screenshot(path=f'{O}/hedefler-{W}.png', full_page=True)
        e = b.new_context(viewport={'width': W, 'height': 900}); ep = e.new_page(); es = requests.Session(); es.post(B + '/api/auth/login', json={'email': 'gmy01.yldz@saha.demo.hpw-act.local', 'password': 'Demo-Kullanici-2026'})
        e.add_cookies([{'name': k, 'value': v, 'domain': '127.0.0.1', 'path': '/'} for k, v in es.cookies.get_dict().items()]); ep.goto(B + f'/app.html#/t/{tid}/'); ep.wait_for_selector('[data-testid=exec-karar]', timeout=20000); ep.wait_for_timeout(600)
        r['exec_kartlar'] = ep.locator('[data-testid^=exec-]').count(); r['exec_tasma'] = over(ep); ep.screenshot(path=f'{O}/yonetim-{W}.png', full_page=True); e.close()
        res[W] = r; ctx.close()
    b.close()
json.dump(res, open(f'{O}/olcumler.json', 'w'), ensure_ascii=False, indent=1)
for W, r in res.items():
    k = r['kurumsal']; hiza = bool(k) and k['etiket_yuks'] <= 18 and (W < 1190 or (len(set(k['alt'])) == 1 and k['dugme'] == k['alt'][0]))
    tasma = max(r['giris_tasma'], r['kurulum_tasma'], r['birim_tasma'], r['hedef_tasma'], r.get('ai_panel_tasma', 0), r.get('exec_tasma', 0)) <= 1 and r.get('exec_kartlar') == 3
    good = r['giris_bolunmuyor'] and r['kurulum_adim'] == 5 and hiza and r['birim']['bosluk'] >= 0 and r['birim']['topbox'] and not r['birim']['eski'] and tasma and r['ai_baglanti_paneli'] == 1 and r['hedef_ai_blogu'] == 1 and (AI or r['hedef_ai_pasif_aciklama'] == 1) and (not AI or r.get('ai_bolum') == 9)
    ok = ok and good; print(W, 'PASS' if good else 'FAIL', json.dumps({'satir': r['giris_satirlar'], 'hiza': hiza, 'tasma': tasma, 'bosluk': r['birim']['bosluk'], 'ai_bolum': r.get('ai_bolum')}, ensure_ascii=False))
raise SystemExit(0 if ok else 1)
