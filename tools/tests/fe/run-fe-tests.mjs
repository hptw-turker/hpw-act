// F16: ön yüz kabul kapısı — sözleşme + API istemcisi + tarayıcı regresyonları (denetçi testleri dahil). Ürün paketi apps/web/dist önceden derlenmiş olmalı.
import { execFileSync } from 'node:child_process'; import { existsSync, mkdirSync, readFileSync } from 'node:fs'; import { resolve, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..'); const out = resolve(root, process.env.OUT || 'docs/test-ciktilari/fe'); mkdirSync(out, { recursive: true });
// v2.9.1: WEB_DIST verilirse (ör. teslim paketindeki DOLU_DEMO web derlemesi) testler O dosyalar üzerinde koşar; önceki sürümlerde bu değişken yok sayılıyordu
const webDist = process.env.WEB_DIST ? resolve(process.env.WEB_DIST) : resolve(root, 'apps/web/dist');
if (!existsSync(resolve(webDist, 'app.html'))) { console.error(`${webDist} içinde app.html yok: önce npm run build`); process.exit(2); }
console.log('WEB_DIST =', webDist);
const tsx = ['--import', 'tsx']; const env = { ...process.env, OUT: out, WEB_DIST: webDist }; let fail = 0;
// v2.10.1: FE_PART=A|R|B kapıyı parçalarda koşturmaya izin verir (ortamın tek komut süre sınırı için); varsayılan ikisi birden — standart komut değişmedi.
// A: dil, sözleşme, istemci, denetçi tarayıcı, regresyonlar, sonuç denetimi · B: bağımsız karşı örnekler (N01–N03, R01–R04, kapsam, V290, V210)
const PART = (process.env.FE_PART ?? 'ARBC').toUpperCase(); const inA = PART.includes('A'), inB = PART.includes('B'), inR = PART.includes('R'), inC = PART.includes('C'); // R: tarayıcı regresyonları (REG_SPLIT=k/n ile parçalanabilir)
const runA = (...a) => { if (inA) run(...a); }; const runB = (...a) => { if (inB) run(...a); };
const run = (label, args, cwd) => { try { execFileSync(process.execPath, args, { stdio: 'inherit', cwd, env }); console.log('✓', label); } catch { console.log('✗', label); fail++; } };
runA('arayüz dil kapsamı (TR/EN)', [resolve(root, 'tools/tests/fe/i18n-coverage.mjs')], root);
runA('yetki kural sözleşmesi (ön yüz = sunucu)', [...tsx, resolve(root, 'tools/tests/fe/rules-contract.mts')], resolve(root, 'apps/api'));
runA('DTO ⊆ sözleşme ve test yanıtları sözleşmeye uygun', [...tsx, resolve(root, 'tools/tests/fe/dto-contract.mts')], resolve(root, 'apps/api'));
runA('API istemcisi (denetçi)', [...tsx, resolve(root, 'tools/tests/fe/api-client-tests.mts')], resolve(root, 'apps/api'));
runA('API istemcisi (v2.7.3 ek)', [...tsx, resolve(root, 'tools/tests/fe/api-client-extra.mts')], resolve(root, 'apps/api'));
runA('tarayıcı: v3.0 sade arayüz kabulü (Bugün, işaretleme, planlar, atıf, telefon, EN, şirket girişi)', [resolve(root, 'tools/tests/fe/v300-arayuz.cjs')], root);
runA('tarayıcı: v3.1 adım kayıtları kabulü (yerleşim A, not/gelişme/engel/dosya, geri alma, kırmızı mevcut, ölçek çizgisi, telefon TR/EN)', [resolve(root, 'tools/tests/fe/v310-arayuz.cjs')], root);
runA('tarayıcı: denetçi senaryoları (DEEP-LINK hazır olma beklemeli kopya; özgünü ui-audit.cjs, fark ui-audit.hazir-bekleme.diff)', [resolve(root, 'tools/tests/fe/ui-audit.hazir-bekleme.cjs')], root);
(inR ? run : () => {})('tarayıcı: v2.7.3 regresyonları' + (process.env.REG_SPLIT ? ` (parça ${process.env.REG_SPLIT})` : ''), [resolve(root, 'tools/tests/fe/ui-regresyon.cjs')], root);
runB('tarayıcı: bağımsız yeniden denetim (N01–N03)', [resolve(root, 'tools/tests/fe/bagimsiz/run-independent.cjs')], root);
runB('tarayıcı: bağımsız R01–R03 (edge)', [resolve(root, 'tools/tests/fe/bagimsiz/run-edge.cjs')], root);
runB('sözleşme: bağımsız karşı örnekler (R04)', [...tsx, resolve(root, 'tools/tests/fe/bagimsiz/contract-edge.mts')], resolve(root, 'apps/api'));
runB('sözleşme: bağımsız kalan karşı örnekler (R04, v2.7.5 turu)', [...tsx, resolve(root, 'tools/tests/fe/bagimsiz/contract-remaining.mts')], resolve(root, 'apps/api'));
runB('sözleşme: kapsam denetimi (yalnız-null/türsüz/çözümsüz = 0)', [...tsx, resolve(root, 'apps/api/scripts/contract-audit.mts')], resolve(root, 'apps/api'));
// v2.10.2: C — sonuç denetimi denetçi tarayıcı sonuçlarını (A) ve BU koşunun birleşik regresyon sonucunu (R) okur; REG_RUN verilmişse sonucun o koşuya ait olduğu doğrulanır
if (inC) { const meta = resolve(out, 'ui-regresyon-sonuc.meta.json'); let okRun = existsSync(meta); if (okRun && process.env.REG_RUN) { const m = JSON.parse(readFileSync(meta, 'utf8')); okRun = m.run === process.env.REG_RUN; if (!okRun) console.log('✗ regresyon sonucu bu koşuya ait değil:', m.run, '≠', process.env.REG_RUN); }
  if (okRun) run('tarayıcı: denetçi sonuç denetimi', [resolve(root, 'tools/tests/fe/check-audit-results.mjs')], root); else { console.log('✗ tarayıcı: denetçi sonuç denetimi (birleşik regresyon sonucu yok)'); fail++; } }
if (inB) // v2.9.1: bağımsız v2.9.0 denetim karşı örnekleri (denetçi betikleri; yalnız yol uyarlaması: tools/tests/bagimsiz-v290/ADAPTASYON.md)
{ const apiRt = process.env.HPW_API_RUNTIME ? resolve(process.env.HPW_API_RUNTIME) : resolve(root, 'apps/api/dist/src');
  if (!process.env.HPW_API_RUNTIME) { try { execFileSync('npx', ['tsc', '-p', 'tsconfig.json'], { cwd: resolve(root, 'apps/api'), stdio: 'inherit' }); } catch { console.log('✗ API derlemesi (bağımsız API testi için)'); fail++; } }
  const ev = resolve(out, 'bagimsiz-v290'); mkdirSync(ev, { recursive: true });
  const benv = { ...env, HPW_SOURCE: root, HPW_API_RUNTIME: apiRt, EVIDENCE_DIR: ev, PLAYWRIGHT_MODULE: process.env.PLAYWRIGHT_MODULE ?? '/home/claude/.npm-global/lib/node_modules/playwright' };
  const brun = (label, file, cwd) => { try { execFileSync(process.execPath, [resolve(root, 'tools/tests/bagimsiz-v290', file)], { stdio: 'inherit', cwd, env: benv }); console.log('✓', label); } catch { console.log('✗', label); fail++; } };
  brun('bağımsız V290-01/02/03 (tarayıcı, kontrollü HTTP)', 'independent-ui.cjs', root);
  brun('bağımsız V290-05 (üretim yapılandırması)', 'production-config.mjs', root);
  brun('bağımsız V290-06 + yetki kapısı (Fastify, kontrollü DB arızası; gerçek PostgreSQL değil)', 'independent-api.mjs', resolve(apiRt, '..', '..')); }
// v2.10.1: bağımsız v2.10.0 denetim karşı örnekleri (değiştirilmeden; yalnız ortam değişkenleri: tools/tests/bagimsiz-v2100/ADAPTASYON.md)
if (inB) { const apiRt = process.env.HPW_API_RUNTIME ? resolve(process.env.HPW_API_RUNTIME) : resolve(root, 'apps/api/dist/src'); const ev = resolve(out, 'bagimsiz-v2100');
  const b2 = (label, file, sub, cwd) => { const o = resolve(ev, sub); mkdirSync(o, { recursive: true }); try { execFileSync(process.execPath, [resolve(root, 'tools/tests/bagimsiz-v2100', file)], { stdio: 'inherit', cwd, env: { ...env, HPW_SOURCE: root, HPW_API_RUNTIME: apiRt, OUT: o, PLAYWRIGHT_MODULE: process.env.PLAYWRIGHT_MODULE ?? '/home/claude/.npm-global/lib/node_modules/playwright' } }); console.log('✓', label); } catch { console.log('✗', label); fail++; } };
  b2('bağımsız V210-01…06 (tarayıcı, kontrollü HTTP; 7 senaryo)', 'independent-ui.cjs', 'ui', root);
  b2('bağımsız V210-02 (Fastify + computeOnboarding, kontrollü DB; gerçek PostgreSQL değil)', 'independent-api.mjs', 'api', resolve(apiRt, '..', '..')); }
// v2.10.2: bağımsız v2.10.1 devam karşı örnekleri (edge-ui.cjs değiştirilmeden; receipt-api.mjs bir ulaşılabilirlik sondasıdır, kabul testi değildir: tools/tests/bagimsiz-v2101/ADAPTASYON.md)
if (inB) { const o = resolve(out, 'bagimsiz-v2101', 'edge-ui'); mkdirSync(o, { recursive: true });
  try { execFileSync(process.execPath, [resolve(root, 'tools/tests/bagimsiz-v2101/tests/edge-ui.cjs')], { stdio: 'inherit', cwd: root, env: { ...env, HPW_SOURCE: root, OUT: o, PLAYWRIGHT_MODULE: process.env.PLAYWRIGHT_MODULE ?? '/home/claude/.npm-global/lib/node_modules/playwright' } }); console.log('✓ bağımsız V2101-R1/R2/R3 (tarayıcı, kontrollü HTTP; 3 senaryo)'); } catch { console.log('✗ bağımsız V2101-R1/R2/R3'); fail++; } }
// v2.10.2 bağımsız kabul: makbuz ve güncel yetki (denetçinin receipt-acceptance.mjs, değiştirilmeden; gerçek Fastify + kontrollü DB, bilinmeyen sorgu hata verir; gerçek PostgreSQL değil)
if (inB) { const apiRt = process.env.HPW_API_RUNTIME ? resolve(process.env.HPW_API_RUNTIME) : resolve(root, 'apps/api/dist/src'); const o = resolve(out, 'bagimsiz-v2102', 'receipt-acceptance'); mkdirSync(o, { recursive: true });
  try { execFileSync(process.execPath, [resolve(root, 'tools/tests/bagimsiz-v2102/receipt-acceptance.mjs')], { stdio: 'inherit', cwd: resolve(apiRt, '..', '..'), env: { ...env, HPW_API_RUNTIME: apiRt, OUT: o } }); console.log('✓ bağımsız makbuz kabulü (9 kontrol; kontrollü DB)'); } catch { console.log('✗ bağımsız makbuz kabulü'); fail++; } }
// v2.11.2: bağımsız v2.11.1 betikleri (değiştirilmeden; yalnız kök pw.cjs ortam uyarlaması: tools/tests/bagimsiz-v2111/ADAPTASYON.md)
if (inB) { const base = resolve(root, 'tools/tests/bagimsiz-v2111'); const apiRt = process.env.HPW_API_RUNTIME ? resolve(process.env.HPW_API_RUNTIME) : resolve(root, 'apps/api/dist/src'); const ev = resolve(out, 'bagimsiz-v2111'); mkdirSync(ev, { recursive: true });
  const b3 = (label, file, sub, cwd, extra = {}) => { const o = resolve(ev, sub); mkdirSync(o, { recursive: true }); try { execFileSync(process.execPath, [resolve(base, file)], { stdio: 'inherit', cwd, env: { ...env, HPW_SOURCE: root, HPW_API_RUNTIME: apiRt, OUT: o, ...extra } }); console.log('✓', label); } catch { console.log('✗', label); fail++; } };
  b3('bağımsız V211-A…E, fikstür uyarlanmış (tarayıcı, kontrollü HTTP; 5 senaryo)', 'tests/fixture-adapted/independent-ui.cjs', 'fixture-adapted-ui', root);
  b3('bağımsız V2111 sınır senaryoları (tarayıcı, kontrollü HTTP + kontrollü saat; 7 senaryo)', 'tests/edge-ui.cjs', 'edge-ui', root);
  b3('bağımsız CAS sondası (Fastify + değerlendirici, kontrollü DB; gerçek PostgreSQL değil; 4 kontrol)', 'tests/cas-api.mjs', 'cas-api', resolve(apiRt, '..', '..'), { UI_RESULTS: resolve(ev, 'fixture-adapted-ui', 'results.json') }); }
// v2.11.3: bağımsız v2.11.2 bekleyen komut betiği (değiştirilmeden; kök pw.cjs ortam uyarlaması)
if (inB) { const o = resolve(out, 'bagimsiz-v2112', 'pending-ui'); mkdirSync(o, { recursive: true });
  try { execFileSync(process.execPath, [resolve(root, 'tools/tests/bagimsiz-v2112/tests/pending-ui.cjs')], { stdio: 'inherit', cwd: root, env: { ...env, HPW_SOURCE: root, OUT: o } }); console.log('✓ bağımsız V2112-PENDING (tarayıcı, kontrollü HTTP + saat; 3 senaryo)'); } catch { console.log('✗ bağımsız V2112-PENDING'); fail++; } }
// v2.11.4: bağımsız v2.11.3 uzlaştırma betiği — düzenek uyarlamalı kopya (yeni sonuç ucu yanıtı; beklentiler aynı; tools/tests/bagimsiz-v2113/ADAPTASYON.md)
if (inB) { const o = resolve(out, 'bagimsiz-v2113', 'reconcile-ui'); mkdirSync(o, { recursive: true });
  try { execFileSync(process.execPath, [resolve(root, 'tools/tests/bagimsiz-v2113/tests/outcome-adapted/reconcile-ui.cjs')], { stdio: 'inherit', cwd: root, env: { ...env, HPW_SOURCE: root, OUT: o } }); console.log('✓ bağımsız V2113-RECONCILE (tarayıcı, kontrollü HTTP + saat; 4 senaryo; sonuç ucu düzenek uyarlaması)'); } catch { console.log('✗ bağımsız V2113-RECONCILE'); fail++; } }
// v2.11.5: bağımsız v2.11.4 betikleri — sıralama karşı örneği (değiştirilmeden) ve sonuç ucu sondası (kontrollü DB; gerçek PostgreSQL değil)
if (inB) { const b4 = resolve(root, 'tools/tests/bagimsiz-v2114'); const apiRt = process.env.HPW_API_RUNTIME ? resolve(process.env.HPW_API_RUNTIME) : resolve(root, 'apps/api/dist/src');
  const o1 = resolve(out, 'bagimsiz-v2114', 'outcome-order-ui'); mkdirSync(o1, { recursive: true });
  try { execFileSync(process.execPath, [resolve(b4, 'tests/outcome-order-ui.cjs')], { stdio: 'inherit', cwd: root, env: { ...env, HPW_SOURCE: root, OUT: o1 } }); console.log('✓ bağımsız V2114-ORDER (tarayıcı, kontrollü HTTP; 3 senaryo)'); } catch { console.log('✗ bağımsız V2114-ORDER'); fail++; }
  const o2 = resolve(out, 'bagimsiz-v2114', 'outcome-api'); mkdirSync(o2, { recursive: true });
  try { execFileSync(process.execPath, [resolve(b4, 'tests/outcome-api.mjs')], { stdio: 'inherit', cwd: resolve(apiRt, '..', '..'), env: { ...env, HPW_API_RUNTIME: apiRt, OUT: o2 } }); console.log('✓ bağımsız sonuç ucu sondası (Fastify, kontrollü DB; gerçek PostgreSQL değil; 6 kontrol)'); } catch { console.log('✗ bağımsız sonuç ucu sondası'); fail++; } }
// v2.11.6: bağımsız v2.11.5 çoklu belirsiz komut betiği (değiştirilmeden; kök pw.cjs ortam uyarlaması)
if (inB) { const o = resolve(out, 'bagimsiz-v2115', 'multi-pending-ui'); mkdirSync(o, { recursive: true });
  try { execFileSync(process.execPath, [resolve(root, 'tools/tests/bagimsiz-v2115/tests/multi-pending-ui.cjs')], { stdio: 'inherit', cwd: root, env: { ...env, HPW_SOURCE: root, OUT: o } }); console.log('✓ bağımsız V2115-MULTI (tarayıcı, kontrollü HTTP + saat; 3 senaryo)'); } catch { console.log('✗ bağımsız V2115-MULTI'); fail++; } }
process.exit(fail ? 1 : 0);
