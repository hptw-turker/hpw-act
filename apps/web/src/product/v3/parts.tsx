/** v3.0 ortak parçalar: veri tipleri, tarih, kareler, durum kelimesi, madde kutusu, adım kartı, yardım paneli. */
import { useState, type ReactNode } from 'react';
import { tt, LANG } from '../i18n';
import { commandApi, describeError } from '../api';

export type StepStatus = 'DONE' | 'OPEN' | 'LATE' | 'INFO';
export interface Plan { id: string; no: number; title: string; itemCode: string; itemText: string; respondents: number | null; currentPos: number | null; currentPct: number | null; comparisonPct: number | null; targetKind: 'HEDEF' | 'IZLENIR'; targetPos: number | null; targetPct: number | null; responsibility: string | null; impact: string | null; }
export interface Step { id: string; role: 'IK' | 'YONETIM' | 'CALISAN'; roleLabel: string; phaseDays: 30 | 90 | 180; ord: number; text: string; output: string | null; contribution: string | null; dueDate: string; status: StepStatus; note: string | null; statusAt: string | null; updatedBy: string | null; version: number; canMark: boolean; ref: { label: string; text: string; output: string | null } | null; }
export interface MyStep extends Step { roadmapId: string; layer: 'KURUM' | 'ISLETME'; unitCode: string; unitLabel: string; plan: Plan; }
export interface RoadmapSummary { id: string; layer: 'KURUM' | 'ISLETME'; unitCode: string; unitLabel: string; respondents: number | null; cycleCode: string; reportTitle: string; headline: string | null; startDate: string; measurePeriod: string | null; plans: number; targets: number; ik: { total: number; done: number; late: number }; management: { total: number; done: number; late: number }; nextDue: string | null; }
export interface RoadmapDetail { id: string; status: string; layer: 'KURUM' | 'ISLETME'; unitCode: string; unitLabel: string; respondents: number | null; comparisonLabel: string | null; headline: string | null; summary: string | null; reportTitle: string; cycleCode: string; startDate: string; measurePeriod: string | null; today: string; rights: { IK: boolean; YONETIM: boolean }; plans: (Plan & { steps: Step[] })[]; items: { ord: number; itemCode: string; itemText: string; link: string | null; currentPct: number | null; comparisonPct: number | null; sectorPct: number | null; target: string | null }[]; }

