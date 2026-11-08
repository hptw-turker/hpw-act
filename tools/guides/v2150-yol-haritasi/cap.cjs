const { chromium, devices } = require('playwright'); const fs = require('fs');
const B='http://127.0.0.1:8787'; const OUT=process.env.OUT||'/tmp/hpw-guide-shots';
const SPEC = JSON.parse(fs.readFileSync(''+__dirname+'/spec.json','utf8'));
const only = process.argv.slice(2);
async function box(p, s) { const [sel, i] = Array.isArray(s) ? s : [s, 0]; const l = p.locator(sel).nth(i); await l.scrollIntoViewIfNeeded({timeout:5000}).catch(()=>{}); const b = await l.boundingBox(); if (!b) throw new Error('no box '+sel); const sy = await p.evaluate(()=>window.scrollY); const sx = await p.evaluate(()=>window.scrollX); return { x: b.x+sx, y: b.y+sy, w: b.width, h: b.height }; }
(async () => { const br = await chromium.launch(); const meta = {};
  for (const sh of SPEC) { if (only.length && !only.includes(sh.name)) continue;
    const opt = sh.mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
    const ctx = await br.newContext(opt); await ctx.addInitScript(l => { try { localStorage.setItem('hpwact.lang', l); } catch {} }, sh.lang || 'tr');
    await ctx.request.post(B+'/api/auth/login', { data: { email: sh.user+'@saha.demo.hpw-act.local', password: 'Demo-Kullanici-2026' } }); const me = await (await ctx.request.get(B+'/api/auth/me')).json();
    const p = await ctx.newPage(); await p.goto(`${B}/app.html#/t/${me.tenantId}/${sh.path}`); await p.waitForLoadState('networkidle'); await p.waitForTimeout(900);
    for (const c of sh.click || []) { await p.locator(c).first().click(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(900); }
    await p.evaluate(()=>window.scrollTo(0,0));
    // marks
    const marks = []; for (const m of sh.marks || []) marks.push(await box(p, m));
    let r;
    if (sh.region.top) { const t = await box(p, sh.region.to); r = { x: 0, y: 0, w: opt.viewport ? opt.viewport.width : 390, h: t.y+t.h+16 }; }
    else { const a = await box(p, sh.region.from); const z = sh.region.to ? await box(p, sh.region.to) : a; const pad = sh.region.pad ?? 16; const x0 = Math.min(a.x, z.x) - pad, y0 = a.y - pad, x1 = Math.max(a.x+a.w, z.x+z.w) + pad, y1 = z.y+z.h+pad; r = { x: Math.max(0,x0), y: Math.max(0,y0), w: x1-Math.max(0,x0), h: y1-Math.max(0,y0) }; if (sh.region.full) { r.x = 0; r.w = await p.evaluate(()=>document.documentElement.clientWidth); } }
    await p.evaluate(ms => { ms.forEach((b, i) => { const d = document.createElement('div'); d.textContent = String(i+1); d.style.cssText = `position:absolute;left:${Math.max(2,b.x-10)}px;top:${Math.max(2,b.y-10)}px;min-width:22px;height:20px;padding:0 4px;background:#CF051E;color:#fff;font:700 13px/20px Poppins,Arial;text-align:center;z-index:99999;box-sizing:border-box`; document.body.appendChild(d); }); }, marks);
    console.error(sh.name, JSON.stringify(r)); await p.screenshot({ path: `${OUT}/${sh.name}.png`, clip: { x: r.x, y: r.y, width: r.w, height: r.h }, fullPage: true });
    meta[sh.name] = { n: marks.length, w: r.w, h: r.h }; console.log(sh.name, marks.length, Math.round(r.w), Math.round(r.h)); await ctx.close(); }
  fs.writeFileSync(OUT+'/meta'+(only.length?'-part':'')+'.json', JSON.stringify(meta,null,1)); await br.close(); })();
