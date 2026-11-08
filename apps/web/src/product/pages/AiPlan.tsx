/** v2.13.0: "Yapay zekâdan yardım al" — Hedefler ekranında isteğe bağlı AI Hedef ve Aksiyon Planı; Kurulum ekranında İK yöneticisi için OpenAI bağlantısı.
 * AI zorunlu değildir: bağlantı yoksa hedef akışı aynen sürer. Plan tek çağrıda üretilir ve saklanır; sayfa yenileme/yeniden açma sağlayıcı çağrısı yapmaz.
 * AI hiçbir hedefi/aksiyonu kaydetmez ya da onaylamaz; aksiyonlar yalnız hedef kabul edildikten sonra, seçilerek "planlandı" durumunda mevcut Aksiyonlar alanına aktarılır. */
import { tt } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey, describeError } from '../api';
import { trl } from '../labels';
import { Button } from '../../components/Button';
import { Kicker } from '../../components/Kicker';
import { Field } from '../../components/Field';
import { Gantt } from '../ui/charts/Grafik';

type AiStatus = { available: boolean; configured: boolean; modelConfigured: boolean; canManage: boolean; keyLast4?: string | null; updatedAt?: string | null };
type Act = { title: string; objective: string; rationale: string; phase: 'QUICK_WIN' | 'STRUCTURAL' | 'SUSTAIN'; cadence?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'once'; level?: 'UNIT' | 'COMPANY' | 'SHARED'; firstStep?: string; expectedOutput?: string; checkpoint?: string; startMonth: number; endMonth: number; ownerRole: string; collaborators: string[]; steps: string[]; indicators: string[]; evidenceRequired: string[]; dependencies: string[]; risks: string[] };
type Plan = { executiveSummary: string; interventionScope: 'UNIT' | 'COMPANY' | 'MIXED' | 'INSUFFICIENT_DATA'; confidence: 'LOW' | 'MEDIUM' | 'HIGH'; evidenceSummary: string[]; relatedPatterns: string[]; hypotheses: string[]; validationChecks: string[]; targetRecommendation: { currentValue: number | null; allowedRange: { low: number; high: number } | null; recommendedValue: number | null; rationale: string }; actions: Act[]; companySupportNeeds: string[]; monitoringPlan: { monthly: string; quarterly: string; month6: string; month12: string }; guardrails: string[]; missingData: string[]; assumptions: string[]; successCriteria?: { process: string; quality: string; outcome: string } };
type PlanRes = { plan: { id: string; stale: boolean; createdAt: string; promptVersion: string; plan: Plan; openedIndices: number[] } | null; targetStatus: string; cached?: boolean };
type TargetLite = { id: string; item_code: string; item_text?: string; status: string };

