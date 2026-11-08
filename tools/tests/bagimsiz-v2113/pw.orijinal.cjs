const path=require('node:path');
const pw=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
module.exports={...pw,chromium:{...pw.chromium,launch:async opts=>pw.chromium.launch({...opts,executablePath:path.join(__dirname,'browser/chromium'),args:['--no-sandbox','--no-zygote','--disable-gpu','--disable-software-rasterizer']})}};
