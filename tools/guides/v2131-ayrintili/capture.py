# -*- coding: utf-8 -*-
"""v2.13.1 kılavuz ekranları: gerçek DOLU DEMO'dan görüntü + işaret kutuları (numaralı işaretler sonradan görüntünün ÜSTÜNE çizilir; ekran değiştirilmez)."""
import json, os, sys, time, requests
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:8787'; OUT='/tmp/k2/shots'; PW='Demo-Kullanici-2026'; IDS=json.load(open('/tmp/k2/ids.json')); tid=IDS['tid']; CY=IDS['cy']; UN=IDS['u']
U={'platform':('platform@demo.hpw-act.local','Demo-Platform-2026'),'ik':('ik@saha.demo.hpw-act.local',PW),'hrbp':('gmy01.aydn@saha.demo.hpw-act.local',PW),'exec':('gmy01.yldz@saha.demo.hpw-act.local',PW),'bolge':('mud01.aydn@saha.demo.hpw-act.local',PW),'sube':('sb001.aslan@saha.demo.hpw-act.local',PW),'ekip':('alt001.ylmaz@saha.demo.hpw-act.local',PW),'izleyici':('izleyici.gmy03@saha.demo.hpw-act.local',PW)}
log=[]; boxes={}
def login(pg, who):
    pg.context.clear_cookies(); pg.goto(BASE+'/app.html#/giris'); pg.wait_for_timeout(600); pg.fill('#email',U[who][0]); pg.fill('#password',U[who][1]); pg.get_by_role('button',name='Giriş yap').click(); pg.wait_for_timeout(1800)
def go(pg, path, wait=1800): pg.goto(f'{BASE}/app.html#/t/{tid}/{path}'); pg.wait_for_timeout(wait)
def pick(pg, cycle=None, unit=None):
    if cycle and pg.locator('#cycle').count(): pg.select_option('#cycle', CY[cycle]); pg.wait_for_timeout(600)
    if unit and pg.locator('#unit').count(): pg.select_option('#unit', UN[unit]); pg.wait_for_timeout(1600)
def loc(pg, spec):
    k,v=spec.split('=',1)
    if k=='id': return pg.locator('#'+v).first
    if k=='th': return pg.locator('th', has_text=v).first
    if k=='btn': return pg.get_by_role('button', name=v, exact=True).first
    if k=='link': return pg.get_by_role('link', name=v, exact=True).first
    if k=='text': return pg.locator(f'text="{v}"').first
    if k=='css': return pg.locator(v).first
    if k=='label': return pg.locator('.field__label', has_text=v).first
    if k=='kicker': return pg.locator('.kicker', has_text=v).first
    return pg.locator(v).first
