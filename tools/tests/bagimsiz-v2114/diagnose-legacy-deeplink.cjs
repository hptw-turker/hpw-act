// Diagnostic only: keep the original ui-audit.cjs file unchanged.
// Reuse its exact setup/fixtures, measure its immediate count, then await visibility.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.join(process.env.HPW_SOURCE,'tools/tests/fe/ui-audit.cjs');
const original=fs.readFileSync(file,'utf8');
const prefix=original.slice(0,original.indexOf('// 8 roles:'));
const suffix=`
const x=await setup();
const start=performance.now();await x.go('/t/t/aksiyonlar?unit=u1&cycle=c1&sel=a1');
const afterGo=performance.now()-start;
const button=x.p.getByRole('button',{name:'Kaydı ekle',exact:true});
const immediateCount=await button.count();
let visible=false,error=null;
try {await button.waitFor({state:'visible',timeout:3000});visible=true;} catch(e){error=String(e);}
const afterVisible=performance.now()-start;
const result={mode:'diagnostic only; original 250ms setup then condition wait; unchanged fixtures',immediateCount,afterGoMs:afterGo,visible,afterVisibleMs:afterVisible,error,errors:x.errors,requests:x.requests};
fs.writeFileSync(OUT+'/result.json',JSON.stringify(result,null,2));
await x.p.screenshot({path:OUT+'/visible.png',fullPage:true});
console.log(JSON.stringify({...result,requests:result.requests.length}));
await browser.close();
})().catch(e=>{console.error(e);process.exitCode=2});`;
const child=new Module(file,module);child.filename=file;child.paths=Module._nodeModulePaths(path.dirname(file));
child._compile(prefix+suffix,file);
