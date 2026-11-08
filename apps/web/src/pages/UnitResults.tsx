import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { data } from '../api/mock';
import { itemPriorities, unitIndex, dimensionSpread, ATLAS_INSTRUMENT } from '../api/items';
import { Kicker } from '../components/Kicker';
import { Field } from '../components/Field';
import { Score, Delta } from '../components/Score';
import { usePersona } from '../state/persona';
import { CENTER_LABEL } from '@hpw-act/domain-core';
import { useStore } from '../state/store';
import { metricsForScale } from '../lib/scoring';

const AREA: Record<string, string> = { work: 'işim', manager: 'yöneticim', colleagues: 'çalışma arkadaşlarım', employer_brand: 'işveren markası', system: 'sistem / politika', self: 'kişisel eğilim', outcome: 'sonuç' };
const DEC: Record<string, string> = { numeric_target_and_actions: 'Sayısal hedef + aksiyon', validation_required: 'Doğrulama gerekli', recommended_target: 'Önerilen hedef', monitor: 'İzle', no_action: 'Hedef yok' };
/** Birim sonuçları (v2.4): takip birimi MADDE. Boyut ortalaması boyut içi yayılımı gizler; her maddenin etkileşim alanı, sorumluluk merkezi ve yetkili rolü ayrı. Büyük sayı: Wellbeing Index (sertifikasyon indeksi; görünüm, hedef değil). */
export default function UnitResults() {
  const { t, fmt } = useI18n();
  const branches = useMemo(() => {
    const ege = new Set(data.egeRegion.branches.map(b => b.id));
    const first = data.units.filter(u => ege.has(u.id)); const small = data.units.filter(u => u.suppressed).slice(0, 5);
    const rest = data.units.filter(u => (u.type === 'branch' || u.type === 'subunit') && !ege.has(u.id) && !u.suppressed).slice(0, 60);
    return [...first, ...small, ...rest];
  }, []);
  const { persona } = usePersona(); const admin = useStore().admin;
  const uploaded = admin.cycles.flatMap(c => Object.keys(c.results).map(code => ({ id: `UP-${c.code}-${code}`, name: `${admin.units.find(u => u.code === code)?.name ?? code} (yüklenen · ${c.code})`, cycle: c.code, code })));
  const locked = persona.scope === 'unit' && persona.unitId;
  const [id, setId] = useState(locked ? persona.unitId! : uploaded[0]?.id ?? 'SUBE-KONAK');
  const [moduleFilter, setModuleFilter] = useState<'all' | 'core' | 'ecosystem' | 'custom'>('all');
  if (id.startsWith('UP-')) return <UploadedUnit sel={uploaded.find(x => x.id === id)!} options={[...uploaded.map(x => ({ id: x.id, name: x.name })), ...branches.map(b => ({ id: b.id, name: b.name }))]} setId={setId} />;
  const u = data.units.find(x => x.id === id)!;
  const wbi = unitIndex(u.id, 'WBI'); const eng = unitIndex(u.id, 'ENG');
  const rows = itemPriorities(u.id);
  const dims = ATLAS_INSTRUMENT.dimensions.filter(d => moduleFilter === 'all' || (moduleFilter === 'core' ? d.module === 'core' || d.module === 'engagement' : d.module === moduleFilter));
  const lowest = rows.filter(r => r.score !== null && r.roles.targetable).sort((a, b) => a.score! - b.score!)[0];
  const highest = rows.filter(r => r.score !== null).sort((a, b) => b.score! - a.score!)[0];
  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12 row row--between">
            <Kicker>{t('results.kicker')} · {ATLAS_INSTRUMENT.instrumentCode} {ATLAS_INSTRUMENT.version} · {ATLAS_INSTRUMENT.items.length} madde · {ATLAS_INSTRUMENT.dimensions.length} boyut · puanlama {ATLAS_INSTRUMENT.scoringRuleVersion} (Top Box)</Kicker>
            {locked ? <span className="caption">Kapsam: yalnız {persona.unitLabel}</span> : <div style={{ minWidth: '24ch' }}>
              <Field id="unit" kind="select" label={t('target.unit')} value={id} onChange={e => setId(e.target.value)}>{uploaded.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Field>
            </div>}
          </div>
          <div className="col-6">
            <p className="display-xxl red num enter" aria-label={u.suppressed ? t('results.suppressed') : `Wellbeing Index ${fmt(wbi.value ?? 0)}`}><Score value={u.suppressed ? null : wbi.value} suppressed={u.suppressed} /></p>
            <h1 className="h2" style={{ marginTop: 'var(--s-2)' }}>{u.suppressed ? `${u.name}: ${t('results.suppressed')}` : `${u.name}: Wellbeing Index ${fmt(wbi.value ?? 0)} · Bağlılık ${fmt(eng.value ?? 0)}. İndeks görünümdür; karar madde düzeyinde.`}</h1>
            {!u.suppressed ? <p className="body-l" style={{ marginTop: 'var(--s-1)' }}>{u.n} yanıt / {u.population} çalışan · en düşük hedeflenebilir madde: "{lowest?.item.text}" {fmt(lowest?.score ?? 0)} · en yüksek: "{highest?.item.text}" {fmt(highest?.score ?? 0)}</p> : null}
          </div>
          <div className="col-6 stack">
            <Kicker>Neden madde, neden boyut değil</Kicker>
            <p className="body-l measure">Aynı boyutun iki maddesi bambaşka yerlere gidebilir: Gurur boyutunda "iş yerinin ismini söylemekten gurur duyuyorum" işveren markasıdır ve merkezde çözülür; "hak ettiğim pozisyonlara geleceğime inanıyorum" kariyer sistemidir. Boyut ortalaması bunu gizler. Bu yüzden hedef, aksiyon, kanıt ve sonuç maddeye bağlanır; boyut ve indeks yalnız görünüm ve projeksiyondur.</p>
            <div className="row">
              {(['all', 'core', 'ecosystem', 'custom'] as const).map(m => <button key={m} type="button" className={`link caption${moduleFilter === m ? ' bold' : ''}`} onClick={() => setModuleFilter(m)}>{({ all: 'Bütün maddeler', core: 'Sertifikasyon çekirdeği', ecosystem: 'Ekosistem modülü', custom: 'Şirkete özel' } as Record<string, string>)[m]}</button>)}
            </div>
          </div>
        </div>
      </section>
      {dims.map(d => { const items = rows.filter(r => r.item.dimensionCode === d.code); if (!items.length) return null; const sp = dimensionSpread(u.id, d.code); return (
        <section key={d.code} className="section--tight surface-white">
          <div className="container stack-1">
            <Kicker>{d.name}{d.category ? ` · ${d.category}` : ''} · {d.module === 'core' ? 'sertifikasyon çekirdeği' : d.module === 'engagement' ? 'sonuç alanı (hedef değil)' : d.module === 'ecosystem' ? 'teşhis modülü' : 'şirkete özel (benchmark yok)'} · boyut ortalaması {sp.mean === null ? '—' : fmt(sp.mean)} · yayılım {sp.min === null ? '—' : `${fmt(sp.min)}–${fmt(sp.max!)}`}</Kicker>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Madde</th><th className="num">Top Box</th><th className="num">Şirket Δ</th><th className="num">Sertifikalı Δ</th><th className="num">n</th><th>Etkileşim alanı</th><th>Sorumluluk merkezi</th><th>Müdahaleye yetkili</th><th>Karar</th></tr></thead>
              <tbody>{items.map(r => (
                <tr key={r.item.code}><td>{r.item.text}<span className="caption"> · {r.item.code}</span></td>
                  <td className="num bold"><Score value={r.score} suppressed={r.suppressed} /></td>
                  <td className="num">{r.score !== null ? <Delta value={r.score - r.companyValue} /> : '—'}</td>
                  <td className="num">{r.score !== null && r.item.origin !== 'custom' ? <Delta value={r.score - r.benchmarkCertified} /> : '—'}</td>
                  <td className="num">{r.n}</td><td className="caption">{AREA[r.item.interactionArea]}</td><td className="caption">{CENTER_LABEL[r.item.responsibilityCenter]}</td><td className="caption">{r.roles.interventionOwnerRole}</td>
                  <td className="caption">{r.assessment ? DEC[r.assessment.decision] : 'Gizli · üst birim önceliği kapsamında'}</td></tr>))}</tbody>
            </table></div>
          </div>
        </section>); })}
      <section className="section--tight surface-white"><div className="container"><p className="caption">Şiddet ≥75 kritik, 55–74 önerilen, 30–54 izle; veri güveni Düşük iken sayısal hedef verilmez. Bağlılık maddeleri ve kişisel eğilim maddeleri (Yılmazlık) sonuç ya da izleme alanıdır; doğrudan kaldıracı olmadığı için hedef bağlanmaz. Sorumluluk merkezi maddeden gelir: yönetici maddesi şubede, İK politikası ve kariyer sistemi maddesi merkezde çözülür; şubeden beklenen izleme ve yerel uygulamadır.</p></div></section>
    </>
  );
}

