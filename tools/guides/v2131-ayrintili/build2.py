# -*- coding: utf-8 -*-
import os, sys, html, json, subprocess
sys.path.insert(0,'/tmp/k2'); from blocks import VERSION, BUILD, DATE, RAKAM; from roles import ROLES, MATRIS, MATRIS_ROLLER, UCTAN_UCA
from playwright.sync_api import sync_playwright
IMG='file:///tmp/k2/img'; OUT='/tmp/k2/pdf'; os.makedirs(OUT,exist_ok=True); os.makedirs('/tmp/k2/html',exist_ok=True)
LEG=json.load(open('/tmp/k2/legends.json')); E=lambda s: html.escape(str(s),quote=False)
CSS="""@page { size: A4; margin: 18mm 16mm 18mm 16mm; } * { box-sizing: border-box; }
body { font-family: 'Poppins', Arial, sans-serif; color:#231A15; font-size:10.2pt; line-height:1.5; margin:0 }
h1,h2,h3,h4 { font-weight:700; margin:0 }
.cover { height:257mm; background:#CF051E; color:#fff; padding:22mm 16mm; display:flex; flex-direction:column; justify-content:space-between; page-break-after:always }
.cover .brand { font-size:11pt; letter-spacing:.04em } .cover h1 { font-size:32pt; line-height:1.08; margin-top:26mm } .cover .rol { font-size:17pt; margin-top:8mm; font-weight:700 }
.cover .alt { font-size:10.5pt; margin-top:6mm; max-width:140mm } .cover .meta { font-size:9pt; border-top:1px solid rgba(255,255,255,.6); padding-top:4mm }
.kicker { font-size:8pt; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#CF051E; margin-bottom:2mm }
.chapter { page-break-before:always } .chapter h2 { font-size:19pt; line-height:1.15; margin-bottom:4mm }
h3.task { font-size:13.5pt; margin:7mm 0 2mm 0; padding-top:3mm; border-top:2px solid #231A15 } h4 { font-size:10pt; color:#CF051E; margin:3.5mm 0 1mm 0; letter-spacing:.04em; text-transform:uppercase }
.lead { font-size:11pt; margin:0 0 4mm 0 }
.box { border:1px solid #231A15; padding:3mm 4mm; margin:3mm 0 } .box.red { border-left:4px solid #CF051E } .box h3 { font-size:10.5pt; margin-bottom:1.5mm }
.dark { background:#231A15; color:#fff; padding:3mm 4mm; margin:3mm 0 4mm 0 } .dark b { color:#fff }
ol.steps { counter-reset:s; list-style:none; padding:0; margin:1mm 0 3mm 0 } ol.steps li { counter-increment:s; position:relative; padding-left:9mm; margin-bottom:2mm }
ol.steps li::before { content:counter(s); position:absolute; left:0; top:.2mm; width:6.2mm; height:6.2mm; background:#231A15; color:#fff; font-weight:700; font-size:8.5pt; text-align:center; line-height:6.2mm }
ul.notes { padding-left:5mm; margin:1mm 0 3mm 0 } ul.notes li { margin-bottom:1.4mm }
figure { margin:3mm 0 4mm 0; page-break-inside:avoid } figure img { width:100%; border:1px solid #231A15; display:block } figcaption { font-size:8.2pt; margin-top:1.5mm } figcaption b { color:#CF051E }
ol.legend { list-style:none; padding:0; margin:1.5mm 0 4mm 0; columns:2; column-gap:6mm; font-size:8.8pt } ol.legend li { position:relative; padding-left:7.5mm; margin-bottom:1.2mm; break-inside:avoid }
ol.legend li span.n { position:absolute; left:0; top:.3mm; width:5.6mm; height:5.6mm; border-radius:50%; background:#CF051E; color:#fff; font-weight:700; font-size:7.5pt; text-align:center; line-height:5.6mm }
table { width:100%; border-collapse:collapse; font-size:8.6pt; margin:2mm 0 4mm 0 } th { background:#231A15; color:#fff; text-align:left; padding:1.8mm; font-weight:700 } td { border-bottom:1px solid #231A15; padding:1.6mm 1.8mm; vertical-align:top }
.flow { display:flex; flex-wrap:wrap; gap:2mm; margin:3mm 0 } .flow span { border:1px solid #231A15; padding:1.5mm 3mm; font-size:8.8pt } .flow span::after { content:' →'; color:#CF051E; font-weight:700 } .flow span:last-child::after { content:'' }
.toc li { margin-bottom:1.1mm } .qa { display:grid; grid-template-columns: 34mm 1fr; gap:1.5mm 4mm; margin:2mm 0 } .qa b { color:#CF051E; font-size:8.6pt; text-transform:uppercase; letter-spacing:.03em } .small { font-size:8.6pt }
.two { display:flex; gap:6mm } .two > div { flex:1 }"""
fig_n=[0]
def fig(name, cap):
    fig_n[0]+=1; leg=LEG.get(name,[])
    L=''.join(f'<li><span class="n">{n}</span>{E(t)}</li>' for n,t in leg)
    return f'<figure><img src="{IMG}/{name}.jpg"><figcaption><b>Şekil {fig_n[0]}.</b> {E(cap)}{" Numaralı işaretler aşağıda açıklanmıştır." if leg else ""}</figcaption></figure>' + (f'<ol class="legend">{L}</ol>' if leg else '')
