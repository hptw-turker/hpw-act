# -*- coding: utf-8 -*-
"""Rol bazlı PDF kullanma kılavuzları: prototipten ekran görüntüsü alır, numaralı işaretler çizer, marka CSS'iyle HTML kurar, Chromium ile PDF'e basar.
Kullanım: python3 tools/guides/build_guides.py [rol_id ...]  → docs/guides/*.pdf"""
import base64, io, json, os, sys, time
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).parent))
from content import NEDIR, BILMENIZ_GEREKMEYEN, SOZLUK, MESAJLAR, ROLLER, TUR, EKRANLAR

ROOT = Path(__file__).resolve().parents[2]
HTML = (ROOT / 'apps/web/dist/hpw-act-prototip.html').as_uri()
OUT = ROOT / 'docs/guides'; OUT.mkdir(parents=True, exist_ok=True)
FONTS = ROOT / 'apps/web/public/fonts'
PERSONAS = json.loads((ROOT / 'tools/guides/personas.json').read_text(encoding='utf-8'))
RED, INK, WHITE = (207, 5, 30), (35, 26, 21), (255, 255, 255)
VW, VH, CHUNK = 1280, 800, 700
BADGE_FONT = ImageFont.truetype('/tmp/poppins-700.ttf', 22)
TARIH = '23.09.2026'

def b64(p): return base64.b64encode(Path(p).read_bytes()).decode()
def img_uri(im, fmt='PNG'):
    buf = io.BytesIO(); im.save(buf, fmt, optimize=True); return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()

def draw_box(d, box, n=None, pad=6):
    x, y, w, h = box
    d.rectangle([x - pad, y - pad, x + w + pad, y + h + pad], outline=INK, width=3)
    if n is not None:
        cx, cy, r = x - pad, y - pad, 19
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=INK)
        t = str(n); bb = d.textbbox((0, 0), t, font=BADGE_FONT)
        d.text((cx - (bb[2] - bb[0]) / 2 - bb[0], cy - (bb[3] - bb[1]) / 2 - bb[1]), t, fill=WHITE, font=BADGE_FONT)

class Shooter:
    def __init__(self, page): self.page = page
    def goto(self, pid, route):
        self.page.goto(f'{HTML}?aktor={pid}#{route}', wait_until='load'); self.page.wait_for_timeout(350)
    def act(self, actions):
        p = self.page
        for a in actions:
            if a[0] == 'click': p.click(a[1], timeout=3000); p.wait_for_timeout(250)
            elif a[0] == 'fill': p.fill(a[1], a[2]); p.wait_for_timeout(120)
            elif a[0] == 'select': p.select_option(a[1], a[2]); p.wait_for_timeout(250)
            elif a[0] == 'file': p.set_input_files(a[1], '/tmp/kanit-ornek.pdf'); p.wait_for_timeout(250)
    def boxes(self, selectors):
        self.page.evaluate('window.scrollTo(0,0)'); self.page.wait_for_timeout(80)
        out = []
        for s in selectors:
            try:
                el = self.page.query_selector(s); bb = el.bounding_box() if el else None
            except Exception: bb = None
            out.append((bb['x'], bb['y'], bb['width'], bb['height']) if bb else None)
        return out
    def full(self):
        self.page.evaluate('window.scrollTo(0,0)'); self.page.wait_for_timeout(80)
        return Image.open(io.BytesIO(self.page.screenshot(full_page=True))).convert('RGB')

def annotated_chunks(im, boxes):
    """Tam sayfa görüntüyü CHUNK yüksekliğinde parçalara böl; her parçada içindeki işaretleri çiz."""
    d = ImageDraw.Draw(im)
    for i, bb in enumerate(boxes):
        if bb: draw_box(d, bb, i + 1)
    pages = []
    valid = [(i + 1, bb) for i, bb in enumerate(boxes) if bb]
    bottom = min(im.height, int(max([bb[1] + bb[3] for _, bb in valid] + [CHUNK]) + 60))
    y = 0
    while True:
        h = min(CHUNK, bottom - y)
        # sınır bir işaretli kutunun içinden geçmesin: kutu ikiye bölünecekse parçayı kutunun üstünde bitir
        for _, bb in valid:
            if y < bb[1] < y + h - 20 and bb[1] + bb[3] > y + h and bb[1] - y - 24 > 300:
                h = int(bb[1] - y - 24)
        nums = [n for n, bb in valid if y <= bb[1] < y + h - 20]
        pages.append((im.crop((0, y, im.width, y + h)), nums))
        rest = [bb[1] for n, bb in valid if bb[1] >= y + h - 20]
        if not rest: break
        y = max(0, int(min(rest)) - 120)
    return pages

