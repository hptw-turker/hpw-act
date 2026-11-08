"""Reproduce the independent multi-command tracking probe; does not edit product code."""
from pathlib import Path
import os, subprocess, json, datetime

r = Path(__file__).resolve().parent
b = r / 'source/HPW_Act_TESLIMAT_v2.11.5'
env = os.environ | {
    'HPW_SOURCE': str(b / 'GELISTIRICI_KAYNAK'),
    'WEB_DIST': str(b / 'DOLU_DEMO/assets/app/apps/web/dist'),
}
out = r / 'evidence/multi-pending-ui'
out.mkdir(parents=True, exist_ok=True)
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
with (r / 'evidence/multi-pending-ui.log').open('w') as log:
    p = subprocess.run(['node', str(r / 'tests/multi-pending-ui.cjs')],
                       env=env | {'OUT': str(out)}, stdout=log, stderr=subprocess.STDOUT)
(out / 'run.json').write_text(json.dumps({
    'file': 'tests/multi-pending-ui.cjs', 'exitCode': p.returncode,
    'start': start, 'end': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'environment': {k: env[k] for k in ['HPW_SOURCE', 'WEB_DIST']}
}, indent=2))
raise SystemExit(p.returncode)
