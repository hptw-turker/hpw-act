// Independent probe: actual delivered web, controlled HTTP/clock.
// Only the first command commits. Later commands keep version 3 and cannot commit.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../pw.cjs');
const H=require(path.join(process.env.HPW_SOURCE,'tools/tests/fe/harness.cjs'));
const OUT=process.env.OUT;fs.mkdirSync(OUT,{recursive:true});
const TA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',IA='11111111-1111-4111-8111-111111111111',T0='2026-09-29T09:00:00Z';
const W=o=>({id:IA,tenant_id:TA,tenant_code:'AAA',tenant_name:'SIRKET_A',tenant_status:'active',rule:'invite_failed',occurrence:1,state:'open',owner_role:'consultant',claimed_by:null,claimed_by_name:null,snoozed_until:null,dismissed_until:null,state_reason:null,opened_at:T0,due_at:T0,resolved_at:null,evidence:{failed:1},eval_status:'ok',eval_error:null,last_ok_eval_at:T0,last_eval_at:T0,version:3,can:{claim:true,release:false,snooze:true,dismiss:true},...o});
const DATA=w=>({contract:'hpw-act-work-items/1',generatedAt:T0,items:[w],evaluations:[{tenant_id:TA,tenant_code:'AAA',rule:'invite_failed',status:'ok',detail:null,last_ok_at:T0,last_attempt_at:T0,active_item_state:w.state}],evaluationFailures:[],evaluationDeferred:[],evaluationTrigger:'list_open',evaluated:true,freshnessMinutes:5});
const results=[];
(async()=>{const browser=await chromium.launch({headless:true}),setup=H.makeSetup(browser);
for(const [count,op] of [[2,'dismiss'],[3,'dismiss'],[3,'snooze']]){
 const id=`V2115-MULTI-${count}-${op.toUpperCase()}`;let x;
 try{
  const keys=[],posts=[],timeline=[];let committed=false,phase='sending';
  const label=op==='dismiss'?'Reddet':'Ertele',state=op==='dismiss'?'dismissed':'snoozed';
  const outcome=key=>{const applied=committed&&key===keys[0];return {contract:'hpw-act-command-outcome/1',key,status:applied?'applied':'not_found',route:applied?`POST /work-items/${IA}/${op}`:null,tenantId:applied?TA:null,responseStatus:applied?200:null,response:applied?{workItem:{id:IA,state,version:4}}:null,recordedAt:applied?T0:null};};
  x=await setup({platform:true,timezoneId:'Europe/Istanbul',handler:async({q,req,rt,send})=>{
   if(q.startsWith('/api/platform/commands/')&&q.endsWith('/outcome')){const key=decodeURIComponent(q.split('/')[4]);const body=outcome(key);timeline.push({event:'outcome',key,index:keys.indexOf(key)+1,phase,committed,status:body.status});await send(body);return true;}
   if(q==='/api/platform/work-items'){timeline.push({event:'list',committed,phase,version:committed?4:3});const first=posts[0]?.body;
    await send(DATA(W(committed?{state,version:4,state_reason:first.reason,[op==='dismiss'?'dismissed_until':'snoozed_until']:first.until,can:{claim:false,release:false,snooze:false,dismiss:false}}:{})));return true;}
   if(q.endsWith('/'+op)){
    const key=req.headers()['idempotency-key'],body=JSON.parse(req.postData());if(!keys.includes(key))keys.push(key);const index=keys.indexOf(key)+1;posts.push({key,index,body});
    if(index<count){timeline.push({event:'write-response-lost',key,index});await rt.abort('failed');return true;}
    committed=true;timeline.push({event:'first-command-commit',key:keys[0],body:posts[0].body,version:4});
    timeline.push({event:'later-command-conflict',key,index});await send({error:'version_conflict',message:'İş siz görüntüledikten sonra değişti',details:{currentVersion:4}},409);return true;
   }
  }});
  await x.p.clock.setFixedTime(new Date(T0));await x.go('/platform?sekme=isler');
  await x.p.getByRole('button',{name:label.toLocaleLowerCase('tr'),exact:true}).click();let dlg=x.p.getByRole('dialog');
  const date=dlg.locator('input[type=date]');await date.fill(await date.getAttribute('min'));
  const infoChecks=[];
  for(let index=1;index<=count;index++){
   await dlg.locator('textarea').fill(`Komut ${index} için ayrı gerekçe`);
   const before=posts.length;
   await dlg.getByRole('button',{name:label,exact:true}).click();
   if(index>1){await dlg.getByRole('alert').filter({hasText:'takibi sürüyor'}).waitFor({timeout:10000});infoChecks.push({index,noPostBeforeSecondConfirmation:posts.length===before});await dlg.getByRole('button',{name:label,exact:true}).click();}
   if(index<count){await dlg.getByRole('alert').filter({hasText:'yanıtı alınamadı'}).waitFor({timeout:15000});}
   else {await dlg.getByText(/artık yapılamaz/).waitFor({timeout:10000});}
  }
  phase='reconcile';await dlg.getByRole('button',{name:'Vazgeç',exact:true}).click();await dlg.waitFor({state:'detached'});
  // A filter change causes an actual fresh list read without reloading the page/module.
  await x.p.locator('select').first().selectOption(TA);
  await x.p.getByText(/reddedildi|ertelendi/i).first().waitFor({timeout:10000});
  // Wait for product reconciliation to settle in its normal visible state, then read evidence.
  await x.p.getByText(/önceki gönderiminiz/i).first().waitFor({timeout:10000});
  await x.p.waitForFunction(()=>{const s=sessionStorage.getItem('hpwact.intents.v2');return !!s&&Object.values(JSON.parse(s)).every(v=>v.state!=='sending');},{},{timeout:10000});
  const intents=await x.p.evaluate(()=>sessionStorage.getItem('hpwact.intents.v2'))||'{}';
  const firstPostCommitQueries=timeline.filter(e=>e.event==='outcome'&&e.key===keys[0]&&e.committed&&e.phase!=='observer-proof').length;
  const bodiesStable=keys.every((key,i)=>posts.filter(p=>p.key===key).every(p=>p.body.expectedVersion===3&&p.body.reason===`Komut ${i+1} için ayrı gerekçe`&&JSON.stringify(p.body)===JSON.stringify(posts.find(q=>q.key===key).body)));
  const text=await x.p.locator('main').innerText();
  phase='observer-proof';const actualFirst=await x.p.evaluate(async key=>(await fetch('/api/platform/commands/'+encodeURIComponent(key)+'/outcome')).json(),keys[0]);
  const pass=keys.length===count&&bodiesStable&&infoChecks.every(v=>v.noPostBeforeSecondConfirmation)&&actualFirst.status==='applied'&&firstPostCommitQueries>0&&!intents.includes(keys[0]);
  const observed={count,op,keys,posts,infoChecks,bodiesStable,firstPostCommitQueries,firstIntentStillPresent:intents.includes(keys[0]),actualFirst,intents,text,timeline};
  results.push({id,status:pass?'PASS':'FAIL',expected:'Every unresolved command remains independently tracked until its own authoritative outcome is known',observed,errors:x.errors});
  await x.p.screenshot({path:path.join(OUT,id+'.png'),fullPage:true});console.log(id,pass?'PASS':'FAIL',JSON.stringify(observed));
 }catch(e){results.push({id,status:'ERROR',error:String(e),stack:e.stack});console.log(id,String(e));}finally{if(x)await x.context.close();}
}
await browser.close();fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));process.exitCode=results.every(x=>x.status==='PASS')?0:1;
})().catch(e=>{console.error(e);process.exitCode=2});