def task(t):
    h=[f'<h3 class="task">{E(t["baslik"])}</h3>']
    h.append('<div class="qa">'+''.join(f'<b>{k}</b><div>{E(v)}</div>' for k,v in (('Ne yapıyoruz?',t['ne']),('Niçin yapıyoruz?',t['nicin']),('Ne zaman yapıyoruz?',t['nezaman'])))+'</div>')
    h.append('<h4>Nasıl yapıyoruz?</h4><ol class="steps">'+''.join(f'<li>{E(s)}</li>' for s in t['nasil'])+'</ol>')
    for i,sh in enumerate(t['ekran']): h.append(fig(sh, f'{t["baslik"]} — ekran görüntüsü {i+1}' if len(t['ekran'])>1 else f'{t["baslik"]} — ekran görüntüsü'))
    h.append('<h4>Bu ekranda ne görüyorsunuz?</h4><ul class="notes">'+''.join(f'<li>{E(g)}</li>' for g in t['gor'])+'</ul>')
    h.append('<div class="qa">'+''.join(f'<b>{k}</b><div>{E(v)}</div>' for k,v in (('Sonuçta ne oluyor?',t['sonuc']),('Sıradaki iş kimde?',t['siradaki']),('Yanlış yaparsanız?',t['yanlis'])))+'</div>')
    return ''.join(h)
def cover(title, rol, alt):
    return f'<div class="cover"><div class="brand">Happy Place to Work® · HPW Act</div><div><h1>{E(title)}</h1><div class="rol">{E(rol)}</div><div class="alt">{E(alt)}</div></div><div class="meta">Sürüm {VERSION} · Build {BUILD} · {DATE}<br>Bu kılavuzdaki bütün ekran görüntüleri, v{VERSION} DOLU DEMO (sentetik veri) ortamındaki gerçek ekranlardan alınmıştır. Ekranlar değiştirilmemiştir; kırmızı numaralı işaretler açıklama için üzerine eklenmiştir.</div></div>'
