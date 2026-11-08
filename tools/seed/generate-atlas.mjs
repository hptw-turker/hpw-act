// pnpm seed:atlas — Atlas Holding sentetik veri seti (deterministik, seed 20260922). Gerçek veri değildir.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = new URL('../../data/atlas/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// deterministik PRNG (mulberry32)
let seed = 20260922;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const between = (a, b) => a + rnd() * (b - a);
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const r2 = x => Math.round(x * 100) / 100;

const units = [], rel = [], persons = [];
let uid = 0;
const PREFIX = { company: 'COMPANY', gmy: 'GMY', region: 'REGION', area: 'AREA', branch: 'BRANCH', directorate: 'DIRECTORATE', subunit: 'SUBUNIT', call_center: 'CALL_CENTER', ops_center: 'OPS_CENTER', logistics: 'LOGISTICS', subsidiary: 'SUBSIDIARY' };
const mk = (type, name, headcount, extra = {}) => { const u = { external_id: `${PREFIX[type]}-${String(++uid).padStart(4, '0')}`, name, unit_type: type, headcount, timezone: 'Europe/Istanbul', calendar_code: 'TR', effective_from: '2025-01-01', ...extra }; units.push(u); return u; };
const link = (from, to, type, group, topic) => rel.push({ from: from.external_id, to: to.external_id, relationship_type: type, hierarchy_group: group, ...(topic ? { topic } : {}) });

// ---- yapı
const company = mk('company', 'Atlas Holding', 0);
const gmyNames = ['Bireysel İşler', 'Ticari İşler', 'İnsan ve Kültür', 'Operasyon', 'Teknoloji', 'Finans', 'Hukuk', 'Pazarlama', 'Strateji', 'Kurumsal İletişim', 'Risk', 'Dijital Kanallar'];
const gmy = Object.fromEntries(gmyNames.map(n => { const u = mk('gmy', `${n} GMY`, 0); link(u, company, 'reports_to', 'idari'); return [n, u]; }));

// merkez müdürlükleri (35) ve alt birimler (200)
const dirs = [];
const namedDirs = { 'İnsan ve Kültür': ['Çalışan Deneyimi Müdürlüğü', 'Akademi Müdürlüğü', 'İşe Alım Müdürlüğü'], 'Operasyon': ['Operasyon Planlama Müdürlüğü', 'İdari İşler Müdürlüğü'], 'Teknoloji': ['Şube Sistemleri Müdürlüğü'] };
let dirCount = 0;
for (const g of gmyNames) {
  const names = namedDirs[g] ?? [];
  const n = g === 'Bireysel İşler' || g === 'Ticari İşler' ? 2 : 3;
  for (let i = 0; i < n; i++) { const name = names[i] ?? `${g} Müdürlüğü ${i + 1}`; const d = mk('directorate', name, 0); link(d, gmy[g], 'reports_to', 'idari'); dirs.push(d); dirCount++; }
}
while (dirCount < 35) { const g = pick(gmyNames); const d = mk('directorate', `${g} Müdürlüğü ${dirCount}`, 0); link(d, gmy[g], 'reports_to', 'idari'); dirs.push(d); dirCount++; }
const findDir = n => dirs.find(d => d.name === n);
const cdm = findDir('Çalışan Deneyimi Müdürlüğü'), akademi = findDir('Akademi Müdürlüğü'), opPlan = findDir('Operasyon Planlama Müdürlüğü'), idari = findDir('İdari İşler Müdürlüğü');
const subunits = [];
for (let i = 0; i < 200; i++) { const d = dirs[i % dirs.length]; const s = mk('subunit', `${d.name} – Birim ${Math.floor(i / dirs.length) + 1}`, Math.max(2, Math.round(between(3, 60)))); link(s, d, 'reports_to', 'idari'); subunits.push(s); }

