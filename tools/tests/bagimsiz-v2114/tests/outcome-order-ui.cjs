// Actual delivered web; controlled HTTP with explicit ordering, no race sleeps.
// A valid not_found snapshot may precede the original command's commit.
const fs=require('fs'),path=require('path');
const {chromium}=require('../pw.cjs');const H=require(path.join(process.env.HPW_SOURCE,'tools/tests/fe/harness.cjs'));
const OUT=process.env.OUT;fs.mkdirSync(OUT,{recursive:true});
const TA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',IA='11111111-1111-4111-8111-111111111111',T0='2026-09-28T10:00:00Z';
const W=o=>({id:IA,tenant_id:TA,tenant_code:'AAA',tenant_name:'SIRKET_A',tenant_status:'active',rule:'invite_failed',occurrence:1,state:'open',owner_role:'consultant',claimed_by:null,claimed_by_name:null,snoozed_until:null,dismissed_until:null,state_reason:null,opened_at:T0,due_at:T0,resolved_at:null,evidence:{failed:2},eval_status:'ok',eval_error:null,last_ok_eval_at:T0,last_eval_at:T0,version:3,can:{claim:true,release:false,snooze:true,dismiss:true},...o});
const DATA=w=>({contract:'hpw-act-work-items/1',generatedAt:T0,items:[w],evaluations:[{tenant_id:TA,tenant_code:'AAA',rule:'invite_failed',status:'ok',detail:null,last_ok_at:T0,last_attempt_at:T0,active_item_state:w.state}],evaluationFailures:[],evaluationDeferred:[],evaluationTrigger:'list_open',freshnessMinutes:5});
const results=[];
(async()=>{const browser=await chromium.launch({headless:true}),setup=H.makeSetup(browser);
for(const mode of ['saved-control','absent-control','commit-between-reads']){let x;const id='V2114-ORDER-'+mode.toUpperCase();
 try{
  let committed=false,phase='first-send',nOutcome=0;const posts=[],timeline=[];
  const outcome=key=>({contract:'hpw-act-command-outcome/1',key,status:committed?'applied':'not_found',route:committed?`POST /work-items/${IA}/dismiss`:null,tenantId:committed?TA:null,responseStatus:committed?200:null,response:committed?{workItem:{id:IA,state:'dismissed',version:4}}:null,recordedAt:committed?T0:null});
  x=await setup({platform:true,timezoneId:'Europe/Istanbul',handler:async({q,req,rt,send})=>{
   if(q.startsWith('/api/platform/commands/')&&q.endsWith('/outcome')){
    nOutcome++;const key=decodeURIComponent(q.split('/')[4]);const response=outcome(key);timeline.push({event:'outcome-snapshot',number:nOutcome,phase,status:response.status,key});
    // Snapshot is taken before the original transaction commits. The following
    // list read sees both the work-item mutation and its committed receipt.
    if(mode==='commit-between-reads'&&phase==='reconcile'&&nOutcome===1){committed=true;timeline.push({event:'original-command-commit',key:posts[0].key,body:posts[0].body,workItemVersion:4});}
    await send(response);return true;
   }
   if(q==='/api/platform/work-items'){
    timeline.push({event:'list-read',phase,committed,version:committed?4:3});
    await send(DATA(W(committed?{state:'dismissed',version:4,dismissed_until:posts[0].body.until,state_reason:posts[0].body.reason,can:{claim:false,release:false,snooze:false,dismiss:false}}:{})));return true;
   }
   if(q.endsWith('/dismiss')){
    const p={key:req.headers()['idempotency-key'],body:JSON.parse(req.postData())};posts.push(p);timeline.push({event:'write-response-lost',key:p.key});
    if(mode==='saved-control')committed=true;
    await rt.abort('failed');return true;
   }
  }});
  await x.p.clock.setFixedTime(new Date(T0));await x.go('/platform?sekme=isler');
  await x.p.getByRole('button',{name:'reddet',exact:true}).click();const dlg=x.p.getByRole('dialog');
  const date=dlg.locator('input[type=date]');await date.fill(await date.getAttribute('min'));await dlg.locator('textarea').fill('Özgün kararın gerekçesi');
  await dlg.getByRole('button',{name:'Reddet',exact:true}).click();await dlg.getByRole('alert').filter({hasText:'Ağ yanıtı alınamadı'}).waitFor({timeout:15000});
  const firstCount=posts.length;phase='reconcile';await dlg.locator('textarea').fill('İkinci taslak gerekçesi');await dlg.getByRole('button',{name:'Reddet',exact:true}).click();
  await x.p.waitForFunction(()=>{const d=document.querySelector('[role=dialog]');return !d||d.querySelector('button[data-confirm]')?.getAttribute('aria-busy')==='false';},{},{timeout:10000});
  const text=await x.p.locator('body').innerText(),lower=text.toLocaleLowerCase('tr');
  const claimedNotApplied=lower.includes('önceki gönderiminiz uygulanmadı'),claimedApplied=lower.includes('önceki gönderiminiz kaydedilmişti');
  const noNewDraftSent=posts.length===firstCount&&posts.every(p=>p.key===posts[0].key&&JSON.stringify(p.body)===JSON.stringify(posts[0].body));
  const pass=noNewDraftSent&&(mode==='saved-control'?claimedApplied:mode==='absent-control'?!claimedApplied&&!committed&&!claimedNotApplied:committed&&!claimedNotApplied&&claimedApplied);
  const beforeProbeOutcomes=nOutcome;phase='observer-proof';const actualOutcome=await x.p.evaluate(async key=>(await fetch('/api/platform/commands/'+encodeURIComponent(key)+'/outcome')).json(),posts[0].key);
  const observed={mode,committed,firstCount,posts,noNewDraftSent,beforeProbeOutcomes,claimedNotApplied,claimedApplied,actualOutcome,text,intents:await x.p.evaluate(()=>sessionStorage.getItem('hpwact.intents.v2')),timeline};
  results.push({id,status:pass?'PASS':'FAIL',expected:'Resolve the original applied command truthfully without sending the edited draft; a prior not_found snapshot is not proof of non-application',observed,errors:x.errors});
  await x.p.screenshot({path:path.join(OUT,id+'.png'),fullPage:true});console.log(id,pass?'PASS':'FAIL',JSON.stringify(observed));
 }catch(e){results.push({id,status:'ERROR',error:String(e),stack:e.stack});console.log(id,String(e));}finally{if(x)await x.context.close();}
}
await browser.close();fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));process.exitCode=results.every(x=>x.status==='PASS')?0:1;
})().catch(e=>{console.error(e);process.exitCode=2});
