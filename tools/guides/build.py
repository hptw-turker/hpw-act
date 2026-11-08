# -*- coding: utf-8 -*-
import os, sys, html
sys.path.insert(0, '/tmp/guide'); from content import ROLES, SCREENS, GLOSSARY, VERSION, DATE
from playwright.sync_api import sync_playwright
IMG = 'file:///tmp/guide/img'; OUT = '/tmp/guide/pdf'; os.makedirs(OUT, exist_ok=True); os.makedirs('/tmp/guide/html', exist_ok=True)
E = lambda s: html.escape(s, quote=False)
CSS = """
@page { size: A4; margin: 20mm 17mm 20mm 17mm; }
* { box-sizing: border-box; }
body { font-family: 'Poppins', Arial, sans-serif; color: #231A15; font-size: 10pt; line-height: 1.55; margin: 0; }
h1, h2, h3 { font-weight: 700; margin: 0; }
.cover { height: 257mm; background: #CF051E; color: #fff; padding: 22mm 16mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
.cover .brand { font-size: 11pt; letter-spacing: .04em; }
.cover h1 { font-size: 34pt; line-height: 1.08; margin-top: 30mm; }
.cover .rol { font-size: 17pt; margin-top: 8mm; font-weight: 700; }
.cover .alt { font-size: 10.5pt; margin-top: 6mm; max-width: 140mm; }
.cover .meta { font-size: 9pt; border-top: 1px solid rgba(255,255,255,.6); padding-top: 4mm; }
.kicker { font-size: 8pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #CF051E; margin-bottom: 2mm; }
.chapter { page-break-before: always; }
.chapter h2 { font-size: 20pt; line-height: 1.15; margin-bottom: 4mm; }
.lead { font-size: 11pt; margin: 0 0 5mm 0; }
.box { border-left: 3px solid #CF051E; padding: 2mm 0 2mm 5mm; margin: 4mm 0; }
.box h3 { font-size: 10.5pt; margin-bottom: 1.5mm; }
ol.steps { counter-reset: s; list-style: none; padding: 0; margin: 2mm 0 4mm 0; }
ol.steps li { counter-increment: s; position: relative; padding-left: 10mm; margin-bottom: 2.2mm; }
ol.steps li::before { content: counter(s); position: absolute; left: 0; top: 0.2mm; width: 6.5mm; height: 6.5mm; background: #231A15; color: #fff; font-weight: 700; font-size: 8.5pt; text-align: center; line-height: 6.5mm; }
ul.notes { padding-left: 5mm; margin: 1mm 0 4mm 0; } ul.notes li { margin-bottom: 1.6mm; }
figure { margin: 3mm 0 5mm 0; page-break-inside: avoid; }
figure img { width: 100%; border: 1px solid #231A15; display: block; }
figcaption { font-size: 8pt; margin-top: 1.5mm; color: #231A15; }
figcaption b { color: #CF051E; }
table { width: 100%; border-collapse: collapse; font-size: 8.8pt; margin: 3mm 0 5mm 0; }
th { background: #231A15; color: #fff; text-align: left; padding: 2mm; font-weight: 700; }
td { border-bottom: 1px solid #231A15; padding: 1.8mm 2mm; vertical-align: top; }
td.c { text-align: center; font-weight: 700; }
.two { display: flex; gap: 8mm; } .two > div { flex: 1; }
.rolenote { background: #231A15; color: #fff; padding: 3mm 4mm; margin: 3mm 0 4mm 0; font-size: 9.5pt; }
.rolenote b { color: #fff; }
.toc li { margin-bottom: 1.2mm; }
.small { font-size: 8.5pt; }
section.screen { page-break-before: always; }
"""
def fig(name, cap, n):
    return f'<figure><img src="{IMG}/{name}.jpg"><figcaption><b>Şekil {n}.</b> {E(cap)}</figcaption></figure>'