// bölgeler (18), alan müdürlükleri, şubeler (400)
const regionNames = ['Ege', 'Marmara', 'İç Anadolu', 'Akdeniz', 'Karadeniz', 'Doğu Anadolu', 'Güneydoğu', 'İstanbul Avrupa', 'İstanbul Anadolu', 'Ankara', 'Adana', 'Bursa', 'Antalya', 'Trabzon', 'Konya', 'Kayseri', 'Gaziantep', 'Samsun'];
const regions = regionNames.map((n, i) => { const r = mk('region', `${n} Bölge Direktörlüğü`, 0); link(r, gmy[i % 2 === 0 ? 'Bireysel İşler' : 'Ticari İşler'], 'reports_to', 'idari'); return r; });
const areas = []; regions.forEach(r => { for (let i = 0; i < 3; i++) { const a = mk('area', `${r.name.replace(' Bölge Direktörlüğü', '')} Alan Müdürlüğü ${i + 1}`, 0); link(a, r, 'reports_to', 'idari'); areas.push(a); } });
const branches = [];
const lowRegions = new Set(['Doğu Anadolu', 'Güneydoğu']);
for (let i = 0; i < 400; i++) {
  const a = areas[i % areas.length]; const region = regions[Math.floor((i % areas.length) / 3)];
  const name = i === 0 ? 'Konak Şubesi' : i === 1 ? 'Ataşehir Şubesi' : `Şube ${String(i + 1).padStart(3, '0')}`;
  const b = mk('branch', name, Math.round(between(6, 90)), i === 0 ? { external_id: 'SUBE-KONAK' } : {});
  b.region = region.name; branches.push(b);
  link(b, a, 'reports_to', 'idari'); link(b, region, 'geographic_to', 'cografi');
  link(b, cdm, 'hr_scope', 'ik'); link(b, gmy['Teknoloji'], 'tech_scope', 'teknoloji');
  link(b, akademi, 'enabled_by', 'idari', 'egitim'); link(b, idari, 'enabled_by', 'idari', 'fiziksel_kosullar'); link(b, opPlan, 'enabled_by', 'idari', 'vardiya_planlama');
}
const others = [];
for (let i = 0; i < 4; i++) { const u = mk('call_center', `Çağrı Merkezi ${i + 1}`, 800); link(u, gmy['Operasyon'], 'reports_to', 'idari'); others.push(u); }
for (let i = 0; i < 6; i++) { const u = mk('ops_center', `Operasyon Merkezi ${i + 1}`, 300); link(u, gmy['Operasyon'], 'reports_to', 'idari'); others.push(u); }
for (let i = 0; i < 3; i++) { const u = mk('logistics', `Lojistik Merkezi ${i + 1}`, 200); link(u, gmy['Operasyon'], 'reports_to', 'idari'); others.push(u); }
for (let i = 0; i < 4; i++) { const u = mk('subsidiary', `İştirak ${i + 1} A.Ş.`, 400); link(u, company, 'reports_to', 'idari'); others.push(u); }
[...subunits, ...others].forEach(u => link(u, cdm, 'hr_scope', 'ik'));

// çalışan sayısını ~32.000'e ölçekle
const leafs = units.filter(u => u.headcount > 0);
const total = leafs.reduce((s, u) => s + u.headcount, 0);
leafs.forEach(u => { u.headcount = Math.max(2, Math.round(u.headcount * 32000 / total)); });

// ---- kişiler: birim yöneticileri + 2.400'e tamamlayan ekip liderleri
const first = ['Ayşe', 'Mehmet', 'Zeynep', 'Ali', 'Elif', 'Can', 'Selin', 'Emre', 'Deniz', 'Burak', 'Ece', 'Kerem', 'Merve', 'Ozan', 'İpek', 'Tolga'];
const last = ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt'];
let pid = 0;
const person = (unit, role) => { const p = { external_id: `P-${String(++pid).padStart(5, '0')}`, display_name: `${pick(first)} ${pick(last)}`, primary_unit: unit.external_id, role, language: 'tr' }; persons.push(p); return p; };
person(company, 'executive');
units.filter(u => u !== company).forEach(u => person(u, u.unit_type === 'gmy' ? 'executive' : ['directorate', 'region', 'area'].includes(u.unit_type) ? 'dept_head' : 'line_manager'));
const hrbps = Array.from({ length: 18 }, (_, i) => { const p = person(cdm, 'hrbp'); p.hr_scope_region = regionNames[i]; return p; });
while (persons.length < 2400) person(pick(leafs), 'action_owner');

