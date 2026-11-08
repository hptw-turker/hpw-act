const fs=require('fs'),path=require('path');
const {chromium}=require('./pw.cjs');
const root=process.env.HPW_SOURCE||path.resolve(__dirname,'../source/HPW_Act_TESLIMAT_v2.9.0/GELISTIRICI_KAYNAK');
const H=require(root+'/tools/tests/fe/harness.cjs');
const out=process.env.EVIDENCE_DIR||path.resolve(__dirname,'../evidence');
const rows=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const TA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',TB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const tenants=[{id:TA,code:'AAA',name:'Şirket A'},{id:TB,code:'BBB',name:'Şirket B'}];
const staff=[{user_id:'uA',email:'a@example.test',display_name:'Danışman A',role:'consultant',role_revoked_at:null,user_status:'active',last_login_at:null,tenants:1}];
const event=t=>({id:'ev'+t,occurred_at:'2026-09-27T10:00:00Z',actor_email:'audit@example.test',action:'assignment.grant',tenant_code:t==='A'?'AAA':'BBB',tenant_name:'Şirket '+t,target_type:'user',target_id:'uA',before:null,after:{duty:'backup'},reason:'KAYIT_'+t,result:'ok',intervention_id:null});
const asg=t=>[{user_id:t==='A'?'cccccccc-cccc-4ccc-8ccc-cccccccccccc':'dddddddd-dddd-4ddd-8ddd-dddddddddddd',email:'x@example.test',display_name:'SORUMLU_'+t,role:'consultant',duty:'backup',valid_from:'2026-01-01',valid_to:null,reason:'test'}];
(async()=>{
 const browser=await chromium.launch({headless:true});const setup=H.makeSetup(browser);
 async function run(id,overrides,fn){let x;try{
  x=await setup({platform:true,handler:async c=>{
   if(await overrides(c))return true;
   if(c.q==='/api/platform/me'){await c.send({role:'admin',canManage:true,mfa:{enabled:true,verified:true}});return true}
   if(c.q==='/api/platform/tenants'){await c.send(tenants);return true}
   if(c.q==='/api/platform/staff'){await c.send(staff);return true}
   if(c.q==='/api/platform/portfolio'){await c.send({generatedAt:new Date().toISOString(),scope:{tenants:0,failed:0},items:[]});return true}
   if(c.q==='/api/platform/audit-events'){await c.send({items:[],nextBefore:null});return true}
  }});
  await x.go('/platform');await fn(x);
 }catch(e){rows.push({id,harnessError:String(e)})}finally{await x?.context.close()}}
 async function save(id,x,data){await x.p.screenshot({path:out+'/'+id+'.png',fullPage:true});rows.push({id,...data,pageErrors:x.errors});console.log(JSON.stringify(rows.at(-1)))}
 await run('V290-UI-01',async c=>{if(c.q==='/api/platform/staff'){await c.send({bad:'shape'});return true}},async x=>{await x.p.getByRole('tab',{name:'Ekip ve erişim'}).click();await sleep(500);const txt=await x.p.locator('body').innerText();await save('V290-UI-01',x,{case:'staff object instead of array',expected:'controlled error and retry, no unhandled render exception',issueReproduced:x.errors.length>0,bodyExcerpt:txt.slice(0,350)})});
 await run('V290-UI-02',async c=>{if(c.q==='/api/platform/audit-events'){await c.send({items:{bad:true},nextBefore:null});return true}},async x=>{await x.p.getByRole('tab',{name:'İşlem geçmişi'}).click();await sleep(500);await save('V290-UI-02',x,{case:'audit items object',expected:'controlled error and retry',issueReproduced:x.errors.length>0,bodyExcerpt:(await x.p.locator('body').innerText()).slice(0,350)})});
 await run('V290-UI-03',async c=>{if(c.q==='/api/platform/audit-events'){const t=(c.u.searchParams.get('tenantId')===TA?'A':c.u.searchParams.get('tenantId')===TB?'B':null);await sleep(t==='A'?900:t==='B'?50:0);await c.send({items:t?[event(t)]:[],nextBefore:null});return true}},async x=>{await x.p.getByRole('tab',{name:'İşlem geçmişi'}).click();await x.p.locator('#au-tenant').selectOption(TA);await sleep(80);await x.p.locator('#au-tenant').selectOption(TB);await sleep(1100);const txt=await x.p.locator('body').innerText();await save('V290-UI-03',x,{case:'late A after B in audit filter',selected:await x.p.locator('#au-tenant').inputValue(),showsA:txt.includes('KAYIT_A'),showsB:txt.includes('KAYIT_B'),issueReproduced:txt.includes('KAYIT_A')&&!txt.includes('KAYIT_B')})});
 await run('V290-UI-04',async c=>{if(/\/assignments$/.test(c.q)){const t=c.q.includes('/'+TA+'/')?'A':'B';await sleep(t==='A'?900:50);await c.send(asg(t));return true}},async x=>{await x.p.getByRole('tab',{name:'Ekip ve erişim'}).click();await x.p.locator('#as-tenant').selectOption(TA);await sleep(80);await x.p.locator('#as-tenant').selectOption(TB);await sleep(1100);x.p.on('dialog',d=>d.accept('Denetim için sonlandırma gerekçesi'));await x.p.getByRole('button',{name:'görevi bitir',exact:true}).click();await sleep(300);const writes=x.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/end')).map(r=>r.path);await save('V290-UI-04',x,{case:'late A assignments after selecting B',selected:await x.p.locator('#as-tenant').inputValue(),writes,issueReproduced:writes.some(p=>p.includes('/'+TA+'/'))})});
 fs.writeFileSync(out+'/independent-ui.json',JSON.stringify(rows,null,2));await browser.close();
 if(rows.some(r=>r.harnessError))process.exitCode=2;
 else if(rows.some(r=>r.issueReproduced))process.exitCode=1;
})();
