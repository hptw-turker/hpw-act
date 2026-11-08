"""HPW Act ölçek kabulü — gerçek HTTP API + gerçek PostgreSQL (DOLU DEMO kopyası: 12 GMY, 35 müdürlük, 400 şube, 200 alt birim, 500+ kullanıcı).
PHASE=deploy    : 200 / 400 / 500 birim dağıtım, anahtarlı tekrar, anahtarsız tekrar, yeni sürüm → pending_upgrade, kuyruk/kule/liste okumaları
PHASE=lifecycle : 400 şube tam yaşam döngüsü — hedef (API), dağıtım, eşzamanlı kabul + yerel aksiyon, eşzamanlı ret, kanıt, yeni sürüm, eşzamanlı sürüm kararları, kuyruk kararları, kule
LABEL           : sonuç etiketi (ör. yerel / gecikme-5ms)
Birimler ve kullanıcılar demo verisinden gelir (SQL ile doğrudan birim üretilmez)."""
import os, sys, json, time, statistics, subprocess, threading, requests
from concurrent.futures import ThreadPoolExecutor
BASE = os.environ.get('BASE', 'http://localhost:8787'); DB = os.environ.get('SCALE_DB', 'hpw_act_scale'); PHASE = os.environ.get('PHASE', 'deploy'); LABEL = os.environ.get('LABEL', 'yerel')
IK = ('ik@saha.demo.hpw-act.local', 'Demo-Kullanici-2026'); OUT = os.environ.get('OUT', '/tmp/scale'); os.makedirs(OUT, exist_ok=True); RUN = f'{int(time.time()) % 100000}'
tl = threading.local(); _base = requests.Session(); _r = _base.post(BASE + '/api/auth/login', json={'email': IK[0], 'password': IK[1]}); assert _r.status_code == 200, _r.text[:200]
def sess():
    # tek giriş; iş parçacıkları aynı oturum çerezini kendi bağlantı havuzlarıyla kullanır (giriş hız sınırı tetiklenmez)
    if not getattr(tl, 's', None):
        s = requests.Session(); s.cookies.update(_base.cookies); tl.s = s
    return tl.s
def call(method, path, body=None, headers=None):
    t0 = time.perf_counter(); r = sess().request(method, BASE + path, json=body, headers=headers or {}); ms = (time.perf_counter() - t0) * 1000
    try: j = r.json()
    except Exception: j = {'raw': r.text[:200]}
    return r.status_code, j, ms
def sql(q):
    return subprocess.run(['su', 'postgres', '-c', f'psql -d {DB} -Atc "{q}"'], capture_output=True, text=True).stdout.strip()
def stats(name, lat, errs, n):
    lat = sorted(lat); p = lambda q: round(lat[min(len(lat) - 1, int(q * len(lat)))], 1) if lat else None
    return {'islem': name, 'istek': n, 'hata': errs, 'hata_orani': round(errs / n, 4) if n else 0, 'p50_ms': p(0.5), 'p95_ms': p(0.95), 'max_ms': round(lat[-1], 1) if lat else None, 'toplam_ms': round(sum(lat), 1)}
def par(name, items, fn, workers=20):
    lat, errs, res = [], 0, []
    def one(x):
        st, j, ms = fn(x); return st, j, ms
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for st, j, ms in ex.map(one, items):
            lat.append(ms); res.append((st, j))
            if st >= 400: errs += 1
    return stats(name, lat, errs, len(items)), res
