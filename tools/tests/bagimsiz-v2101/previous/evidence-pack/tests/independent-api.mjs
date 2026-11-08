// Actual packaged handlers + computeOnboarding; deterministic database responses.
// This verifies application decisions, NOT PostgreSQL/RLS/transaction concurrency.
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
process.env.HPW_ENV='test';process.env.NODE_ENV='test';
const root=resolve(import.meta.dirname,'..');
const R=process.env.HPW_API_RUNTIME||resolve(root,'source/HPW_Act_TESLIMAT_v2.10.0/DOLU_DEMO/assets/app/apps/api/dist/src');
const OUT=process.env.OUT||resolve(root,'evidence/independent-api');mkdirSync(OUT,{recursive:true});
const {pool}=await import(pathToFileURL(R+'/db.js'));
const {computeOnboarding}=await import(pathToFileURL(R+'/onboarding.js'));
const tid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222';
const t={code:'AUDIT',name:'Audit Company',locale:'tr',timezone:'Europe/Istanbul',status:'active',tracked_cycle_id:'cycle-A',service_record:{ref:'SR-1',scope:'all',owners:'HPW+customer',retentionPolicyRef:'RP-1'},service_record_at:'2026-09-01T00:00:00Z',ops_version:7};
const cycles=['A','B'].map(s=>({id:'cycle-'+s,code:'2026-'+s,name:'Cycle '+s,period_start:'2026-01-01',period_end:'2026-12-31',active_batch_id:'batch-'+s}));
let approvals=[];const queries=[];
const result=(rows=[])=>({rows,rowCount:rows.length});
const tx={release(){},async query(q,args=[]){
 const sql=String(q);queries.push({sql,args});
 if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('SELECT set_config'))return result();
 if(sql.includes('auth_session_lookup'))return result([{user_id:uid,email:'customer@example.test',display_name:'Customer HR',realm:'customer',tenant_id:tid}]);
 if(sql.includes('tenant_status_lock')||sql.includes('tenant_status('))return result([{s:'active'}]);
 if(sql.startsWith('SELECT id, permission_profile, explicit_profile'))return result([{id:'member1',permission_profile:'HR_ADMIN',explicit_profile:true,company_wide:true,person_id:'person1'}]);
 if(sql.includes('FROM accountability_assignment')||sql.includes('FROM membership_scope'))return result();
 if(sql.includes('FROM tenant WHERE id'))return result([{...t}]);
 if(sql.includes('platform_assignments'))return result([{user_id:'consultant1',display_name:'Primary',duty:'primary',role:'consultant'}]);
 if(sql.includes('FROM membership m JOIN app_user'))return result([{id:'member1',user_status:'active',inv:'accepted'}]);
 if(sql.includes('AS units')&&sql.includes('AS instruments'))return result([{units:1,roles:1,instruments:1}]);
 if(sql.includes('FROM survey_cycle'))return result(cycles);
 if(sql.includes('FROM import_job'))return result([{state:'committed'}]);
 if(sql.includes('COUNT(*) FILTER'))return result([{accepted:1,open:0,failed:0}]);
 if(sql.startsWith('SELECT')&&sql.includes('FROM onboarding_approval'))return result(approvals.filter(a=>!sql.includes("IN ('go_live'")||a.step_key==='go_live'||a.step_key==='go_live_customer').map(a=>({...a})));
 if(sql.startsWith('UPDATE onboarding_approval')){approvals=approvals.filter(a=>a.step_key!=='go_live_customer');return result()}
 if(sql.startsWith('INSERT INTO onboarding_approval')){approvals.push({step_key:'go_live_customer',approved_by:args[1],approved_at:'2026-09-27T20:00:00Z',reason:args[2],evidence_fingerprint:args[3]});return result()}
 if(sql.startsWith('INSERT INTO audit_event'))return result();
 throw new Error('UNMOCKED QUERY '+sql);
}};
pool.connect=async()=>tx;
let c=await computeOnboarding(tx,tid);
approvals.push({step_key:'service_record',approved_by:uid,approved_at:'2026-09-26T09:00:00Z',reason:'service approved',evidence_fingerprint:c.fingerprints.service_record});
c=await computeOnboarding(tx,tid);
approvals.push({step_key:'go_live',approved_by:uid,approved_at:'2026-09-26T10:00:00Z',reason:'HPW approved cycle A',evidence_fingerprint:c.fingerprints.go_live});
const originalFp=c.fingerprints.go_live;
const before=(await computeOnboarding(tx,tid)).steps.at(-1);
// Valid source change after HPW approval: select a different published cycle.
t.tracked_cycle_id='cycle-B';t.ops_version++;
const changed=await computeOnboarding(tx,tid);
const {buildApp}=await import(pathToFileURL(R+'/server.js'));const app=await buildApp();
const headers={cookie:'hpw_session_test=synthetic-session'};
const start=queries.length;
const get=await app.inject({method:'GET',url:`/api/t/${tid}/onboarding/go-live`,headers});
const post=await app.inject({method:'POST',url:`/api/t/${tid}/onboarding/go-live/confirm`,headers,payload:{reason:'Customer confirms old HPW approval',expectedFingerprint:originalFp}});
const afterGet=await app.inject({method:'GET',url:`/api/t/${tid}/onboarding/go-live`,headers});
const routeQueries=queries.slice(start);
const after=await computeOnboarding(tx,tid);
const observed={scope:'actual delivered Fastify handlers and onboarding calculator; mocked DB; NOT real PostgreSQL',before:before.state,changed:changed.steps.at(-1).state,originalFp,currentFp:changed.fingerprints.go_live,get:{status:get.statusCode,body:get.json()},confirm:{status:post.statusCode,body:post.json()},afterGet:{status:afterGet.statusCode,body:afterGet.json()},centralAfter:after.steps.at(-1).state,routeQueries};
const res={id:'V210-F-STALE-GOLIVE',expected:'Changed evidence requires recheck; customer must not confirm obsolete HPW approval (409), and GET must not describe it as current',observed,status:post.statusCode===409&&!get.json().awaitingCustomer?'PASS':'FAIL'};
writeFileSync(resolve(OUT,'results.json'),JSON.stringify([res],null,2));console.log(JSON.stringify(res,null,2));await app.close();await pool.end();process.exitCode=res.status==='PASS'?0:1;
