/** v2.15.0 — Yol haritası (sunumla birebir). HPTW birim raporunun "Yol Haritası" bölümü; metin ve sayılar sunumdakiyle aynıdır.
 * Takip: İK ve birim yönetimi adımları (Başlamadı / Devam ediyor / Tamamlandı) ve eylem planı takvimi (termin, tamamlandı).
 * Tasarım B: numaralı bölümler, siyah özet şeridi, kare ilerleme, sarı ikincil düğmeler içeriğin altında, "Nasıl okunur?" sağ panelde. */
import { tt, locale } from '../i18n';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { commandApi, describeError } from '../api';
import { useLoad, getJson } from '../hooks';
import { DTO } from '../dto';
import { useTid, LoadError } from './Chain';
import { Ekran, Not, Baslik, Serit, Bolum, Tam, Uyari, Hata, Kare, KareLeg, BarTablo, Tablo, KucukBtn, Secici, f1 } from '../ui/tb';

type Num = number | null;
type Step = { id: string; role: 'IK' | 'YONETIM' | 'CALISAN'; roleLabel: string; ord: number; text: string; status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'; note: string | null; version: number; statusAt: string | null };
type Ms = { id: string; ord: number; phase: string; dueDays: number; dueDate: string; text: string; status: 'OPEN' | 'DONE'; note: string | null; version: number; statusAt: string | null; overdue: boolean };
type Ind = { label: string | null; itemCode?: string | null; dimensionCode?: string | null; unit: Num; company: Num };
type Plan = { id: string; no: number; themeNo: Num; title: string; headline: string; mentions: Num; commenters: Num; dataNote: string | null; indicators: Ind[]; measure: { label: string | null; itemCode: string | null; current: Num; company: Num; target: Num; rule: string | null; text: string }; followup: { cycle: string; suppressed: boolean; value: Num } | null; steps: Step[]; milestones: Ms[] };
type R = Record<string, string | number | null>;
type Detail = { id: string; status: string; cycleCode: string; unitCode: string; unitLabel: string; sectorLabel: string | null; reportTitle: string; companyLabel: string; startDate: string; today: string; rights: { IK: boolean; YONETIM: boolean; milestone: boolean }; plans: Plan[]; siblings: { roadmapId: string; unitCode: string; unitLabel: string }[];
  content: { header: R; strengths: R[]; priorities: R[]; priorityPractices: R[]; influence: R[]; agenda: R[]; agendaIndicators: R[]; roles: R[]; roleResponsibilities: R[]; roleProcesses: R[]; calendar: R[]; monitoring: R[] } };
type Summary = { roadmapId: string; unitId: string; unitCode: string; unitLabel: string; sectorLabel: string | null; participants: Num; certScore: Num; plans: number; management: { total: number; done: number; inProgress: number }; hr: { total: number; done: number }; milestones: { total: number; done: number; overdue: number; nextDue: string | null }; startDate: string };
type List = { cycles: { id: string; code: string }[]; cycleId: string | null; reportTitle: string | null; companyLabel: string | null; units: Summary[]; companyPriorities: { no: number; title: string; shortTitle: string | null; rationale: string | null; area: string | null }[]; today: string };
type HrStep = { id: string; unitCode: string; unitLabel: string; roadmapId: string; planNo: number; planTitle: string; ord: number; text: string; status: Step['status']; note: string | null; version: number; canUpdate: boolean };

const GUN = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
const P = (v: Num | undefined) => (v === null || v === undefined ? '—' : `%${f1(Number(v))}`);
const ilk = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1) : s); // takvim satırı sunumda "İlk 30 gün: …" biçiminde küçük harfle başlar; tek başına gösterilirken ilk harf büyütülür
const lines = (s: unknown) => String(s ?? '').split('\n').map(x => x.trim()).filter(Boolean);
const ST: Record<Step['status'], string> = { NOT_STARTED: tt('Başlamadı'), IN_PROGRESS: tt('Devam ediyor'), DONE: tt('Tamamlandı') };
const ROLE_ORDER: Step['role'][] = ['IK', 'YONETIM', 'CALISAN'];