/** Excel ile yüklenen gerçek sonuçlar: madde metni yayımlı soru setinden, değer/n/gizlilik yüklenen paketten. */
function UploadedUnit({ sel, options, setId }: { sel: { id: string; name: string; cycle: string; code: string }; options: { id: string; name: string }[]; setId: (id: string) => void }) {
  const admin = useStore().admin; const cyc = admin.cycles.find(c => c.code === sel.cycle)!; const res = cyc.results[sel.code] ?? {};
  const items = admin.instrument?.items ?? [];
  const rows = items.flatMap(i => metricsForScale(i.scaleCode).map(m => ({ item: i, metric: `${i.code}${m.suffix}`, r: res[`${i.code}${m.suffix}`] })));
  const dims = [...new Map(items.map(i => [i.dimensionCode ?? '', i.dimensionLabel || 'Boyutsuz'])).entries()];
  const company = (metric: string) => { const vals = Object.values(cyc.results).map(u => u[metric]).filter(x => !!x && x.value !== null) as { n: number; value: number }[]; const W = vals.reduce((s, x) => s + x.n, 0); return W ? Math.round((vals.reduce((s, x) => s + x.value * x.n, 0) / W) * 10) / 10 : null; };
  return (
    <>
      <section className="section surface-white"><div className="container grid">
        <div className="col-12 row row--between"><Kicker>Birim sonuçları · yüklenen paket · {sel.cycle} · madde düzeyi · Top Box</Kicker><div style={{ minWidth: '28ch' }}><Field id="unit" kind="select" label="Birim" value={sel.id} onChange={e => setId(e.target.value)}>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</Field></div></div>
        <div className="col-12"><h1 className="h2">{sel.name}: {rows.filter(x => x.r).length} metrik yüklendi{rows.some(x => x.r?.status === 'SUPPRESSED') ? ' · gizli hücreler sayı göstermez' : ''}</h1><p className="caption">Değerler Excel paketinden (dağılımdan yeniden hesaplanmış ya da resmî); şirket Δ, yüklenen bütün birimlerin yanıt ağırlıklı ortalamasına göre.</p></div>
      </div></section>
      {dims.map(([dc, dn]) => { const rs = rows.filter(x => (x.item.dimensionCode ?? '') === dc); if (!rs.length) return null; return <section key={dc} className="section--tight surface-white"><div className="container stack-1"><Kicker>{dn}</Kicker><div className="table-wrap"><table className="table"><thead><tr><th>Madde</th><th>Metrik</th><th className="num">Değer</th><th className="num">Şirket Δ</th><th className="num">n</th><th>Durum</th><th>Sorumluluk merkezi</th><th>Hedef politikası</th></tr></thead><tbody>{rs.map(x => { const c = company(x.metric); return <tr key={x.metric}><td>{x.item.text}<span className="caption"> · {x.item.code}</span></td><td className="caption">{x.metric.endsWith('_NPS') ? 'NPS' : 'Top Box'}</td><td className="num bold">{x.r ? (x.r.value === null ? '—' : x.r.value) : '—'}</td><td className="num">{x.r && x.r.value !== null && c !== null ? (Math.round((x.r.value - c) * 10) / 10) : '—'}</td><td className="num">{x.r?.n ?? '—'}</td><td className="caption">{x.r ? (x.r.status === 'SUPPRESSED' ? 'gizli' : x.r.status === 'OFFICIAL' ? 'resmî' : 'gözlenen') : 'yüklenmedi'}</td><td className="caption">{x.item.responsibilityCenter}</td><td className="caption">{x.item.targetPolicy}</td></tr>; })}</tbody></table></div></div></section>; })}
    </>
  );
}
