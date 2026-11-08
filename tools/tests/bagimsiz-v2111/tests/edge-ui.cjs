// Actual delivered web, controlled HTTP. No product source changes.
const fs=require('fs'),path=require('path');
const {chromium}=require('../pw.cjs'),H=require(path.join(process.env.HPW_SOURCE,'tools/tests/fe/harness.cjs'));
const OUT=process.env.OUT;fs.mkdirSync(OUT,{recursive:true});
const TA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',IA='11111111-1111-4111-8111-111111111111';
const T0=new Date(process.env.TEST_NOW||'2026-09-28T10:00:00Z'),NOW=T0.toISOString();
const W=(o={})=>({id:IA,tenant_id:TA,tenant_code:'AAA',tenant_name:'SIRKET_A',tenant_status:'active',rule:'invite_failed',occurrence:1,state:'open',owner_role:'consultant',claimed_by:null,claimed_by_name:null,snoozed_until:null,dismissed_until:null,state_reason:null,opened_at:NOW,due_at:NOW,resolved_at:null,evidence:{failed:2},eval_status:'ok',eval_error:null,last_ok_eval_at:NOW,last_eval_at:NOW,version:3,can:{claim:true,release:false,snooze:true,dismiss:true},...o});
const DATA=(items,ev={active_item_state:'open'})=>({contract:'hpw-act-work-items/1',generatedAt:NOW,items,evaluations:[{tenant_id:TA,tenant_code:'AAA',rule:'invite_failed',status:'ok',detail:null,last_ok_at:NOW,last_attempt_at:NOW,...ev}],evaluationFailures:[],evaluationDeferred:[],evaluationTrigger:'list_open',freshnessMinutes:5});
const delay=ms=>new Promise(r=>setTimeout(r,ms));const results=[];
(async()=>{const browser=await chromium.launch({headless:true});const setup=H.makeSetup(browser);
async function record(id,x,expected,observed,pass){results.push({id,expected,observed,status:pass?'PASS':'FAIL',errors:x.errors});await x.p.screenshot({path:path.join(OUT,id+'.png'),fullPage:true});console.log(id,pass?'PASS':'FAIL',JSON.stringify(observed));await x.context.close()}
async function T(id,fn){if(process.env.TEST_FILTER&&!id.includes(process.env.TEST_FILTER))return;try{await fn(id)}catch(e){results.push({id,status:'ERROR',error:String(e),stack:e.stack});console.log(id,String(e))}}
for(const [tag,ev,isValid] of [['MISSING',{},false],['FALSE',{active_item_state:false},false],['EMPTY',{active_item_state:''},false],['NULL-CONTROL',{active_item_state:null},true],['OPEN-CONTROL',{active_item_state:'open'},true]])await T('V2111-DTO-'+tag,async id=>{
 const x=await setup({platform:true,handler:async({q,send})=>{if(q==='/api/platform/work-items'){await send(DATA([],ev));return true}}});
 await x.p.clock.setFixedTime(T0);await x.go('/platform?sekme=isler&is_sirket='+TA+'&is_durum=claimed');await delay(350);
 const text=await x.p.locator('main').innerText(),healthy=text.toLocaleLowerCase('tr').includes('davet başarısız: sorun yok');
 const pass=isValid?(tag==='NULL-CONTROL'?healthy:text.toLocaleLowerCase('tr').includes('sorun var')):!healthy;
 await record(id,x,isValid?'Valid null means healthy; valid open means problem':'Missing or invalid rule state must not become no problem',{ev,healthy,text},pass);
});
for(const [tag,max] of [['MAXIMUM',true],['NORMAL-CONTROL',false]])await T('V2111-RETRY-'+tag,async id=>{
 const posts=[];let committed=null;let stage=0;
 const x=await setup({platform:true,timezoneId:'Europe/Istanbul',handler:async({q,req,send,rt})=>{
  if(q==='/api/platform/work-items'){await send(DATA([W(committed?{state:'dismissed',version:4,dismissed_until:committed.body.until,can:{claim:false,release:false,snooze:false,dismiss:false}}:{})],{active_item_state:committed?'dismissed':'open'}));return true}
  if(q.endsWith('/dismiss')){const p={key:req.headers()['idempotency-key'],body:JSON.parse(req.postData())};posts.push(p);if(!committed&&Date.parse(p.body.until)-T0.getTime()>30*86400000){await send({error:'invalid_until',message:'30 günlük sınır aşıldı'},422);return true}if(!committed)committed=p;
   if(stage===0){await rt.abort('failed');return true}
   if(p.key===committed.key&&JSON.stringify(p.body)===JSON.stringify(committed.body)){await send({workItem:{id:IA,state:'dismissed',version:4}});return true}
   await send({error:'version_conflict',message:'İş siz görüntüledikten sonra değişti',details:{currentVersion:4}},409);return true
  }
 }});
 await x.p.clock.setFixedTime(T0);await x.go('/platform?sekme=isler');await x.p.getByRole('button',{name:'reddet',exact:true}).click();
 let dlg=x.p.getByRole('dialog'),date=dlg.locator('input[type=date]');const selected=await date.getAttribute(max?'max':'min');await date.fill(selected);await dlg.locator('textarea').fill('Aynı gerekçe, aynı tarih, aynı işlem');await dlg.getByRole('button',{name:'Reddet',exact:true}).click();
 await dlg.getByRole('alert').filter({hasText:'Ağ yanıtı alınamadı'}).waitFor({timeout:15000});
 const before=await dlg.innerText(),first=posts.length;stage=1;await x.p.clock.setFixedTime(new Date(T0.getTime()+10000));
 await dlg.getByRole('button',{name:'Reddet',exact:true}).click();
 await x.p.waitForFunction(()=>!document.querySelector('[role=dialog]')||(!document.querySelector('[data-confirm][aria-busy="true"]')&&Array.from(document.querySelectorAll('[role=alert]')).some(e=>e.textContent.includes('İş siz görüntüledikten sonra değişti'))),null,{timeout:10000});
 const later=posts.slice(first),stored=await x.p.evaluate(()=>sessionStorage.getItem('hpwact.intents.v2'));
 await record(id,x,'Same unchanged form retry must reuse the original request body and key; recorded success must replay',{selected,firstAttemptCount:first,posts,dialogBeforeRetry:before,dialogAfterRetry:await dlg.count()?await dlg.innerText():null,remainingIntents:stored},later.length===1&&later[0].key===posts[0].key&&JSON.stringify(later[0].body)===JSON.stringify(posts[0].body)&&await dlg.count()===0);
});
await browser.close();fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));process.exitCode=results.every(x=>x.status==='PASS')?0:1;
})().catch(e=>{console.error(e);process.exitCode=2});
