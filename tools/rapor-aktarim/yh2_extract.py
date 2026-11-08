# -*- coding: utf-8 -*-
"""HPTW raporlarından (kurum raporu + işletme yol haritası sunumları) HPW Act v3 yol haritası dosyası (yh-2) üretir.
Kullanım: python3 -I yh2_extract.py <cikti.xlsx> <sirket_kodu> <donem_kodu> <baslangic YYYY-AA-GG> <olcum_donemi> "<rapor adı>" "<şirket adı>" KURUM=<kod>|<kurum adı>:<pptx> <kod>|<işletme adı>:<pptx> ...
Karşılaştırma sütunu "<ŞİRKET> GENELİ" ise adı "<şirket adı> geneli", "SEKTÖR"/"… SEKTÖRÜ" ise "Sektör" yazılır.
Okuma geometriktir: tablo hücreleri sunumda konumlu metin kutularıdır; sütunlar başlık kutularının x konumundan, satırlar y konumundan bulunur.
Çalışan alıntıları okunmaz ve yazılmaz."""
import re, sys
from pptx import Presentation
import openpyxl
from openpyxl.styles import Font, PatternFill

PH = {'İlk 30 gün': 30, 'İlk 90 gün': 90, 'İlk 6 ay': 180}
EMU = 12700

def boxes(slide):
    out = []
    def walk(shs):
        for sh in shs:
            if sh.shape_type == 6: walk(sh.shapes); continue
            if sh.has_text_frame and sh.text_frame.text.strip():
                paras = [p.text for p in sh.text_frame.paragraphs if p.text.strip()]
                out.append({'x': sh.left / EMU, 'y': sh.top / EMU, 'w': sh.width / EMU, 'paras': paras, 't': ' '.join(paras).strip()})
    walk(slide.shapes); return out

def pnum(s):
    s = s.replace('%', '').replace(',', '.').strip()
    try: return float(s)
    except ValueError: return None

def head(slide):
    b = boxes(slide); top = sorted(b, key=lambda x: (x['y'], x['x']))
    return b, (top[0]['t'] if top else '')