const SCOPE: Record<Plan['interventionScope'], string> = { UNIT: 'Birimin yapacağı iş', COMPANY: 'Şirket desteği gereken iş', MIXED: 'Birim + şirket birlikte', INSUFFICIENT_DATA: 'Karar için daha fazla bilgi gerekiyor' };
const LEVEL: Record<string, string> = { UNIT: 'Birim', COMPANY: 'Şirket', SHARED: 'Ortak' };
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const ayAdi = (base: Date, offset: number) => { const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1)); return `${tt(AYAR_AD(d.getUTCMonth()))} ${d.getUTCFullYear()}`; };
const AYAR_AD = (m: number) => AYLAR[m]!;
const ayTarih = (base: Date, offset: number, son = false) => { const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset + (son ? 1 : 0), son ? 0 : 1)); return d; };
const asama = (a: { startMonth: number; endMonth: number }) => a.startMonth <= 1 && a.endMonth <= 1 ? 'İlk 30 gün' : a.startMonth <= 3 ? (a.endMonth <= 3 ? 'İlk 3 ay' : 'İlk 3 aydan itibaren') : a.startMonth <= 6 ? '3–6 ay' : '6–12 ay';
const CONF: Record<Plan['confidence'], string> = { LOW: 'Veri sınırlı; öneriler dikkatle doğrulanmalı.', MEDIUM: 'Veri kısmen yeterli; önemli varsayımlar doğrulanmalı.', HIGH: 'Veri tutarlı; yine de ekipte doğrulanmalı.' };
const CAD: Record<string, string> = { weekly: 'haftalık', biweekly: 'iki haftada bir', monthly: 'aylık', quarterly: 'çeyreklik', once: 'tek sefer' };
const PHASE: Record<Act['phase'], string> = { QUICK_WIN: '0–3 ay · Hızlı kazanım', STRUCTURAL: '3–9 ay · Yapısal adım', SUSTAIN: '9–12 ay · Kalıcılaştırma' };
const ERR: Record<string, string> = { plan_stale: 'Bu plan eski verilere göre hazırlanmıştır; aksiyon aktarmadan önce planı yeniden oluşturun.', not_targetable: 'Bu madde için hedef önerisi üretilemiyor; yapay zekâ planı da üretilmez.', ai_not_configured: 'Yapay zekâ desteği için şirketinizin OpenAI bağlantısı kurulmalıdır.', ai_timeout: 'Yapay zekâ zamanında yanıt vermedi. Hedef akışı etkilenmedi; yeniden deneyebilirsiniz.', ai_refusal: 'Yapay zekâ bu isteği yanıtlamadı. Hedef akışı etkilenmedi; yeniden deneyebilirsiniz.', ai_provider_error: 'Yapay zekâ hizmetine ulaşılamadı. Hedef akışı etkilenmedi; yeniden deneyebilirsiniz.', ai_invalid_output: 'Yapay zekâ çıktısı doğrulamadan geçmedi; plan kaydedilmedi. Yeniden deneyebilirsiniz.', ai_range_violation: 'Yapay zekâ izinli aralığın dışında hedef önerdi; plan kaydedilmedi. Yeniden deneyebilirsiniz.', target_not_accepted: 'Aksiyonlar hedef kabul edildikten sonra taslağa aktarılabilir.', action_limit: 'Birimde etkin aksiyon sınırı (3) aşılır; hiçbir aksiyon aktarılmadı.', already_opened: 'Seçilen aksiyonlardan en az biri daha önce aktarıldı; hiçbir aksiyon aktarılmadı.', not_local_scope: 'Bu plan birim düzeyinde yerel aksiyona çevrilmez.' };
const friendly = (e: unknown) => (e instanceof ApiError && ERR[e.code] ? tt(ERR[e.code]!) : describeError(e));
const List = ({ items, empty }: { items: string[]; empty?: string }) => items.length ? <ul className="ai-list">{items.map((x, i) => <li key={i} className="body">{x}</li>)}</ul> : <p className="caption">{empty ?? tt('Yok')}</p>;
const Sec = ({ n, title, kind, children }: { n: number; title: string; kind?: 'fact' | 'hypothesis' | 'recommendation'; children: React.ReactNode }) => (
  <section className={`ai-sec${kind ? ` ai-sec--${kind}` : ''}`}><div className="ai-sec__head"><span className="ai-sec__no">{String(n).padStart(2, '0')}</span><h3 className="h3">{title}</h3>{kind ? <span className="caption ai-tag">{kind === 'fact' ? tt('Olgu (verideki durum)') : kind === 'hypothesis' ? tt('Olası açıklama (doğrulanmalı)') : tt('Öneri (karar değildir)')}</span> : null}</div>{children}</section>);