def crop_around(im, bb, pad=48, maxw=900):
    x, y, w, h = bb
    x0, y0 = max(0, int(x - pad)), max(0, int(y - pad)); x1, y1 = min(im.width, int(x + w + pad)), min(im.height, int(y + h + pad))
    if x1 - x0 > maxw:  # çok geniş: sola yasla (dev sayı ve başlıklar solda başlar)
        x1 = min(im.width, x0 + maxw)
    c = im.crop((x0, y0, x1, y1)); d = ImageDraw.Draw(c); draw_box(d, (x - x0, y - y0, w, h))
    return c

CSS = f"""
@font-face {{ font-family: Poppins; font-weight: 400; src: url(data:font/woff2;base64,{b64(FONTS/'poppins-400-latin.woff2')}) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+2000-206F, U+20AC, U+2122; }}
@font-face {{ font-family: Poppins; font-weight: 400; src: url(data:font/woff2;base64,{b64(FONTS/'poppins-400-latin-ext.woff2')}) format('woff2'); unicode-range: U+0100-02BA, U+1E00-1EFF; }}
@font-face {{ font-family: Poppins; font-weight: 700; src: url(data:font/woff2;base64,{b64(FONTS/'poppins-700-latin.woff2')}) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+2000-206F, U+20AC, U+2122; }}
@font-face {{ font-family: Poppins; font-weight: 700; src: url(data:font/woff2;base64,{b64(FONTS/'poppins-700-latin-ext.woff2')}) format('woff2'); unicode-range: U+0100-02BA, U+1E00-1EFF; }}
@page {{ size: A4 landscape; margin: 12mm 12mm 14mm 12mm; }}
:root {{ --red:#CF051E; --ink:#231A15; --white:#FFFFFF; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; border-radius: 0; }}
html, body {{ font-family: Poppins, sans-serif; font-weight: 400; font-size: 11pt; line-height: 1.4; color: var(--ink); background: var(--white); font-synthesis: none; }}
.page {{ break-after: page; position: relative; }}
.page:last-child {{ break-after: auto; }}
.cover {{ background: var(--red); color: var(--white); padding: 14mm; height: 183mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page; }}
.cover .display {{ font-weight: 700; font-size: 64pt; line-height: 0.96; letter-spacing: -0.025em; }}
.cover .wm {{ font-weight: 700; font-size: 16pt; }}
.kicker {{ font-weight: 700; font-size: 8.5pt; letter-spacing: 0.06em; text-transform: uppercase; }}
h1 {{ font-weight: 700; font-size: 26pt; line-height: 1.05; letter-spacing: -0.015em; margin: 6pt 0 12pt; }}
h2 {{ font-weight: 700; font-size: 14pt; line-height: 1.15; margin: 0 0 6pt; }}
p {{ margin: 0 0 6pt; }}
.lead {{ font-size: 13pt; line-height: 1.35; max-width: 60ch; }}
.red {{ color: var(--red); }}
.grid {{ display: grid; grid-template-columns: repeat(12, 1fr); column-gap: 8mm; row-gap: 6mm; }}
.c4 {{ grid-column: span 4; }} .c5 {{ grid-column: span 5; }} .c6 {{ grid-column: span 6; }} .c7 {{ grid-column: span 7; }} .c8 {{ grid-column: span 8; }} .c12 {{ grid-column: 1 / -1; }}
.hr {{ border-top: 1px solid var(--ink); margin: 6mm 0; }}
img.full {{ width: 100%; max-height: 150mm; object-fit: contain; object-position: left top; display: block; border: 1px solid var(--ink); }}
img.crop {{ max-width: 100%; max-height: 62mm; display: block; border: 1px solid var(--ink); }}
ol.num {{ list-style: none; counter-reset: n; }}
ol.num li {{ position: relative; padding-left: 11mm; margin-bottom: 4mm; break-inside: avoid; }}
ol.num li::before {{ counter-increment: n; content: counter(n); position: absolute; left: 0; top: 0; width: 8mm; height: 8mm; background: var(--ink); color: var(--white); font-weight: 700; text-align: center; line-height: 8mm; font-size: 11pt; }}
ol.num li.red::before {{ background: var(--red); }}
.step {{ display: grid; grid-template-columns: 1fr 1fr; column-gap: 8mm; align-items: start; border-top: 1px solid var(--ink); padding: 4mm 0; break-inside: avoid; }}
.step .t {{ padding-left: 11mm; position: relative; }}
.step .t .no {{ position: absolute; left: 0; top: 0; width: 8mm; height: 8mm; background: var(--ink); color: var(--white); font-weight: 700; text-align: center; line-height: 8mm; }}
.dikkat {{ border: 2px solid var(--ink); padding: 5mm; margin-top: 4mm; break-inside: avoid; }}
.dikkat .kicker {{ margin-bottom: 3mm; }}
.dikkat p {{ margin-bottom: 3pt; }}
table {{ border-collapse: collapse; width: 100%; font-size: 10pt; }}
th, td {{ text-align: left; padding: 2.4mm 3mm; border-bottom: 1px solid var(--ink); vertical-align: top; }}
thead th {{ background: var(--ink); color: var(--white); }}
.ink {{ background: var(--ink); color: var(--white); padding: 8mm; margin-top: 6mm; break-inside: avoid; }}
.ink .h2 {{ font-weight: 700; font-size: 18pt; line-height: 1.15; }}
.small {{ font-size: 9.5pt; }}
.chunk-note {{ margin-top: 3mm; }}
"""

