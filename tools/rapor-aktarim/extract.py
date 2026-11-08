"""Ant Yapı birim sunumlarından yol haritası ve sonuç verisini yapılandırılmış JSON'a çıkarır.
Kullanım: python3 -I extract.py <dump_dir> <out.json>
"""
import json, os, re, sys, glob

def pct(s):
    s = (s or '').strip().replace('%', '').replace('.', '').replace(',', '.').replace('−', '-')
    try: return float(s)
    except ValueError: return None

def items(slide):
    return sorted([i for i in slide['items'] if 't' in i and 'Powered by' not in i['t'] and not (i['y'] >= 505 and i['x'] > 860)], key=lambda d: (d['y'], d['x']))

def kicker(slide):
    for i in slide['items']:
        if 't' in i and i['y'] < 45 and i['x'] in range(55, 66): return i['t']
    return ''

def lines(t): return [x.strip() for x in t.split('\n') if x.strip()]

def find(S, k): return [s for s in S if k in kicker(s)]

def by_row(its, y0, y1): return [i for i in its if y0 <= i['y'] < y1]

def parse_cover(S):
    t = [i['t'] for i in S[0]['items'] if 't' in i]
    unit = t[2].strip(); sector = None
    for x in t:
        if x.startswith('KARŞILAŞTIRMA'):
            ref = lines(x)[1]; sector = ref.split('·')[0].strip()
    return unit, sector

def parse_participation(S):
    s = find(S, 'YÖNETİCİ ÖZETİ · KATILIM')[0]; its = items(s)
    head = next(i['t'] for i in its if i['t'].startswith('Katılım'))
    m = re.search(r'(\d+) çalışanın (\d+)', head)
    return {'headcount': int(m.group(1)), 'participants': int(m.group(2)), 'rate': pct(re.search(r'%([\d,]+)', head).group(1)), 'text': head}

def parse_score(S):
    s = find(S, 'YÖNETİCİ ÖZETİ · TEK BAKIŞTA')[0]
    title = items(s)[1]['t']
    m = re.search(r'%([\d,]+)', title)
    return {'certScore': pct(m.group(1)) if m else None, 'headline': title}

def parse_strengths(S):
    s = find(S, 'GÜÇLÜ ALANLAR VE ÖNCELİKLER')[0]; its = items(s)
    left = [i for i in its if i['x'] < 450 and i['y'] > 160 and i['y'] < 430]
    strengths = []
    for i in left:
        if i['h'] <= 18: strengths.append({'title': i['t'].strip(), 'text': ''})
        elif strengths: strengths[-1]['text'] = i['t'].strip()
    pri = []
    for i in its:
        if i['x'] > 530 and i['y'] > 160 and i['y'] < 430 and i['w'] > 300:
            L = lines(i['t']); finding = next((x for x in L if x.startswith('Bulgu:')), '')
            pri.append({'title': L[0], 'rationale': L[1] if len(L) > 1 and not L[1].startswith('Bulgu') else '', 'finding': finding.replace('Bulgu:', '').strip()})
    summary = next((i['t'] for i in its if i['y'] > 430 and i['w'] > 800), '')
    return strengths, pri, summary

def parse_influence(S):
    f = find(S, 'YOL HARİTASI · ETKİ ALANI')
    if not f: return [], ''
    s = f[0]; its = items(s)
    cols = sorted({i['x'] for i in its if 150 < i['y'] < 175})
    roles = []
    for x in cols:
        col = [i for i in its if i['x'] == x and i['y'] > 150 and i['y'] < 430]
        roles.append({'name': col[0]['t'].strip(), 'tagline': col[1]['t'].strip() if len(col) > 1 else '', 'duties': lines(col[2]['t']) if len(col) > 2 else []})
    principle = next((i['t'] for i in its if i['t'].startswith('VERİ İLKESİ')), '').replace('VERİ İLKESİ', '').strip()
    return roles, principle

