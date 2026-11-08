import json, time, hmac, hashlib, base64, struct, re
from playwright.sync_api import sync_playwright
src=open('/tmp/k2/capture.py',encoding='utf-8').read(); exec(src[:src.index('with sync_playwright() as p:')])
boxes.update(json.load(open('/tmp/k2/boxes.json')))
def totp(sec):
    k=base64.b32decode(sec+'='*((8-len(sec)%8)%8)); st=int(time.time()//30); h=hmac.new(k,struct.pack('>Q',st),hashlib.sha1).digest(); o=h[-1]&15
    return str((struct.unpack('>I',h[o:o+4])[0]&0x7fffffff)%1000000).zfill(6)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1360,'height':860}, device_scale_factor=1.5); pg=ctx.new_page(); pg.set_default_timeout(6000); pg.on('dialog', lambda d: d.dismiss())
    # HPW merkezi (MFA kurulumu; sır ve kurtarma kodları görüntüde maskelenir)
    login(pg,'platform'); pg.goto(BASE+'/app.html#/platform'); pg.wait_for_timeout(2500)
    if pg.get_by_role('button',name='Kurulumu başlat').count():
        pg.get_by_role('button',name='Kurulumu başlat').click(); pg.wait_for_timeout(700); sec=pg.locator('.mfa-secret').inner_text().replace(' ','')
        pg.evaluate("document.querySelector('.mfa-secret').textContent='XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX'"); shot(pg,'P00-mfa-kurulum',[('Doğrulama uygulamasına eklenecek anahtar (maskelendi)','css=.mfa-secret'),('6 haneli kod alanı','id=mfa-code'),('Doğrula ve kurulumu tamamla','btn=Doğrula ve kurulumu tamamla')])
        pg.fill('#mfa-code', totp(sec)); pg.get_by_role('button',name='Doğrula ve kurulumu tamamla').click(); pg.wait_for_timeout(900)
        pg.evaluate("document.querySelectorAll('.recovery-codes li').forEach(li=>li.textContent='XXXXX-XXXXX')"); shot(pg,'P00b-kurtarma-kodlari',[('Kurtarma kodları (maskelendi)','css=.recovery-codes'),('Kodları kaydettim, devam et','btn=Kodları kaydettim, devam et')])
        pg.get_by_role('button',name='Kodları kaydettim, devam et').click(); pg.wait_for_timeout(2000)
    shot(pg,'P01-musteriler',[('Sekmeler: Şirketler / Ekip ve erişim / İşlem geçmişi','css=[role=tab]'),('Sıralama / filtre','id=f-sirala'),('Şirket adı (bağlantı: detaya gider)','css=table tbody a'),('Şirket satırı: durum, kurulum ilerlemesi, üye ve davet sayıları','css=table tbody tr'),('Sütun başlıkları','css=table thead')])
    try:
        pg.locator('table tbody').get_by_role('link').first.click(); pg.wait_for_timeout(1800); shot(pg,'P02-sirket-ozet',[('Sekmeler: Özet / Kurulum / Dönemler ve ilerleme','css=[role=tab]'),('Şirket özeti','css=main h1, main .h2'),('Merkeze dön','link=← Merkeze dön')])
        pg.get_by_role('tab',name='Kurulum').click(); pg.wait_for_timeout(900); shot(pg,'P03-sirket-kurulum',[('Kurulum adımları tablosu','css=table'),('Adım sütunu','css=table th:nth-child(1)'),('Durum sütunu','css=table th:nth-child(2)')],anchor='css=table',dy=-120)
        pg.get_by_role('tab',name='Dönemler ve ilerleme').click(); pg.wait_for_timeout(900); shot(pg,'P04-sirket-donemler',[('Dönem listesi','css=table'),('İzlenen dönem yap','btn=İzlenen dönem yap')],anchor='css=table',dy=-120)
        pg.get_by_role('link',name='← Merkeze dön').click(); pg.wait_for_timeout(1200)
    except Exception as e: print('P02-04', repr(e)[:80])
    try:
        pg.get_by_role('tab',name='Ekip ve erişim').click(); pg.wait_for_timeout(900)
        if pg.locator('#as-tenant option').count()>1: pg.locator('#as-tenant').select_option(index=1); pg.wait_for_timeout(900)
        shot(pg,'P05-ekip-erisim',[('Personel listesi (rol, durum)','css=table'),('Şirket seçimi (atamalar)','id=as-tenant')])
        pg.get_by_role('tab',name='İşlem geçmişi').click(); pg.wait_for_timeout(900); shot(pg,'P06-islem-gecmisi',[('İşlem kayıtları','css=table'),('Sütunlar','css=table thead')])
        pg.get_by_role('tab',name='Şirketler').click(); pg.wait_for_timeout(1200); pg.get_by_role('button',name='Aç').first.click(); pg.wait_for_timeout(2500)
        shot(pg,'P07-sirket-ekraninda-hpw',[('HPW bağlam satırı (hangi şirkette, hangi rol)','css=.platform-bar'),('Müdahale modunu aç','btn=Müdahale modunu aç')])
    except Exception as e: print('P05-07', repr(e)[:80])
    # İK: sorumluluk haritası, dikkat/kuyruk, ana aksiyon
    login(pg,'ik'); go(pg,'organizasyon'); shot(pg,'I06-sorumluluk-haritasi',[('Madde / alan','th=Madde / alan'),('Merkez','th=Merkez'),('Rol','th=Rol'),('Kapsam','th=Kapsam'),('Geçerlilik','th=Geçerlilik'),('İstisna','th=İstisna')],anchor='th=Madde / alan',dy=-120)
    go(pg,'dikkat',2500); shot(pg,'I11-dikkat-ik',[('Önem','th=Önem'),('Konu','th=Konu'),('Tür','th=Tür'),('Birim','th=Birim'),('Öncelik','th=Öncelik'),('Durum','th=Durum'),('git (ilgili ekrana)','link=git'),('ertele','btn=ertele')])
    shot(pg,'I11b-merkezi-kuyruk',[('Merkezi karar kuyruğu','text=Merkezi karar kuyruğu'),('Tür','th=Tür'),('Birim','th=Birim'),('Kabul','btn=Kabul'),('Ret','btn=Ret')],anchor='text=Merkezi karar kuyruğu',dy=-80)
    go(pg,'aksiyonlar',2500); shot(pg,'I12-ana-aksiyon-yonetimi',[('Ana aksiyon','th=Ana aksiyon'),('Sürüm','th=Sürüm'),('Durum','th=Durum'),('Yerel yanıt','th=Yerel yanıt'),('Yerel uygulama','th=Yerel uygulama'),('Kod / Başlık / Ritim / Ufuk','label=Kod'),('Yayımla','btn=Yayımla'),('Dağıt','btn=Dağıt (648 birim)')],anchor='th=Ana aksiyon',dy=-120)
    # Şube müdürü (2025 dönemi: hedef ve aksiyonlar var)
    login(pg,'sube'); go(pg,'hedefler'); pick(pg,'2025-ANA','SB001')
    shot(pg,'S03-hedefler',[('Dönem','id=cycle'),('Birim','id=unit'),('Madde','th=Madde'),('Başlangıç','th=Başlangıç'),('Aralık','th=Aralık'),('Hedef','th=Hedef'),('Dayanak','th=Dayanak'),('Durum','th=Durum'),('Aksiyon','th=Aksiyon'),('Yeni hedef: madde','id=item'),('Hedef değer','id=val'),('Öneriyi gör','btn=Öneriyi gör')])
    shot(pg,'S04-kurumsal-uzlastirma',[('Kurumsal uzlaştırma','text=Kurumsal uzlaştırma')],anchor='text=Kurumsal uzlaştırma',dy=-80)
    shot(pg,'S10-yapay-zeka-destegi',[('Yapay zekâ desteği (isteğe bağlı)','text=Yapay zekâ desteği (isteğe bağlı)'),('Hedef seçimi','id=ai-target'),('Yapay zekâdan yardım al','btn=✨ Yapay zekâdan yardım al')],anchor='text=Yapay zekâ desteği (isteğe bağlı)',dy=-80)
    go(pg,'aksiyonlar'); pick(pg,'2025-ANA','SB001')
    shot(pg,'S05-aksiyonlar',[('Dönem','id=cycle'),('Birim','id=unit'),('Aksiyon','th=Aksiyon'),('Madde','th=Madde'),('Doğrulama','th=Doğrulama'),('Sağlık','th=Sağlık'),('Kayıt','th=Kayıt'),('Termin','th=Termin'),('aç','btn=aç'),('Yeni aksiyon: hedef','label=Hedef'),('Kütüphane şablonu','label=Kütüphane şablonu'),('Termin alanı','label=Termin'),('Aksiyonu aç','btn=Aksiyonu aç')])
    pg.get_by_role('button',name='aç',exact=True).first.click(); pg.wait_for_timeout(1200)
    shot(pg,'S06-aksiyon-detay',[('Tarih','label=Tarih'),('Katılımcı','label=Katılımcı'),('Olay anahtarı','label=Olay anahtarı (aynı gün ikinci olay)'),('Kaydı ekle','btn=Kaydı ekle'),('Tamamlandı beyanı','btn=Tamamlandı beyanı'),('Kanıt listesi: Tarih','th=Tarih'),('Katılımcı sütunu','th=Katılımcı'),('Geçerlilik','th=Geçerlilik')],anchor='btn=Kaydı ekle',dy=-260)
    shot(pg,'S07-dagitimlar',[('Ana aksiyon','th=Ana aksiyon'),('Sürüm','th=Sürüm'),('Durum','th=Durum'),('Yerel yanıt','th=Yerel yanıt'),('Yerel uygulama','th=Yerel uygulama')],anchor='th=Ana aksiyon',dy=-120)
    go(pg,'takip',2500); pick(pg,'2025-ANA','SB001'); shot(pg,'S08-takip',[('Dönem','label=Dönem'),('Birim','label=Birim'),('Takip dönemi','label=Takip dönemi'),('Hedef','th=Hedef'),('Başlangıç','th=Başlangıç'),('hedef','th=hedef')])
    go(pg,'dikkat',2500); shot(pg,'S09-dikkat',[('Önem','th=Önem'),('Konu','th=Konu'),('Konu sayısı','text=0 konu')])
    # Aksiyon sorumlusu
    login(pg,'ekip'); go(pg,'aksiyonlar'); pick(pg,'2025-ANA','ALT001'); shot(pg,'E01-aksiyonlar',[('Aksiyon','th=Aksiyon'),('Madde','th=Madde'),('Kayıt (karşılanan plan dönemi · olay)','th=Kayıt'),('Termin','th=Termin'),('aç','btn=aç')])
    try:
        pg.get_by_role('button',name='aç',exact=True).first.click(); pg.wait_for_timeout(1200)
        shot(pg,'E02-kayit-ekle',[('Tarih','label=Tarih'),('Katılımcı','label=Katılımcı'),('Olay anahtarı','label=Olay anahtarı (aynı gün ikinci olay)'),('Kaydı ekle','btn=Kaydı ekle'),('Kanıt listesi','th=Tarih')],anchor='btn=Kaydı ekle',dy=-260)
    except Exception as e: print('E02', repr(e)[:60])
    go(pg,'dikkat',2500); shot(pg,'E03-dikkat',[('Önem','th=Önem'),('Konu','th=Konu')])
    # İK iş ortağı
    login(pg,'hrbp'); go(pg,'hedefler',2500); pick(pg,'2025-ANA'); shot(pg,'B01-hrbp-hedefler',[('Birim seçimi (kapsam)','id=unit'),('Madde','th=Madde'),('Durum','th=Durum'),('Onayla','btn=Onayla'),('Reddet','btn=Reddet'),('Sorumluyu devret','btn=Sorumluyu devret')])
    go(pg,'aksiyonlar',2500); pick(pg,'2025-ANA')
    try:
        pg.get_by_role('button',name='aç',exact=True).first.click(); pg.wait_for_timeout(1200)
        shot(pg,'B02-hrbp-dogrulama',[('Doğrulama bölümü','text=Doğrulama'),('Doğrulandı','btn=Doğrulandı'),('İade et','btn=İade et'),('Kanıt listesi','th=Tarih')],anchor='btn=Kaydı ekle',dy=-260)
    except Exception as e: print('B02', repr(e)[:60])
    # Bölge
    login(pg,'bolge'); go(pg,'aksiyonlar',2500); pick(pg,'2025-ANA'); shot(pg,'R02-bolge-aksiyonlar',[('Birim seçimi (bölge ağacı)','id=unit'),('Aksiyon','th=Aksiyon'),('Doğrulama','th=Doğrulama'),('Sağlık','th=Sağlık'),('aç','btn=aç')])
    # Üst yönetim
    login(pg,'exec'); go(pg,'dikkat',2500); shot(pg,'Y04-yonetim-kuyruk',[('Önem','th=Önem'),('Konu','th=Konu'),('Merkezi karar kuyruğu','text=Merkezi karar kuyruğu'),('Kabul','btn=Kabul'),('Ret','btn=Ret')])
    b.close()
json.dump(boxes,open('/tmp/k2/boxes.json','w'),ensure_ascii=False,indent=1); print('BITTI')
