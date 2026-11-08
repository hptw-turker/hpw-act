// Runs the shipped Fastify handlers. PostgreSQL is replaced only at pool.connect
// for deterministic authorization and audit-failure injection. This is NOT a PostgreSQL integration test.
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
process.env.HPW_ENV='test';process.env.NODE_ENV='test';
const root=process.env.HPW_API_RUNTIME||resolve(import.meta.dirname,'../source/HPW_Act_TESLIMAT_v2.9.0/DOLU_DEMO/assets/app/apps/api/dist/src');
const {pool}=await import(pathToFileURL(root+'/db.js').href);
const tid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',iid='33333333-3333-4333-8333-333333333333';
let scenario={role:'admin',mfa:true,status:'active',intervention:true,failAudit:false};
let state={businessWrites:0,tenantAudit:0,platformAudit:0};
const queries=[];
pool.connect=async()=>{let pending={businessWrites:0,tenantAudit:0,platformAudit:0};return {release(){},async query(q,args=[]){
 const sql=String(q);queries.push(sql);
 const result=(rows=[])=>({rows,rowCount:rows.length});
 if(sql==='BEGIN'||sql==='ROLLBACK'||sql.startsWith('SELECT set_config'))return result();
 if(sql==='COMMIT'){for(const k in pending)state[k]+=pending[k];pending={businessWrites:0,tenantAudit:0,platformAudit:0};return result()}
 if(sql.includes('auth_session_lookup'))return result([{user_id:uid,email:'admin@example.test',display_name:'Test Admin',realm:'platform',tenant_id:tid}]);
 if(sql.includes('platform_session_state'))return result([{role:scenario.role,mfa_enabled:scenario.mfa,mfa_at:scenario.mfa?new Date().toISOString():null}]);
 if(sql.includes('platform_tenant_ctx'))return result([{has_access:true,role:scenario.role,tenant_status:scenario.status,intervention_id:scenario.intervention?iid:null,intervention_actor:uid}]);
 if(sql.includes('auth_platform_has_tenant'))return result([{ok:true}]);
 if(sql.includes('platform_list_tenants'))return result([]);
 if(sql.startsWith('SELECT id, sla_due_at FROM attention_item'))return result([]);
 if(sql.startsWith('INSERT INTO attention_item')){pending.businessWrites++;return result([])}
 if(sql.startsWith('INSERT INTO audit_event')){pending.tenantAudit++;return result([])}
 if(sql.startsWith('INSERT INTO platform_audit_event')){if(scenario.failAudit)throw new Error('injected_platform_audit_storage_failure');pending.platformAudit++;return result([])}
 throw new Error('UNMOCKED QUERY '+sql);
}}};
const {buildApp}=await import(pathToFileURL(root+'/server.js').href);
const app=await buildApp();const results=[];
const mutate=()=>app.inject({method:'POST',url:`/api/t/${tid}/attention/test-key/snooze`,headers:{cookie:'hpw_session_test=synthetic-session'},payload:{until:'2027-01-01T00:00:00Z'}});
for(const [name,patch] of [['MFA_REQUIRED',{mfa:false}],['AUDITOR_WRITE_DENIED',{role:'auditor'}],['ADMIN_NEEDS_INTERVENTION',{intervention:false}],['SUSPENDED_READONLY',{status:'suspended'}]]){
 scenario={role:'admin',mfa:true,status:'active',intervention:true,failAudit:false,...patch};
 const r=await mutate();results.push({name,status:r.statusCode,error:r.json().error,pass:r.statusCode===403});
}
scenario={role:'admin',mfa:true,status:'active',intervention:true,failAudit:true};
const r=await mutate();await new Promise(r=>setImmediate(r));
results.push({name:'INTERVENTION_AUDIT_FAILURE',status:r.statusCode,...state,issueReproduced:r.statusCode===200&&state.businessWrites===1&&state.tenantAudit===1&&state.platformAudit===0,scope:'actual packaged handlers with deterministic database failure injection; not real PostgreSQL'});
writeFileSync(resolve(process.env.EVIDENCE_DIR||resolve(import.meta.dirname,'../evidence'),'independent-api.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));await app.close();await pool.end();

if(results.some(r=>r.pass===false||r.issueReproduced))process.exitCode=1;
