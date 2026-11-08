// Tanı: V2100-URL senaryosunun WebKit'teki "Page crashed" hatası. Özgün test DEĞİŞTİRİLMEZ; bu betik aynı adımları aynı fikstürle,
// ek kayıtlarla (konsol, sayfa hatası, çökme olayı, ağ, gezinme, bellek) ve adım adım bölerek tekrarlar. Kontrollü HTTP (düzenek) modu.
process.env.WEB_DIST = process.env.WEB_DIST || '/home/claude/hpw-act/apps/web/dist';
const fs = require('node:fs'), path = require('node:path');
const PW = require(process.env.PW_MODULE || '/home/claude/.npm-global/lib/node_modules/playwright');
const H = require(path.resolve(__dirname, '../harness.cjs'));
const src = fs.readFileSync(path.resolve(__dirname, '../ui-regresyon.cjs'), 'utf8');
const grab = n => { const i = src.indexOf(`const ${n}=`); return src.slice(i, src.indexOf('\n', i)); };
eval(grab('PF').replace('const PF=', 'global.PF=')); eval(grab('SUM').replace('const SUM=', 'global.SUM=')); eval(grab('T1').replace('const T1=', 'global.T1='));
const many = Array.from({ length: 30 }, (_, i) => ({ ...T1, id: '00000000-0000-4000-8000-' + String(i).padStart(12, '0'), code: 'C' + String(i).padStart(2, '0'), name: 'Şirket ' + String(i).padStart(2, '0'), status: i % 5 === 0 ? 'suspended' : 'active', summary: SUM({ onboarding: { done: i % 10, total: 10, firstOpen: 'hpw_owner' }, primaryConsultant: i % 2 ? 'Ayşe' : 'Mehmet', trackedCycle: null, cycleBound: 'no_tracked_cycle', counts: { overdueActions: null, actions: null, awaitingVerification: null, targets: null } }) }));
const OUT = process.env.OUT || '/tmp/webkit-tani'; fs.mkdirSync(OUT, { recursive: true });
const d = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const engine = process.env.ENGINE || 'webkit'; const b = await PW[engine].launch({ headless: true }); const setup = H.makeSetup(b); const report = { engine, version: b.version(), launch: { headless: true }, runs: [] };
  // adımlar; her koşu i. adımdan sonra yeniden yükler (bölme/bisection)
  const steps = [['sirala=kod', x => x.p.locator('#f-sirala').selectOption('kod')], ['yon=azalan', x => x.p.locator('#f-yon').selectOption('azalan')], ['sonraki sayfa', x => x.p.getByRole('button', { name: 'Sonraki sayfa' }).click()], ['geri', x => x.p.goBack()], ['ileri', x => x.p.goForward()]];
  for (let upto = 0; upto <= steps.length; upto++) {
    const log = []; const x = await setup({ platform: true, handler: async ({ q, send }) => { if (q === '/api/platform/portfolio') { await send(PF(many)); return true; } } });
    x.p.on('console', m => log.push(['console', m.type(), m.text().slice(0, 200)])); x.p.on('pageerror', e => log.push(['pageerror', String(e).slice(0, 300)])); x.p.on('crash', () => log.push(['CRASH', new Date().toISOString()]));
    x.p.on('framenavigated', f => { if (f === x.p.mainFrame()) log.push(['nav', f.url().split('#')[1] ?? f.url()]); }); x.p.on('requestfailed', r => log.push(['reqfail', r.url().slice(-80), r.failure()?.errorText]));
    let result = 'ok'; try {
      await x.go('/platform'); await d(500); for (const [n, fn] of steps.slice(0, upto)) { await fn(x); log.push(['adım', n]); await d(250); }
      const mem = await x.p.evaluate(() => ({ nodes: document.getElementsByTagName('*').length, hist: history.length })).catch(e => String(e)); log.push(['öncesi', mem]);
      await x.p.reload(); await d(700); log.push(['sonra', x.p.url().split('#')[1]]);
    } catch (e) { result = String(e).split('\n')[0]; }
    report.runs.push({ steps: steps.slice(0, upto).map(s => s[0]), result, log }); console.log(`[${engine}] adım≤${upto} (${steps.slice(0, upto).map(s => s[0]).join(' → ') || 'yok'}) → ${result}`);
    await x.context.close().catch(() => null);
  }
  fs.writeFileSync(path.join(OUT, `tani-${engine}.json`), JSON.stringify(report, null, 2)); await b.close();
})();
