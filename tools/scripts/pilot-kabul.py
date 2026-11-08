"""HPW Act pilot kabul sınaması (v2.12): 20 şirket tek HPW panelinden — GERÇEK API + GERÇEK PostgreSQL (DOLU pilot paketi çalışırken).
Kullanım: BASE=http://127.0.0.1:8787 PGURL=postgres://postgres:...@127.0.0.1:<port>/hpw_act_demo OUT=<dizin> python3 pilot-kabul.py
Kontroller: A (HPW 20 şirketi görür), B (şirket verisi ayrık), C (HPW yetkilisi şirket seçip takip eder; danışman yalnız atandığı şirketleri görür),
D (müşteri yalnız kendi şirketi), E (şirketler arası yanlış kayıt/işlem yok; tarayıcıda şirket değiştirip işlem)."""
import os, sys, json, time, hmac, hashlib, struct, base64, subprocess, requests
BASE = os.environ.get('BASE', 'http://127.0.0.1:8787'); PGURL = os.environ['PGURL']; OUT = os.environ.get('OUT', '/tmp/pilot-kabul'); os.makedirs(OUT, exist_ok=True)
PW_HPW = 'Demo-Platform-2026'; PW_USER = 'Demo-Kullanici-2026'
results = []
def rec(id, grp, ok, detail): results.append({'id': id, 'grup': grp, 'sonuc': 'PASS' if ok else 'FAIL', 'ayrinti': detail}); print(('OK  ' if ok else 'FAIL'), id, json.dumps(detail, ensure_ascii=False)[:220], flush=True)
def sql(q):
    r = subprocess.run(['psql', PGURL, '-At', '-F', '|', '-c', q], capture_output=True, text=True)
    if r.returncode: raise RuntimeError('SQL hatası: ' + r.stderr.strip()[:300] + ' | sorgu: ' + q[:200])  # bağlantı dizesi (parola) günlüğe yazılmaz
    return r.stdout.strip()
def totp(sec, step):
    key = base64.b32decode(sec + '=' * (-len(sec) % 8)); h = hmac.new(key, struct.pack('>Q', step), hashlib.sha1).digest(); o = h[-1] & 15
    return str((struct.unpack('>I', h[o:o + 4])[0] & 0x7fffffff) % 1000000).zfill(6)