// ---- sonuçlar: 2026-ANA, Güven boyutu heterojen (44–82), diğer boyutlar daha dar
const dims = ['Başarı', 'Gurur', 'Güven', 'Bağlılık'];
const results = [];
const score = (u, dim) => {
  let base = 62;
  if (dim === 'Güven') {
    if (u.unit_type === 'branch') base = lowRegions.has(u.region) ? 50 : 60;
    else if (u.unit_type === 'call_center') base = 48;
    else if (u.unit_type === 'ops_center') base = 55;
    else if (['directorate', 'subunit'].includes(u.unit_type)) base = 68;
    else if (u.unit_type === 'subsidiary') base = 64;
    let s = base + between(-9, 9);
    if (u.external_id === 'SUBE-KONAK') s = 49; if (u.name === 'Ataşehir Şubesi') s = 74;
    return Math.max(44, Math.min(82, s));
  }
  let s = 66 + between(-6, 6);
  if (u.external_id === 'SUBE-KONAK' && dim === 'Başarı') s = 50; // yerel öncelik örneği: kurumsal hedefin dokunmadığı boyut
  return Math.max(45, Math.min(85, s));
};
for (const u of leafs) {
  const rate = between(0.7, 0.95); const n = Math.max(1, Math.round(u.headcount * rate));
  for (const d of dims) {
    const s = r2(score(u, d)); const raw = r2(1 + (s / 100) * 4);
    results.push({ cycle_id: '2026-ANA', unit_external_id: u.external_id, unit_name: u.name, dimension: d, item_code: `DIM-${d}`, item_version: 1, metric_type: 'likert5', raw_score: raw, scale_min: 1, scale_max: 5, favorable_pct: '', n, response_rate: r2(rate), population: u.headcount, prev_score: r2(s + between(-4, 3)) });
  }
  const enps = Math.round(between(-20, 45));
  results.push({ cycle_id: '2026-ANA', unit_external_id: u.external_id, unit_name: u.name, dimension: '', item_code: 'ENPS', item_version: 1, metric_type: 'enps', raw_score: enps, scale_min: -100, scale_max: 100, favorable_pct: '', n, response_rate: r2(rate), population: u.headcount, prev_score: '' });
}
// ağırlıklı şirket Güven skoru
const g = results.filter(r => r.dimension === 'Güven'); const W = g.reduce((s, r) => s + r.n, 0);
const companyTrust = r2(g.reduce((s, r) => s + r.n * (((r.raw_score - 1) / 4) * 100), 0) / W);

// ---- reorg ve sahiplik olayları (dönem içi, 2026-07-01)
const marmara = regions.find(r => r.name.startsWith('Marmara')), istAnadolu = regions.find(r => r.name.startsWith('İstanbul Anadolu'));
const marmaraAreas = areas.filter(a => a.name.startsWith('Marmara')).map(a => a.external_id);
const movedBranches = branches.filter(b => marmaraAreas.includes(rel.find(x => x.from === b.external_id && x.relationship_type === 'reports_to').to)).slice(0, 40).map(b => b.external_id);
const closed = branches.slice(300, 310).map(b => b.external_id);
const reorg = [
  { external_event_id: 'HRIS-REORG-2026-001', event_type: 'merge', source_unit_ids: [dirs[5].external_id, dirs[6].external_id], target_unit_ids: ['DIRECTORATE-NEW-01'], effective_date: '2026-07-01' },
  { external_event_id: 'HRIS-REORG-2026-002', event_type: 'move', source_unit_ids: movedBranches, new_parent_unit_id: areas.find(a => a.name.startsWith('İstanbul Anadolu')).external_id, hierarchy_group: 'idari', effective_date: '2026-07-01', note: `40 şube ${marmara.name} → ${istAnadolu.name}` },
  { external_event_id: 'HRIS-REORG-2026-003', event_type: 'close', source_unit_ids: closed, effective_date: '2026-07-01' },
  { external_event_id: 'HRIS-REORG-2026-004', event_type: 'open', target_unit_ids: Array.from({ length: 15 }, (_, i) => `BRANCH-NEW-${String(i + 1).padStart(2, '0')}`), new_parent_unit_id: areas[0].external_id, effective_date: '2026-07-01' },
  { external_event_id: 'HRIS-REORG-2026-002', event_type: 'move', source_unit_ids: movedBranches, effective_date: '2026-07-01', note: 'DUPLICATE — T-37 tekilleştirme testi' },
];
const leavers = persons.filter(p => p.role === 'line_manager').slice(0, 8).map(p => p.external_id);
const onLeave = persons.filter(p => p.role === 'line_manager').slice(8, 28).map(p => ({ person: p.external_id, delegate: pick(persons.filter(x => x.role === 'action_owner')).external_id, starts_at: '2026-06-01', ends_at: '2026-09-01', reason: 'leave' }));

