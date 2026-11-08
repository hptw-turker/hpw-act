// v2.11.5: ui-audit.cjs'in DEEP-LINK hazır olma bekleyen kopyası (tek fark: DEEP-LINK'te görünürlük beklemesi, 5 sn sınır). Özgünü: ui-audit.cjs (değiştirilmedi).
const fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PW_MODULE||'/home/claude/.npm-global/lib/node_modules/playwright');
const DIST=path.resolve(process.env.WEB_DIST||'apps/web/dist');
const OUT=path.resolve(process.env.OUT||'docs/test-ciktilari/fe');fs.mkdirSync(OUT,{recursive:true});
const results=[];const delay=ms=>new Promise(r=>setTimeout(r,ms));
const cycles=[{id:'c1',code:'2026-ANA',active_batch_id:'b1',status:'published'},{id:'c2',code:'2027-ANA',active_batch_id:'b2',status:'published'}];
const units=[{id:'u1',code:'A',name:'A Şubesi',result_rows:1},{id:'u2',code:'B',name:'B Şubesi',result_rows:1}];
const row={resultId:'r1',metricCode:'M01_TB',itemCode:'M01',text:'Çalışma koşullarım uygundur.',dimensionCode:'D1',dimensionName:'Çalışma koşulları',origin:'core',n:30,value:60,suppressed:false,status:'valid',revision:1,companyValue:65,benchmarkCertified:70,interactionArea:'work',responsibilityLabel:'Birim',targetPolicy:'TARGETABLE',candidateRoles:[],confirmationRequired:false,assessment:{decision:'numeric_target_and_actions',tier:'A',rankKey:1}};
const target={id:'t1',item_code:'M01',item_text:'Hedef A',kind:'numeric',baseline_score:60,suggested_target:65,lower_feasible:62,upper_feasible:70,approved_target:65,source:'peer_history',status:'accepted',version:1,actions:1,rationale:''};
const action={id:'a1',title:'A Şubesi Aksiyonu',unit_id:'u1',unit_code:'A',unit_name:'A Şubesi',lifecycle_state:'in_progress',verification_state:'pending',health_state:'on_track',evidence_level:'E2',verification_route:'hr',requirement:{expected:3,windowStart:'2026-01-01',windowEnd:'2026-12-31',cadence:'monthly',label:'aylık'},start_date:'2026-01-01',due_date:'2026-12-31',version:1,targets:[{targetId:'t1',itemCode:'M01'}],valid_evidence:0,fulfilled_slots:0};
(async()=>{
let browser=await chromium.launch({headless:true});
async function setup(opt={}){
 if(!browser.isConnected())browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});const p=await context.newPage();const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));
 const state={profile:'HR_ADMIN',logged:true,...opt};
 await p.route('https://audit.test/**',async rt=>{
  const req=rt.request(),u=new URL(req.url()),q=u.pathname;requests.push({path:q+u.search,method:req.method(),body:req.postData(),headers:req.headers()});
  const send=(data,status=200)=>rt.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(q.startsWith('/api/')){
   if(state.handler && await state.handler({q,req,send,rt,u,requests}))return;
   if(q.endsWith('/permissions'))return send({contract:'hpw-act-permissions/1',realm:'customer',profile:state.profile,companyWide:state.profile==='HR_ADMIN'||state.profile==='EXEC',unitId:u.searchParams.get('unitId'),unitProfile:state.profile,rules:require(__dirname+'/rules.json')}); // N02: geçerli varsayılan yetki yanıtı (sessiz [] yok); olumsuz durumlar ayrı testlerde
   if(q==='/api/auth/me')return state.logged?send({userId:'user1',email:'test@example.test',displayName:'Denetim Kullanıcısı',realm:'customer',tenantId:'t',profile:state.profile,companyWide:state.profile==='HR_ADMIN'||state.profile==='EXEC',memberships:[{tenant_id:'t',tenant_name:'Denetim',tenant_code:'TEST'}]}):send({error:'unauthorized',message:'Oturum yok'},401);
   if(q==='/api/platform/bootstrap-status')return send({needsBootstrap:false,setupKeyRequired:true,env:'test'});
   if(q.endsWith('/overview'))return send({tenant:{name:'Denetim Şirketi',code:'TEST',locale:'tr-TR',timezone:'Europe/Istanbul'},principal:{profile:state.profile,companyWide:state.profile==='HR_ADMIN'||state.profile==='EXEC'},counts:{units:2,members:3,roles:3,cycles:2,published_cycles:2,targets:1,actions:1},env:'test'});
   if(q.endsWith('/cycles'))return send(cycles);
   if(/\/cycles\/[^/]+\/units$/.test(q))return send(units);
   if(q.endsWith('/results')){const unit=q.includes('/u2/')?units[1]:units[0];return send({cycle:{code:'2026-ANA'},unit,rows:[row]})}
   if(q.endsWith('/targets')&&req.method()==='GET')return send([target]);
   if(q.endsWith('/targets')&&u.search)return send({proposal:{low:62,high:70,target:65,source:'peer_history'},candidateRoles:[],measurementPlan:{followupCycleCode:'2027-ANA',horizonDays:180},monitoringRole:'Birim Müdürü'});
   if(q.endsWith('/actions')&&req.method()==='GET')return send(u.searchParams.get('unitId')==='u2'?[]:[action]);
   if(q.endsWith('/actions/a1'))return send({evidence:[],verification:null,validCount:0,fulfilledSlotCount:0,eventCount:0});
   if(q.endsWith('/recommendations'))return send({recommendations:[{code:'TPL',title:'Toplantı',evidenceLevel:'E2',cadence:'monthly',effort:'low'}]});
   if(q.endsWith('/aggregates'))return send({aggregates:[]});
   if(q.endsWith('/org'))return send({unitTypes:[],units:units.map(u=>({...u,unit_type:'BRANCH'})),roles:[],hierarchies:[]});
   if(q.endsWith('/attention'))return send([{id:'verify:a1',kind:'verification',severity:'warning',title:'Aksiyonu doğrula',route:'actions',unitId:'u1',cycleId:'c1',entityId:'a1'}]);
   if(q.includes('/corporate/')||q.endsWith('/responsibility-map'))return send({error:'forbidden',message:'Yetkiniz yok'},403);
   if(q.endsWith('/instruments/catalog'))return send({dimensions:[],items:[]});
   if(req.method()==='GET')return send([]);
   return send({ok:true});
  }
  const f=path.join(DIST,q==='/'?'app.html':q);if(fs.existsSync(f)&&fs.statSync(f).isFile())return rt.fulfill({body:fs.readFileSync(f),contentType:q.endsWith('.js')?'application/javascript':q.endsWith('.css')?'text/css':q.endsWith('.woff2')?'font/woff2':'text/html'});
  return rt.fulfill({status:404,body:'Not found'});
 });
 async function go(route){await p.goto('https://audit.test/app.html#'+route);await p.waitForTimeout(250)}
 return {p,context,state,errors,requests,go};
}
async function record(id,expected,observed,pass,p,shot){results.push({id,expected,observed,status:pass?'PASS':'FAIL',mode:'Chromium; delivered bundle; mocked HTTP API'});if(shot)await p.screenshot({path:OUT+'/'+id+'.png',fullPage:true});console.log(id,pass?'PASS':'FAIL',JSON.stringify(observed));}
// 8 roles: navigation rendered (platform separately represented by realm path in static review)
for(const role of ['HR_ADMIN','HR_PARTNER','EXEC','REGION_MANAGER','UNIT_MANAGER','ACTION_OWNER','VIEWER']){
 const x=await setup({profile:role});await x.go('/t/t/hedefler');const names=await x.p.locator('nav').innerText();const mutation=await x.p.getByRole('button',{name:'Öneriyi gör',exact:true}).count();
 await record('ROLE-'+role,role==='VIEWER'||role==='ACTION_OWNER'?'No target mutation controls':'Target screen renders',{nav:names,newTarget:mutation,errors:x.errors},role==='VIEWER'||role==='ACTION_OWNER'?mutation===0:x.errors.length===0,x.p,role==='VIEWER');await browser.close();
}
{
 const x=await setup({profile:'EXEC',handler:async({q,send})=>{if(q.endsWith('/corporate/ambitions')){await send({companyWide:true,ambitions:[{id:'amb1',item_code:'M01',ambition_value:'70',status:'draft',cycle_code:'2026-ANA',cohort_size:0,version:1}]});return true}}});await x.go('/t/t');const count=await x.p.getByRole('button',{name:'kohort kuralı',exact:true}).count();await record('EXEC-FREEZE','EXEC cannot freeze cohorts',{freezeControls:count},count===0,x.p,true);await browser.close();
}
{
 const x=await setup();await x.go('/t/t/aksiyonlar?unit=u1&cycle=c1&sel=a1');/* v2.11.5 UYARLAMA (beklenti aynı): anlık sayım yerine düğmenin görünür olması en çok 5 sn beklenir; görünmezse sayım 0 kalır ve senaryo düşer */await x.p.getByRole('button',{name:'Kaydı ekle',exact:true}).first().waitFor({state:'visible',timeout:5000}).catch(()=>null);const cnt=await x.p.getByRole('button',{name:'Kaydı ekle',exact:true}).count();await record('DEEP-LINK','sel=a1 opens action detail',{evidenceButton:cnt},cnt>0,x.p,true);await browser.close();
}
{
 const x=await setup();await x.go('/t/t/aksiyonlar');await x.p.getByRole('button',{name:'Aksiyonu aç',exact:true}).first().click();await x.p.waitForTimeout(100);await x.p.locator('#unit').selectOption('u2');await x.p.waitForTimeout(150);const detail=await x.p.getByRole('button',{name:'Kaydı ekle',exact:true}).count();await record('STALE-ACTION','Changing unit clears prior action detail',{selectedUnit:await x.p.locator('#unit').inputValue(),priorActionDetailRemains:detail>0},detail===0,x.p,true);await browser.close();
}
{
 const x=await setup({handler:async({q,send})=>{if(q.endsWith('/results')){await delay(q.includes('/u1/')?600:30);await send({cycle:{code:'2026-ANA'},unit:q.includes('/u1/')?units[0]:units[1],rows:[row]});return true}}});await x.go('/t/t/birimler');await x.p.locator('#unit').selectOption('u2');await x.p.waitForTimeout(750);const heading=await x.p.locator('h1').innerText();await record('RESULT-RACE','Last selected unit B retains B results',{unit:await x.p.locator('#unit').inputValue(),heading},heading.includes('B Şubesi'),x.p,true);await browser.close();
}
{
 const x=await setup({handler:async({q,send})=>{if(q.endsWith('/cycles')){await send({error:'unavailable',message:'Servis kullanılamıyor'},503);return true}}});await x.go('/t/t/hedefler');const text=await x.p.locator('body').innerText();await record('LOAD-503','Visible load error and retry',{unhandledErrors:x.errors,errorVisible:text.includes('Servis kullanılamıyor'),emptyShown:text.toLocaleLowerCase('tr-TR').includes('bu birimde hedef yok')},text.includes('Servis kullanılamıyor')&&!text.toLocaleLowerCase('tr-TR').includes('bu birimde hedef yok'),x.p,true);await browser.close();
}
{
 const x=await setup({handler:async({q,send})=>{if(q.endsWith('/overview')){await send({error:'unavailable',message:'Servis kullanılamıyor'},503);return true}}});await x.go('/t/t/hedefler');const text=await x.p.locator('body').innerText();await record('OVERVIEW-503','Service failure not reported as missing permission',{permissionMessage:text.includes('Bu şirkete erişiminiz yok.')},!text.includes('Bu şirkete erişiminiz yok.'),x.p,false);await browser.close();
}
{
 const x=await setup();await x.go('/t/t/hedefler');x.state.handler=async({q,send})=>{if(q.endsWith('/cycles')){await send({error:'unauthorized',message:'Oturum süresi doldu'},401);return true}};await x.p.getByRole('link',{name:'Aksiyonlar ve kanıt',exact:true}).click();await x.p.waitForTimeout(200);await record('SESSION-401','Expired session redirects or offers sign in',{url:x.p.url(),errors:x.errors},x.p.url().includes('/giris'),x.p,false);await browser.close();
}
{
 const x=await setup();await x.go('/t/t/yukle/org');x.state.handler=async({q,req,send})=>{if(q.endsWith('/imports/org')){await delay(450);await send({jobId:'jobA',state:'validated',rowCount:1,errorCount:0,warningCount:0,issues:[],preview:{file:'A.xlsx'},canCommit:true});return true}};
 await x.p.locator('input[type=file]').setInputFiles({name:'A.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('fixture A')});await x.p.getByRole('button',{name:'Doğrula ve önizle'}).click();await x.p.waitForTimeout(50);await x.p.locator('input[type=file]').setInputFiles({name:'B.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('fixture B')});await x.p.waitForTimeout(600);const enabled=await x.p.getByRole('button',{name:'Onayla ve işle',exact:true}).isEnabled();await record('IMPORT-RACE','Changing file invalidates in-flight prior preview',{selectedFile:'B.xlsx',previewA:(await x.p.locator('body').innerText()).includes('A.XLSX'),commitEnabled:enabled},!enabled,x.p,true);await browser.close();
}
{
 const x=await setup();await x.go('/t/t/hedefler');await x.p.locator('#item').selectOption('M01');await x.p.getByRole('button',{name:'Öneriyi gör',exact:true}).click();await x.p.waitForTimeout(100);await x.p.locator('#val').fill('abc');let body=null;x.state.handler=async({q,req,send})=>{if(q.endsWith('/targets')&&req.method()==='POST'){body=JSON.parse(req.postData());await send({error:'invalid_request',message:'Geçersiz değer'},400);return true}};await x.p.getByRole('button',{name:'Öneriyi kabul et',exact:true}).click();await x.p.waitForTimeout(100);await record('NUMBER-VALIDATION','Invalid numeric entry is blocked locally',{sentBody:body},body===null,x.p,false);await browser.close();
}
{
 const x=await setup();await x.go('/t/t/aksiyonlar');await x.p.getByRole('button',{name:'Aksiyonu aç',exact:true}).first().click();await x.p.waitForTimeout(100);x.state.handler=async({q,send})=>{if(q.endsWith('/declare-complete')){action.lifecycle_state='declared_complete';await send({lifecycle:'declared_complete',verification:'pending'});return true}};await x.p.getByRole('button',{name:'Tamamlandı beyanı',exact:true}).click();await x.p.waitForTimeout(150);const enabled=await x.p.getByRole('button',{name:'Doğrula (İK / bölge)',exact:true}).isEnabled();await record('ACTION-REFRESH','Detail state refreshes after declaration',{verifyEnabled:enabled,declareEnabled:await x.p.getByRole('button',{name:'Tamamlandı beyanı',exact:true}).isEnabled()},enabled,x.p,true);await browser.close();action.lifecycle_state='in_progress';
}
// positive privacy DTO rendering
{
 const x=await setup({handler:async({q,send})=>{if(q.endsWith('/results')){await send({cycle:{code:'2026-ANA'},unit:units[0],rows:[{...row,n:null,value:null,companyValue:null,suppressed:true,assessment:null}]});return true}}});await x.go('/t/t/birimler');await record('PRIVACY-DTO','Null suppressed values render without numeric disclosure',{errors:x.errors,text:await x.p.locator('tbody').first().innerText()},x.errors.length===0,x.p,false);await browser.close();
}
for(const width of [375,768,1440]){
 const x=await setup();await x.p.setViewportSize({width,height:900});await x.go('/t/t/organizasyon');const d=await x.p.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));await record('LAYOUT-'+width,'No document-level horizontal overflow',d,d.scroll<=width+1,x.p,width===375);await browser.close();
}
{
 const x=await setup({logged:false});await x.go('/giris');await x.p.locator('#email').fill('invalid-email');await x.p.locator('#password').fill('password');x.state.handler=async({q,send})=>{if(q==='/api/auth/login'){await delay(200);await send({error:'invalid',message:'Hatalı giriş'},400);return true}};await x.p.locator('#password').press('Enter');await x.p.locator('#password').press('Enter');await x.p.waitForTimeout(300);const n=x.requests.filter(r=>r.path==='/api/auth/login').length;await record('LOGIN-ENTER','Busy submission prevents duplicate Enter requests',{requests:n},n===1,x.p,false);await browser.close();
}