/** YYYY-MM-DD → GG.AA.YYYY (iki dilde aynı biçim; raporla birebir) */
export const fmtDate = (d: string | null | undefined) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '—');
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const pct = (v: number | null | undefined) => { if (v === null || v === undefined) return '—'; const x = v.toLocaleString(LANG === 'en' ? 'en-GB' : 'tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); return LANG === 'en' ? `${x}%` : `%${x}`; };
export const phaseLabel = (p: number) => (p === 30 ? tt('İlk 30 gün') : p === 90 ? tt('İlk 90 gün') : tt('İlk 6 ay'));
export const statusWord = (s: StepStatus) => (s === 'DONE' ? tt('Yapıldı') : s === 'LATE' ? tt('Gecikti') : s === 'INFO' ? tt('Bilgi için') : tt('Yapılmadı'));

export function Squares({ steps, max = 30 }: { steps: { status: StepStatus }[]; max?: number }) {
  const t = steps.filter(s => s.status !== 'INFO'); const d = t.filter(s => s.status === 'DONE').length; const l = t.filter(s => s.status === 'LATE').length;
  return <div className="v-sqline">
    {t.length <= max ? <span className="v-sqs" role="img" aria-label={tt('{0} / {1} yapıldı', d, t.length)}>{t.map((s, i) => <span key={i} className={`v-sq${s.status === 'DONE' ? ' on' : ''}`} />)}</span> : null}
    <span className="v-cnt">{tt('{0} / {1} yapıldı', d, t.length)}</span>
    {l ? <span className="v-st v-st-LATE">{tt('{0} adım gecikti', l)}</span> : null}
  </div>;
}
export function Counts({ c }: { c: { total: number; done: number; late: number } }) {
  return <div className="v-sqline">
    {c.total <= 30 ? <span className="v-sqs" aria-hidden="true">{Array.from({ length: c.total }, (_, i) => <span key={i} className={`v-sq${i < c.done ? ' on' : ''}`} />)}</span> : null}
    <span className="v-cnt">{tt('{0} / {1} yapıldı', c.done, c.total)}</span>{c.late ? <span className="v-st v-st-LATE">{tt('{0} adım gecikti', c.late)}</span> : null}
  </div>;
}
export const StatusTag = ({ s }: { s: StepStatus }) => <span className={`v-st v-st-${s}`}>{statusWord(s)}</span>;

export function DueLine({ step, today }: { step: Step; today: string }) {
  const extra = step.status === 'OPEN' ? ` · ${tt('{0} gün kaldı', daysBetween(today, step.dueDate))}` : step.status === 'LATE' ? ` · ${tt('{0} gün geçti', daysBetween(step.dueDate, today))}` : '';
  return <span className="v-meta">{phaseLabel(step.phaseDays)} · {tt('Termin')} {fmtDate(step.dueDate)}{extra}</span>;
}

/** Madde kutusu: anket maddesi, mevcut / karşılaştırma / hedef ve çubuklar */
export function ItemBox({ plan, comparisonLabel }: { plan: Plan; comparisonLabel: string | null }) {
  const rows: [string, number | null, string][] = [[tt('Mevcut'), plan.currentPct, ''], [comparisonLabel ?? tt('Karşılaştırma'), plan.comparisonPct, 'rf']];
  if (plan.targetKind === 'HEDEF') rows.push([tt('Hedef'), plan.targetPct, 'tg']);
  return <div className="v-ib">
    <div className="v-field"><span className="v-lbl">{tt('İzlenecek madde')} · {plan.itemCode}</span><p className="v-ib-t v-wrap">{plan.itemText}</p></div>
    <div className="v-ib-v">
      <div><span className="v-lbl">{tt('Mevcut')}</span><b>{pct(plan.currentPct)}</b></div>
      {plan.comparisonPct !== null ? <div><span className="v-lbl">{comparisonLabel ?? tt('Karşılaştırma')}</span><b>{pct(plan.comparisonPct)}</b></div> : null}
      <div><span className="v-lbl">{tt('Hedef')}</span><b>{plan.targetKind === 'HEDEF' ? pct(plan.targetPct) : tt('İzlenir')}</b></div>
    </div>
    <div className="v-bars">{rows.filter(r => r[1] !== null).map(([l, v, c]) => <div key={l}><div className="v-bar-h"><span>{l}</span><b>{pct(v)}</b></div><div className="v-bar-t"><span className={`v-bar-f ${c}`} style={{ width: `${Math.max(0, Math.min(100, v ?? 0))}%` }} /></div></div>)}</div>
    <div className="v-field">
      {plan.targetKind === 'HEDEF' && plan.currentPos !== null && plan.targetPos !== null && plan.respondents ? <span className="v-meta">{tt('{0}/{2} olumlu yanıttan {1}/{2} olumlu yanıta', plan.currentPos, plan.targetPos, plan.respondents)}</span> : null}
      {plan.targetKind === 'IZLENIR' ? <span className="v-meta">{tt('İzlenir: bu maddeye sayısal hedef verilmez; değişim bir sonraki ölçümde izlenir.')}</span> : null}
      {plan.responsibility ? <span className="v-meta">{tt('Sorumluluk')}: {plan.responsibility}</span> : null}
      {plan.impact ? <span className="v-meta">{plan.impact}</span> : null}
    </div>
  </div>;
}

/** Adım kartı: metin, çıktı, durum; işaretleme ve not kartın altında */
export function StepCard({ tid, step, today, mine, context, onChanged }: { tid: string; step: Step; today: string; mine?: boolean; context?: ReactNode; onChanged: () => void }) {
  const [noteOpen, setNoteOpen] = useState(false); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState('');
  const mark = async (done: boolean) => {
    setBusy(true); setErr(null);
    try { await commandApi(`/api/t/${tid}/rm2-steps/${step.id}`, { done, ...(done && note.trim() ? { note: note.trim() } : {}), expectedVersion: step.version }); setMsg(done ? tt('Adım Yapıldı olarak işaretlendi.') : tt('Adım Yapılmadı olarak geri alındı.')); setNoteOpen(false); setNote(''); onChanged(); }
    catch (e) { setErr(describeError(e)); } finally { setBusy(false); }
  };
  return <article className={`v-step${mine ? ' mine' : ''}`} aria-label={step.text}>
    <div className="v-step-h"><StatusTag s={step.status} />{step.role !== 'CALISAN' ? <DueLine step={step} today={today} /> : <span className="v-meta">{phaseLabel(step.phaseDays)}</span>}</div>
    <p className="v-step-t v-wrap">{step.ref ? step.ref.text : step.text}</p>
    {step.output || step.ref?.output ? <p className="v-step-o v-wrap"><span className="v-lbl">{tt('Çıktı')}</span> {step.ref?.output ?? step.output}</p> : null}
    {step.contribution ? <p className="v-meta v-wrap">{tt('Plana katkısı')}: {step.contribution}</p> : null}
    {step.ref ? <p className="v-meta v-wrap">{step.ref.label} · {tt('Bu adım kurum planındaki İK adımıdır; durumu oradan gelir.')}</p> : null}
    {context}
    {step.status === 'DONE' && !step.ref ? <p className="v-rec">{tt('Yapıldı')}{step.updatedBy ? <> · <b>{step.updatedBy}</b></> : null} · {fmtDate(step.statusAt)}{step.note ? <><br />{tt('Not')}: {step.note}</> : null}</p> : null}
    {step.status === 'DONE' && step.ref && step.statusAt ? <p className="v-rec">{tt('Kurum adımı yapıldı')} · {fmtDate(step.statusAt)}</p> : null}
    {step.canMark ? <div className="v-ctl">
      {noteOpen && step.status !== 'DONE' ? <div className="v-field"><label htmlFor={`n-${step.id}`}>{tt('Kısa not (isteğe bağlı)')}</label><textarea className="v-ta" id={`n-${step.id}`} maxLength={1000} placeholder={tt('Örneğin: Toplantıya 26 çalışan katıldı.')} value={note} onChange={e => setNote(e.target.value)} /></div> : null}
      <div className="v-btns">
        {step.status === 'DONE' ? <button type="button" className="v-btn2" disabled={busy} onClick={() => void mark(false)}>{tt('Yapılmadı olarak geri al')}</button>
          : <><button type="button" className="v-btn" disabled={busy} onClick={() => void mark(true)}>{tt('Yapıldı olarak işaretle')}</button><button type="button" className="v-btn2" onClick={() => setNoteOpen(o => !o)} aria-expanded={noteOpen}>{noteOpen ? tt('Notu kapat') : tt('Not ekle')}</button></>}
      </div>
      {err ? <p className="v-alert" role="alert">{err}</p> : null}
    </div> : null}
    <p className="v-sr" aria-live="polite">{msg}</p>
  </article>;
}

/** Sağ kenardaki "Nasıl okunur?" paneli */
export function Help({ startDate }: { startDate?: string | null }) {
  const [open, setOpen] = useState(false);
  const sec = (h: string, x: string, ex?: ReactNode) => <><h3>{h}</h3>{ex}<p>{x}</p></>;
  return <>
    <button type="button" className="v-handle" aria-expanded={open} aria-controls="v-help" onClick={() => setOpen(o => !o)}>{tt('Nasıl okunur?')}</button>
    {open ? <aside className="v-panel" id="v-help" aria-label={tt('Nasıl okunur?')} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}>
      <h2>{tt('Nasıl okunur?')}</h2>
      <div className="v-btns"><button type="button" className="v-btn2" onClick={() => setOpen(false)} autoFocus>{tt('Paneli kapat')}</button></div>
      {sec(tt('Kareler'), tt('Her kare bir adımdır. Kırmızı dolu kare yapılmış adımı, boş kare henüz yapılmamış adımı gösterir.'), <div className="v-ex"><span className="v-sqs"><span className="v-sq on" /><span className="v-sq on" /><span className="v-sq" /><span className="v-sq" /></span><span className="v-cnt">{tt('{0} / {1} yapıldı', 2, 4)}</span></div>)}
      {sec(tt('Durum'), tt('Her adımın durumu kelimeyle yazılır. Termini geçmiş ve yapılmamış adım "Gecikti" olarak görünür.'), <div className="v-ex"><StatusTag s="DONE" /><StatusTag s="OPEN" /><StatusTag s="LATE" /></div>)}
      {sec(tt('Dönemler ve terminler'), startDate ? tt('Terminler sunum gününden ({0}) itibaren hesaplanır: İlk 30 gün, İlk 90 gün ve İlk 6 ay.', fmtDate(startDate)) : tt('Terminler sunum gününden itibaren hesaplanır: İlk 30 gün, İlk 90 gün ve İlk 6 ay.'))}
      {sec(tt('Çıktı'), tt('Çıktı, adımın yapıldığını gösteren sonuçtur. Çıktı ortaya çıktığında adımı "Yapıldı olarak işaretle" düğmesiyle işaretleyin. İsterseniz kısa bir not ekleyin; sistem kimin ve ne zaman işaretlediğini kaydeder.'))}
      {sec(tt('Hedef'), tt('Hedef, maddeye olumlu yanıt verenlerin oranıdır ve rapordan gelir. "İzlenir" yazan maddelere hedef verilmez; değişim bir sonraki ölçümde izlenir.'))}
      {sec(tt('Kurum planına bağlı adımlar'), tt('İşletme planında "Kurum planı 1 · İK · İlk 30 gün" gibi görünen satırlar kurum planındaki İK adımlarıdır. Durumları kurum planından gelir; işletmede değiştirilmez.'))}
      {sec(tt('Çalışanlar'), tt('Çalışanların plana katkısı bilgi için gösterilir; bu adımlar işaretlenmez.'))}
      {sec(tt('Kim neyi işaretler?'), tt('Birim müdürü kendi işletmesinin yönetim adımlarını, İnsan Kaynakları İK adımlarını, üst yönetim kurum planındaki yönetim adımlarını işaretler. İzleyici yalnız inceler.'))}
    </aside> : null}
  </>;
}
