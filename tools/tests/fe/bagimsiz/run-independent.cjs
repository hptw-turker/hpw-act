// Bağımsız denetçinin independent.cjs betiğini değiştirmeden çalıştırır; üç sonucun da pass=true ve harnessError olmaması gerekir
const {execFileSync}=require('child_process'),fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'../../../..');const OUT=process.env.OUT||path.join(root,'docs/test-ciktilari/fe');
const env={...process.env,PW_MODULE:process.env.PW_MODULE||'/home/claude/.npm-global/lib/node_modules/playwright',FE_HARNESS:path.join(root,'tools/tests/fe/harness.cjs'),FE_RULES:path.join(root,'tools/tests/fe/rules.json'),WEB_DIST:process.env.WEB_DIST||path.join(root,'apps/web/dist'),OUT};
execFileSync(process.execPath,[path.join(__dirname,'independent.cjs')],{stdio:'inherit',env});const r=JSON.parse(fs.readFileSync(path.join(OUT,'independent-results.json'),'utf8'));
const bad=r.filter(x=>x.pass!==true||x.harnessError);console.log('BAĞIMSIZ',r.length,'kontrol;',r.length-bad.length,'geçti',bad.map(x=>x.id).join(','));process.exit(bad.length?1:0);