st, me, _ = call('GET', '/api/auth/me'); tid = me['tenantId']
org = call('GET', f'/api/t/{tid}/org')[1]['units']; today = time.strftime('%Y-%m-%d')
active = [u for u in org if str(u.get('effective_from', ''))[:10] <= today and not u.get('effective_to')]
sube = sorted([u['code'] for u in active if u['unit_type'] == 'SUBE']); other = sorted([u['code'] for u in active if u['unit_type'] not in ('SUBE',) and u['code'] not in ('HOLDING', 'SAHA')])
print('etkin birim', len(active), 'şube', len(sube), 'diğer', len(other), file=sys.stderr)
report = {'etiket': LABEL, 'faz': PHASE, 'veri': {'etkin_birim': len(active), 'sube': len(sube)}, 'olcumler': []}
if PHASE == 'deploy':
    for n in (200, 400, 500):
        codes = (sube + other)[:n] if n > len(sube) else sube[:n]; assert len(codes) == n, (n, len(codes))
        st, ma, ms = call('POST', f'/api/t/{tid}/corporate/master-actions', {'code': f'OLC-{n}-{RUN}', 'title': f'Ölçek {n}', 'cadence': 'monthly', 'horizonDays': 180}); assert st == 200, ma
        key = f'olc-{n}-{RUN}'; st, d1, t_dep = call('POST', f'/api/t/{tid}/corporate/master-actions/{ma["id"]}/deploy', {'unitCodes': codes}, {'Idempotency-Key': key})
        st2, d2, t_rep = call('POST', f'/api/t/{tid}/corporate/master-actions/{ma["id"]}/deploy', {'unitCodes': codes}, {'Idempotency-Key': key})
        st3, d3, t_nok = call('POST', f'/api/t/{tid}/corporate/master-actions/{ma["id"]}/deploy', {'unitCodes': codes})
        st4, v2, t_ver = call('POST', f'/api/t/{tid}/corporate/master-actions', {'code': f'OLC-{n}-{RUN}', 'title': f'Ölçek {n} v2', 'cadence': 'monthly', 'horizonDays': 180, 'supersedesId': ma['id']})
        pend = int(sql(f"SELECT COUNT(*) FROM cm_master_action_deployment WHERE master_action_id = '{ma['id']}' AND transition_state = 'pending_upgrade'") or 0)
        reads = []
        for path in (f'/api/t/{tid}/corporate/queue', f'/api/t/{tid}/corporate/control-tower', f'/api/t/{tid}/corporate/deployments', f'/api/t/{tid}/corporate/master-actions'):
            s_, j_, m_ = call('GET', path); reads.append((path.rsplit('/', 1)[-1], s_, round(m_, 1)))
        r50, _ = par('50 eşzamanlı okuma', list(range(50)), lambda i: call('GET', f'/api/t/{tid}/corporate/control-tower' if i % 2 else f'/api/t/{tid}/corporate/deployments'), 50)
        ok = st == 200 and d1.get('deployed') == n and d2 == d1 and d3.get('deployed') == 0 and st4 == 200 and pend == n and all(s_ == 200 for _, s_, _ in reads) and r50['hata'] == 0
        report['olcumler'].append({'birim': n, 'sonuc': 'GEÇTİ' if ok else 'KALDI', 'dagitim_ms': round(t_dep, 1), 'anahtarli_tekrar_ms': round(t_rep, 1), 'anahtarli_tekrar_ayni_yanit': d2 == d1, 'anahtarsiz_tekrar_yeni': d3.get('deployed'), 'yeni_surum_ms': round(t_ver, 1), 'pending_upgrade': pend, 'okumalar_ms': reads, 'eszamanli_50': r50})
        print(json.dumps(report['olcumler'][-1], ensure_ascii=False)[:400], file=sys.stderr)