function Acilir({ baslik, children, testid }: { baslik: string; children: React.ReactNode; testid?: string }) { const [open, setOpen] = useState(false); return (<div className="ai-acilir" data-testid={testid}><Button variant="secondary" onClick={() => setOpen(o => !o)}>{open ? tt('Gizle') : baslik}</Button>{open ? <div className="stack-1" style={{ marginTop: 8 }}>{children}</div> : null}</div>); }
/** v2.13.2: uygulama planı görünümü — önce ne yapılacak, ilk adım, kim, ne zaman, başarı; analiz ve veri sınırlamaları ikinci katmanda (açılır) */
function PlanBody({ p, createdAt, local, cardFooter, nihaiHedef }: { p: Plan; createdAt: string; local: boolean; cardFooter: (i: number) => React.ReactNode; nihaiHedef?: number | null }) {
  const base = new Date(createdAt); const tr = p.targetRecommendation;
  const tarih = (a: Act) => `${ayAdi(base, a.startMonth - 1)} – ${ayAdi(base, a.endMonth - 1)}`;
  const sinir = [...p.missingData, ...p.assumptions];
  return (<>
    <p className="caption">{tt('Müdahale düzeyi:')}{' '}<span className="bold">{tt(SCOPE[p.interventionScope])}</span>{' · '}{tt(CONF[p.confidence])}{' · '}{tt('Hazırlanma:')}{' '}{String(createdAt).slice(0, 10)}</p>
    <Sec n={1} title={tt('Kısa durum özeti')}><p className="body-l">{p.executiveSummary}</p></Sec>
    <Sec n={2} title={tt('Hedef')} kind="recommendation"><div className="row ai-hedef">
      <div><p className="caption bold">{tt('Mevcut sonuç')}</p><p className="h3">{tr.currentValue ?? '—'}</p></div>
      <div><p className="caption bold">{tt('Önerilen hedef aralığı')}</p><p className="h3">{tr.allowedRange ? `%${tr.allowedRange.low}–%${tr.allowedRange.high}` : '—'}</p></div>
      <div><p className="caption bold">{tt('Yapay zekâ önerisi')}</p><p className="h3">{tr.recommendedValue ?? tt('önerilmedi')}</p></div>
      <div><p className="caption bold">{tt('Seçilen hedef')}</p><p className="h3">{nihaiHedef ?? tt('henüz belirlenmedi')}</p></div></div>
      <p className="caption">{tt('Mevcut sonuç ve HPW metodolojisine göre gerçekçi kabul edilen hedef aralığıdır. Yapay zekâ önerisi bir öneridir; hedefi siz belirlersiniz.')}</p><p className="body">{tr.rationale}</p></Sec>
    <Sec n={3} title={tt('Ne yapmalıyım?')} kind="recommendation">{p.actions.length ? <ol className="ai-list ai-list--buyuk">{p.actions.map((a, i) => <li key={i} className="body"><span className="bold">{a.title}</span>{a.level ? <span className="caption"> · {tt(LEVEL[a.level] ?? a.level)}</span> : null}{a.firstStep ? <><br /><span className="caption">{tt('İlk adım:')}</span> {a.firstStep}</> : null}</li>)}</ol> : <p className="caption">{tt('Bu plan birim düzeyinde yerel aksiyon önermez; şirket düzeyindeki ihtiyaçlar "Şirketten ne gerekiyor?" bölümündedir.')}</p>}</Sec>
    <Sec n={4} title={tt('Aşama aşama uygulama planı')} kind="recommendation">
      {!local ? <p className="caption">{tt('Bu plan birim düzeyinde yerel aksiyon önermez; şirket düzeyindeki ihtiyaçlar "Şirketten ne gerekiyor?" bölümündedir.')}</p> : null}
      <p className="caption">{tt('Faz başlığı siyah bantta: tarih aralığı, sıklık ve düzey. Solda ilk adım ve yapılacaklar, sağda beklenen çıktı, kanıt ve kontrol noktası.')}</p>
      <div className="ai-actions">{p.actions.map((a, i) => (
        <div key={i} data-testid={`ai-action-${i}`}><article className="tamfaz"><div className="sutunbas"><div className="fazbas"><div className="no">{i + 1}</div><div><div className="ol">{tt(asama(a))} · {tarih(a)}{a.cadence ? <> · {tt(CAD[a.cadence] ?? a.cadence)}</> : null}{a.level ? <> · {tt(LEVEL[a.level] ?? a.level)}</> : null}</div><h3>{a.title}</h3></div></div></div>
          <div className="ic">
            <div className="fazk"><div className="etk">{tt('İlk adım')}</div><div className="deg">{a.firstStep ?? a.steps[0] ?? '—'}</div><div className="etk">{tt('Yapılacak')}</div><div className="deg"><ol className="adl">{a.steps.map((x, k) => <li key={k}>{x}</li>)}</ol></div><div className="etk">{tt('Sorumlu')}</div><div className="deg">{a.ownerRole}{a.collaborators.length ? <> · {tt('Destek:')} {a.collaborators.join(', ')}</> : null}</div></div>
            <div className="fazk"><div className="etk">{tt('Beklenen çıktı')}</div><div className="deg">{a.expectedOutput ?? a.objective}</div><div className="etk">{tt('Kanıt')}</div><div className="deg">{a.evidenceRequired.join('; ') || '—'}</div><div className="etk">{tt('Kontrol noktası')}</div><div className="deg">{a.checkpoint ?? (a.indicators.length ? a.indicators.join('; ') : '—')}</div></div>
          </div>
          {cardFooter(i)}
        </article></div>))}</div>
    </Sec>
    <Sec n={5} title={tt('Kim yapacak?')}>{p.actions.length ? <table className="table"><thead><tr><th>{tt('Aksiyon')}</th><th>{tt('Sorumlu')}</th><th>{tt('Destek')}</th><th>{tt('Düzey')}</th></tr></thead><tbody>{p.actions.map((a, i) => <tr key={i}><td>{a.title}</td><td>{a.ownerRole}</td><td>{a.collaborators.join(', ') || '—'}</td><td>{a.level ? tt(LEVEL[a.level] ?? a.level) : '—'}</td></tr>)}</tbody></table> : <p className="caption">{tt('Yok')}</p>}</Sec>
    <Sec n={6} title={tt('Ne zaman?')}>{p.actions.length ? <><p className="caption">{tt('Siyah çubuk aksiyonun süresi; gri çubuk şirketle ortak iş; kesikli çizgi bugün.')}</p><Gantt satirlar={p.actions.map(a => ({ ad: a.title, alt: tt(asama(a)), bas: ayTarih(base, a.startMonth - 1), bit: ayTarih(base, a.endMonth - 1, true), ortak: a.level === 'COMPANY' || a.level === 'SHARED' }))} baslangic={base} ayS={Math.min(12, Math.max(6, ...p.actions.map(a => a.endMonth)))} /></> : null}{p.actions.length ? <table className="table"><thead><tr><th>{tt('Aksiyon')}</th><th>{tt('Aşama')}</th><th>{tt('Başlangıç')}</th><th>{tt('Bitiş')}</th><th>{tt('Sıklık')}</th></tr></thead><tbody>{p.actions.map((a, i) => <tr key={i}><td>{a.title}</td><td>{tt(asama(a))}</td><td>{ayAdi(base, a.startMonth - 1)}</td><td>{ayAdi(base, a.endMonth - 1)}</td><td>{a.cadence ? tt(CAD[a.cadence] ?? a.cadence) : tt('aylık')}</td></tr>)}</tbody></table> : <p className="caption">{tt('Yok')}</p>}<p className="caption">{tt('Aylar hedefin kabul tarihinden sayılır; aksiyona aktarıldığında tarihler hedefe göre kesinleşir.')}</p></Sec>
    <Sec n={7} title={tt('Nasıl takip edeceğiz?')}><table className="table"><tbody><tr><td className="bold">{tt('Aylık')}</td><td>{p.monitoringPlan.monthly}</td></tr><tr><td className="bold">{tt('3 ayda bir')}</td><td>{p.monitoringPlan.quarterly}</td></tr><tr><td className="bold">{tt('6. ay')}</td><td>{p.monitoringPlan.month6}</td></tr><tr><td className="bold">{tt('12. ay')}</td><td>{p.monitoringPlan.month12}</td></tr></tbody></table>{p.guardrails.length ? <><p className="caption bold">{tt('Korunması gerekenler')}</p><List items={p.guardrails} /></> : null}</Sec>
    <Sec n={8} title={tt('Şirketten ne gerekiyor?')} kind="recommendation"><List items={p.companySupportNeeds} empty={tt('Bu plan için şirket desteği gerekmiyor.')} /><p className="caption">{tt('Bunlar birim yöneticisinin tek başına yapamayacağı işlerdir; yerel aksiyon olarak açılmaz.')}</p></Sec>
    <Sec n={9} title={tt('Başarıyı nasıl anlayacağız?')}>{p.successCriteria ? <table className="table"><tbody><tr><td className="bold">{tt('Süreç')}</td><td>{p.successCriteria.process}</td></tr><tr><td className="bold">{tt('Kalite')}</td><td>{p.successCriteria.quality}</td></tr><tr><td className="bold">{tt('Sonuç')}</td><td>{p.successCriteria.outcome}</td></tr></tbody></table> : <p className="body">{tt('Süreç: aksiyonların kanıtla tamamlanması. Sonuç: takip döneminde maddenin Top Box değerinin hedefe yaklaşması.')}</p>}<p className="caption">{tt('Başarı yalnız aksiyonların yapılması değildir; sonuç takip ölçümünde görülür.')}</p></Sec>
    <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
      <Acilir baslik={tt('Bu öneri neden veriliyor?')} testid="ai-neden"><p className="caption bold">{tt('Verideki durum')}</p><List items={[...p.evidenceSummary, ...p.relatedPatterns]} /><p className="caption bold">{tt('Olası açıklamalar (doğrulanmalı)')}</p><List items={p.hypotheses} /><p className="caption bold">{tt('Aksiyondan önce doğrulanacaklar')}</p><List items={p.validationChecks} /></Acilir>
      {sinir.length ? <Acilir baslik={tt('Dikkat / veri sınırlamaları')} testid="ai-sinir"><List items={sinir} /></Acilir> : null}
    </div>
  </>);
}