def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def build_role(pid, shooter):
    persona = next(p for p in PERSONAS if p['id'] == pid); rol = ROLLER[pid]
    pages = []
    add = pages.append
    # --- kapak
    add(f"""<section class="cover"><div><span class="wm">Happy Place to Work®</span></div>
      <div><p class="kicker">HPW Act · Kullanma kılavuzu · {TARIH}</p><p class="display">{esc(rol['baslik'])}</p></div>
      <div class="grid"><div class="c7"><p class="lead">{esc(rol['kim'])}</p></div><div class="c5"><p class="kicker">Bu kılavuz kimin için</p><p>{esc(persona['name'])} · {esc(persona['unitLabel'])}<br>Örnek şirket: Atlas Holding · 2026 Ana Ölçüm</p></div></div></section>""")
    # --- program nedir
    add(f"""<section class="page"><p class="kicker">Başlamadan önce</p><h1>Bu program ne yapar, sizden ne ister.</h1>
      <div class="grid"><div class="c4"><p class="kicker">Program ne yapar</p>{''.join(f'<p>{esc(x)}</p>' for x in NEDIR)}</div>
      <div class="c4"><p class="kicker">Sizden beklenen</p><ol class="num">{''.join(f'<li>{esc(x)}</li>' for x in rol['gorev'])}</ol><p class="small">{esc(rol['beklenen'])}</p></div>
      <div class="c4"><p class="kicker">Bilmeniz gerekmeyenler</p>{''.join(f'<p>{esc(x)}</p>' for x in BILMENIZ_GEREKMEYEN)}</div></div>
      <div class="ink"><p class="h2">Kural basit: program önerir, siz karar verirsiniz. Hiçbir sayıyı siz <span class="red">hesaplamazsınız</span>.</p></div></section>""")
    # --- giriş adımları
    shooter.goto(pid, '/giris'); shooter.page.wait_for_timeout(300)
    login = shooter.full()
    bsel, bbtn = shooter.boxes(['#aktor-giris', 'button.btn'])
    c_sel = crop_around(login, bsel, pad=60, maxw=900) if bsel else None
    c_btn = crop_around(login, bbtn, pad=60, maxw=900) if bbtn else None
    top = login.crop((0, 0, login.width, min(login.height, 820)))
    add(f"""<section class="page"><p class="kicker">Giriş</p><h1>Programa girmek.</h1>
      <div class="grid"><div class="c7"><img class="full" src="{img_uri(top)}"></div>
      <div class="c5"><div class="step"><div class="t" style="grid-column: 1 / -1"><span class="no">1</span><p>Size gönderilen bağlantıyı tarayıcıda açın (Chrome, Edge, Safari ya da Firefox). Kırmızı ekran açılır.</p></div></div>
      <div class="step"><div class="t"><span class="no">2</span><p>'Aktör' kutusundan rolünüzü seçin: <strong>{esc(rol['baslik'])}</strong>. Gerçek sistemde bu kutu görünmez; rolünüz otomatik gelir.</p></div><div>{f'<img class="crop" src="{img_uri(c_sel)}">' if c_sel else ''}</div></div>
      <div class="step"><div class="t"><span class="no">3</span><p>'... olarak gir' düğmesine basın. İlk ekranınız olan Dikkat kuyruğu açılır.</p></div><div>{f'<img class="crop" src="{img_uri(c_btn)}">' if c_btn else ''}</div></div></div></div></section>""")
    # --- ekranı tanıyın
    shooter.goto(pid, '/'); shooter.page.wait_for_timeout(200)
    home = shooter.full(); hb = shooter.boxes([s for s, _ in TUR['alanlar']])
    header = home.crop((0, 0, home.width, 150)); d = ImageDraw.Draw(header)
    for i, bb in enumerate(hb):
        if bb and bb[1] < 150: draw_box(d, bb, i + 1)
    add(f"""<section class="page"><p class="kicker">{esc(TUR['baslik'])}</p><h1>Her ekranın üstünde aynı şerit var.</h1>
      <img class="full" src="{img_uri(header)}">
      <div class="grid" style="margin-top:6mm"><div class="c6"><ol class="num">{''.join(f'<li>{esc(t)}</li>' for _, t in TUR['alanlar'])}</ol></div>
      <div class="c6"><p class="kicker">Okuma kuralları</p>{''.join(f'<p>{esc(x)}</p>' for x in TUR['notlar'])}</div></div></section>""")
    # --- ekranlar
    for route in persona['nav']:
        key = '/hedefler@unit' if (route == '/hedefler' and persona['scope'] == 'unit') else route
        ek = EKRANLAR[key]
        if route in ('/aksiyonlar', '/kanit'):
            # aynı kayıt zinciri: Konak şube müdürü hedefi kabul eder → (kanıt için) aksiyon kabul; oturum belleği (sessionStorage) aynı sekmede korunur; diğer roller aynı kaydı görür
            shooter.goto('branch_manager', '/hedefler')
            try: shooter.act([('click', 'button:has-text("Kabul et") >> nth=0')])
            except Exception: pass
            if route == '/kanit':
                shooter.goto('branch_manager', '/aksiyonlar')
                try: shooter.act([('click', 'button:has-text("Kabul et") >> nth=0')])
                except Exception: pass
        shooter.goto(pid, route)
        if key == '/sonuclar':
            try: shooter.act([('file', 'label.file input'), ('click', 'button:has-text("Doğrula ve önizle")')])
            except Exception: pass
        if key == '/hedefler':
            import re as _re
            _t = shooter.page.evaluate("document.getElementById('root').textContent"); _m = _re.search(r'yerel öneriler (\d+[,.]\d+)', _t)
            _sup = float(_m.group(1).replace(',', '.')) if _m else 55
            shooter.act([('fill', '#parent', str(round(_sup + 2.5, 1))), ('click', 'button:has-text("Uzlaştır")')])
        boxes = shooter.boxes([s for s, _ in ek['alanlar']])
        im = shooter.full(); chunks = annotated_chunks(im, boxes)
        for ci, (cim, nums) in enumerate(chunks):
            if ci > 0 and not nums: continue
            add(f"""<section class="page"><p class="kicker">{esc(ek['baslik'])} · ekran {ci + 1}/{len(chunks)} · menü: {esc(ek['baslik'].split(' (')[0])}</p>
              <img class="full" src="{img_uri(cim)}"><p class="small chunk-note">Numaralı kutular ({', '.join(map(str, nums)) if nums else '—'}) bir sonraki sayfada açıklanır.</p></section>""")
        # açıklama + adımlar
        steps_html = []
        for si, (metin, eylemler, cropsel) in enumerate(ek['adimlar']):
            try: shooter.act(eylemler)
            except Exception as e: print('  eylem atlandı:', pid, key, si + 1, e)
            crop_html = ''
            if cropsel:
                bb = shooter.boxes([cropsel])[0]
                if bb:
                    cim = crop_around(shooter.full(), bb, pad=40, maxw=1000)
                    crop_html = f'<img class="crop" src="{img_uri(cim)}">'
            steps_html.append(f'<div class="step"><div class="t"><span class="no">{si + 1}</span><p>{esc(metin)}</p></div><div>{crop_html}</div></div>')
        alanlar = ''.join(f'<li>{esc(t)}{"" if boxes[i] else " <em>(bu örnekte görünmüyor)</em>"}</li>' for i, (_, t) in enumerate(ek['alanlar']))
        dikkat = ''.join(f'<p>{esc(x)}</p>' for x in ek['dikkat'])
        add(f"""<section class="page"><p class="kicker">{esc(ek['baslik'])} · ne görüyorsunuz</p><h1>{esc(ek['amac'])}</h1>
          <ol class="num">{alanlar}</ol>
          <p class="kicker" style="margin-top:6mm">Adım adım · ne yapacaksınız</p>{''.join(steps_html)}
          <div class="dikkat"><p class="kicker">Dikkat</p>{dikkat}</div></section>""")
    # --- mesajlar ve sözlük
    add(f"""<section class="page"><p class="kicker">Mesajlar</p><h1>Ekranda şunu görürseniz.</h1>
      <table><thead><tr><th style="width:34%">Mesaj</th><th>Ne demek, ne yapmalı</th></tr></thead><tbody>{''.join(f'<tr><td><strong>{esc(a)}</strong></td><td>{esc(b)}</td></tr>' for a, b in MESAJLAR)}</tbody></table></section>""")
    add(f"""<section class="page"><p class="kicker">Sözlük</p><h1>Kelimeler.</h1>
      <table><thead><tr><th style="width:28%">Kelime</th><th>Sade anlamı</th></tr></thead><tbody>{''.join(f'<tr><td><strong>{esc(a)}</strong></td><td>{esc(b)}</td></tr>' for a, b in SOZLUK)}</tbody></table>
      <div class="ink"><p class="h2">Takıldığınız yerde: ekranın sağ üstündeki İK İş Ortağınıza ya da Happy Place to Work danışmanınıza yazın. Hiçbir işlem <span class="red">geri alınamaz</span> değildir; her kayıt tarihçesiyle durur.</p></div></section>""")
    html = f"""<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>HPW Act — {esc(rol['baslik'])} kılavuzu</title><style>{CSS}</style></head><body>{''.join(pages)}</body></html>"""
    return html, rol['baslik']

