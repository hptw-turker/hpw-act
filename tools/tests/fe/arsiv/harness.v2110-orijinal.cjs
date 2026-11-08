// Denetçinin kontrollü HTTP düzeneğinden türetildi (aynı sahte yanıtlar); ek senaryolar için modül olarak dışa açılır
const fs=require('fs'),path=require('path');
const DIST=path.resolve(process.env.WEB_DIST||'apps/web/dist');
const cycles=[{id:'c1',code:'2026-ANA',active_batch_id:'b1',status:'published'},{id:'c2',code:'2027-ANA',active_batch_id:'b2',status:'published'}];
const units=[{id:'u1',code:'A',name:'A Şubesi',result_rows:1},{id:'u2',code:'B',name:'B Şubesi',result_rows:1}];
const row={resultId:'r1',metricCode:'M01_TB',itemCode:'M01',text:'Çalışma koşullarım uygundur.',dimensionCode:'D1',dimensionName:'Çalışma koşulları',origin:'core',n:30,value:60,suppressed:false,status:'OBSERVED',revision:1,companyValue:65,benchmarkCertified:70,interactionArea:'work',responsibilityLabel:'Birim',targetPolicy:'TARGETABLE',candidateRoles:[],confirmationRequired:false,assessment:{decision:'numeric_target_and_actions',tier:'recommended',rankKey:1}} // gerçek domain değeri (assessTier); rastgele değer değil;
const target={id:'t1',item_code:'M01',item_text:'Hedef A',kind:'numeric',baseline_score:60,suggested_target:65,lower_feasible:62,upper_feasible:70,approved_target:65,source:'peer_history',status:'accepted',version:1,actions:1,rationale:''};
const action={id:'a1',title:'A Şubesi Aksiyonu',unit_id:'u1',unit_code:'A',unit_name:'A Şubesi',lifecycle_state:'in_progress',verification_state:'pending',health_state:'on_track',evidence_level:'E2',verification_route:'hr',requirement:{expected:3,windowStart:'2026-01-01',windowEnd:'2026-12-31',cadence:'monthly',label:'aylık'},start_date:'2026-01-01',due_date:'2026-12-31',version:1,targets:[{targetId:'t1',itemCode:'M01'}],valid_evidence:0};
// N04: kontrollü yanıtlar sözleşmeye uydurulur — sözleşmede zorunlu olup fixture’da olmayan alanlar tür uyumlu varsayılanla doldurulur (null yalnız sözleşme izin veriyorsa)
const RESP=require(path.resolve(__dirname,'../../../apps/api/src/contract/responses.json'));
function conform(v,sc){if(!sc||!sc.type)return v;const ts=Array.isArray(sc.type)?sc.type:[sc.type];if(Array.isArray(v))return v.map(x=>conform(x,sc.items));if(v&&typeof v==='object'){for(const r of sc.required||[])if(!(r in v)){const t=sc.properties[r]||{};const tt=Array.isArray(t.type)?t.type:[t.type];v[r]=tt.includes('null')?null:tt.includes('string')?(t.enum?t.enum[0]:t.format==='uuid'?'00000000-0000-0000-0000-000000000000':t.format==='date-time'?'2026-01-01T00:00:00.000Z':t.format==='date'?'2026-01-01':''):tt.includes('integer')||tt.includes('number')?0:tt.includes('boolean')?false:tt.includes('array')?[]:{};}for(const [k,x] of Object.entries(v))if(sc.properties&&sc.properties[k])v[k]=conform(x,sc.properties[k]);return v;}if(typeof v==='number'&&!ts.includes('number')&&!ts.includes('integer')&&ts.includes('string'))return String(v);/* pg numeric alanları API'de metin döner (bkz. contract-infer PG_JSON.numeric); tek belgelenmiş istisna */return v;}
conform(cycles,RESP['GET /api/t/:tid/cycles']);conform(units,RESP['GET /api/t/:tid/cycles/:cid/units']);conform([target],RESP['GET /api/t/:tid/cycles/:cid/units/:uid/targets']);conform([action],RESP['GET /api/t/:tid/actions']);conform([row],RESP['GET /api/t/:tid/cycles/:cid/units/:uid/results'].properties.rows);
function makeSetup(browser){ return async function setup(opt={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const p=await context.newPage();const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));
 const state={profile:'HR_ADMIN',logged:true,...opt,platform:!!opt.platform};
 await context.route('https://audit.test/**',async rt=>{
  const req=rt.request(),u=new URL(req.url()),q=u.pathname;requests.push({path:q+u.search,method:req.method(),body:req.postData(),headers:req.headers()});
  const send=(data,status=200)=>rt.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(q.startsWith('/api/')){
   if(state.handler && await state.handler({q,req,send,rt,u,requests}))return;
   if(q.endsWith('/permissions'))return send({contract:'hpw-act-permissions/1',realm:'customer',profile:state.profile,companyWide:state.profile==='HR_ADMIN'||state.profile==='EXEC',unitId:u.searchParams.get('unitId'),unitProfile:state.profile,rules:require(__dirname+'/rules.json')}); // N02: geçerli varsayılan yetki yanıtı (sessiz [] yok); olumsuz durumlar ayrı testlerde
   if(q==='/api/platform/me'&&state.platform){const r=state.platformRole||'admin';return send({userId:'hpw1',email:'hpw@example.test',displayName:'HPW Yöneticisi',role:r,capabilities:r==='admin'?['read','setup','methodology','business']:['read','setup'],canManage:r==='admin'})} // v2.9.0: varsayılan platform rolü yönetici; olumsuz roller testte ayrıca verilir
   if(q==='/api/auth/me'&&state.platform)return send({userId:'hpw1',email:'hpw@example.test',displayName:'HPW Yöneticisi',realm:'platform',tenantId:null,profile:null,memberships:[]}); // v2.8.0: platform oturumu
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
} }
module.exports={makeSetup,cycles,units,row,target,action,DIST,conform,RESP};