export function AiActionCard({ a, footer }: { a: Act; footer?: React.ReactNode }) { return (
  <article className="ai-card stack-1"><p className="caption bold ai-phase">{tt(asama(a))}{' · '}{tt('{0}–{1}. ay', a.startMonth, a.endMonth)}{a.cadence ? <>{' · '}{tt('kayıt sıklığı: {0}', tt(CAD[a.cadence] ?? a.cadence))}</> : null}{a.level ? <>{' · '}{tt(LEVEL[a.level] ?? a.level)}</> : null}</p>
    {a.firstStep ? <p className="body"><span className="bold">{tt('İlk adım:')}</span> {a.firstStep}</p> : null}
    <p className="h3">{a.title}</p>
    <p className="body"><span className="bold">{tt('Amaç:')}</span> {a.objective}</p><p className="body"><span className="bold">{tt('Neden önerildi:')}</span> {a.rationale}</p>
    <p className="body"><span className="bold">{tt('Sorumlu rol:')}</span> {a.ownerRole}{a.collaborators.length ? <> · <span className="bold">{tt('İş birliği:')}</span> {a.collaborators.join(', ')}</> : null}</p>
    <p className="caption bold">{tt('Adımlar')}</p><ol className="ai-list">{a.steps.map((x, k) => <li key={k} className="body">{x}</li>)}</ol>
    <p className="caption bold">{tt('Göstergeler')}</p><List items={a.indicators} /><p className="caption bold">{tt('Gerekli kanıt')}</p><List items={a.evidenceRequired} />
    {a.expectedOutput ? <p className="body"><span className="bold">{tt('Beklenen çıktı:')}</span> {a.expectedOutput}</p> : null}{a.checkpoint ? <p className="body"><span className="bold">{tt('Kontrol noktası:')}</span> {a.checkpoint}</p> : null}
    <p className="caption bold">{tt('Bağımlılıklar')}</p><List items={a.dependencies} /><p className="caption bold">{tt('Riskler')}</p><List items={a.risks} />{footer}
  </article>); }