def main(ids):
    Path('/tmp/kanit-ornek.pdf').write_bytes(b'%PDF-1.4\n%ornek\n')
    with sync_playwright() as pw:
        b = pw.chromium.launch(); app = b.new_page(viewport={'width': VW, 'height': VH}); app.set_default_timeout(3000); shooter = Shooter(app)
        printer = b.new_page()
        for pid in ids:
            t0 = time.time(); html, baslik = build_role(pid, shooter)
            hp = Path(f'/tmp/guide-{pid}.html'); hp.write_text(html, encoding='utf-8')
            printer.goto(hp.as_uri(), wait_until='load'); printer.evaluate('document.fonts.ready'); printer.wait_for_timeout(400)
            out = OUT / f"HPW-Act-Kilavuz-{pid}.pdf"
            printer.pdf(path=str(out), format='A4', landscape=True, print_background=True, prefer_css_page_size=True,
                        display_header_footer=True, header_template='<span></span>',
                        footer_template=f'<div style="font-family:Poppins,sans-serif;font-size:7pt;width:100%;padding:0 12mm;display:flex;justify-content:space-between;color:#231A15"><span>HPW Act · Kullanma kılavuzu · {baslik}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>')
            print(f'{out.name}: {out.stat().st_size // 1024} KB, {time.time() - t0:.0f} s')
        b.close()

if __name__ == '__main__':
    ids = sys.argv[1:] or [p['id'] for p in PERSONAS]
    main(ids)
