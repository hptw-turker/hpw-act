from playwright.sync_api import sync_playwright
import openpyxl, os, sys
import os; p='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'../../apps/web/dist/hpw-act-prototip.html'))
def fill(path, sheet, rows, clear=True):
    wb=openpyxl.load_workbook(path); ws=wb[sheet]
    if clear and ws.max_row>1: ws.delete_rows(2, ws.max_row-1)
    hdr=[c.value for c in ws[1]]
    for r in rows: ws.append([r.get(h,'') for h in hdr])
    wb.save(path); return path
def grab(dl, name):
    dst=f'/tmp/{name}.xlsx'; dl.value.save_as(dst); return dst
ok=[]
def check(n, c): ok.append((n, bool(c))); print(('OK ' if c else 'HATA ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=b.new_context(accept_downloads=True, viewport={'width':1440,'height':900}); pg=ctx.new_page(); pg.set_default_timeout(10000)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(p+'?aktor=hr_admin#/excel'); pg.wait_for_selector('h1:has-text("Organizasyon")')
    with pg.expect_download() as dl: pg.click('button:has-text("Şablonu indir")')
    f=grab(dl,'org'); check('org şablonu gerçek xlsx', os.path.getsize(f)>5000 and 'Birimler' in openpyxl.load_workbook(f).sheetnames)
    fill(f,'Birim_Tipleri',[{'tenant_code':'ATLAS','unit_type_code':'ROOT','label':'Genel Müdürlük'},{'tenant_code':'ATLAS','unit_type_code':'SITE','label':'Şube'}])
    fill(f,'Birimler',[{'tenant_code':'ATLAS','operation':'CREATE','unit_code':'HQ','unit_name':'Genel Müdürlük','unit_type_code':'ROOT','valid_from':'2026-01-01'},{'tenant_code':'ATLAS','operation':'CREATE','unit_code':'KONAK','unit_name':'Konak Şubesi','unit_type_code':'SITE','valid_from':'2026-01-01'},{'tenant_code':'ATLAS','operation':'CREATE','unit_code':'HATALI','unit_name':'x','unit_type_code':'YOK','valid_from':'2026-01-01'}])
    fill(f,'Iliskiler',[{'tenant_code':'ATLAS','operation':'CREATE','hierarchy_code':'SURVEY','child_unit':'KONAK','parent_unit':'HQ','relation_type':'REPORTS_TO','valid_from':'2026-01-01'}])
    fill(f,'Org_Rolleri',[{'tenant_code':'ATLAS','operation':'CREATE','role_code':'ROLE_KONAK','unit_code':'KONAK','title':'Şube Müdürü','permission_profile':'UNIT_MANAGER','valid_from':'2026-01-01'}])
    pg.set_input_files('input[type=file]', f); pg.click('button:has-text("Doğrula ve önizle")'); pg.wait_for_selector('text=Reddedildi'); check('org: hatalı satır (unit_type_unknown) reddedildi', 'unit_type_unknown' in pg.evaluate("document.body.textContent"))
    with pg.expect_download() as dl2: pg.click('button:has-text("Hata satırlarını indir")')
    e=grab(dl2,'hata'); check('hata dosyası xlsx', 'HATALAR' in openpyxl.load_workbook(e).sheetnames)
    wb=openpyxl.load_workbook(f); wb['Birimler'].delete_rows(4); f2=f.replace('.xlsx','-2.xlsx'); wb.save(f2)
    pg.set_input_files('input[type=file]', f2); pg.click('button:has-text("Doğrula ve önizle")'); pg.wait_for_selector('text=Doğrulandı'); pg.click('button:has-text("Onayla ve işle")'); pg.wait_for_selector('td:has-text("ROLE_KONAK")'); check('org onaylandı ve listelendi', True)
    pg.click('button.link:has-text("Soru seti")'); pg.wait_for_selector('h1:has-text("Soru seti")')
    with pg.expect_download() as dl: pg.click('button:has-text("Şablonu indir")')
    ip=grab(dl,'soru'); wb=openpyxl.load_workbook(ip); ws=wb['Maddeler']
    for r in ws.iter_rows(min_row=2):
        if str(r[1].value).startswith('DIJ-'): r[7].value='EXCLUDED'
    ws.append(['ATLAS','OZL-01','CUSTOM','OZL','Şubemdeki kadro planı müşteri yoğunluğuyla uyumludur.','','L5','INCLUDED','TARGETABLE','central_function']); ws.append(['ATLAS','OZL-02','CUSTOM','OZL','Açık uçlu bir soru metni.','','MULTI','INCLUDED','TARGETABLE','']); wb.save(ip)
    pg.set_input_files('input[type=file]', ip); pg.click('button:has-text("Doğrula ve önizle")'); pg.wait_for_selector('text=Reddedildi'); check('soru seti: desteklenmeyen ölçek reddedildi', 'unsupported_scale' in pg.evaluate("document.body.textContent"))
    wb=openpyxl.load_workbook(ip); wb['Maddeler'].delete_rows(wb['Maddeler'].max_row); ip2=ip.replace('.xlsx','-2.xlsx'); wb.save(ip2)
    pg.set_input_files('input[type=file]', ip2); pg.click('button:has-text("Doğrula ve önizle")'); pg.wait_for_selector('text=Doğrulandı'); pg.click('button:has-text("Onayla ve işle")'); pg.wait_for_selector('text=Yayımlı soru seti'); mt=pg.evaluate("document.querySelector('main').parentElement.textContent"); check('soru seti yayımlandı (ek soru OZL-01, DIJ çıkarıldı)', 'OZL-01' in mt and 'DIJ-01' not in mt)
    pg.click('button.link:has-text("Anket sonuçları")'); pg.wait_for_selector('h1:has-text("Anket sonuçları")')
    with pg.expect_download() as dl: pg.click('button:has-text("Şablonu indir")')
    rp=grab(dl,'sonuc'); wb=openpyxl.load_workbook(rp); ws=wb['Sonuclar']; dws=wb['Dagilimlar']; k=0
    for r in ws.iter_rows(min_row=2):
        if r[2].value!='KONAK': continue
        mc=str(r[3].value); n=32; k+=1
        if mc.endswith('_NPS'): r[4].value='OBSERVED'; r[5].value=n; r[6].value='50'; dws.append(['ATLAS','2026-ANA','KONAK',mc,'0',8]); dws.append(['ATLAS','2026-ANA','KONAK',mc,'10',24])
        elif mc.startswith('BAG-03'): r[4].value='OBSERVED'; r[5].value=n; r[6].value='75'; dws.append(['ATLAS','2026-ANA','KONAK',mc,'0',8]); dws.append(['ATLAS','2026-ANA','KONAK',mc,'10',24])
        else: r[4].value='OBSERVED'; r[5].value=n; r[6].value='75'; dws.append(['ATLAS','2026-ANA','KONAK',mc,'2',8]); dws.append(['ATLAS','2026-ANA','KONAK',mc,'5',24])
    for r in ws.iter_rows(min_row=2):
        if r[2].value=='HQ' and str(r[3].value)=='GUV-01_TB': r[4].value='SUPPRESSED'; r[5].value=4; r[6].value=55
    wb.save(rp)
    pg.set_input_files('input[type=file]', rp); pg.click('button:has-text("Doğrula ve önizle")'); pg.wait_for_selector('text=Reddedildi'); check('sonuç: gizli hücrede sayı reddedildi', 'suppressed_value_present' in pg.evaluate("document.body.textContent"))
    wb=openpyxl.load_workbook(rp)
    for r in wb['Sonuclar'].iter_rows(min_row=2):
        if r[2].value=='HQ' and str(r[3].value)=='GUV-01_TB': r[6].value=None
    rp2=rp.replace('.xlsx','-2.xlsx'); wb.save(rp2)
    pg.set_input_files('input[type=file]', rp2); pg.click('button:has-text("Doğrula ve önizle")'); pg.wait_for_selector('text=Doğrulandı'); pg.click('button:has-text("Onayla ve işle")'); pg.wait_for_selector('text=paket sürümü 1'); check(f'sonuç yayımlandı ({k} metrik, dağılımdan yeniden hesap)', True)
    pg.click('button.link:has-text("Kullanıcılar ve davet")'); pg.wait_for_selector('h1:has-text("Kullanıcılar")')
    with pg.expect_download() as dl: pg.click('button:has-text("Şablonu indir")')
    up=grab(dl,'kullanici'); fill(up,'Kullanicilar',[{'tenant_code':'ATLAS','operation':'CREATE','email':'ayse@atlas.test','display_name':'Ayşe Yılmaz','locale':'tr','login_method':'LOCAL_PASSWORD','invite_requested':'YES'}]); fill(up,'Rol_Atamalari',[{'tenant_code':'ATLAS','operation':'CREATE','email':'ayse@atlas.test','role_code':'ROLE_KONAK','assignment_kind':'PRIMARY','valid_from':'2026-01-01'}])
    pg.set_input_files('input[type=file]', up); pg.click('button:has-text("Doğrula ve önizle")'); pg.wait_for_selector('text=Doğrulandı'); pg.click('button:has-text("Onayla ve işle")'); pg.wait_for_selector('td:has-text("ayse@atlas.test")')
    pg.click('button:has-text("Davetleri gönder")'); pg.wait_for_selector('text=davet gönderildi'); check('davet gönderildi; profil rolden UNIT_MANAGER', 'UNIT_MANAGER' in pg.evaluate("document.body.textContent"))
    pg.click('button.link:has-text("Gelen kutusu")'); pg.wait_for_selector('td:has-text("ayse@atlas.test")'); pg.click('button.link:has-text("aç")'); pg.wait_for_selector('#ipw'); pg.fill('#ipw','Parola12345'); pg.fill('#ipw2','Parola12345'); pg.click('button:has-text("Bağlantıyı aç")'); pg.wait_for_selector('text=hesap açıldı'); check('davet kabul edildi (tek kullanımlık bağlantı)', True)
    pg.goto(p+'?aktor=hrbp#/birimler'); pg.wait_for_timeout(1200); txt=pg.evaluate("document.body.textContent"); check('Birimler ekranında yüklenen Konak sonuçları ve OZL-01', 'yüklenen · 2026-ANA' in txt and 'OZL-01' in txt)
    pg.screenshot(path='/tmp/x-units.png'); pg.goto(p+'?aktor=hr_admin#/excel'); pg.wait_for_timeout(800); pg.screenshot(path='/tmp/x-excel.png')
    check('sayfa hatası yok', not errs); print(errs[:2])
    b.close()
print('OK', sum(1 for _,c in ok if c), 'HATA', sum(1 for _,c in ok if not c))