export function AiAssist({ tid, targets, canUse }: { tid: string; targets: (TargetLite & { approved_target?: number | string | null })[]; canUse: boolean }) {
  const [st, setSt] = useState<AiStatus | null>(null); const [sel, setSel] = useState(''); const [res, setRes] = useState<PlanRes | null>(null);
  const [busy, setBusy] = useState(false); const inflight = useRef(false); const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const [pick, setPick] = useState<number[]>([]);
  useEffect(() => { let on = true; api<AiStatus>('GET', `/api/t/${tid}/ai/status`).then(r => { if (on) setSt(r); }).catch(() => { if (on) setSt(null); }); return () => { on = false; }; }, [tid]);
  useEffect(() => { setRes(null); setErr(null); setMsg(null); setPick([]); if (!sel || !st?.available) return; let on = true;
    api<PlanRes>('GET', `/api/t/${tid}/targets/${sel}/ai-plan`).then(r => { if (on) setRes(r); }).catch(e => { if (on) setErr(friendly(e)); }); return () => { on = false; }; }, [sel, tid, st?.available]);
  useEffect(() => { if (sel && !targets.some(t => t.id === sel)) setSel(''); }, [targets, sel]);
  if (!canUse || !targets.length) return null;
  const generate = async (regenerate: boolean) => {
    if (inflight.current || !sel) return; if (regenerate && !confirm(tt('Plan yeniden oluşturulsun mu? Bu işlem yeni bir yapay zekâ çağrısı yapar.'))) return;
    inflight.current = true; setBusy(true); setErr(null); setMsg(null);
    try { const r = await api<PlanRes>('POST', `/api/t/${tid}/targets/${sel}/ai-plan`, regenerate ? { regenerate: true } : {}, { idempotencyKey: newIdempotencyKey(), timeoutMs: 180000 }); setRes(r); setPick([]); }
    catch (e) { setErr(friendly(e)); } finally { inflight.current = false; setBusy(false); }
  };
  const transfer = async () => { /* seçilenleri tek istekte aktar */
    if (!res?.plan || !pick.length || inflight.current) return; inflight.current = true; setBusy(true); setErr(null); setMsg(null);
    try { await api('POST', `/api/t/${tid}/ai-plans/${res.plan.id}/actions`, { indices: pick }, { idempotencyKey: newIdempotencyKey() }); setMsg(tt('{0} aksiyon "planlandı" durumunda Aksiyonlar ekranına aktarıldı; başlatmak için Aksiyonlar ekranını kullanın.', pick.length));
      const r = await api<PlanRes>('GET', `/api/t/${tid}/targets/${sel}/ai-plan`); setRes(r); setPick([]); }
    catch (e) { setErr(friendly(e)); } finally { inflight.current = false; setBusy(false); }
  };
  const p = res?.plan?.plan; const accepted = res ? ['accepted', 'active'].includes(res.targetStatus) : false; const nihaiRaw = targets.find(t => t.id === sel)?.approved_target; const nihai = nihaiRaw === null || nihaiRaw === undefined || nihaiRaw === '' ? null : Number(nihaiRaw); const local = p ? p.interventionScope === 'UNIT' || p.interventionScope === 'MIXED' : false;
  return (
    <div className="col-12 stack ai-assist" data-testid="ai-assist">
      <Kicker>{tt('Yapay zekâ desteği (isteğe bağlı)')}</Kicker>
      <div className="row">
        <div style={{ minWidth: '18rem' }}><Field id="ai-target" kind="select" label={tt('Hedef')} value={sel} onChange={e => setSel(e.target.value)}><option value="">{tt('Seçin')}</option>{targets.map(t => <option key={t.id} value={t.id}>{t.item_code}{t.item_text ? ` · ${t.item_text.slice(0, 60)}` : ''} · {trl(t.status)}</option>)}</Field></div>
        <Button onClick={() => { void generate(false); }} disabled={!st?.available || !sel || busy} disabledReason={!st?.available ? undefined : !sel ? tt('Önce hedef seçin') : undefined}>{busy ? tt('Yapay zekâ planı hazırlanıyor…') : tt('Yapay zekâdan yardım al')}</Button>
        {p ? <Button variant="secondary" onClick={() => { void generate(true); }} disabled={busy}>{tt('Planı yeniden oluştur')}</Button> : null}
      </div>
      {st && !st.available ? <p className="caption" data-testid="ai-unavailable">{tt('Yapay zekâ desteği için şirketinizin OpenAI bağlantısı kurulmalıdır.')}</p> : null}
      {busy ? <p className="caption" role="status">{tt('Tek bir yapay zekâ çağrısıyla kapsamlı plan hazırlanıyor; bu işlem bir dakikayı bulabilir.')}</p> : null}
      {err ? <p className="bold" role="alert">{err}</p> : null}{msg ? <p className="caption" role="status">{msg}</p> : null}
      {p && res?.plan ? <div className="ai-panel stack" data-testid="ai-panel">
        {res.plan.stale ? <p className="bold ai-stale" role="note">{tt('Bu plan eski verilere göre hazırlanmıştır.')}{' '}{tt('Yeni veriyle hazırlamak için "Planı yeniden oluştur"u kullanın.')}</p> : null}
        <PlanBody p={p} createdAt={res.plan.createdAt} local={local} nihaiHedef={nihai} cardFooter={i => { const opened = res.plan!.openedIndices.includes(i); const a = p.actions[i]!; if (a.level === 'COMPANY') return <p className="caption bold">{tt('Şirket desteği gereken iş; yerel aksiyon olarak açılmaz.')}</p>; return local && accepted ? (opened ? <p className="caption bold">{tt('Aksiyona aktarıldı (planlandı)')}</p> : res.plan!.stale ? null : <label className="row"><input type="checkbox" checked={pick.includes(i)} onChange={e => setPick(x => e.target.checked ? [...x, i] : x.filter(y => y !== i))} /> <span className="body">{tt('Aksiyona aktar')}</span></label>) : null; }} />
        <div className="stack-1 ai-use" data-testid="ai-use"><Kicker>{tt('Planı taslak olarak kullan')}</Kicker>
          {!accepted ? <p className="bold">{tt('Aksiyonlar hedef kabul edildikten sonra taslağa aktarılabilir.')}</p>
            : !local ? <p className="caption">{tt('Bu plan birim düzeyinde yerel aksiyon önermez.')}</p>
            : res.plan.stale ? <p className="bold">{tt('Bu plan eski verilere göre hazırlanmıştır; aksiyon aktarmadan önce planı yeniden oluşturun.')}</p> : <div className="row"><Button onClick={() => { void transfer(); }} disabled={!pick.length || busy} disabledReason={!pick.length ? tt('Aktarılacak aksiyonu seçin') : undefined}>{tt('Seçilen aksiyonları aktar')}</Button></div>}
          <p className="caption">{tt('Yapay zekâ çıktısı öneridir; hiçbir hedef ya da aksiyon otomatik kabul edilmez veya yayımlanmaz.')}</p></div>
      </div> : null}
    </div>);
}

