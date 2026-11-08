import re, os, json
from playwright.sync_api import sync_playwright
ROOT=__import__('os').environ.get('ROOT','/tmp/teslim/HPW_Act_TESLIMAT_v2.11.6'); out=[]
def ok(n,c,note=''): out.append({'adim':n,'sonuc':'GEÇTİ' if c else 'KALDI','not':note}); print('OK  ' if c else 'FAIL', n, note[:120]);  assert c, n
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1440,'height':1000}); pg.set_default_timeout(20000)
    pg.goto('file://'+ROOT+'/DOLU_DEMO/index.html'); pg.wait_for_url(re.compile('http://127.0.0.1:8787/app.html')); ok('D1 DEMO index.html -> 127.0.0.1:8787 gerçek uygulama', True)
    pg.goto('http://127.0.0.1:8787/#/giris'); pg.wait_for_timeout(1000); ok('D2 DEMO giriş ekranı ortam etiketi: DOLU DEMO — sentetik veri', pg.get_by_text('DOLU DEMO — sentetik veri').count()==1 and pg.get_by_text('İlk kurulum · HPW yöneticisi').count()==0)
    pg.fill('#email','ik@saha.demo.hpw-act.local'); pg.fill('#password','Demo-Kullanici-2026'); pg.get_by_role('button',name='Giriş yap').click(); pg.wait_for_url(re.compile('#/t/')); pg.wait_for_timeout(1500)
    ok('D3 SAHA İK girişi → Genel bakış gerçek sayaçlarla', pg.get_by_text('Kurulum durumu').count()==1 and pg.get_by_text(re.compile('648 birim')).count()==1); pg.screenshot(path='/tmp/tur-out/demo-genel-bakis.png')
    pg.locator('nav >> text=Kullanıcılar').click(); pg.wait_for_timeout(2500); ok('D4 Kullanıcılar: 500+ üye listesi ve test posta kutusu (sandbox etiketli)', pg.get_by_text('sandbox (gerçek teslimat değil)').count()>=1 and pg.get_by_role('link',name='daveti aç').count()>=10); pg.screenshot(path='/tmp/tur-out/demo-kullanicilar.png')
    pg.locator('nav >> text=Dikkat').click(); pg.wait_for_timeout(2000); ok('D5 Dikkat listesi gerçek kayıtlardan', pg.locator('table tbody tr').count()>=3)
    pg.get_by_role('button',name='Çıkış').click(); pg.wait_for_url(re.compile('#/giris'))
    pg.fill('#email','ik@anka.demo.hpw-act.local'); pg.fill('#password','Demo-Kullanici-2026'); pg.get_by_role('button',name='Giriş yap').click(); pg.wait_for_url(re.compile('#/t/')); pg.wait_for_timeout(1500)
    ok('D6 FABRIKA (farklı yapı) İK girişi', pg.get_by_text('FABRIKA').count()>=1 and pg.get_by_text(re.compile('birim')).count()>=1)
    pg.locator('nav >> text=Aksiyonlar').click(); pg.wait_for_timeout(2500); n=pg.locator('table').first.locator('tbody tr').count(); ok('D7 FABRIKA aksiyon listesi gerçek kayıt', n>=1, str(n))
    pg.goto('http://127.0.0.1:8787/#/giris'); pg.wait_for_timeout(500); pg.get_by_role('button',name='Çıkış').click() if pg.get_by_role('button',name='Çıkış').count() else None
    # yanlış ortam: BOŞ index'i DEMO adresine yönlendirilmiş gibi test edilemez (farklı köken); iki servis aynı anda ayrı hostta çalışıyor
    import requests; ok('D8 iki ortam aynı anda, ayrı köken/çerez: bos localhost:8788, demo 127.0.0.1:8787', requests.get('http://localhost:8788/api/health').json()['env']=='bos' and requests.get('http://127.0.0.1:8787/api/health').json()['env']=='demo')
    b.close()
json.dump(out, open('/tmp/tur-out/demo-smoke-sonuc.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
