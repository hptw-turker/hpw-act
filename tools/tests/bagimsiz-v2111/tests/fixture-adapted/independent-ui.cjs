const fs=require('fs'),path=require('path');
const {chromium}=require('./pw.cjs');
const S=process.env.HPW_SOURCE,H=require(path.join(S,'tools/tests/fe/harness.cjs'));
const OUT=process.env.OUT||path.join(__dirname,'evidence/independent-ui');fs.mkdirSync(OUT,{recursive:true});
const TA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',TB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',IA='11111111-1111-4111-8111-111111111111',IB='22222222-2222-4222-8222-222222222222';
const NOW=new Date().toISOString(),OLD=new Date(Date.now()-3600e3).toISOString();
const CAN={claim:true,release:false,snooze:true,dismiss:true};
const W=(o={})=>({id:IA,tenant_id:TA,tenant_code:'AAA',tenant_name:'SIRKET_A',tenant_status:'active',rule:'invite_failed',occurrence:1,state:'open',owner_role:'consultant',claimed_by:null,claimed_by_name:null,snoozed_until:null,dismissed_until:null,state_reason:null,opened_at:OLD,due_at:NOW,resolved_at:null,evidence:{failed:2,byProfile:{HR_ADMIN:2}},eval_status:'ok',eval_error:null,last_ok_eval_at:NOW,last_eval_at:NOW,version:3,can:CAN,...o});
const DATA=(items)=>({contract:'hpw-act-work-items/1',generatedAt:NOW,items,evaluations:[{tenant_id:TA,tenant_code:'AAA',rule:'invite_failed',status:'ok',detail:null,last_ok_at:NOW,last_attempt_at:NOW,active_item_state:'open'}],evaluationFailures:[],evaluationDeferred:[],evaluationTrigger:'list_open',freshnessMinutes:5});
const delay=ms=>new Promise(r=>setTimeout(r,ms));const results=[];
(async()=>{const browser=await chromium.launch({headless:true});const setup=H.makeSetup(browser);
async function record(id,x,expected,observed,pass){results.push({id,expected,observed,status:pass?'PASS':'FAIL',mode:'actual delivered web; Chromium; controlled HTTP',errors:x.errors});await x.p.screenshot({path:path.join(OUT,id+'.png'),fullPage:true});console.log(id,pass?'PASS':'FAIL',JSON.stringify(observed));await x.context.close()}
async function T(id,fn){if(process.env.TEST_FILTER&&!id.includes(process.env.TEST_FILTER))return;try{await fn()}catch(e){results.push({id,status:'ERROR',error:String(e),stack:e.stack});console.log(id,String(e))}}
await T('V211-A-FILTER-NO-PROBLEM',async()=>{
 const x=await setup({platform:true,handler:async({q,u,send})=>{if(q==='/api/platform/work-items'){await send(DATA(u.searchParams.get('state')==='claimed'?[]:[W()]));return true}}});
 await x.go('/platform?sekme=isler&is_sirket='+TA);await delay(400);
 const before=await x.p.locator('main').innerText();await x.p.locator('#is-durum').selectOption('claimed');await delay(400);
 const after=await x.p.locator('main').innerText();const noProblem=after.toLocaleLowerCase('tr').includes('davet başarısız: sorun yok');
 const existed=before.toLocaleLowerCase('tr').includes('2 davetin');if(!existed)throw Error('Fixture precondition: open failure not shown');
 await record('V211-A-FILTER-NO-PROBLEM',x,'An open failure excluded by the status filter must not be described as no problem',{openFailureBefore:existed,noProblemAfterStatusFilter:noProblem,excerpt:after.slice(after.indexOf('Kural değerlendirmeleri'))},!noProblem);
});
await T('V211-B-TENANT-SWITCH-STALE-ACTION',async()=>{
 let release;const gate=new Promise(r=>release=r);const posted=[];
 const x=await setup({platform:true,handler:async({q,u,req,send})=>{if(q==='/api/platform/work-items'){if(u.searchParams.get('tenantId')===TB){await gate;await send(DATA([W({id:IB,tenant_id:TB,tenant_code:'BBB'})]));}else await send(DATA([W(),W({id:IB,tenant_id:TB,tenant_code:'BBB'})]));return true}if(q.endsWith('/claim')){posted.push({path:q,body:JSON.parse(req.postData())});await send({workItem:{id:IA,state:'claimed',version:4}});return true}}});
 await x.go('/platform?sekme=isler');await delay(400);await x.p.locator('#is-sirket').selectOption(TB);await delay(120);
 const selected=await x.p.locator('#is-sirket').inputValue();const row=x.p.locator('tbody tr').filter({has:x.p.getByText('AAA',{exact:true})});const count=await row.count();
 await x.p.screenshot({path:path.join(OUT,'V211-B-before-write.png'),fullPage:true});
 if(count&&await row.getByRole('button',{name:'üstlen',exact:true}).count()){await row.getByRole('button',{name:'üstlen',exact:true}).click();await x.p.screenshot({path:path.join(OUT,'V211-B-dialog.png'),fullPage:true});await x.p.getByRole('dialog').getByRole('button',{name:'Üstlen',exact:true}).click();await delay(150)}
 const beforeRelease=await x.p.locator('main').innerText();release();await delay(400);
 await record('V211-B-TENANT-SWITCH-STALE-ACTION',x,'While B is selected and loading, stale A rows must not create actionable A commands',{selected,staleARow:count,posted,beforeRelease:beforeRelease.slice(0,1000)},posted.length===0);
});
await T('V211-C-CONFLICT-RETRY',async()=>{
 let version=3;const posts=[];
 const x=await setup({platform:true,handler:async({q,req,send})=>{if(q==='/api/platform/work-items'){await send(DATA([W({version})]));return true}if(q.endsWith('/snooze')){posts.push(JSON.parse(req.postData()));version=4;await send({error:'version_conflict',message:'version changed',details:{currentVersion:4}},409);return true}}});
 await x.go('/platform?sekme=isler');await delay(300);await x.p.getByRole('button',{name:'ertele',exact:true}).click();let dlg=x.p.getByRole('dialog');const date=dlg.locator('input[type=date]');await date.fill(await date.getAttribute('min'));await dlg.locator('textarea').fill('Toplantı sonrasında ele alınacak');await dlg.getByRole('button',{name:'Ertele',exact:true}).click();await delay(350);
 const open=await dlg.count();let enabled=false;if(open){enabled=await dlg.getByRole('button',{name:'Ertele',exact:true}).isEnabled();if(enabled)await dlg.getByRole('button',{name:'Ertele',exact:true}).click()}await delay(350);
 await record('V211-C-CONFLICT-RETRY',x,'After reloading version 4, retry must require renewed review or use current version; it must not repeat obsolete version 3',{modalOpen:open,enabled,posts,dialog:open?await dlg.innerText():null},!open||!enabled||(posts.length>1&&posts[1].expectedVersion===4));
});
await T('V211-D-FRESHNESS-AGE',async()=>{
 const x=await setup({platform:true,handler:async({q,send})=>{if(q==='/api/platform/work-items'){await send(DATA([W()]));return true}}});
 await x.p.clock.install({time:new Date(NOW)});await x.go('/platform?sekme=isler');await delay(300);const before=await x.p.locator('tbody').innerText();await x.p.clock.fastForward(6*60*1000);await delay(50);const after=await x.p.locator('tbody').innerText();const age=await x.p.evaluate(v=>Date.now()-Date.parse(v),NOW);
 await record('V211-D-FRESHNESS-AGE',x,'After six minutes without reevaluation, freshness label must say stale',{ageMs:age,before,after},after.toLocaleLowerCase('tr').includes('güncel değil'));
});
await T('V211-E-MAX-DISMISS-DATE',async()=>{
 const fixed=new Date('2026-09-28T10:00:00Z');const posts=[];
 const x=await setup({platform:true,handler:async({q,req,send})=>{if(q==='/api/platform/work-items'){await send(DATA([W()]));return true}if(q.endsWith('/dismiss')){const body=JSON.parse(req.postData());const days=(Date.parse(body.until)-fixed.getTime())/86400000;posts.push({body,days});await send(days>30?{error:'invalid_until',message:'Reddetme süresi en çok 30 gün olabilir'}:{workItem:{id:IA,state:'dismissed',version:4}},days>30?422:200);return true}}});
 await x.p.clock.setFixedTime(fixed);await x.go('/platform?sekme=isler');await delay(300);await x.p.getByRole('button',{name:'reddet',exact:true}).click();const dlg=x.p.getByRole('dialog'),date=dlg.locator('input[type=date]'),max=await date.getAttribute('max');await date.fill(max);await dlg.locator('textarea').fill('Bu dönem takip edilmeyecek');await dlg.getByRole('button',{name:'Reddet',exact:true}).click();await delay(300);
 await record('V211-E-MAX-DISMISS-DATE',x,'The last date offered by the form must comply with server maximum 30 days',{fixedNow:fixed.toISOString(),offeredMaximum:max,posts,modalOpen:await dlg.count(),error:await dlg.getByRole('alert').allInnerTexts()},posts.length===1&&posts[0].days<=30);
});
await browser.close();fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));console.log('TOTAL',results.length,'FAIL',results.filter(r=>r.status!=='PASS').length);process.exitCode=results.every(r=>r.status==='PASS')?0:1;
})().catch(e=>{console.error(e);process.exitCode=2});
