/** v3.0 ortak parçalar: veri tipleri, tarih, kareler, durum kelimesi, madde kutusu, adım kartı, yardım paneli. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { tt, LANG } from '../i18n';
import { api, commandApi, describeError, newIdempotencyKey } from '../api';

export type StepStatus = 'DONE' | 'OPEN' | 'LATE' | 'INFO';
/** v3.1.0 (R-05…R-09): adım kayıtları */
export type RecKind = 'NOTE' | 'PROGRESS' | 'BLOCKER' | 'UNBLOCK' | 'DONE' | 'UNDO' | 'FILE';
export interface RecFile { id: string; name: string; mime: string; size: number; image: boolean }
export interface Rec { id: string; kind: RecKind; text: string | null; by: string | null; at: string; blockerId: string | null; files: RecFile[] }
export interface Blocker { id: string; text: string; by: string | null; at: string }
export interface Plan { id: string; no: number; title: string; itemCode: string; itemText: string; respondents: number | null; currentPos: number | null; currentPct: number | null; comparisonPct: number | null; targetKind: 'HEDEF' | 'IZLENIR'; targetPos: number | null; targetPct: number | null; responsibility: string | null; impact: string | null; }
export interface Step { id: string; role: 'IK' | 'YONETIM' | 'CALISAN'; roleLabel: string; phaseDays: 30 | 90 | 180; ord: number; text: string; output: string | null; contribution: string | null; dueDate: string; status: StepStatus; note: string | null; statusAt: string | null; updatedBy: string | null; version: number; canMark: boolean; ref: { label: string; text: string; output: string | null } | null; records?: Rec[]; blockers?: Blocker[]; lastProgress?: { text: string; by: string | null; at: string } | null; canRecord?: boolean; canUnblock?: boolean; }
export interface MyStep extends Step { roadmapId: string; layer: 'KURUM' | 'ISLETME'; unitCode: string; unitLabel: string; plan: Plan; }
export interface RoadmapSummary { id: string; layer: 'KURUM' | 'ISLETME'; unitCode: string; unitLabel: string; respondents: number | null; cycleCode: string; reportTitle: string; headline: string | null; startDate: string; measurePeriod: string | null; plans: number; targets: number; ik: { total: number; done: number; late: number }; management: { total: number; done: number; late: number }; nextDue: string | null; }
export interface RoadmapDetail { id: string; status: string; layer: 'KURUM' | 'ISLETME'; unitCode: string; unitLabel: string; respondents: number | null; comparisonLabel: string | null; headline: string | null; summary: string | null; reportTitle: string; cycleCode: string; startDate: string; measurePeriod: string | null; today: string; rights: { IK: boolean; YONETIM: boolean }; plans: (Plan & { steps: Step[] })[]; items: { ord: number; itemCode: string; itemText: string; link: string | null; currentPct: number | null; comparisonPct: number | null; sectorPct: number | null; target: string | null }[]; }