/* ------------------------------------------------------------------ giriş: liste ya da tek birim */
export function Roadmap() {
  const tid = useTid(); const [cyc, setCyc] = useState<string | null>(null);
  const q = useLoad<List>(`yh|${tid}|${cyc ?? ''}`, getJson<List>(`/api/t/${tid}/roadmaps${cyc ? `?cycleId=${cyc}` : ''}`, DTO.roadmaps));
  if (q.status === 'error') return <main className="section surface-white"><div className="container"><LoadError message={q.message ?? ''} retry={q.reload} /></div></main>;
  if (!q.data) return <main className="section surface-white"><div className="container"><p className="caption">{tt('Yükleniyor…')}</p></div></main>;
  const d = q.data;
  if (!d.units.length) return <main className="section surface-white"><div className="container stack"><Baslik kicker={tt('Yol haritası')} h1={tt('Henüz yol haritası yüklenmedi.')} cap={tt('Yol haritası, HPTW birim raporundaki (sunumdaki) yol haritası bölümünün HPW Act karşılığıdır. İK yöneticisi "Dönemler ve sonuçlar" ekranından yol haritası formunu yükler.')} /></div></main>;
  if (d.units.length === 1) return <RoadmapDetail rid={d.units[0]!.roadmapId} />;
  return <RoadmapList d={d} tid={tid} onCycle={setCyc} />;
}
export function RoadmapRoute() { const { rid } = useParams(); return <RoadmapDetail rid={String(rid)} />; }

function RoadmapList({ d, tid, onCycle }: { d: List; tid: string; onCycle: (c: string) => void }) {
  const nav = useNavigate();
  const mt = d.units.reduce((a, u) => a + u.management.total, 0), md = d.units.reduce((a, u) => a + u.management.done, 0);
  const ht = d.units.reduce((a, u) => a + u.hr.total, 0), hd = d.units.reduce((a, u) => a + u.hr.done, 0);
  const od = d.units.reduce((a, u) => a + u.milestones.overdue, 0);
  const hr = useLoad<HrStep[]>(`yhik|${tid}|${d.cycleId}`, getJson<HrStep[]>(`/api/t/${tid}/roadmap-hr-steps?cycleId=${d.cycleId}`, DTO.roadmapHrSteps));
  const canHr = (hr.data ?? []).some(s => s.canUpdate);
  return <main className="tb"><div className="wrap"><Ekran baslik={tt('Yol haritası')}>
    <Baslik kicker={tt('Yol haritası · {0}', d.reportTitle ?? '')} h1={tt('Sunumdaki yol haritası nerede?')} cap={tt('Her birimin eylem planları ve takvimi sunumda nasılsa burada da öyledir; ilerlemeyi işi yapan rol işaretler.')}
      sag={d.cycles.length > 1 ? <Secici etiket={tt('Dönem')} deger={d.cycleId ?? ''} secenekler={d.cycles.map(c => ({ v: c.id, t: c.code }))} onSec={onCycle} /> : undefined} />
    <Serit hucreler={[{ k: tt('Birim yönetimi adımları'), v: tt('{0} / {1}', md, mt) }, { k: tt('İK adımları'), v: tt('{0} / {1}', hd, ht) }, { k: tt('Termini geçmiş takvim satırı'), v: String(od) }]} />
    <Bolum n={1} ilk kicker={tt('Üç öncelik')} soru={tt('Şirket genelinde ne öncelikli?')} red not={tt('Sunumda her birim raporunda yer alan üç gelişim önceliği. Birimdeki karşılıkları birim yol haritasında.')}>
      <ol className="adl">{d.companyPriorities.map(p => <li key={p.no}><span className="bold">{p.title}</span>{p.rationale ? <><br /><span className="cap">{p.rationale}</span></> : null}</li>)}</ol>
    </Bolum>
    <Tam kicker={tt('2 · Birimler')} soru={tt('Hangi birim nerede?')} cap={tt('Kareler: birim yönetiminin ve İK\'nın adımları; kırmızı dolu kare tamamlandı.')}>
      <Not baslik={tt('Birimler tablosu')}>{tt('Her satır bir birimin yol haritasıdır. Takvim sütunu eylem planlarındaki "İlk 30 gün / İlk 90 gün / 6 ay" satırlarının kaçının tamamlandığını ve termini geçenleri gösterir. Ayrıntı için "Yol haritasını incele".')}</Not>
      <KareLeg />
      <Tablo id="yh-birimler" bas={[tt('Birim'), tt('Eylem planı'), tt('Birim yönetimi adımları'), tt('İK adımları'), tt('Takvim'), tt('Sıradaki termin'), '']} orta={[1]}
        satirlar={d.units.map(u => [<><span className="bold">{u.unitLabel}</span><br /><span className="cap">{u.sectorLabel ?? ''}{u.participants ? ` · ${tt('{0} katılımcı', u.participants)}` : ''}</span></>, String(u.plans),
          u.management.total ? <><Kare dolu={u.management.done} toplam={u.management.total} /><br /><span className="cap">{tt('{0} / {1} tamamlandı', u.management.done, u.management.total)}{u.management.inProgress ? ` · ${tt('{0} devam ediyor', u.management.inProgress)}` : ''}</span></> : <span className="cap">{tt('Eylem planı yok')}</span>,
          u.hr.total ? <><Kare dolu={u.hr.done} toplam={u.hr.total} /><br /><span className="cap">{tt('{0} / {1} tamamlandı', u.hr.done, u.hr.total)}</span></> : <span className="cap">—</span>,
          u.milestones.total ? <>{tt('{0} / {1} tamamlandı', u.milestones.done, u.milestones.total)}{u.milestones.overdue ? <><br /><span className="bold red">{tt('{0} satırın termini geçti', u.milestones.overdue)}</span></> : null}</> : <span className="cap">—</span>,
          u.milestones.nextDue ? GUN(u.milestones.nextDue) : '—',
          <KucukBtn key="b" testid={`yh-incele-${u.unitCode}`} onClick={() => nav(`/t/${tid}/yol-haritasi/${u.roadmapId}`)}>{tt('Yol haritasını incele')}</KucukBtn>])} />
    </Tam>
    {hr.status === 'ok' && hr.data && hr.data.length ? <Tam kicker={tt('3 · İK\'nın adımları')} soru={canHr ? tt('İK bu ay ne yapmalı?') : tt('İK\'nın adımları nerede?')} cap={tt('Eylem planlarındaki İnsan Kaynakları sütunu; bütün birimler tek listede.')}>
      <Not baslik={tt('İK\'nın adımları')}>{tt('Sunumdaki eylem planlarında İnsan Kaynakları sütununa yazılan adımlar. Durumu İK yöneticisi ve İK iş ortağı günceller; diğer roller izler.')}</Not>
      <HrSteps tid={tid} rows={hr.data} reload={hr.reload} />
    </Tam> : hr.status === 'error' ? <LoadError message={hr.message ?? ''} retry={hr.reload} /> : null}
  </Ekran></div></main>;
}

