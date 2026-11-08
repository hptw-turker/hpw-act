"""P0-2 tarayıcı testi (final ZIP, BOŞ, tur sonrası veri): hızlı çift tık ve bağlantı kesilmesi → aynı Idempotency-Key, DB iş etkisi bir kez."""
import re, os, glob, json, requests
from playwright.sync_api import sync_playwright
BASE='http://localhost:8788'; MAIL='/tmp/teslim/HPW_Act_TESLIMAT_v2.6.5/BOS_BASLANGIC/CALISTIRMA/mail-bos'; out=[]
def ok(n,c,note=''): out.append({'adim':n,'sonuc':'GEÇTİ' if c else 'KALDI','not':note}); print('OK  ' if c else 'FAIL', n, note[:150]); assert c, n
s=requests.Session(); s.post(BASE+'/api/auth/login', json={'email':'admin@hpw.bos.test','password':'Bos-Admin-2026'}); tid=[x for x in s.get(BASE+'/api/platform/tenants').json() if x['code'].startswith('ALFA')][0]['id']; s.post(BASE+'/api/auth/switch-tenant', json={'tenantId':tid})
cycles=s.get(f'{BASE}/api/t/{tid}/cycles').json(); c25=[c for c in cycles if c['code']=='2026-ANA'][0]; units=s.get(f'{BASE}/api/t/{tid}/cycles/{c25["id"]}/units').json(); bornova=[u for u in units if u['code']=='BORNOVA'][0]
before=len(s.get(f'{BASE}/api/t/{tid}/cycles/{c25["id"]}/units/{bornova["id"]}/targets').json())
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1440,'height':1000}); pg=ctx.new_page(); pg.set_default_timeout(20000); keys=[]
    pg.on('request', lambda r: keys.append((r.url.split('/api/')[-1][:160], r.headers.get('idempotency-key'))) if r.method=='POST' and '/api/t/' in r.url else None)
    pg.goto(BASE+'/#/giris'); pg.fill('#email','admin@hpw.bos.test'); pg.fill('#password','Bos-Admin-2026'); pg.get_by_role('button',name='Giriş yap').click(); pg.wait_for_url(re.compile('#/t/|#/platform')); pg.goto(f'{BASE}/#/platform'); pg.wait_for_timeout(1000)
    pg.locator('table').first.locator('tbody tr').filter(has_text='ALFA').get_by_role('button',name='Aç').click(); pg.wait_for_url(re.compile('#/t/')); pg.goto(f'{BASE}/#/t/{tid}/hedefler?unit={bornova["id"]}&cycle={c25["id"]}'); pg.wait_for_timeout(1500)
    if not pg.locator('#unit').input_value(): pg.select_option('#unit', index=1); pg.wait_for_timeout(800)
    bornova={'id': pg.locator('#unit').input_value()}; before=len(s.get(f'{BASE}/api/t/{tid}/cycles/{c25["id"]}/units/{bornova["id"]}/targets').json())
    pg.select_option('#item', index=2); pg.wait_for_timeout(500)
    # hızlı çift tık: Öneriyi gör → kabul et
    pg.get_by_role('button', name='Öneriyi gör').click(); pg.wait_for_timeout(1200); btn=pg.get_by_role('button', name='Öneriyi kabul et'); keys.clear(); btn.dblclick(); pg.wait_for_timeout(2500)
    tk=[k for u,k in keys if u.startswith('t/') and 'targets' in u and 'preview' not in u]; print('KEYS', json.dumps(keys)[:400]); ok('1 çift tık: en fazla bir istek ya da aynı anahtar', len(set(tk))<=1 and len(tk)>=1, json.dumps(tk))
    after=len(s.get(f'{BASE}/api/t/{tid}/cycles/{c25["id"]}/units/{bornova["id"]}/targets').json()); ok('1b DB etkisi bir kez (yeni hedef sayısı +1)', after==before+1, f'{before}->{after}')
    # bağlantı kesilmesi: ilk istek düşürülür, otomatik yeniden deneme aynı anahtarla
    pg.goto(f'{BASE}/#/t/{tid}/aksiyonlar?unit={bornova["id"]}&cycle={c25["id"]}'); pg.wait_for_timeout(1500)
    pg.wait_for_timeout(800); (pg.select_option('#ts', index=1) if pg.locator('#ts').count() else None); pg.wait_for_timeout(600); (pg.select_option('#tpl', index=1) if pg.locator('#tpl').count() else None); pg.fill('#due', '2027-03-31')
    dropped={'n':0}
    def route(r):
        if r.request.method=='POST' and '/actions' in r.request.url and dropped['n']==0: dropped['n']+=1; r.abort('connectionfailed')
        else: r.continue_()
    pg.route('**/api/t/**', route); keys.clear(); acts_before=len(s.get(f'{BASE}/api/t/{tid}/actions').json())
    pg.get_by_role('button', name='Aksiyonu aç').click(); pg.wait_for_timeout(4000); pg.unroute('**/api/t/**')
    ak=[k for u,k in keys if 'actions' in u]; ok('2 bağlantı kesilmesi: ilk istek düştü, yeniden deneme aynı anahtarla', dropped['n']==1 and len(ak)>=2 and len(set(ak))==1, json.dumps(ak))
    acts_after=len(s.get(f'{BASE}/api/t/{tid}/actions').json()); ok('2b DB etkisi bir kez (aksiyon +1)', acts_after==acts_before+1, f'{acts_before}->{acts_after}')
    b.close()
json.dump(out, open('/tmp/tur-out/ui-ciftik-sonuc.json','w',encoding='utf-8'), ensure_ascii=False, indent=1); print(f'{sum(1 for o in out if o["sonuc"]=="GEÇTİ")}/{len(out)}')
