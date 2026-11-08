import fs from 'node:fs';import {check} from '../../../../apps/api/scripts/contract-verify.mts';
const s=JSON.parse(fs.readFileSync(new URL('../../../../apps/api/src/contract/responses.json', import.meta.url),'utf8'));
const cases=[
 {id:'LAST-LOGIN-VALID-DATE',schema:s['GET /api/t/:tid/users'].items.properties.last_login_at,value:'2026-09-27T03:00:00.000Z',expected:'accept'},
 {id:'CANCEL-REASON-VALID-TEXT',schema:s['GET /api/t/:tid/actions/:aid'].properties.cancel_reason,value:'İhtiyaç ortadan kalktı',expected:'accept'},
 {id:'READY-REASONS-OBJECT',schema:s['GET /api/ready'].properties.reasons.items,value:{unexpected:true},expected:'reject'}
];const out=cases.map(c=>({...c,error:check(c.value,c.schema),pass:(check(c.value,c.schema)===null)===(c.expected==='accept')}));
const OUT=process.env.OUT||'docs/test-ciktilari/fe';fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(OUT+'/contract-edge-results.json',JSON.stringify(out,null,2));const bad=out.filter(x=>!x.pass);console.log('CONTRACT-EDGE',out.length,'BAŞARISIZ',bad.length,bad.map(x=>x.id).join(','));process.exit(bad.length?1:0);