def login(email, pw, staff=False):
    s = requests.Session(); r = s.post(BASE + '/api/auth/login', json={'email': email, 'password': pw}); assert r.status_code == 200, (email, r.status_code, r.text[:200])
    if staff:  # demo: HPW personeli ilk girişte doğrulama uygulamasını kurar
        st = s.post(BASE + '/api/platform/mfa/setup', json={}); assert st.status_code == 200, st.text[:200]
        v = s.post(BASE + '/api/platform/mfa/verify', json={'code': totp(st.json()['secret'], int(time.time() // 30))}); assert v.status_code == 200, v.text[:200]
    return s
# sınama düzeneği: sınamanın kullandığı iki HPW hesabının doğrulama kaydı sıfırlanır (her koşu ilk girişteki kurulumla başlar; sır yalnız bellekte)
sql("DELETE FROM platform_mfa WHERE user_id IN (SELECT id FROM app_user WHERE email IN ('platform@demo.hpw-act.local','danisman@demo.hpw-act.local'))")
T = {r.split('|')[0]: r.split('|')[1] for r in sql("SELECT code, id FROM tenant ORDER BY code").splitlines()}
P = sorted(c for c in T if c.startswith('PILOT'))
adm = login('platform@demo.hpw-act.local', PW_HPW, staff=True)
# ---- A: HPW yöneticisi tek hesapla 20 şirketi görür
tl = adm.get(BASE + '/api/platform/tenants').json(); codes = sorted(t['code'] for t in tl)
rec('A1-TUM-SIRKETLER', 'A', len(tl) == 20 and set(codes) == set(T), {'sayi': len(tl), 'kodlar': codes})
pf = adm.get(BASE + '/api/platform/portfolio'); pj = pf.json(); rows = pj.get('rows') or pj.get('tenants') or pj.get('items') or (pj if isinstance(pj, list) else [])
rec('A2-PORTFOY', 'A', pf.status_code == 200 and len(rows) == 20, {'durum': pf.status_code, 'satir': len(rows)})
# ---- B: şirket verisi ayrık (DB düzeyi): iki tarafında tenant_id olan her yabancı anahtar için şirketler arası başvuru sayısı 0
fks = sql("""SELECT c.conrelid::regclass||'|'||a.attname||'|'||c.confrelid::regclass||'|'||af.attname FROM pg_constraint c
 JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1] JOIN pg_attribute af ON af.attrelid=c.confrelid AND af.attnum=c.confkey[1]
 WHERE c.contype='f' AND array_length(c.conkey,1)=1 AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid=c.conrelid AND x.attname='tenant_id')
 AND EXISTS (SELECT 1 FROM pg_attribute y WHERE y.attrelid=c.confrelid AND y.attname='tenant_id') AND a.attname<>'tenant_id'""").splitlines()
bad = {}
for f in fks:
    ch, col, par, pcol = f.split('|'); n = int(sql(f"SELECT count(*) FROM {ch} c JOIN {par} p ON p.{pcol}=c.{col} WHERE c.tenant_id IS DISTINCT FROM p.tenant_id"))
    if n: bad[f] = n
comp = int(sql("""SELECT count(*) FROM pg_constraint c WHERE c.contype='f' AND array_length(c.conkey,1)>1 AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) AND a.attname='tenant_id')"""))
rls = int(sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='tenant_id')"))
norls = sql("SELECT string_agg(c.relname, ',') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='tenant_id')")
rec('B1-YABANCI-ANAHTAR-SIRKET-TUTARLILIGI', 'B', not bad, {'tek_sutunlu_denetlenen': len(fks), 'tutarsiz': bad, 'tenant_id_iceren_bilesik_anahtar_(DB_zorlar)': comp, 'RLS_acik_sirket_tablosu': rls, 'RLS_kapali_sirket_tablosu': norls})
per = sql("SELECT t.code, (SELECT count(*) FROM membership m WHERE m.tenant_id=t.id), (SELECT count(*) FROM survey_cycle c WHERE c.tenant_id=t.id), (SELECT count(*) FROM result r WHERE r.tenant_id=t.id), (SELECT count(*) FROM action a WHERE a.tenant_id=t.id) FROM tenant t ORDER BY t.code").splitlines()
rec('B2-SIRKET-BASINA-KAYIT', 'B', len(per) == 20 and all(int(r.split('|')[1]) > 0 for r in per) and sum(int(r.split('|')[2]) > 0 for r in per) >= 17, {'kod|uyelik|donem|sonuc|aksiyon': per})
own = {}
for c in ['PILOT07', 'PILOT08', 'SAHA']:
    r = adm.get(BASE + f'/api/t/{T[c]}/cycles'); ids = [x['id'] for x in r.json()] if r.status_code == 200 else None
    dbids = sql(f"SELECT id FROM survey_cycle WHERE tenant_id='{T[c]}' ORDER BY id").splitlines(); own[c] = ids or []
    rec(f'B3-DONEMLER-{c}', 'B', r.status_code == 200 and sorted(ids) == sorted(dbids), {'api': len(ids or []), 'db': len(dbids)})
# ---- C: HPW yetkilisi şirket seçip ilerleme ve bekleyen işleri izler; danışman yalnız atandığı şirketler
d = adm.get(BASE + f"/api/platform/tenants/{T['PILOT07']}"); dj = d.json()
rec('C1-SIRKET-SECIMI-ILERLEME', 'C', d.status_code == 200 and dj.get('tenant', {}).get('code') == 'PILOT07' and 'summary' in dj.get('onboarding', {}), {'durum': d.status_code, 'ozet': dj.get('onboarding', {}).get('summary')})
wa = adm.get(BASE + f"/api/platform/work-items?tenantId={T['PILOT01']}").json(); tids = {i['tenant_id'] for i in wa['items']}
rec('C2-BEKLEYEN-ISLER-SIRKET-FILTRESI', 'C', tids <= {T['PILOT01']} and len(wa['items']) >= 1, {'is': len(wa['items']), 'sirketler': sorted(tids)})
dan = login('danisman@demo.hpw-act.local', PW_HPW, staff=True)
dl = dan.get(BASE + '/api/platform/tenants').json(); dcodes = sorted(t['code'] for t in dl)
rec('C3-DANISMAN-YALNIZ-ATANDIGI', 'C', dcodes == P[:10], {'gordugu': dcodes})
dw = dan.get(BASE + '/api/platform/work-items').json(); dwt = {i['tenant_code'] for i in dw['items']}
rec('C4-DANISMAN-IS-LISTESI-KAPSAMI', 'C', dwt <= set(P[:10]), {'sirketler': sorted(dwt)})
x1 = dan.get(BASE + f"/api/platform/tenants/{T['PILOT11']}"); x2 = dan.get(BASE + f"/api/t/{T['PILOT11']}/cycles")
rec('C5-DANISMAN-ATANMADIGI-SIRKET', 'C', x1.status_code in (403, 404) and x2.status_code in (403, 404), {'detay': x1.status_code, 'donemler': x2.status_code})
# ---- D: müşteri kullanıcısı yalnız kendi şirketi
cu = login('ik@pilot07.demo.hpw-act.local', PW_USER)
r_own = cu.get(BASE + f"/api/t/{T['PILOT07']}/cycles"); r_o8 = cu.get(BASE + f"/api/t/{T['PILOT08']}/cycles"); r_sa = cu.get(BASE + f"/api/t/{T['SAHA']}/cycles"); r_pl = cu.get(BASE + '/api/platform/tenants')
rec('D1-MUSTERI-KENDI-SIRKETI', 'D', r_own.status_code == 200 and len(r_own.json()) >= 1, {'durum': r_own.status_code})
rec('D2-MUSTERI-BASKA-SIRKET', 'D', r_o8.status_code in (403, 404) and r_sa.status_code in (403, 404), {'PILOT08': r_o8.status_code, 'SAHA': r_sa.status_code})
rec('D3-MUSTERI-HPW-PANELI', 'D', r_pl.status_code in (401, 403), {'durum': r_pl.status_code})
c7 = own['PILOT07'][0]; c8 = own['PILOT08'][0]
r_mix = cu.get(BASE + f"/api/t/{T['PILOT07']}/cycles/{c8}/units")
u7 = sql(f"SELECT id FROM org_unit WHERE tenant_id='{T['PILOT07']}' AND external_id='OPS'")
r_tg = cu.get(BASE + f"/api/t/{T['PILOT07']}/cycles/{c8}/units/{u7}/targets")
rec('D4-MUSTERI-KENDI-YOLUNDA-YABANCI-DONEM', 'D', r_mix.status_code == 404 and r_tg.status_code == 404, {'birimler': r_mix.status_code, 'hedefler': r_tg.status_code})
mgr7 = login(sql("SELECT u.email FROM app_user u JOIN membership m ON m.user_id=u.id WHERE m.tenant_id='%s' AND u.email LIKE 'ops.%%'" % T['PILOT07']), PW_USER)
lt0 = sql("SELECT count(*) FROM local_target")
w_tg = mgr7.post(BASE + f"/api/t/{T['PILOT07']}/cycles/{c8}/units/{u7}/targets", json={'itemCode': 'GUR-01'}); w_tg2 = cu.post(BASE + f"/api/t/{T['PILOT07']}/cycles/{c8}/units/{u7}/targets", json={'itemCode': 'GUR-01'})
rec('D5-YABANCI-DONEMLE-HEDEF-YAZMA', 'D', w_tg.status_code in (403, 404) and w_tg2.status_code in (403, 404) and sql("SELECT count(*) FROM local_target") == lt0, {'mudur': w_tg.status_code, 'ik': w_tg2.status_code, 'hedef_sayisi_once_sonra': [lt0, sql("SELECT count(*) FROM local_target")]})
# ---- E: şirketler arası yanlış kayıt/işlem yok
tgt7 = sql(f"SELECT id FROM local_target WHERE tenant_id='{T['PILOT07']}' LIMIT 1"); act7 = sql(f"SELECT id FROM action WHERE tenant_id='{T['PILOT07']}' LIMIT 1")
before = sql("SELECT (SELECT count(*) FROM action), (SELECT count(*) FROM evidence)")
e1 = adm.post(BASE + f"/api/t/{T['PILOT08']}/targets/{tgt7}/actions", json={'templateCode': 'birebir-programi', 'startDate': '2026-10-01', 'dueDate': '2026-12-31'})
e2 = adm.post(BASE + f"/api/t/{T['PILOT08']}/actions/{act7}/evidence", json={'date': '2026-09-28', 'attendance': 5})
e3 = cu.post(BASE + f"/api/t/{T['PILOT08']}/invitations/send", json={})
after = sql("SELECT (SELECT count(*) FROM action), (SELECT count(*) FROM evidence)")
rec('E1-YANLIS-SIRKET-YOLU-YAZMA', 'E', e1.status_code in (403, 404) and e2.status_code in (403, 404) and e3.status_code in (403, 404) and before == after, {'aksiyon': e1.status_code, 'kanit': e2.status_code, 'davet': e3.status_code, 'sayim_once_sonra': [before, after]})
adm.get(BASE + '/api/platform/work-items')  # bütün şirketler için kural değerlendirmesi (SAHA'daki başarısız davetler iş açar)
w11 = sql("SELECT w.id||'|'||w.version FROM platform_work_item w JOIN tenant t ON t.id=w.tenant_id WHERE t.code NOT IN (%s) AND w.state='open' ORDER BY t.code LIMIT 1" % ','.join("'%s'" % c for c in P[:10]))
if w11:
    wid, wv = w11.split('|'); e4 = dan.post(BASE + f'/api/platform/work-items/{wid}/claim', json={'expectedVersion': int(wv)}, headers={'idempotency-key': 'pilot-kabul-yetkisiz'})
    rec('E2-DANISMAN-ATANMADIGI-SIRKETTE-ISLEM', 'E', e4.status_code in (403, 404) and sql(f"SELECT state FROM platform_work_item WHERE id='{wid}'") == 'open', {'durum': e4.status_code})
else: rec('E2-DANISMAN-ATANMADIGI-SIRKETTE-ISLEM', 'E', False, {'hata': 'danışmanın atanmadığı şirkette açık iş bulunamadı; kontrol koşulamadı'})
# E3: tarayıcı — HPW yöneticisi bekleyen işlerde şirket A'yı seçer, sonra B'ye geçer ve işi üstlenir; kayıt B'ye düşer, A değişmez
from playwright.sync_api import sync_playwright
a_before = sql(f"SELECT string_agg(id||':'||state||':'||version, ',' ORDER BY id) FROM platform_work_item WHERE tenant_id='{T['PILOT01']}'")
with sync_playwright() as pw:
    b = pw.chromium.launch(); ctx = b.new_context(); host = BASE.split('//')[1].split(':')[0]
    ctx.add_cookies([{'name': k, 'value': v, 'domain': host, 'path': '/'} for k, v in adm.cookies.get_dict().items()]); pg = ctx.new_page()
    pg.goto(BASE + '/app.html#/platform?sekme=isler'); pg.wait_for_selector('#is-sirket', timeout=20000)
    pg.select_option('#is-sirket', T['PILOT01']); pg.wait_for_timeout(1500); pg.select_option('#is-sirket', T['PILOT02']); pg.wait_for_timeout(1500)
    rows = pg.locator('tbody tr'); first = rows.first.inner_text()
    pg.get_by_role('button', name='üstlen', exact=True).first.click(); pg.get_by_role('dialog').get_by_role('button', name='Üstlen', exact=True).click(); pg.wait_for_timeout(2000)
    pg.screenshot(path=os.path.join(OUT, 'E3-sirket-gecisi.png'), full_page=True); b.close()
claimed = sql("SELECT t.code||'|'||(w.claimed_by IS NOT NULL) FROM platform_work_item w JOIN tenant t ON t.id=w.tenant_id WHERE w.state='claimed' ORDER BY w.claimed_at DESC NULLS LAST LIMIT 1")
a_after = sql(f"SELECT string_agg(id||':'||state||':'||version, ',' ORDER BY id) FROM platform_work_item WHERE tenant_id='{T['PILOT01']}'")
rec('E3-TARAYICI-SIRKET-GECISI-ISLEM', 'E', claimed.startswith('PILOT02|') and 'PILOT02' in first and a_before == a_after, {'ustlenilen': claimed, 'satir': first[:80], 'PILOT01_degismedi': a_before == a_after})
json.dump(results, open(os.path.join(OUT, 'sonuc.json'), 'w'), ensure_ascii=False, indent=1)
print('TOPLAM', len(results), 'BASARISIZ', sum(r['sonuc'] != 'PASS' for r in results)); sys.exit(1 if any(r['sonuc'] != 'PASS' for r in results) else 0)
