import fs from 'node:fs';import {check} from '../../../../apps/api/scripts/contract-verify.mts';
const s=JSON.parse(fs.readFileSync(new URL('../../../../apps/api/src/contract/responses.json', import.meta.url),'utf8'));
const cases=[
{id:'FOLLOWUP-CYCLE',schema:s['GET /api/t/:tid/cycles/:cid/units/:uid/targets'].items.properties.measurement_plan.properties.followupCycleCode,value:'2027-ANA',expected:'accept'},
{id:'AGGREGATE-DERIVED',schema:s['GET /api/t/:tid/cycles/:cid/units/:uid/aggregates'].properties.aggregates.items.properties.derivedEstimate,value:{value:65,members:3,label:'derived_estimate',note:'madde ortalaması; resmî HPW sonucu değildir'},expected:'accept'},
{id:'RESULT-INVALID-STATUS',schema:s['GET /api/t/:tid/cycles/:cid/units/:uid/results'].properties.rows.items.properties.status,value:'not_a_real_status',expected:'reject'},
{id:'LEVER-TAGS-TEXT-ARRAY',schema:s['POST /api/t/:tid/cycles/:cid/units/:uid/targets'].properties.lever_tags,value:['communication'],expected:'accept'}
];const out=cases.map(c=>({...c,error:check(c.value,c.schema),pass:(check(c.value,c.schema)===null)===(c.expected==='accept')}));const OUT=process.env.OUT||'docs/test-ciktilari/fe';fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(OUT+'/contract-remaining-results.json',JSON.stringify(out,null,2));const bad=out.filter(x=>!x.pass);console.log('CONTRACT-REMAINING',out.length,'BAŞARISIZ',bad.length,bad.map(x=>x.id).join(','));process.exit(bad.length?1:0);
