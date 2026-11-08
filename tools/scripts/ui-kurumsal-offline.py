"""Final ZIP tarayıcı testi: Genel bakış kontrol kulesi, Organizasyon → Sorumluluk haritası ekleme + reorg taşıma, Dikkat → merkezi kuyruk; uzun offline + manuel yeniden deneme (aynı komut anahtarı, tek DB etkisi)."""
import re, json, requests
from playwright.sync_api import sync_playwright
BASE='http://localhost:8788'; out=[]
def ok(n,c,note=''): out.append({'adim':n,'sonuc':'GEÇTİ' if c else 'KALDI','not':note}); print('OK  ' if c else 'FAIL', n, note[:140]); assert c, n
s=requests.Session(); s.post(BASE+'/api/auth/login', json={'email':'admin@hpw.bos.test','password':'Bos-Admin-2026'}); tid=[x for x in s.get(BASE+'/api/platform/tenants').json() if x['code'].startswith('ALFA')][0]['id']; s.post(BASE+'/api/auth/switch-tenant', json={'tenantId':tid})
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1440,'height':1000}); pg=ctx.new_page(); pg.set_default_timeout(20000)
    pg.goto(BASE+'/#/giris'); pg.fill('#email','admin@hpw.bos.test'); pg.fill('#password','Bos-Admin-2026'); pg.get_by_role('button',name='Giriş yap').click(); pg.wait_for_url(re.compile('#/t/|#/platform')); pg.goto(f'{BASE}/#/platform'); pg.wait_for_timeout(1000)
    pg.locator('table').first.locator('tbody tr').filter(has_text='ALFA').get_by_role('button',name='Aç').click(); pg.wait_for_url(re.compile('#/t/')); pg.wait_for_timeout(1500)
    ok('1 Genel bakış: kurumsal kontrol kulesi gerçek sayımlarla', pg.get_by_text('Kurumsal kontrol kulesi').count()==1 and pg.get_by_text(re.compile(r'\d+ istek')).count()>=1); pg.screenshot(path='/tmp/tur-out/kontrol-kulesi.png')
    pg.goto(f'{BASE}/#/t/{tid}/organizasyon'); pg.wait_for_timeout(1500); ok('2 Organizasyon: sorumluluk haritası ve reorg panelleri', pg.get_by_text('Sorumluluk haritası').count()==1 and pg.get_by_text('Yeniden yapılanma').count()==1)
    roles=s.get(f'{BASE}/api/t/{tid}/org').json().get('roles',[]); rc=[r for r in roles if r.get('permission_profile')=='UNIT_MANAGER'][0]['code']
    pg.fill('#rm-item','GUV-01'); pg.fill('#rm-role', rc); pg.get_by_role('button',name='Eşlemeyi onayla').click(); pg.wait_for_timeout(1500); ok('3 harita eşlemesi kaydedildi (tarihli, onaylı)', pg.locator('table').filter(has_text='Merkez').locator('tbody tr').filter(has_text='GUV-01').count()>=1); pg.screenshot(path='/tmp/tur-out/sorumluluk-haritasi.png')
    # uzun offline + manuel retry: reorg taşıma komutu — ilk denemede bütün POST'lar 12 sn engellenir (retry'lar tükenir, niyet outcome_unknown kalır), sonra manuel tıklama aynı anahtarla
    units=s.get(f'{BASE}/api/t/{tid}/org').json()['units']; kucuk=[u for u in units if (u.get('external_id') or u.get('code'))=='KUCUK'][0]; keys=[]
    pg.on('request', lambda r: keys.append(r.headers.get('idempotency-key')) if r.method=='POST' and '/move' in r.url else None)
    pg.select_option('#rg-unit', kucuk['id']); pg.fill('#rg-parent','EGE'); pg.fill('#rg-reason','bölge yeniden yapılanması testi'); blocked={'on':True}
    pg.route('**/api/t/**', lambda r: r.abort('connectionfailed') if blocked['on'] and r.request.method=='POST' else r.continue_())
    pg.get_by_role('button',name='Taşı').click(); pg.wait_for_timeout(9000); txt=pg.locator('main').inner_text(); ok('4 uzun offline: otomatik denemeler tükendi, niyet outcome_unknown korunuyor (ekranda açık uyarı)', 'sunucuda yapılmış olabilir' in txt and len(set(keys))==1, json.dumps(keys)); 
    blocked['on']=False; pg.get_by_role('button',name='Taşı').click(); pg.wait_for_timeout(3000); ok('5 manuel yeniden deneme aynı komut anahtarıyla', len(set(keys))==1 and len(keys)>=4, json.dumps(keys))
    hist=s.get(f'{BASE}/api/t/{tid}/ownership-history/org_unit/{kucuk["id"]}').json(); ok('6 DB etkisi bir kez (tek taşıma kaydı) ve tarihçe', len(hist)==1, json.dumps(hist)[:120])
    pg.goto(f'{BASE}/#/t/{tid}/dikkat'); pg.wait_for_timeout(1500); ok('7 Dikkat: merkezi karar kuyruğu paneli', pg.get_by_text('Merkezi karar kuyruğu').count()==1); pg.screenshot(path='/tmp/tur-out/merkezi-kuyruk.png')
    b.close()
json.dump(out, open('/tmp/tur-out/ui-kurumsal-offline-sonuc.json','w',encoding='utf-8'), ensure_ascii=False, indent=1); print(f'{sum(1 for o in out if o["sonuc"]=="GEÇTİ")}/{len(out)}')
