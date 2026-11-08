// Bağımsız denetçinin edge.cjs (R01-R03) betiğini değiştirmeden çalıştırır
const {execFileSync}=require('child_process'),path=require('path');const root=path.resolve(__dirname,'../../../..');const OUT=process.env.OUT||path.join(root,'docs/test-ciktilari/fe');
const env={...process.env,PW_MODULE:process.env.PW_MODULE||'/home/claude/.npm-global/lib/node_modules/playwright',FE_HARNESS:path.join(root,'tools/tests/fe/harness.cjs'),WEB_DIST:process.env.WEB_DIST||path.join(root,'apps/web/dist'),OUT};
execFileSync(process.execPath,[path.join(__dirname,'edge.cjs')],{stdio:'inherit',env});
