from pathlib import Path
import os,subprocess,json,datetime,uuid
r=Path(__file__).resolve().parent;b=r/'source/HPW_Act_TESLIMAT_v2.11.2';s=b/'GELISTIRICI_KAYNAK';o=r/'evidence/suite';o.mkdir(parents=True,exist_ok=True)
run='independent2112-'+uuid.uuid4().hex
env=os.environ|{'HPW_SOURCE':str(s),'HPW_API_RUNTIME':str(b/'DOLU_DEMO/assets/app/apps/api/dist/src'),'WEB_DIST':str(b/'DOLU_DEMO/assets/app/apps/web/dist'),'PW_MODULE':str(r/'pw.cjs'),'PLAYWRIGHT_MODULE':str(r/'pw.cjs'),'OUT':str(o),'REG_RUN':run}
tsx=str(r/'harness/node_modules/tsx/dist/loader.mjs')
jobs=[('regression-0',['node',str(s/'tools/tests/fe/ui-regresyon.cjs')],{'REG_SPLIT':'0/2'}),('regression-1',['node',str(s/'tools/tests/fe/ui-regresyon.cjs')],{'REG_SPLIT':'1/2'}),('legacy-ui',['node',str(s/'tools/tests/fe/ui-audit.cjs')],{}),('result-gate',['node',str(s/'tools/tests/fe/run-fe-tests.mjs')],{'FE_PART':'C'})]
for f in ['rules-contract.mts','dto-contract.mts','api-client-tests.mts','api-client-extra.mts','bagimsiz/contract-edge.mts','bagimsiz/contract-remaining.mts']:
 jobs.append((Path(f).stem,['node','--import',tsx,str(s/'tools/tests/fe'/f)],{}))
jobs.extend([('i18n',['node',str(s/'tools/tests/fe/i18n-coverage.mjs')],{}),('contract-audit',['node','--import',tsx,str(s/'apps/api/scripts/contract-audit.mts')],{}),('domain',['node','--import',tsx,'--test',*[str(p) for p in sorted((s/'packages/domain-core/test').glob('*.test.ts'))]],{}),('receipt-acceptance',['node',str(s/'tools/tests/bagimsiz-v2102/receipt-acceptance.mjs')],{'OUT':str(o/'receipt-acceptance')})])
results=[]
for label,cmd,extra in jobs:
 e=env|extra;Path(e['OUT']).mkdir(parents=True,exist_ok=True);start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 with (o/(label+'.log')).open('w') as f:p=subprocess.run(cmd,cwd=s,env=e,stdout=f,stderr=subprocess.STDOUT)
 results.append({'label':label,'command':cmd,'exitCode':p.returncode,'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'environment':extra})
 (o/'run.json').write_text(json.dumps({'run':run,'environment':{k:env[k] for k in ['HPW_SOURCE','HPW_API_RUNTIME','WEB_DIST','PW_MODULE','REG_RUN']},'results':results},indent=2));print(label,p.returncode,flush=True)
