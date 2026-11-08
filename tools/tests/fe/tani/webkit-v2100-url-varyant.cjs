// Tanı: çökme tetikleyicisini daraltma (kontrollü HTTP). Her varyant ayrı bağlamda; ürün dosyası değiştirilmez, yalnız sayfaya tanı betiği enjekte edilebilir.
process.env.WEB_DIST = process.env.WEB_DIST || '/home/claude/hpw-act/apps/web/dist';
const fs = require('node:fs'), path = require('node:path'); const PW = require('/home/claude/.npm-global/lib/node_modules/playwright'); const H = require(path.resolve(__dirname, '../harness.cjs'));
const src = fs.readFileSync(path.resolve(__dirname, '../ui-regresyon.cjs'), 'utf8'); const grab = n => { const i = src.indexOf(`const ${n}=`); return src.slice(i, src.indexOf('\n', i)); };
eval(grab('PF').replace('const PF=', 'global.PF=')); eval(grab('SUM').replace('const SUM=', 'global.SUM=')); eval(grab('T1').replace('const T1=', 'global.T1='));
const mk = n => Array.from({ length: n }, (_, i) => ({ ...T1, id: '00000000-0000-4000-8000-' + String(i).padStart(12, '0'), code: 'C' + String(i).padStart(2, '0'), name: 'Şirket ' + i, summary: SUM({ onboarding: { done: 1, total: 10, firstOpen: 'hpw_owner' }, primaryConsultant: 'A', trackedCycle: null, cycleBound: 'no_tracked_cycle', counts: { overdueActions: null, actions: null, awaitingVerification: null, targets: null } }) }));
const d = ms => new Promise(r => setTimeout(r, ms)); const OUT = process.env.OUT || '/tmp/webkit-tani'; fs.mkdirSync(OUT, { recursive: true });
(async () => { const b = await PW[process.env.ENGINE || 'webkit'].launch({ headless: true }); const setup = H.makeSetup(b); const res = [];
  const V = [
    ['30 şirket: sıralama → geri → yenile', 30, null, async x => { await x.p.locator('#f-sirala').selectOption('kod'); await d(300); await x.p.goBack(); }],
    ['30 şirket: sonraki sayfa → geri → yenile', 30, null, async x => { await x.p.getByRole('button', { name: 'Sonraki sayfa' }).click(); await d(300); await x.p.goBack(); }],
    ['3 şirket: sıralama → geri → yenile', 3, null, async x => { await x.p.locator('#f-sirala').selectOption('kod'); await d(300); await x.p.goBack(); }],
    ['30 şirket: sonraki sayfa → geri → yenile; sessionStorage yazımı etkisiz (tanı)', 30, () => { Storage.prototype.setItem = function () {}; }, async x => { await x.p.getByRole('button', { name: 'Sonraki sayfa' }).click(); await d(300); await x.p.goBack(); }],
    ['30 şirket: sonraki sayfa → geri → 2 sn bekle → yenile', 30, null, async x => { await x.p.getByRole('button', { name: 'Sonraki sayfa' }).click(); await d(300); await x.p.goBack(); await d(2000); }],
    ['30 şirket: sonraki sayfa → geri → yeni adrese git (goto) ', 30, null, async x => { await x.p.getByRole('button', { name: 'Sonraki sayfa' }).click(); await d(300); await x.p.goBack(); await d(300); await x.p.goto(x.p.url()); }],
  ];
  for (const [label, n, init, fn] of V) { const x = await setup({ platform: true, handler: async ({ q, send }) => { if (q === '/api/platform/portfolio') { await send(PF(mk(n))); return true; } } }); if (init) await x.p.addInitScript(init);
    let r = 'ok'; try { await x.go('/platform'); await d(500); await fn(x); await d(200); if (!label.includes('goto')) await x.p.reload(); await d(600); } catch (e) { r = String(e).split('\n')[0]; } res.push({ label, result: r }); console.log(label, '→', r); await x.context.close().catch(() => null); }
  fs.writeFileSync(path.join(OUT, `varyant-${process.env.ENGINE || 'webkit'}.json`), JSON.stringify(res, null, 2)); await b.close(); })();