def parse_agenda(S):
    f = find(S, 'YOL HARİTASI · BİRİMİN GÜNDEMİ')
    if not f: return {'title': '', 'subtitle': '', 'themes': []}
    s = f[0]; its = items(s)
    title = its[1]['t'].strip(); sub = its[2]['t'].strip()
    themes = []
    body = [i for i in its if i['y'] >= 160 and i['y'] < 500]
    for i in body:
        if i['x'] < 100 and re.match(r'^\d+\.', i['t']):
            themes.append({'order': int(i['t'].split('.')[0]), 'title': i['t'].split('.', 1)[1].strip(), 'y': i['y'], 'mentions': None, 'of': None, 'indicators': []})
    for th_i, th in enumerate(themes):
        y1 = themes[th_i + 1]['y'] if th_i + 1 < len(themes) else 500
        zone = [i for i in body if th['y'] <= i['y'] < y1]
        for i in zone:
            if 290 <= i['x'] < 330:
                m = re.match(r'\s*(\d+)\s*/\s*(\d+)', i['t']);
                if m: th['mentions'], th['of'] = int(m.group(1)), int(m.group(2))
        labels = [i for i in zone if 430 <= i['x'] < 460]
        for lab in labels:
            row = [i for i in zone if abs(i['y'] - lab['y']) <= 4 and i['x'] > 700]
            vals = sorted(row, key=lambda d: d['x'])
            th['indicators'].append({'label': lab['t'].strip(), 'unit': pct(vals[0]['t']) if len(vals) > 0 else None, 'company': pct(vals[1]['t']) if len(vals) > 1 else None, 'diff': pct(vals[2]['t']) if len(vals) > 2 else None, 'note': None})
        if not labels:
            note = [i for i in zone if i['x'] >= 430]
            if note: th['indicators'].append({'label': None, 'unit': None, 'company': None, 'diff': None, 'note': ' '.join(n['t'].strip() for n in note)})
        del th['y']
    return {'title': title, 'subtitle': sub, 'themes': themes}

PH = re.compile(r'(İlk \d+ gün|\d+\s*-\s*\d+ ay|\d+ ay)\s*:\s*')

def parse_plan(s):
    its = items(s); k = kicker(s)
    title = k.split('EYLEM PLANI ·')[1].strip()
    headline = its[1]['t'].strip()
    count = next((i for i in its if i['x'] < 70 and 160 < i['y'] < 180), None)
    of = next((i for i in its if 115 < i['x'] < 130 and 160 < i['y'] < 180), None)
    mentions = int(count['t']) if count and count['t'].strip().isdigit() else None
    ofn = int(re.search(r'(\d+)', of['t']).group(1)) if of else None
    roles = []
    for i in its:
        if i['y'] in range(150, 160) and i['x'] > 350: roles.append({'name': i['t'].strip(), 'x': i['x'], 'steps': []})
    for r in roles:
        col = [i for i in its if i['x'] == r['x'] and i['y'] > 175 and i['y'] < 430]
        for c in col: r['steps'] += lines(c['t'])
        del r['x']
    # veri dayanağı göstergeleri: sol sütun, y 200-290
    inds = []; note = None
    left = [i for i in its if i['x'] < 340 and 200 <= i['y'] < 295]
    for lab in [i for i in left if i['x'] < 70 and i['w'] > 150 and not i['t'].startswith('İşletme')]:
        if 'yer almaz' in lab['t'] or 'Ankette' in lab['t']: note = lab['t'].strip(); continue
        vals = [i for i in left if abs(i['y'] - lab['y']) <= 5 and i['x'] > 200]
        v = sorted(vals, key=lambda d: d['x'])
        uc = v[0]['t'].split('·') if v else []
        inds.append({'label': lab['t'].strip(), 'unit': pct(uc[0]) if uc else None, 'company': pct(uc[1]) if len(uc) > 1 else None, 'diff': pct(v[1]['t']) if len(v) > 1 else None})
    bottom = next((i['t'] for i in its if i['t'].startswith('İZLENECEK ÖLÇÜT')), '')
    ol, tk = bottom, ''
    if 'TAKVİM' in bottom: ol, tk = bottom.split('TAKVİM', 1)
    ol = ol.replace('İZLENECEK ÖLÇÜT', '').strip()
    measure = {'text': ol, 'label': None, 'current': None, 'company': None, 'target': None, 'rule': None}
    m = re.match(r'(.+?):\s*mevcut %([\d,]+),\s*(?:Ant Yapı geneli|.*?geneli) %([\d,]+),\s*hedef %([\d,]+)\s*\(([^)]*)\)', ol)
    if m: measure.update({'label': m.group(1).strip(), 'current': pct(m.group(2)), 'company': pct(m.group(3)), 'target': pct(m.group(4)), 'rule': m.group(5).strip()})
    milestones = []
    parts = PH.split(tk.strip())
    for j in range(1, len(parts) - 1, 2):
        milestones.append({'phase': parts[j].strip(), 'text': parts[j + 1].strip(' ·.').strip() + '.'})
    return {'title': title, 'headline': headline, 'mentions': mentions, 'of': ofn, 'indicators': inds, 'dataNote': note, 'roles': roles, 'measure': measure, 'milestones': milestones}

