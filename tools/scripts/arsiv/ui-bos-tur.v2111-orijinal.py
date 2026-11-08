"""BOŞ BAŞLANGIÇ'tan tam tarayıcı turu (Playwright): platform admin → Müşteriler → Yeni şirket → Aç → Genel bakış → Organizasyon (ekran + Excel) → Soru seti → Dönem → Sonuç Excel → Kullanıcılar → davet → kabul → Birim sonuçları → iki hedef → aksiyon → kanıt → beyan → doğrulama → 2. dönem → takip (ikinci hedef seçili) → ikinci şirket → izolasyon → çıkış/yeniden giriş → parola sıfırlama.
Kullanım: BASE=http://localhost:8788 MAIL_DIR=apps/api/var/mail-bos SETUP_KEY=... python3 tools/scripts/ui-bos-tur.py"""
import os, re, sys, json, glob, time, io, hmac, hashlib, base64, struct
import requests, openpyxl
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8788'); MAIL = os.environ.get('MAIL_DIR', 'apps/api/var/mail-bos'); KEY = os.environ.get('SETUP_KEY', ''); ENTRY = os.environ.get('ENTRY', '')  # ENTRY: paket kökündeki index.html yolu (file://)
OUT = os.environ.get('OUT', 'apps/api/var/test-ciktilari'); os.makedirs(OUT, exist_ok=True); KEY_FILE = os.environ.get('KEY_FILE', '')
S = 'T' + str(int(time.time()))[-5:]; DOM = f"{S.lower()}.bos.test"; PW = 'Bos-Parola-2026'; PW2 = 'Yeni-Bos-Parola-77'
steps = []