def build_role(code):
    r=ROLES[code]; fig_n[0]=0; h=[cover('Kullanma kılavuzu', r['ad'], 'Uygulamayı ilk kez gören biri için adım adım. Her işlemde: ne yapıyorum, neden, ekranda ne görüyorum, bu rakam ne demek, bundan sonra ne olacak, sıradaki iş kimde.')]
    bol=['Bu rol kimdir?','Sisteme girdiğinizde ilk ne görürsünüz?','Bu sistemde sizin göreviniz nedir?','Benim normal bir günüm']+[t['baslik'] for t in r['islemler']]+['Rakamların anlamı','Baştan sona bir örnek','En sık yapılan hatalar','Bu ekranda bir şey göremiyorsanız','Terimler sözlüğü']
    h.append('<div class="chapter"><div class="kicker">İçindekiler</div><h2>Bu kılavuzda neler var?</h2><ol class="toc">'+''.join(f'<li>{E(b)}</li>' for b in bol)+'</ol><div class="dark"><b>Nasıl okunur:</b> Önce "Bu rol kimdir?" ve "Göreviniz" bölümlerini okuyun. Sonra işlemleri sırayla izleyin. Her işlemde ekran görüntüsündeki kırmızı numaralar, hemen altındaki listede açıklanır.</div></div>')
    h.append('<div class="chapter"><div class="kicker">Bölüm 1</div><h2>Bu rol kimdir?</h2>'+''.join(f'<p class="lead">{E(p)}</p>' for p in r['kimdir'])+'</div>')
    sh,notes=r['ilk']; h.append('<div class="chapter"><div class="kicker">Bölüm 2</div><h2>Sisteme girdiğinizde ilk ne görürsünüz?</h2>'+fig(sh,'Girişten sonraki ilk ekranınız')+'<ul class="notes">'+''.join(f'<li>{E(n)}</li>' for n in notes)+'</ul></div>')
    h.append('<div class="chapter"><div class="kicker">Bölüm 3</div><h2>Bu sistemde sizin göreviniz nedir?</h2><ol class="steps">'+''.join(f'<li>{E(g)}</li>' for g in r['gorev'])+'</ol><h4>İşiniz hangi noktada başlar, hangi noktada biter?</h4><div class="flow">'+''.join(f'<span>{E(s)}</span>' for s in r['surec'])+'</div><div class="box red"><h3>Bu sizin göreviniz değil</h3><ul class="notes">'+''.join(f'<li>{E(d)}</li>' for d in r['degil'])+'</ul></div><div class="box"><h3>Ne zaman işiniz tamamlanmış sayılır?</h3><p>Süreç şemasındaki son kutuya ulaştığınızda ve Dikkat listenizde size ait bekleyen konu kalmadığında. Sistem bir konuyu ancak asıl kaydı değiştiğinde kapatır.</p></div></div>')
    h.append('<div class="chapter"><div class="kicker">Bölüm 4</div><h2>Benim normal bir günüm</h2><ol class="steps">'+''.join(f'<li>{E(g)}</li>' for g in r['gun'])+'</ol></div>')
    h.append('<div class="chapter"><div class="kicker">Bölüm 5</div><h2>İşlemler</h2><p class="lead">Her işlem aynı şablonla anlatılır: ne yapıyoruz, niçin, ne zaman, nasıl, ekranda ne görüyorsunuz, sonuçta ne oluyor, sıradaki iş kimde, yanlış yaparsanız.</p>'+''.join(task(t) for t in r['islemler'])+'</div>')
    h.append('<div class="chapter"><div class="kicker">Bölüm 6</div><h2>Rakamların anlamı</h2><p class="lead">Örnek değerler DOLU DEMO\'daki gerçek ekranlardan alınmıştır (Ankara Sanayi Şubesi, 2026-ANA).</p>'+''.join(f'<div class="box"><h3>{E(a)}</h3><p class="small">{E(b)}</p></div>' for a,b in RAKAM)+'</div>')
    h.append('<div class="chapter"><div class="kicker">Bölüm 7</div><h2>Baştan sona bir örnek</h2><ol class="steps">'+''.join(f'<li>{E(s)}</li>' for s in r['senaryo'])+'</ol></div>')
    h.append('<div class="chapter"><div class="kicker">Bölüm 8</div><h2>En sık yapılan hatalar</h2><ul class="notes">'+''.join(f'<li>{E(s)}</li>' for s in r['hatalar'])+'</ul><div class="kicker" style="margin-top:8mm">Bölüm 9</div><h2>Bu ekranda bir şey göremiyorsanız</h2><table><tr><th style="width:38%">Durum</th><th>Ne yapmalı?</th></tr>'+''.join(f'<tr><td><b>{E(a)}</b></td><td>{E(b)}</td></tr>' for a,b in r['sorun'])+'</table></div>')
    h.append('<div class="chapter"><div class="kicker">Bölüm 10</div><h2>Terimler sözlüğü</h2><table><tr><th style="width:32%">Terim</th><th>Anlamı</th></tr>'+''.join(f'<tr><td><b>{E(a)}</b></td><td>{E(b)}</td></tr>' for a,b in r['sozluk'])+'</table></div>')
    return r['ad'], ''.join(h)
