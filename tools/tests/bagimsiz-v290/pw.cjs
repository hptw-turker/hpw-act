const fs=require('fs');
const mod=process.env.PLAYWRIGHT_MODULE||(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const pw=require(mod),launch=pw.chromium.launch.bind(pw.chromium);
let extra={};
if(process.env.CHROMIUM_PATH){extra={executablePath:process.env.CHROMIUM_PATH,args:JSON.parse(process.env.CHROMIUM_ARGS||'[]')}}
else if(fs.existsSync('/workspace/scratch/65494bb393f9/audit/harness/browser/chromium')){
 const c=require('/workspace/scratch/65494bb393f9/audit/harness/node_modules/@sparticuz/chromium/build/index.js');
 extra={executablePath:'/workspace/scratch/65494bb393f9/audit/harness/browser/chromium',args:c.args};
}
pw.chromium.launch=opts=>launch({...opts,...extra});module.exports=pw;