def shot(pg, name, markers, anchor=None, dy=-80, block='start'):
    try:
        if anchor:
            el=loc(pg, anchor); el.evaluate(f"e=>e.scrollIntoView({{block:'{block}'}})"); pg.evaluate(f'window.scrollBy(0,{dy})'); pg.wait_for_timeout(400)
        else: pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(250)
        bx=[]
        for n,(label,spec) in enumerate(markers,1):
            try:
                el=loc(pg,spec); b=el.bounding_box()
                if b and b['y']+b['height']>0 and b['y']<850 and b['width']>0: bx.append({'n':n,'label':label,'x':b['x'],'y':b['y'],'w':b['width'],'h':b['height']})
                else: bx.append({'n':n,'label':label,'x':None})
            except Exception: bx.append({'n':n,'label':label,'x':None})
        pg.screenshot(path=f'{OUT}/{name}.png'); boxes[name]=bx; log.append(f"OK {name} ({sum(1 for b in bx if b['x'] is not None)}/{len(bx)} işaret)"); print(log[-1], flush=True); json.dump(boxes,open('/tmp/k2/boxes.json','w'),ensure_ascii=False,indent=1)
    except Exception as e: log.append(f'HATA {name}: {repr(e)[:160]}'); print(log[-1], flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1360,'height':860}, device_scale_factor=1.5); pg=ctx.new_page(); pg.set_default_timeout(6000); pg.on('dialog', lambda d: d.dismiss())
    # Giriş
    pg.goto(BASE+'/app.html#/giris'); pg.wait_for_timeout(900)
    shot(pg,'G01-giris',[('E-posta alanı','id=email'),('Parola alanı','id=password'),('Giriş yap','btn=Giriş yap'),('Parolamı unuttum','link=Parolamı unuttum'),('Dil seçimi (TR/EN)','btn=EN'),('Ortam etiketi','text=Ortam: DOLU DEMO — sentetik veri')])
    # HPW Sistem Yöneticisi
    login(pg,'platform'); pg.goto(BASE+'/app.html#/platform'); pg.wait_for_timeout(2000)
    shot(pg,'P01-musteriler',[('Sekmeler (Şirketler / Ekip ve erişim / İşlem geçmişi)','text=Şirketler'),('Arama / filtre','css=input[type=search], input[placeholder]'),('Şirket satırı','css=tbody tr'),('Durum sütunu','th=Durum'),('Kurulum ilerlemesi','th=Kurulum'),('Yeni şirket','btn=Yeni şirket')])
    try:
        pg.locator('tbody tr').first.get_by_role('button').first.click(); pg.wait_for_timeout(1800)
        shot(pg,'P02-sirket-detay',[('Özet / Kurulum / İşler sekmeleri','text=Kurulum'),('Kurulum adımları','th=Adım'),('Durum','th=Durum'),('Hizmet kaydı','text=Hizmet kaydı')],anchor='th=Adım',dy=-200)
    except Exception as e: log.append('P02 '+repr(e)[:80])
    pg.goto(BASE+'/app.html#/platform'); pg.wait_for_timeout(1500)
    try:
        pg.get_by_text('Ekip ve erişim', exact=True).first.click(); pg.wait_for_timeout(1500); shot(pg,'P03-ekip-erisim',[('Personel listesi','css=tbody tr'),('Rol sütunu','th=Rol'),('Atamalar','text=Atama')])
        pg.get_by_text('İşlem geçmişi', exact=True).first.click(); pg.wait_for_timeout(1500); shot(pg,'P04-islem-gecmisi',[('Kayıt listesi','css=tbody tr'),('Zaman','th=Zaman'),('İşlem','th=İşlem')])
    except Exception as e: log.append('P03/04 '+repr(e)[:80])
    # İK Yöneticisi
    login(pg,'ik'); go(pg,'',2500)
    shot(pg,'I01-genel-bakis',[('Kullanıma açılış kartı','text=Kullanıma açılış: HPW onayı henüz verilmedi.'),('Şirket bilgisi','css=.kicker'),('Adım','th=Adım'),('Durum','th=Durum'),('Ne eksik / ne var','th=Ne eksik / ne var'),('aç bağlantısı','link=aç'),('Nasıl çalışır','kicker=Nasıl çalışır')])
    shot(pg,'I02-kontrol-kulesi',[('Kurumsal istek','th=Kurumsal istek'),('Kohort','th=Kohort'),('Ana aksiyon','th=Ana aksiyon'),('Dağıtım / yerel uygulama','th=Dağıtım / yerel uygulama'),('Merkezi kuyruk','th=Merkezi kuyruk'),('Aksiyonlar','th=Aksiyonlar')],anchor='th=Kurumsal istek',dy=-120)
    shot(pg,'I03-kurumsal-planlama',[('Dönem','label=Dönem'),('Madde','label=Madde'),('İstek (TB %)','label=İstek (TB %)'),('Gerekçe','label=Gerekçe'),('İstek öner','btn=İstek öner'),('Kurumsal istek listesi','th=Madde · metrik')],anchor='btn=İstek öner',dy=-260)
    shot(pg,'I04-openai-baglanti',[('Bağlantı durumu','text=OpenAI bağlantısı:'),('API anahtarı alanı','id=ai-key'),('Anahtarı değiştir / Bağlantıyı kur','btn=Anahtarı değiştir'),('Bağlantıyı kaldır','btn=Bağlantıyı kaldır')],anchor='css=[data-testid=ai-connection]',dy=-160)
    go(pg,'organizasyon'); shot(pg,'I05-organizasyon',[('Birim listesi','css=tbody tr'),('Birim kodu','th=Kod'),('Ad','th=Ad'),('Tür','th=Tür'),('Üst birim','th=Üst birim'),('Yeni birim formu','btn=Birim ekle')])
    shot(pg,'I06-sorumluluk-haritasi',[('Sorumluluk haritası','kicker=Sorumluluk haritası'),('Etkileşim alanı','th=Etkileşim alanı'),('Sorumluluk merkezi','th=Sorumluluk merkezi')],anchor='kicker=Sorumluluk haritası',dy=-80)
    go(pg,'soru-seti'); shot(pg,'I07-soru-seti',[('Sürüm listesi','css=tbody tr'),('Sürüm','th=Sürüm'),('Durum','th=Durum'),('Ek soru','kicker=Ek soru'),('Yayımla','btn=Yayımla')])
    go(pg,'donemler'); shot(pg,'I08-donemler',[('Dönem listesi','css=tbody tr'),('Dönem kodu','th=Kod'),('Başlangıç','th=Başlangıç'),('Bitiş','th=Bitiş'),('Durum','th=Durum'),('Yeni dönem','btn=Dönem aç')])
    pg.goto(f"{BASE}/app.html#/t/{tid}/yukle/results?cycleId={CY['2026-ANA']}"); pg.wait_for_timeout(2000); shot(pg,'I09-sonuc-yukle',[('Şablonu indir','link=Şablonu indir'),('Dosya seç','css=input[type=file]'),('Doğrula','btn=Doğrula'),('Yayımla','btn=Yayımla')])
    go(pg,'kullanicilar',3500); shot(pg,'I10-kullanicilar',[('Üye listesi','css=tbody tr'),('E-posta','th=E-posta'),('Rol','th=Rol'),('Davet durumu','th=Davet'),('Davet gönder','btn=Davet gönder'),('Excel ile yükle','link=Excel')])
    go(pg,'dikkat',2500); shot(pg,'I11-merkezi-kuyruk',[('Merkezi karar kuyruğu','kicker=Merkezi karar kuyruğu'),('Tür','th=Tür'),('Birim','th=Birim'),('Durum','th=Durum'),('Kabul / Ret','btn=Kabul')],anchor='kicker=Merkezi karar kuyruğu',dy=-80)
    go(pg,'aksiyonlar',2500); shot(pg,'I12-ana-aksiyon-yonetimi',[('Ana aksiyon yönetimi','kicker=Ana aksiyon yönetimi'),('Ana aksiyon','th=Ana aksiyon'),('Sürüm','th=Sürüm'),('Durum','th=Durum'),('Yayımla / Dağıt','btn=Yayımla')],anchor='kicker=Ana aksiyon yönetimi',dy=-80)
    # İK: AI (SB002, GUR-03 hedefi + planı hazır)
    go(pg,'hedefler'); pick(pg,'2026-ANA','SB002')
    shot(pg,'H01-hedefler-liste',[('Dönem','id=cycle'),('Birim','id=unit'),('Madde','th=Madde'),('Başlangıç','th=Başlangıç'),('Aralık','th=Aralık'),('Hedef','th=Hedef'),('Dayanak','th=Dayanak'),('Durum','th=Durum'),('Aksiyon','th=Aksiyon'),('Yeni hedef formu','kicker=Yeni hedef')])
    try:
        pg.select_option('#item','BAS-01'); pg.get_by_role('button',name='Öneriyi gör',exact=True).click(); pg.wait_for_selector('[data-testid=ai-preview]'); pg.wait_for_timeout(900)
        shot(pg,'H02-oneri',[('Madde seçimi','id=item'),('Hedef değer alanı','id=val'),('Öneriyi gör','btn=Öneriyi gör'),('Öneriyi kabul et','btn=Öneriyi kabul et'),('Öneri metni (aralık, dayanak, takip)','css=[data-testid=ai-preview]'),('Yapay zekâdan yardım al','btn=✨ Yapay zekâdan yardım al')],anchor='id=item',dy=-120)
    except Exception as e: log.append('H02 '+repr(e)[:80])
    pg.select_option('#ai-target',[t['id'] for t in requests.Session().post(BASE+'/api/auth/login',json={'email':U['ik'][0],'password':PW}) and requests.Session().get(BASE)]) if False else None
    s=requests.Session(); s.post(BASE+'/api/auth/login',json={'email':U['ik'][0],'password':PW}); lt=[t for t in s.get(BASE+f"/api/t/{tid}/cycles/{CY['2026-ANA']}/units/{UN['SB002']}/targets").json() if t['item_code']=='GUR-03'][0]['id']
    go(pg,'hedefler'); pick(pg,'2026-ANA','SB002'); pg.select_option('#ai-target',lt); pg.wait_for_selector('[data-testid=ai-assist] [data-testid=ai-panel]'); pg.wait_for_timeout(900)
    shot(pg,'H03-ai-plan-ust',[('Hedef seçimi','id=ai-target'),('Yapay zekâdan yardım al','css=[data-testid=ai-assist] button'),('Planı yeniden oluştur','btn=Planı yeniden oluştur'),('Kapsam, güven ve hazırlanma zamanı','css=[data-testid=ai-assist] .ai-panel > p.caption'),('01 Yönetici özeti','css=[data-testid=ai-assist] .ai-sec:nth-of-type(1) h3'),('02 Ne görüyoruz? (olgu)','css=[data-testid=ai-assist] .ai-sec:nth-of-type(2) h3')],anchor='css=[data-testid=ai-assist]',dy=-40)
    shot(pg,'H04-ai-plan-orta',[('03 Bunun arkasında ne olabilir? (olası açıklama)','css=[data-testid=ai-assist] .ai-sec:nth-of-type(3) h3'),('04 Ne doğrulamalıyız?','css=[data-testid=ai-assist] .ai-sec:nth-of-type(4) h3'),('05 Hedef önerisi: mevcut, izinli aralık, önerilen','css=[data-testid=ai-assist] .ai-sec:nth-of-type(5) h3'),('Öneri etiketi (karar değildir)','css=[data-testid=ai-assist] .ai-sec:nth-of-type(5) .ai-tag')],anchor='css=[data-testid=ai-assist] .ai-sec:nth-of-type(3)',dy=-60)
    shot(pg,'H05-ai-plan-aksiyonlar',[('06 12 aylık aksiyon planı','css=[data-testid=ai-assist] .ai-sec:nth-of-type(6) h3'),('Dönem ve kayıt sıklığı','css=[data-testid=ai-action-0] .ai-phase'),('Aksiyon adı','css=[data-testid=ai-action-0] .h3'),('Amaç / Neden önerildi','css=[data-testid=ai-action-0] p.body'),('Sorumlu rol ve iş birliği','css=[data-testid=ai-action-1] .h3')],anchor='css=[data-testid=ai-assist] .ai-sec:nth-of-type(6)',dy=-60)
    shot(pg,'H06-ai-plan-alt',[('07 Şirketten gereken destek','css=[data-testid=ai-assist] .ai-sec:nth-of-type(7) h3'),('08 Takvim ve izleme','css=[data-testid=ai-assist] .ai-sec:nth-of-type(8) h3'),('09 Korunması gerekenler','css=[data-testid=ai-assist] .ai-sec:nth-of-type(9) h3'),('10 Eksik veri ve varsayımlar','css=[data-testid=ai-assist] .ai-sec:nth-of-type(10) h3'),('Planı taslak olarak kullan','css=[data-testid=ai-use]')],anchor='css=[data-testid=ai-assist] .ai-sec:nth-of-type(7)',dy=-40)
    try:
        pg.locator('[data-testid=ai-assist] [data-testid=ai-action-1] input[type=checkbox]').check(); pg.wait_for_timeout(300)
        shot(pg,'H07-aksiyon-aktarimi',[('Aktarılmış aksiyon işareti','text=Aksiyonlara aktarıldı (planlandı)'),('Taslağa aktarılacaklara ekle (seçim kutusu)','css=[data-testid=ai-action-1] input[type=checkbox]'),('Seçilen aksiyonları taslağa aktar','btn=Seçilen aksiyonları taslağa aktar')],anchor='css=[data-testid=ai-use]',dy=120,block='end')
    except Exception as e: log.append('H07 '+repr(e)[:80])
    go(pg,'aksiyonlar'); pick(pg,'2026-ANA','SB002'); pg.get_by_role('button',name='aç',exact=True).first.click(); pg.wait_for_timeout(1200)
    try: pg.get_by_role('button',name='AI planını gör',exact=True).click(); pg.wait_for_timeout(1200)
    except Exception as e: log.append('A-ai '+repr(e)[:60])
    shot(pg,'A05-ai-planini-gor',[('Taslak (planlandı) durumu','css=[data-testid=action-draft]'),('Başlat','btn=Başlat'),('AI planını gizle / gör','btn=AI planını gizle'),('Öneri uyarısı (gerçekleşme ya da kanıt değildir)','css=[data-testid=action-ai-plan] p.caption'),('Plandaki aksiyon kartı','css=[data-testid=action-ai-plan] .ai-card')],anchor='css=[data-testid=action-draft]',dy=-140)
    # Şube müdürü
    login(pg,'sube'); go(pg,'',2500); shot(pg,'S00-genel-bakis',[('Şirket bilgisi','css=.kicker'),('Kurulum durumu','th=Adım'),('Nasıl çalışır','kicker=Nasıl çalışır')])
    go(pg,'birimler'); pick(pg,'2026-ANA','SB001')
    shot(pg,'S01-birim-sonuclari',[('Dönem','id=cycle'),('Birim','id=unit'),('Başlık: birim, dönem, madde sayısı, yanıt sayısı','css=h1.h2'),('Madde','th=Madde'),('Metrik (Top Box)','th=Metrik'),('Değer (birim)','th=Değer'),('Şirket Δ (fark)','th=Şirket Δ'),('n (yanıt sayısı)','th=n'),('Etkileşim','th=Etkileşim'),('Sorumluluk merkezi','th=Sorumluluk merkezi'),('Aday rol','th=Aday rol'),('Karar','th=Karar')])
    shot(pg,'S02-endeksler',[('Endeks','th=Endeks'),('Resmî HPW','th=Resmî HPW'),('Tanım sürümü · durum','th=Tanım sürümü · durum'),('Türetilmiş tahmin','th=Türetilmiş tahmin'),('Not','th=Not')],anchor='th=Endeks',dy=-120)
    go(pg,'hedefler'); pick(pg,'2026-ANA','SB001')
    shot(pg,'S03-hedefler',[('Dönem','id=cycle'),('Birim','id=unit'),('Hedef listesi','th=Madde'),('Durum','th=Durum'),('Yeni hedef: madde','id=item'),('Hedef değer','id=val'),('Öneriyi gör','btn=Öneriyi gör'),('Kurumsal uzlaştırma','kicker=Kurumsal uzlaştırma')])
    shot(pg,'S04-kurumsal-uzlastirma',[('Kurumsal uzlaştırma','kicker=Kurumsal uzlaştırma')],anchor='kicker=Kurumsal uzlaştırma',dy=-80)
    go(pg,'aksiyonlar'); pick(pg,'2026-ANA','SB001')
    shot(pg,'S05-aksiyonlar',[('Dönem','id=cycle'),('Birim','id=unit'),('Aksiyon','th=Aksiyon'),('Madde','th=Madde'),('Doğrulama','th=Doğrulama'),('Sağlık','th=Sağlık'),('Kayıt','th=Kayıt'),('Termin','th=Termin'),('aç','btn=aç'),('Yeni aksiyon','kicker=Yeni aksiyon'),('Aksiyonu aç','btn=Aksiyonu aç')])
    try:
        pg.get_by_role('button',name='aç',exact=True).first.click(); pg.wait_for_timeout(1200)
        shot(pg,'S06-aksiyon-detay',[('Gerçekleşme tarihi','label=Tarih'),('Katılım','label=Katılım'),('Kaydı ekle','btn=Kaydı ekle'),('Tamamlandı beyanı','btn=Tamamlandı beyanı'),('Duraklat','btn=Duraklat'),('Aksiyonu iptal et','btn=Aksiyonu iptal et'),('Sorumluyu devret','btn=Sorumluyu devret'),('Kanıt listesi','th=Tarih')],anchor='btn=Kaydı ekle',dy=-220)
        shot(pg,'S07-dagitimlar',[('Ana aksiyon dağıtımları','kicker=Ana aksiyon dağıtımları'),('Ana aksiyon','th=Ana aksiyon'),('Durum','th=Durum'),('Yerel yanıt','th=Yerel yanıt')],anchor='kicker=Ana aksiyon dağıtımları',dy=-80)
    except Exception as e: log.append('S06 '+repr(e)[:80])
    go(pg,'takip',2500); shot(pg,'S08-takip',[('Hedef','th=Madde'),('Başlangıç','th=Başlangıç'),('Hedef','th=Hedef'),('Takip sonucu','th=Takip'),('Sonuç','th=Sonuç')])
    go(pg,'dikkat',2500); shot(pg,'S09-dikkat',[('Bekleyen iş satırı','css=tbody tr'),('Tür','th=Tür'),('Durum','th=Durum'),('Termin','th=Termin')])
    # Aksiyon sorumlusu
    login(pg,'ekip'); go(pg,'aksiyonlar'); pick(pg,'2026-ANA','ALT001'); shot(pg,'E01-aksiyonlar',[('Aksiyon listesi','th=Aksiyon'),('Kayıt (karşılanan plan dönemi · olay)','th=Kayıt'),('Termin','th=Termin'),('aç','btn=aç')])
    try:
        pg.get_by_role('button',name='aç',exact=True).first.click(); pg.wait_for_timeout(1200)
        shot(pg,'E02-kayit-ekle',[('Tarih','label=Tarih'),('Katılım','label=Katılım'),('Kaydı ekle','btn=Kaydı ekle'),('Kanıt listesi','th=Tarih')],anchor='btn=Kaydı ekle',dy=-220)
    except Exception as e: log.append('E02 '+repr(e)[:80])
    go(pg,'dikkat',2500); shot(pg,'E03-dikkat',[('Bekleyen iş satırı','css=tbody tr'),('Tür','th=Tür'),('Termin','th=Termin')])
    # İK iş ortağı
    login(pg,'hrbp'); go(pg,'hedefler',2500); shot(pg,'B01-hrbp-hedefler',[('Birim seçimi (kapsam)','id=unit'),('Durum','th=Durum'),('Onayla','btn=Onayla'),('Reddet','btn=Reddet'),('Sorumluyu devret','btn=Sorumluyu devret')])
    go(pg,'aksiyonlar',2500)
    try:
        pg.get_by_role('button',name='aç',exact=True).first.click(); pg.wait_for_timeout(1200)
        shot(pg,'B02-hrbp-dogrulama',[('Doğrulama bölümü','kicker=Doğrulama'),('Doğrulandı','btn=Doğrulandı'),('İade et','btn=İade et')],anchor='kicker=Doğrulama',dy=-120)
    except Exception as e: log.append('B02 '+repr(e)[:80])
    go(pg,'dikkat',2500); shot(pg,'B03-hrbp-dikkat',[('Bekleyen işler','css=tbody tr'),('Tür','th=Tür')])
    # Bölge
    login(pg,'bolge'); go(pg,'birimler',2500); shot(pg,'R01-bolge-birimler',[('Birim seçimi (bölge ağacı)','id=unit'),('Madde','th=Madde'),('Değer','th=Değer'),('Şirket Δ','th=Şirket Δ')])
    go(pg,'aksiyonlar',2500); shot(pg,'R02-bolge-aksiyonlar',[('Birim seçimi','id=unit'),('Aksiyon','th=Aksiyon'),('Doğrulama','th=Doğrulama'),('aç','btn=aç')])
    go(pg,'dikkat',2500); shot(pg,'R03-bolge-dikkat',[('Bekleyen işler','css=tbody tr'),('Tür','th=Tür')])
    # Üst yönetim
    login(pg,'exec'); go(pg,'',2500); shot(pg,'Y01-yonetim-genel',[('Kurulum durumu','th=Adım'),('Kurumsal kontrol kulesi','kicker=Kurumsal kontrol kulesi')])
    shot(pg,'Y02-yonetim-kule',[('Kurumsal istek','th=Kurumsal istek'),('Kohort','th=Kohort'),('Ana aksiyon','th=Ana aksiyon'),('Merkezi kuyruk','th=Merkezi kuyruk'),('Aksiyonlar','th=Aksiyonlar'),('Kurumsal planlama: İstek öner','btn=İstek öner')],anchor='th=Kurumsal istek',dy=-120)
    go(pg,'birimler',2500); shot(pg,'Y03-yonetim-birimler',[('Birim seçimi','id=unit'),('Değer','th=Değer'),('Şirket Δ','th=Şirket Δ')])
    go(pg,'dikkat',2500); shot(pg,'Y04-yonetim-kuyruk',[('Merkezi karar kuyruğu','kicker=Merkezi karar kuyruğu'),('Kabul','btn=Kabul'),('Ret','btn=Ret')],anchor='kicker=Merkezi karar kuyruğu',dy=-80)
    # İzleyici
    login(pg,'izleyici'); go(pg,'birimler',2500); shot(pg,'V01-izleyici-birimler',[('Birim seçimi','id=unit'),('Madde','th=Madde'),('Değer','th=Değer'),('Karar','th=Karar')])
    go(pg,'hedefler',2500); shot(pg,'V02-izleyici-hedefler',[('Hedef listesi','th=Madde'),('Durum','th=Durum')])
    b.close()
json.dump(boxes,open('/tmp/k2/boxes.json','w'),ensure_ascii=False,indent=1); print('\n'.join(log))
