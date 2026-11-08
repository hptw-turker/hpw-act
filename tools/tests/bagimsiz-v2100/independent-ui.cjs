// Independent acceptance probes. Product files are not modified.
// Real delivered web bundle, real Chromium, controlled HTTP (not PostgreSQL).
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const S=process.env.HPW_SOURCE||path.join(root,'source/HPW_Act_TESLIMAT_v2.10.0/GELISTIRICI_KAYNAK');
const H=require(path.join(S,'tools/tests/fe/harness.cjs'));
const {chromium}=require('./pw.cjs');
const OUT=process.env.OUT||path.join(root,'evidence/independent-ui');fs.mkdirSync(OUT,{recursive:true});
const TA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',TB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SR={ref:'SADECE-A-SOZLESMESI',scope:'A sirketi hizmet kapsamı',owners:'A sorumluları',retentionPolicyRef:'A-POLITIKA-1'};
const steps=['identity','service_record','hpw_owner','customer_admin','organization','instrument','first_cycle','results','user_access','go_live'].map((key,i)=>({key,no:i+1,state:i===0?'done':'not_started',owner:'hpw_admin',facts:{},blockedBy:null,approval:null}));
function detail(tid,sr=SR){return {contract:'hpw-act-platform-tenant/1',tenant:{id:tid,code:tid===TA?'AAA':'BBB',name:tid===TA?'SIRKET_A':'SIRKET_B',status:'active',status_reason:null,status_changed_at:null,archived_at:null,archive_reason:null,tracked_cycle_id:null,tracked_cycle_set_at:null,ops_version:7,service_record:sr,service_record_at:sr?'2026-09-01T00:00:00Z':null,locale:'tr',timezone:'Europe/Istanbul',created_at:'2026-09-01T00:00:00Z'},onboarding:{steps,summary:{done:1,total:10,firstOpen:'service_record'},fingerprints:{service_record:sr?'fpsr00001111':null,go_live:'fpgl00002222'}},cycles:[{id:'c1',code:'2026-ANA',name:'Ana',period_start:'2026-01-01',period_end:'2026-06-30',active_batch_id:'b1',tracked:false}],assignments:[{user_id:'u1',display_name:'Ayşe Danışman',duty:'primary',role:'consultant'}],recentEvents:[],can:{setup:true,manage:true,approveServiceRecord:true,approveGoLive:true}}}
const results=[];const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await chromium.launch({headless:true});const setup=H.makeSetup(browser);
 const companySetup=extra=>setup({platform:true,handler:async c=>{if(extra&&await extra(c))return true;if(c.q==='/api/platform/tenants/'+TA){await c.send(detail(TA));return true}if(c.q==='/api/platform/tenants/'+TB){await c.send(detail(TB,null));return true}}});
 async function rec(id,x,expected,observed,pass){results.push({id,expected,observed,status:pass?'PASS':'FAIL',pageErrors:x.errors});await x.p.screenshot({path:path.join(OUT,id+'.png'),fullPage:true});console.log(id,pass?'PASS':'FAIL',JSON.stringify(observed));await x.context.close()}
 async function run(id,fn){if(process.env.TEST_FILTER&&!id.includes(process.env.TEST_FILTER))return;try{await fn()}catch(e){results.push({id,status:'ERROR',error:String(e),stack:e.stack});console.log(id,'ERROR',String(e))}}
 await run('V210-A-SERVICE-CONTEXT',async()=>{
  const x=await companySetup();await x.go('/platform/sirket/'+TA+'?bolum=kurulum');await x.p.locator('#sr-ref').waitFor();const before=await x.p.locator('#sr-ref').inputValue();
  // Same React instance: hash navigation, no full reload (unlike supplier late-response probe).
  await x.p.evaluate(t=>{location.hash='/platform/sirket/'+t+'?bolum=kurulum'},TB);await x.p.getByRole('heading',{name:'SIRKET_B',exact:true}).waitFor();await delay(80);
  const fields=await x.p.locator('[id^=sr-]').evaluateAll(es=>Object.fromEntries(es.filter(e=>'value'in e).map(e=>[e.id,e.value])));
  await x.p.getByRole('button',{name:'Kaydı kaydet',exact:true}).click();await delay(250);
  const writes=x.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/service-record'));
  await rec('V210-A-SERVICE-CONTEXT',x,'B has no service record: blank form; A record must never be submitted as B',{before,fields,writes},Object.values(fields).every(v=>v==='')&&writes.length===0);
 });
 await run('V210-A2-INFLIGHT-CONTEXT',async()=>{
  let releaseSave,releaseB;const saveGate=new Promise(r=>{releaseSave=r}),bGate=new Promise(r=>{releaseB=r});
  const x=await companySetup(async({q,req,send})=>{if(q.endsWith('/service-record')&&req.method()==='POST'){await saveGate;await send({ok:true,version:8});return true}if(q==='/api/platform/tenants/'+TB){await bGate;await send(detail(TB,null));return true}});
  await x.go('/platform/sirket/'+TA+'?bolum=kurulum');await x.p.getByRole('button',{name:'Kaydı kaydet',exact:true}).click();await x.p.evaluate(t=>{location.hash='/platform/sirket/'+t+'?bolum=kurulum'},TB);await delay(100);
  releaseSave();await delay(150);releaseB();await delay(350);
  const text=await x.p.locator('main').innerText();await rec('V210-A2-INFLIGHT-CONTEXT',x,'Completing A save must not invalidate B load or leave B loading forever',{text,gets:x.requests.filter(r=>r.method==='GET'&&r.path.includes('/api/platform/tenants/')).map(r=>r.path)},text.includes('SIRKET_B')&&!text.includes('Yükleniyor'));
 });
 await run('V210-B-SERVICE-CONFLICT',async()=>{
  const x=await companySetup(async({q,req,send})=>{if(q.endsWith('/service-record')&&req.method()==='POST'){await send({error:'version_conflict',message:'AUDIT_VERSION_CONFLICT'},409);return true}});
  await x.go('/platform/sirket/'+TA+'?bolum=kurulum');await x.p.locator('#sr-ref').fill('BENIM-YENI-REFERANSIM');await x.p.getByRole('button',{name:'Kaydı kaydet',exact:true}).click();await delay(450);
  const alerts=await x.p.getByRole('alert').allInnerTexts();const input=await x.p.locator('#sr-ref').inputValue();
  await rec('V210-B-SERVICE-CONFLICT',x,'409 must remain visible so the user can review and retry',{alerts,input},alerts.some(t=>/değişti|CONFLICT/.test(t)));
 });
 for(const bad of ['503','malformed'])await run('V210-C-GOLIVE-'+bad,async()=>{
  const x=await setup({handler:async({q,send})=>{if(q.endsWith('/onboarding/go-live')){await send(bad==='503'?{error:'unavailable',message:'AUDIT_GOLIVE_UNAVAILABLE'}:{unexpected:true},bad==='503'?503:200);return true}}});
  await x.go('/t/t/');await delay(600);const text=await x.p.locator('main').innerText();const alerts=await x.p.getByRole('alert').allInnerTexts();const retry=await x.p.getByRole('button',{name:'Yeniden dene',exact:true}).count();
  await rec('V210-C-GOLIVE-'+bad,x,'Go-live load failure must expose an error and retry (not disappear)',{text,alerts,retry,goLiveGets:x.requests.filter(r=>r.path.endsWith('/onboarding/go-live')).length},alerts.length>0&&retry>0);
 });
 await run('V210-D-MODAL-PENDING-FOCUS',async()=>{
  let resolvePost;const gate=new Promise(r=>{resolvePost=r});
  const x=await companySetup(async({q,req,send})=>{if(q.endsWith('/status')&&req.method()==='POST'){await gate;await send({id:TA,status:'suspended',previousStatus:'active',reason:'audit'});return true}});
  await x.go('/platform/sirket/'+TA);await x.p.getByRole('button',{name:'Durdur',exact:true}).click();const dlg=x.p.getByRole('dialog');await dlg.locator('textarea').fill('Bağımsız denetim');await dlg.getByRole('button',{name:'Durdur',exact:true}).click();await delay(100);
  const focus=[];for(let i=0;i<4;i++){await x.p.keyboard.press('Tab');focus.push(await x.p.evaluate(()=>({tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.slice(0,80),inside:!!document.activeElement?.closest('[role=dialog]')})))}
  const pending=await dlg.count();await rec('V210-D-MODAL-PENDING-FOCUS',x,'Keyboard focus stays inside modal during pending request',{pending,focus},pending===1&&focus.every(f=>f.inside));resolvePost();
 });
 await run('V210-E-NARROW-320',async()=>{
  const x=await companySetup();await x.p.setViewportSize({width:320,height:800});await x.go('/platform/sirket/'+TA+'?bolum=kurulum');await x.p.locator('#sr-ref').waitFor();
  const dims=await x.p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,form:document.querySelector('form[aria-labelledby="sr-h"]')?.getBoundingClientRect().toJSON(),overflows:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,cls:e.className,rect:e.getBoundingClientRect().toJSON(),overflow:getComputedStyle(e).overflowX,position:getComputedStyle(e).position})).slice(0,25)}));
  // Diagnostic only: put the scroll wrapper in the containing-block chain.
  dims.diagnosticScrollAfterRelativeWrapper=await x.p.evaluate(()=>{const es=[...document.querySelectorAll('.table-wrap')];const before=es.map(e=>e.style.position);es.forEach(e=>{e.style.position='relative'});const width=document.documentElement.scrollWidth;es.forEach((e,i)=>{e.style.position=before[i]});return width});
  await rec('V210-E-NARROW-320',x,'Company detail form fits 320 CSS pixels; wide table may scroll in its container',dims,dims.scroll<=321);
 });
 await browser.close();fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));console.log('TOTAL',results.length,'FAIL',results.filter(r=>r.status!=='PASS').length);process.exitCode=results.every(r=>r.status==='PASS')?0:1;
})().catch(e=>{console.error(e);process.exitCode=2});
