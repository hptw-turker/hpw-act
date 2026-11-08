import re
from playwright.sync_api import sync_playwright
BASE='http://localhost:8787'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1360,'height':860}, device_scale_factor=1.5); pg=ctx.new_page(); pg.set_default_timeout(15000); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(BASE+'/#/giris'); pg.fill('#email','platform@demo.hpw-act.local'); pg.fill('#password','Demo-Platform-2026'); pg.get_by_role('button', name='Giriş yap').click(); pg.wait_for_url(re.compile('#/platform')); pg.wait_for_timeout(2500)
    pg.screenshot(path='/tmp/guide/shots/03-platform-musteriler.png', full_page=False)
    el=pg.get_by_text('Test posta kutusu').first; el.scroll_into_view_if_needed(); pg.wait_for_timeout(500); pg.screenshot(path='/tmp/guide/shots/03b-platform-posta.png', full_page=False)
    print('tablo:', pg.locator('table').first.locator('tbody tr').count(), 'satır;', pg.locator('body').inner_text().count('şirket'))
    b.close()
