"""v2.9.1 kılavuz görüntüleri: HPW merkezi (MFA kurulumu, şirketler, ekip ve erişim, işlem geçmişi, şirket bağlam satırı, müdahale modu). Sırlar ve kurtarma kodları görüntüde maskelenir; hiçbir yere yazılmaz."""
import re, time, hmac, hashlib, base64, struct
from playwright.sync_api import sync_playwright
BASE='http://localhost:8787'; OUT='/tmp/guide/shots'
def totp(sec, dt=0):
    k=base64.b32decode(sec+'='*((8-len(sec)%8)%8)); st=int((time.time()+dt)//30); h=hmac.new(k,struct.pack('>Q',st),hashlib.sha1).digest(); o=h[-1]&15
    return str((struct.unpack('>I',h[o:o+4])[0]&0x7fffffff)%1000000).zfill(6)
answers=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1360,'height':860}, device_scale_factor=1.5); pg=ctx.new_page(); pg.set_default_timeout(15000)
    pg.on('dialog', lambda d: d.accept(answers.pop(0)) if answers else d.dismiss())
    pg.goto(BASE+'/#/giris'); pg.fill('#email','platform@demo.hpw-act.local'); pg.fill('#password','Demo-Platform-2026'); pg.get_by_role('button', name='Giriş yap').click(); pg.wait_for_url(re.compile('#/platform')); pg.wait_for_timeout(1500)
    sec=None
    if pg.get_by_role('button', name='Kurulumu başlat').count():
        pg.get_by_role('button', name='Kurulumu başlat').click(); pg.wait_for_timeout(600); sec=pg.locator('.mfa-secret').inner_text().replace(' ','')
        pg.evaluate("document.querySelector('.mfa-secret').textContent='XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX'"); pg.screenshot(path=f'{OUT}/03c-mfa-kurulum.png')
        pg.fill('#mfa-code', totp(sec)); pg.get_by_role('button', name='Doğrula ve kurulumu tamamla').click(); pg.wait_for_timeout(800)
        pg.evaluate("document.querySelectorAll('.recovery-codes li').forEach(li=>li.textContent='XXXXX-XXXXX')"); pg.screenshot(path=f'{OUT}/03d-mfa-kurtarma.png')
        pg.get_by_role('button', name='Kodları kaydettim, devam et').click(); pg.wait_for_timeout(2000)
    pg.screenshot(path=f'{OUT}/03-platform-musteriler.png')
    # v2.10.0: filtreli katalog, şirket detayı (kurulum, dönemler), onay penceresi
    pg.select_option('#f-sirala', 'kurulum'); pg.wait_for_timeout(500); pg.screenshot(path=f'{OUT}/03i-katalog.png')
    pg.locator('table tbody').get_by_role('link').first.click(); pg.wait_for_timeout(1800); pg.screenshot(path=f'{OUT}/03j-sirket-ozet.png')
    pg.get_by_role('tab', name='Kurulum').click(); pg.wait_for_timeout(900); pg.screenshot(path=f'{OUT}/03k-sirket-kurulum.png', full_page=True)
    pg.get_by_role('tab', name='Dönemler ve ilerleme').click(); pg.wait_for_timeout(700)
    if pg.get_by_role('button', name='İzlenen dönem yap').count(): pg.get_by_role('button', name='İzlenen dönem yap').first.click(); pg.wait_for_timeout(500); pg.screenshot(path=f'{OUT}/03l-onay-penceresi.png'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.get_by_role('link', name='← Merkeze dön').click(); pg.wait_for_timeout(1200)
    pg.get_by_role('tab', name='Ekip ve erişim').click(); pg.wait_for_timeout(900)
    opts=pg.locator('#as-tenant option').all_inner_texts(); 
    if len(opts)>1: pg.locator('#as-tenant').select_option(index=1); pg.wait_for_timeout(900)
    pg.screenshot(path=f'{OUT}/03e-ekip-erisim.png', full_page=True)
    pg.get_by_role('tab', name='İşlem geçmişi').click(); pg.wait_for_timeout(900); pg.screenshot(path=f'{OUT}/03f-islem-gecmisi.png')
    pg.get_by_role('tab', name='Şirketler').click(); pg.wait_for_timeout(1200); pg.get_by_role('button', name='Aç').first.click(); pg.wait_for_timeout(2500)
    el=pg.locator('.platform-bar'); el.scroll_into_view_if_needed(); pg.screenshot(path=f'{OUT}/03g-baglam-satiri.png')
    answers[:]=['Müşteri talebiyle yanlış girilen hedef kaydının düzeltilmesi (kılavuz örneği)','15']
    if pg.get_by_role('button', name='Müdahale modunu aç').count():
        pg.get_by_role('button', name='Müdahale modunu aç').click(); pg.wait_for_timeout(1500)
        if pg.get_by_text('Güvenlik için').count()==0 and pg.locator('.intervention-strip').count()==0: pass
        pg.wait_for_timeout(1500); pg.screenshot(path=f'{OUT}/03h-mudahale.png')
        if pg.get_by_role('button', name='Müdahaleyi bitir').count(): pg.get_by_role('button', name='Müdahaleyi bitir').click(); pg.wait_for_timeout(1500)
    print('ok', sec is not None, pg.locator('.intervention-strip').count())
    b.close()
