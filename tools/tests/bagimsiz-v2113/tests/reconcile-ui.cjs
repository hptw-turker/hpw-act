// Independent acceptance probes: actual delivered web, controlled HTTP and clock.
// Original command is deliberately NOT committed in competing-update cases.
const fs=require('fs'),path=require('path');
const {chromium}=require('../pw.cjs');
const H=require(path.join(process.env.HPW_SOURCE,'tools/tests/fe/harness.cjs'));
const OUT=process.env.OUT;fs.mkdirSync(OUT,{recursive:true});
const TA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',IA='11111111-1111-4111-8111-111111111111';
const T0='2026-09-28T10:00:00Z',OTHER_UNTIL='2026-10-05T20:59:00.000Z';
const W=(o={})=>({id:IA,tenant_id:TA,tenant_code:'AAA',tenant_name:'SIRKET_A',tenant_status:'active',rule:'invite_failed',occurrence:1,state:'open',owner_role:'consultant',claimed_by:null,claimed_by_name:null,snoozed_until:null,dismissed_until:null,state_reason:null,opened_at:T0,due_at:T0,resolved_at:null,evidence:{failed:2},eval_status:'ok',eval_error:null,last_ok_eval_at:T0,last_eval_at:T0,version:3,can:{claim:true,release:false,snooze:true,dismiss:true},...o});
const DATA=w=>({contract:'hpw-act-work-items/1',generatedAt:T0,items:[w],evaluations:[{tenant_id:TA,tenant_code:'AAA',rule:'invite_failed',status:'ok',detail:null,last_ok_at:T0,last_attempt_at:T0,active_item_state:w.state}],evaluationFailures:[],evaluationDeferred:[],evaluationTrigger:'list_open',freshnessMinutes:5});
const results=[];
(async()=>{const browser=await chromium.launch({headless:true}),setup=H.makeSetup(browser);
for(const mode of ['own-saved-control','other-close','other-edit','expired-unreadable']){
 let x;const id='V2113-RECONCILE-'+mode.toUpperCase();
 try{
  const posts=[],reads=[];let stage='initial',firstBody=null;
  x=await setup({platform:true,timezoneId:'Europe/Istanbul',handler:async({q,req,rt,send})=>{
   if(q==='/api/platform/work-items'){
    reads.push({url:req.url(),stage});
    if(stage==='unreadable'){await send({error:'unavailable',message:'Okuma geçici olarak kullanılamıyor'},503);return true}
    const final=posts.length>0&&mode!=='expired-unreadable';
    await send(DATA(W(final?{state:'dismissed',version:4,dismissed_until:mode==='own-saved-control'?firstBody.until:OTHER_UNTIL,state_reason:mode==='own-saved-control'?firstBody.reason:'Başka yöneticinin farklı gerekçesi',can:{claim:false,release:false,snooze:false,dismiss:false}}:{})));return true;
   }
   if(q.endsWith('/dismiss')){
    const p={key:req.headers()['idempotency-key'],body:JSON.parse(req.postData())};posts.push(p);firstBody??=p.body;
    await rt.abort('failed');return true;
   }
  }});
  await x.p.clock.setFixedTime(new Date(T0));await x.go('/platform?sekme=isler');
  await x.p.getByRole('button',{name:'reddet',exact:true}).click();
  const dlg=x.p.getByRole('dialog'),date=dlg.locator('input[type=date]');const selected=await date.getAttribute('min');
  await date.fill(selected);await dlg.locator('textarea').fill('Benim özgün gerekçem');
  await dlg.getByRole('button',{name:'Reddet',exact:true}).click();
  await dlg.getByRole('alert').filter({hasText:'Ağ yanıtı alınamadı'}).waitFor({timeout:15000});
  const firstCount=posts.length;let beforeRecovery=null,afterRecovery=null;
  if(mode==='expired-unreadable'){
   stage='unreadable';await x.p.clock.setFixedTime(new Date('2026-09-30T10:00:00Z'));
   await x.p.evaluate(()=>window.dispatchEvent(new Event('focus')));
   await dlg.getByRole('button',{name:'Reddet',exact:true}).click();
   await dlg.getByRole('alert').filter({hasText:'bitiş anı geçti'}).waitFor({timeout:10000});
   beforeRecovery=await dlg.innerText();
   await dlg.getByRole('button',{name:'Vazgeç',exact:true}).click();await dlg.waitFor({state:'detached'});
   await x.p.getByRole('button',{name:'reddet',exact:true}).click();await dlg.waitFor();
   afterRecovery={date:await date.inputValue(),reason:await dlg.locator('textarea').inputValue(),text:await dlg.innerText()};
   // Diagnostic only when recovery state was lost: show that a new command can
   // be submitted even though the original outcome still cannot be read.
   if(!afterRecovery.date&&!afterRecovery.reason){
    await date.fill(await date.getAttribute('min'));await dlg.locator('textarea').fill('Yeni işlem gerekçesi');
    await dlg.getByRole('button',{name:'Reddet',exact:true}).click();
    await dlg.getByRole('alert').filter({hasText:'Ağ yanıtı alınamadı'}).waitFor({timeout:15000});
   }
  }else if(mode==='other-edit'){
   await dlg.locator('textarea').fill('Yeni taslak gerekçem');
   const response=x.p.waitForResponse(r=>r.url().includes('/api/platform/work-items?tenantId='));
   await dlg.getByRole('button',{name:'Reddet',exact:true}).click();await response;
   await dlg.getByRole('button',{name:'Reddet',exact:true}).waitFor({state:'attached',timeout:700}).catch(()=>{});
  }else{
   await x.p.getByText(/reddedildi \(/).first().waitFor();
   await dlg.getByRole('button',{name:'Vazgeç',exact:true}).click();await dlg.waitFor({state:'detached'});
  }
  // Wait for UI reconciliation after the user action; no request scheduling sleeps.
  if(mode!=='expired-unreadable'){
   await x.p.getByText(/Önceki gönderiminiz kaydedilmişti/).waitFor({timeout:1200}).catch(()=>{});
  }
  const main=await x.p.locator('main').innerText(),isOpen=await dlg.count();
  const saysSaved=main.toLocaleLowerCase('tr').includes('önceki gönderiminiz kaydedilmişti');
  const pass=mode==='own-saved-control'?saysSaved:mode==='expired-unreadable'?
    !!afterRecovery&&afterRecovery.date===selected&&afterRecovery.reason==='Benim özgün gerekçem'&&/belirsiz|doğrulanamadı/.test(afterRecovery.text):!saysSaved;
  const observed={originalCommandCommitted:mode==='own-saved-control',firstBody,otherCommand:mode.startsWith('other')?{state:'dismissed',version:4,until:OTHER_UNTIL,reason:'Başka yöneticinin farklı gerekçesi'}:null,posts,firstCount,reads,saysSaved,isOpen,main,beforeRecovery,afterRecovery,intents:await x.p.evaluate(()=>sessionStorage.getItem('hpwact.intents.v2'))};
  results.push({id,status:pass?'PASS':'FAIL',expected:mode==='expired-unreadable'?'Failed reconciliation must preserve the unresolved original command and a recovery path':'A different command reaching the same state is not proof that this user command was committed',observed,errors:x.errors});
  await x.p.screenshot({path:path.join(OUT,id+'.png'),fullPage:true});console.log(id,pass?'PASS':'FAIL',JSON.stringify(observed));
 }catch(e){results.push({id,status:'ERROR',error:String(e),stack:e.stack});console.log(id,String(e));}
 finally{if(x)await x.context.close();}
}
await browser.close();fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));process.exitCode=results.every(x=>x.status==='PASS')?0:1;
})().catch(e=>{console.error(e);process.exitCode=2});