if PHASE == 'lifecycle':
    cycles = call('GET', f'/api/t/{tid}/cycles')[1]; pub = sorted([c for c in cycles if c.get('active_batch_id')], key=lambda c: c['code']); cyc = pub[0]
    uid = {u['code']: u['id'] for u in active}; codes = sube[:400]
    # 1) hedef: her şubede kabul edilmiş hedef yoksa API ile oluştur (öneri motoru; SQL fikstürü yok)
    def target_for(code):
        s_, tl_, m1 = call('GET', f'/api/t/{tid}/cycles/{cyc["id"]}/units/{uid[code]}/targets')
        acc = [x for x in (tl_ if isinstance(tl_, list) else []) if x.get('status') in ('accepted', 'active')]
        if acc: return 200, {'id': acc[0]['id'], 'yeni': False}, m1
        for item in ('GUV-01', 'GUR-01', 'BAG-03', 'CES-04'):
            s2, j2, m2 = call('POST', f'/api/t/{tid}/cycles/{cyc["id"]}/units/{uid[code]}/targets', {'itemCode': item})
            if s2 == 200 and j2.get('status') in ('accepted', 'active'): return 200, {'id': j2.get('id') or j2.get('targetId'), 'yeni': True}, m1 + m2
        return 299, {'id': None}, m1
    if os.environ.get('TARGETS') == '1':
        deadline = time.time() + float(os.environ.get('BUDGET_S', '200')); lat = []; made = 0; errs = 0
        def tf(c):
            if time.time() > deadline: return 298, {}, 0
            return target_for(c)
        r_t, res_t = par('hedef hazırlığı (API, öneri motoru)', codes, tf, 8); report['olcumler'].append(r_t); json.dump(report, open(f'{OUT}/olcek-targets-{LABEL}-{RUN}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print(json.dumps(r_t, ensure_ascii=False)); sys.exit(0)
    tl_all = {}
    for c in codes:
        s_, tl_, _ = call('GET', f'/api/t/{tid}/cycles/{cyc["id"]}/units/{uid[c]}/targets'); acc = [x for x in (tl_ if isinstance(tl_, list) else []) if x.get('status') in ('accepted', 'active')]; tl_all[c] = acc[0]['id'] if acc else None
    tg = tl_all; with_t = [c for c in codes if tg.get(c)]; report['olcumler'].append({'islem': 'kabul edilmiş hedefi olan şube', 'sayi': len(with_t), 'hedefsiz': len(codes) - len(with_t)})
    st, ma, _ = call('POST', f'/api/t/{tid}/corporate/master-actions', {'code': f'YD-{RUN}', 'title': 'Yaşam döngüsü 400', 'cadence': 'monthly', 'horizonDays': 180}); assert st == 200, ma
    st, dep, t_dep = call('POST', f'/api/t/{tid}/corporate/master-actions/{ma["id"]}/deploy', {'unitCodes': codes}); assert dep.get('deployed') == 400, dep
    dl = call('GET', f'/api/t/{tid}/corporate/deployments')[1]; did = {d['unit_code']: d['id'] for d in dl if d['master_action_id'] == ma['id']}
    report['olcumler'].append({'islem': '400 dağıtım', 'dagitim_ms': round(t_dep, 1), 'dagitim': dep.get('deployed')})
    rej = [c for c in codes if not tg.get(c)][:40] or codes[-20:]; acc_codes = [c for c in with_t if c not in rej]
    r_a, res_a = par('eşzamanlı kabul + yerel aksiyon', acc_codes, lambda c: call('POST', f'/api/t/{tid}/corporate/deployments/{did[c]}/respond', {'response': 'accepted', 'reason': 'ölçek kabulü', 'createLocalAction': True, 'targetId': tg[c]}), 20)
    acts = [j.get('localActionId') for s_, j in res_a if s_ == 200 and j.get('localActionId')]
    r_r, _ = par('eşzamanlı ret', rej, lambda c: call('POST', f'/api/t/{tid}/corporate/deployments/{did[c]}/respond', {'response': 'rejected', 'reason': 'ölçek testi: birimde uygulanamaz'}), 20)
    report['olcumler'] += [r_a | {'yerel_aksiyon': len(acts)}, r_r]
    d0 = time.strftime('%Y-%m-%d')
    r_e, _ = par('kanıt kaydı', acts[:150], lambda a: call('POST', f'/api/t/{tid}/actions/{a}/evidence', {'date': d0, 'attendance': 8}), 20); report['olcumler'].append(r_e)
    st, v2, t_v = call('POST', f'/api/t/{tid}/corporate/master-actions', {'code': f'YD-{RUN}', 'title': 'Yaşam döngüsü 400 v2', 'cadence': 'monthly', 'horizonDays': 180, 'supersedesId': ma['id']}); assert st == 200, v2
    pend_ids = [did[c] for c in acc_codes]; dec = ['upgrade', 'keep_old', 'retire']
    r_u, _ = par('eşzamanlı sürüm kararları', list(enumerate(pend_ids)), lambda x: call('POST', f'/api/t/{tid}/corporate/deployments/{x[1]}/upgrade', {'decision': dec[x[0] % 3], 'reason': 'ölçek sürüm kararı'}), 20); report['olcumler'].append(r_u)
    q = call('GET', f'/api/t/{tid}/corporate/queue')[1]; rq = [x for x in q if x['entity_id'] in set(did[c] for c in rej)]
    r_q, _ = par('merkezi kuyruk kararları', rq, lambda x: call('POST', f'/api/t/{tid}/corporate/queue/{x["id"]}/decide', {'decision': 'ret kabul edildi', 'state': 'decided', 'outcome': 'accept'}), 10); report['olcumler'].append(r_q)
    s_, ct, t_ct = call('GET', f'/api/t/{tid}/corporate/control-tower'); bm = [x for x in ct.get('byMasterAction', []) if x['code'] == f'YD-{RUN}']
    pend_left = int(sql(f"SELECT COUNT(*) FROM cm_master_action_deployment WHERE master_action_id = '{ma['id']}' AND transition_state = 'pending_upgrade'") or 0)
    upq = sql(f"SELECT state FROM cm_central_queue WHERE dedupe_key = 'upgrade:{ma['id']}'")
    report['dogrulama'] = {'dagitim': dep.get('deployed'), 'kabul+yerel_aksiyon': len(acts), 'ret': len(rej), 'kuyruk_kararlari': len(rq), 'kalan_pending_upgrade': pend_left, 'surum_kuyruk_kaydi': upq, 'kule_ms': round(t_ct, 1), 'kule_ana_aksiyon': bm[:2]}
    ok = pend_left == 0 and upq == 'closed' and all(m.get('hata', 0) == 0 for m in report['olcumler'] if 'hata' in m and m['islem'] != 'hedef hazırlığı (API)')
    report['sonuc'] = 'GEÇTİ' if ok else 'KALDI'
json.dump(report, open(f'{OUT}/olcek-{PHASE}-{LABEL}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print(json.dumps({k: v for k, v in report.items() if k != 'olcumler'}, ensure_ascii=False)[:600])
