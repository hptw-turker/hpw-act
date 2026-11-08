// Tanı: üründen bağımsız en küçük sayfa — karma adresle N geçmiş girişi, geri, yeniden yükle. Ürün kodu yok.
const PW = require('/home/claude/.npm-global/lib/node_modules/playwright'); const d = ms => new Promise(r => setTimeout(r, ms));
(async () => { const b = await PW[process.env.ENGINE || 'webkit'].launch({ headless: true });
  for (const [label, n, big] of [['3 giriş, küçük DOM', 3, 0], ['3 giriş, 500 düğüm', 3, 500], ['4 giriş, 500 düğüm', 4, 500], ['4 giriş, 2000 düğüm', 4, 2000]]) {
    const c = await b.newContext(); await c.route('https://tani.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: `<html><body><div id="k"></div><script>window.addEventListener('hashchange',()=>{const k=document.getElementById('k');k.innerHTML='';for(let i=0;i<${big};i++){const e=document.createElement('div');e.textContent='satır '+i+' '+location.hash;k.appendChild(e)}})</script></body></html>` }));
    const p = await c.newPage(); let r = 'ok'; try { await p.goto('https://tani.test/app.html#/a'); for (let i = 1; i <= n; i++) { await p.evaluate(i => { location.hash = '/a?s=' + i; }, i); await d(150); } await p.goBack(); await d(200); await p.reload(); await d(300); } catch (e) { r = String(e).split('\n')[0]; }
    console.log(label, '→', r); await c.close().catch(() => null); }
  await b.close(); })();
