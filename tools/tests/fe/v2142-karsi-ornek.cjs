/* v2.14.2 — üç kalan bulgunun karşı örnekleri (aynı veri, rol, dil, viewport, ekran durumu).
 * A06: mobil tabloda başlık–veri sütun hizası + sağdaki işleme erişim (TR/EN × 320/390/820) ve sayfa taşmaması.
 * A03: mobil mermi grafikte değer etiketinin viewBox içinde kalması (TR/EN × 0/98/100, 390 ve 320) + masaüstü normal değer görüntüsü.
 * A04: kontrollü saatle takvimde gecikme (weekly kısmi dönem, son gün, beş ritim, yıl geçişi); dönemler sunucunun planSlots motorundan.
 * Kullanım: OUT=... [WEB_DIST=...] node tools/tests/fe/v2142-karsi-ornek.cjs */
const fs=require('fs');const path=require('path');const {chromium}=require(process.env.PW_MODULE||'/home/claude/.npm-global/lib/node_modules/playwright');const {makeSetup,action}=require('./harness.cjs');
const OUT=path.resolve(process.env.OUT||'docs/test-ciktilari/v2142/olcum');fs.mkdirSync(OUT,{recursive:true});const R=[];const rec=(id,data,pass)=>{R.push({id,data,pass});console.log(id,pass?'PASS':'FAIL',JSON.stringify(data).slice(0,400))};
const PREVIEW={proposal:{low:62,high:70,target:64,source:'peer_history'},confirmationRequired:false,candidateRoles:[],measurementPlan:{followupCycleCode:'2027-ANA',horizonDays:365},monitoringRole:'Birim Müdürü'};
(async()=>{const lib=await import(path.resolve('apps/api/dist/src/library.js'));const browser=await chromium.launch();const setup=makeSetup(browser);
 const shot=async(x,name)=>{await x.p.screenshot({path:path.join(OUT,name+'.png'),fullPage:true})};
 const toEN=async(x)=>{await x.p.getByRole('button',{name:'EN',exact:true}).first().click();await x.p.waitForTimeout(300)};
 // ---------------- A06 — başlık–veri hizası
 for(const w of [320,390,820])for(const lang of ['tr','en']){const x=await setup({profile:'UNIT_MANAGER'});await x.p.setViewportSize({width:w,height:844});await x.go('/t/t/hedefler');await x.p.waitForTimeout(700);if(lang==='en')await toEN(x);
  const m=await x.p.evaluate(()=>{const tbl=document.querySelector('table.tbl2');if(!tbl)return null;const ths=[...tbl.querySelectorAll('thead th')];const tds=[...tbl.querySelectorAll('tbody tr:first-child td')];
   const cols=ths.map((th,i)=>{const a=th.getBoundingClientRect(),b=tds[i]?.getBoundingClientRect();return {bas:th.textContent.trim(),thX:Math.round(a.left*100)/100,tdX:b?Math.round(b.left*100)/100:null,thW:Math.round(a.width*100)/100,tdW:b?Math.round(b.width*100)/100:null}});
   const sap=Math.max(...cols.map(c=>c.tdX===null?0:Math.max(Math.abs(c.thX-c.tdX),Math.abs(c.thW-c.tdW))));
   let s=tbl;while(s&&s!==document.body&&!(s.scrollWidth>s.clientWidth+1&&getComputedStyle(s).overflowX!=='visible'))s=s.parentElement;const kap=(s&&s!==document.body)?s:null;
   const btn=tbl.querySelector('tbody tr a.kucukbtn,tbody tr button.kucukbtn');let reach=null;if(btn){const r0=btn.getBoundingClientRect();window.scrollBy(0,r0.top-innerHeight/2); /* yalnız dikey: elementFromPoint görünür alan ister */ if(kap)kap.scrollLeft=kap.scrollWidth;const r=btn.getBoundingClientRect();reach=r.width>0&&r.right<=innerWidth+1&&r.left>=0;const el=document.elementFromPoint(Math.min(innerWidth-1,(r.left+r.right)/2),(r.top+r.bottom)/2);reach=reach&&!!el&&(el===btn||btn.contains(el));if(kap)kap.scrollLeft=0}
   const fs_=getComputedStyle(tbl.querySelector('tbody td')).fontSize;return {cols,sapma:sap,docScroll:document.documentElement.scrollWidth,vw:innerWidth,kaydirici:kap?kap.tagName+'.'+kap.className:null,reach,fontSize:fs_,sutun:ths.length}});
  if(lang==='tr'&&w!==820)await shot(x,`a06-hedefler-${w}-tr`);
  rec(`A06-HIZA-${w}-${lang.toUpperCase()}`,m,!!m&&m.sapma<=1&&m.docScroll<=m.vw+1&&m.reach===true);await x.context.close()}
 // A06 birim sonuçları tablosu (çok sütunlu, uzun metin) 390
 {const x=await setup({profile:'UNIT_MANAGER'});await x.p.setViewportSize({width:390,height:844});await x.go('/t/t/birimler');await x.p.waitForTimeout(800);
  const m=await x.p.evaluate(()=>{const out=[];document.querySelectorAll('table.tbl2').forEach(tbl=>{const ths=[...tbl.querySelectorAll('thead th')];const tds=[...tbl.querySelectorAll('tbody tr:first-child td')];if(tds.length!==ths.length)return;out.push(Math.max(...ths.map((th,i)=>Math.abs(th.getBoundingClientRect().left-tds[i].getBoundingClientRect().left))))});return {sapmalar:out,docScroll:document.documentElement.scrollWidth,vw:innerWidth}});
  rec('A06-HIZA-BIRIMLER-390',m,m.sapmalar.length>0&&m.sapmalar.every(v=>v<=1)&&m.docScroll<=m.vw+1);await x.context.close()}
 // ---------------- A03 — mobil grafik etiketi sınırda
 const etiket=async(x)=>x.p.evaluate(()=>{const svgs=[...document.querySelectorAll('[data-testid=hedef-oneri] svg')].filter(s=>{const r=s.getBoundingClientRect();return r.width>0&&getComputedStyle(s).display!=='none'});return svgs.map(s=>{const vb=s.viewBox.baseVal;const texts=[...s.querySelectorAll('text')].filter(t=>/%\d/.test(t.textContent)&&(t.getAttribute('font-weight')==='700'));const diger=[...s.querySelectorAll('text')].filter(t=>!texts.includes(t)).map(t=>t.getBBox());const cakisma=texts.some(t=>{const a=t.getBBox();return diger.some(b=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y+3<b.y+b.height&&b.y+3<a.y+a.height)});return {vbW:vb.width,vbH:vb.height,cakisma,etiketler:texts.map(t=>{const b=t.getBBox();return {t:t.textContent,x0:Math.round(b.x*10)/10,x1:Math.round((b.x+b.width)*10)/10,y0:Math.round(b.y*10)/10,y1:Math.round((b.y+b.height)*10)/10}})}})});
 for(const w of [390,320])for(const lang of ['tr','en'])for(const v of ['0','98','100']){const x=await setup({profile:'UNIT_MANAGER',handler:async({q,send})=>{if(/targets\?preview=1/.test(q)){await send(PREVIEW);return true}}});await x.p.setViewportSize({width:w,height:844});await x.go('/t/t/hedefler');await x.p.waitForTimeout(600);if(lang==='en')await toEN(x);
  await x.p.locator('#item').selectOption('M01');await x.p.locator('#val').fill(v);await x.p.getByRole('button',{name:lang==='en'?'See proposal':'Öneriyi gör',exact:true}).click();await x.p.waitForTimeout(700);const e=await etiket(x);
  if(w===390&&lang==='tr')await x.p.locator('[data-testid=hedef-oneri]').screenshot({path:path.join(OUT,`a03-grafik-390-tr-${v}.png`)});
  const g=e[0];const icinde=!!g&&g.etiketler.length>=2&&g.etiketler.every(t=>t.x0>=0&&t.x1<=g.vbW&&t.y0>=0&&t.y1<=g.vbH);
  // etiketler birbirine ve eksen yazılarına binmesin: iki değer etiketi dikey olarak ayrık
  const ayrik=!!g&&g.etiketler.length>=2&&(g.etiketler[0].y1<=g.etiketler[1].y0||g.etiketler[1].y1<=g.etiketler[0].y0);
  rec(`A03-ETIKET-${w}-${lang.toUpperCase()}-${v}`,{gorunen:e.length,...(g||{})},e.length===1&&icinde&&ayrik&&g.cakisma===false);await x.context.close()}
 {const x=await setup({profile:'UNIT_MANAGER',handler:async({q,send})=>{if(/targets\?preview=1/.test(q)){await send(PREVIEW);return true}}});await x.p.setViewportSize({width:1440,height:900});await x.go('/t/t/hedefler');await x.p.waitForTimeout(600);await x.p.locator('#item').selectOption('M01');await x.p.getByRole('button',{name:'Öneriyi gör',exact:true}).click();await x.p.waitForTimeout(700);await shot(x,'a03-hedef-1440-normal');
  const e=await etiket(x);rec('A03-MASAUSTU-NORMAL',{gorunen:e.length,vbW:e[0]?.vbW,etiketler:e[0]?.etiketler},e.length===1&&e[0].vbW===1296);await x.context.close()}
 // ---------------- A04 — kontrollü saatle gecikme
 const ACT=(cad,ws,we)=>{const slots=lib.planSlots({kind:cad},ws,we);return {...action,id:'a1',lifecycle_state:'in_progress',requirement:{...action.requirement,cadence:cad,expected:slots.length,windowStart:ws,windowEnd:we,slots},start_date:ws,due_date:we,valid_evidence:0,fulfilled_slots:0}};
 const takvim=async(x)=>x.p.evaluate(()=>{const sec=[...document.querySelectorAll('.b-row')].find(b=>/Gerçekleşme takvimi|Delivery calendar/.test(b.textContent));if(!sec)return null;const grup=[...sec.querySelectorAll('.tb-icerik > .ikili > div')];return grup.map(g=>{const cap=g.querySelector('.cap');return {ay:cap?.textContent.trim(),gecikti:!!cap&&cap.classList.contains('red'),kare:g.querySelectorAll('.kare .sw').length}})});
 const durumlar=[
  ['A04-WEEKLY-KISMI-SONRA','weekly','2026-01-08','2026-01-10','2026-01-11T12:00:00Z',[true]],
  ['A04-WEEKLY-KISMI-SONGUN','weekly','2026-01-08','2026-01-10','2026-01-10T12:00:00Z',[false]],
  ['A04-WEEKLY-KISMI-TAM-SINIR','weekly','2026-01-08','2026-01-10','2026-01-11T00:00:01Z',[true]],
  ['A04-BIWEEKLY-KISMI','biweekly','2026-01-01','2026-01-05','2026-01-06T12:00:00Z',[true]],
  ['A04-BIWEEKLY-SONGUN','biweekly','2026-01-01','2026-01-05','2026-01-05T23:00:00Z',[false]],
  ['A04-MONTHLY-KISMI','monthly','2026-01-01','2026-01-20','2026-01-21T09:00:00Z',[true]],
  ['A04-MONTHLY-SONGUN','monthly','2026-01-01','2026-01-20','2026-01-20T22:00:00Z',[false]],
  ['A04-QUARTERLY-KISMI','quarterly','2026-01-01','2026-02-15','2026-02-16T09:00:00Z',[true]],
  ['A04-QUARTERLY-SONGUN','quarterly','2026-01-01','2026-02-15','2026-02-15T20:00:00Z',[false]],
  ['A04-ONCE-SONGUN','once','2026-01-01','2026-03-31','2026-03-31T12:00:00Z',[false]],
  ['A04-ONCE-SONRA','once','2026-01-01','2026-03-31','2026-04-01T00:00:01Z',[true]],
  ['A04-MONTHLY-DOGAL','monthly','2026-01-01','2026-03-31','2026-02-10T12:00:00Z',[true,false,false]],
  ['A04-YIL-GECISI-W53','weekly','2026-12-31','2027-01-03','2027-01-01T12:00:00Z',[true,false]],
  ['A04-YIL-GECISI-F27','biweekly','2026-12-31','2027-01-20','2027-01-01T12:00:00Z',[true,false]],
  ['A04-YIL-GECISI-ARALIK-SONGUN','weekly','2026-12-31','2027-01-03','2026-12-31T23:00:00Z',[false,false]],
 ];
 for(const [id,cad,ws,we,saat,bek] of durumlar){const A=ACT(cad,ws,we);const x=await setup({profile:'UNIT_MANAGER',handler:async({q,send})=>{if(/\/actions\/a1$/.test(q)){await send({...A,evidence:[],verification:{state:'pending',decision_reason:null},validCount:0,fulfilledSlotCount:0,fulfilled_slots:0,eventCount:0,expectedSlotCount:A.requirement.expected,slotReviewNeeded:false});return true}if(q.startsWith('/api/t/t/actions')){await send([A]);return true}}});
  await x.p.clock.setFixedTime(new Date(saat));await x.go('/t/t/aksiyonlar');await x.p.waitForTimeout(600);await x.p.locator('button.kucukbtn',{hasText:'Aksiyonu aç'}).first().click();await x.p.waitForTimeout(700);
  const t=await takvim(x);if(id==='A04-WEEKLY-KISMI-SONRA')await shot(x,'a04-weekly-kismi-sonra-1440');const gec=(t||[]).map(g=>g.gecikti);
  rec(id,{saat,slots:A.requirement.slots,takvim:t,beklenen:bek},!!t&&JSON.stringify(gec)===JSON.stringify(bek));await x.context.close()}
 await browser.close();fs.writeFileSync(path.join(OUT,'olcum.json'),JSON.stringify(R,null,2));console.log('TOPLAM',R.length,'BAŞARISIZ',R.filter(r=>!r.pass).length);})().catch(e=>{console.error(e);process.exit(2)});
