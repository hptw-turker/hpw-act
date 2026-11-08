from playwright.sync_api import sync_playwright
import os; p='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'../../apps/web/dist/hpw-act-prototip.html'))
ok=[]; bad=[]; ctr=[0]
def go(pg, url):
    ctr[0]+=1; u=url.replace('#', f'&r={ctr[0]}#'); pg.goto(u); pg.wait_for_timeout(300)
def check(name, cond): (ok if cond else bad).append(name)
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={'width':1440,'height':900}); pg.set_default_timeout(3000)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    # Ekranlar menüsü
    go(pg, p+'?aktor=hrbp#/')
    pg.select_option('#ekranlar', 'hpw_admin|/musteriler'); pg.wait_for_timeout(300)
    check('Ekranlar menüsü → Sistem Yöneticisi · Müşteriler', '/musteriler' in pg.url and 'Müşteriler' in pg.evaluate("document.getElementById('root').textContent"))
    # Hedefler
    go(pg, p+'?aktor=hrbp#/hedefler')
    import re as _re
    _t=pg.evaluate("document.getElementById('root').textContent"); _sup=float(_re.search(r'yerel öneriler (\d+[,.]\d+)', _t).group(1).replace(',','.'))
    pg.fill('#parent',str(round(_sup-0.5,1))); pg.click('button:has-text("Uzlaştır") >> nth=0'); pg.wait_for_timeout(300)
    check('Hedefler: Uzlaştır (SUPPORTED)', 'Destekleniyor' in pg.evaluate("document.getElementById('root').textContent"))
    pg.screenshot(path='/tmp/t-hedef.png')
    pg.click('button:has-text("Değiştir") >> nth=0'); pg.wait_for_timeout(200); check('Hedefler: Değiştir → düzenleme', pg.locator('table input[type=number]').count()>10)
    pg.fill('table input[type=number] >> nth=0', '99'); pg.click('button:has-text("Kaydet") >> nth=0'); pg.wait_for_timeout(200); check('Hedefler: aralık dışı değer reddi', 'aralık dışında' in pg.evaluate("document.getElementById('root').textContent"))
    _rng=pg.evaluate("document.querySelector('table tbody tr td:nth-child(4)').textContent"); _lo,_hi=[float(x.replace(',','.')) for x in _rng.split('–')]; _mid=str(round((_lo+_hi)/2*2)/2)
    pg.fill('table input[type=number] >> nth=0', _mid); pg.click('button:has-text("Kaydet") >> nth=0'); pg.wait_for_timeout(200); check('Hedefler: aralık içi kaydet', _mid.replace('.',',') in pg.evaluate("document.querySelector('table tbody tr').textContent"))
    pg.click('button:has-text("Uygun değil") >> nth=0'); pg.wait_for_timeout(200); check('Hedefler: istisna formu', pg.locator('#exc-text').count()==1)
    pg.fill('#exc-text','Kapanış söylentisi var'); pg.click('button:has-text("Talebi gönder") >> nth=0'); pg.wait_for_timeout(200); check('Hedefler: istisna gönder', 'İstisna talebi gönderildi' in pg.evaluate("document.getElementById('root').textContent"))
    pg.click('button:has-text("Eşzamanlı düzenlemeyi dene") >> nth=0'); pg.click('button:has-text("Hedefi onayla") >> nth=0'); pg.wait_for_timeout(400); check('Hedefler: 409', pg.locator('[role=alert]').count()==1)
    pg.click('button:has-text("Yeniden yükle") >> nth=0'); pg.click('button:has-text("Hedefi onayla") >> nth=0'); pg.wait_for_timeout(400); check('Hedefler: onay', 'Onaylandı' in pg.evaluate("document.getElementById('root').textContent"))
    pg.fill('#parent',str(round(_sup+15,1))); pg.click('button:has-text("Uzlaştır") >> nth=0'); pg.wait_for_timeout(300); check('Hedefler: desteklenmiyor', 'Mevcut planla desteklenmiyor' in pg.evaluate("document.getElementById('root').textContent"))
    pg.fill('#parent',str(round(_sup+2.5,1))); pg.click('button:has-text("Uzlaştır") >> nth=0'); pg.wait_for_timeout(300); check('Hedefler: GAP karar bekler', 'Önce fark için karar verin' in pg.evaluate("document.getElementById('root').textContent"))
    pg.click('button:has-text("Esnetmeyi bilerek kabul et") >> nth=0'); pg.wait_for_timeout(300); check('Hedefler: esnetme kararı → onay açılır', 'Önce fark için karar verin' not in pg.evaluate("document.getElementById('root').textContent") and 'uzlaştırma kaydına yazıldı' in pg.evaluate("document.getElementById('root').textContent"))
    # Şube müdürü
    go(pg, p+'?aktor=branch_manager#/hedefler'); pg.click('button:has-text("Kabul et") >> nth=0'); pg.wait_for_timeout(300); check('Şube: yerel hedef kabul (sürümlü kayıt)', 'kayıt lt-SUBE-KONAK-GUV-01' in pg.evaluate("document.getElementById('root').textContent")); pg.click('button:has-text("Değiştir") >> nth=0'); pg.wait_for_timeout(200)
    _inp=pg.locator('input[id^="lt-"]').first; _v=str(round(float(_inp.input_value())-1)); _inp.fill(_v); pg.click('button:has-text("Kaydet ve kabul et") >> nth=0'); pg.wait_for_timeout(300); check('Şube: ikinci yerel hedef (madde) değiştir+kabul', f'Kabul edildi: {_v},0' in pg.evaluate("document.getElementById('root').textContent") and pg.evaluate("document.getElementById('root').textContent").count('kayıt lt-SUBE-KONAK-')==2)
    # Kurumsal
    go(pg, p+'?aktor=ceo#/kurumsal'); pg.click('button:has-text("Değiştir") >> nth=0'); pg.fill('#corp-target','75'); pg.click('button:has-text("Uygula") >> nth=0'); pg.wait_for_timeout(100); check('Kurumsal: desteklenmiyor uyarısı', 'Mevcut planla desteklenmiyor' in pg.evaluate("document.getElementById('root').textContent"))
    pg.click('button:has-text("Değiştir") >> nth=0'); pg.fill('#corp-target','67'); pg.click('button:has-text("Uygula") >> nth=0'); pg.wait_for_timeout(100); check('Kurumsal: GAP seçenekleri', 'Esnetmeyi bilerek kabul et' in pg.evaluate("document.getElementById('root').textContent"))
    pg.click('button:has-text("Esnetmeyi bilerek kabul et") >> nth=0'); pg.click('button:has-text("Kurumsal hedefi onayla") >> nth=0'); pg.wait_for_timeout(200); check('Kurumsal: onay', 'Onaylandı: 67' in pg.evaluate("document.getElementById('root').textContent"))
    # Sonuçlar
    go(pg, p+'?aktor=hr_admin#/sonuclar'); pg.set_input_files('label.file input','/tmp/kanit-ornek.pdf'); pg.click('button:has-text("Doğrula ve önizle") >> nth=0'); pg.wait_for_timeout(500); check('Sonuçlar: paket algılandı (çıkarılan boyut, özel madde, mutabakat)', 'Dijital Dönüşüm' in pg.evaluate("document.getElementById('root').textContent") and 'OZL-01' in pg.evaluate("document.getElementById('root').textContent") and 'eşleşiyor' in pg.evaluate("document.getElementById('root').textContent"))
    pg.click('button:has-text("Yayımla") >> nth=0'); pg.wait_for_timeout(200); check('Sonuçlar: yayımla', 'Yayımlandı' in pg.evaluate("document.getElementById('root').textContent"))
    go(pg, p+'?aktor=hr_admin#/sonuclar'); pg.set_input_files('label.file input','/tmp/kanit-ornek.pdf'); pg.check('input[type=checkbox]'); pg.click('button:has-text("Doğrula ve önizle") >> nth=0'); pg.wait_for_timeout(400); check('Sonuçlar: bozuk Top Box paketi reddedilir', 'topbox_mismatch' in pg.evaluate("document.getElementById('root').textContent"))
    # Aksiyonlar + Kanıt (aynı kayıt): hedef kabul → aksiyon kabul → yapılandırılmış kayıt → beyan
    go(pg, p+'?aktor=branch_manager#/hedefler'); pg.wait_for_timeout(200)  # hedefler daha önce aynı oturumda kabul edildi (sessionStorage)
    pg.click('nav a[href="#/aksiyonlar"]'); pg.wait_for_timeout(400); check('Aksiyonlar: hedef kaydına bağlı öneriler', 'lt-SUBE-KONAK' in pg.evaluate("document.getElementById('root').textContent"))
    pg.click('button:has-text("Kabul et") >> nth=0'); pg.wait_for_timeout(300); check('Aksiyonlar: kabul → kayıt kimliği', 'Kabul edildi · kayıt act-lt-SUBE-KONAK' in pg.evaluate("document.getElementById('root').textContent"))
    pg.click('.rows > article:nth-child(2) .btn--secondary:has-text("Uygun değil")'); pg.click('button:has-text("Gönder") >> nth=0'); pg.wait_for_timeout(200); check('Aksiyonlar: uygun değil', 'Reddedildi' in pg.evaluate("document.getElementById('root').textContent"))
    pg.click('nav a[href="#/kanit"]'); pg.wait_for_timeout(400); check('Kanıt: aynı aksiyon kaydı', 'kayıt act-lt-SUBE-KONAK' in pg.evaluate("document.getElementById('root').textContent"))
    pg.fill('#log-date','2026-10-07'); pg.click('button:has-text("Kaydı ekle")'); pg.wait_for_timeout(200); pg.click('button:has-text("Kaydı ekle")'); pg.wait_for_timeout(200); check('Kanıt: aynı gerçekleşme iki kez sayılmaz', 'ikinci kez sayılmaz' in pg.evaluate("document.getElementById('root').textContent"))
    for d in ['2026-10-14','2026-10-21','2026-10-28','2026-11-04','2026-11-11','2026-11-18','2026-11-25']: pg.fill('#log-date',d); pg.click('button:has-text("Kaydı ekle")'); pg.wait_for_timeout(120)
    pg.fill('#log-date','2027-02-01'); pg.click('button:has-text("Kaydı ekle")'); pg.wait_for_timeout(200); check('Kanıt: pencere dışı tarih reddi', 'pencere dışında' in pg.evaluate("document.getElementById('root').textContent"))
    pg.click('button:has-text("Tamamlandı olarak işaretle")'); pg.wait_for_timeout(300); check('Kanıt: beyan → politika beyanla karşılandı (bağımsız doğrulama yok)', 'politika beyanla karşılandı' in pg.evaluate("document.getElementById('root').textContent"))
    # Yerel uygulamalar
    go(pg, p+'?aktor=hrbp#/yerel-uygulamalar'); pg.click('button:has-text("Toplu hatırlat") >> nth=0'); pg.wait_for_timeout(100); check('Yerel: hatırlat', 'hatırlatma gönderildi' in pg.evaluate("document.getElementById('root').textContent")); pg.click('button:has-text("Bölge müdürüne yükselt") >> nth=0'); check('Yerel: yükselt', 'iletildi' in pg.evaluate("document.getElementById('root').textContent"))
    # Karne
    go(pg, p+'?aktor=hrbp#/karne'); pg.click('button:has-text("Bugünkü organizasyon") >> nth=0'); pg.wait_for_timeout(200); check('Karne: görünüm', 'organizasyon değişikliği' in pg.evaluate("document.getElementById('root').textContent"))
    # Organizasyon
    go(pg, p+'?aktor=hr_admin#/organizasyon'); pg.click('.rows > article:nth-child(2) .btn:not(.btn--secondary)'); pg.wait_for_timeout(100); check('Organizasyon: onayla', 'onaylandı' in pg.evaluate("document.querySelector('.rows > article:nth-child(2)').textContent"))
    # Kullanıcılar
    go(pg, p+'?aktor=hr_admin#/kullanicilar'); pg.click('.rows .btn--secondary >> nth=0'); pg.click('button:has-text("Ata") >> nth=0'); pg.wait_for_timeout(100); check('Kullanıcılar: yeni sahip ata', 'Yeni sahip:' in pg.evaluate("document.getElementById('root').textContent"))
    # Ayarlar
    go(pg, p+'?aktor=hr_admin#/ayarlar'); pg.click('button:has-text("Kaydet (yeni sürüm)") >> nth=0'); pg.wait_for_timeout(100); check('Ayarlar: kaydet', 'Kaydedildi' in pg.evaluate("document.getElementById('root').textContent")); pg.click('button:has-text("Vazgeç") >> nth=0'); check('Ayarlar: vazgeç', 'Kaydedildi' not in pg.evaluate("document.getElementById('root').textContent"))
    # Metodoloji
    go(pg, p+'?aktor=hpw_methodologist#/metodoloji'); pg.click('button:has-text("Kararı kaydet") >> nth=0'); pg.click('button:has-text("Karşılaştırılabilir say") >> nth=0'); pg.wait_for_timeout(100); check('Metodoloji: iki karar', pg.inner_text('.display-xxl')=='0')
    # Dikkat kapatma anlamı
    go(pg, p+'?aktor=hrbp#/'); pg.click('.rows > article:nth-child(1) button.link'); pg.wait_for_timeout(100)
    pg.select_option('select[id^="d-"]','acknowledge'); pg.click('button:has-text("Uygula")'); pg.wait_for_timeout(200); check('Dikkat: karar konusu "okundu" ile kapanmaz', 'karar bekliyor' in pg.evaluate("document.getElementById('root').textContent") and pg.inner_text('.display-xxl')=='7')
    pg.click('.rows > article:nth-child(1) button.link'); pg.wait_for_timeout(100); pg.select_option('select[id^="d-"]','resolve'); pg.click('button:has-text("Uygula")'); pg.wait_for_timeout(200); check('Dikkat: kart tek başına çözülmez, asıl işlem gerekir (F31)', 'asıl işlemi' in pg.evaluate("document.getElementById('root').textContent") and pg.inner_text('.display-xxl')=='7')
    pg.screenshot(path='/tmp/t-home.png')
    # EN geçiş ve geri
    pg.click('button[aria-label="Dil"]'); pg.wait_for_timeout(300); check('EN', 'Attention queue' in pg.evaluate("document.getElementById('root').textContent")); pg.click('button[aria-label="Dil"]'); pg.wait_for_timeout(300); check('TR geri', 'Dikkat kuyruğu' in pg.evaluate("document.getElementById('root').textContent"))
    b.close()
print('OK', len(ok)); [print('  ✓', o) for o in ok]
print('HATA', len(bad)); [print('  ✗', o) for o in bad]
print('errors', errs)