function HrSteps({ tid, rows, reload }: { tid: string; rows: HrStep[]; reload: () => unknown }) {
  const done = rows.filter(r => r.status === 'DONE').length;
  return <><p className="cap"><Kare dolu={done} toplam={Math.min(rows.length, 60)} /> {tt('{0} / {1} tamamlandı', done, rows.length)}</p>
    <Tablo id="yh-ik" bas={[tt('Birim'), tt('Eylem planı'), tt('Adım'), tt('Durum')]} satirlar={rows.map(r => [r.unitLabel, `${r.planNo}. ${r.planTitle}`, r.text, <StatusPicker key={r.id} tid={tid} kind="step" id={r.id} status={r.status} version={r.version} can={r.canUpdate} onDone={reload} />])} /></>;
}

/* ------------------------------------------------------------------ durum seçimi (aralıklı ayrı düğmeler; seçili olan yalnız renkle ayrılır) */
function StatusPicker({ tid, kind, id, status, version, can, onDone }: { tid: string; kind: 'step' | 'milestone'; id: string; status: string; version: number; can: boolean; onDone: () => unknown }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const opts: [string, string][] = kind === 'step' ? [['NOT_STARTED', ST.NOT_STARTED], ['IN_PROGRESS', ST.IN_PROGRESS], ['DONE', ST.DONE]] : [['OPEN', tt('Açık')], ['DONE', tt('Tamamlandı')]];
  const set = async (s: string) => { if (!can || busy || s === status) return; setBusy(true); setErr(null); try { await commandApi(`/api/t/${tid}/${kind === 'step' ? 'roadmap-steps' : 'roadmap-milestones'}/${id}/status`, { status: s, expectedVersion: version }); await onDone(); } catch (e) { setErr(describeError(e)); } finally { setBusy(false); } };
  if (!can) return <span className="bold" data-testid={`yh-durum-${id}`}>{opts.find(o => o[0] === status)?.[1] ?? status}</span>;
  return <div><div className="opt yh-opt" role="group" aria-label={tt('Durum')}>{opts.map(([v, t]) => <span key={v} role="button" tabIndex={0} aria-pressed={v === status} aria-disabled={busy} className={v === status ? 'on' : ''} data-testid={`yh-${kind}-${id}-${v}`} onClick={() => void set(v)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void set(v); } }}>{t}</span>)}</div>{err ? <Hata>{err}</Hata> : null}</div>;
}

