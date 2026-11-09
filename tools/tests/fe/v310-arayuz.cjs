// v3.1.0 (R-05…R-11) arayüz kabulü — kontrollü HTTP, sentetik veri. Adım kartı yerleşim A (tek kayıt kutusu): not/gelişme adımı tamamlamadan,
// dosya yazı kutusunun altında ve metinle birlikte, başarısız gönderimde form korunur, engel ve zorunlu çözüm notu, İK engel listesi, geri alma,
// mevcut genelden düşükse kırmızı, izleme göstergeleri ölçek çizgisi (eksik değer, eşit değer, İzlenir), telefonda TR/EN taşma yok. Çıktı: OUT/v310-arayuz.json
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || process.env.PW_MODULE || '/home/claude/.npm-global/lib/node_modules/playwright'); const fs = require('fs'); const path = require('path');
const DIST = path.resolve(process.env.WEB_DIST || 'apps/web/dist'); const OUT = path.resolve(process.env.OUT || 'docs/test-ciktilari/fe'); fs.mkdirSync(OUT, { recursive: true });
const T = '2026-12-20';
const plan = (no, o = {}) => ({ id: `p${no}`, no, title: `Plan başlığı ${no}`, itemCode: `wp0${no}`, itemText: `Madde metni ${no}.`, respondents: 29, currentPos: 9, currentPct: 31, comparisonPct: 58, targetKind: 'HEDEF', targetPos: 11, targetPct: 37.9, responsibility: null, impact: null, ...o });
const step = (id, o) => ({ id, role: 'YONETIM', roleLabel: 'Örnek Otel Yönetimi', phaseDays: 30, ord: 1, text: `Adım ${id}.`, output: `Çıktı ${id}.`, contribution: null, dueDate: '2026-12-16', status: 'LATE', note: null, statusAt: null, updatedBy: null, version: 1, canMark: true, ref: null, records: [], blockers: [], lastProgress: null, canRecord: true, canUnblock: true, ...o });
const meta = { roadmapId: 'rm1', layer: 'ISLETME', unitCode: 'U1', unitLabel: 'Örnek Otel' };
function data() {
  const s1 = step('s1', { lastProgress: { text: 'Beş departmanın üçünden liste geldi.', by: 'Müdür Bir', at: '2026-12-19T13:40:00Z' }, blockers: [{ id: 'b1', text: 'İK’dan ücret tablosunu bekliyoruz.', by: 'Müdür Bir', at: '2026-12-18T07:15:00Z' }],
    records: [{ id: 'r2', kind: 'PROGRESS', text: 'Beş departmanın üçünden liste geldi.', by: 'Müdür Bir', at: '2026-12-19T13:40:00Z', blockerId: null, files: [] }, { id: 'r1', kind: 'BLOCKER', text: 'İK’dan ücret tablosunu bekliyoruz.', by: 'Müdür Bir', at: '2026-12-18T07:15:00Z', blockerId: null, files: [{ id: 'f1', name: 'tutanak.pdf', mime: 'application/pdf', size: 188000, image: false }] }] });
  const s2 = step('s2', { phaseDays: 90, dueDate: '2027-02-14', status: 'OPEN' });
  const s3 = step('s3', { status: 'DONE', statusAt: '2026-12-01', updatedBy: 'Müdür Bir', records: [{ id: 'r3', kind: 'DONE', text: null, by: 'Müdür Bir', at: '2026-12-01T12:03:00Z', blockerId: null, files: [] }] });
  const steps = [{ ...s1, ...meta, plan: plan(1) }, { ...s2, ...meta, plan: plan(2) }, { ...s3, ...meta, plan: plan(1) }];
  const items = [
    { ord: 1, itemCode: 'wp41', itemText: 'Düşük madde.', link: 'Eylem planı 1', currentPct: 50, comparisonPct: 58, sectorPct: 94.3, target: '%58,3' },
    { ord: 2, itemCode: 's13', itemText: 'Eşit değerler.', link: null, currentPct: 60, comparisonPct: 60, sectorPct: 60, target: '%60,0' },
    { ord: 3, itemCode: 'wp07', itemText: 'İzlenen madde, sektör yok.', link: 'Eylem planı 2', currentPct: 25, comparisonPct: 29.8, sectorPct: null, target: 'İzlenir' },
    { ord: 4, itemCode: 'NPS', itemText: 'Karşılaştırma yok.', link: null, currentPct: 75, comparisonPct: null, sectorPct: 77.6, target: null },
  ];
  const detail = { id: 'rm1', status: 'active', layer: 'ISLETME', unitCode: 'U1', unitLabel: 'Örnek Otel', respondents: 29, comparisonLabel: 'Grup geneli', headline: null, summary: null, reportTitle: 'Örnek 2026 Raporu', cycleCode: '2026-ANA', startDate: '2026-11-16', measurePeriod: null, today: T, rights: { IK: false, YONETIM: true },
    plans: [{ ...plan(1), steps: [s1, s3] }, { ...plan(2, { comparisonPct: null, targetKind: 'IZLENIR', targetPos: null, targetPct: null }), steps: [s2] }], items };
  return { me: { today: T, counts: { total: 3, done: 1, late: 1, open: 1 }, steps }, detail,
    blockers: { enabled: true, items: [{ id: 'b9', stepId: 's9', roadmapId: 'rm2', planNo: 3, unitLabel: 'Sahil Evleri', layer: 'ISLETME', roleLabel: 'Sahil Evleri Yönetimi', stepText: 'Yemek komitesini kurmak.', text: 'Bütçe onayı bekleniyor.', by: 'Ece Demir', at: '2026-12-17T08:00:00Z' }] } };
}
const results = []; const ok = (id, pass, info) => { results.push({ id, pass: !!pass, info }); console.log(id, pass ? 'PASS' : 'FAIL', JSON.stringify(info ?? {})); };
async function setup(browser, { profile = 'UNIT_MANAGER', phone = false, lang = 'tr', failRecordsOnce = false, hr = false } = {}) {
  const ctx = await browser.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); const errors = []; const posts = []; p.on('pageerror', e => errors.push(e.message));
  await ctx.addInitScript(l => { try { localStorage.setItem('hpwact.lang', l); } catch (e) { /* yok */ } }, lang);
  const D = data(); let failNext = failRecordsOnce;
  await ctx.route('https://v3.test/**', async rt => { const req = rt.request(); const q = new URL(req.url()).pathname; const send = (d, s = 200) => rt.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });
    if (!q.startsWith('/api/')) { const f = path.join(DIST, q === '/' ? 'app.html' : q); return fs.existsSync(f) && fs.statSync(f).isFile() ? rt.fulfill({ path: f }) : rt.fulfill({ path: path.join(DIST, 'app.html') }); }
    if (q === '/api/public/app') return send({ mode: 'v3' });
    if (q === '/api/auth/me') return send({ userId: 'u1', email: 'm@ornek.test', displayName: 'Müdür Bir', realm: 'customer', tenantId: 't1', profile, companyWide: profile === 'HR_ADMIN', memberships: [{ tenant_id: 't1', tenant_name: 'Örnek Grup', tenant_code: 'ORNEK' }] });
    if (q === '/api/t/t1/overview') return send({ tenant: { name: 'Örnek Grup', code: 'ORNEK' }, principal: { profile, companyWide: false } });
    if (q === '/api/t/t1/rm2/me') return send(D.me);
    if (q === '/api/t/t1/rm2/blockers') return send(hr ? D.blockers : { enabled: false, items: [] });
    if (q === '/api/t/t1/rm2') return send({ today: T, roadmaps: [{ id: 'rm1', layer: 'ISLETME', unitCode: 'U1', unitLabel: 'Örnek Otel', respondents: 29, cycleCode: '2026-ANA', reportTitle: 'Örnek 2026 Raporu', headline: null, startDate: '2026-11-16', measurePeriod: null, plans: 2, targets: 1, ik: { total: 0, done: 0, late: 0 }, management: { total: 3, done: 1, late: 1 }, nextDue: '2027-02-14' }] });
    if (q === '/api/t/t1/rm2/rm1') return send(D.detail);
    if (/^\/api\/t\/t1\/rm2-steps\/[^/]+\/records$/.test(q) && req.method() === 'POST') {
      const raw = req.postDataBuffer()?.toString('latin1') ?? ''; const f = {}; for (const m of raw.matchAll(/name="(kind|text)"\r\n\r\n([\s\S]*?)\r\n--/g)) f[m[1]] = Buffer.from(m[2], 'latin1').toString('utf8'); const files = [...raw.matchAll(/filename="([^"]*)"/g)].map(m => Buffer.from(m[1], 'latin1').toString('utf8'));
      posts.push({ q, f, files, key: req.headers()['idempotency-key'] });
      if (failNext) { failNext = false; return send({ error: 'server', message: 'Geçici hata' }, 503); }
      const sid = q.split('/')[5]; const st = D.me.steps.find(s => s.id === sid);
      const rec = { id: `n${posts.length}`, kind: f.text ? f.kind : 'FILE', text: f.text || null, by: 'Müdür Bir', at: '2026-12-20T09:30:00Z', blockerId: null, files: files.map((n, i) => ({ id: `nf${posts.length}-${i}`, name: n, mime: /\.png$/.test(n) ? 'image/png' : 'application/pdf', size: 2048, image: /\.png$/.test(n) })) };
      if (st) { st.records = [rec, ...st.records]; if (rec.kind === 'PROGRESS') st.lastProgress = { text: rec.text, by: rec.by, at: rec.at }; }
      return send({ stepId: sid, record: rec, status: 'NOT_DONE' }); }
    if (/\/blockers\/[^/]+\/resolve$/.test(q) && req.method() === 'POST') { const b = JSON.parse(req.postData() || '{}'); posts.push({ q, b, key: req.headers()['idempotency-key'] }); const sid = q.split('/')[5]; const st = D.me.steps.find(s => s.id === sid); if (st) st.blockers = []; D.blockers.items = D.blockers.items.filter(i => !q.includes(i.id)); return send({ stepId: sid, record: { id: 'u1', kind: 'UNBLOCK', text: b.resolution, by: 'Müdür Bir', at: T + 'T10:00:00Z', blockerId: 'b1', files: [] }, status: 'NOT_DONE' }); }
    if (/^\/api\/t\/t1\/rm2-steps\/[^/]+$/.test(q) && req.method() === 'POST') { const b = JSON.parse(req.postData() || '{}'); posts.push({ q, b, key: req.headers()['idempotency-key'] }); const st = D.me.steps.find(s => q.endsWith('/' + s.id));
      if (st) { st.status = b.done ? 'DONE' : (st.dueDate < T ? 'LATE' : 'OPEN'); st.version++; st.records = [{ id: `m${posts.length}`, kind: b.done ? 'DONE' : 'UNDO', text: null, by: 'Müdür Bir', at: T + 'T10:05:00Z', blockerId: null, files: [] }, ...st.records]; D.me.counts.done = D.me.steps.filter(s => s.status === 'DONE').length; }
      return send({ id: st?.id, status: st?.status, note: null, version: st?.version ?? 2, statusAt: T }); }
    return send({ error: 'not_found' }, 404); });
  return { ctx, p, errors, posts };
}
const noHScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
(async () => {
  const b = await chromium.launch();
  // 1) masaüstü TR · işletme müdürü: yerleşim A, not/gelişme, dosya, başarısız gönderim, engel, geri alma
  { const { ctx, p, errors, posts } = await setup(b, { failRecordsOnce: true }); await p.goto('https://v3.test/app.html#/t/t1'); await p.getByRole('heading', { name: 'Bugün yapılacaklar' }).waitFor();
    const card = p.locator('article.v-step', { hasText: 'Adım s1.' });
    const order = await card.evaluate(a => [...a.children].map(c => c.classList.contains('v-last') ? 'gelisme' : c.classList.contains('v-block') ? 'engel' : c.querySelector('.v-recs') ? 'kayitlar' : c.querySelector('.v-compose') ? 'kayit-ekle' : c.querySelector('.v-btn-mark,.v-btn2[href]') ? 'eylemler' : null).filter(Boolean));
    ok('K-UI-01-YERLESIM-A', JSON.stringify(order) === JSON.stringify(['gelisme', 'engel', 'kayitlar', 'kayit-ekle', 'eylemler']) && (await card.locator('.v-st-BLOCK').innerText()) === 'Engel var', { order });
    // not: adımı tamamlamadan kaydedilir; sonuç düğmenin altında role=status
    await card.getByRole('button', { name: 'Not', exact: true }).click(); const ta = card.locator('.v-compose textarea'); await ta.fill('Salon 12 Aralık için ayrıldı.');
    const input = card.locator('.v-compose input[type=file]');
    await input.setInputFiles([{ name: 'katilim.png', mimeType: 'image/png', buffer: PNG }, { name: 'tutanak.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') }]);
    const pend = await card.locator('.v-files .v-file').allInnerTexts(); const textKept = await ta.inputValue();
    const below = await card.evaluate(a => { const t = a.querySelector('.v-compose textarea').getBoundingClientRect(); const f = a.querySelector('.v-files').getBoundingClientRect(); return f.top >= t.bottom; });
    ok('K-UI-02-DOSYA-YAZININ-ALTINDA-METIN-KORUNUR', pend.length === 2 && textKept === 'Salon 12 Aralık için ayrıldı.' && below && (await card.locator('.v-files img').count()) === 1, { pend, textKept, below });
    await card.locator('.v-files .v-file', { hasText: 'tutanak.pdf' }).getByRole('button', { name: 'Kaldır' }).click(); ok('K-UI-03-KAYDETMEDEN-KALDIR', (await card.locator('.v-files .v-file').count()) === 1, {});
    await card.getByRole('button', { name: 'Notu kaydet' }).click(); const al = card.locator('.v-compose [role=alert]'); await al.waitFor();
    ok('K-UI-04-BASARISIZ-GONDERIM-FORM-KORUNUR', (await ta.inputValue()) === 'Salon 12 Aralık için ayrıldı.' && (await card.locator('.v-files .v-file').count()) === 1, { alert: await al.innerText() });
    await card.getByRole('button', { name: 'Notu kaydet' }).click(); const stt = card.locator('.v-compose [role=status]'); await stt.waitFor(); await p.waitForTimeout(200);
    const sent = posts.filter(x => x.q.endsWith('/s1/records')); const marks = posts.filter(x => /rm2-steps\/s1$/.test(x.q));
    const saveBox = await card.evaluate(a => { const btn = [...a.querySelectorAll('.v-compose button')].find(x => /kaydet/.test(x.textContent)).getBoundingClientRect(); const s = a.querySelector('.v-compose [role=status]').getBoundingClientRect(); return s.top >= btn.bottom && s.top - btn.bottom < 30; });
    ok('K-UI-05-NOT-TAMAMLAMADAN', sent.length === 2 && sent[1].f.kind === 'NOTE' && sent[1].files.join() === 'katilim.png' && sent[0].key === sent[1].key && marks.length === 0 && (await stt.innerText()).startsWith('Not kaydedildi') && saveBox && (await card.locator('.v-st').first().innerText()) === 'Gecikti' && (await ta.inputValue()) === '' && (await card.locator('.v-files').count()) === 0, { sent: sent.map(x => [x.f, x.files]), saveBox });
    const recRow = card.locator('.v-recr').first(); const dl = recRow.locator('a.v-fn'); const opn = recRow.getByRole('link', { name: 'Yeni sekmede aç' });
    ok('K-UI-06-DOSYA-KAYDIN-ALTINDA', (await recRow.innerText()).includes('Salon 12 Aralık için ayrıldı.') && (await dl.getAttribute('download')) === 'katilim.png' && /\/rm2-files\/nf2-0$/.test(await dl.getAttribute('href')) && /inline=1$/.test(await opn.getAttribute('href')) && (await opn.getAttribute('target')) === '_blank' && (await recRow.getByRole('link', { name: 'İndir' }).count()) === 1, {});
    // gelişme: son gelişme kutusu güncellenir; boş kayıt engellenir; yalnız dosya kaydedilir
    await card.getByRole('button', { name: 'Gelişme', exact: true }).click(); await ta.fill('Dört departmandan liste geldi.'); await card.getByRole('button', { name: 'Gelişmeyi kaydet' }).click(); await card.locator('.v-last', { hasText: 'Dört departmandan' }).waitFor();
    await card.getByRole('button', { name: 'Gelişmeyi kaydet' }).click(); const empt = await card.locator('.v-compose [role=alert]').innerText();
    await input.setInputFiles([{ name: 'liste.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') }]); await card.getByRole('button', { name: 'Gelişmeyi kaydet' }).click(); await card.locator('.v-compose [role=status]', { hasText: 'Dosya kaydedildi' }).waitFor();
    ok('K-UI-07-GELISME-BOS-YALNIZ-DOSYA', empt === 'Kaydetmek için bir şey yazın ya da dosya ekleyin.' && posts.filter(x => x.q.endsWith('/s1/records')).at(-1).f.text === '' && (await card.locator('.v-recr').first().locator('.v-rt').innerText()) === 'Dosya' && (await card.locator('.v-st').first().innerText()) === 'Gecikti', { empt });
    // engel: kırmızı sol çizgi; çözüm notu boşken düğmenin altında uyarı, istek gitmez; yazınca kaldırılır
    const blk = card.locator('.v-block'); const line = await blk.evaluate(e => getComputedStyle(e, '::before').backgroundColor);
    await blk.getByRole('button', { name: 'Engeli kaldır' }).click(); const ba = blk.locator('[role=alert]'); await ba.waitFor(); const n0 = posts.filter(x => x.q.includes('/resolve')).length;
    await blk.locator('textarea').fill('   '); await blk.getByRole('button', { name: 'Engeli kaldır' }).click();
    ok('K-UI-08-COZUM-NOTU-ZORUNLU', line === 'rgb(207, 5, 30)' && (await ba.innerText()) === 'Engeli kaldırmak için önce geliştirilen çözümü yazın.' && n0 === 0 && posts.filter(x => x.q.includes('/resolve')).length === 0 && (await blk.locator('label').innerText()) === 'Çözüm notu (engeli kaldırabilmek için geliştirilen çözüm yazılmalıdır)', { line });
    await blk.locator('textarea').fill('Tablo e-postayla geldi.'); await blk.getByRole('button', { name: 'Engeli kaldır' }).click(); await p.waitForTimeout(400);
    const rs = posts.find(x => x.q.includes('/s1/blockers/b1/resolve')); ok('K-UI-09-ENGEL-KALKAR-ADIM-TAMAMLANMAZ', rs && rs.b.resolution === 'Tablo e-postayla geldi.' && (await card.locator('.v-block').count()) === 0 && (await card.locator('.v-st').first().innerText()) === 'Gecikti' && posts.filter(x => /rm2-steps\/s1$/.test(x.q)).length === 0, {});
    // geri alma: yapılan adım geri alınınca durum, düğme ve sayaç güncellenir; termini geçtiği için Gecikti
    await p.getByRole('button', { name: 'Yapılanları göster' }).click(); const done = p.locator('article.v-step', { hasText: 'Adım s3.' }); await done.getByRole('button', { name: 'Yapılmadı olarak geri al' }).click(); await p.waitForTimeout(400);
    const s3 = p.locator('article.v-step', { hasText: 'Adım s3.' }); const head = await p.locator('.v-today-sum').innerText();
    ok('K-UI-10-GERI-AL', (await s3.locator('.v-st').first().innerText()) === 'Gecikti' && (await s3.getByRole('button', { name: 'Yapıldı olarak işaretle' }).count()) === 1 && head.includes('0 / 3 yapıldı') && (await s3.locator('.v-recr').first().innerText()).includes('Geri alındı') && (await s3.locator('[role=status]').innerText()).startsWith('Adım yeniden Yapılmadı'), { head });
    ok('K-UI-11-HATA-YOK', errors.length === 0, { errors }); await ctx.close(); }
  // 2) İK: işletmelerden gelen engeller ayrı liste, kırmızı sol çizgi, çözüm notu zorunlu
  { const { ctx, p, posts } = await setup(b, { profile: 'HR_ADMIN', hr: true }); await p.goto('https://v3.test/app.html#/t/t1'); const sec = p.locator('section.v-hrb'); await sec.waitFor();
    const it = sec.locator('.v-bi').first(); const line = await it.evaluate(e => getComputedStyle(e, '::before').backgroundColor);
    await it.getByRole('button', { name: 'Engeli kaldır' }).click(); const al = await it.locator('[role=alert]').innerText();
    await it.locator('textarea').fill('Bütçe onaylandı.'); await it.getByRole('button', { name: 'Engeli kaldır' }).click(); await p.waitForTimeout(400);
    ok('K-UI-12-IK-ENGEL-LISTESI', line === 'rgb(207, 5, 30)' && (await sec.locator('h2').innerText()).startsWith('İşletmelerden gelen engeller') && al === 'Engeli kaldırmak için önce geliştirilen çözümü yazın.' && posts.some(x => x.q.includes('/s9/blockers/b9/resolve') && x.b.resolution === 'Bütçe onaylandı.') && (await sec.innerText()).includes('Açık engel yok.') && (await p.locator('article.v-step').count()) > 0, { line, al });
    await ctx.close(); }
  // 3) plan ekranı: R-10 kırmızı mevcut; R-11 ölçek çizgisi
  { const { ctx, p, errors } = await setup(b); await p.goto('https://v3.test/app.html#/t/t1/planlar'); await p.locator('.v-plancard').first().waitFor();
    const ib1 = p.locator('.v-plancard').nth(0).locator('.v-ib'); const ib2 = p.locator('.v-plancard').nth(1).locator('.v-ib');
    const c1 = await ib1.locator('.v-ib-v b').first().evaluate(e => getComputedStyle(e).color); const f1 = await ib1.locator('.v-bar-f').first().evaluate(e => getComputedStyle(e).backgroundColor);
    const c2 = await ib2.locator('.v-ib-v b').first().evaluate(e => getComputedStyle(e).color); const f2 = await ib2.locator('.v-bar-f').first().evaluate(e => getComputedStyle(e).backgroundColor);
    ok('K-UI-13-MEVCUT-GENELDEN-DUSUK-KIRMIZI', c1 === 'rgb(207, 5, 30)' && f1 === 'rgb(207, 5, 30)' && c2 === 'rgb(35, 26, 21)' && f2 === 'rgb(35, 26, 21)', { c1, f1, c2, f2 });
    const rows = p.locator('.v-srow'); const info = await rows.evaluateAll(rs => rs.map(r => ({ fill: r.querySelector('.v-fill') ? getComputedStyle(r.querySelector('.v-fill')).backgroundColor : null, w: r.querySelector('.v-fill')?.style.width ?? null, ticks: [...r.querySelectorAll('.v-tick')].map(t => [t.className.replace('v-tick ', ''), t.style.left, Math.round(t.getBoundingClientRect().top - r.querySelector('.v-scale').getBoundingClientRect().top), Math.round(t.getBoundingClientRect().height)]), nums: r.querySelector('.v-nums').innerText, aria: r.querySelector('.v-scale').getAttribute('aria-label') })));
    const [r1, r2, r3, r4] = info;
    ok('K-UI-14-OLCEK-DUSUK', r1.fill === 'rgb(207, 5, 30)' && r1.w === '50%' && r1.ticks.map(t => t[0]).sort().join() === 'cmp,sec,tgt' && r1.nums.includes('Hedef %58,3') && r1.nums.includes('Grup geneli %58,0'), r1);
    const spans = r2.ticks.map(t => [t[2], t[2] + t[3]]); const distinct = new Set(r2.ticks.map(t => `${t[2]}-${t[3]}`)).size === 3;
    ok('K-UI-15-OLCEK-ESIT-DEGERLER', r2.fill === 'rgb(35, 26, 21)' && r2.ticks.every(t => t[1] === '60%') && distinct && r2.nums.includes('Mevcut %60,0'), { r2, spans });
    ok('K-UI-16-OLCEK-IZLENIR-EKSIK', r3.ticks.map(t => t[0]).join() === 'cmp' && r3.nums.includes('Hedef İzlenir') && r3.nums.includes('Sektör —') && r4.ticks.map(t => t[0]).join() === 'sec' && r4.fill === 'rgb(35, 26, 21)' && r4.nums.includes('Grup geneli —') && r4.nums.includes('Hedef —'), { r3, r4 });
    ok('K-UI-17-PLAN-EKRANI-HATA-YOK', errors.length === 0 && (await p.locator('table.v-items').count()) === 0, { errors }); await ctx.close(); }
  // 4) telefon (320 px) TR/EN: Bugün ve Planlar taşmaz, kayıt satırı tek sütun, etiketler çevrili
  for (const lang of ['tr', 'en']) { const { ctx, p } = await setup(b, { phone: true, lang, hr: true, profile: 'HR_ADMIN' }); await p.setViewportSize({ width: 320, height: 740 }); await p.goto('https://v3.test/app.html#/t/t1'); await p.locator('article.v-step').first().waitFor();
    const card = p.locator('article.v-step').first(); const inside = await card.evaluate(a => { const box = a.getBoundingClientRect(); return [...a.querySelectorAll('button, a, textarea, .v-recr, .v-block, .v-last')].every(e => { const r = e.getBoundingClientRect(); return r.left >= box.left - 0.5 && r.right <= box.right + 0.5; }); });
    const cols = await card.locator('.v-recr').first().evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length); const today = await noHScroll(p);
    const txt = await p.locator('main').innerText(); const en = lang === 'en' ? ['Blockers from the units', 'Latest progress', 'Records', 'Add a record', 'Save progress', 'Add a file or photo', 'Remove blocker', 'Review the plan', 'Mark as done'].every(s => txt.includes(s)) && !/Kayıt ekle|Engeli kaldır/.test(txt) : true;
    await p.goto('https://v3.test/app.html#/t/t1/planlar'); await p.locator('.v-srow').first().waitFor(); const plans = await noHScroll(p);
    const scaleIn = await p.locator('.v-srow').first().evaluate(r => { const s = r.querySelector('.v-scale').getBoundingClientRect(); return s.width > 200 && s.right <= window.innerWidth; });
    ok(`K-UI-18-TELEFON-${lang.toUpperCase()}`, inside && cols === 1 && today && plans && scaleIn && en, { inside, cols, today, plans, scaleIn, en }); await ctx.close(); }
  await b.close(); fs.writeFileSync(path.join(OUT, 'v310-arayuz.json'), JSON.stringify(results, null, 1));
  const fail = results.filter(r => !r.pass); console.log('V310-ARAYUZ', `${results.length - fail.length}/${results.length}`); process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
