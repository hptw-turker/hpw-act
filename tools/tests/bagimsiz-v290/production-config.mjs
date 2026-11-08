import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const runtime=process.env.HPW_API_RUNTIME||resolve(import.meta.dirname,'../source/HPW_Act_TESLIMAT_v2.9.0/DOLU_DEMO/assets/app/apps/api/dist/src');
const cases=[];
for(const [label,value] of [['missing',undefined],['empty',''],['weak','x']]){
 const env={...process.env,NODE_ENV:'production',HPW_ENV:'production',SETUP_KEY:'audit-only-nonsecret-setup',COOKIE_SECURE:'true',APP_BASE_URL:'https://audit.invalid',DATABASE_URL:'postgres://audit_user:audit_generated_password@localhost/audit_only',HPW_INSTALL_ID:'audit-install'};
 delete env.HPW_ENV_FILE;delete env.HPW_MFA_KEY;
 if(value!==undefined)env.HPW_MFA_KEY=value;
 const script=`const {validateConfig}=await import(${JSON.stringify(pathToFileURL(runtime+'/config.js').href)});const {seal,unseal}=await import(${JSON.stringify(pathToFileURL(runtime+'/mfa.js').href)});let rt;try{rt=unseal(seal('synthetic-mfa-seed'))==='synthetic-mfa-seed'}catch(e){rt='seal_refused:'+e.message}console.log(JSON.stringify({problems:validateConfig(),sealRoundTrip:rt}));`;
 const r=spawnSync(process.execPath,['--input-type=module','-e',script],{env,encoding:'utf8'});
 cases.push({case:label,status:r.status,...JSON.parse(r.stdout),expected:'production startup rejects missing/empty/insufficient MFA encryption key'});
}
writeFileSync(resolve(process.env.EVIDENCE_DIR||resolve(import.meta.dirname,'../evidence'),'production-config.json'),JSON.stringify(cases,null,2));
console.log(JSON.stringify(cases,null,2));

if(cases.some(c=>c.problems.length===0))process.exitCode=1;