def parse_steps(S):
    s = find(S, 'YOL HARİTASI · UYGULAMA ADIMLARI')[0]; its = items(s)
    heads = [i for i in its if i['t'].startswith('ÖNCELİK') and i['x'] < 100]
    out = []
    for h_i, h in enumerate(heads):
        y1 = heads[h_i + 1]['y'] if h_i + 1 < len(heads) else 440
        z = [i for i in its if h['y'] <= i['y'] < y1]
        lft = [i for i in z if i['x'] < 250 and i is not h]
        out.append({'title': lft[0]['t'].strip() if lft else '', 'area': lft[1]['t'].strip() if len(lft) > 1 else '',
                    'questions': sum([lines(i['t']) for i in z if 250 <= i['x'] < 540], []),
                    'practices': sum([lines(i['t']) for i in z if i['x'] >= 540], [])})
    principle = next((i['t'] for i in its if i['t'].startswith('TEMEL İLKE')), '').replace('TEMEL İLKE', '').strip()
    return out, principle

def parse_roles(S):
    out = []
    for s in find(S, 'ROLLER VE SORUMLULUKLAR'):
        its = items(s)
        title = next(i['t'] for i in its if i['y'] in range(50, 70)).strip()
        desc = next(i['t'] for i in its if i['y'] in range(95, 110)).strip()
        cols = sorted({i['x'] for i in its if i['t'].startswith('ÖNCELİK')})
        pr = []
        for x in cols:
            col = sorted([i for i in its if abs(i['x'] - x) < 5 and 140 < i['y'] < 400 and not re.match(r'^(İlk \d+ gün|\d+\s*-\s*\d+ ay)', i['t'])], key=lambda d: d['y'])
            txt = [c for c in col if not c['t'].startswith(('ÖNCELİK', 'SORUMLULUKLAR', 'BEKLENEN'))]
            exp = next((c['t'] for c in col if c['t'].startswith('BEKLENEN')), '').replace('BEKLENEN SONUÇ', '').strip()
            pr.append({'title': txt[0]['t'].strip() if txt else '', 'duties': lines(txt[1]['t']) if len(txt) > 1 else [], 'expected': exp})
        phases = []
        for i in sorted(its, key=lambda d: (d['y'], d['x'])):
            m = re.match(r'^(İlk \d+ gün|\d+\s*-\s*\d+ ay|\d+ ay)\s*(.*)$', i['t'].strip(), re.S)
            if m and i['y'] >= 370 and i['w'] > 200:
                phases.append({'phase': m.group(1).strip(), 'text': ' '.join(lines(m.group(2)))})
        note = next((i['t'] for i in its if i['y'] > 440 and i['w'] > 800), '')
        nm = note.split('  ', 1)
        out.append({'title': title, 'description': desc, 'priorities': pr, 'phases': phases, 'noteTitle': nm[0].strip(), 'note': nm[1].strip() if len(nm) > 1 else ''})
    return out

def parse_calendar(S):
    s = find(S, 'UYGULAMA AŞAMALARI')[0]; its = items(s)
    cols = sorted({i['x'] for i in its if 130 < i['y'] < 145})
    out = []
    for x in cols:
        col = sorted([i for i in its if abs(i['x'] - x) < 5 and i['y'] > 130], key=lambda d: d['y'])
        label, title = col[0]['t'].strip(), col[1]['t'].strip()
        ws = []; rest = col[2:]
        outcome = ''
        k = 0
        while k < len(rest):
            c = rest[k]
            if c['y'] > 400: outcome = c['t'].strip(); k += 1; continue
            if k + 1 < len(rest) and rest[k + 1]['y'] <= 400: ws.append({'title': c['t'].strip(), 'text': rest[k + 1]['t'].strip()}); k += 2
            else: k += 1
        out.append({'label': label, 'title': title, 'workstreams': ws, 'outcome': outcome})
    return out