const scenario = {
  cycle: { id: '2026-ANA', period_start: '2026-04-06', period_end: '2026-04-24', rollup_hierarchy_group: 'idari', confidentiality_threshold: 5, comment_threshold: 10 },
  hierarchy_groups: ['idari', 'cografi', 'ik', 'teknoloji'],
  company_trust_score: companyTrust, corporate_target: { dimension: 'Güven', suggested: 68, horizon_months: 9 },
  konak: { unit: 'SUBE-KONAK', trust: 49, expected_target_range: [57, 60], lever_problem: 'vardiya_planlama', accountable_unit: opPlan.external_id },
  master_action: { title: 'Aylık çalışan iletişim toplantısı', scope: { hierarchy_group: 'idari', unit_types: ['branch'] }, evidence_rule: { rule_type: 'count', expected_value: 1, window_days: 30 } },
  reorg_events: reorg.length, deprovisioned_managers: leavers, delegations: onLeave,
  torture_cases: ['same_pdf_14_actions', 'bulk_completion_17_in_24h', 'lms_83_vs_claim_200', 'n_650_to_41', 'item_wording_changed', 'budget_2m_committed_1_35m', 'offline_checkin_after_cancel'],
};

// ---- yaz
const csvHead = 'cycle_id;unit_external_id;unit_name;parent_external_id;dimension;item_code;item_version;metric_type;raw_score;scale_min;scale_max;favorable_pct;n;response_rate;population';
const parentOf = id => rel.find(x => x.from === id && x.relationship_type === 'reports_to')?.to ?? '';
const csv = [csvHead, ...results.map(r => [r.cycle_id, r.unit_external_id, r.unit_name, parentOf(r.unit_external_id), r.dimension, r.item_code, r.item_version, r.metric_type, r.raw_score, r.scale_min, r.scale_max, r.favorable_pct, r.n, r.response_rate, r.population].join(';'))].join('\n');
writeFileSync(join(OUT, 'org-units.json'), JSON.stringify(units, null, 1));
writeFileSync(join(OUT, 'relationships.json'), JSON.stringify(rel, null, 1));
writeFileSync(join(OUT, 'persons.json'), JSON.stringify(persons, null, 1));
writeFileSync(join(OUT, 'results-2026-ANA.csv'), csv);
writeFileSync(join(OUT, 'results-2026-ANA.json'), JSON.stringify(results, null, 1));
writeFileSync(join(OUT, 'reorg-events.json'), JSON.stringify(reorg, null, 1));
writeFileSync(join(OUT, 'scenario.json'), JSON.stringify(scenario, null, 1));

const suppressed = results.filter(r => r.n < 5).length;
console.log(`Atlas Holding: ${units.length} birim (${branches.length} şube, ${dirs.length} müdürlük, ${subunits.length} alt birim, ${regions.length} bölge), ${leafs.reduce((s, u) => s + u.headcount, 0)} çalışan, ${persons.length} kişi, ${rel.length} ilişki, ${results.length} sonuç satırı (${suppressed} baskılanacak), şirket Güven=${companyTrust}, ${reorg.length} reorg olayı (1 tekrar)`);