export function AiConnectionPanel({ tid }: { tid: string }) {
  const [st, setSt] = useState<AiStatus | null>(null); const [key, setKey] = useState(''); const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const load = () => api<AiStatus>('GET', `/api/t/${tid}/ai/status`).then(setSt).catch(() => setSt(null));
  useEffect(() => { void load(); }, [tid]);
  if (!st?.canManage) return null; // yalnız şirket geneli İK yöneticisi görür
  const save = async () => { setBusy(true); setErr(null); setMsg(null); try { await api('POST', `/api/t/${tid}/ai/config`, { apiKey: key.trim() }, { idempotencyKey: newIdempotencyKey() }); setKey(''); setMsg(tt('OpenAI bağlantısı kaydedildi.')); await load(); } catch (e) { setErr(e instanceof ApiError && e.code === 'invalid_key_format' ? tt('Anahtar biçimi tanınmadı (sk- ile başlamalı).') : describeError(e)); } finally { setBusy(false); } };
  const remove = async () => { if (!confirm(tt('OpenAI bağlantısı kaldırılsın mı? Yapay zekâ desteği kapanır; hedef akışı etkilenmez.'))) return; setBusy(true); setErr(null); setMsg(null); try { await api('POST', `/api/t/${tid}/ai/config/remove`, {}, { idempotencyKey: newIdempotencyKey() }); setMsg(tt('OpenAI bağlantısı kaldırıldı.')); await load(); } catch (e) { setErr(describeError(e)); } finally { setBusy(false); } };
  return (
    <div className="col-12 stack-1" data-testid="ai-connection"><Kicker>{tt('Yapay zekâ bağlantısı (OpenAI)')}</Kicker>
      <p className="body">{tt('OpenAI bağlantısı:')}{' '}<span className="bold">{st.configured ? tt('Bağlı') : tt('Bağlı değil')}</span>{st.configured && st.keyLast4 ? <> · {tt('anahtar ••••{0}', st.keyLast4)}</> : null}{!st.modelConfigured ? <> · {tt('sunucuda model yapılandırılmamış')}</> : null}</p>
      <p className="caption">{tt('Yapay zekâ kullanımı şirketinizin kendi OpenAI API hesabından ücretlendirilir. Anahtar sunucuda şifreli saklanır ve bir daha gösterilmez.')}</p>
      <div className="row"><div style={{ minWidth: '22rem' }}><Field id="ai-key" type="password" label={st.configured ? tt('Yeni API anahtarı (değiştir)') : tt('API anahtarı')} value={key} autoComplete="off" onChange={e => setKey(e.target.value)} /></div>
        <Button onClick={() => { void save(); }} disabled={busy || key.trim().length < 20} disabledReason={key.trim().length < 20 ? tt('Anahtarı girin') : undefined}>{st.configured ? tt('Anahtarı değiştir') : tt('Bağlantıyı kur')}</Button>
        {st.configured ? <Button variant="secondary" onClick={() => { void remove(); }} disabled={busy}>{tt('Bağlantıyı kaldır')}</Button> : null}</div>
      {err ? <p className="bold" role="alert">{err}</p> : null}{msg ? <p className="caption" role="status">{msg}</p> : null}
    </div>);
}