{
 const x=await setup();await x.go('/t/t/aksiyonlar');await x.p.getByRole('button',{name:'Aksiyonu aç',exact:true}).first().click();await x.p.waitForTimeout(100);
 const before=x.requests.filter(r=>r.path.includes('/actions')&&r.method==='GET').length;
 x.state.handler=async({q,send})=>{if(q.endsWith('/declare-complete')){await send({error:'receipt_lost',message:'Komut daha önce yürütüldü'},409);return true}};
 await x.p.getByRole('button',{name:'Tamamlandı beyanı',exact:true}).click();await x.p.waitForTimeout(120);
 const after=x.requests.filter(r=>r.path.includes('/actions')&&r.method==='GET').length;
 await x.p.getByRole('button',{name:'Tamamlandı beyanı',exact:true}).click();await x.p.waitForTimeout(120);
 const cmds=x.requests.filter(r=>r.path.endsWith('/declare-complete'));
 await record('RECEIPT-LOST','Reconcile completed command by rereading resource',{readRequestsBefore:before,readRequestsAfter:after,keys:cmds.map(r=>r.headers['idempotency-key'])},after>before,x.p,true);await browser.close();
}
{
 const x=await setup();await x.go('/t/t/yukle/org');x.state.handler=async({q,send})=>{if(q.endsWith('/imports/org')){await send({jobId:'jobError',state:'failed',rowCount:1,errorCount:1,warningCount:0,issues:[{severity:'error',sheet:'Birimler',row:2,col:'Kod',code:'required',message:'Kod gerekli'}],preview:{},canCommit:false});return true}};
 await x.p.locator('input[type=file]').setInputFiles({name:'invalid.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('test fixture')});await x.p.getByRole('button',{name:'Doğrula ve önizle'}).click();await x.p.waitForTimeout(100);
 await record('IMPORT-INVALID','Invalid import cannot commit',{commitDisabled:await x.p.getByRole('button',{name:'Onayla ve işle',exact:true}).isDisabled()},await x.p.getByRole('button',{name:'Onayla ve işle',exact:true}).isDisabled(),x.p,false);await browser.close();
}
{
 const x=await setup();await x.go('/t/t/aksiyonlar');await x.p.getByRole('button',{name:'Aksiyonu aç',exact:true}).first().click();await x.p.waitForTimeout(100);const count=await x.p.getByRole('button',{name:/iptal/i}).count();await record('ACTION-CANCEL','Manual chapter 16: action cancellation available',{cancelButtons:count},count>0,x.p,false);await browser.close();
}
{
 const x=await setup();await x.go('/t/t/hedefler');const count=await x.p.getByRole('button',{name:/devret|devir/i}).count();await record('TARGET-TRANSFER','Manual chapter 15: HR admin can transfer target owner',{transferButtons:count},count>0,x.p,false);await browser.close();
}


{
 const x=await setup({handler:async({q,send})=>{if(q==='/api/auth/me'){await send({userId:'p1',email:'platform@example.test',displayName:'Platform Denetimi',realm:'platform',tenantId:null});return true}if(q==='/api/platform/mail-sandbox'){await send({note:'Sentetik',mails:[]});return true}}});await x.go('/platform');const count=await x.p.getByRole('heading',{name:'Müşteriler',exact:true}).count();await record('ROLE-PLATFORM','Platform page renders',{heading:count,errors:x.errors},count===1&&x.errors.length===0,x.p,false);await browser.close();
}

await browser.close();fs.writeFileSync(OUT+'/ui-results.json',JSON.stringify(results,null,2));console.log('TOTAL',results.length,'FAIL',results.filter(r=>r.status==='FAIL').length);
})().catch(e=>{console.error(e);fs.writeFileSync(OUT+'/ui-results.json',JSON.stringify(results,null,2));process.exit(1)});
