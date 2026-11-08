# -*- coding: utf-8 -*-
"""v2.15.0: mevcut v2.14.2 rol kılavuzlarına "6 · Yol haritası" bölümünü ekler.
Kullanım: python3 build.py <eski_pdf_klasoru> <ekran_klasoru> <cikis_klasoru>
- Bölüm 6 HTML'den Chromium ile üretilir (mevcut kılavuzların yazı tipi, boyut ve renkleriyle).
- Kapak ve içindekiler sayfası yerinde güncellenir; bütün sayfaların altbilgisi v2.15.0 ve yeni sayfa sayısıyla yeniden basılır.
- Bölüm 1–5 sayfaları değiştirilmez."""
import sys, os, html, glob
import pymupdf as fitz
from PIL import Image
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from icerik import LEG, KIM, R

SRC, SHOTS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True); TMP = os.path.join(OUT, '_tmp'); os.makedirs(TMP, exist_ok=True)
E = lambda s: html.escape(str(s), quote=False)
VER = 'v2.15.0'; AY = 'Kasım 2026'
POP = '/usr/share/fonts/truetype/google-fonts/'
FR = glob.glob(POP + 'Poppins-Regular.ttf')[0]; FB = glob.glob(POP + 'Poppins-Bold.ttf')[0]
DJ = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
INK = (0x23/255, 0x1A/255, 0x15/255); RED = (0xCF/255, 0x05/255, 0x1E/255); GREY = (0x6B/255, 0x62/255, 0x5D/255); YEL = (0xF2/255, 0xC1/255, 0x4E/255)

CSS = """@page { size: A4; margin: 16mm 14.7mm 21mm 15.1mm; } * { box-sizing: border-box; }
body { font-family: 'Poppins', sans-serif; color:#231A15; font-size:9.6pt; line-height:1.55; margin:0 }
.kicker { font-size:8pt; font-weight:700; letter-spacing:.08em; color:#CF051E; text-transform:uppercase }
h2 { font-size:16pt; font-weight:700; margin:2.5mm 0 4mm 0; line-height:1.25 }
h3 { font-size:12pt; font-weight:700; margin:7mm 0 2mm 0 }
h4 { font-size:10pt; font-weight:700; margin:5mm 0 1.5mm 0 }
p { margin:0 0 2.6mm 0 }
.not { background:#F4F1EE; border-left:1.4pt solid #CF051E; padding:3mm 4.5mm; margin:3mm 0 4mm 0 }
.blok { break-inside: avoid; page-break-inside: avoid; margin-bottom:3mm }
.fig { border:0.75pt solid #CFCAC5; display:block; margin:2mm 0 3mm 0 }
table { width:100%; border-collapse:collapse; margin:1mm 0 4mm 0 }
th { font-size:7pt; font-weight:700; text-align:left; letter-spacing:.06em; padding:1.2mm 1.5mm 1.4mm 1.5mm; border-bottom:0.8pt solid #231A15 }
td { font-size:8.4pt; padding:1.6mm 1.5mm; border-bottom:0.75pt solid #D8D3CE; vertical-align:top }
td.no { width:10mm } td.ad { width:46mm; font-weight:700 }
.mk { display:inline-block; min-width:5.3mm; height:4.2mm; background:#CF051E; color:#fff; font-weight:700; font-size:7.5pt; line-height:4.2mm; text-align:center }
.adim { display:grid; grid-template-columns: 14mm 1fr; margin:4mm 0 2mm 0; break-inside: avoid; page-break-inside: avoid }
.adim .n { font-size:20pt; font-weight:700; color:#CF051E; line-height:1 } .adim .b { font-weight:700; font-size:10pt; margin-bottom:1mm }
.sss { break-inside: avoid; margin:0 0 3mm 0 } .sss b { display:block; font-size:9.6pt }
.kaynak { font-size:8pt; color:#6B625D }"""

def img_w(name):
    w, h = Image.open(f'{SHOTS}/{name}.png').size  # 2x (masaüstü) ya da 3x (telefon)
    css = w / (3 if name.endswith('mobil') else 2)
    pt = css * 510 / 1440
    if css < 700: pt = max(pt * 1.7, 230)
    return min(510, pt)

def fig(name, legend=True):
    h = f'<img class="fig" src="file://{SHOTS}/{name}.png" style="width:{img_w(name):.0f}pt">'
    if legend and LEG.get(name):
        h += '<table><tr><th>NO</th><th>DÜĞME / ALAN</th><th>NE İŞE YARAR?</th></tr>' + ''.join(
            f'<tr><td class="no"><span class="mk">{i+1}</span></td><td class="ad">{E(a)}</td><td>{E(b)}</td></tr>' for i, (a, b) in enumerate(LEG[name])) + '</table>'
    return h

