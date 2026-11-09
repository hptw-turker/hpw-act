/** v3.0 "Bugün": giriş yapan kişinin kendi rolündeki adımlar, termine göre — önce gecikenler, sonra sıradaki terminler, yapılanlar en altta kapalı. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { tt } from '../i18n';
import { api, describeError } from '../api';
import { PROFILE_LABEL } from './Shell';
import { BlockerBox, Squares, StepCard, fmtDate, fmtDateTime, daysBetween, phaseLabel, pct, type MyStep } from './parts';

/** R-07: İK'ya, yetkili olduğu işletmelerden gelen açık engeller */
interface HrBlocker { id: string; stepId: string; roadmapId: string; planNo: number; unitLabel: string; layer: string; roleLabel: string; stepText: string; text: string; by: string | null; at: string }
interface MeSteps { today: string; counts: { total: number; done: number; late: number; open: number }; steps: MyStep[] }

export function Today({ tid, profile }: { tid: string; profile: string | null }) {
  const [d, setD] = useState<MeSteps | null>(null); const [err, setErr] = useState<string | null>(null); const [showDone, setShowDone] = useState(false);
  const [by, setBy] = useState<'date' | 'unit'>('date');
  /** Bu oturumda işaretlenen adım, yeniden yüklemeye kadar bulunduğu grupta kalır (kart altından kaymaz) */
  const sticky = useRef(new Map<string, string>());
  const [hrb, setHrb] = useState<{ enabled: boolean; items: HrBlocker[] } | null>(null);
  const load = useCallback(async () => { try { setD(await api<MeSteps>('GET', `/api/t/${tid}/rm2/me`)); setErr(null); } catch (e) { setErr(describeError(e)); }
    try { setHrb(await api<{ enabled: boolean; items: HrBlocker[] }>('GET', `/api/t/${tid}/rm2/blockers`)); } catch { setHrb(null); /* engel listesi okunamazsa Bugün listesi yine gösterilir */ } }, [tid]);
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
  const ctx = (s: MyStep) => <p className="v-meta v-wrap">{units.length > 1 ? <><b>{s.unitLabel}</b> · </> : null}{tt('Eylem planı')} {s.plan.no} · {s.plan.title} · {s.plan.itemCode} {pct(s.plan.currentPct)} → {s.plan.targetKind === 'HEDEF' ? pct(s.plan.targetPct) : tt('İzlenir')}</p>;
  const card = (s: MyStep) => <StepCard key={s.id} tid={tid} step={s} today={t} mine context={ctx(s)} planTo={`/t/${tid}/planlar/${s.roadmapId}?plan=${s.plan.no}`} onChanged={changed(s)} />;
  const roleName = d.steps[0]?.roleLabel;
  return <main className="v-main" id="main"><div className="v-page">
    <div className="v-today-head">
      <div><h1 className="v-h1">{tt('Bugün yapılacaklar')}</h1><p className="v-sub">{roleName ? tt('{0} adımları, termine göre sıralı', roleName) : PROFILE_LABEL(profile)}</p></div>
      {d.steps.length ? <div className="v-today-sum"><Squares steps={d.steps} max={40} />{next ? <span className="v-meta">{tt('Sıradaki termin')}: <b>{fmtDate(next)}</b> · {tt('{0} gün kaldı', daysBetween(t, next))}</span> : null}</div> : null}
    </div>
    {hrb?.enabled ? <section className="v-group v-hrb" aria-label={tt('İşletmelerden gelen engeller')}>
      <h2 className="v-h2">{tt('İşletmelerden gelen engeller')} <span className="v-sub">· {hrb.items.length}</span></h2>
      <p className="v-sub">{tt('İşletme yöneticilerinin bildirdiği, çözümü sizden beklenen durumlar')}</p>
      <div className="v-blist">{hrb.items.length ? hrb.items.map(b => <BlockerBox key={b.id} list tid={tid} stepId={b.stepId} blocker={{ id: b.id, text: b.text, by: b.by, at: b.at }} canUnblock onChanged={() => void load()}
        head={<span className="v-lbl">{b.unitLabel} · {tt('Eylem planı')} {b.planNo} · {b.by ?? '—'} · {fmtDateTime(b.at)}</span>}
        after={<p className="v-meta v-wrap">{b.roleLabel} · {b.stepText}</p>}
        actions={<Link className="v-btn2" to={`/t/${tid}/planlar/${b.roadmapId}?plan=${b.planNo}`}>{tt('Planı incele')}</Link>} />) : <p className="v-meta v-blist-empty">{tt('Açık engel yok.')}</p>}</div>
    </section> : null}
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
    </div>}
  </div></main>;
}
