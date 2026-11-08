"""Tarayıcı: DOLU DEMO kopyasında İK yöneticisi ana aksiyonu panelden yayımlar ve birim tipi filtresiyle 400 şubeye dağıtır; kuyrukta karar gerektiren kayıtlarda kararsız kapatma düğmesi yoktur; kohort panelinde tarih esası seçimi vardır."""
import re, json, time, requests
from playwright.sync_api import sync_playwright
BASE='http://localhost:8787'; out=[]; CODE=f'UI400-{int(time.time())%100000}'
def ok(n,c,note=''): out.append({'adim':n,'sonuc':'GEÇTİ' if c else 'KALDI','not':note}); print('OK  ' if c else 'FAIL', n, note[:120]); assert c, n
s=requests.Session(); s.post(BASE+'/api/auth/login', json={'email':'ik@saha.demo.hpw-act.local','password':'Demo-Kullanici-2026'}); tid=s.get(BASE+'/api/auth/me').json()['tenantId']
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1440,'height':1000}); pg.set_default_timeout(30000); pg.on('dialog', lambda d: d.accept())
    pg.goto(BASE+'/#/giris'); pg.fill('#email','ik@saha.demo.hpw-act.local'); pg.fill('#password','Demo-Kullanici-2026'); pg.get_by_role('button',name='Giriş yap').click(); pg.wait_for_timeout(2000)
    pg.goto(f'{BASE}/#/t/{tid}/aksiyonlar'); pg.wait_for_timeout(2500)
    pg.fill('#ma-code', CODE); pg.fill('#ma-title','Panelden 400 şube dağıtımı'); pg.fill('#ma-hz','180'); pg.get_by_role('button', name='Yayımla').click(); pg.wait_for_timeout(1500); ok('1 ana aksiyon panelden yayımlandı', pg.get_by_text(re.compile('Ana aksiyon yayımlandı')).count()==1)
    opt=[o.get_attribute('value') for o in pg.locator('#dp-ma option').all() if CODE in (o.inner_text() or '')][0]; pg.select_option('#dp-ma', opt); pg.select_option('#dp-type', 'SUBE'); pg.wait_for_timeout(600)
    ok('2 kapsam önizlemesi: 400 etkin şube', pg.get_by_role('button', name='Dağıt (400 birim)').count()==1)
    t0=time.perf_counter(); pg.get_by_role('button', name='Dağıt (400 birim)').click(); pg.get_by_text(re.compile('Dağıtım: 400 yeni')).wait_for(); ms=round((time.perf_counter()-t0)*1000); ok('3 400 birime tarayıcıdan dağıtıldı', True, f'{ms} ms (tıklamadan mesaja)')
    n=len([d for d in s.get(f'{BASE}/api/t/{tid}/corporate/deployments').json() if d['code']==CODE]); ok('4 veritabanında 400 dağıtım', n==400, str(n))
    pg.get_by_role('button', name=re.compile(r'Dağıt \(400 birim\)')).click(); pg.get_by_text(re.compile('Dağıtım: 0 yeni')).wait_for(); ok('5 aynı dağıtım ikinci kez: 0 yeni (idempotent)', True)
    pg.goto(f'{BASE}/#/t/{tid}/dikkat'); pg.wait_for_timeout(2500); rows=pg.locator('table').filter(has_text='Merkezi').locator('tbody tr') if pg.locator('table').filter(has_text='Merkezi').count() else None
    tbl=pg.locator('table').filter(has=pg.get_by_role('button', name='kabul')).first; dec_rows=tbl.locator('tbody tr').filter(has=pg.get_by_role('button', name='kabul')); cnt=dec_rows.count(); bad=sum(1 for i in range(cnt) if dec_rows.nth(i).get_by_role('button', name=re.compile('^kapat')).count()>0)
    ok('6 karar gerektiren kuyruk satırlarında kararsız kapatma yok', cnt>0 and bad==0, f'{cnt} satır')
    pg.goto(f'{BASE}/#/t/{tid}/'); pg.wait_for_timeout(2500); pg.fill('#amb-item','GUV-01'); pg.fill('#amb-val','80'); pg.fill('#amb-why','tarih esası tarayıcı testi'); pg.get_by_role('button',name='İstek öner').click(); pg.wait_for_timeout(1500); pg.get_by_role('button', name='kohort kuralı').first.click(); pg.wait_for_timeout(600)
    pg.select_option('#fz-basis','cycle_end'); pg.wait_for_timeout(300); pg.get_by_role('button', name='Kapsamı önizle').click(); pg.wait_for_timeout(2500); ok('7 kohort tarih esası seçimi ve önizleme tarihi (dönem bitişi)', pg.get_by_text('itibarıyla etkin birim').count()==1)
    b.close()
json.dump(out, open('/tmp/scale/ui-400-dagitim-sonuc.json','w',encoding='utf-8'), ensure_ascii=False, indent=1); print(f'{sum(1 for o in out if o["sonuc"]=="GEÇTİ")}/{len(out)}')