// ---- web prototipi için kompakt fixture (apps/web mock adaptörü)
const trustOf = u => { const r = results.find(x => x.unit_external_id === u.external_id && x.dimension === 'Güven'); return r ? { score: r2(((r.raw_score - 1) / 4) * 100), n: r.n, prev: r.prev_score === '' ? null : r2(((r.prev_score - 1) / 4) * 100) } : null; };
const dimsOf = u => Object.fromEntries(dims.map(d => { const r = results.find(x => x.unit_external_id === u.external_id && x.dimension === d); return [d, r ? { score: r2(((r.raw_score - 1) / 4) * 100), n: r.n, suppressed: r.n < 5 } : null]; }));
const enpsOf = u => results.find(x => x.unit_external_id === u.external_id && x.item_code === 'ENPS')?.raw_score ?? null;
const webUnits = units.map(u => { const t = trustOf(u); return { id: u.external_id, name: u.name, type: u.unit_type, parent: parentOf(u.external_id), region: u.region ?? null, population: u.headcount, trust: t ? t.score : null, prevTrust: t ? t.prev : null, n: t ? t.n : 0, suppressed: t ? t.n < 5 : false, dims: dimsOf(u), enps: enpsOf(u) }; });
const ege = regions.find(r => r.name.startsWith('Ege'));
const egeAreas = areas.filter(a => a.name.startsWith('Ege')).map(a => a.external_id);
const egeBranches = webUnits.filter(u => egeAreas.includes(u.parent));
const konak = webUnits.find(u => u.id === 'SUBE-KONAK');
const fixture = {
  generatedAt: '2026-09-22', cycle: scenario.cycle, company: { id: company.external_id, name: company.name, trust: companyTrust, n: W, target: 68, targetDate: '2027-06-30' },
  me: { id: hrbps[0].external_id, name: hrbps[0].display_name, role: 'hrbp', region: ege.name },
  konak: { ...konak, owner: persons.find(p => p.primary_unit === 'SUBE-KONAK')?.display_name },
  egeRegion: { id: ege.external_id, name: ege.name, branches: egeBranches.map(u => ({ id: u.id, name: u.name, trust: u.trust, n: u.n, population: u.population, suppressed: u.suppressed })) },
  units: webUnits,
  attention: [
    { id: 'at-1', type: 'feasibility_dropped', severity: 'critical', title: 'Ege Bölge Güven hedefi artık ulaşılamaz', entity: 'Ege Bölge Direktörlüğü · Güven 66', sla: '2 iş günü', due: '2026-09-24' },
    { id: 'at-2', type: 'orphan_ownership', severity: 'critical', title: '3 aksiyonun sahibi ayrıldı', entity: 'Şube 302, Şube 303, Şube 305', sla: '3 iş günü', due: '2026-09-25' },
    { id: 'at-3', type: 'evidence_review', severity: 'warning', title: 'Kanıt incelemesi bekliyor: aynı dosya 14 aksiyonda', entity: 'Bireysel İşler · 14 yerel uygulama', sla: '5 iş günü', due: '2026-09-29' },
    { id: 'at-4', type: 'exception_pending', severity: 'warning', title: 'İstisna talebi: Şube 118 hedef 61 → 57', entity: 'İzmir Alan Müdürlüğü 2', sla: '5 iş günü', due: '2026-09-29' },
    { id: 'at-5', type: 'handover', severity: 'warning', title: 'Devralınan 12 hedef sizi bekliyor', entity: 'Marmara → İstanbul Anadolu devri', sla: '10 iş günü', due: '2026-10-06' },
    { id: 'at-6', type: 'confidence_drop', severity: 'info', title: 'Konak Şubesi: ilerleme arttı, güven düştü', entity: 'Vardiya planlama aksiyonu · check-in', sla: '—', due: null },
    { id: 'at-7', type: 'resource_gap', severity: 'info', title: 'Bütçe açığı: 650.000 ₺ taahhüt edilmedi', entity: 'Mağaza personel eğitimi (ana aksiyon)', sla: '—', due: null },
  ],
  masterAction: { id: 'MA-1', title: 'Aylık çalışan iletişim toplantısı', scope: '400 şube', distribution: { verified: 212, partially_verified: 31, evidence_pending: 44, in_progress: 58, delayed: 37, not_started: 8, cancelled: 10 }, completionThreshold: 0.95 },
  actionProposals: [
    { id: 'ap-1', code: 'vardiya-katilimci', title: 'Vardiya planını çalışanla birlikte yap', lever: 'vardiya_planlama', impact: 'high', effort: 'medium', cost: 'none', evidence: '8 hafta içinde 2 ortak planlama toplantısı tutanağı', recommended: true, owner: 'Şube Müdürü', accountable: 'Operasyon Planlama Müdürlüğü' },
    { id: 'ap-2', code: 'birebir-programi', title: 'Aylık birebir görüşme programı', lever: 'yonetici_iletisimi', impact: 'medium', effort: 'low', cost: 'none', evidence: '3 ayda 3 görüşme kaydı (çalışan başına)', recommended: true, owner: 'Şube Müdürü', accountable: 'Şube Müdürü' },
    { id: 'ap-3', code: 'kararlarin-gerekcesi', title: 'Şube kararlarının gerekçesini haftalık paylaş', lever: 'seffaflik', impact: 'medium', effort: 'low', cost: 'none', evidence: '12 haftalık paylaşım kaydı', recommended: false, owner: 'Şube Müdürü', accountable: 'Şube Müdürü' },
  ],
  evidence: { actionTitle: 'Aylık birebir görüşme programı', requirement: { ruleType: 'count', expectedValue: 8, window: '01.10.2026 – 30.11.2026', isCritical: true, minType: 'artifact' }, submitted: 7, ladder: 'submitted', owner: 'Ayşe Yılmaz', verifier: 'Mehmet Kaya' },
};
writeFileSync(join(OUT, 'web-fixture.json'), JSON.stringify(fixture));
console.log(`web-fixture.json: ${webUnits.length} birim, Ege ${egeBranches.length} şube, Konak Güven=${konak.trust}`);
