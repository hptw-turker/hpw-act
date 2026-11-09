// v3.0.0 (ADR-0043) arayüz kabulü — kontrollü HTTP, sentetik veri. Bugün listesi, işaretleme (zarf ve geri bildirim), iki bölmeli planlar,
// atıf satırının salt okunurluğu, telefonda liste→ayrıntı, yatay kaydırma yok, EN dili, şirkete özel giriş. Çıktı: OUT/v300-arayuz.json
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || process.env.PW_MODULE || '/home/claude/.npm-global/lib/node_modules/playwright'); const fs = require('fs'); const path = require('path');
const DIST = path.resolve(process.env.WEB_DIST || 'apps/web/dist'); const OUT = path.resolve(process.env.OUT || 'docs/test-ciktilari/fe'); fs.mkdirSync(OUT, { recursive: true });
const T = '2026-12-20';
const plan = (no, kind) => ({ id: `p${no}`, no, title: `Plan başlığı ${no}`, itemCode: `wp0${no}`, itemText: `Madde metni ${no}.`, respondents: 29, currentPos: 9, currentPct: 31, comparisonPct: 58, targetKind: kind, targetPos: kind === 'HEDEF' ? 11 : null, targetPct: kind === 'HEDEF' ? 37.9 : null, responsibility: 'İşletme yönetimi', impact: null });
const step = (id, o) => ({ id, role: 'YONETIM', roleLabel: 'Örnek Otel Yönetimi', phaseDays: 30, ord: 1, text: `Adım ${id}.`, output: `Çıktı ${id}.`, contribution: null, dueDate: '2026-12-16', status: 'LATE', note: null, statusAt: null, updatedBy: null, version: 1, canMark: true, ref: null, ...o });
function data() {
  const s1 = step('s1', {}), s2 = step('s2', { phaseDays: 90, dueDate: '2027-02-14', status: 'OPEN' }), s3 = step('s3', { status: 'DONE', statusAt: '2026-12-01', updatedBy: 'Müdür Bir', note: 'Toplantı yapıldı' });
  const ref = step('r1', { role: 'IK', roleLabel: 'Örnek İK', text: 'Kurum planı 1 · İK · İlk 30 gün · Analiz', canMark: false, status: 'DONE', statusAt: '2026-11-30', ref: { label: 'Kurum planı 1 · İK · İlk 30 gün · Analiz', text: 'Analizi başlatmak.', output: 'Form ulaştı.' } });
  const emp = step('e1', { role: 'CALISAN', roleLabel: 'Çalışanlar', status: 'INFO', canMark: false, contribution: 'Katkı.' });
  const meta = { roadmapId: 'rm1', layer: 'ISLETME', unitCode: 'U1', unitLabel: 'Örnek Otel' };
  return { me: { today: T, counts: { total: 3, done: 1, late: 1, open: 1 }, steps: [{ ...s1, ...meta, plan: plan(1, 'HEDEF') }, { ...s2, ...meta, plan: plan(2, 'IZLENIR') }, { ...s3, ...meta, plan: plan(1, 'HEDEF') }] },
    list: (n) => ({ today: T, roadmaps: [{ id: 'rm0', layer: 'KURUM', unitCode: 'KOK', unitLabel: 'Örnek Grup', respondents: 100, cycleCode: '2026-ANA', reportTitle: 'Örnek 2026 Raporu', headline: 'Ana sonuç.', startDate: '2026-11-16', measurePeriod: '2027 ölçümü', plans: 1, targets: 1, ik: { total: 2, done: 1, late: 0 }, management: { total: 1, done: 0, late: 1 }, nextDue: '2027-02-14' },
      { id: 'rm1', layer: 'ISLETME', unitCode: 'U1', unitLabel: 'Örnek Otel', respondents: 29, cycleCode: '2026-ANA', reportTitle: 'Örnek 2026 Raporu', headline: 'Otel sonucu.', startDate: '2026-11-16', measurePeriod: '2027 ölçümü', plans: 2, targets: 1, ik: { total: 1, done: 0, late: 0 }, management: { total: 3, done: 1, late: 1 }, nextDue: '2027-02-14' }].slice(0, n) }),
    detail: { id: 'rm1', status: 'active', layer: 'ISLETME', unitCode: 'U1', unitLabel: 'Örnek Otel', respondents: 29, comparisonLabel: 'Grup geneli', headline: 'Otel sonucu.', summary: 'Özet.', reportTitle: 'Örnek 2026 Raporu', cycleCode: '2026-ANA', startDate: '2026-11-16', measurePeriod: '2027 ölçümü', today: T, rights: { IK: false, YONETIM: true },
      plans: [{ ...plan(1, 'HEDEF'), steps: [s1, s3, ref, emp] }, { ...plan(2, 'IZLENIR'), steps: [s2] }], items: [{ ord: 1, itemCode: 'wp01', itemText: 'Madde metni 1.', link: 'Eylem planı 1', currentPct: 31, comparisonPct: 58, sectorPct: 60, target: '%37,9' }] } };
}
const results = []; const ok = (id, pass, info) => { results.push({ id, pass: !!pass, info }); console.log(id, pass ? 'PASS' : 'FAIL', JSON.stringify(info ?? {})); };
async function setup(browser, { profile = 'UNIT_MANAGER', roadmaps = 1, phone = false, lang = 'tr', logged = true } = {}) {
  const ctx = await browser.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); const errors = []; const posts = []; p.on('pageerror', e => errors.push(e.message));
  await ctx.addInitScript(l => { try { localStorage.setItem('hpwact.lang', l); } catch (e) { /* yok */ } }, lang);
  const D = data();
  await ctx.route('https://v3.test/**', async rt => { const req = rt.request(); const u = new URL(req.url()); const q = u.pathname; const send = (d, s = 200) => rt.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });
    if (!q.startsWith('/api/')) { const f = path.join(DIST, q === '/' ? 'app.html' : q); return fs.existsSync(f) && fs.statSync(f).isFile() ? rt.fulfill({ path: f }) : rt.fulfill({ path: path.join(DIST, 'app.html') }); }
    if (q === '/api/public/app') return send({ mode: 'v3' });
    if (q === '/api/public/tenant/ORNEK') return send({ code: 'ORNEK', name: 'Örnek Grup' });
    if (q === '/api/auth/me') return logged ? send({ userId: 'u1', email: 'mudur@ornek.test', displayName: 'Müdür Bir', realm: 'customer', tenantId: 't1', profile, companyWide: false, memberships: [{ tenant_id: 't1', tenant_name: 'Örnek Grup', tenant_code: 'ORNEK' }] }) : send({ error: 'unauthorized', message: 'Oturum yok' }, 401);
    if (q === '/api/t/t1/overview') return send({ tenant: { name: 'Örnek Grup', code: 'ORNEK' }, principal: { profile, companyWide: false } });
    if (q === '/api/t/t1/rm2/me') return send(D.me);
    if (q === '/api/t/t1/rm2') return send(D.list(roadmaps));
    if (/^\/api\/t\/t1\/rm2\/rm[01]$/.test(q)) return send(D.detail);
    if (q.startsWith('/api/t/t1/rm2-steps/') && req.method() === 'POST') { const b = JSON.parse(req.postData() || '{}'); posts.push({ q, b, key: req.headers()['idempotency-key'] }); const st = D.me.steps.find(s => q.endsWith('/' + s.id)); if (st) { st.status = b.done ? 'DONE' : 'OPEN'; st.version++; } return send({ id: 's1', status: b.done ? 'DONE' : 'OPEN', note: b.note ?? null, version: 2, statusAt: T }); }
    if (q === '/api/auth/login') { const b = JSON.parse(req.postData() || '{}'); posts.push({ q, b }); return send({ ok: true, realm: 'customer', memberships: [{ tenant_id: 't1', name: 'Örnek Grup', code: 'ORNEK' }] }); }
    return send({ error: 'not_found' }, 404); });
  return { ctx, p, errors, posts };
}
const noHScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
(async () => {
  const b = await chromium.launch();
  { const { ctx, p, errors, posts } = await setup(b); await p.goto('https://v3.test/app.html#/t/t1'); await p.getByRole('heading', { name: 'Bugün yapılacaklar' }).waitFor();
    const groups = await p.locator('.v-group h2').allInnerTexts(); ok('V3UI-01-BUGUN-GRUPLAR', groups[0].startsWith('Geciken adımlar') && groups.some(g => g.includes('14.02.2027 tarihine kadar')) && groups.some(g => g.startsWith('Yapılanlar')), { groups });
    const late = p.locator('article.v-step').first(); await late.getByRole('button', { name: 'Not ekle' }).click(); await late.locator('textarea').fill('Liste iletildi'); await late.getByRole('button', { name: 'Yapıldı olarak işaretle' }).click();
    await late.getByRole('button', { name: 'Yapılmadı olarak geri al' }).waitFor(); const post = posts.find(x => x.q.endsWith('/s1'));
    ok('V3UI-02-ISARETLE-ZARF', post && post.b.done === true && post.b.note === 'Liste iletildi' && post.b.expectedVersion === 1 && !!post.key, post);
    ok('V3UI-03-KART-YERINDE', (await p.locator('.v-group').first().locator('h2').innerText()).startsWith('Geciken adımlar') && (await p.locator('article.v-step').first().innerText()).includes('Adım s1.'), {});
    ok('V3UI-04-HATA-YOK', errors.length === 0, { errors }); await ctx.close(); }
  { const { ctx, p, errors } = await setup(b); await p.goto('https://v3.test/app.html#/t/t1/planlar'); await p.locator('.v-plancard').first().waitFor();
    const txt = await p.locator('main').innerText(); ok('V3UI-05-TEK-YOL-HARITASI', (await p.locator('.v-left').count()) === 0 && txt.includes('Grup geneli') && txt.includes('%37,9') && txt.includes('9/29 olumlu yanıttan 11/29 olumlu yanıta'), {});
    await p.getByRole('button', { name: 'Diğer rollerin adımlarını göster' }).first().click();
    const refCard = p.locator('article.v-step', { hasText: 'Analizi başlatmak.' }); ok('V3UI-06-ATIF-SALT-OKUNUR', (await refCard.count()) === 1 && (await refCard.getByRole('button').count()) === 0 && (await refCard.innerText()).includes('Kurum adımı yapıldı'), {});
    const empCard = p.locator('article.v-step', { hasText: 'Adım e1.' }); ok('V3UI-07-CALISAN-BILGI', (await empCard.getByRole('button').count()) === 0 && (await empCard.innerText()).includes('Bilgi için'), {});
    ok('V3UI-08-HATA-YOK', errors.length === 0, { errors }); await ctx.close(); }
  { const { ctx, p } = await setup(b, { profile: 'HR_ADMIN', roadmaps: 2, phone: true }); await p.goto('https://v3.test/app.html#/t/t1/planlar'); await p.locator('.v-left').waitFor();
    const listOnly = await p.locator('.v-right').isHidden(); await p.locator('.v-it', { hasText: 'Örnek Otel' }).click(); await p.locator('.v-plancard').first().waitFor();
    ok('V3UI-09-TELEFON-LISTE-AYRINTI', listOnly && await p.locator('.v-left').isHidden() && await p.getByRole('button', { name: 'Listeye dön' }).isVisible(), {});
    ok('V3UI-10-YATAY-KAYDIRMA-YOK', await noHScroll(p), {}); await p.goto('https://v3.test/app.html#/t/t1'); await p.getByRole('heading', { name: 'Bugün yapılacaklar' }).waitFor(); ok('V3UI-11-TELEFON-BUGUN-KAYDIRMA-YOK', await noHScroll(p), {});
    ok('V3UI-12-IK-KISILER-SEKMESI', (await p.getByRole('link', { name: 'Kişiler', exact: true }).count()) === 1, {}); await ctx.close(); }
  { const { ctx, p } = await setup(b, { profile: 'VIEWER', roadmaps: 2 }); await p.goto('https://v3.test/app.html#/t/t1'); await p.locator('.v-left').waitFor();
    ok('V3UI-13-IZLEYICI-PLANLARA', p.url().endsWith('/planlar') && (await p.getByRole('link', { name: 'Bugün' }).count()) === 0, { url: p.url() }); await ctx.close(); }
  { const { ctx, p } = await setup(b, { lang: 'en' }); await p.goto('https://v3.test/app.html#/t/t1'); await p.getByRole('heading', { name: 'To do today' }).waitFor();
    const t = await p.locator('main').innerText(); ok('V3UI-14-EN', t.includes('Overdue steps') && t.includes('31.0%') && !t.includes('Bugün yapılacaklar'), {}); await ctx.close(); }
  { const { ctx, p, posts } = await setup(b, { logged: false }); await p.goto('https://v3.test/app.html#/g/ORNEK'); await p.getByText('Örnek Grup').first().waitFor();
    await p.getByLabel('E-posta').fill('mudur@ornek.test'); await p.getByLabel('Parola', { exact: true }).fill('Parola12345'); await p.getByRole('button', { name: 'Giriş yap' }).click(); await p.waitForTimeout(500);
    const lg = posts.find(x => x.q === '/api/auth/login'); ok('V3UI-15-SIRKET-GIRISI', lg && lg.b.tenantCode === 'ORNEK' && !('code' in lg.b) && (await p.locator('input[inputmode=numeric]').count()) === 0, lg); await ctx.close(); }
  { const { ctx, p, errors } = await setup(b); await p.goto('https://v3.test/app.html#/t/t1'); await p.getByRole('heading', { name: 'Bugün yapılacaklar' }).waitFor();
    ok('V3UI-16-PLANLARIM-YOK', (await p.locator('aside.v-side').count()) === 0 && !(await p.locator('main').innerText()).includes('Planlarım') && (await p.getByRole('link', { name: 'Planlar', exact: true }).count()) === 1, {});
    const card = p.locator('article.v-step').first(); const order = await card.locator('.v-btns > a, .v-btns > button').allInnerTexts();
    ok('V3UI-17-EYLEM-SIRASI', JSON.stringify(order) === JSON.stringify(['Planı incele', 'Yapıldı olarak işaretle', 'Not ekle']) && (await card.locator('p.v-meta a').count()) === 0, { order });
    const cs = await card.getByRole('button', { name: 'Yapıldı olarak işaretle' }).evaluate(e => { const c = getComputedStyle(e); return [c.backgroundColor, c.color]; });
    const lk = await card.getByRole('link', { name: 'Planı incele' }).evaluate(e => [getComputedStyle(e).backgroundColor, e.getAttribute('href')]);
    const nt = await card.getByRole('button', { name: 'Not ekle' }).evaluate(e => { const c = getComputedStyle(e); return [c.backgroundColor, c.color]; });
    ok('V3UI-18-RENKLER', cs[0] === 'rgb(207, 5, 30)' && cs[1] === 'rgb(255, 255, 255)' && lk[0] === 'rgb(242, 193, 78)' && nt[0] === 'rgb(35, 26, 21)' && nt[1] === 'rgb(255, 255, 255)', { cs, lk, nt });
    await card.getByRole('link', { name: 'Planı incele' }).click(); await p.locator('.v-plancard').first().waitFor();
    ok('V3UI-19-PLANA-GIDER', /#\/t\/t1\/planlar\/rm1\?plan=1$/.test(p.url()), { url: p.url() });
    await p.goto('https://v3.test/app.html#/t/t1/planlar'); await p.locator('.v-plancard').first().waitFor();
    const pb = await p.locator('article.v-step').first().locator('button', { hasText: 'Yapıldı olarak işaretle' }).evaluate(e => getComputedStyle(e).backgroundColor);
    const pl = await p.locator('article.v-step').getByRole('link', { name: 'Planı incele' }).count(); const pn = await p.locator('article.v-step').first().locator('button', { hasText: 'Not ekle' }).evaluate(e => getComputedStyle(e).backgroundColor); ok('V3UI-20-PLANLAR-GENEL-DUGME-AYNI', pb === 'rgb(35, 26, 21)' && pn === 'rgb(242, 193, 78)' && pl === 0, { pb, pn, pl });
    ok('V3UI-21-HATA-YOK', errors.length === 0, { errors }); await ctx.close(); }
  for (const lang of ['tr', 'en']) { const { ctx, p } = await setup(b, { phone: true, lang }); await p.setViewportSize({ width: 320, height: 700 }); await p.goto('https://v3.test/app.html#/t/t1'); await p.locator('article.v-step').first().waitFor();
    const r = await p.locator('article.v-step').first().evaluate(a => { const box = a.getBoundingClientRect(); const bs = [...a.querySelectorAll('.v-btns > a, .v-btns > button')].map(e => e.getBoundingClientRect()); return { inside: bs.every(x => x.left >= box.left - 0.5 && x.right <= box.right + 0.5), seq: bs.every((x, i) => i === 0 || x.top > bs[i - 1].top + 1 || (Math.abs(x.top - bs[i - 1].top) < 1 && x.left > bs[i - 1].left)), labels: [...a.querySelectorAll('.v-btns > a, .v-btns > button')].map(e => e.textContent) }; });
    ok(`V3UI-22-TELEFON-DUGMELER-${lang.toUpperCase()}`, r.inside && r.seq && await noHScroll(p) && (lang === 'en' ? r.labels[0] === 'Review the plan' && r.labels[1] === 'Mark as done' : true), r); await ctx.close(); }
  await b.close(); fs.writeFileSync(path.join(OUT, 'v300-arayuz.json'), JSON.stringify(results, null, 1));
  const fail = results.filter(r => !r.pass); console.log('V300-ARAYUZ', `${results.length - fail.length}/${results.length}`); process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