/* ------------------------------------------------------------------ birim yol haritası */
function RoadmapDetail({ rid }: { rid: string }) {
  const tid = useTid(); const nav = useNavigate();
  const q = useLoad<Detail>(`yhd|${tid}|${rid}`, getJson<Detail>(`/api/t/${tid}/roadmaps/${rid}`, DTO.roadmapDetail));
  if (q.status === 'error') return <main className="section surface-white"><div className="container"><LoadError message={q.message ?? ''} retry={q.reload} /></div></main>;
  if (!q.data) return <main className="section surface-white"><div className="container"><p className="caption">{tt('Yükleniyor…')}</p></div></main>;
  const d = q.data; const c = d.content; const h = c.header; const CL = d.companyLabel;
  const all = d.plans.flatMap(p => p.steps); const mg = all.filter(s => s.role === 'YONETIM'); const ik = all.filter(s => s.role === 'IK');
  const ms = d.plans.flatMap(p => p.milestones); const od = ms.filter(m => m.overdue).length; const next = ms.filter(m => m.status === 'OPEN' && !m.overdue).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const roleLabel = (code: string) => String(c.influence.find(r => r.role_code === code)?.role_label ?? c.roles.find(r => r.role_code === code)?.title ?? code);
  let n = 0; const N = () => ++n;
  return <main className="tb"><div className="wrap"><Ekran baslik={tt('Birim yol haritası')}>
    <Baslik kicker={tt('Yol haritası · {0} · {1}', d.unitLabel, d.cycleCode)} h1={tt('{0} yol haritası', d.unitLabel)} cap={tt('{0} · başlangıç {1}', d.reportTitle, GUN(d.startDate))}
      sag={d.siblings.length > 1 ? <><Secici etiket={tt('Birim')} deger={d.id} secenekler={d.siblings.map(s => ({ v: s.roadmapId, t: s.unitLabel }))} onSec={v => nav(`/t/${tid}/yol-haritasi/${v}`)} /><Link className="ybtn" to={`/t/${tid}/yol-haritasi`}>{tt('Bütün birimler')}</Link></> : undefined} />
    {d.status !== 'active' ? <Uyari>{tt('Bu yol haritasının yeni bir sürümü yüklendi; bu sayfa eski sürümü gösteriyor.')}</Uyari> : null}
    <Serit hucreler={[{ k: tt('Birim yönetimi adımları'), v: mg.length ? tt('{0} / {1}', mg.filter(s => s.status === 'DONE').length, mg.length) : '—' }, { k: tt('İK adımları'), v: ik.length ? tt('{0} / {1}', ik.filter(s => s.status === 'DONE').length, ik.length) : '—' },
      { k: tt('Takvim'), duz: true, v: ms.length ? <>{od ? tt('{0} satırın termini geçti', od) : tt('Termini geçen satır yok')}{next ? <><br />{tt('Sıradaki: {0} · {1}', GUN(next.dueDate), next.phase)}</> : null}</> : tt('Bu birimde eylem planı yok') }]} />

    <Bolum n={N()} ilk kicker={tt('Ana sonuç')} soru={tt('Birim yönetimi için ana sonuç ne?')} red not={String(h.conclusion_title ?? '')}>
      <p className="h3" style={{ marginBottom: 12 }}>{String(h.conclusion_headline ?? '')}</p>
      {lines(h.conclusion_body).map((x, i) => <p key={i} className="body-l" style={{ marginBottom: 12 }}>{x}</p>)}
      <p className="cap">{[h.headcount ? tt('{0} çalışan', h.headcount) : null, h.participants ? tt('{0} katılımcı', h.participants) : null, h.participation_rate !== null && h.participation_rate !== undefined ? tt('katılım {0}', P(Number(h.participation_rate))) : null, h.cert_score !== null && h.cert_score !== undefined ? tt('sertifikasyon puanı {0}', P(Number(h.cert_score))) : null, d.sectorLabel ? tt('karşılaştırma: {0} · {1}', d.sectorLabel, CL) : null].filter(Boolean).join(' · ')}</p>
    </Bolum>

    <Bolum n={N()} kicker={tt('Güçlü yönler ve öncelikler')} soru={tt('Neye dayanacağız, neyi geliştireceğiz?')} not={tt('Solda birimin görece güçlü yönleri, sağda şirket genelinde belirlenen üç gelişim önceliğinin bu birimdeki karşılığı (sunumdaki gibi).')}>
      <div className="ikikolon"><div><p className="etk">{tt('Görece güçlü yönler')}</p>{c.strengths.map((s, i) => <div key={i} style={{ marginTop: 12 }}><p className="bold">{String(s.title)}</p><p className="cap">{String(s.text ?? '')}</p></div>)}</div>
        <div><p className="etk">{tt('Üç önceliğin birimdeki karşılığı')}</p><ol className="adl">{c.priorities.map((p, i) => <li key={i}><span className="bold">{String(p.title)}</span>{p.rationale ? <><br />{String(p.rationale)}</> : null}{p.finding ? <><br /><span className="cap">{tt('Bulgu:')} {String(p.finding)}</span></> : null}</li>)}</ol></div></div>
      {h.priority_summary ? <p className="cap" style={{ marginTop: 12 }}>{String(h.priority_summary)}</p> : null}
    </Bolum>

    {c.agenda.length ? <Tam kicker={tt('{0} · Birimin gündemi', N())} soru={String(h.agenda_title ?? tt('Çalışanların ortak gündemi'))} cap={String(h.agenda_subtitle ?? '')}>
      <Not baslik={tt('Birimin gündemi')}>{tt('Yorumda değinen: konuya değinen çalışan sayısı / yorum yazan çalışan sayısı. Göstergeler bu birimin değeri ile {0} değeridir; fark puan cinsindendir.', CL)}</Not>
      <Tablo id="yh-gundem" bas={[tt('Konu'), tt('Yorumda değinen'), tt('İlgili anket göstergesi'), tt('Birim'), CL, tt('Fark')]} orta={[1, 3, 4, 5]}
        satirlar={c.agenda.flatMap(t => { const inds = c.agendaIndicators.filter(x => x.theme_no === t.theme_no); const rows = inds.length ? inds : [{ label: null, note: null, unit_value: null, company_value: null } as R];
          return rows.map((x, i) => [i === 0 ? <span className="bold">{`${t.theme_no}. ${t.title}`}</span> : '', i === 0 && t.mentions !== null ? tt('{0} / {1}', t.mentions, t.commenters ?? '—') : '', x.label ? String(x.label) : <span className="cap">{String(x.note ?? '—')}</span>, P(x.unit_value as Num), P(x.company_value as Num),
            x.unit_value !== null && x.company_value !== null && x.unit_value !== undefined && x.company_value !== undefined ? <span className={Number(x.unit_value) - Number(x.company_value) < 0 ? 'red bold' : 'bold'}>{`${Number(x.unit_value) - Number(x.company_value) > 0 ? '+' : ''}${f1(Number(x.unit_value) - Number(x.company_value))}`}</span> : '—']); })} />
    </Tam> : null}

    {d.plans.length ? <Tam kicker={tt('{0} · Eylem planları', N())} soru={tt('Kim, neyi, ne zamana kadar yapacak?')} red cap={tt('Her planda solda veri dayanağı, ortada rollerin adımları, altta izlenecek ölçüt ve takvim. Adımı yapan rol durumunu işaretler.')}>
      <Not baslik={tt('Eylem planları')}>{tt('Sunumdaki eylem planlarının aynısıdır. "{0}" ve "{1}" sütunlarındaki adımlar burada takip edilir: Başlamadı, Devam ediyor, Tamamlandı. Çalışanlar sütunu bilgi içindir. Takvim satırlarının termini yol haritasının başlangıç gününden hesaplanır.', roleLabel('IK'), roleLabel('YONETIM'))}</Not>
      <div className="ai-actions">{d.plans.map(p => <PlanCard key={p.id} p={p} tid={tid} rights={d.rights} companyLabel={CL} reload={q.reload} />)}</div>
    </Tam> : <Uyari>{tt('Bu birimin sunumunda eylem planı yok; öncelikler, roller ve uygulama takvimi aşağıdadır.')}</Uyari>}

    {c.priorityPractices.length ? <Tam kicker={tt('{0} · Uygulama adımları', N())} soru={tt('Her öncelikte neyi değerlendireceğiz, ne uygulayacağız?')}>
      <div className="uckolon">{c.priorities.map(p => { const pp = c.priorityPractices.filter(x => x.priority_no === p.priority_no); return <div key={String(p.priority_no)}><p className="etk">{tt('Öncelik {0}', p.priority_no)}</p><p className="bold" style={{ marginTop: 8 }}>{String(p.title)}</p>{p.area_label ? <p className="cap">{String(p.area_label)}</p> : null}
        <p className="etk" style={{ marginTop: 12 }}>{tt('Değerlendirme soruları')}</p><ul className="ai-list">{pp.filter(x => x.kind === 'QUESTION').map((x, i) => <li key={i} className="body">{String(x.text)}</li>)}</ul>
        <p className="etk" style={{ marginTop: 12 }}>{tt('Önerilen uygulamalar')}</p><ul className="ai-list">{pp.filter(x => x.kind === 'PRACTICE').map((x, i) => <li key={i} className="body">{String(x.text)}</li>)}</ul></div>; })}</div>
      {h.practice_principle ? <Uyari>{tt('Temel ilke:')} {String(h.practice_principle)}</Uyari> : null}
    </Tam> : null}

    {c.roles.length ? <Tam kicker={tt('{0} · Roller ve sorumluluklar', N())} soru={tt('Her rol kendi etki alanında ne yapacak?')}>
      <Not baslik={tt('Roller ve sorumluluklar')}>{tt('Etki alanı ilkesi: her role yalnız kendi doğrudan değiştirebileceği işler yazılır; başka bir makamın kararını gerektiren beklentiler veriyle izlenecek konu olarak ele alınır.')}</Not>
      {h.influence_principle ? <p className="cap">{String(h.influence_principle)}</p> : null}
      {ROLE_ORDER.map(rc => { const role = c.roles.find(r => r.role_code === rc); if (!role) return null; const inf = c.influence.filter(x => x.role_code === rc); const rr = c.roleResponsibilities.filter(x => x.role_code === rc); const pr = c.roleProcesses.filter(x => x.role_code === rc);
        return <article key={rc} className="tamfaz"><div className="sutunbas"><div className="ol">{String(inf[0]?.role_label ?? rc)}{inf[0]?.tagline ? ` · ${inf[0].tagline}` : ''}</div><h3>{String(role.title)}</h3></div>
          <div className="yh-ic">{role.description ? <p className="body">{String(role.description)}</p> : null}
            {inf.length ? <><p className="etk" style={{ marginTop: 12 }}>{tt('Genel görevler')}</p><ul className="ai-list">{inf.map((x, i) => <li key={i} className="body">{String(x.duty)}</li>)}</ul></> : null}
            <div className="uckolon" style={{ marginTop: 12 }}>{[1, 2, 3].map(no => { const xs = rr.filter(x => x.priority_no === no); if (!xs.length) return <div key={no} />; return <div key={no}><p className="etk">{tt('Öncelik {0}', no)} · {String(xs[0]!.priority_title ?? '')}</p><ul className="ai-list">{xs.filter(x => x.kind === 'DUTY').map((x, i) => <li key={i} className="body">{String(x.text)}</li>)}</ul>{xs.filter(x => x.kind === 'EXPECTED').map((x, i) => <p key={i} className="cap"><span className="bold">{tt('Beklenen sonuç:')}</span> {String(x.text)}</p>)}</div>; })}</div>
            {pr.length ? <><p className="etk" style={{ marginTop: 12 }}>{tt('Sürece katılım')}</p><div className="kv2">{pr.map((x, i) => <div key={i} style={{ display: 'contents' }}><div className="etk">{String(x.phase_label)}</div><div className="deg">{String(x.text)}</div></div>)}</div></> : null}
            {role.note ? <p className="cap" style={{ marginTop: 12 }}><span className="bold">{String(role.note_title ?? '')}</span> {String(role.note)}</p> : null}</div></article>; })}
    </Tam> : null}

    {c.calendar.length ? <Tam kicker={tt('{0} · Uygulama takvimi', N())} soru={tt('Hangi aşamada ne olacak?')}>
      <div className="uckolon">{[...new Set(c.calendar.map(x => Number(x.phase_no)))].map(no => { const xs = c.calendar.filter(x => Number(x.phase_no) === no); const f = xs[0]!; const out = xs.find(x => x.phase_outcome)?.phase_outcome; return <div key={no}><p className="etk">{String(f.phase_label)}</p><p className="bold" style={{ marginTop: 8 }}>{String(f.phase_title ?? '')}</p>
        {xs.map((x, i) => <div key={i} style={{ marginTop: 12 }}><p className="bold">{String(x.workstream_title)}</p><p className="body">{String(x.workstream_text)}</p></div>)}{out ? <p className="cap" style={{ marginTop: 12 }}>{String(out)}</p> : null}</div>; })}</div>
    </Tam> : null}

    {c.monitoring.length ? <Tam kicker={tt('{0} · İzleme göstergeleri ve hedefler', N())} soru={tt('Başarıyı nasıl anlayacağız?')} cap={lines(h.monitoring_approach)[0] ?? ''}>
      <Not baslik={tt('İzleme göstergeleri')}>{lines(h.monitoring_approach).join(' ')}</Not>
      <Tablo id="yh-izleme" bas={[tt('Gösterge'), tt('Mevcut'), tt('Sektör'), CL, tt('Hedef / izleme yaklaşımı')]} orta={[1, 2, 3]} satirlar={c.monitoring.map(m => [String(m.label), P(m.current_value as Num), P(m.sector_value as Num), P(m.company_value as Num), <span className="bold">{String(m.target_text)}</span>])} />
      {lines(h.monitoring_approach).slice(1).map((x, i) => <p key={i} className="cap">{x}</p>)}
    </Tam> : null}
  </Ekran></div></main>;
}