def parse_deck(path, code, layer):
    prs = Presentation(path); R = {'code': code, 'layer': layer, 'plans': {}, 'steps': [], 'items': [], 'n': None}
    for s in prs.slides:
        b, _ = head(s); texts = [x['t'] for x in b]
        kick = next((x['t'] for x in b if '·' in x['t'] and x['t'].upper() == x['t'] and len(x['t']) < 140), '')
        if 'ANA SONUÇ' in kick or any(t.endswith('İÇİN ANA SONUÇ') for t in texts):
            k = next(x for x in b if x['t'].endswith('ANA SONUÇ'))
            rest = sorted([x for x in b if x['y'] > k['y'] and 'Powered by' not in x['t'] and not re.fullmatch(r'\d+', x['t'])], key=lambda x: x['y'])
            R['headline'] = rest[0]['t'] if rest else None
            body = [p for p in (rest[1]['paras'] if len(rest) > 1 else []) if not p.startswith('Başlangıç:')]
            R['summary'] = '\n'.join(body) if body else None
        m = next((re.match(r'^Eylem planı (\d+): (.+)$', t) for t in texts if re.match(r'^Eylem planı \d+: ', t)), None)
        if m and 'UYGULAMA' not in kick:
            p = {'no': int(m.group(1)), 'title': m.group(2).strip()}
            for x in b:
                t = x['t']
                mm = re.match(r'^İZLENECEK MADDE\s+(\S+)\s+(.+)$', t)
                if mm: p['code'], p['item'] = mm.group(1), mm.group(2).strip()
                if len(x['paras']) == 2:
                    k, v = x['paras'][0].strip(), x['paras'][1].strip()
                    if k == 'MEVCUT': p['cur'] = pnum(v)
                    elif k.endswith(' GENELİ') or k == 'SEKTÖR' or k.endswith(' SEKTÖRÜ'): p['cmp'] = pnum(v); p['cmpLabel'] = 'GENEL' if k.endswith(' GENELİ') else 'Sektör'
                    elif k == 'HEDEF': p['target'] = v
                    elif k == 'SORUMLULUK': p['resp'] = v
                if t.startswith('ETKİ'):
                    p['impact'] = re.sub(r'^ETKİ\s+', '', t)
                    f = re.search(r'\((\d+)/(\d+) olumlu yanıttan (\d+)/(\d+) olumlu yanıta', t)
                    if f: p['curPos'], p['n'], p['tgtPos'] = int(f.group(1)), int(f.group(2)), int(f.group(3)); R['n'] = R['n'] or int(f.group(2))
            R['plans'][p['no']] = p
        if 'UYGULAMA TAKVİMİ VE İZLEME' in kick:
            title = next(t for t in texts if t.startswith('Uygulama takvimi ve izleme:'))
            rol_adi = re.sub(r'\s*\(\d+ / \d+\)$', '', title.split(':', 1)[1].strip())
            rol = 'IK' if 'İNSAN KAYNAKLARI' in kick else ('CALISAN' if 'ÇALIŞANLAR' in kick else 'YONETIM')
            hdr = {x['t']: x for x in b if x['t'] in ('EYLEM PLANI', 'TERMİN', 'ADIM', 'ÇIKTI (İZLEME GÖSTERGESİ)', 'ÇIKTI', 'PLANA KATKISI')}
            hy = hdr['ADIM']['y']; col = lambda name: hdr[name]['x'] if name in hdr else None
            cx = {'termin': col('TERMİN'), 'adim': col('ADIM'), 'cikti': col('ÇIKTI (İZLEME GÖSTERGESİ)') or col('ÇIKTI'), 'katki': col('PLANA KATKISI')}
            cells = [x for x in b if x['y'] > hy + 5 and not x['t'].startswith(('TAKİP', 'İK TAKİBİ', 'PLANA KATKI', 'BİLGİ İÇİN')) and 'Powered by' not in x['t'] and not re.fullmatch(r'\d+', x['t'])]
            plan_lbl = sorted([x for x in cells if re.match(r'^EYLEM PLANI \d+', x['t'])], key=lambda x: x['y'])
            near = lambda x, c: c is not None and abs(x['x'] - c) < 12
            rows = sorted([x for x in cells if near(x, cx['adim'])], key=lambda x: x['y'])
            phase = None; cur_plan = None; ords = {}
            for a in rows:
                pl = [q for q in plan_lbl if q['y'] <= a['y'] + 8]
                if pl: cur_plan = int(re.match(r'^EYLEM PLANI (\d+)', pl[-1]['t']).group(1))
                same = lambda c: next((x['t'] for x in cells if near(x, cx[c]) and abs(x['y'] - a['y']) < 6), None) if cx[c] is not None else None
                tt = same('termin')
                if tt in PH: phase = PH[tt]
                k = (cur_plan, phase); ords[k] = ords.get(k, 0) + 1
                adim = a['t']; atif = adim if adim.startswith('Kurum planı ') else None
                R['steps'].append({'plan': cur_plan, 'rol': rol, 'rol_adi': rol_adi, 'gun': phase, 'sira': ords[k], 'adim': adim, 'cikti': same('cikti'), 'katki': same('katki') if rol == 'CALISAN' else None, 'atif': atif})
        if 'İZLEME GÖSTERGELERİ · ANKET MADDELERİ' in kick:
            hdr = {('GENEL' if x['t'].endswith(' GENELİ') else x['t']): x for x in b if x['t'] in ('KOD', 'ANKET MADDESİ', 'BAĞLANTI', 'MEVCUT', 'SEKTÖR', 'HEDEF') or x['t'].endswith(' GENELİ')}
            hy = hdr['KOD']['y']; near = lambda x, name: name in hdr and abs(x['x'] - hdr[name]['x']) < 12
            codes = sorted([x for x in b if x['y'] > hy + 5 and near(x, 'KOD') and re.fullmatch(r'[A-Za-z]+\d*|NPS', x['t'])], key=lambda x: x['y'])
            for i, c0 in enumerate(codes):
                same = lambda name: next((x['t'] for x in b if near(x, name) and abs(x['y'] - c0['y']) < 6), None)
                R['items'].append({'sira': i + 1, 'code': c0['t'], 'text': same('ANKET MADDESİ'), 'link': same('BAĞLANTI'), 'cur': pnum(same('MEVCUT') or ''), 'cmp': pnum(same('GENEL') or ''), 'sec': pnum(same('SEKTÖR') or ''), 'target': same('HEDEF')})
        for t in texts:
            mm = re.search(r'(\d+) çalışan yanıt vermiştir', t) if R['n'] is None else None
            if mm and R['n'] is None: R['n'] = int(mm.group(1))
    return R

