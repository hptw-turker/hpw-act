"""v2.13.1 paket AI akışı (gerçek sunucu + gerçek PostgreSQL; sağlayıcı YEREL SAHTE OpenAI): hedef öncesi plan → AI hedefi → hedef → bağlama (çağrısız) → tarihli/sıklıklı aktarım → plan ayrıntısı."""
import requests, json, os, sys
B = os.environ.get('BASE', 'http://127.0.0.1:8787'); calls = lambda: json.load(open('/tmp/sahte-openai.calls'))['n'] if os.path.exists('/tmp/sahte-openai.calls') else 0
s = requests.Session(); s.post(B + '/api/auth/login', json={'email': 'ik@pilot07.demo.hpw-act.local', 'password': 'Demo-Kullanici-2026'}); tid = s.get(B + '/api/auth/me').json()['tenantId']
H = lambda k: {'idempotency-key': k}; out = {}
out['anahtar'] = s.post(B + f'/api/t/{tid}/ai/config', json={'apiKey': 'sk-pilot-sahte-anahtar-PILOT07-0123'}, headers=H('k1')).status_code
cyc = s.get(B + f'/api/t/{tid}/cycles').json()[0]['id']; units = s.get(B + f'/api/t/{tid}/cycles/{cyc}/units').json(); u = [x for x in units if x['code'] == 'SAT'][0]['id']
rows = s.get(B + f'/api/t/{tid}/cycles/{cyc}/units/{u}/results').json()['rows']; item = next(r['itemCode'] for r in rows if r['metricCode'].endswith('_TB') and not r['suppressed'] and r.get('targetPolicy') != 'MONITOR_ONLY')
url = B + f'/api/t/{tid}/cycles/{cyc}/units/{u}/items/{item}/ai-plan'; c0 = calls()
p1 = s.post(url, json={}, headers=H('k2')); out['onizleme'] = [p1.status_code, calls() - c0]; plan = p1.json()['plan']
p2 = s.post(url, json={}, headers=H('k3')); out['yenileme_cagri'] = calls() - c0
rec = plan['plan']['targetRecommendation']['recommendedValue']; out['ai_hedefi'] = rec
t = s.post(B + f'/api/t/{tid}/cycles/{cyc}/units/{u}/targets', json={'itemCode': item, 'target': rec}, headers=H('k4')); out['hedef'] = [t.status_code, t.json().get('status')]
b = s.post(B + f"/api/t/{tid}/ai-plans/{plan['id']}/bind", json={'targetId': t.json()['id']}, headers=H('k5')); out['baglama'] = [b.status_code, calls() - c0]
g = s.get(B + f"/api/t/{tid}/targets/{t.json()['id']}/ai-plan").json(); out['bagli_plan'] = [g['plan']['id'] == plan['id'], g['plan']['stale']]
if t.json().get('status') in ('accepted', 'active'):
    a = s.post(B + f"/api/t/{tid}/ai-plans/{plan['id']}/actions", json={'indices': [0]}, headers=H('k6')); aj = a.json(); out['aktarim'] = [a.status_code, aj['actions'][0]['plannedWindow'] if a.status_code == 200 else aj]
    if a.status_code == 200: d = s.get(B + f"/api/t/{tid}/actions/{aj['actions'][0]['id']}/ai-plan").json(); out['ayrinti'] = [d['action']['title'], d['action']['cadence'], len(d['action']['steps'])]
out['toplam_saglayici_cagrisi'] = calls() - c0
print(json.dumps(out, ensure_ascii=False))
ok = out['onizleme'] == [200, 1] and out['yenileme_cagri'] == 1 and out['baglama'] == [200, 1] and out['bagli_plan'] == [True, False] and (('aktarim' not in out) or out['aktarim'][0] == 200) and out['toplam_saglayici_cagrisi'] == 1
sys.exit(0 if ok else 1)
