import re, json
from playwright.sync_api import sync_playwright
p='file:///home/claude/hpw-act/apps/web/dist/hpw-act-prototip.html'
personas=json.load(open('/home/claude/hpw-act/tools/guides/personas.json'))
TRL=re.compile(r'[çğıöşüÇĞİÖŞÜ]')
names=re.compile(r'Yılmaz|Kaya|Demir|Çelik|Koç|Öztürk|Şahin|Arslan|Kılıç|Doğan|Kurt|Çetin|Karaca|Aydın|Ayşe|Zeynep|İpek|Ozan|Tolga|Emre|Deniz|Selin|Merve|Kerem|Elif|Şube #|Şubesi|Şube \d|Müdürlüğü|İzmir|İstanbul|Türkiye|Ege|Ataşehir|Konak|İKS-ORG|kişi:|Çağrı Merkezi|Nisan|Lojistik|Körfez|Güneydoğu|Doğu Anadolu|Beta Sigorta|Gamma|Sigorta|Perakende')
found={}
JS="""() => { const w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const out=[]; let n; while((n=w.nextNode())){ const s=n.data.replace(/\\s+/g,' ').trim(); if(s) out.push(s); } return out; }"""
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={'width':1280,'height':800}); pg.set_default_timeout(2500)
    def grab(tag):
        for s in pg.evaluate(JS):
            if TRL.search(s) and not names.search(s): found.setdefault(s, tag)
    for per in personas:
        pid=per['id']
        pg.goto(f'{p}?aktor={pid}#/'); pg.wait_for_timeout(200)
        pg.click('button[aria-label="Dil"]'); pg.wait_for_timeout(300); grab(f'{pid} /')
        for r in per['nav'][1:]:
            pg.click(f'nav a[href="#{r}"]'); pg.wait_for_timeout(300); grab(f'{pid} {r}')
            try:
                if r=='/hedefler' and per['scope']!='unit': pg.click('text=Reconcile'); pg.wait_for_timeout(300); grab(f'{pid} hedef hesap'); pg.click('text=Not feasible'); pg.wait_for_timeout(200); grab('exc'); pg.click('text=Cancel'); pg.click('text=Change'); pg.wait_for_timeout(200); grab('edit')
                if r=='/hedefler' and per['scope']=='unit': pg.click('button:has-text("Accept") >> nth=0'); pg.wait_for_timeout(300); grab(f'{pid} hedef kabul')
                if r=='/aksiyonlar' and per['scope']=='unit': pg.click('button:has-text("Accept") >> nth=0'); pg.wait_for_timeout(300); grab(f'{pid} aksiyon kabul'); pg.click('.rows > article:nth-child(2) .btn--secondary >> nth=1'); pg.wait_for_timeout(200); grab('ret')
                if r=='/kanit' and per['scope']=='unit': pg.fill('#log-date','2026-10-07'); pg.click('button:has-text("Add record")'); pg.wait_for_timeout(200); pg.click('button:has-text("Add record")'); pg.wait_for_timeout(200); grab('kanit kayit'); pg.fill('#log-date','2027-02-01'); pg.click('button:has-text("Add record")'); pg.wait_for_timeout(200); grab('kanit pencere')
            except Exception as e: print('atlandı', pid, r, str(e)[:50])
    b.close()
for s,t in sorted(found.items()): print(f'{s[:90]:92s} {t}')
print('toplam', len(found))
