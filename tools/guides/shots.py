import re, json, time, requests, traceback, os
PHASE=os.environ.get('PHASE','A')
from playwright.sync_api import sync_playwright
BASE='http://localhost:8787'; OUT='/tmp/guide/shots'; PW='Demo-Kullanici-2026'; log=[]
U={'platform':('platform@demo.hpw-act.local','Demo-Platform-2026'),'ik':('ik@saha.demo.hpw-act.local',PW),'hrbp':('gmy01.aydn@saha.demo.hpw-act.local',PW),'exec':('gmy01.yldz@saha.demo.hpw-act.local',PW),'bolge':('mud01.aydn@saha.demo.hpw-act.local',PW),'sube':('sb001.aslan@saha.demo.hpw-act.local',PW),'ekip':('alt001.ylmaz@saha.demo.hpw-act.local',PW),'izleyici':('izleyici.gmy03@saha.demo.hpw-act.local',PW)}
def sess(who):
    s=requests.Session(); r=s.post(BASE+'/api/auth/login', json={'email':U[who][0],'password':U[who][1]}); assert r.status_code==200, (who, r.text[:200]); return s
ik=sess('ik'); me=ik.get(BASE+'/api/auth/me').json(); tid=me['tenantId']
cycles=ik.get(f'{BASE}/api/t/{tid}/cycles').json(); pub=[c for c in cycles if c.get('active_batch_id')]; cur=sorted(pub, key=lambda c:c['code'])[-1]; prev=sorted(pub, key=lambda c:c['code'])[0]
sube=sess('sube'); sid=sube.get(BASE+'/api/auth/me').json()
units=ik.get(f'{BASE}/api/t/{tid}/org').json()['units']; ucode={u['code']:u['id'] for u in units}
sb1=ucode.get('SB001'); tl=sube.get(f'{BASE}/api/t/{tid}/cycles/{prev["id"]}/units/{sb1}/targets').json(); item=(tl[0]['item_code'] if tl else 'GUV-01')
# kurumsal örnek veri (yalnız kılavuz kopya veritabanında)
try:
    assert PHASE=='A', 'faz B: tohum yok'
    amb=ik.post(f'{BASE}/api/t/{tid}/corporate/ambitions', json={'cycleId':prev['id'],'itemCode':item,'ambitionValue':75,'rationale':'Kurumsal yıllık hedef (kılavuz örneği)'}).json(); aid=amb.get('id')
    ik.post(f'{BASE}/api/t/{tid}/corporate/ambitions/{aid}/freeze', json={'rule':'unit_type','unitType':'SUBE'})
    ik.post(f'{BASE}/api/t/{tid}/corporate/ambitions/{aid}/reconcile', json={})
    sube.post(f'{BASE}/api/t/{tid}/corporate/ambitions/{aid}/units/{sb1}/decision', json={'decision':'counterproposal','counterproposalValue':70,'reason':'Şube verisi 70 üstünü desteklemiyor'})
    ma=ik.post(f'{BASE}/api/t/{tid}/corporate/master-actions', json={'ambitionId':aid,'code':'MA-GUVEN','title':'Yönetici güven konuşmaları','cadence':'monthly','horizonDays':180}).json()
    ik.post(f'{BASE}/api/t/{tid}/corporate/master-actions/{ma["id"]}/deploy', json={'unitCodes':[c for c in ucode if re.match(r'SB0\d\d$', c)][:40]})
    deps=ik.get(f'{BASE}/api/t/{tid}/corporate/deployments?unitId={sb1}').json()
    if deps: sube.post(f'{BASE}/api/t/{tid}/corporate/resource-requests', json={'kind':'budget','deploymentId':deps[0]['id'],'need':'Kolaylaştırıcı eğitimi bütçesi','amount':25000,'dueDate':'2026-11-30','blocksExecution':True,'reason':'Program için dış kolaylaştırıcı gerekli'})
    log.append('kurumsal örnek veri: '+str(aid))
except Exception as e: log.append('seed hata: '+repr(e)[:200])
def login(pg, who):
    pg.context.clear_cookies(); pg.goto(BASE+'/#/giris'); pg.wait_for_timeout(700); pg.fill('#email', U[who][0]); pg.fill('#password', U[who][1]); pg.get_by_role('button', name='Giriş yap').click(); pg.wait_for_timeout(1800)
def shot(pg, name, anchor=None, full=False):
    try:
        if anchor:
            el=pg.get_by_text(anchor, exact=False).first; el.scroll_into_view_if_needed(); pg.evaluate('window.scrollBy(0,-90)'); pg.wait_for_timeout(500)
        else: pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(300)
        pg.screenshot(path=f'{OUT}/{name}.png', full_page=full); log.append('OK '+name)
    except Exception as e: log.append(f'HATA {name}: {repr(e)[:160]}')
