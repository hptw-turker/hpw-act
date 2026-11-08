// Reachability probe for R3: actual packaged server, deterministic DB, not PostgreSQL.
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {mkdirSync,writeFileSync} from 'node:fs';
process.env.HPW_ENV='test';process.env.NODE_ENV='test';
const R=process.env.HPW_API_RUNTIME,OUT=process.env.OUT||resolve(import.meta.dirname,'../evidence/receipt-api');mkdirSync(OUT,{recursive:true});
const {pool}=await import(pathToFileURL(R+'/db.js'));const {computeOnboarding}=await import(pathToFileURL(R+'/onboarding.js'));
const tid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222';
const t={code:'AUDIT',name:'Audit Company',locale:'tr',timezone:'Europe/Istanbul',status:'active',tracked_cycle_id:'cycle-A',service_record:{ref:'SR-1',scope:'all',owners:'HPW+customer',retentionPolicyRef:'RP-1'},service_record_at:'2026-09-01T00:00:00Z',ops_version:7};
let approvals=[],keyRow=null;const journal=new Set(),queries=[];
const result=(rows=[])=>({rows,rowCount:rows.length});
const tx={release(){},async query(q,args=[]){const sql=String(q);queries.push({sql,args});
 if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('SELECT set_config'))return result();
 if(sql.includes('auth_session_lookup'))return result([{user_id:uid,email:'customer@example.test',display_name:'Customer HR',realm:'customer',tenant_id:tid}]);
 if(sql.includes('tenant_status_lock')||sql.includes('tenant_status('))return result([{s:'active'}]);
 if(sql.startsWith('SELECT id, permission_profile, explicit_profile'))return result([{id:'member1',permission_profile:'HR_ADMIN',explicit_profile:true,company_wide:true,person_id:'person1'}]);
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
 if(sql.startsWith('INSERT INTO onboarding_approval')){approvals.push({step_key:'go_live_customer',approved_by:args[1],approved_at:'2026-09-28T00:00:00Z',reason:args[2],evidence_fingerprint:args[3]});return result()}
 if(sql.startsWith('INSERT INTO audit_event'))return result();
 if(sql.startsWith('INSERT INTO idempotency_key')){if(keyRow)return result();keyRow={owner_token:args[5],key:args[1]};return result([{owner_token:args[5]}])}
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
const first=await app.inject(options),retry=await app.inject(options);
const read=await app.inject({method:'GET',url:`/api/t/${tid}/onboarding/go-live`,headers:{cookie:'hpw_session_test=synthetic-session'}});
const observed={first:{status:first.statusCode,body:first.json()},sameKeyRetry:{status:retry.statusCode,body:retry.json()},read:{status:read.statusCode,body:read.json()},customerRecords:approvals.filter(a=>a.step_key==='go_live_customer').length,queries};
const reachable=first.statusCode===200&&retry.statusCode===409&&retry.json().error==='receipt_lost'&&read.json().state==='done';
writeFileSync(resolve(OUT,'results.json'),JSON.stringify({mode:'actual packaged server; deterministic DB; NOT PostgreSQL',receiptLostReachable:reachable,observed},null,2));console.log(JSON.stringify({receiptLostReachable:reachable,first:observed.first,sameKeyRetry:observed.sameKeyRetry,read:observed.read,customerRecords:observed.customerRecords},null,2));
await app.close();await pool.end();process.exitCode=reachable?0:1;
