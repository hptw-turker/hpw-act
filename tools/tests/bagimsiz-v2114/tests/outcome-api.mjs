// New route checks using the prior controlled DB model; not PostgreSQL.
// Adapted CAS probe: actual packaged Fastify/evaluator; FOR UPDATE is intentionally not modeled.
// A stale write is forced to exercise the extra version predicate. Not a PostgreSQL lock test.
// Actual packaged Fastify + evaluateTenant. Deterministic transactional DB model;
// NOT a PostgreSQL/RLS/lock implementation test. Schedule is explicit, no sleeps.
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
process.env.HPW_ENV='test';process.env.NODE_ENV='test';
const R=process.env.HPW_API_RUNTIME,OUT=process.env.OUT||resolve(import.meta.dirname,'evidence/independent-api');mkdirSync(OUT,{recursive:true});
const {pool}=await import(pathToFileURL(R+'/db.js'));const {evaluateTenant}=await import(pathToFileURL(R+'/workitems.js'));
const tid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',uid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',id='11111111-1111-4111-8111-111111111111';
let currentActor=uid, accessible=true;
let item,commands=new Map(),audits=[],queries=[],counter=0;let gate=null,readSignal=null;
const clone=o=>JSON.parse(JSON.stringify(o));const rows=(a=[])=>({rows:clone(a),rowCount:a.length});
const initial=()=>({id,tenant_id:tid,rule:'invite_failed',state:'open',owner_role:'consultant',claimed_by:null,claimed_at:null,snoozed_until:null,dismissed_until:null,state_reason:null,version:3,evidence:{failed:1}});
function client(label){let staged=null,pendingAudits=[],pendingCommands=[];return {release(){},async query(q,args=[]){const sql=String(q);queries.push({label,sql,args:clone(args)});
 if(sql==='BEGIN'||sql.startsWith('SELECT set_config')||sql.startsWith('SET LOCAL')||sql.startsWith('SAVEPOINT')||sql.startsWith('RELEASE SAVEPOINT')||sql.startsWith('SELECT pg_advisory_xact_lock'))return rows();
 if(sql==='COMMIT'){if(staged)item=staged;audits.push(...pendingAudits);for(const [k,v] of pendingCommands)commands.set(k,v);staged=null;pendingAudits=[];pendingCommands=[];return rows()}
 if(sql==='ROLLBACK'){staged=null;pendingAudits=[];pendingCommands=[];return rows()}
 if(sql.startsWith('ROLLBACK TO'))throw Error('Unexpected source-query failure');
 if(sql.includes('auth_session_lookup'))return rows([{user_id:currentActor,email:'audit@example.test',display_name:'Audit Admin',realm:'platform',tenant_id:tid}]);
 if(sql.includes('platform_session_state'))return rows([{role:'admin',mfa_enabled:true,mfa_at:new Date().toISOString()}]);
 if(sql.includes('platform_tenant_ctx'))return rows([{has_access:accessible&&args[1]===tid,role:'admin',tenant_status:'active'}]);
 if(sql.includes('tenant_status_lock'))return rows([{s:'active'}]);
 if(sql==='SELECT status FROM tenant WHERE id = $1')return rows([{status:'active'}]);
 if(sql==='SELECT created_at, tracked_cycle_id FROM tenant WHERE id = $1')return rows([{created_at:'2026-01-01',tracked_cycle_id:null}]);
 if(sql.includes('FROM tenant_failed_invitations')){if(label==='evaluator'&&gate){readSignal();await gate;}return rows([{p:'HR_ADMIN',n:1}]);}
 if(sql.includes('platform_access_active'))return rows([{a:true,role:'admin'}]);
 if(sql.startsWith('SELECT')&&sql.includes('FROM platform_work_item'))return rows([staged??item]);
 if(sql.startsWith('SELECT')&&sql.includes('FROM platform_command')){const x=commands.get(args[1]);return rows(x&&x.user_id===args[0]?[x]:[])}
 if(sql.startsWith('INSERT INTO platform_work_eval'))return rows();
 if(sql.startsWith('INSERT INTO platform_audit_event')){pendingAudits.push(clone(args));return rows()}
 if(sql.startsWith('INSERT INTO platform_command')){pendingCommands.push([args[1],{user_id:args[0],route:args[2],payload_hash:args[3],tenant_id:args[4],created_at:'2026-09-28T10:00:00Z',response_status:200,response_body:JSON.parse(args[5])}]);return rows()}
 if(sql.startsWith('UPDATE platform_work_item SET')){
  const current=clone(staged??item);
  if(sql.includes('WHERE id = $1 AND version = $8')&&current.version!==args[7])return rows();
  if(sql.includes("state = 'claimed'")){staged={...current,state:'claimed',claimed_by:args[1],version:current.version+1};}
  else if(sql.includes("state = 'open'")){staged={...current,state:'open',claimed_by:null,version:current.version+1};}
  else if(sql.includes("state = 'dismissed'")){staged={...current,state:'dismissed',dismissed_until:args[1],state_reason:args[2],version:current.version+1};}
  else if(sql.includes('state = $2')){staged={...current,state:args[1],claimed_by:args[2],evidence:args[3]?JSON.parse(args[3]):current.evidence,eval_status:args[4],version:current.version+args[6]};}
  else throw Error('UNMODELED UPDATE '+sql);
  return rows([staged]);
 }
 throw Error('UNMODELED QUERY '+sql);
}}}
pool.connect=async()=>client('http-'+(++counter));const {buildApp}=await import(pathToFileURL(R+'/server.js'));const app=await buildApp();
const post=(op,body,key)=>app.inject({method:'POST',url:`/api/platform/work-items/${id}/${op}`,headers:{cookie:'hpw_session_test=synthetic-audit-session',...(key?{'idempotency-key':key}:{})},payload:body});

