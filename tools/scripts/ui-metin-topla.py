import re, json, os
from playwright.sync_api import sync_playwright
import os; p='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'../../apps/web/dist/hpw-act-prototip.html'))
personas=json.load(open(os.path.join(os.path.dirname(__file__),'../guides/personas.json')))
keys={}
JS="""() => { const w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const out=[]; let n; while((n=w.nextNode())){ const s=n.data.replace(/\\s+/g,' ').trim(); if(s) out.push(s.replace(/\\d[\\d.,:/]*/g,'#')); } return out; }"""
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={'width':1280,'height':800}); pg.set_default_timeout(2500)
    def grab(tag):
        for s in pg.evaluate(JS): keys.setdefault(s, tag)
    def do(fn):
        try: fn()
        except Exception as e: print('atlandı', str(e)[:70])
    for per in personas:
        pid=per['id']
        pg.goto(f'{p}?aktor={pid}#/giris'); pg.wait_for_timeout(150); grab(f'{pid} giris')
        for r in per['nav']:
            pg.goto(f'{p}?aktor={pid}#{r}'); pg.wait_for_timeout(200); grab(f'{pid} {r}')
            if r=='/' and per['id'] in ('hrbp','ceo'): do(lambda: (pg.click('.rows > article:nth-child(1) button.link'), pg.wait_for_timeout(150), grab('home dismiss')))
            if r=='/hedefler' and per['scope']!='unit':
                do(lambda: (pg.click('text=Dağıtımı hesapla'), pg.wait_for_timeout(200), grab('hedef hesap')))
                do(lambda: (pg.click('text=Değiştir'), pg.wait_for_timeout(150), grab('hedef edit'), pg.click('text=Vazgeç'), pg.wait_for_timeout(100)))
                do(lambda: (pg.click('text=Uygun değil'), pg.wait_for_timeout(150), grab('hedef exc'), pg.fill('#exc-text','Kapanış bekleniyor'), pg.click('text=Talebi gönder'), pg.wait_for_timeout(150), grab('hedef exc sent')))
                do(lambda: (pg.click('text=Eşzamanlı düzenlemeyi dene'), pg.click('text=Hedefi onayla'), pg.wait_for_timeout(300), grab('hedef 409'), pg.click('text=Yeniden yükle'), pg.click('text=Hedefi onayla'), pg.wait_for_timeout(300), grab('hedef onay')))
                do(lambda: (pg.fill('#parent','80'), pg.click('text=Dağıtımı hesapla'), pg.wait_for_timeout(200), grab('hedef infeasible')))
            if r=='/hedefler' and per['scope']=='unit':
                do(lambda: (pg.click('text=Uygun değil'), pg.wait_for_timeout(150), grab('unit exc'), pg.click('text=Vazgeç'), pg.click('text=Kabul et'), pg.wait_for_timeout(300), grab('unit accept')))
            if r=='/aksiyonlar':
                do(lambda: (pg.click('.rows > article:nth-child(1) .btn--secondary:has-text("Değiştir")'), pg.wait_for_timeout(150), grab('aksiyon edit'), pg.click('text=Kaydet ve kabul et'), pg.wait_for_timeout(150), grab('aksiyon accepted')))
                do(lambda: (pg.click('.rows > article:nth-child(3) .btn--secondary:has-text("Uygun değil")'), pg.wait_for_timeout(150), grab('aksiyon ret'), pg.click('text=Gönder'), pg.wait_for_timeout(150), grab('aksiyon declined')))
            if r=='/kanit':
                do(lambda: (pg.set_input_files('label.file input','/tmp/kanit-ornek.pdf'), pg.wait_for_timeout(150), pg.click('text=Tamamlandı olarak işaretle'), pg.wait_for_timeout(150), grab('kanit beyan'), pg.select_option('#role','verifier'), pg.click('text=Doğrula'), pg.wait_for_timeout(200), grab('kanit verified')))
            if r=='/sonuclar':
                do(lambda: (pg.set_input_files('label.file input','/tmp/kanit-ornek.pdf'), pg.click('text=Doğrula ve önizle'), pg.wait_for_timeout(150), grab('import validated'), pg.click('text=İçe al'), pg.wait_for_timeout(150), grab('import done')))
            if r=='/kurumsal':
                do(lambda: (pg.click('text=Değiştir'), pg.wait_for_timeout(150), grab('corp edit'), pg.fill('#corp-target','75'), pg.wait_for_timeout(100), grab('corp infeasible'), pg.fill('#corp-target','69'), pg.click('text=Uygula'), pg.click('text=Kurumsal hedefi onayla'), pg.wait_for_timeout(150), grab('corp approved')))
            if r=='/kullanicilar':
                do(lambda: (pg.click('.rows .btn--secondary >> nth=0'), pg.wait_for_timeout(150), grab('users choose'), pg.click('text=Ata'), pg.wait_for_timeout(150), grab('users assigned')))
            if r=='/ayarlar':
                do(lambda: (pg.click('text=Kaydet (yeni sürüm)'), pg.wait_for_timeout(150), grab('settings saved')))
            if r=='/metodoloji':
                do(lambda: (pg.click('text=Kararı kaydet'), pg.click('text=Karşılaştırılabilir say'), pg.wait_for_timeout(150), grab('meth decided')))
            if r=='/organizasyon':
                do(lambda: (pg.click('.rows > article:nth-child(2) .btn:not(.btn--secondary)'), pg.click('.rows > article:nth-child(3) .btn--secondary'), pg.wait_for_timeout(150), grab('org decided')))
            if r=='/yerel-uygulamalar':
                do(lambda: (pg.click('text=Toplu hatırlat'), pg.wait_for_timeout(100), grab('exec remind'), pg.click('text=Bölge müdürüne yükselt'), pg.wait_for_timeout(100), grab('exec escalate')))
            if r=='/karne':
                do(lambda: (pg.click('text=Bugünkü organizasyon'), pg.wait_for_timeout(150), grab('karne current')))
        pg.goto(f'{p}?aktor={pid}#/denetim' if pid!='hpw_auditor' else f'{p}?aktor={pid}#/kurumsal'); pg.wait_for_timeout(150); grab(f'{pid} guard')
    b.close()
open('/tmp/kanit-ornek.pdf','wb').write(b'%PDF-1.4\n')
json.dump(keys, open('/tmp/tr-keys.json','w',encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(keys), 'metin')
