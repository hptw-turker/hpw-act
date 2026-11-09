/** v3.0 "Planlar": iki bölme — solda yol haritaları (kurum önce), sağda seçilenin plan kartları. Tek yol haritası görenlerde sol bölme yoktur.
 * Plan kartı: madde, mevcut / karşılaştırma / hedef; önce kişinin kendi rolündeki adımlar, diğer roller bir düğmeyle açılır. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { tt } from '../i18n';
import { api, describeError } from '../api';
import { ownRole } from './Shell';
import { Counts, ItemBox, Squares, StepCard, fmtDate, isLow, phaseLabel, pct, type RoadmapDetail, type RoadmapSummary, type Step } from './parts';

export function Plans({ tid, profile }: { tid: string; profile: string | null }) {
  const { rid } = useParams(); const nav = useNavigate();
  const [list, setList] = useState<RoadmapSummary[] | null>(null); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => { try { setList((await api<{ roadmaps: RoadmapSummary[] }>('GET', `/api/t/${tid}/rm2`)).roadmaps); setErr(null); } catch (e) { setErr(describeError(e)); } }, [tid]);
  useEffect(() => { void load(); }, [load]);
  if (err) return <main className="v-main" id="main"><div className="v-page"><p className="v-alert" role="alert">{err}</p></div></main>;
  if (!list) return <main className="v-main" id="main"><div className="v-page"><p className="v-meta">{tt('Yükleniyor…')}</p></div></main>;
  if (!list.length) return <main className="v-main" id="main"><div className="v-page"><h1 className="v-h1">{tt('Planlar')}</h1><p className="v-empty">{tt('Görebileceğiniz bir yol haritası henüz yüklenmedi. Yol haritası, rapor sunumundan sonra Happy Place to Work tarafından yüklenir.')}</p></div></main>;
  const selected = rid && list.some(r => r.id === rid) ? rid : null;
  if (list.length === 1) return <main className="v-main" id="main"><div className="v-page v-narrow"><RoadmapView tid={tid} rid={list[0]!.id} profile={profile} onChanged={load} /></div></main>;
  const own = (r: RoadmapSummary) => { const o = ownRole(profile, r.layer); return o === 'IK' ? r.ik : o === 'YONETIM' ? r.management : null; };
  return <main className="v-main" id="main"><div className="v-two" data-mode={selected ? 'detail' : 'list'}>
    <nav className="v-left" aria-label={tt('Yol haritaları')}>
      <div className="v-gh"><p className="v-h3">{tt('Yol haritaları')}</p><p className="v-meta">{list[0]!.reportTitle}</p></div>
      {list.map(r => { const o = own(r); const cur = (selected ?? list[0]!.id) === r.id; return <button key={r.id} type="button" className={`v-it${cur ? ' on' : ''}`} aria-current={cur ? 'true' : undefined} onClick={() => nav(`/t/${tid}/planlar/${r.id}`)}>
        <span className="v-lbl">{r.layer === 'KURUM' ? tt('Kurum planı') : tt('İşletme')} · {tt('{0} eylem planı', r.plans)}</span>
        <span className="v-it-t">{r.unitLabel}</span>
        {o ? <><span className="v-meta">{tt('Adımlarım')}</span><Counts c={o} /></> : <>
          <span className="v-meta">{tt('İnsan Kaynakları')}</span><Counts c={r.ik} />
          <span className="v-meta">{r.layer === 'KURUM' ? tt('Yönetim') : tt('İşletme yönetimi')}</span><Counts c={r.management} />
        </>}
        {r.nextDue ? <span className="v-meta">{tt('Sıradaki termin')} · {fmtDate(r.nextDue)}</span> : null}
      </button>; })}
    </nav>
    <div className="v-right">
      <div className="v-back"><button type="button" className="v-btn2" onClick={() => nav(`/t/${tid}/planlar`)}>{tt('Listeye dön')}</button></div>
      <RoadmapView tid={tid} rid={selected ?? list[0]!.id} profile={profile} onChanged={load} />
    </div>
  </div></main>;
}

const ROLE_ORDER = (own: 'IK' | 'YONETIM' | null): ('IK' | 'YONETIM' | 'CALISAN')[] => (own === 'IK' ? ['IK', 'YONETIM', 'CALISAN'] : ['YONETIM', 'IK', 'CALISAN']);

function RoadmapView({ tid, rid, profile, onChanged }: { tid: string; rid: string; profile: string | null; onChanged: () => void }) {
  const [d, setD] = useState<RoadmapDetail | null>(null); const [err, setErr] = useState<string | null>(null); const [sp] = useSearchParams(); const scrolled = useRef('');
  const load = useCallback(async () => { try { setD(await api<RoadmapDetail>('GET', `/api/t/${tid}/rm2/${rid}`)); setErr(null); } catch (e) { setErr(describeError(e)); } }, [tid, rid]);
  useEffect(() => { setD(null); void load(); }, [load]);
  const want = sp.get('plan');
  useEffect(() => { if (!d || !want || scrolled.current === `${rid}:${want}`) return; scrolled.current = `${rid}:${want}`; const el = document.getElementById(`plan-${want}`); if (el) { el.scrollIntoView({ block: 'start' }); el.focus({ preventScroll: true }); } }, [d, want, rid]);
  if (err) return <p className="v-alert" role="alert">{err}</p>;
  if (!d) return <p className="v-meta">{tt('Yükleniyor…')}</p>;
  const own = ownRole(profile, d.layer);
  const changed = () => { void load(); onChanged(); };
  const allSteps = d.plans.flatMap(p => p.steps); const ownSteps = own ? allSteps.filter(s => s.role === own && !s.ref) : [];
  return <>
    <div className="v-field">
      <span className="v-lbl">{d.layer === 'KURUM' ? tt('Kurum yol haritası') : tt('İşletme yol haritası')} · {d.reportTitle}</span>
      <h1 className="v-h1 v-wrap">{d.unitLabel}</h1>
      {d.headline ? <p className="v-h3 v-wrap">{d.headline}</p> : null}
      {d.summary ? <p className="v-wrap">{d.summary}</p> : null}
      <p className="v-meta">{d.respondents ? <>{tt('{0} çalışan yanıt verdi', d.respondents)} · </> : null}{tt('Başlangıç')} {fmtDate(d.startDate)}{d.measurePeriod ? <> · {tt('Etkinin ölçüleceği dönem')}: {d.measurePeriod}</> : null}</p>
      {ownSteps.length ? <><span className="v-lbl">{tt('Bu yol haritasındaki adımlarım')}</span><Squares steps={ownSteps} max={40} /></> : null}
      {!d.rights.IK && !d.rights.YONETIM ? <p className="v-meta">{tt('Bu yol haritasını inceleyebilirsiniz; işaretleme yetkiniz yok.')}</p> : null}
    </div>
    {d.plans.map(p => <PlanCard key={p.id} tid={tid} plan={p} detail={d} own={own} onChanged={changed} />)}
    {d.items.length ? <section className="v-sec" aria-label={tt('İzleme göstergeleri')}>
      <h2 className="v-h2">{tt('İzleme göstergeleri')}</h2>
      <p className="v-wrap">{tt('Bir sonraki ölçümde bu maddelerin değeri raporla karşılaştırılır. Kırmızı: mevcut değer {0} altında.', d.comparisonLabel ?? tt('karşılaştırma değerinin'))}</p>
      <ScaleLegend cmp={d.comparisonLabel ?? tt('Karşılaştırma')} />
      <div className="v-srows">{d.items.map(i => <ScaleRow key={i.ord} item={i} cmp={d.comparisonLabel ?? tt('Karşılaştırma')} />)}</div>
    </section> : null}
  </>;
}

function PlanCard({ tid, plan, detail, own, onChanged }: { tid: string; plan: RoadmapDetail['plans'][number]; detail: RoadmapDetail; own: 'IK' | 'YONETIM' | null; onChanged: () => void }) {
  const [others, setOthers] = useState(!own);
  const roles = ROLE_ORDER(own).filter(r => plan.steps.some(s => s.role === r));
  const mine = own ? plan.steps.filter(s => s.role === own) : [];
  const shown = roles.filter(r => r !== own);
  const phases = (steps: Step[], isMine: boolean) => ([30, 90, 180] as const).filter(ph => steps.some(s => s.phaseDays === ph)).map(ph => { const list = steps.filter(s => s.phaseDays === ph); return <div key={ph} className="v-ph">
    <p className="v-h3">{phaseLabel(ph)} <span className="v-meta">· {list[0]!.role === 'CALISAN' ? '' : `${tt('Termin')} ${fmtDate(list[0]!.dueDate)}`}</span></p>
    {list.map(s => <StepCard key={s.id} tid={tid} step={s} today={detail.today} mine={isMine} onChanged={onChanged} />)}
  </div>; });
  const roleLabel = (r: string) => plan.steps.find(s => s.role === r)?.roleLabel ?? r;
  return <section className="v-sec v-plancard" id={`plan-${plan.no}`} tabIndex={-1} aria-label={`${tt('Eylem planı')} ${plan.no}`}>
    <span className="v-lbl">{detail.layer === 'KURUM' ? `${tt('Kurum planı')} · ` : ''}{tt('Eylem planı')} {plan.no}</span>
    <h2 className="v-h1 v-plant v-wrap">{plan.title}</h2>
    <ItemBox plan={plan} comparisonLabel={detail.comparisonLabel} />
    {own && mine.length ? <div className="v-role"><p className="v-h2">{tt('Bu plandaki adımlarım')}</p><Squares steps={mine.filter(s => !s.ref)} /><p className="v-meta">{roleLabel(own)}</p>{phases(mine, true)}</div> : null}
    {own ? <div className="v-btns"><button type="button" className="v-btn2" aria-expanded={others} onClick={() => setOthers(o => !o)}>{others ? tt('Diğer rollerin adımlarını gizle') : tt('Diğer rollerin adımlarını göster')}</button></div> : null}
    {others ? shown.map(r => <div key={r} className="v-role"><p className="v-h2">{roleLabel(r)}</p>
      {r === 'CALISAN' ? <p className="v-meta">{tt('Çalışanların katkısı bilgi için gösterilir; işaretlenmez.')}</p> : <Squares steps={plan.steps.filter(s => s.role === r && !s.ref)} />}
      {phases(plan.steps.filter(s => s.role === r), false)}</div>) : null}
    <p className="v-meta"><Link to={`/t/${tid}/planlar/${detail.id}?plan=${plan.no}`}>{tt('Bu planın bağlantısı')}</Link></p>
  </section>;
}

/** R-11 · İzleme göstergeleri — Alternatif 3 · ölçek çizgisi. Değerler rapordan (rm2_item) gelir; eksik değer çizilmez ve "—" yazılır.
 * Hedef: rapordaki metinden yalnız açık bir yüzde okunursa işaret çizilir; "İzlenir" ifadesi korunur, sayısal işaret çizilmez.
 * Yakın ya da eşit değerlerde işaretler üst üste binmesin diye hedef çizginin üstünde, sektör altında, karşılaştırma ortasından geçer. */
