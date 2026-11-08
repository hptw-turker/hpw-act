import re, json
from playwright.sync_api import sync_playwright
p='file:///home/claude/hpw-act/apps/web/dist/hpw-act-prototip.html'
personas=json.load(open('/home/claude/hpw-act/tools/guides/personas.json'))
EN=set("""act baseline check-in checkin scorecard tenant tenants admin control tower roll-up rollup lineage draft merge move close open identical equivalent changed review required evaluated high medium low count artifact declared submitted verified policy allocate run native transaction escalation correlation append only reject approve dedupe anonymize retention connector person target action evidence verify denied semantic aggregate cancelled attach comment priority contribution support frozen current dynamic adjusted status planned in_progress delayed pending partially execution impact feasible infeasible cohort platform employee experience execution deny scope role unit region company owner verifier submit sla slo rpo rto dr hris scim reorg item version budget staff shortage covered other local fit authority planned kpi resource requirement effectiveness stat bulk ops job template default settings user users login logout dashboard queue home import export file select button click save cancel edit delete new next previous back""".split())
def toks(t): return re.findall(r"[A-Za-zÇĞİÖŞÜçğıöşü_\-]{2,}", t)
found={}
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={'width':1280,'height':800}); pg.set_default_timeout(3000)
    def scan(tag):
        txt=pg.evaluate("document.body.innerText + '\\n' + Array.from(document.querySelectorAll('option,label,[aria-label],[disabled]')).map(e=>e.textContent+' '+(e.getAttribute('aria-label')||'')).join('\\n')")
        for w in toks(txt):
            lw=w.lower()
            if lw in {'results_item','results_index','hpw-act-result-bundle'}: continue  # sonuç paketi dosya adları (format sözleşmesi)
            if '_' in w or lw in EN:
                found.setdefault(w,set()).add(tag)
    for per in personas:
        pid=per['id']
        pg.goto(f'{p}?aktor={pid}#/giris'); pg.wait_for_timeout(200); scan(f'{pid} giris')
        for r in per['nav']:
            pg.goto(f'{p}?aktor={pid}#{r}'); pg.wait_for_timeout(250); scan(f'{pid} {r}')
            try:
                if r=='/hedefler' and per['scope']!='unit': pg.click('button:has-text("Uzlaştır")'); pg.wait_for_timeout(200); scan(f'{pid} {r}+hesap'); pg.click('text=Eşzamanlı düzenlemeyi dene'); pg.click('text=Hedefi onayla'); pg.wait_for_timeout(300); scan(f'{pid} {r}+409')
                if r=='/aksiyonlar': pg.click('.rows > article:nth-child(3) .btn--secondary:has-text("Uygun değil")'); pg.wait_for_timeout(200); scan(f'{pid} {r}+ret')
                if r=='/kanit': pg.click('text=Tamamlandı olarak işaretle'); pg.wait_for_timeout(200); scan(f'{pid} {r}+beyan')
            except Exception as e: print('atlandı', pid, r, str(e)[:60])
        pg.goto(f'{p}?aktor={pid}#/denetim' if pid!='hpw_auditor' else f'{p}?aktor={pid}#/kurumsal'); pg.wait_for_timeout(200); scan(f'{pid} guard')
    b.close()
for w,tags in sorted(found.items(), key=lambda x:x[0].lower()): print(f'{w:28s} {sorted(tags)[:3]}')
print('toplam', len(found))