def main():
    out, sirket, donem, bas, olcum, rapor_adi, sirket_adi = sys.argv[1:8]; specs = sys.argv[8:]
    decks = []; names = {}
    for s in specs:
        layer = 'KURUM' if s.startswith('KURUM=') else 'ISLETME'; s = s.split('=', 1)[1] if layer == 'KURUM' else s
        head, path = s.split(':', 1); code, _, name = head.partition('|'); decks.append(parse_deck(path, code, layer)); names[code] = name or code
    wb = openpyxl.Workbook(); wb.remove(wb.active)
    def sheet(name, cols, rows):
        ws = wb.create_sheet(name); ws.append(cols)
        for c in ws[1]: c.font = Font(bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor='231A15')
        for r in rows: ws.append([r.get(c) for c in cols])
        for i, c in enumerate(cols): ws.column_dimensions[openpyxl.utils.get_column_letter(i + 1)].width = 16 if c.endswith(('kodu', 'no', 'gun', 'sira', 'yuzde', 'olumlu', 'katman', 'turu', 'rol')) else 46
    sheet('Rapor', ['sirket_kodu', 'donem_kodu', 'rapor_adi', 'baslangic_tarihi', 'etki_olcum_donemi'], [{'sirket_kodu': sirket, 'donem_kodu': donem, 'rapor_adi': rapor_adi, 'baslangic_tarihi': bas, 'etki_olcum_donemi': olcum}])
    hb, pl, st, it = [], [], [], []
    for d in decks:
        n = d['n']; cmpl = next((p.get('cmpLabel') for p in d['plans'].values() if p.get('cmpLabel')), None); cmpl = f'{sirket_adi} geneli' if cmpl == 'GENEL' else cmpl
        hb.append({'birim_kodu': d['code'], 'katman': d['layer'], 'birim_adi': names.get(d['code'], d['code']), 'yanit_sayisi': n, 'karsilastirma_adi': cmpl, 'ana_sonuc_baslik': d.get('headline'), 'ana_sonuc_metin': d.get('summary')})
        for p in sorted(d['plans'].values(), key=lambda x: x['no']):
            hedef = p.get('target') not in (None, 'İzlenir'); cur_pos = p.get('curPos')
            if cur_pos is None and n and p.get('cur') is not None:
                c = round(p['cur'] / 100 * n)
                if abs(round(c / n * 100, 1) - p['cur']) < 0.051: cur_pos = c
            pl.append({'birim_kodu': d['code'], 'plan_no': p['no'], 'baslik': p['title'], 'madde_kodu': p.get('code'), 'madde_metni': p.get('item'), 'mevcut_olumlu': cur_pos, 'mevcut_yuzde': p.get('cur'), 'karsilastirma_yuzde': p.get('cmp'),
                       'hedef_turu': 'HEDEF' if hedef else 'IZLENIR', 'hedef_olumlu': p.get('tgtPos') if hedef else None, 'hedef_yuzde': pnum(p['target']) if hedef else None, 'sorumluluk': p.get('resp'), 'etki_metni': p.get('impact')})
        for s in d['steps']:
            st.append({'birim_kodu': d['code'], 'plan_no': s['plan'], 'rol': s['rol'], 'rol_adi': s['rol_adi'], 'asama_gun': s['gun'], 'sira': s['sira'], 'adim': s['adim'], 'cikti': s['cikti'], 'plana_katkisi': s['katki'], 'kurum_atfi': s['atif']})
        for i in d['items']:
            it.append({'birim_kodu': d['code'], 'sira': i['sira'], 'madde_kodu': i['code'], 'madde_metni': i['text'], 'baglanti': i['link'], 'mevcut_yuzde': i['cur'], 'karsilastirma_yuzde': i['cmp'], 'sektor_yuzde': i['sec'], 'hedef': i['target']})
    sheet('Birimler', ['birim_kodu', 'katman', 'birim_adi', 'yanit_sayisi', 'karsilastirma_adi', 'ana_sonuc_baslik', 'ana_sonuc_metin'], hb)
    sheet('Planlar', ['birim_kodu', 'plan_no', 'baslik', 'madde_kodu', 'madde_metni', 'mevcut_olumlu', 'mevcut_yuzde', 'karsilastirma_yuzde', 'hedef_turu', 'hedef_olumlu', 'hedef_yuzde', 'sorumluluk', 'etki_metni'], pl)
    sheet('Adimlar', ['birim_kodu', 'plan_no', 'rol', 'rol_adi', 'asama_gun', 'sira', 'adim', 'cikti', 'plana_katkisi', 'kurum_atfi'], st)
    sheet('Izleme', ['birim_kodu', 'sira', 'madde_kodu', 'madde_metni', 'baglanti', 'mevcut_yuzde', 'karsilastirma_yuzde', 'sektor_yuzde', 'hedef'], it)
    wb.save(out)
    for d in decks:
        print(f"{d['code']:9} {d['layer']:8} n={d['n']} plan={len(d['plans'])} adım={len(d['steps'])} (IK {sum(s['rol']=='IK' for s in d['steps'])}, YÖN {sum(s['rol']=='YONETIM' for s in d['steps'])}, ÇAL {sum(s['rol']=='CALISAN' for s in d['steps'])}, atıf {sum(1 for s in d['steps'] if s['atif'])}) madde={len(d['items'])} başlık={'var' if d.get('headline') else 'YOK'}")

if __name__ == '__main__': main()