/** YYYY-MM-DD → GG.AA.YYYY (iki dilde aynı biçim; raporla birebir) */
export const fmtDate = (d: string | null | undefined) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '—');
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const pct = (v: number | null | undefined) => { if (v === null || v === undefined) return '—'; const x = v.toLocaleString(LANG === 'en' ? 'en-GB' : 'tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); return LANG === 'en' ? `${x}%` : `%${x}`; };
export const phaseLabel = (p: number) => (p === 30 ? tt('İlk 30 gün') : p === 90 ? tt('İlk 90 gün') : tt('İlk 6 ay'));
/** ISO (UTC) → GG.AA.YYYY SS:DD, Türkiye saatiyle (raporun ve kullanıcıların saat dilimi) */
export const fmtDateTime = (iso: string | null | undefined) => { if (!iso) return '—'; const d = new Date(iso); if (Number.isNaN(d.getTime())) return '—'; const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value])); return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`; };
const hhmm = () => fmtDateTime(new Date().toISOString()).slice(11);
export const fileUrl = (tid: string, id: string, inline = false) => `/api/t/${tid}/rm2-files/${id}${inline ? '?inline=1' : ''}`;
const kb = (n: number) => Math.max(1, Math.round(n / 1024));
/** Sunucuyla aynı sınırlar (apps/api/src/filestore.ts) */
export const FILE_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
export const FILE_MAX_MB = 10; export const FILE_MAX_COUNT = 5;
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
/** R-10: mevcut değer karşılaştırma değerinin altındaysa kırmızı. Karşılaştırma yoksa uyarı üretilmez (sıfır varsayılmaz). */
export const isLow = (cur: number | null | undefined, cmp: number | null | undefined) => cur !== null && cur !== undefined && cmp !== null && cmp !== undefined && cur < cmp;
export function ItemBox({ plan, comparisonLabel }: { plan: Plan; comparisonLabel: string | null }) {
  const low = isLow(plan.currentPct, plan.comparisonPct);
  const rows: [string, number | null, string][] = [[tt('Mevcut'), plan.currentPct, low ? 'low' : ''], [comparisonLabel ?? tt('Karşılaştırma'), plan.comparisonPct, 'rf']];
  if (plan.targetKind === 'HEDEF') rows.push([tt('Hedef'), plan.targetPct, 'tg']);
  return <div className="v-ib">
    <div className="v-field"><span className="v-lbl">{tt('İzlenecek madde')} · {plan.itemCode}</span><p className="v-ib-t v-wrap">{plan.itemText}</p></div>
    <div className="v-ib-v">
      <div><span className="v-lbl">{tt('Mevcut')}</span><b className={low ? 'v-low' : undefined}>{pct(plan.currentPct)}</b></div>
      {plan.comparisonPct !== null ? <div><span className="v-lbl">{comparisonLabel ?? tt('Karşılaştırma')}</span><b>{pct(plan.comparisonPct)}</b></div> : null}
      <div><span className="v-lbl">{tt('Hedef')}</span><b>{plan.targetKind === 'HEDEF' ? pct(plan.targetPct) : tt('İzlenir')}</b></div>
    </div>
    <div className="v-bars">{rows.filter(r => r[1] !== null).map(([l, v, c]) => <div key={l}><div className="v-bar-h"><span>{l}</span><b className={c === 'low' ? 'v-low' : undefined}>{pct(v)}</b></div><div className="v-bar-t"><span className={`v-bar-f ${c}`} style={{ width: `${Math.max(0, Math.min(100, v ?? 0))}%` }} /></div></div>)}</div>
    <div className="v-field">
      {plan.targetKind === 'HEDEF' && plan.currentPos !== null && plan.targetPos !== null && plan.respondents ? <span className="v-meta">{tt('{0}/{2} olumlu yanıttan {1}/{2} olumlu yanıta', plan.currentPos, plan.targetPos, plan.respondents)}</span> : null}
      {plan.targetKind === 'IZLENIR' ? <span className="v-meta">{tt('İzlenir: bu maddeye sayısal hedef verilmez; değişim bir sonraki ölçümde izlenir.')}</span> : null}
      {plan.responsibility ? <span className="v-meta">{tt('Sorumluluk')}: {plan.responsibility}</span> : null}
      {plan.impact ? <span className="v-meta">{plan.impact}</span> : null}
    </div>
  </div>;
}

/** Görünür işlem sonucu: düğmenin hemen altında, başarıda role=status, hatada role=alert (R-03 ilkesi) */
export function Feedback({ fb }: { fb: { text: string; err?: boolean } | null }) {
  return fb ? <p className={`v-fb${fb.err ? ' err' : ''}`} role={fb.err ? 'alert' : 'status'}>{fb.text}</p> : null;
}
const REC_LABEL: Record<RecKind, () => string> = { NOTE: () => tt('Not'), PROGRESS: () => tt('Gelişme'), BLOCKER: () => tt('Engel'), UNBLOCK: () => tt('Engel kalktı'), DONE: () => tt('Yapıldı'), UNDO: () => tt('Geri alındı'), FILE: () => tt('Dosya') };
/** Kayıttaki dosya: ada ya da "İndir"e tıklayınca iner; fotoğraf ayrıca yeni sekmede açılır */
function FileRow({ tid, f, big }: { tid: string; f: RecFile; big?: boolean }) {
  return <div className={`v-file${big ? ' rec' : ''}`}>
    {f.image ? <a href={fileUrl(tid, f.id, true)} target="_blank" rel="noopener noreferrer" title={tt('Yeni sekmede aç')}><img src={fileUrl(tid, f.id, true)} alt={f.name} /></a> : null}
    <a className="v-fn v-wrap" href={fileUrl(tid, f.id)} download={f.name}>{f.name}</a>
    <span className="v-meta">{tt('{0} KB', kb(f.size))}</span>
    <a className="v-link" href={fileUrl(tid, f.id)} download={f.name}>{tt('İndir')}</a>
    {f.image ? <a className="v-link" href={fileUrl(tid, f.id, true)} target="_blank" rel="noopener noreferrer">{tt('Yeni sekmede aç')}</a> : null}
  </div>;
}
function RecordList({ tid, records }: { tid: string; records: Rec[] }) {
  if (!records.length) return <p className="v-meta">{tt('Henüz kayıt yok.')}</p>;
  return <div className="v-recs">{records.map(r => <div key={r.id} className="v-recr">
    <div className="v-rt">{REC_LABEL[r.kind]()}</div>
    <div className="v-rb">
      {r.kind === 'DONE' ? <p>{tt('Adım Yapıldı olarak işaretlendi.')}</p> : r.kind === 'UNDO' ? <p>{tt('Adım Yapılmadı durumuna geri alındı.')}</p> : r.text ? <p className="v-wrap">{r.kind === 'UNBLOCK' ? <><b>{tt('Çözüm notu')}:</b> </> : null}{r.text}</p> : null}
      {r.files.map(f => <FileRow key={f.id} tid={tid} f={f} big />)}
      <p className="v-meta">{r.by ?? '—'} · {fmtDateTime(r.at)}</p>
    </div>
  </div>)}</div>;
}
/** R-07: açık engel kutusu (sol kenarda kırmızı çizgi). Kaldırma yetkisi olana çözüm notu alanı ve "Engeli kaldır" düğmesi; not zorunlu (sunucu da denetler). */
export function BlockerBox({ tid, stepId, blocker, canUnblock, onChanged, head, after, actions, list }: { tid: string; stepId: string; blocker: Blocker; canUnblock: boolean; onChanged: () => void; head?: ReactNode; after?: ReactNode; actions?: ReactNode; list?: boolean }) {
  const [sol, setSol] = useState(''); const [busy, setBusy] = useState(false); const [fb, setFb] = useState<{ text: string; err?: boolean } | null>(null); const ta = useRef<HTMLTextAreaElement>(null);
  const id = `sol-${blocker.id}${list ? '-l' : ''}`;
  const go = async () => {
    if (!sol.trim()) { setFb({ text: tt('Engeli kaldırmak için önce geliştirilen çözümü yazın.'), err: true }); ta.current?.focus(); return; }
    setBusy(true); setFb(null);
    try { await commandApi(`/api/t/${tid}/rm2-steps/${stepId}/blockers/${blocker.id}/resolve`, { resolution: sol.trim() }); setSol(''); setFb({ text: tt('Engel kaldırıldı · {0}', hhmm()) }); onChanged(); }
    catch (e) { setFb({ text: describeError(e), err: true }); } finally { setBusy(false); }
  };
  return <div className={list ? 'v-bi' : 'v-block'} role={list ? undefined : 'note'}>
    {head ?? <span className="v-lbl">{tt('Engel')} · {blocker.by ?? '—'} · {fmtDateTime(blocker.at)}</span>}
    <p className="v-wrap"><b>{blocker.text}</b></p>
    {after}
    {canUnblock ? <>
      <div className="v-field"><label htmlFor={id}>{tt('Çözüm notu (engeli kaldırabilmek için geliştirilen çözüm yazılmalıdır)')}</label><textarea ref={ta} className="v-ta" id={id} maxLength={2000} placeholder={tt('Örneğin: Güncel ücret tablosu e-postayla gönderildi.')} value={sol} onChange={e => setSol(e.target.value)} /></div>
      <div className="v-btns"><button type="button" className="v-btn2" disabled={busy} onClick={() => void go()}>{tt('Engeli kaldır')}</button>{actions}</div>
    </> : actions ? <div className="v-btns">{actions}</div> : null}
    <Feedback fb={fb} />
  </div>;
}
type Kind = 'NOTE' | 'PROGRESS' | 'BLOCKER';
const KIND_TXT: Record<Kind, { tab: () => string; help: () => string; ph: () => string; save: () => string; ok: () => string }> = {
  NOTE: { tab: () => tt('Not'), help: () => tt('Kendiniz ve ekibiniz için kısa bilgi. Adımın durumunu değiştirmez.'), ph: () => tt('Örneğin: Toplantı salonu 12 Aralık için ayrıldı.'), save: () => tt('Notu kaydet'), ok: () => tt('Not kaydedildi · {0}', hhmm()) },
  PROGRESS: { tab: () => tt('Gelişme'), help: () => tt('İşin hangi noktaya geldiğini yazın. Adım henüz yapılmış sayılmaz; ilerleme görünür olur.'), ph: () => tt('Örneğin: Beş departmanın üçünden eğitim ihtiyaç listesi geldi.'), save: () => tt('Gelişmeyi kaydet'), ok: () => tt('Gelişme kaydedildi · {0}. Adım henüz yapılmış sayılmıyor.', hhmm()) },
  BLOCKER: { tab: () => tt('Engel'), help: () => tt('Adımın tamamlanmasını engelleyen durumu yazın. Engel adımla birlikte görünür; rapordaki termin değişmez.'), ph: () => tt('Örneğin: İK’dan güncel ücret tablosunu bekliyoruz.'), save: () => tt('Engeli kaydet'), ok: () => tt('Engel kaydedildi · {0}. Adımla birlikte görünecek; termin değişmedi.', hhmm()) },
};
type Pending = { file: File; url: string | null };
/** A · Tek kayıt kutusu: Not / Gelişme / Engel aynı kutudan yazılır; dosyalar yazı kutusunun altında görünür ve aynı kayıtla gider.
 * Gönderim başarısız olursa metin ve dosya seçimi korunur; form yalnız başarı kesinleşince temizlenir. */
function Composer({ tid, stepId, onChanged }: { tid: string; stepId: string; onChanged: () => void }) {
  const [kind, setKind] = useState<Kind>('PROGRESS'); const [text, setText] = useState(''); const [files, setFiles] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false); const [fb, setFb] = useState<{ text: string; err?: boolean } | null>(null);
  const inp = useRef<HTMLInputElement>(null); const ta = useRef<HTMLTextAreaElement>(null); const key = useRef(newIdempotencyKey());
  /* içerik değişince yeni komut; aynı içerikle yeniden deneme aynı anahtarı kullanır (çift tıkta mükerrer kayıt olmaz) */
  useEffect(() => { key.current = newIdempotencyKey(); }, [kind, text, files]);
  useEffect(() => () => { files.forEach(f => f.url && URL.revokeObjectURL(f.url)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const t = KIND_TXT[kind]; const taId = `ta-${stepId}`;
  const pick = (list: FileList | null) => {
    if (!list?.length) return; const add: Pending[] = []; const errs: string[] = [];
    for (const f of Array.from(list)) { if (f.size > FILE_MAX_MB * 1048576) errs.push(tt('Dosya en fazla {0} MB olabilir: {1}', FILE_MAX_MB, f.name)); else add.push({ file: f, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null }); }
    const next = [...files, ...add]; if (next.length > FILE_MAX_COUNT) { errs.push(tt('Bir kayda en fazla {0} dosya eklenir.', FILE_MAX_COUNT)); next.splice(FILE_MAX_COUNT).forEach(f => f.url && URL.revokeObjectURL(f.url)); }
    setFiles(next); setFb(errs.length ? { text: errs.join(' '), err: true } : { text: tt('Dosya eklendi; kaydetmek için "{0}" düğmesine basın.', t.save()) });
    if (inp.current) inp.current.value = '';
  };
  const unpick = (i: number) => { const f = files[i]; if (f?.url) URL.revokeObjectURL(f.url); setFiles(files.filter((_, j) => j !== i)); setFb(null); };
  const save = async () => {
    const x = text.trim();
    if (kind === 'BLOCKER' && !x) { setFb({ text: tt('Engeli bildirmek için adımı neyin durdurduğunu yazın'), err: true }); ta.current?.focus(); return; }
    if (!x && !files.length) { setFb({ text: tt('Kaydetmek için bir şey yazın ya da dosya ekleyin.'), err: true }); ta.current?.focus(); return; }
    const fd = new FormData(); fd.append('kind', kind); fd.append('text', x); for (const f of files) fd.append('files', f.file, f.file.name);
    setBusy(true); setFb(null);
    try {
      await api('POST', `/api/t/${tid}/rm2-steps/${stepId}/records`, fd, { idempotencyKey: key.current, timeoutMs: 120000 });
      const n = files.length; const msg = x ? t.ok() + (n ? tt(' · {0} dosya eklendi', n) : '') : tt('Dosya kaydedildi · {0}', hhmm());
      files.forEach(f => f.url && URL.revokeObjectURL(f.url)); setFiles([]); setText(''); key.current = newIdempotencyKey(); setFb({ text: msg }); onChanged();
    } catch (e) { setFb({ text: describeError(e), err: true }); } finally { setBusy(false); }
  };
  return <div className="v-compose">
    <span className="v-lbl">{tt('Kayıt ekle')}</span>
    <div className="v-btns" role="group" aria-label={tt('Kayıt ekle')}>{(['NOTE', 'PROGRESS', 'BLOCKER'] as Kind[]).map(k => <button key={k} type="button" className="v-opt" aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_TXT[k].tab()}</button>)}</div>
    <div className="v-field"><label htmlFor={taId}>{t.help()}</label><textarea ref={ta} className="v-ta" id={taId} maxLength={2000} placeholder={t.ph()} value={text} onChange={e => setText(e.target.value)} /></div>
    {files.length ? <div className="v-files" aria-label={tt('Eklenecek dosyalar')}><span className="v-lbl">{tt('Eklenecek dosyalar')}</span>
      {files.map((f, i) => <div key={`${f.file.name}-${i}`} className="v-file">{f.url ? <img src={f.url} alt={f.file.name} /> : null}<span className="v-fn v-wrap">{f.file.name}</span><span className="v-meta">{tt('{0} KB', kb(f.file.size))}</span><button type="button" className="v-link" onClick={() => unpick(i)}>{tt('Kaldır')}</button></div>)}
      <p className="v-meta">{tt('Dosya, yazdığınız kayıtla birlikte kaydedilir. Yazı yazmadan da kaydedebilirsiniz.')}</p></div> : null}
    <div className="v-btns">
      <button type="button" className="v-btn" disabled={busy} onClick={() => void save()}>{t.save()}</button>
      <button type="button" className="v-btn2" disabled={busy} onClick={() => inp.current?.click()}>{tt('Dosya ya da fotoğraf ekle')}</button>
      <input ref={inp} type="file" className="v-sr" multiple accept={FILE_ACCEPT} tabIndex={-1} aria-hidden="true" onChange={e => pick(e.target.files)} />
    </div>
    <Feedback fb={fb} />
    <p className="v-meta">{tt('Toplantı tutanağı, duyuru fotoğrafı, katılım listesi gibi çıktının kendisi. Kimse onaylamaz; yalnız "çıktı burada" der.')} {tt('Fotoğraf (JPEG, PNG, WEBP, GIF, HEIC), PDF, Word, Excel ya da PowerPoint; dosya başına en fazla {0} MB, bir kayda en fazla {1} dosya.', FILE_MAX_MB, FILE_MAX_COUNT)}</p>
  </div>;
}

/** Adım kartı — seçilen yerleşim A (tek kayıt kutusu): başlık ve metin → son gelişme → açık engeller → kayıtlar → kayıt ekle → ana eylemler.
 * planTo verilirse (Bugün) ana eylem satırının başında "Planı incele". İşaretleme, sürüm denetimi ve tekrar gönderim koruması aynen. */
export function StepCard({ tid, step, today, mine, context, planTo, onChanged }: { tid: string; step: Step; today: string; mine?: boolean; context?: ReactNode; planTo?: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false); const [fb, setFb] = useState<{ text: string; err?: boolean } | null>(null);
  const records = step.records ?? []; const blockers = step.blockers ?? []; const canRecord = !!step.canRecord && !step.ref && step.role !== 'CALISAN';
  const mark = async (done: boolean) => {
    setBusy(true); setFb(null);
    try { await commandApi(`/api/t/${tid}/rm2-steps/${step.id}`, { done, expectedVersion: step.version }); setFb({ text: done ? tt('Adım Yapıldı olarak işaretlendi · {0}', hhmm()) : tt('Adım yeniden Yapılmadı durumuna alındı · {0}. İşlem kayıtlarda duruyor.', hhmm()) }); onChanged(); }
    catch (e) { setFb({ text: describeError(e), err: true }); } finally { setBusy(false); }
  };
  const tracked = !step.ref && step.role !== 'CALISAN';
  return <article className={`v-step${mine ? ' mine' : ''}`} aria-label={step.text}>
    <div className="v-step-h"><StatusTag s={step.status} />{blockers.length ? <span className="v-st v-st-BLOCK">{tt('Engel var')}</span> : null}{step.role !== 'CALISAN' ? <DueLine step={step} today={today} /> : <span className="v-meta">{phaseLabel(step.phaseDays)}</span>}</div>
    <p className="v-step-t v-wrap">{step.ref ? step.ref.text : step.text}</p>
    {step.output || step.ref?.output ? <p className="v-step-o v-wrap"><span className="v-lbl">{tt('Çıktı')}</span> {step.ref?.output ?? step.output}</p> : null}
    {step.contribution ? <p className="v-meta v-wrap">{tt('Plana katkısı')}: {step.contribution}</p> : null}
    {step.ref ? <p className="v-meta v-wrap">{step.ref.label} · {tt('Bu adım kurum planındaki İK adımıdır; durumu oradan gelir.')}</p> : null}
    {context}
    {step.status === 'DONE' && !step.ref && !records.length ? <p className="v-rec">{tt('Yapıldı')}{step.updatedBy ? <> · <b>{step.updatedBy}</b></> : null} · {fmtDate(step.statusAt)}{step.note ? <><br />{tt('Not')}: {step.note}</> : null}</p> : null}
    {step.status === 'DONE' && step.ref && step.statusAt ? <p className="v-rec">{tt('Kurum adımı yapıldı')} · {fmtDate(step.statusAt)}</p> : null}
    {step.lastProgress ? <div className="v-last"><span className="v-lbl">{tt('Son gelişme')} · {fmtDateTime(step.lastProgress.at)}</span><p className="v-wrap">{step.lastProgress.text}</p></div> : null}
    {blockers.map(b => <BlockerBox key={b.id} tid={tid} stepId={step.id} blocker={b} canUnblock={!!step.canUnblock} onChanged={onChanged} />)}
    {tracked && (records.length || canRecord) ? <div className="v-ctl"><span className="v-lbl">{tt('Kayıtlar')}</span><RecordList tid={tid} records={records} /></div> : null}
    {canRecord ? <div className="v-ctl"><Composer tid={tid} stepId={step.id} onChanged={onChanged} /></div> : null}
    {step.canMark || planTo ? <div className="v-ctl">
      <div className="v-btns">
        {planTo ? <Link className="v-btn2" to={planTo}>{tt('Planı incele')}</Link> : null}
        {!step.canMark ? null : step.status === 'DONE' ? <button type="button" className="v-btn2" disabled={busy} onClick={() => void mark(false)}>{tt('Yapılmadı olarak geri al')}</button>
          : <button type="button" className="v-btn v-btn-mark" disabled={busy} onClick={() => void mark(true)}>{tt('Yapıldı olarak işaretle')}</button>}
      </div>
      <Feedback fb={fb} />
    </div> : null}
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
      {sec(tt('Not'), tt('Kısa bilgi içindir; adımın durumunu değiştirmez. "Notu kaydet" ile kaydedilir, adımı işaretlemek gerekmez.'))}
      {sec(tt('Gelişme'), tt('İşin geldiği noktayı gösterir. En son gelişme kartın üstünde görünür; adım yine "Yapılmadı" sayılır.'))}
      {sec(tt('Engel'), tt('Adımı durduran durumdur. Kartta siyah "Engel var" etiketiyle görünür; İnsan Kaynakları, üst yönetim ve bölge müdürü de görür. Rapordaki termin değişmez. Engeli işletme müdürü, bölge müdürü, İnsan Kaynakları ya da üst yönetim kaldırabilir; kaldırırken geliştirilen çözümü yazmak zorunludur. Kimin kaldırdığı kayıtlarda kalır.'))}
      {sec(tt('Dosya ya da fotoğraf'), tt('Çıktının kendisidir: tutanak, duyuru fotoğrafı, katılım listesi. Kimse onaylamaz, inceleme yoktur. Adımı görebilen herkes indirebilir.'))}
      {sec(tt('Geri alma'), tt('Yanlışlıkla işaretlenen adım "Yapılmadı olarak geri al" ile geri alınır. Hem işaretleme hem geri alma kayıtlarda kalır.'))}
      {sec(tt('Kim neyi işaretler?'), tt('Birim müdürü kendi işletmesinin yönetim adımlarını, İnsan Kaynakları İK adımlarını, üst yönetim kurum planındaki yönetim adımlarını işaretler. İzleyici yalnız inceler.'))}
    </aside> : null}
  </>;
}
