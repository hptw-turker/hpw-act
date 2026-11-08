// Independent v2.10.2 acceptance probe. Adaptation: models persisted receipt SQL added since original reachability probe; actual packaged Fastify, NOT PostgreSQL.
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {mkdirSync,writeFileSync} from 'node:fs';
process.env.HPW_ENV='test';process.env.NODE_ENV='test';
const R=process.env.HPW_API_RUNTIME,OUT=process.env.OUT||resolve(import.meta.dirname,'../evidence/receipt-api');mkdirSync(OUT,{recursive:true});
const {pool}=await import(pathToFileURL(R+'/db.js'));const {computeOnboarding}=await import(pathToFileURL(R+'/onboarding.js'));
const tid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222';
const t={code:'AUDIT',name:'Audit Company',locale:'tr',timezone:'Europe/Istanbul',status:'active',tracked_cycle_id:'cycle-A',service_record:{ref:'SR-1',scope:'all',owners:'HPW+customer',retentionPolicyRef:'RP-1'},service_record_at:'2026-09-01T00:00:00Z',ops_version:7};
let approvals=[],keyRow=null,profile='HR_ADMIN',customerWrites=0;const journal=new Set(),queries=[];
const result=(rows=[])=>({rows,rowCount:rows.length});
const tx={release(){},async query(q,args=[]){const sql=String(q);queries.push({sql,args});
 if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('SELECT set_config'))return result();
 if(sql.includes('auth_session_lookup'))return result([{user_id:uid,email:'customer@example.test',display_name:'Customer HR',realm:'customer',tenant_id:tid}]);
 if(sql.includes('tenant_status_lock')||sql.includes('tenant_status('))return result([{s:'active'}]);
 if(sql.startsWith('SELECT id, permission_profile, explicit_profile'))return result([{id:'member1',permission_profile:profile,explicit_profile:true,company_wide:profile==='HR_ADMIN',person_id:'person1'}]);
 if(sql.includes('FROM accountability_assignment')||sql.includes('FROM membership_scope'))return result();
 if(sql.includes('FROM tenant WHERE id'))return result([{...t}]);
 if(sql.includes('platform_assignments'))return result([{user_id:'consultant1',display_name:'Primary',duty:'primary',role:'consultant'}]);
 if(sql.includes('FROM membership m JOIN app_user'))return result([{id:'member1',user_status:'active',inv:'accepted'}]);
 if(sql.includes('AS units')&&sql.includes('AS instruments'))return result([{units:1,roles:1,instruments:1}]);
 if(sql.includes('FROM survey_cycle'))return result([{id:'cycle-A',code:'2026-A',name:'A',period_start:'2026-01-01',period_end:'2026-12-31',active_batch_id:'batch-A'}]);
 if(sql.includes('FROM import_job'))return result([{state:'committed'}]);
 if(sql.includes('COUNT(*) FILTER'))return result([{accepted:1,open:0,failed:0}]);
 if(sql.startsWith('SELECT')&&sql.includes('FROM onboarding_approval'))return result(approvals.map(x=>({...x})));
 if(sql.startsWith('UPDATE onboarding_approval')){approvals=approvals.filter(a=>a.step_key!=='go_live_customer');return result()}
 if(sql.startsWith('INSERT INTO onboarding_approval')){customerWrites++;approvals.push({step_key:'go_live_customer',approved_by:args[1],approved_at:'2026-09-28T00:00:00Z',reason:args[2],evidence_fingerprint:args[3]});return result()}
 if(sql.startsWith('INSERT INTO audit_event'))return result();
 if(sql.startsWith('INSERT INTO idempotency_key')){if(keyRow)return result();keyRow={owner_token:args[5],key:args[1],actor_id:args[2],payload_hash:args[3],response_status:0,response_body:null};return result([{owner_token:args[5]}])}
 if(sql.startsWith('SELECT payload_hash, response_status, response_body, actor_id, resource_scope'))return result(keyRow?[{...keyRow}]:[]);
 if(sql.startsWith('UPDATE idempotency_key SET response_status = $3')){
  if(keyRow?.owner_token!==args[7])return result();
  keyRow={...keyRow,response_status:args[2],response_body:args[3]===null?null:JSON.parse(args[3]),resource_scope:args[4],resource_unit_id:args[5],required_profiles:args[6],resource_unit_ids:args[8]};
  return {rows:[],rowCount:1};
 }
 if(sql.startsWith('SELECT 1 FROM command_journal'))return result(journal.has(args[1])?[{'?column?':1}]:[]);
 if(sql.startsWith('INSERT INTO command_journal')){journal.add(args[1]);return result()}
 if(sql.startsWith('DELETE FROM idempotency_key')){keyRow=null;return result()}
 if(sql.startsWith('UPDATE idempotency_key SET response_status = 409')){keyRow={...keyRow,response_status:409,response_body:args[2]};return result()}
 throw new Error('UNMOCKED QUERY '+sql);
}};pool.connect=async()=>tx;
let ob=await computeOnboarding(tx,tid);approvals.push({step_key:'service_record',approved_by:uid,approved_at:'2026-09-27T08:00:00Z',reason:'service',evidence_fingerprint:ob.fingerprints.service_record});
ob=await computeOnboarding(tx,tid);approvals.push({step_key:'go_live',approved_by:uid,approved_at:'2026-09-27T09:00:00Z',reason:'HPW',evidence_fingerprint:ob.fingerprints.go_live});
const {buildApp}=await import(pathToFileURL(R+'/server.js'));const app=await buildApp();
const options={method:'POST',url:`/api/t/${tid}/onboarding/go-live/confirm`,headers:{cookie:'hpw_session_test=synthetic-session','idempotency-key':'audit-same-key'},payload:{reason:'Customer confirms',expectedFingerprint:ob.fingerprints.go_live}};