function PlanCard({ p, tid, rights, companyLabel, reload }: { p: Plan; tid: string; rights: Detail['rights']; companyLabel: string; reload: () => unknown }) {
  const roles = ROLE_ORDER.map(rc => ({ rc, steps: p.steps.filter(s => s.role === rc) })).filter(x => x.steps.length);
  const m = p.measure; const fu = p.followup;
  return <div data-testid={`yh-plan-${p.no}`}><article className="tamfaz"><div className="sutunbas"><div className="fazbas"><div className="no">{p.no}</div><div><div className="ol">{p.mentions !== null ? tt('Yorum yazan {0} çalışandan {1} kişi değiniyor', p.commenters ?? '—', p.mentions) : tt('Eylem planı')}</div><h3>{p.title}</h3></div></div></div>
    <div className="yh-ic">
      <p className="body">{p.headline}</p>
      <div className="kv2" style={{ marginTop: 12 }}>
        <div className="etk">{tt('Veri dayanağı')}</div><div className="deg">{p.indicators.length ? <BarTablo satirlar={p.indicators.filter(x => x.unit !== null && x.company !== null).map(x => ({ metin: String(x.label ?? ''), b: Number(x.unit), s: Number(x.company) }))} eb={tt('Bu birim')} es={companyLabel} madde={tt('Gösterge')} cap={tt('Siyah çubuk bu birim, gri çubuk {0}; değerler olumlu yanıt oranı (%).', companyLabel)} /> : null}{p.dataNote ? <p className="cap">{p.dataNote}</p> : null}{!p.indicators.length && !p.dataNote ? '—' : null}</div>
        <div className="etk">{tt('İzlenecek ölçüt')}</div><div className="deg">{m.label ? <div className="uckolon" style={{ gap: '1rem' }}><div><p className="cap">{m.label}</p><p className="h3">{tt('Mevcut {0}', P(m.current))}</p></div><div><p className="cap">{companyLabel}</p><p className="h3">{P(m.company)}</p></div><div><p className="cap">{tt('Hedef')}{m.rule ? ` · ${m.rule}` : ''}</p><p className="h3 red">{P(m.target)}</p></div></div> : <p className="body">{m.text}</p>}
          {m.label ? <p className="cap">{fu ? (fu.suppressed ? tt('Takip ölçümü ({0}): gizlilik eşiği nedeniyle gösterilmiyor', fu.cycle) : tt('Takip ölçümü ({0}): {1}', fu.cycle, P(fu.value))) : tt('Takip ölçümü henüz yok; bir sonraki ölçüm yüklendiğinde burada görünür.')}</p> : null}</div>
      </div>
      <p className="etk" style={{ marginTop: 16 }}>{tt('Adımlar')}</p>
      <div className="uckolon yh-roller">{roles.map(({ rc, steps }) => { const can = rc === 'IK' ? rights.IK : rc === 'YONETIM' ? rights.YONETIM : false; const done = steps.filter(s => s.status === 'DONE').length;
        return <div key={rc} data-testid={`yh-rol-${p.no}-${rc}`}><p className="bold">{steps[0]!.roleLabel}</p>{rc !== 'CALISAN' ? <p className="cap"><Kare dolu={done} toplam={steps.length} /> {tt('{0} / {1} tamamlandı', done, steps.length)}</p> : <p className="cap">{tt('Bilgi için; takip edilmez')}</p>}
          <ol className="adl">{steps.map(s => <li key={s.id}>{s.text}{rc !== 'CALISAN' ? <div style={{ marginTop: 8 }}><StatusPicker tid={tid} kind="step" id={s.id} status={s.status} version={s.version} can={can} onDone={reload} />{s.statusAt && s.status !== 'NOT_STARTED' ? <p className="cap">{tt('Son güncelleme: {0}', GUN(s.statusAt))}</p> : null}</div> : null}</li>)}</ol></div>; })}</div>
      {p.milestones.length ? <><p className="etk" style={{ marginTop: 16 }}>{tt('Takvim')}</p>
        <Tablo id={`yh-takvim-${p.no}`} bas={[tt('Aşama'), tt('Termin'), tt('Yapılacak'), tt('Durum')]} satirlar={p.milestones.map(x => [<span className="bold">{x.phase}</span>, <>{GUN(x.dueDate)}{x.overdue ? <><br /><span className="red bold">{tt('termini geçti')}</span></> : null}</>, ilk(x.text),
          <StatusPicker key={x.id} tid={tid} kind="milestone" id={x.id} status={x.status} version={x.version} can={rights.milestone} onDone={reload} />])} /></> : null}
    </div></article></div>;
}