const results=[];item=initial();const key='independent-outcome-own';
const sent=await post('claim',{expectedVersion:3},key);if(sent.statusCode!==200)throw Error('Write control failed '+sent.body);
const get=key=>app.inject({method:'GET',url:'/api/platform/commands/'+encodeURIComponent(key)+'/outcome',headers:{cookie:'hpw_session_test=synthetic-audit-session'}});
const check=async(id,key,predicate)=>{const r=await get(key);const body=r.json();const pass=predicate(r.statusCode,body);results.push({id,pass,observed:{status:r.statusCode,body,actor:currentActor,accessible}})};
await check('OWN-COMMAND',key,(s,b)=>s===200&&b.status==='applied'&&b.key===key&&b.tenantId===tid&&b.route==='POST /work-items/'+id+'/claim'&&b.response.workItem.claimed_by===uid);
await check('UNKNOWN-COMMAND','unknown-key',(s,b)=>s===200&&b.status==='not_found'&&b.route===null&&b.response===null);
currentActor='cccccccc-cccc-4ccc-8ccc-cccccccccccc';await check('OTHER-ACTOR',key,(s,b)=>s===200&&b.status==='not_found'&&b.route===null&&b.response===null);
currentActor=uid;accessible=false;await check('ACCESS-REMOVED',key,(s,b)=>s===404&&b.error==='command_not_visible'&&!b.response);
accessible=true;const row=commands.get(key);commands.set('different-tenant',{...row,tenant_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'});await check('OTHER-TENANT','different-tenant',(s,b)=>s===404&&b.error==='command_not_visible'&&!b.response);
await check('ACCESS-RESTORED',key,(s,b)=>s===200&&b.status==='applied');
writeFileSync(resolve(OUT,'results.json'),JSON.stringify({mode:'Actual packaged Fastify; controlled DB. NOT PostgreSQL.',results,queries},null,2));console.log(JSON.stringify(results,null,2));await app.close();await pool.end();process.exitCode=results.every(x=>x.pass)?0:1;
