// Acceptance probes for the unresolved command lifecycle. Real delivered web; controlled HTTP/time.
const fs=require('fs'),path=require('path');
const {chromium}=require('../pw.cjs'),H=require(path.join(process.env.HPW_SOURCE,'tools/tests/fe/harness.cjs'));
const OUT=process.env.OUT;fs.mkdirSync(OUT,{recursive:true});
const TA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',IA='11111111-1111-4111-8111-111111111111';
const NOW='2026-09-28T20:59:00Z';
const W=(o={})=>({id:IA,tenant_id:TA,tenant_code:'AAA',tenant_name:'SIRKET_A',tenant_status:'active',rule:'invite_failed',occurrence:1,state:'open',owner_role:'consultant',claimed_by:null,claimed_by_name:null,snoozed_until:null,dismissed_until:null,state_reason:null,opened_at:NOW,due_at:NOW,resolved_at:null,evidence:{failed:2},eval_status:'ok',eval_error:null,last_ok_eval_at:NOW,last_eval_at:NOW,version:3,can:{claim:true,release:false,snooze:true,dismiss:true},...o});
const DATA=items=>({contract:'hpw-act-work-items/1',generatedAt:NOW,items,evaluations:[{tenant_id:TA,tenant_code:'AAA',rule:'invite_failed',status:'ok',detail:null,last_ok_at:NOW,last_attempt_at:NOW,active_item_state:items[0]?.state??null}],evaluationFailures:[],evaluationDeferred:[],evaluationTrigger:'list_open',freshnessMinutes:5});
const delay=ms=>new Promise(r=>setTimeout(r,ms));const results=[];
(async()=>{const browser=await chromium.launch({headless:true});const setup=H.makeSetup(browser);
for(const mode of ['same-day-control','midnight','reopen']){
 if(process.env.TEST_FILTER&&!mode.includes(process.env.TEST_FILTER))continue;
 const id='V2112-PENDING-'+mode.toUpperCase();let x;
 try{
  const t0=new Date(mode==='reopen'?'2026-09-28T10:00:00Z':NOW);let stage=0,committed=null;const posts=[];
  x=await setup({platform:true,timezoneId:'Europe/Istanbul',handler:async({q,req,rt,send})=>{
   if(q==='/api/platform/work-items'){await send(DATA([W(committed?{state:'dismissed',version:4,dismissed_until:committed.body.until,can:{claim:false,release:false,snooze:false,dismiss:false}}:{})]));return true}
   if(q.endsWith('/dismiss')){const p={key:req.headers()['idempotency-key'],body:JSON.parse(req.postData())};posts.push(p);
    if(stage===0){if(mode!=='reopen'&&!committed)committed=p;await rt.abort('failed');return true}
    if(!committed||p.key===committed.key){committed??=p;await send({workItem:{id:IA,state:'dismissed',version:4}});return true}
    await send({error:'version_conflict',message:'İş değişti',details:{currentVersion:4}},409);return true
   }
  }});
  await x.p.clock.setFixedTime(t0);await x.go('/platform?sekme=isler');await x.p.getByRole('button',{name:'reddet',exact:true}).click();
  let dlg=x.p.getByRole('dialog'),date=dlg.locator('input[type=date]');const selected=await date.getAttribute(mode==='reopen'?'max':'min');const reason='Özgün işlem için değişmeyen gerekçe';
  await date.fill(selected);await dlg.locator('textarea').fill(reason);await dlg.getByRole('button',{name:'Reddet',exact:true}).click();await dlg.getByRole('alert').filter({hasText:'Ağ yanıtı alınamadı'}).waitFor({timeout:15000});
  const before=await dlg.innerText(),first=posts.length;stage=1;const later=new Date(t0.getTime()+(mode==='midnight'?120000:10000));
  if(mode==='reopen')await dlg.getByRole('button',{name:'Vazgeç',exact:true}).click();
  await x.p.clock.setFixedTime(later);await x.p.evaluate(()=>window.dispatchEvent(new Event('focus')));await delay(100);
  if(mode==='reopen'){await x.p.getByRole('button',{name:'reddet',exact:true}).click();dlg=x.p.getByRole('dialog');date=dlg.locator('input[type=date]');await date.fill(selected);await dlg.locator('textarea').fill(reason)}
  const currentMin=await date.getAttribute('min');await dlg.getByRole('button',{name:'Reddet',exact:true}).click();await delay(600);
  const afterOriginal=await dlg.count()?await dlg.innerText():null;let afterNewDate=null;
  if(mode==='midnight'&&await dlg.count()){
   await date.fill(currentMin);await dlg.getByRole('button',{name:'Reddet',exact:true}).click();await delay(300);afterNewDate=await dlg.innerText();
  }
  const open=await dlg.count(),intents=await x.p.evaluate(()=>sessionStorage.getItem('hpwact.intents.v2'));
  const remainingSeconds=(Date.parse(posts[0].body.until)-later.getTime())/1000;
  const pass=posts.length===first+1&&posts[first].key===posts[0].key&&JSON.stringify(posts[first].body)===JSON.stringify(posts[0].body)&&!open;
  const observed={mode,firstCommandSaved:mode!=='reopen',t0:t0.toISOString(),retryTime:later.toISOString(),selected,currentMin,originalUntilStillFuture:remainingSeconds>0,remainingSeconds,posts,before,afterOriginal,afterNewDate,open,intents};
  results.push({id,status:pass?'PASS':'FAIL',expected:'An unresolved original command remains recoverable with unchanged body/key, including date rollover or closing/reopening the modal',observed,errors:x.errors});
  await x.p.screenshot({path:path.join(OUT,id+'.png'),fullPage:true});console.log(id,pass?'PASS':'FAIL',JSON.stringify(observed));
 }catch(e){results.push({id,status:'ERROR',error:String(e),stack:e.stack});console.log(id,String(e))}finally{if(x)await x.context.close()}
}
await browser.close();fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));process.exitCode=results.every(x=>x.status==='PASS')?0:1;
})().catch(e=>{console.error(e);process.exitCode=2});