def parse_monitoring(S):
    s = find(S, 'İZLEME VE HEDEFLER')[0]; its = items(s)
    rows = []
    for lab in [i for i in its if i['x'] < 70 and 135 < i['y'] < 380]:
        r = sorted([i for i in its if abs(i['y'] - lab['y']) <= 5 and i['x'] > 300], key=lambda d: d['x'])
        g = {c['x']: c['t'].strip() for c in r}
        def col(lo, hi):
            for x, v in g.items():
                if lo <= x < hi: return v
            return None
        rows.append({'label': lab['t'].strip(), 'current': col(370, 470), 'sector': col(470, 570), 'company': col(570, 700), 'target': col(700, 900)})
    appr = next((i['t'] for i in its if i['t'].startswith('İZLEME YAKLAŞIMI')), '')
    return rows, '\n'.join(lines(appr)[1:])

def parse_conclusion(S):
    s = [x for x in S if any('İÇİN ANA SONUÇ' in i.get('t', '') for i in x['items'])][0]
    its = sorted([i for i in s['items'] if 't' in i], key=lambda d: d['y'])
    return {'title': its[0]['t'].strip(), 'headline': its[1]['t'].strip(), 'body': lines(its[2]['t']) if len(its) > 2 else []}

def parse_questions(S):
    out = []; section = None; last_dim = None
    for s in find(S, 'SORU LİSTESİ'):
        its = items(s)
        secs = sorted([i for i in its if i['x'] < 70 and i['w'] > 500 and i['y'] >= 150], key=lambda d: d['y'])
        names = sorted([i for i in its if i['x'] < 70 and i['w'] < 200 and i['y'] >= 150 and 'soru' not in i['t']], key=lambda d: d['y'])
        qs = sorted([i for i in its if 230 <= i['x'] < 250 and i['y'] >= 150], key=lambda d: d['y'])
        for q in qs:
            v = sorted([i for i in its if abs(i['y'] - q['y']) <= 3 and i['x'] > 650], key=lambda d: d['x'])
            above = [g for g in names if g['y'] <= q['y'] + 5]
            if above: last_dim = above[-1]['t'].strip()
            sa = [x for x in secs if x['y'] <= q['y']]
            if sa: section = sa[-1]['t'].strip()
            diff_t = v[1]['t'].strip() if len(v) > 1 else ''
            out.append({'section': section, 'dimension': last_dim, 'text': q['t'].strip(), 'unit': pct(v[0]['t']) if v else None,
                        'sectorDiff': pct(diff_t) if diff_t and 'özgü' not in diff_t else None, 'custom': 'özgü' in diff_t})
    return out

def main(src, dst):
    units = []
    for f in sorted(glob.glob(os.path.join(src, '*.json'))):
        S = json.load(open(f)); key = os.path.basename(f)[:-5]
        unit, sector = parse_cover(S)
        strengths, pri, summary = parse_strengths(S)
        roles, principle = parse_influence(S)
        steps, step_principle = parse_steps(S)
        mon, appr = parse_monitoring(S)
        plans = [parse_plan(s) for s in find(S, 'EYLEM PLANI ·')]
        units.append({'key': key, 'name': unit, 'sector': sector, 'participation': parse_participation(S), 'score': parse_score(S),
                      'roadmap': {'conclusion': parse_conclusion(S), 'strengths': strengths, 'priorities': pri, 'prioritySummary': summary,
                                  'influence': {'roles': roles, 'principle': principle}, 'agenda': parse_agenda(S), 'plans': plans,
                                  'priorityPractices': steps, 'practicePrinciple': step_principle, 'roleResponsibilities': parse_roles(S),
                                  'calendar': parse_calendar(S), 'monitoring': mon, 'monitoringApproach': appr},
                      'questions': parse_questions(S)})
    json.dump({'company': 'Ant Yapı', 'cycle': '2026', 'units': units}, open(dst, 'w'), ensure_ascii=False, indent=1)
    for u in units:
        r = u['roadmap']
        print(u['key'], '|', u['name'], '|', u['sector'], '| n', u['participation']['participants'], '| str', len(r['strengths']), '| pri', len(r['priorities']),
              '| themes', len(r['agenda']['themes']), '| plans', len(r['plans']), [len(p['milestones']) for p in r['plans']], [p['measure']['target'] for p in r['plans']],
              '| roles', len(r['roleResponsibilities']), '| cal', [len(c['workstreams']) for c in r['calendar']], '| mon', len(r['monitoring']), '| q', len(u['questions']))

if __name__ == '__main__': main(sys.argv[1], sys.argv[2])