def screen_html(sc, role, fig_no, sec_no):
    h = [f'<section class="screen"><div class="kicker">Bölüm {sec_no}</div><h2 style="font-size:17pt;margin-bottom:3mm">{E(sc["baslik"])}</h2><p class="lead">{E(sc["amac"])}</p>']
    imgs = list(sc['img'])
    if imgs: h.append(fig(imgs[0][0], imgs[0][1], fig_no)); fig_no += 1
    h.append('<div class="box"><h3>Adım adım</h3><ol class="steps">' + ''.join(f'<li>{E(x)}</li>' for x in sc['adimlar']) + '</ol></div>')
    rn = sc.get('rol', {}).get(role) if role != 'tam' else None
    if rn: h.append(f'<div class="rolenote"><b>{E(ROLES[role]["ad"])} için:</b> {E(rn)}</div>')
    if role == 'tam' and sc.get('rol'):
        h.append('<div class="box"><h3>Rollere göre farklar</h3><ul class="notes">' + ''.join(f'<li><b>{E(ROLES[r]["ad"])}:</b> {E(t)}</li>' for r, t in sc['rol'].items()) + '</ul></div>')
    if sc['notlar']: h.append('<div class="box"><h3>Bilmeniz gerekenler</h3><ul class="notes">' + ''.join(f'<li>{E(x)}</li>' for x in sc['notlar']) + '</ul></div>')
    for name, cap in imgs[1:]: h.append(fig(name, cap, fig_no)); fig_no += 1
    h.append('</section>'); return ''.join(h), fig_no
def matrix():
    order = ['platform', 'ik', 'hrbp', 'yonetim', 'bolge', 'sube', 'ekip', 'izleyici']; short = {'platform': 'HPW', 'ik': 'İK Yön.', 'hrbp': 'İK İş Ort.', 'yonetim': 'Üst Yön.', 'bolge': 'Bölge', 'sube': 'Birim', 'ekip': 'Aksiyon S.', 'izleyici': 'İzleyici'}
    rows = ''.join('<tr><td>' + E(sc['baslik']) + '</td>' + ''.join(f'<td class="c">{"●" if r in sc["roller"] else ""}</td>' for r in order) + '</tr>' for sc in SCREENS if sc['id'] not in ('acilis', 'giris'))
    return '<table><tr><th>Ekran / bölüm</th>' + ''.join(f'<th>{short[r]}</th>' for r in order) + '</tr>' + rows + '</table>'