const first=await app.inject(options),storedReceipt=JSON.parse(JSON.stringify(keyRow)),retry=await app.inject(options);
const changed=await app.inject({...options,payload:{...options.payload,reason:'Different reason'}});
profile='UNIT_MANAGER';const revoked=await app.inject(options);profile='HR_ADMIN';
const restored=await app.inject(options);
const read=await app.inject({method:'GET',url:`/api/t/${tid}/onboarding/go-live`,headers:{cookie:'hpw_session_test=synthetic-session'}});
keyRow=null;const lost=await app.inject(options); // lost reservation/receipt after committed command: journal remains.
const view=r=>({status:r.statusCode,body:r.json()});
const checks=[
 {id:'FIRST-CONFIRM',pass:first.statusCode===200,observed:view(first)},
 {id:'SAME-KEY-SAME-RECEIPT',pass:retry.statusCode===200&&JSON.stringify(retry.json())===JSON.stringify(first.json()),observed:view(retry)},
 {id:'SCOPE-PERSISTED',pass:storedReceipt.resource_scope==='tenant_wide'&&storedReceipt.required_profiles?.length===1&&storedReceipt.required_profiles[0]==='HR_ADMIN',observed:storedReceipt},
 {id:'CHANGED-BODY-REJECTED',pass:changed.statusCode===409&&changed.json().error==='idempotency_conflict',observed:view(changed)},
 {id:'CURRENT-AUTHORITY-REQUIRED',pass:revoked.statusCode===403,observed:view(revoked)},
 {id:'RESTORED-AUTHORITY-REPLAY',pass:restored.statusCode===200&&JSON.stringify(restored.json())===JSON.stringify(first.json()),observed:view(restored)},
 {id:'STATE-READ',pass:read.statusCode===200&&read.json().state==='done',observed:view(read)},
 {id:'LOST-RECEIPT-NO-REPEAT',pass:lost.statusCode===409&&lost.json().error==='receipt_lost'&&customerWrites===1,observed:{...view(lost),customerWrites}},
 {id:'EXACTLY-ONE-WRITE',pass:customerWrites===1&&approvals.filter(a=>a.step_key==='go_live_customer').length===1,observed:{customerWrites,customerRecords:approvals.filter(a=>a.step_key==='go_live_customer').length}}
];
writeFileSync(resolve(OUT,'results.json'),JSON.stringify({mode:'actual packaged server; deterministic DB; NOT PostgreSQL',checks,queries},null,2));console.log(JSON.stringify(checks,null,2));
await app.close();await pool.end();process.exitCode=checks.every(c=>c.pass)?0:1;