def totp(secret_b32, dt=0):
    """RFC 6238 (HMAC-SHA1, 30 sn, 6 hane) — tur, gerçek bir doğrulama uygulaması gibi kod üretir"""
    key = base64.b32decode(secret_b32.replace(' ', '').upper() + '=' * ((8 - len(secret_b32.replace(' ', '')) % 8) % 8))
    step = int((time.time() + dt) // 30); h = hmac.new(key, struct.pack('>Q', step), hashlib.sha1).digest(); o = h[-1] & 15
    return str((struct.unpack('>I', h[o:o + 4])[0] & 0x7fffffff) % 1000000).zfill(6)
MFA = {}
def mfa_gate(pg, email):
    """v2.9.0: HPW personeli girişinde iki adımlı doğrulama kurulumu (ilk giriş) ya da kod girişi"""
    pg.wait_for_timeout(700)
    if pg.get_by_role('button', name='Kurulumu başlat').count():
        pg.get_by_role('button', name='Kurulumu başlat').click(); pg.wait_for_timeout(500); MFA[email] = pg.locator('.mfa-secret').inner_text().replace(' ', '')
        if os.environ.get('MFA_SECRET_OUT'): open(os.environ['MFA_SECRET_OUT'], 'w').write(MFA[email])  # yalnız yükseltme sınaması için geçici dosya; kanıt dizinine yazılmaz
        pg.fill('#mfa-code', totp(MFA[email])); pg.get_by_role('button', name='Doğrula ve kurulumu tamamla').click(); pg.wait_for_timeout(700)
        n = pg.locator('.recovery-codes li').count(); pg.get_by_role('button', name='Kodları kaydettim, devam et').click(); pg.wait_for_timeout(1200); return n
    if pg.get_by_role('button', name='Girişi tamamla').count():
        for dt in (0, 30):
            pg.fill('#mfa-code', totp(MFA[email], dt)); pg.get_by_role('button', name='Girişi tamamla').click(); pg.wait_for_timeout(1200)
            if not pg.get_by_role('button', name='Girişi tamamla').count(): break
    return None

def ok(name, cond=True, note=''):
    steps.append((name, bool(cond), note)); print(('OK  ' if cond else 'FAIL'), name, note[:160])
    if not cond: raise SystemExit('DUR: ' + name + ' ' + note)
def sel_by_text(page, selector, text):
    for o in page.locator(f'{selector} option').all():
        if text in o.inner_text(): page.select_option(selector, o.get_attribute('value')); return True
    return False
def token_for(email, kind):
    files = sorted(glob.glob(f'{MAIL}/*.eml'), key=os.path.getmtime)
    for f in reversed(files):
        t = open(f, encoding='utf-8').read()
        if f'To: {email}\n' in t and f'#/{kind}/' in t: return re.search(rf'#/{kind}/([A-Za-z0-9_-]+)', t).group(1)
    return None
# 0 güvenli ilk admin: giriş görünümündeki tek seferlik formdan (ENTRY verilmişse paket kökündeki index.html'den başlanır)
UI_BOOT = bool(ENTRY)
if not UI_BOOT:
    r = requests.post(f'{BASE}/api/platform/bootstrap', json={'email': 'admin@hpw.bos.test', 'password': 'Bos-Admin-2026', 'displayName': 'HPW Yönetici', 'setupKey': KEY}); ok('0 bootstrap ilk platform admin (API, SETUP_KEY)', r.status_code in (200, 409), str(r.status_code))
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1440, 'height': 1000}); pg = ctx.new_page(); pg.set_default_timeout(15000)
    shots = 0
    def shot(n):
        global shots; shots += 1; pg.screenshot(path=f'{OUT}/tur-{shots:02d}-{n}.png', full_page=False)
    if ENTRY:
        pg.goto('file://' + os.path.abspath(ENTRY)); ok('E1 paket kökündeki index.html açıldı (file://)', 'Aynı gerçek uygulamanın girişi' in pg.locator('main').inner_text())
        pg.wait_for_url(re.compile(re.escape(BASE) + '/app.html'), timeout=20000); ok('E2 index.html ortam/sürüm doğrulayıp gerçek uygulamaya geçti', pg.url.startswith(BASE)); shot('index-gecis')
        pg.goto(f'{BASE}/#/giris'); pg.wait_for_timeout(1200); already = pg.get_by_text('İlk kurulum · HPW yöneticisi').count() == 0
        ok('E3 giriş ekranı BOŞ kurulumda ilk yönetici formunu gösteriyor', True if already else pg.get_by_text('İlk kurulum · HPW yöneticisi').count() == 1, 'zaten kurulu (önceki koşu)' if already else ''); shot('ilk-kurulum')
        key = open(KEY_FILE, encoding='utf-8').read().strip() if KEY_FILE else KEY
        if not already: pg.fill('#b-email', 'admin@hpw.bos.test'); pg.fill('#b-name', 'HPW Yönetici'); pg.fill('#b-pw', 'Bos-Admin-2026'); pg.fill('#b-pw2', 'Bos-Admin-2026')
        if not already and pg.locator('#b-key').count(): pg.fill('#b-key', 'yanlis-anahtar'); pg.get_by_role('button', name='İlk yöneticiyi kur').click(); pg.wait_for_timeout(1000); ok('E4 yanlış kurulum anahtarı reddedildi', pg.get_by_text(re.compile('setup_key|anahtar', re.I)).count() >= 1); pg.fill('#b-key', key)
        if not already: pg.get_by_role('button', name='İlk yöneticiyi kur').click(); pg.wait_for_timeout(1500); ok('E5 ilk yönetici ekrandan kuruldu', pg.get_by_text('İlk HPW yöneticisi kuruldu').count() == 1)
        r2 = requests.post(f'{BASE}/api/platform/bootstrap', json={'email': 'ikinci@hpw.bos.test', 'password': 'Bos-Admin-2026', 'setupKey': key}); ok('0b ikinci bootstrap reddedilir', r2.status_code == 409)
    # 1 giriş
    pg.goto(f'{BASE}/#/giris'); pg.fill('#email', 'admin@hpw.bos.test'); pg.fill('#password', 'Bos-Admin-2026'); pg.get_by_role('button', name='Giriş yap').click(); pg.wait_for_url(re.compile('#/platform')); rc = mfa_gate(pg, 'admin@hpw.bos.test'); ok('1a iki adımlı doğrulama kuruldu (10 kurtarma kodu) ve merkez açıldı', rc == 10 and pg.get_by_role('tab', name='Şirketler').count() == 1); ok('1 platform girişi → Müşteriler'); shot('platform')
    ok('1b BOŞ: müşteri listesi boş', pg.get_by_role('button', name='Aç').count() == 0 and 'HENÜZ MÜŞTERİ YOK' in pg.locator('table tbody').first.inner_text().upper())
    # 2 yeni şirket → Aç → Genel bakış
    pg.fill('#code', f'ALFA{S}'); pg.fill('#name', 'Alfa Perakende (tur)'); pg.fill('#adminEmail', f'ik@alfa.{DOM}'); pg.fill('#adminName', 'Alfa İK'); pg.get_by_role('button', name='Şirketi oluştur').click(); pg.wait_for_timeout(800)
    ok('2 yeni şirket oluşturuldu', pg.get_by_role('button', name='Aç').count() == 1)
    pg.locator('table').first.locator('tbody tr').first.get_by_role('button', name='Aç').click(); pg.wait_for_url(re.compile('#/t/')); tid = re.search(r'#/t/([0-9a-f-]+)', pg.url).group(1)
    pg.wait_for_timeout(1500); shot('genel-bakis-bos'); ok('2b Aç → Genel bakış', pg.get_by_text('Kurulum durumu').count() == 1, pg.locator('main').inner_text()[:200])
    ok('2c Genel bakış: tüm adımlar eksik, ölçüm yok', pg.get_by_text('Henüz ölçüm yok').count() == 1 and pg.locator('td:text-is("eksik")').count() >= 4)
    ok('2d ortam etiketi başlıkta', pg.get_by_text('[BOS]').count() == 1)
    # 3 Organizasyon: ekrandan birim ekle + Excel ile toplu
    pg.locator('nav >> text=Organizasyon').click(); pg.wait_for_url(re.compile('organizasyon'))
    pg.fill('#ucode', 'HQ'); pg.fill('#uname', 'Genel Müdürlük'); pg.fill('#utype', 'ROOT'); pg.fill('#utypel', 'Genel Müdürlük'); pg.get_by_role('button', name='Birimi ekle').click(); pg.wait_for_timeout(600)
    ok('3 ekrandan birim eklendi (HQ)', pg.get_by_text('Genel Müdürlük').count() >= 1)
    pg.get_by_role('link', name=re.compile('Excel')).first.click(); pg.wait_for_url(re.compile('yukle/org'))
    with pg.expect_download() as dl: pg.get_by_role('button', name=re.compile('Şablonu indir')).click()
    path = f'/tmp/org-sablon-{S}.xlsx'; dl.value.save_as(path); wb = openpyxl.load_workbook(path); ok('3b org şablonu indirildi (gerçek XLSX)', {'Birimler', 'Org_Rolleri', 'KILAVUZ'} <= set(wb.sheetnames), ','.join(wb.sheetnames))
    tcode = f'ALFA{S}'
    def fill(ws, rows):
        hdr = [c.value for c in ws[1]]
        for r in rows: ws.append([r.get(h, '') for h in hdr])
    units = [('EGE', 'Ege Bölgesi', 'REGION', 'HQ', 8), ('KONAK', 'Konak Şubesi', 'SITE', 'EGE', 22), ('BORNOVA', 'Bornova Şubesi', 'SITE', 'EGE', 18), ('KUCUK', 'Küçük Ekip', 'SITE', 'EGE', 3)]
    fill(wb['Birim_Tipleri'], [{'tenant_code': tcode, 'unit_type_code': 'REGION', 'label': 'Bölge'}, {'tenant_code': tcode, 'unit_type_code': 'SITE', 'label': 'Şube'}])
    fill(wb['Birimler'], [{'tenant_code': tcode, 'operation': 'CREATE', 'unit_code': u[0], 'unit_name': u[1], 'unit_type_code': u[2], 'timezone': 'Europe/Istanbul', 'valid_from': '2025-01-01', 'headcount': u[4]} for u in units])
    fill(wb['Iliskiler'], [{'tenant_code': tcode, 'operation': 'CREATE', 'hierarchy_code': 'SURVEY', 'child_unit': u[0], 'parent_unit': u[3], 'relation_type': 'REPORTS_TO', 'valid_from': '2025-01-01'} for u in units])
    fill(wb['Org_Rolleri'], [{'tenant_code': tcode, 'operation': 'CREATE', 'role_code': r[0], 'unit_code': r[1], 'title': r[2], 'permission_profile': r[3], 'valid_from': '2025-01-01'} for r in [('ROLE_EGE', 'EGE', 'Bölge Direktörü', 'REGION_MANAGER'), ('ROLE_KONAK', 'KONAK', 'Şube Müdürü', 'UNIT_MANAGER'), ('ROLE_BORNOVA', 'BORNOVA', 'Şube Müdürü', 'UNIT_MANAGER'), ('ROLE_HRBP', 'EGE', 'İK İş Ortağı', 'HR_PARTNER')]])
    bad = wb['Birimler']; bad.append([tcode, 'CREATE', 'HATALI', 'Tipi yok', 'YOK', '', '2025-01-01', '', '']); out = f'/tmp/org-{S}.xlsx'; wb.save(out)
    pg.set_input_files('input[type=file]', out); pg.get_by_role('button', name=re.compile('Doğrula')).click(); pg.wait_for_timeout(1500)
    ok('3c hatalı satır reddedildi ve hata satırı indirilebilir', pg.get_by_text(re.compile('unit_type_unknown|Tanımsız birim tipi|tip')).count() >= 1 and pg.get_by_role('button', name=re.compile('Hata satırlarını indir')).count() == 1); shot('org-hata')
    wb = openpyxl.load_workbook(out); wb['Birimler'].delete_rows(wb['Birimler'].max_row); out2 = f'/tmp/org2-{S}.xlsx'; wb.save(out2)
    pg.set_input_files('input[type=file]', out2); pg.wait_for_timeout(500); pg.get_by_role('button', name=re.compile('Doğrula')).click(); pg.wait_for_timeout(2000); ok('3c2 düzeltilmiş dosya doğrulandı', pg.get_by_role('button', name=re.compile('Onayla')).is_enabled(), pg.locator('main').inner_text()[:300]); pg.get_by_role('button', name=re.compile('Onayla')).click(); pg.wait_for_timeout(1500)
    ok('3d org Excel: doğrula → önizle → onayla → kalıcı', pg.get_by_text(re.compile('işlendi|uygulandı|tamam', re.I)).count() >= 1 or pg.get_by_text('units').count() >= 1); shot('org-onay')
    # 4 Soru seti: standart (varsayılan çekirdek) + ek soru (panel) → yayımla
    pg.locator('nav >> text=Soru seti').click(); pg.wait_for_url(re.compile('soru-seti')); pg.wait_for_timeout(800)
    pg.fill('#ccode', 'OZL-01'); pg.fill('#ctext', 'Şubemde kadro planı müşteri yoğunluğuyla uyumludur.'); pg.get_by_role('button', name='Listeye ekle').click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name=re.compile('Soru setini yayımla')).click(); pg.wait_for_timeout(2000)
    ok('4 soru seti yayımlandı (standart + ek soru)', pg.get_by_text(re.compile('yayımlandı|metricCount|madde', re.I)).count() >= 1); shot('soru-seti')
    # 5 Dönem + sonuç Excel
    pg.locator('nav >> text=Dönemler').click(); pg.wait_for_url(re.compile('donemler')); pg.wait_for_timeout(600)
    pg.fill('#ccode', '2025-ANA'); pg.fill('#cname', '2025 Ana Ölçüm'); pg.fill('#ps', '2025-04-07'); pg.fill('#pe', '2025-04-25'); pg.select_option('#iv', index=1); pg.get_by_role('button', name='Dönemi aç').click(); pg.wait_for_timeout(1000)
    ok('5 dönem açıldı', pg.get_by_text('2025-ANA').count() >= 1)
    pg.get_by_role('link', name=re.compile('sonuç yükle')).first.click(); pg.wait_for_url(re.compile('yukle/results'))
    with pg.expect_download() as dl: pg.get_by_role('button', name=re.compile('Şablonu indir')).click()
    rpath = f'/tmp/res-sablon-{S}.xlsx'; dl.value.save_as(rpath); rwb = openpyxl.load_workbook(rpath); ws = rwb['Sonuclar']; dws = rwb['Dagilimlar']; hdr = [c.value for c in ws[1]]; iU, iM, iS, iN, iV = hdr.index('scope_code'), hdr.index('metric_code'), hdr.index('status'), hdr.index('n_valid'), hdr.index('value')
    ok('5b sonuç şablonu birim×madde satırlarını içeriyor', ws.max_row > 30, str(ws.max_row))
    metrics_seen = {}
    def dist(n, fav, nps=False):
        top = round(n * fav); rest = n - top
        return {'0': rest - rest // 2, '7': rest // 2, '9': top // 2, '10': top - top // 2} if nps else {'1': rest // 3, '2': rest - 2 * (rest // 3), '3': rest // 3, '4': top // 2, '5': top - top // 2}
    for row in ws.iter_rows(min_row=2):
        u, m = row[iU].value, row[iM].value
        if u not in ('KONAK', 'BORNOVA', 'KUCUK'): continue
        n = {'KONAK': 18, 'BORNOVA': 14, 'KUCUK': 3}[u]
        if n < 5: row[iS].value = 'SUPPRESSED'; row[iN].value = n; continue
        item = re.sub(r'_(TB|NPS)$', '', m); key = (u, item); nps = m.endswith('_NPS') or item.startswith('BAG-03')
        d = metrics_seen.get(key) or dist(n, 0.45 + (hash(key) % 40) / 100, nps); metrics_seen[key] = d
        val = ((d.get('9', 0) + d.get('10', 0) - d.get('0', 0)) / n * 100) if m.endswith('_NPS') else ((d.get('9', 0) + d.get('10', 0)) / n * 100 if nps else (d['4'] + d['5']) / n * 100)
        row[iS].value = 'OBSERVED'; row[iN].value = n; row[iV].value = str(round(val, 1)).replace('.', ',')
        for o, c in d.items():
            if c > 0: dws.append([tcode, '2025-ANA', u, m, o, c])
    rout = f'/tmp/res-{S}.xlsx'; rwb.save(rout)
    pg.set_input_files('input[type=file]', rout); pg.get_by_role('button', name=re.compile('Doğrula')).click(); pg.wait_for_timeout(3000)
    ok('5c sonuç dosyası doğrulandı (önizleme)', pg.get_by_role('button', name=re.compile('Onayla')).count() == 1 and pg.get_by_text(re.compile('Hata satırlarını indir')).count() == 0); shot('sonuc-onizleme')
    pg.get_by_role('button', name=re.compile('Onayla')).click(); pg.wait_for_timeout(3000); ok('5d sonuçlar yayımlandı', pg.get_by_text(re.compile('batchId|revizyon|revision', re.I)).count() >= 1); shot('sonuc-yayim')
    # 6 Kullanıcılar: ekrandan rol seçerek ekle → davet gönder → kabul (yeni bağlam)
    pg.locator('nav >> text=Kullanıcılar').click(); pg.wait_for_url(re.compile('kullanicilar')); pg.wait_for_timeout(800)
    pg.fill('#ue', f'konak@alfa.{DOM}'); pg.fill('#un', 'Ayşe Yılmaz'); pg.select_option('#ur', ['ROLE_KONAK']); pg.get_by_role('button', name=re.compile('Ekle')).click(); pg.wait_for_timeout(800)
    pg.fill('#ue', f'hrbp@alfa.{DOM}'); pg.fill('#un', 'Emre Çelik'); pg.select_option('#ur', ['ROLE_HRBP']); pg.get_by_role('button', name=re.compile('Ekle')).click(); pg.wait_for_timeout(800)
    ok('6 kullanıcılar eklendi, kapsam önizlemesi görüldü', pg.get_by_text(f'konak@alfa.{DOM}').count() == 1 and pg.get_by_text(f'hrbp@alfa.{DOM}').count() == 1)
    pg.get_by_role('button', name=re.compile('Davetleri gönder')).click(); pg.wait_for_timeout(2500); ok('6b davetler tek tuşla gönderildi (sandbox etiketli)', pg.get_by_text(re.compile('sandbox')).count() >= 1); shot('kullanicilar')
    tok = token_for(f'konak@alfa.{DOM}', 'davet'); ok('6c davet e-postası kişisel bağlantı taşıyor', tok is not None)
    pg.wait_for_timeout(800); ok('6c2 davet, uygulama içi test posta kutusunda görünüyor (sandbox etiketli)', pg.get_by_text('sandbox (gerçek teslimat değil)').count() >= 1 and pg.get_by_role('link', name='daveti aç').count() >= 2); shot('test-posta-kutusu')
    c2 = b.new_context(viewport={'width': 1440, 'height': 1000}); p2 = c2.new_page(); p2.set_default_timeout(15000); p2.goto(f'{BASE}/#/davet/{tok}'); p2.wait_for_timeout(800); p2.fill('#pw', PW); p2.fill('#pw2', PW); p2.get_by_role('button', name=re.compile('Parolayı belirle')).click(); p2.wait_for_url(re.compile('#/t/')); ok('6d davet kabul → parola belirlendi → şirket ekranı')
    p2.goto(f'{BASE}/#/davet/{tok}'); p2.wait_for_timeout(800); ok('6e bağlantı tek kullanımlık', p2.get_by_text(re.compile('geçersiz|süresi', re.I)).count() >= 1)
    hrbp_tok = token_for(f'hrbp@alfa.{DOM}', 'davet'); c3 = b.new_context(viewport={'width': 1440, 'height': 1000}); p3 = c3.new_page(); p3.set_default_timeout(15000); P3NET = []; p3.on('response', lambda r: P3NET.append((time.strftime('%H:%M:%S'), r.status, r.request.method, r.url.split('/api/')[-1][:120])) if '/api/' in r.url else None); P3CON = []; p3.on('console', lambda m: P3CON.append(m.type + ': ' + m.text[:200]) if m.type in ('error', 'warning') else None); p3.goto(f'{BASE}/#/davet/{hrbp_tok}'); p3.wait_for_timeout(800); p3.fill('#pw', PW); p3.fill('#pw2', PW); p3.get_by_role('button', name=re.compile('Parolayı belirle')).click(); p3.wait_for_url(re.compile('#/t/'))
    # 7 Şube müdürü: birim sonuçları → iki hedef (öneri gör → kabul) → aksiyon → kanıt → beyan
    p2.goto(f'{BASE}/#/t/{tid}/birimler'); p2.wait_for_timeout(1200)
    if p2.locator('#cycle option').count() > 1 and not p2.locator('#cycle').input_value(): p2.select_option('#cycle', index=1); p2.wait_for_timeout(1000)
    opts = p2.locator('#unit option').all_inner_texts(); ok('7 şube müdürü yalnız kendi birimini görür', len(opts) == 1 and 'KONAK' in opts[0], str(opts))
    p2.goto(f'{BASE}/#/t/{tid}/hedefler'); p2.wait_for_timeout(1200)
    if not p2.locator('#cycle').input_value(): p2.select_option('#cycle', index=1); p2.wait_for_timeout(800)
    if not p2.locator('#unit').input_value(): p2.select_option('#unit', index=1); p2.wait_for_timeout(1000)
    p2.select_option('#item', index=1); p2.get_by_role('button', name='Öneriyi gör').click(); p2.wait_for_timeout(1200); ok('7b hedef önizlemesi: aralık, takip dönemi, ufuk', p2.get_by_text(re.compile('ufuk')).count() == 1)
    p2.get_by_role('button', name='Öneriyi kabul et').click(); p2.wait_for_timeout(1200); first_item = p2.locator('table tbody tr').first.locator('td').first.inner_text()
    p2.select_option('#item', index=2); p2.get_by_role('button', name='Öneriyi gör').click(); p2.wait_for_timeout(1000); p2.get_by_role('button', name='Öneriyi kabul et').click(); p2.wait_for_timeout(1200)
    ok('7c iki hedef kabul edildi', p2.locator('table tbody tr').count() == 2); shot_p2 = p2.screenshot(path=f'{OUT}/tur-hedefler.png')
    p2.goto(f'{BASE}/#/t/{tid}/aksiyonlar'); p2.wait_for_timeout(1200); p2.select_option('#ts', index=1); p2.wait_for_timeout(1200)
    if p2.locator('#tpl option').count() > 1:
        if not sel_by_text(p2, '#tpl', 'monthly'): p2.select_option('#tpl', index=1)
    else: p2.fill('#ctitle', 'Şube içi haftalık kısa toplantı rutini (özel)'); p2.select_option('#ccad', 'monthly')
    p2.fill('#due', '2027-03-31'); p2.get_by_role('button', name='Aksiyonu aç').click(); p2.wait_for_timeout(1500)
    ok('7d aksiyon açıldı', p2.locator('table tbody tr').count() >= 1)
    p2.locator('table tbody tr').first.get_by_role('button', name='aç').click(); p2.wait_for_timeout(1000)
    today = time.strftime('%Y-%m-%d')
    p2.fill('#ed', today); p2.fill('#ea', '7'); p2.get_by_role('button', name='Kaydı ekle').click(); p2.wait_for_timeout(900)
    ok('7e kanıt kaydı eklendi (bugün)', p2.get_by_text(re.compile('Kayıt eklendi')).count() >= 1, p2.locator('main').inner_text()[-200:])
    fut = time.strftime('%Y-%m-%d', time.localtime(time.time() + 40 * 86400)); p2.fill('#ed', fut); p2.fill('#ea', '5'); p2.get_by_role('button', name='Kaydı ekle').click(); p2.wait_for_timeout(900); ok('7f gelecek tarihli gerçekleşme reddedildi (R26)', p2.get_by_text(re.compile('Gelecek tarihli')).count() >= 1)
    p2.fill('#ed', today); p2.fill('#ea', '5'); p2.get_by_role('button', name='Kaydı ekle').click(); p2.wait_for_timeout(900); ok('7f2 aynı olay/ay ikinci kayıt occurrenceKey olmadan reddedildi (R26)', p2.get_by_text(re.compile('geçersiz|zaten kayıtlı|slot', re.I)).count() >= 1)
    p2.get_by_role('button', name='Tamamlandı beyanı').click(); p2.wait_for_timeout(1500); ok('7g tamamlandı beyanı verildi', p2.get_by_text('Tamamlandı beyanı verildi').count() == 1, p2.locator('main').inner_text()[-300:]); expected_note = p2.locator('main').inner_text(); p2.screenshot(path=f'{OUT}/tur-aksiyon.png')
    # 8 HRBP doğrulama: eksik kanıtla onay reddedilir (R06), ret gerekçesiyle iade
    p3.goto(f'{BASE}/#/t/{tid}/aksiyonlar'); p3.wait_for_timeout(1500)
    if not p3.locator('#cycle').input_value(): p3.select_option('#cycle', index=1); p3.wait_for_timeout(800)
    try:
        sel_by_text(p3, '#unit', 'KONAK'); p3.wait_for_timeout(1000); p3.locator('table tbody tr').filter(has_text=re.compile('tamamland', re.I)).first.get_by_role('button', name='aç').click(); p3.wait_for_timeout(1000)
      # doğrulanacak (beyanı verilmiş) aksiyon açıkça seçilir; ilk satır sırası belirleyici değildir
    except Exception:
        print('TANI p3 url:', p3.url); print('TANI p3 seçimler:', p3.locator('#cycle').input_value() if p3.locator('#cycle').count() else '-', p3.locator('#unit').input_value() if p3.locator('#unit').count() else '-'); print('TANI p3 ağ (son 25):'); [print('  ', *x) for x in P3NET[-25:]]; print('TANI p3 konsol:', P3CON[-10:]); print('TANI p3 metin:', p3.locator('main').inner_text()[:2500]); p3.screenshot(path=f'{OUT}/tani-7h.png', full_page=True); raise
    p3.once('dialog', lambda d: d.accept('takvim kontrolü')); p3.get_by_role('button', name=re.compile('Doğrula')).click(); p3.wait_for_timeout(1200); ok('8 eksik kanıtla insan onayı tamamlanmadı (coverage_insufficient)', p3.get_by_text(re.compile('Kanıt 1/\\d+; eksik gerçekleşme')).count() >= 1, p3.locator('main').inner_text()[:400])
    p3.once('dialog', lambda d: d.accept('kayıtlar eksik; devam')); p3.get_by_role('button', name='Reddet').click(); p3.wait_for_timeout(1200); ok('8b ret gerekçesiyle işe iade', p3.get_by_text('İncelemeye iade edildi').count() == 1 and p3.get_by_text(re.compile('incelemeye iade', re.I)).count() >= 1, p3.locator('main').inner_text()[:300])
    # 9 İK: 2. dönem + sonuç → takip (ikinci hedef seçilerek)
    pg.goto(f'{BASE}/#/t/{tid}/donemler'); pg.wait_for_timeout(800); pg.fill('#ccode', '2026-ANA'); pg.fill('#cname', '2026 Ana Ölçüm'); pg.fill('#ps', '2026-04-06'); pg.fill('#pe', '2026-04-24'); pg.select_option('#iv', index=1); pg.get_by_role('button', name='Dönemi aç').click(); pg.wait_for_timeout(1000)
    pg.get_by_role('link', name=re.compile('sonuç yükle')).last.click(); pg.wait_for_url(re.compile('yukle/results')); pg.wait_for_timeout(500)
    with pg.expect_download() as dl: pg.get_by_role('button', name=re.compile('Şablonu indir')).click()
    dl.value.save_as(f'/tmp/res2-sablon-{S}.xlsx'); rwb = openpyxl.load_workbook(f'/tmp/res2-sablon-{S}.xlsx'); ws = rwb['Sonuclar']; dws = rwb['Dagilimlar']; seen = {}
    for row in ws.iter_rows(min_row=2):
        u, m = row[iU].value, row[iM].value
        if u not in ('KONAK', 'BORNOVA'): continue
        n = 16; item = re.sub(r'_(TB|NPS)$', '', m); key = (u, item); nps = m.endswith('_NPS') or item.startswith('BAG-03'); d = seen.get(key) or dist(n, 0.55 + (hash(key) % 30) / 100, nps); seen[key] = d
        val = ((d.get('9', 0) + d.get('10', 0) - d.get('0', 0)) / n * 100) if m.endswith('_NPS') else ((d.get('9', 0) + d.get('10', 0)) / n * 100 if nps else (d['4'] + d['5']) / n * 100)
        row[iS].value = 'OBSERVED'; row[iN].value = n; row[iV].value = str(round(val, 1)).replace('.', ',')
        for o, c in d.items():
            if c > 0: dws.append([tcode, '2026-ANA', u, m, o, c])
    r2out = f'/tmp/res2-{S}.xlsx'; rwb.save(r2out); pg.set_input_files('input[type=file]', r2out); pg.get_by_role('button', name=re.compile('Doğrula')).click(); pg.wait_for_timeout(3000); pg.get_by_role('button', name=re.compile('Onayla')).click(); pg.wait_for_timeout(3000)
    ok('9 takip dönemi sonuçları yayımlandı', pg.get_by_text(re.compile('batchId|revizyon|revision', re.I)).count() >= 1)
    pg.goto(f'{BASE}/#/t/{tid}/takip'); pg.wait_for_timeout(1000); sel_by_text(pg, '#cycle', '2025-ANA'); pg.wait_for_timeout(800); sel_by_text(pg, '#unit', 'KONAK'); pg.wait_for_timeout(800); ok('9a takip dönemi listesinde 2026-ANA var', sel_by_text(pg, '#fu', '2026-ANA')); pg.wait_for_timeout(800)
    ok('9b takip ekranında iki hedef listeleniyor', pg.locator('table tbody tr').count() == 2)
    pg.locator('table tbody tr').nth(1).get_by_role('button', name='değerlendir').click(); pg.wait_for_timeout(1500); second_item = pg.locator('table tbody tr').nth(1).locator('td').first.inner_text().split(' ')[0]
    ok('9c ikinci hedef seçili ve değerlendirme o hedefe ait (R08)', pg.locator('table tbody tr').nth(1).get_by_text('seçili').count() == 1 and (pg.get_by_text(re.compile(f'{second_item}')).count() >= 2 or pg.get_by_text(re.compile('Başlangıç')).count() >= 1)); pg.screenshot(path=f'{OUT}/tur-takip.png')
    # 10 ikinci şirket + izolasyon
    pg.goto(f'{BASE}/#/platform'); pg.wait_for_timeout(800); pg.fill('#code', f'BETA{S}'); pg.fill('#name', 'Beta Üretim (tur)'); pg.fill('#adminEmail', f'ik@beta.{DOM}'); pg.fill('#adminName', 'Beta İK'); pg.get_by_role('button', name='Şirketi oluştur').click(); pg.wait_for_timeout(1000)
    ok('10 ikinci şirket oluşturuldu', pg.get_by_role('button', name='Aç').count() == 2)
    pg.locator('table').first.locator('tbody tr').filter(has_text=f'BETA{S}').get_by_role('button', name='Aç').click(); pg.wait_for_url(re.compile(r'#/t/(?!' + tid + ')')); pg.wait_for_timeout(1500); beta_tid = re.search(r'#/t/([0-9a-f-]+)', pg.url).group(1); ok('10a Beta açıldı ve boş kurulum tablosu geldi', beta_tid != tid and pg.get_by_text('Kurulum durumu').count() == 1 and pg.get_by_text('Henüz ölçüm yok').count() == 1, pg.url)
    p2.goto(f'{BASE}/#/t/{beta_tid}'); p2.wait_for_timeout(1200); ok('10b Alfa şube müdürü Beta şirketine giremez', p2.get_by_text('Bu şirkete erişiminiz yok').count() == 1)
    r = requests.get(f'{BASE}/api/t/{beta_tid}/overview', cookies={k['name']: k['value'] for k in c2.cookies()}); ok('10c API de 403 döner', r.status_code == 403, str(r.status_code))
    # 11 çıkış → yeniden giriş → parola sıfırlama
    p2.goto(f'{BASE}/#/t/{tid}'); p2.wait_for_timeout(800); p2.get_by_role('button', name='Çıkış').click(); p2.wait_for_url(re.compile('#/giris')); p2.fill('#email', f'konak@alfa.{DOM}'); p2.fill('#password', PW); p2.get_by_role('button', name='Giriş yap').click(); p2.wait_for_url(re.compile('#/t/')); ok('11 çıkış → aynı parola ile yeniden giriş')
    p2.get_by_role('button', name='Çıkış').click(); p2.wait_for_url(re.compile('#/giris')); p2.get_by_role('link', name='Parolamı unuttum').click(); p2.wait_for_url(re.compile('#/parola')); p2.fill('#email', f'konak@alfa.{DOM}'); p2.get_by_role('button', name='Bağlantı gönder').click(); p2.wait_for_timeout(1500)
    rt = token_for(f'konak@alfa.{DOM}', 'parola'); ok('11b sıfırlama bağlantısı üretildi', rt is not None)
    p2.goto(f'{BASE}/#/parola/{rt}'); p2.wait_for_timeout(800); p2.fill('#pw', PW2); p2.fill('#pw2', PW2); p2.get_by_role('button', name='Parolayı belirle').click(); p2.wait_for_timeout(1500)
    p2.goto(f'{BASE}/#/giris'); p2.wait_for_timeout(500); p2.fill('#email', f'konak@alfa.{DOM}'); p2.fill('#password', PW); p2.get_by_role('button', name='Giriş yap').click(); p2.wait_for_timeout(1200); ok('11c eski parola geçersiz', p2.get_by_text(re.compile('hatalı')).count() == 1)
    p2.fill('#password', PW2); p2.get_by_role('button', name='Giriş yap').click(); p2.wait_for_url(re.compile('#/t/')); ok('11d yeni parola ile giriş')
    # 12 erişim iptali
    pg.goto(f'{BASE}/#/t/{tid}/kullanicilar'); pg.wait_for_timeout(1200); pg.once('dialog', lambda d: d.accept()); pg.locator('table').first.locator('tbody tr').filter(has_text=f'konak@alfa.{DOM}').get_by_role('button', name='iptal').click(); pg.wait_for_timeout(1200)
    p2.goto(f'{BASE}/#/t/{tid}'); p2.wait_for_timeout(1200); ok('12 erişim iptali: oturum düştü', 'giris' in p2.url or p2.get_by_text('Bu şirkete erişiminiz yok').count() == 1)
    b.close()
json.dump([{'adim': s, 'sonuc': 'GEÇTİ' if o else 'KALDI', 'not': n} for s, o, n in steps], open(f'{OUT}/ui-bos-tur-sonuc.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'\n{sum(1 for _, o, _ in steps if o)}/{len(steps)} adım geçti')
