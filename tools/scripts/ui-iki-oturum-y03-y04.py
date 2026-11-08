"""Y03/Y04 iki oturumlu tarayıcı testi (gerçek paket, BOŞ ortam, tur sonrası veri): HRBP takip sayfasını açıkken İK başlangıcı düzeltip rebase eder → HRBP'de 'değerlendir' NOT_COMMITTED kartı → Hedefler'den taslağı kabul → takip yeniden değerlendirilir."""
import re, os, glob, json, time, requests, openpyxl
from playwright.sync_api import sync_playwright
BASE='http://localhost:8788'; MAIL='/tmp/teslim/HPW_Act_TESLIMAT_v2.6.2/BOS_BASLANGIC/CALISTIRMA/mail-bos'; out=[]
def ok(n,c,note=''): out.append({'adim':n,'sonuc':'GEÇTİ' if c else 'KALDI','not':note}); print('OK  ' if c else 'FAIL', n, note[:150]); assert c, n
files=sorted(glob.glob(MAIL+'/*.eml'), key=os.path.getmtime); hrbp=None
for f in files:
    t=open(f,encoding='utf-8').read(); m=re.search(r'To: (hrbp@alfa\.[^\n]+)', t)
    if m: hrbp=m.group(1)
ok('0 HRBP hesabı bulundu', hrbp is not None, hrbp or '')
s=requests.Session(); r=s.post(BASE+'/api/auth/login', json={'email':'admin@hpw.bos.test','password':'Bos-Admin-2026'}); ok('0b platform API girişi', r.status_code==200)
tid=[x for x in s.get(BASE+'/api/platform/tenants').json() if x['code'].startswith('ALFA')][0]['id']; s.post(BASE+'/api/auth/switch-tenant', json={'tenantId':tid})
cycles=s.get(f'{BASE}/api/t/{tid}/cycles').json(); c25=[c for c in cycles if c['code']=='2025-ANA'][0]; c26=[c for c in cycles if c['code']=='2026-ANA'][0]
units=s.get(f'{BASE}/api/t/{tid}/cycles/{c25["id"]}/units').json(); konak=[u for u in units if u['code']=='KONAK'][0]
tg=s.get(f'{BASE}/api/t/{tid}/cycles/{c25["id"]}/units/{konak["id"]}/targets').json(); cand=[t for t in tg if t['status'] in ('accepted','active')] or [t for t in tg if t['status']=='pending_acceptance']; target=cand[0]; item=target['item_code']
with sync_playwright() as p:
    b=p.chromium.launch(); cH=b.new_context(viewport={'width':1440,'height':1000}); pH=cH.new_page(); pH.set_default_timeout(20000)
    pH.goto(BASE+'/#/giris'); pH.fill('#email', hrbp); pH.fill('#password','Bos-Parola-2026'); pH.get_by_role('button', name='Giriş yap').click(); pH.wait_for_url(re.compile('#/t/'))
    pH.goto(f'{BASE}/#/t/{tid}/takip'); pH.wait_for_timeout(1500)
    def sel(page, selector, text):
        for o in page.locator(f'{selector} option').all():
            if text in o.inner_text(): page.select_option(selector, o.get_attribute('value')); return True
        return False
    sel(pH,'#cycle','2025-ANA'); pH.wait_for_timeout(800); sel(pH,'#unit','KONAK'); pH.wait_for_timeout(800); sel(pH,'#fu','2026-ANA'); pH.wait_for_timeout(800)
    row=pH.locator('table tbody tr').filter(has_text=item).first; row.get_by_role('button', name='değerlendir').click(); pH.wait_for_timeout(1500)
    ok('1 oturum A (HRBP): hedef değerlendirildi', (pH.get_by_text(re.compile('EVALUATED|ulaşma')).count()>=1) if target['status']!='pending_acceptance' else True, target['status'])
    # oturum B (İK/platform, API): başlangıç düzeltmesi PATCH → under_review → rebase → pending_acceptance
    cur=[t for t in s.get(f'{BASE}/api/t/{tid}/cycles/{c25["id"]}/units/{konak["id"]}/targets').json() if t['id']==target['id']][0]
    if cur['status']=='pending_acceptance': ok('2 (önceki koşudan) hedef zaten taslak', True)
    else:
     wbb=s.get(f'{BASE}/api/t/{tid}/templates/results.xlsx?cycleId={c25["id"]}').content; open('/tmp/p.xlsx','wb').write(wbb); wb=openpyxl.load_workbook('/tmp/p.xlsx'); wb['Paket'].cell(2,5).value='PATCH'; ws=wb['Sonuclar']; dws=wb['Dagilimlar']; hdr=[c.value for c in ws[1]]; iU,iM,iS,iN,iV=hdr.index('scope_code'),hdr.index('metric_code'),hdr.index('status'),hdr.index('n_valid'),hdr.index('value'); tcode=None
     for r in ws.iter_rows(min_row=2):
        if r[iU].value=='KONAK' and r[iM].value==f'{item}_TB':
            tcode=r[0].value; d={'1':1,'2':1,'3':2,'4':7,'5':7}; n=18; r[iS].value='OBSERVED'; r[iN].value=n; r[iV].value=str(round((14/18)*100,1)).replace('.',',')
            for o,c in d.items(): dws.append([tcode,'2025-ANA','KONAK',f'{item}_TB',o,c])
     wb.save('/tmp/p2.xlsx'); up=s.post(f'{BASE}/api/t/{tid}/imports/results?cycleId={c25["id"]}', files={'file':('p2.xlsx',open('/tmp/p2.xlsx','rb'))}).json(); ok('2 oturum B: PATCH düzeltmesi doğrulandı', up.get('state')=='validated', json.dumps(up.get('issues',[])[:2], ensure_ascii=False))
     cm=s.post(f'{BASE}/api/t/{tid}/imports/{up["jobId"]}/commit', json={}); ok('2b düzeltme yayımlandı, hedef incelemeye düştü', cm.status_code==200 and cm.json()['applied']['targetsUnderReview']>=1, cm.text[:150])
     rb=s.post(f'{BASE}/api/t/{tid}/targets/{target["id"]}/review', json={'decision':'accept','reason':'düzeltilmiş başlangıç','baseline':'rebase'}); ok('2c rebase → pending_acceptance', rb.status_code==200 and rb.json().get('status')=='pending_acceptance', rb.text[:150])
    # oturum A eski sayfa: yeniden değerlendir → NOT_COMMITTED kartı, 'altında' yanlış etiketi yok
    row.get_by_role('button', name=re.compile('değerlendir|seçili')).click(); pH.wait_for_timeout(1500); txt=pH.locator('main').inner_text()
    print('MAIN:', txt[txt.find('TAKİP DÖNEMİ'):][:700].replace('\n',' | ')); ok('3 Y04: eski oturumda değerlendirme NOT_COMMITTED kartı; ulaşma kararı ve yanlış yön etiketi yok', 'Kabul edilmiş taahhüt yok' in txt and 'hedefin altında' not in txt and 'ACHIEVED' not in txt and 'gözlem' in txt.lower()); pH.screenshot(path='/tmp/tur-out/y04-not-committed.png')
    # Hedefler ekranından taslağı kabul (Y03)
    pH.goto(f'{BASE}/#/t/{tid}/hedefler?unit={konak["id"]}&cycle={c25["id"]}'); pH.wait_for_timeout(1500); print('HEDEFLER:', pH.locator('main').inner_text()[:500].replace('\n',' | ')); ok('4 Y03: Hedefler ekranında taslak satırı ve kabul/ret düğmeleri', pH.get_by_role('button', name='taslağı kabul et').count()>=1 and pH.get_by_role('button', name='gerekçeli reddet').count()>=1); pH.screenshot(path='/tmp/tur-out/y03-taslak.png')
    pH.on('dialog', lambda d: d.accept('' if 'Kabul edilecek' in d.message else 'yeni öneri uygun')); pH.locator('table tbody tr').filter(has_text=item).get_by_role('button', name='taslağı kabul et').click(); pH.wait_for_timeout(1500)
    st=s.get(f'{BASE}/api/t/{tid}/cycles/{c25["id"]}/units/{konak["id"]}/targets').json(); tt=[t for t in st if t['id']==target['id']][0]; ok('4b aynı hedef/sürüm kabul edildi (accepted, approved_target dolu)', tt['status']=='accepted' and tt['approved_target'] is not None, json.dumps({'status':tt['status'],'approved':tt['approved_target']}))
    pH.goto(f'{BASE}/#/t/{tid}/takip'); pH.wait_for_timeout(1200); sel(pH,'#cycle','2025-ANA'); pH.wait_for_timeout(800); sel(pH,'#unit','KONAK'); pH.wait_for_timeout(800); sel(pH,'#fu','2026-ANA'); pH.wait_for_timeout(800); pH.locator('table tbody tr').filter(has_text=item).first.get_by_role('button', name='değerlendir').click(); pH.wait_for_timeout(1500)
    ok('5 kabulden sonra takip değerlendirmesi üretilir', pH.get_by_text(re.compile('EVALUATED|ulaşma')).count()>=1 and pH.get_by_text('Kabul edilmiş taahhüt yok').count()==0)
    b.close()
json.dump(out, open('/tmp/tur-out/y03-y04-iki-oturum-sonuc.json','w',encoding='utf-8'), ensure_ascii=False, indent=1); print(f'{sum(1 for o in out if o["sonuc"]=="GEÇTİ")}/{len(out)}')
