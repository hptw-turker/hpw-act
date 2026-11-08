/** v3.0 "Bugün": giriş yapan kişinin kendi rolündeki adımlar, termine göre — önce gecikenler, sonra sıradaki terminler, yapılanlar en altta kapalı. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { tt } from '../i18n';
import { api, describeError } from '../api';
import { PROFILE_LABEL } from './Shell';
import { Squares, StepCard, fmtDate, daysBetween, phaseLabel, pct, type MyStep } from './parts';

interface MeSteps { today: string; counts: { total: number; done: number; late: number; open: number }; steps: MyStep[] }

export function Today({ tid, profile }: { tid: string; profile: string | null }) {
  const [d, setD] = useState<MeSteps | null>(null); const [err, setErr] = useState<string | null>(null); const [showDone, setShowDone] = useState(false);
  const [by, setBy] = useState<'date' | 'unit'>('date');
  /** Bu oturumda işaretlenen adım, yeniden yüklemeye kadar bulunduğu grupta kalır (kart altından kaymaz) */
  const sticky = useRef(new Map<string, string>());
  const load = useCallback(async () => { try { setD(await api<MeSteps>('GET', `/api/t/${tid}/rm2/me`)); setErr(null); } catch (e) { setErr(describeError(e)); } }, [tid]);
  useEffect(() => { void load(); }, [load]);
  const units = useMemo(() => [...new Map((d?.steps ?? []).map(s => [s.roadmapId, { id: s.roadmapId, label: s.unitLabel, layer: s.layer }])).values()], [d]);
  if (err) return <main className="v-main" id="main"><div className="v-page"><p className="v-alert" role="alert">{err}</p><button type="button" className="v-link" onClick={() => void load()}>{tt('Yeniden dene')}</button></div></main>;
  if (!d) return <main className="v-main" id="main"><div className="v-page"><p className="v-meta">{tt('Yükleniyor…')}</p></div></main>;
  const t = d.today;
  const grp = (s: MyStep) => sticky.current.get(s.id) ?? s.status;
  const changed = (s: MyStep) => () => { if (!sticky.current.has(s.id)) sticky.current.set(s.id, s.status); void load(); };
  const late = d.steps.filter(s => grp(s) === 'LATE'); const open = d.steps.filter(s => grp(s) === 'OPEN'); const done = d.steps.filter(s => grp(s) === 'DONE');
  const byDue = new Map<string, MyStep[]>(); for (const s of open) byDue.set(s.dueDate, [...(byDue.get(s.dueDate) ?? []), s]);
  const next = open[0]?.dueDate ?? null;
  const ctx = (s: MyStep) => <p className="v-meta v-wrap">{units.length > 1 ? <><b>{s.unitLabel}</b> · </> : null}{tt('Eylem planı')} {s.plan.no} · {s.plan.title} · {s.plan.itemCode} {pct(s.plan.currentPct)} → {s.plan.targetKind === 'HEDEF' ? pct(s.plan.targetPct) : tt('İzlenir')} · <Link to={`/t/${tid}/planlar/${s.roadmapId}?plan=${s.plan.no}`}>{tt('Planı incele')}</Link></p>;
  const card = (s: MyStep) => <StepCard key={s.id} tid={tid} step={s} today={t} mine context={ctx(s)} onChanged={changed(s)} />;
  const roleName = d.steps[0]?.roleLabel;
  const plans = [...new Map(d.steps.map(s => [`${s.roadmapId}:${s.plan.no}`, s])).values()];
  return <main className="v-main" id="main"><div className="v-page">
    <div className="v-today-head">
      <div><h1 className="v-h1">{tt('Bugün yapılacaklar')}</h1><p className="v-sub">{roleName ? tt('{0} adımları, termine göre sıralı', roleName) : PROFILE_LABEL(profile)}</p></div>
      {d.steps.length ? <div className="v-today-sum"><Squares steps={d.steps} max={40} />{next ? <span className="v-meta">{tt('Sıradaki termin')}: <b>{fmtDate(next)}</b> · {tt('{0} gün kaldı', daysBetween(t, next))}</span> : null}</div> : null}
    </div>
    {!d.steps.length ? <div className="v-empty"><p>{tt('Size atanmış bir yol haritası adımı yok.')}</p><p><Link to={`/t/${tid}/planlar`}>{tt('Planları incele')}</Link></p></div> :
    <div className="v-today">
      <div className="v-today-main">
        {units.length > 1 ? <div className="v-btns" role="group" aria-label={tt('Gruplama')}><button type="button" className="v-opt" aria-pressed={by === 'date'} onClick={() => setBy('date')}>{tt('Tarihe göre')}</button><button type="button" className="v-opt" aria-pressed={by === 'unit'} onClick={() => setBy('unit')}>{tt('Yol haritasına göre')}</button></div> : null}
        {by === 'unit' ? units.map(u => { const list = d.steps.filter(s => s.roadmapId === u.id && grp(s) !== 'DONE'); const all = d.steps.filter(s => s.roadmapId === u.id); return <section key={u.id} className="v-group" aria-label={u.label}>
          <h2 className="v-h2">{u.label}{u.layer === 'KURUM' ? <span className="v-sub"> · {tt('Kurum planı')}</span> : null}</h2><Squares steps={all} />
          {list.length ? list.map(card) : <p className="v-empty">{tt('Bu yol haritasında açık adımınız yok.')}</p>}
        </section>; }) : <>
          {late.length ? <section className="v-group"><h2 className="v-h2">{tt('Geciken adımlar')} <span className="v-sub">· {late.length}</span></h2>{late.map(card)}</section> : null}
          {[...byDue.entries()].map(([due, list]) => <section key={due} className="v-group"><h2 className="v-h2">{tt('{0} tarihine kadar', fmtDate(due))} <span className="v-sub">· {phaseLabel(list[0]!.phaseDays)} · {tt('{0} gün kaldı', daysBetween(t, due))}</span></h2>{list.map(card)}</section>)}
          {!late.length && !open.length ? <p className="v-ok">{tt('Açık adımınız yok. Bütün adımlarınız yapıldı.')}</p> : null}
        </>}
        {done.length ? <section className="v-group"><h2 className="v-h2">{tt('Yapılanlar')} <span className="v-sub">· {done.length}</span></h2>
          <div className="v-btns"><button type="button" className="v-btn2" aria-expanded={showDone} onClick={() => setShowDone(x => !x)}>{showDone ? tt('Yapılanları gizle') : tt('Yapılanları göster')}</button></div>
          {showDone ? done.map(card) : null}</section> : null}
      </div>
      <aside className="v-side" aria-label={tt('Planlarım')}>
        <h2 className="v-h2">{tt('Planlarım')}</h2>
        <div className="v-side-list">{plans.slice(0, 12).map(s => { const mine = d.steps.filter(x => x.roadmapId === s.roadmapId && x.plan.no === s.plan.no); return <div key={`${s.roadmapId}:${s.plan.no}`} className="v-side-it">
          <span className="v-lbl">{units.length > 1 ? `${s.unitLabel} · ` : ''}{tt('Eylem planı')} {s.plan.no}</span>
          <p className="v-h3 v-wrap">{s.plan.title}</p>
          <p className="v-meta v-wrap">{s.plan.itemCode} · {s.plan.itemText}</p>
          <p>{tt('Mevcut')} <b>{pct(s.plan.currentPct)}</b> · {tt('Hedef')} <b>{s.plan.targetKind === 'HEDEF' ? pct(s.plan.targetPct) : tt('İzlenir')}</b></p>
          <Squares steps={mine} />
          <div className="v-btns"><Link className="v-btn2" to={`/t/${tid}/planlar/${s.roadmapId}?plan=${s.plan.no}`}>{tt('Planı incele')}</Link></div>
        </div>; })}</div>
        {plans.length > 12 ? <Link to={`/t/${tid}/planlar`}>{tt('Bütün planlar')}</Link> : null}
      </aside>
    </div>}
  </div></main>;
}