type Item = RoadmapDetail['items'][number];
export function parseTarget(label: string | null): { kind: 'num'; v: number } | { kind: 'tracked' } | { kind: 'text'; t: string } | { kind: 'none' } {
  const t = (label ?? '').trim(); if (!t) return { kind: 'none' };
  if (['izlenir', 'İzlenir', 'IZLENIR', 'İZLENİR', 'Tracked', 'tracked'].includes(t)) return { kind: 'tracked' };
  const m = /^%?\s*(\d{1,3}(?:[.,]\d+)?)\s*%?$/.exec(t); if (m) { const v = Number(m[1]!.replace(',', '.')); if (v >= 0 && v <= 100) return { kind: 'num', v }; }
  return { kind: 'text', t };
}
const clamp = (v: number) => Math.max(0, Math.min(100, v));
function ScaleLegend({ cmp }: { cmp: string }) {
  return <div className="v-legend" aria-hidden="true"><span><span className="v-key k-cur" />{tt('Mevcut')}</span><span><span className="v-key k-low" />{tt('Mevcut')} · {tt('genelin altında')}</span><span><span className="v-key k-cmp" />{cmp}</span><span><span className="v-key k-sec" />{tt('Sektör')}</span><span><span className="v-key k-tgt" />{tt('Hedef')}</span></div>;
}
function ScaleRow({ item: i, cmp }: { item: Item; cmp: string }) {
  const low = isLow(i.currentPct, i.comparisonPct); const tg = parseTarget(i.target);
  const tgText = tg.kind === 'num' ? pct(tg.v) : tg.kind === 'tracked' ? tt('İzlenir') : tg.kind === 'text' ? tg.t : '—';
  const aria = `${tt('Mevcut')} ${pct(i.currentPct)}, ${cmp} ${pct(i.comparisonPct)}, ${tt('Sektör')} ${pct(i.sectorPct)}, ${tt('Hedef')} ${tgText}`;
  return <div className="v-srow">
    <div><span className="v-lbl v-wrap">{i.itemCode}{i.link ? ` · ${i.link}` : ''}</span><p className="v-it v-wrap">{i.itemText}</p></div>
    <div className="v-scol">
      <div className="v-scale" role="img" aria-label={aria}>
        <span className="v-track" />
        {i.currentPct !== null ? <span className={`v-fill${low ? ' low' : ''}`} style={{ width: `${clamp(i.currentPct)}%` }} /> : null}
        {i.sectorPct !== null ? <span className="v-tick sec" style={{ left: `${clamp(i.sectorPct)}%` }} /> : null}
        {i.comparisonPct !== null ? <span className="v-tick cmp" style={{ left: `${clamp(i.comparisonPct)}%` }} /> : null}
        {tg.kind === 'num' ? <span className="v-tick tgt" style={{ left: `${clamp(tg.v)}%` }} /> : null}
      </div>
      <div className="v-axis" aria-hidden="true"><span>0</span><span>50</span><span>100</span></div>
      <div className="v-nums"><span>{tt('Mevcut')} <b className={low ? 'v-low' : undefined}>{pct(i.currentPct)}</b></span><span>{cmp} <b>{pct(i.comparisonPct)}</b></span><span>{tt('Sektör')} <b>{pct(i.sectorPct)}</b></span><span>{tt('Hedef')} <b>{tgText}</b></span></div>
    </div>
  </div>;
}