def build_master():
    fig_n[0]=0; from blocks import SOZLUK, SORUN
    h=[cover('Tüm roller ve uçtan uca süreç','HPW Act nasıl çalışır?','Sistemin tamamı tek süreç olarak; kim ne yapıyor matrisi; her rolün görevi; bütün işlemler ekran görüntüleriyle.')]
    h.append('<div class="chapter"><div class="kicker">Bölüm 1</div><h2>Sistemin tamamı tek süreç</h2><p class="lead">HPW Act, anket sonucunu birimde somut gelişim hedefine, aksiyona, kanıta ve takip ölçümüne bağlar. Süreç şu sırayla ilerler:</p><ol class="steps">'+''.join(f'<li>{E(s)}</li>' for s in UCTAN_UCA)+'</ol><div class="dark"><b>İki değişmez kural:</b> bir birimde aynı anda en fazla 2 etkin hedef ve en fazla 3 etkin aksiyon olur. Yapay zekâ desteği isteğe bağlıdır; hiçbir hedefi ya da aksiyonu kendisi kaydetmez.</div></div>')
    h.append('<div class="chapter"><div class="kicker">Bölüm 2</div><h2>Kim ne yapıyor?</h2><table><tr><th>İşlem</th>'+''.join(f'<th>{E(ROLES[c]["ad"].split(" (")[0])}</th>' for c in MATRIS_ROLLER)+'</tr>'+''.join('<tr><td><b>'+E(a)+'</b></td>'+''.join(f'<td>{E(v)}</td>' for v in vs)+'</tr>' for a,vs in MATRIS)+'</table><p class="small">"Kapsamında", "Bölge birimi", "Kendi birimi": yalnız yetkili olduğu birimlerde. Yapay zekâ hiçbir role yeni yetki vermez.</p></div>')
    for i,c in enumerate(MATRIS_ROLLER):
        r=ROLES[c]; h.append(f'<div class="chapter"><div class="kicker">Bölüm {3+i}</div><h2>{E(r["ad"])}</h2>'+''.join(f'<p>{E(p)}</p>' for p in r['kimdir'])+'<h4>Görevleri</h4><ol class="steps">'+''.join(f'<li>{E(g)}</li>' for g in r['gorev'])+'</ol><h4>Süreçteki yeri</h4><div class="flow">'+''.join(f'<span>{E(s)}</span>' for s in r['surec'])+'</div><div class="box red"><h3>Görevi değil</h3><ul class="notes">'+''.join(f'<li>{E(d)}</li>' for d in r['degil'])+'</ul></div></div>')
    seen=set(); tasks=[]
    for c in ('platform','ik','sube','ekip','hrbp','yonetim','bolge','izleyici'):
        for t in ROLES[c]['islemler']:
            if t['baslik'] not in seen: seen.add(t['baslik']); tasks.append(t)
    h.append('<div class="chapter"><div class="kicker">Bölüm 11</div><h2>Bütün işlemler</h2><p class="lead">Her işlem bir kez anlatılır; hangi rolün yapabildiği "Kim ne yapıyor?" tablosundadır.</p>'+''.join(task(t) for t in tasks)+'</div>')
    h.append('<div class="chapter"><div class="kicker">Bölüm 12</div><h2>Rakamların anlamı</h2>'+''.join(f'<div class="box"><h3>{E(a)}</h3><p class="small">{E(b)}</p></div>' for a,b in RAKAM)+'</div>')
    h.append('<div class="chapter"><div class="kicker">Bölüm 13</div><h2>Bu ekranda bir şey göremiyorsanız</h2><table><tr><th style="width:38%">Durum</th><th>Ne yapmalı?</th></tr>'+''.join(f'<tr><td><b>{E(a)}</b></td><td>{E(b)}</td></tr>' for a,b in SORUN)+'</table><div class="kicker" style="margin-top:8mm">Bölüm 14</div><h2>Terimler sözlüğü</h2><table><tr><th style="width:32%">Terim</th><th>Anlamı</th></tr>'+''.join(f'<tr><td><b>{E(a)}</b></td><td>{E(b)}</td></tr>' for a,b in SOZLUK)+'</table></div>')
    return 'Tüm roller ve uçtan uca süreç', ''.join(h)
FILES={'tam':'HPW-Act-Kilavuz-00-Tum-Roller-v2.13.1'}
for c,r in ROLES.items(): FILES[c]=f'HPW-Act-Kilavuz-{r["dosya"]}-v2.13.1'
only=sys.argv[1:] or list(FILES)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page()
    for role in only:
        title,doc=(build_master() if role=='tam' else build_role(role)); path=f'/tmp/k2/html/{FILES[role]}.html'
        open(path,'w',encoding='utf-8').write(f'<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>HPW Act — {E(title)}</title><style>{CSS}</style></head><body>{doc}</body></html>')
        pg.goto('file://'+path); pg.wait_for_timeout(500)
        foot=f'<div style="width:100%;font-family:Poppins,Arial;font-size:7.5px;color:#231A15;padding:0 16mm;display:flex;justify-content:space-between"><span>HPW Act · Kullanma kılavuzu · {E(title)} · Sürüm {VERSION}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'
        pg.pdf(path=f'{OUT}/{FILES[role]}.pdf', format='A4', print_background=True, prefer_css_page_size=True, display_header_footer=True, header_template='<div></div>', footer_template=foot); print(FILES[role], flush=True)
    b.close()
order=['tam','platform','ik','hrbp','yonetim','bolge','sube','ekip','izleyici']
if set(order)<=set(only): subprocess.run(['pdfunite']+[f'{OUT}/{FILES[k]}.pdf' for k in order]+[f'{OUT}/HPW-Act-Kilavuzlari-v2.13.1-TAMAMI.pdf'],check=True); print('TAMAMI')