def go(pg, path, wait=2000): pg.goto(f'{BASE}/#/t/{tid}/{path}'); pg.wait_for_timeout(wait)
def selu(pg, uid):
    try: pg.select_option('#unit', uid); pg.wait_for_timeout(1300)
    except Exception as e: log.append('selu '+repr(e)[:80])
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1360,'height':860}, device_scale_factor=1.5); pg=ctx.new_page(); pg.set_default_timeout(15000); pg.on('dialog', lambda d: d.dismiss())
    if PHASE=='A':
        pg.goto(BASE+'/#/giris'); pg.wait_for_timeout(1200); shot(pg,'01-giris')
        pg.goto(BASE+'/#/parola'); pg.wait_for_timeout(900); shot(pg,'02-parola')
        login(pg,'platform'); pg.goto(BASE+'/#/platform'); pg.wait_for_timeout(1800); shot(pg,'03-platform-musteriler'); shot(pg,'03b-platform-posta','Test posta kutusu')
        login(pg,'ik'); go(pg,''); shot(pg,'10-genel-bakis'); shot(pg,'11-kontrol-kulesi','Kurumsal kontrol kulesi'); shot(pg,'12-kurumsal-planlama','Kurumsal planlama')
        try: pg.get_by_role('button', name='aç').first.click(); pg.wait_for_timeout(1500); shot(pg,'12b-istek-detay','katkı projeksiyonu')
        except Exception as e: log.append('detay '+repr(e)[:100])
        go(pg,'organizasyon'); shot(pg,'20-organizasyon'); shot(pg,'21-sorumluluk-haritasi','Sorumluluk haritası'); shot(pg,'22-reorg','Yeniden yapılanma')
        go(pg,'soru-seti'); 
        try: pg.locator('table').first.locator('tbody tr').nth(2).get_by_role('button').first.click(); pg.wait_for_timeout(700)
        except Exception: pass
        shot(pg,'30-soru-seti'); shot(pg,'31-ek-soru','Ek soru'); shot(pg,'32-esdegerlik','Madde eşdeğerliği')
        go(pg,'donemler'); shot(pg,'40-donemler')
        pg.goto(f'{BASE}/#/t/{tid}/yukle/results?cycleId={cur["id"]}'); pg.wait_for_timeout(2000); shot(pg,'41-sonuc-yukle')
        go(pg,'yukle/org'); shot(pg,'23-org-excel')
        go(pg,'kullanicilar',3500); shot(pg,'50-kullanicilar'); shot(pg,'51-davet-posta','Test posta kutusu')

    if PHASE=='B':
        login(pg,'sube'); go(pg,'birimler'); selu(pg, sb1); shot(pg,'60-birim-sonuclari'); pg.evaluate('window.scrollBy(0,700)'); pg.wait_for_timeout(400); pg.screenshot(path=f'{OUT}/61-birim-sonuclari-alt.png'); log.append('OK 61')
        go(pg,'hedefler'); selu(pg, sb1); shot(pg,'62-hedefler'); shot(pg,'63-kurumsal-uzlastirma','Kurumsal uzlaştırma')
        go(pg,'aksiyonlar'); selu(pg, sb1); shot(pg,'64-aksiyonlar')
        try: pg.get_by_role('button', name='aç').first.click(); pg.wait_for_timeout(1500); shot(pg,'65-aksiyon-detay-kanit','Kaydı ekle')
        except Exception as e: log.append('aksiyon detay '+repr(e)[:100])
        shot(pg,'66-dagitimlar','Ana aksiyon dağıtımları')
        go(pg,'takip');
        try:
            pg.select_option('#cycle', prev['id']); pg.wait_for_timeout(1200); selu(pg, sb1); pg.select_option('#fu', cur['id']); pg.wait_for_timeout(1000)
            pg.get_by_role('button', name=re.compile('değerlendir')).first.click(); pg.wait_for_timeout(1500)
        except Exception as e: log.append('takip '+repr(e)[:100])
        shot(pg,'67-takip')
        go(pg,'dikkat'); shot(pg,'68-dikkat-sube')
        login(pg,'hrbp'); go(pg,'hedefler'); shot(pg,'70-hrbp-hedefler'); go(pg,'dikkat'); shot(pg,'71-hrbp-dikkat'); go(pg,'birimler'); shot(pg,'72-hrbp-birimler')
        login(pg,'ik'); go(pg,'dikkat'); shot(pg,'73-merkezi-kuyruk','Merkezi karar kuyruğu'); go(pg,'aksiyonlar'); shot(pg,'74-ana-aksiyon-yonetimi','Ana aksiyon yönetimi')
        login(pg,'exec'); go(pg,''); shot(pg,'80-yonetim-genel-bakis'); shot(pg,'81-yonetim-kontrol-kulesi','Kurumsal kontrol kulesi'); go(pg,'birimler'); shot(pg,'82-yonetim-birimler')
        login(pg,'bolge'); go(pg,'birimler'); shot(pg,'85-bolge-birimler'); go(pg,'aksiyonlar'); shot(pg,'86-bolge-aksiyonlar'); go(pg,'dikkat'); shot(pg,'87-bolge-dikkat')
        login(pg,'ekip'); go(pg,'aksiyonlar'); shot(pg,'90-ekip-aksiyonlar'); go(pg,'dikkat'); shot(pg,'91-ekip-dikkat')
        login(pg,'izleyici'); go(pg,'birimler'); shot(pg,'95-izleyici-birimler'); go(pg,'hedefler'); shot(pg,'96-izleyici-hedefler')

    b.close()
json.dump({'tid':tid,'item':item,'log':log}, open(f'/tmp/guide/shots-log-{PHASE}.json','w'), ensure_ascii=False, indent=1); print('\n'.join(log))