/* ------------------------------------------------------------------ v2.15.0: giriş ekranındaki yol haritası özeti (birim müdürü, bölge, İK iş ortağı, izleyici, üst yönetim)
 * Yalnız yol haritası yüklenmiş şirkette görünür; yüklenmemişse bölüm hiç çizilmez (mevcut giriş ekranı aynen kalır). Hata boş sonuca çevrilmez. */
export type RoadmapList = List;
export function useRoadmapSummary(tid: string, enabled: boolean) { return useLoad<List | null>(`yhh|${tid}|${enabled}`, enabled ? getJson<List>(`/api/t/${tid}/roadmaps`, DTO.roadmaps) : async () => null); }
export function roadmapVisible(q: { status: string; data?: List | null }) { return q.status === 'error' || (q.status === 'ok' && !!q.data && q.data.units.length > 0); }
export function RoadmapHomeSection({ tid, n, ilk, q, red }: { tid: string; n: string; ilk?: boolean; red?: boolean; q: { status: string; data?: List | null; message?: string | null; reload: () => unknown } }) {
  if (q.status === 'error') return <Bolum n={n} ilk={ilk} kicker={tt('Yol haritası')} soru={tt('Yol haritasında neredeyiz?')}><LoadError message={q.message ?? tt('Veri alınamadı')} retry={() => { void q.reload(); }} /></Bolum>;
  const d = q.data; if (!d || !d.units.length) return null;
  const tek = d.units.length === 1 ? d.units[0]! : null;
  const dug = <Link className="btn btn--secondary" data-testid="yh-giris-incele" to={tek ? `/t/${tid}/yol-haritasi/${tek.roadmapId}` : `/t/${tid}/yol-haritasi`}>{tt('Yol haritasını incele')}</Link>;
  if (tek) {
    const u = tek; const pct = u.management;
    return <div data-testid="yh-giris"><Bolum n={n} ilk={ilk} red={red} kicker={tt('Yol haritası')} soru={tt('Sunumdaki planda neredeyiz?')} not={tt('Sunumdaki eylem planlarında birim yönetimine yazılan adımlar ve takvim. Adımları "Yol haritası" ekranında işaretlersiniz.')} dugmeler={dug}>
      <div className="kv2">
        <div className="etk">{tt('Birim yönetimi adımları')}</div><div className="deg">{pct.total ? <><Kare dolu={pct.done} toplam={pct.total} /><p className="cap">{tt('{0} / {1} tamamlandı', pct.done, pct.total)}{pct.inProgress ? ` · ${tt('{0} devam ediyor', pct.inProgress)}` : ''}</p></> : <p className="cap">{tt('Eylem planı yok')}</p>}</div>
        <div className="etk">{tt('İK adımları')}</div><div className="deg">{u.hr.total ? <><Kare dolu={u.hr.done} toplam={u.hr.total} /><p className="cap">{tt('{0} / {1} tamamlandı', u.hr.done, u.hr.total)}</p></> : <p className="cap">—</p>}</div>
        <div className="etk">{tt('Takvim')}</div><div className="deg">{u.milestones.total ? <><p className={u.milestones.overdue ? 'bold red' : 'bold'}>{u.milestones.overdue ? tt('{0} satırın termini geçti', u.milestones.overdue) : tt('Termini geçen satır yok')}</p><p className="cap">{tt('{0} / {1} tamamlandı', u.milestones.done, u.milestones.total)}{u.milestones.nextDue ? ` · ${tt('Sıradaki termin')}: ${GUN(u.milestones.nextDue)}` : ''}</p></> : <p className="cap">—</p>}</div>
      </div>
    </Bolum></div>;
  }
  return <div data-testid="yh-giris"><Bolum n={n} ilk={ilk} red={red} kicker={tt('Yol haritası')} soru={tt('Birimler sunumdaki planda nerede?')} not={tt('Her satır bir birimin yol haritasıdır: birim yönetimi adımları, termini geçen takvim satırları ve sıradaki termin.')} dugmeler={dug}>
    <Tablo bas={[tt('Birim'), tt('Birim yönetimi adımları'), tt('Takvim'), tt('Sıradaki termin')]} satirlar={d.units.map(u => [<span className="bold">{u.unitLabel}</span>,
      u.management.total ? <><Kare dolu={u.management.done} toplam={u.management.total} /><br /><span className="cap">{tt('{0} / {1} tamamlandı', u.management.done, u.management.total)}</span></> : <span className="cap">{tt('Eylem planı yok')}</span>,
      u.milestones.overdue ? <span className="bold red">{tt('{0} satırın termini geçti', u.milestones.overdue)}</span> : u.milestones.total ? tt('{0} / {1} tamamlandı', u.milestones.done, u.milestones.total) : '—',
      u.milestones.nextDue ? GUN(u.milestones.nextDue) : '—'])} />
  </Bolum></div>;
}
