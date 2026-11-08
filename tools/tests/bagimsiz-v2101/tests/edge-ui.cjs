// Additional regression probes for the delivered build. Real Chromium, controlled HTTP.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),S=process.env.HPW_SOURCE;
const H=require(path.join(S,'tools/tests/fe/harness.cjs'));
const {chromium}=require(path.join(root,'previous/evidence-pack/tests/pw.cjs'));
const OUT=process.env.OUT||path.join(root,'evidence/edge-ui');fs.mkdirSync(OUT,{recursive:true});
const TA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',TB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SR={ref:'SERVER-ORIGINAL',scope:'Hizmet kapsamı',owners:'HPW ve müşteri',retentionPolicyRef:'POL-1'};
const steps=['identity','service_record','hpw_owner','customer_admin','organization','instrument','first_cycle','results','user_access','go_live'].map((key,i)=>({key,no:i+1,state:i===0?'done':'not_started',owner:'hpw_admin',facts:{},blockedBy:null,approval:null}));
function detail(tid,sr=SR,version=7){return {contract:'hpw-act-platform-tenant/1',tenant:{id:tid,code:tid===TA?'AAA':'BBB',name:tid===TA?'SIRKET_A':'SIRKET_B',status:'active',status_reason:null,status_changed_at:null,archived_at:null,archive_reason:null,tracked_cycle_id:null,tracked_cycle_set_at:null,ops_version:version,service_record:sr,service_record_at:sr?'2026-09-01T00:00:00Z':null,locale:'tr',timezone:'Europe/Istanbul',created_at:'2026-09-01T00:00:00Z'},onboarding:{steps,summary:{done:1,total:10,firstOpen:'service_record'},fingerprints:{service_record:sr?'fpsr00001111':null,go_live:'fpgl00002222'}},cycles:[],assignments:[{user_id:'u1',display_name:'Ayşe Danışman',duty:'primary',role:'consultant'}],recentEvents:[],can:{setup:true,manage:true,approveServiceRecord:true,approveGoLive:true}}}
const delay=ms=>new Promise(r=>setTimeout(r,ms)),results=[];
(async()=>{
 const browser=await chromium.launch({headless:true}),setup=H.makeSetup(browser);
 async function rec(id,x,expected,observed,pass){results.push({id,expected,observed,status:pass?'PASS':'FAIL',errors:x.errors});await x.p.screenshot({path:path.join(OUT,id+'.png'),fullPage:true});console.log(id,pass?'PASS':'FAIL',JSON.stringify(observed));await x.context.close()}
 async function run(id,fn){if(process.env.TEST_FILTER&&!id.includes(process.env.TEST_FILTER))return;try{await fn()}catch(e){results.push({id,status:'ERROR',error:String(e),stack:e.stack});console.log(id,'ERROR',String(e))}}
 for(const aba of [true,false])await run(aba?'V2101-R1-ABA-DRAFT':'V2101-R2-EDIT-DURING-SAVE',async()=>{
  let release;const gate=new Promise(r=>{release=r});let stored={...SR},version=7;
  const x=await setup({platform:true,handler:async({q,req,send})=>{
   if(q==='/api/platform/tenants/'+TA){await send(detail(TA,stored,version));return true}
   if(q==='/api/platform/tenants/'+TB){await send(detail(TB,null));return true}
   if(q.endsWith('/service-record')&&req.method()==='POST'){const {expectedVersion,...body}=JSON.parse(req.postData());await gate;stored=body;version++;await send({tenantId:TA,serviceRecord:stored,version});return true}
  }});
  await x.go('/platform/sirket/'+TA+'?bolum=kurulum');await x.p.locator('#sr-ref').fill('FIRST-SUBMITTED');await x.p.getByRole('button',{name:'Kaydı kaydet',exact:true}).click();await delay(70);
  if(aba){for(const tid of [TB,TA]){await x.p.evaluate(t=>{location.hash='/platform/sirket/'+t+'?bolum=kurulum'},tid);await x.p.getByRole('heading',{name:tid===TA?'SIRKET_A':'SIRKET_B',exact:true}).waitFor();await delay(40)}}
  const editable=await x.p.locator('#sr-ref').isEditable();if(editable)await x.p.locator('#sr-ref').fill('SECOND-UNSAVED-DRAFT');
  const before=await x.p.locator('#sr-ref').inputValue();await x.p.screenshot({path:path.join(OUT,(aba?'V2101-R1':'V2101-R2')+'-before.png'),fullPage:true});release();await delay(450);
  const after=await x.p.locator('#sr-ref').inputValue();const posts=x.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/service-record')).map(r=>({path:r.path,body:JSON.parse(r.body)}));
  await rec(aba?'V2101-R1-ABA-DRAFT':'V2101-R2-EDIT-DURING-SAVE',x,aba?'Previous A visit completion must not discard the new A visit draft':'New edits after submitting must be preserved, or editing must be blocked while saving',{editable,before,after,stored,posts,status:await x.p.getByRole('status').allInnerTexts()},(!editable&&!aba)||after==='SECOND-UNSAVED-DRAFT');
 });
 await run('V2101-R3-RECEIPT-LOST',async()=>{
  let confirmed=false;
  const x=await setup({handler:async({q,req,send})=>{
   if(q.endsWith('/onboarding/go-live')&&req.method()==='GET'){await send({state:confirmed?'done':'in_progress',hpwApprovedAt:'2026-09-27T10:00:00Z',hpwReason:'approval',customerConfirmedAt:confirmed?'2026-09-28T00:00:00Z':null,awaitingCustomer:!confirmed,fingerprint:confirmed?null:'CURRENT-FP-123456'});return true}
   if(q.endsWith('/onboarding/go-live/confirm')){confirmed=true;await send({error:'receipt_lost',message:'Komut daha önce yürütüldü; makbuz kayboldu'},409);return true}
  }});
  await x.go('/t/t/');await x.p.getByRole('button',{name:'Kullanıma açılışı teyit et',exact:true}).click();let dlg=x.p.getByRole('dialog');await dlg.locator('textarea').fill('Teyit ediyoruz');await dlg.getByRole('button',{name:'Teyit et',exact:true}).click();await delay(400);
  const before=x.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/confirm')).length;
  const modalCount=await dlg.count();const modalText=modalCount?await dlg.innerText():null;
  const button=dlg.getByRole('button',{name:'Teyit et',exact:true});const buttonEnabled=modalCount?await button.isEnabled():false;if(buttonEnabled)await button.click();await delay(150);
  const after=x.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/confirm')).length;
  const regionText=await x.p.locator('[role="region"][aria-label="Kullanıma açılış"]').innerText();
  await rec('V2101-R3-RECEIPT-LOST',x,'After reread says confirmed, no active confirmation button may silently do nothing; remove obsolete unreadable-record error and show a coherent resolved/closed state',{modalCount,modalText,buttonEnabled,postsBeforeRetry:before,postsAfterRetry:after,regionText},!buttonEnabled&&!/kayıt okunamadı/i.test(modalText??'')&&regionText.toLocaleLowerCase('tr').includes('teyit edildi'));
 });
 await browser.close();fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));console.log('TOTAL',results.length,'FAIL',results.filter(x=>x.status!=='PASS').length);process.exitCode=results.every(x=>x.status==='PASS')?0:1;
})().catch(e=>{console.error(e);process.exitCode=2});