def build(role):
    tam = role == 'tam'; title = 'Tüm roller' if tam else ROLES[role]['ad']
    screens = [s for s in SCREENS if tam or role in s['roller']]
    h = [f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body>']
    h.append(f'<div class="cover"><div class="brand">Happy Place to Work® · HPW Act</div><div><h1>Kullanma<br>kılavuzu</h1><div class="rol">{E(title)}</div><div class="alt">{E("Bu kılavuz, HPW Act’in bütün ekranlarını ve bu ekranlarda her rolün ne yaptığını adım adım anlatır." if tam else ROLES[role]["kisa"])}</div></div><div class="meta">Sürüm {VERSION} · {DATE} · Ekran görüntüleri sentetik DOLU DEMO verisindendir; gerçek kişi ya da şirket bilgisi içermez.</div></div>')
    # giriş bölümü
    h.append('<div class="chapter"><div class="kicker">Başlamadan önce</div><h2>Bu kılavuz nasıl okunur</h2>')
    if tam:
        h.append('<p class="lead">HPW Act anket sonucunu birimin yerel hedefine, hedefi aksiyona, aksiyonu kanıta ve bir sonraki ölçümde takibe bağlar. Aynı ekranları farklı roller farklı yetkilerle kullanır. Aşağıdaki tablo hangi ekranın hangi rol için olduğunu gösterir; ardından her ekran sırayla anlatılır.</p>' + matrix())
        h.append('<div class="box"><h3>Roller</h3><ul class="notes">' + ''.join(f'<li><b>{E(r["ad"])}:</b> {E(r["kisa"])}</li>' for r in ROLES.values()) + '</ul></div>')
    else:
        r = ROLES[role]
        h.append(f'<p class="lead">{E(r["kisa"])} Bu kılavuz yalnız sizin kullandığınız ekranları içerir.</p><div class="two"><div class="box"><h3>Yapabilecekleriniz</h3><ul class="notes">' + ''.join(f'<li>{E(x)}</li>' for x in r['yapar']) + '</ul></div><div class="box"><h3>Yapamayacaklarınız</h3><ul class="notes">' + ''.join(f'<li>{E(x)}</li>' for x in r['yapmaz']) + '</ul></div></div>')
    h.append('<div class="box"><h3>İş akışı tek cümlede</h3><p style="margin:0">Sonuç yayımlanır → birim madde düzeyi sonucunu görür → yerel hedef koyar → aksiyon açar → kanıt girer → tamamlandı beyanı ve doğrulama → sonraki dönemde takip ölçümü. Kurumsal istek bu zincire yalnız projeksiyon ve uzlaştırma olarak eklenir; yerel hedefi değiştirmez.</p></div>')
    h.append('<div class="box"><h3>İçindekiler</h3><ol class="toc">' + ''.join(f'<li>{E(s["baslik"])}</li>' for s in screens) + '<li>Sık sorulan sorular</li><li>Terimler</li></ol></div></div>')
    fig_no = 1
    for i, sc in enumerate(screens, 1):
        part, fig_no = screen_html(sc, role, fig_no, i); h.append(part)
    faq = [('Bir sayıyı neden göremiyorum?', 'Yanıt sayısı gizlilik eşiğinin altındadır ya da o birimin değeri başka bir gizli birimin sonucunu ortaya çıkarabilir. Sistem bu durumda sayıyı hiçbir ekranda göstermez.'),
           ('Düğmeye bastım, bağlantı koptu; işlem yapıldı mı?', 'Aynı düğmeye tekrar basın. Sistem aynı işlem anahtarıyla eşleştirir; işlem yapıldıysa sonucu gösterir, ikinci kez yapmaz.'),
           ('Hedefim neden “incelemede”?', 'Başlangıç sonucu düzeltilmiş, madde anlamı değişmiş ya da öneri güveni düşük olabilir. İK yöneticisi ya da İK iş ortağı karar verene kadar kesin durum yazılmaz.'),
           ('Kurumsal istek hedefimi değiştirir mi?', 'Hayır. Kurumsal istek yalnız karşılaştırma ve uzlaştırma üretir. Katılmıyorsanız karşı teklif ya da istisna bildirirsiniz.'),
           ('Bir ekranı neden göremiyorum?', 'Ekranlar rolünüze göre açılır. Menüde olmayan bir işe ihtiyacınız varsa şirketinizin İK yöneticisine başvurun.'),
           ('Test posta kutusu nedir?', 'Test ortamında gönderilen davet ve parola postalarının kopyasıdır. Gerçek e-posta teslimatı değildir.')]
    h.append('<section class="screen"><div class="kicker">Yardım</div><h2 style="font-size:17pt;margin-bottom:3mm">Sık sorulan sorular</h2>' + ''.join(f'<div class="box"><h3>{E(q)}</h3><p style="margin:0">{E(a)}</p></div>' for q, a in faq) + '</section>')
    h.append('<section class="screen"><div class="kicker">Sözlük</div><h2 style="font-size:17pt;margin-bottom:3mm">Terimler</h2><table><tr><th style="width:32%">Terim</th><th>Anlamı</th></tr>' + ''.join(f'<tr><td><b>{E(t)}</b></td><td>{E(d)}</td></tr>' for t, d in GLOSSARY) + '</table></section>')
    h.append('</body></html>'); return title, ''.join(h)
FILES = {'tam': 'HPW-Act-Kilavuz-00-Tum-Roller', 'platform': 'HPW-Act-Kilavuz-01-HPW-Sistem-Yoneticisi', 'ik': 'HPW-Act-Kilavuz-02-IK-Yoneticisi', 'hrbp': 'HPW-Act-Kilavuz-03-IK-Is-Ortagi', 'yonetim': 'HPW-Act-Kilavuz-04-Ust-Yonetim', 'bolge': 'HPW-Act-Kilavuz-05-Bolge-Muduru', 'sube': 'HPW-Act-Kilavuz-06-Birim-Sube-Muduru', 'ekip': 'HPW-Act-Kilavuz-07-Aksiyon-Sorumlusu', 'izleyici': 'HPW-Act-Kilavuz-08-Izleyici'}
only = sys.argv[1:] or list(FILES)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    for role in only:
        title, doc = build(role); path = f'/tmp/guide/html/{FILES[role]}.html'; open(path, 'w', encoding='utf-8').write(doc)
        pg.goto('file://' + path); pg.wait_for_timeout(600)
        foot = f'<div style="width:100%;font-family:Poppins,Arial;font-size:7.5px;color:#231A15;padding:0 17mm;display:flex;justify-content:space-between"><span>HPW Act · Kullanma kılavuzu · {E(title)} · Sürüm {VERSION}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'
        pg.pdf(path=f'{OUT}/{FILES[role]}.pdf', format='A4', print_background=True, prefer_css_page_size=True, display_header_footer=True, header_template='<div></div>', footer_template=foot)
        print(FILES[role])
    b.close()