def chapter(key):
    r = R[key]; h = ['<div class="kicker">6 · Yol haritası</div><h2>Sunumdaki yol haritasını takip etmek</h2>']
    h += [f'<p>{E(p)}</p>' for p in r['giris']]
    if r['ekran']: h.append('<div class="not">Bu bölüm v2.15.0 ile eklendi. Ekran görüntüleri HPW Act v2.15.0 ürününün kendisinden, Saha Bankacılık sentetik demo verisi ve sentetik bir örnek yol haritasıyla alınmıştır. Kırmızı numaralar düğmeleri ve alanları gösterir; her görüntünün altındaki tabloda aynı numaranın ne işe yaradığı yazar.</div>')
    h.append('<div class="blok"><h4>Kim ne görür, ne işaretler?</h4><table><tr><th>ROL</th><th>NE GÖRÜR?</th><th>NEYİ İŞARETLER?</th></tr>' + ''.join(f'<tr><td class="ad">{E(a)}</td><td>{E(b)}</td><td>{E(c)}</td></tr>' for a, b, c in KIM) + '</table></div>')
    if r['surec']:
        h.append('<div class="blok"><h4>Sunumdan HPW Act\'e: sıra</h4><table><tr><th>NO</th><th>KİM</th><th>NE YAPAR?</th></tr>' + ''.join(f'<tr><td class="no"><span class="mk">{i+1}</span></td><td class="ad">{E(a)}</td><td>{E(b)}</td></tr>' for i, (a, b) in enumerate([
            ('HPW', 'Birim raporları (sunumlar) hazırlanır ve şirkete sunulur. Sunumun yapıldığı gün yol haritasının başlangıç günüdür.'),
            ('Doldurma oturumu (1. tur)', 'Sunumlardan Organizasyon ve Soru seti formları doldurulur.'),
            ('HPW / İK', 'İki form yüklenir; dönem açılır. Şirkete özel Anket sonuçları ve Yol haritası formları indirilir.'),
            ('Doldurma oturumu (2. tur)', 'Sunumlardan Anket sonuçları ve Yol haritası formları doldurulur. Çalışan alıntıları yazılmaz.'),
            ('HPW / İK', 'İki form yüklenir; HPW Act her satırı denetler, hatayı satır ve sütunuyla gösterir.'),
            ('İK', 'Kullanıcılar formu yüklenir, davetler gönderilir.'),
            ('Herkes', 'Takip başlar: üst yönetim, İK ve birim yöneticileri yol haritasını HPW Act\'ten izler.')])) + '</table></div>')
    if r['ekran']:
        for i, (t, d, n) in enumerate(r['ekran']):
            h.append(f'<div class="blok">{"<h3>Ekranlar ve düğmeler</h3>" if i == 0 else ""}<h4>{E(t)}</h4><p>{E(d)}</p>{fig(n)}</div>')
    if r['adim']:
        for i, (t, d, n) in enumerate(r['adim']):
            h.append(f'<div class="blok" style="margin:0">{"<h3>Adım adım</h3>" if i == 0 else ""}<div class="adim"><div class="n">{i+1}</div><div><div class="b">{E(t)}</div><p>{E(d)}</p>{fig(n, legend=False) if n else ""}</div></div></div>')
    h.append(''.join(f'<div class="sss">{"<h3>Sık sorulanlar</h3>" if i == 0 else ""}<b>{E(q)}</b>{E(a)}</div>' for i, (q, a) in enumerate(r['sss'])))
    return ''.join(h)

def render(pg, key):
    path = f'{TMP}/{key}.html'
    open(path, 'w', encoding='utf-8').write(f'<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>{CSS}</style></head><body>{chapter(key)}</body></html>')
    pg.goto('file://' + path); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(300)
    out = f'{TMP}/{key}-b6.pdf'; pg.pdf(path=out, format='A4', print_background=True, prefer_css_page_size=True); return out

def redact(p, rect):
    p.add_redact_annot(rect); p.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE, text=fitz.PDF_REDACT_TEXT_REMOVE)

def text(page, x, y, s, font, size, color, name):
    page.insert_text((x, y), s, fontsize=size, fontname=name, fontfile=font, color=color)

def width(s, font, size): return fitz.Font(fontfile=font).text_length(s, fontsize=size)