/** v2.13.1: hedef ÖNCESİ yapay zekâ yardımı — "Öneriyi gör"den sonra, hedef kaydı yazmadan. "AI hedefini kullan" yalnız Hedef değer alanını doldurur. */
export function PreviewAi({ tid, cycleId, unitId, itemCode, range, onUseTarget, onPlan }: { tid: string; cycleId: string; unitId: string; itemCode: string; range: { low: number; high: number } | null; onUseTarget: (v: number) => void; onPlan: (planId: string | null) => void }) {
  const [st, setSt] = useState<AiStatus | null>(null); const [res, setRes] = useState<PlanRes | null>(null); const [busy, setBusy] = useState(false); const inflight = useRef(false); const [err, setErr] = useState<string | null>(null);
  const url = `/api/t/${tid}/cycles/${cycleId}/units/${unitId}/items/${encodeURIComponent(itemCode)}/ai-plan`;
  useEffect(() => { let on = true; api<AiStatus>('GET', `/api/t/${tid}/ai/status`).then(r => { if (on) setSt(r); }).catch(() => { if (on) setSt(null); }); return () => { on = false; }; }, [tid]);
  useEffect(() => { setRes(null); setErr(null); onPlan(null); if (!st?.available) return; let on = true; api<PlanRes>('GET', url).then(r => { if (on) { setRes(r); onPlan(r.plan && !r.plan.stale ? r.plan.id : null); } }).catch(() => { /* önizleme yoksa sessiz */ }); return () => { on = false; }; }, [url, st?.available]);
  const run = async (regenerate: boolean) => { if (inflight.current) return; if (regenerate && !confirm(tt('Plan yeniden oluşturulsun mu? Bu işlem yeni bir yapay zekâ çağrısı yapar.'))) return; inflight.current = true; setBusy(true); setErr(null);
    try { const r = await api<PlanRes>('POST', url, regenerate ? { regenerate: true } : {}, { idempotencyKey: newIdempotencyKey(), timeoutMs: 180000 }); setRes(r); onPlan(r.plan ? r.plan.id : null); } catch (e) { setErr(friendly(e)); } finally { inflight.current = false; setBusy(false); } };
  const p = res?.plan?.plan; const rec = p?.targetRecommendation.recommendedValue ?? null; const inRange = rec !== null && range !== null && rec >= range.low && rec <= range.high;
  return (<div className="stack-1 ai-assist" data-testid="ai-preview">
    <div className="row"><Button onClick={() => { void run(false); }} disabled={!st?.available || busy}>{busy ? tt('Yapay zekâ planı hazırlanıyor…') : tt('Yapay zekâdan yardım al')}</Button>{p ? <Button variant="secondary" onClick={() => { void run(true); }} disabled={busy}>{tt('Planı yeniden oluştur')}</Button> : null}</div>
    {st && !st.available ? <p className="caption" data-testid="ai-unavailable">{tt('Yapay zekâ desteği için şirketinizin OpenAI bağlantısı kurulmalıdır.')}</p> : null}
    {busy ? <p className="caption" role="status">{tt('Tek bir yapay zekâ çağrısıyla kapsamlı plan hazırlanıyor; bu işlem bir dakikayı bulabilir.')}</p> : null}{err ? <p className="bold" role="alert">{err}</p> : null}
    {p && res?.plan ? <div className="ai-panel stack" data-testid="ai-panel">
      {res.plan.stale ? <p className="bold ai-stale" role="note">{tt('Bu plan eski verilere göre hazırlanmıştır.')}{' '}{tt('Yeni veriyle hazırlamak için "Planı yeniden oluştur"u kullanın.')}</p> : null}
      <p className="caption bold">{tt('Bu plan henüz bir hedefe bağlı değil; hedef oluşturulmadıkça hiçbir hedef ya da aksiyon kaydı yoktur.')}</p>
      {inRange ? <div className="row"><Button variant="secondary" onClick={() => onUseTarget(rec!)} data-testid="ai-use-target">{tt('AI hedefini kullan ({0})', rec)}</Button><span className="caption">{tt('Yalnız "Hedef değer" alanını doldurur; hedefi siz oluşturursunuz.')}</span></div> : null}
      <PlanBody p={p} createdAt={res.plan.createdAt} local={p.interventionScope === 'UNIT' || p.interventionScope === 'MIXED'} cardFooter={() => null} nihaiHedef={null} />
      <p className="caption">{tt('Aksiyonlar hedef kabul edildikten sonra taslağa aktarılabilir.')}</p>
    </div> : null}
  </div>);
}

/** v2.13.1: Aksiyonlar ekranında AI kökenli aksiyonun plan ayrıntısı (salt okunur öneri) */
export function ActionAiPlan({ tid, actionId }: { tid: string; actionId: string }) {
  const [open, setOpen] = useState(false); const [d, setD] = useState<{ createdAt: string; action: Act | null; note: string } | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setOpen(false); setD(null); setErr(null); }, [actionId]);
  const show = async () => { setOpen(o => !o); if (d || open) return; try { setD(await api('GET', `/api/t/${tid}/actions/${actionId}/ai-plan`)); } catch (e) { setErr(describeError(e)); } };
  return (<div className="stack-1" data-testid="action-ai-plan"><Button variant="secondary" onClick={() => { void show(); }}>{open ? tt('AI planını gizle') : tt('AI planını gör')}</Button>
    {open && err ? <p className="bold" role="alert">{err}</p> : null}
    {open && d?.action ? <div className="stack-1"><p className="caption bold">{tt('Yapay zekâ önerisidir; gerçekleşme ya da kanıt değildir.')}{' · '}{String(d.createdAt).slice(0, 10)}</p><AiActionCard a={d.action} /></div> : null}</div>);
}