def fix_cover(p, d):
    box = fitz.Rect(42.8, 663.8, 553.5, 754.5)
    redact(p, box); p.draw_rect(box, color=None, fill=INK, overlay=True)
    x, y = 62.6, 691.3
    for s, f, c in (('Sürüm ', FR, (1, 1, 1)), (VER, FB, YEL), (f' · {AY}', FR, (1, 1, 1))):
        text(p, x, y, s, f, 9.49, c, 'pr' if f == FR else 'pb'); x += width(s, f, 9.49)
    para = (f'Bu kılavuzdaki ekran görüntüleri HPW Act ürününün kendisinden, sentetik demo verisiyle alınmıştır: '
            f'1–5. bölümler v2.14.2, 6. bölüm (Yol haritası) {VER}. Görüntülerdeki kırmızı numaralar düğmeleri gösterir; '
            'her ekranın altındaki tabloda aynı numaranın ne işe yaradığı yazar.')
    lines, cur = [], ''
    for w in para.split(' '):
        t = (cur + ' ' + w).strip()
        if width(t, FR, 9.49) > 465: lines.append(cur); cur = w
        else: cur = t
    lines.append(cur)
    for i, s in enumerate(lines): text(p, 62.6, 705.6 + i * 14.25, s, FR, 9.49, (1, 1, 1), 'pr')

def fix_toc(p, alt):
    # "Okuma önerisi" kutusunu bul; 6. maddeyi kutunun yerine yaz, kutuyu aşağı kaydır
    box = next(dr['rect'] for dr in p.get_drawings() if dr.get('fill') and abs(dr['fill'][0] - 0.9569) < 0.01)
    spans = [s for b in p.get_text('dict')['blocks'] for l in b.get('lines', []) for s in l['spans']]
    note = [s for s in spans if box.y0 - 1 <= s['bbox'][1] <= box.y1]
    items = [s for s in spans if s['bbox'][1] < box.y0 - 1 and s['text'].strip().rstrip('.').isdigit()]
    last = max(items, key=lambda s: s['bbox'][1]); step = 21.7; ny = last['bbox'][1] + step
    redact(p, fitz.Rect(40, box.y0 - 2, 556, box.y1 + 4)); p.draw_rect(fitz.Rect(40, box.y0 - 2, 556, box.y1 + 4), color=None, fill=(1, 1, 1), overlay=True)
    base = lambda top: top + 11.2  # 10.5pt Poppins taban çizgisi
    text(p, 48.1, base(ny), '6. ', FR, 10.5, INK, 'pr'); t = 'Yol haritası'
    text(p, 59.8, base(ny), t, FB, 10.5, INK, 'pb'); text(p, 59.8 + width(t, FB, 10.5), base(ny), f' — {alt}', FR, 10.5, INK, 'pr')
    sh = step + (0 if width(f'Yol haritası — {alt}', FR, 10.5) < 480 else 15.7)
    nb = fitz.Rect(box.x0, box.y0 + sh, box.x1, box.y1 + sh)
    p.draw_rect(nb, color=None, fill=(0.9569, 0.9451, 0.9333), overlay=True); p.draw_rect(fitz.Rect(nb.x0, nb.y0, nb.x0 + 1.4, nb.y1), color=None, fill=RED, overlay=True)
    for s in note:
        f = FB if 'Bold' in s['font'] else FR
        text(p, s['bbox'][0], s['origin'][1] + sh, s['text'], f, s['size'], INK, 'pb' if f == FB else 'pr')
    y = nb.y1 + 10
    text(p, 42.8, y + 10, f'6. bölüm {VER} ile eklendi: sunumdaki yol haritasının HPW Act\'te takibi.', FR, 9.6, INK, 'pr')

def footer(p, label, n, tot):
    redact(p, fitz.Rect(40, 816, 556, 832))
    text(p, 42.5, 826.6, f'HPW Act · {label} kullanım kılavuzu · {VER}', DJ, 5.25, GREY, 'dj')
    s = f'{n} / {tot}'; text(p, 553.5 - width(s, DJ, 5.25), 826.6, s, DJ, 5.25, GREY, 'dj')

with sync_playwright() as pw:
    br = pw.chromium.launch(); pg = br.new_page()
    for key, r in R.items():
        src = glob.glob(f'{SRC}/HPW-Act-Kilavuz-{key}.pdf')[0]
        d = fitz.open(src)
        label = d[0].get_text().split('\n')[[i for i, l in enumerate(d[0].get_text().split('\n')) if l.startswith('HPW Act · ')][0]].split('HPW Act · ')[1].split(' kullanım kılavuzu')[0]
        b6 = fitz.open(render(pg, key)); d.insert_pdf(b6)
        fix_cover(d[0], d); fix_toc(d[1], r['alt'])
        tot = d.page_count
        for i in range(tot): footer(d[i], label, i + 1, tot)
        d.set_metadata({**d.metadata, 'title': f'HPW Act — {label} kullanım kılavuzu ({VER})', 'subject': 'Kullanım kılavuzu', 'creator': 'HPW Act guides v2.15.0'})
        out = f'{OUT}/HPW-Act-Kilavuz-{key}.pdf'; d.save(out, garbage=4, deflate=True); print(key, tot, 'sayfa (bölüm 6:', b6.page_count, ')', flush=True)
    br.close()
