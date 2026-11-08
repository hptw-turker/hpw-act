import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useTx } from '../i18n/tx';
import { data, egeBaseline, runReconciliation, approveTarget, targetVersion, simulateConcurrentEdit, buildEgeCohort, egeContributions, egeItemOptions, DEFAULT_ITEM } from '../api/mock';
import { ConflictError, type Conflict } from '../api/envelope';
import { Kicker } from '../components/Kicker';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Score, Delta } from '../components/Score';
import { ConflictNotice } from '../components/ConflictNotice';
import { rollupProjected, type TargetReconciliationRun } from '@hpw-act/domain-core';

const OPTION: Record<string, string> = { LOWER_AMBITION: 'İstenen değeri projeksiyona çek', ACCEPT_STRETCH_WITHIN_BOUNDS: 'Esnetmeyi bilerek kabul et (tavanlar içinde)', ADD_CENTRAL_INTERVENTION: 'Merkezi müdahale ekle (kurumsal aksiyon)', CHANGE_TIME_HORIZON: 'Süreyi uzat' };
const REASON: Record<string, string> = { no_baseline: 'başlangıç skoru yok', contribution: 'katkı', support: 'destek', zero_weight: 'sıfır ağırlık' };
const SOURCE: Record<string, string> = { peer_history: 'akran geçmişi', methodologist_band: 'metodolog bandı', approved: 'onaylı', exception: 'istisna', fixed_member: 'sabit' };
const KIND: Record<string, string> = { numeric: 'sayısal', maintain: 'koru' };
const EXC_REASONS: [string, string][] = [['merger_or_closure', 'Birleşme ya da kapanış bekleniyor'], ['uncontrollable_lever', 'Sorunun kaldıracı kontrolümde değil'], ['unrealistic', 'Süre içinde gerçekçi değil'], ['no_resources', 'Kaynak yok'], ['other', 'Diğer']];

/** Bölge/iş kolu uzlaştırması (v2.3.1): yerel öneriler bağımsız; "istenen değer" projeksiyon ve üst senaryoyla karşılaştırılır; fark dağıtılmaz.
    Hangi projeksiyonun gösterildiği açıkça yazılır: "herkes önerisini kabul ederse" ≠ "kabul edilmiş plan". Gizli birimler aritmetiğe girer, sayısı çıkmaz. */
export default function Targets() {
  const { t, fmt, fmtDate } = useI18n(); const tx = useTx();
  const itemOptions = useMemo(() => egeItemOptions(), []);
  const [itemCode, setItemCode] = useState(DEFAULT_ITEM);
  const itemDef = itemOptions.find(o => o.code === itemCode)!;
  const baseline = useMemo(() => egeBaseline(itemCode), [itemCode]);
  const cohort = useMemo(() => buildEgeCohort(itemCode), [itemCode]);
  const supported = useMemo(() => runReconciliation(baseline, itemCode).supportedProjection, [baseline, itemCode]);
  const contributions = useMemo(() => egeContributions(itemCode), [itemCode]);
  const [ambition, setAmbition] = useState(supported);
  const [targetDate, setTargetDate] = useState('2027-06-30');
  const [run, setRun] = useState<TargetReconciliationRun | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [approved, setApproved] = useState<number | null>(null);
  const [version, setVersion] = useState(targetVersion());
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [decision, setDecision] = useState<string | null>(null);
  const [exception, setException] = useState<{ open: boolean; sent: boolean; reason: string; value: number; text: string }>({ open: false, sent: false, reason: 'uncontrollable_lever', value: 0, text: '' });
  const rows = contributions; // yalnız görünür (gizli olmayan) birimler; tam hassasiyet, gösterimde yuvarlanır
  const konak = rows.find(p => p.unitId === 'SUBE-KONAK');
  const targetOf = (unitId: string, fallback: number) => edits[unitId] ?? fallback;
  const projected = run ? rollupProjected(cohort, Object.fromEntries(rows.map(p => [p.unitId, targetOf(p.unitId, p.target)]))) : 0;
  const nameOf = (id: string) => data.egeRegion.branches.find(b => b.id === id)?.name ?? id;

  const compute = () => { setRun(runReconciliation(ambition, itemCode)); setApproved(null); setConflict(null); setEdits({}); setEditing(false); setDecision(null); setException(x => ({ ...x, open: false })); };
  const applyStretch = () => { if (!run?.stretchAdjustments) return; setEdits(Object.fromEntries(run.stretchAdjustments.map(a => [a.unitId, a.to]))); setDecision('ACCEPT_STRETCH_WITHIN_BOUNDS'); };
  const lowerAmbition = () => { if (!run) return; setAmbition(run.supportedProjection); setEdits({}); setDecision('LOWER_AMBITION'); };
  const setExceptionOpen = (open: boolean) => setException(x => ({ ...x, open, value: x.value || (konak ? Math.max(konak.low, konak.target - 2) : 0) }));
  const saveEdits = () => {
    for (const p of rows) { const v = targetOf(p.unitId, p.target); if (v < p.low || v > p.high) { setEditError(`${nameOf(p.unitId)}: ${fmt(v)} aralık dışında (${fmt(p.low)}–${fmt(p.high)}). Aralık dışı değer için 'Uygun değil' yolunu kullanın.`); return; } }
    setEditError(null); setEditing(false);
  };
  const approve = async () => {
    try { const r = await approveTarget('EGE', projected, version); setVersion(r.version); setApproved(projected); setConflict(null); }
    catch (e) { if (e instanceof ConflictError) setConflict(e.conflict); else throw e; }
  };
  const gapOpen = run && run.status === 'GAP' && !decision;
  const label = run ? (run.status === 'SUPPORTED' ? tx('Destekleniyor') : run.status === 'GAP' ? tx('Fark var · karar gerekli') : tx('Mevcut planla desteklenmiyor')) : '';

  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>{t('target.kicker')} · {data.egeRegion.name} · {tx('madde düzeyinde')} · {tx('birim kümesi donduruldu')} 22.09.2026 · {tx('başlangıç organizasyonu esas')} · {tx('resmî toplama ağırlığı')}</Kicker></div>
          <div className="col-6 stack-4">
            <h1 className="h1">{`${data.egeRegion.name.replace(' Direktörlüğü', '')}: ${tx('yerel öneriler')} ${fmt(supported)}, ${tx('istenen')} ${fmt(ambition, ambition % 1 ? 1 : 0)}.`}</h1>
            <p className="body-l measure">"{itemDef.text}" ({itemDef.code} · {tx(itemDef.dimension)}). {`${data.egeRegion.branches.length} ${tx('şube')}. ${tx('Hedef maddeye konur, boyuta değil. Her şubenin hedefi kendi verisinden üretilir (akran geçmişi ya da metodolog bandı); istenen değer bunların resmî ağırlıklı projeksiyonuyla karşılaştırılır. Fark varsa dağıtılmaz, karar sizindir.')}`}</p>
            <div className="stack">
              <Kicker>{tx('İstenen değer gir')}</Kicker>
              <div className="row">
                <div style={{ minWidth: '34ch', maxWidth: '48ch' }}><Field id="dimension" kind="select" label={tx('Madde')} value={itemCode} onChange={e => { const c = e.target.value; setItemCode(c); setRun(null); setAmbition(runReconciliation(egeBaseline(c), c).supportedProjection); }}>
                  {itemOptions.map(o => <option key={o.code} value={o.code}>{o.code} · {o.text} ({tx(o.dimension)})</option>)}
                </Field></div>
                <div style={{ minWidth: '22ch' }}><Field id="unit" kind="select" label={tx('Birim')} defaultValue="ege"><option value="ege">{data.egeRegion.name}</option></Field></div>
                <div style={{ width: '12ch' }}><Field id="parent" type="number" label={tx('İstenen değer')} value={ambition} min={40} max={95} step={0.5} onChange={e => setAmbition(Number(e.target.value))} /></div>
                <div style={{ width: '18ch' }}><Field id="date" type="date" label={tx('Hedef tarihi')} value={targetDate} onChange={e => setTargetDate(e.target.value)} /></div>
                <Button onClick={compute}>{tx('Uzlaştır')}</Button>
              </div>
              <p className="caption">{tx('Projeksiyon (herkes önerisini kabul ederse)')}: {fmt(supported)} ({tx('başlangıç')} {fmt(baseline)}) · {tx('tarih')} {fmtDate(targetDate)}</p>
            </div>
          </div>
          <div className="col-6">
            {run ? (
              <div className="stack">
                <p className="caption">{label} · {tx('uzlaştırma sürümü')} 2.3.1 · {tx('kural seti')} 2.3.1</p>
                <p className="display-xl num red enter nowrap">{fmt(run.status === 'UNSUPPORTED' ? run.upperScenario : projected)}</p>
                <p className="body-l">{run.status === 'SUPPORTED' ? `${tx('Bölge projeksiyonu (düzenlenmiş önerilerle)')}. ${tx('İstenen')} ${fmt(ambition, ambition % 1 ? 1 : 0)} ${tx('yerel önerilerle destekleniyor.')}` : run.status === 'GAP' ? `${tx('Yerel öneriler')} ${fmt(run.supportedProjection)}, ${tx('istenen')} ${fmt(ambition, ambition % 1 ? 1 : 0)}, ${tx('fark')} ${fmt(run.gap)}. ${tx('Mevcut politika altındaki üst senaryo')} ${fmt(run.upperScenario)}.` : `${tx('Mevcut politika ve kaynak varsayımlarıyla desteklenmiyor; üst senaryo')} ${fmt(run.upperScenario)}. ${tx('Bu bir imkânsızlık kanıtı değil, mevcut planın sınırıdır.')}`}</p>
                {run.hiddenParticipants.length ? <p className="caption">{run.hiddenParticipants.length} {tx('gizli birim aritmetiğe girdi; sayıları hiçbir yerde gösterilmez.')}</p> : null}
                {run.status !== 'SUPPORTED' ? (
                  <div className="stack-1">
                    <Kicker>{tx('Seçenekler')}</Kicker>
                    <div className="row">
                      {run.options.map(o => <Button key={o} variant="secondary" disabled={!!decision} onClick={() => o === 'ACCEPT_STRETCH_WITHIN_BOUNDS' ? applyStretch() : o === 'LOWER_AMBITION' ? lowerAmbition() : setDecision(o)}>{tx(OPTION[o] ?? o)}</Button>)}
                    </div>
                    {decision ? <p className="caption">{tx('Karar')}: {tx(OPTION[decision] ?? decision)} · {tx('uzlaştırma kaydına yazıldı')}</p> : null}
                  </div>
                ) : null}
              </div>
            ) : <p className="body-l">{tx('Boyutu, birimi ve istenen değeri girip "Uzlaştır"a basın; her şubenin kendi önerisi, projeksiyon, üst senaryo ve fark burada görünür.')}</p>}
          </div>
        </div>
      </section>

      {run && konak ? (
        <section className="section surface-ink">
          <div className="container grid">
            <div className="col-12"><Kicker>{t('target.why', { v: fmt(targetOf('SUBE-KONAK', konak.target)) })}</Kicker></div>
            <div className="col-8">
              <p className="h2">{tx('Konak')} {fmt(konak.baseline)}'{tx('dan başlıyor; bandı')} {fmt(konak.low)}–{fmt(konak.high)} ({tx('kaynak')}: {tx(SOURCE[konak.source] ?? konak.source)}). {tx('Bölgenin yerel önerilerle projeksiyonu')} {fmt(run.supportedProjection)}; {tx('Konak\'ın katkı projeksiyonu')} <span className="red">{fmt(konak.contribution, 2)}</span> {tx('puan (projeksiyon; hedef değil; şubeye gösterilmez). Bu madde için müdahaleye yetkili rol')}: {run.localProposals.find(p => p.unitId === 'SUBE-KONAK')?.interventionOwnerRole ?? '—'}.</p>
            </div>
          </div>
        </section>
      ) : null}

      {run ? (
        <section className="section surface-white">
          <div className="container stack-4">
            {conflict ? <ConflictNotice conflict={conflict} onReload={() => { setVersion(targetVersion()); setConflict(null); }} /> : null}
            <div className="row row--between">
              <div className="row">
                <Button onClick={approve} disabled={approved !== null || editing || exception.open || !!gapOpen || run.status === 'UNSUPPORTED'} disabledReason={approved !== null ? `${tx('Onaylandı')}: ${fmt(approved)} · ${tx('sürüm')} ${version}` : editing ? tx('Önce düzenlemeyi kaydedin') : gapOpen ? tx('Önce fark için karar verin') : run.status === 'UNSUPPORTED' ? tx('Desteklenmiyor; önce istenen değeri düşürün ya da merkezi müdahale ekleyin') : undefined}>{t('target.approve')}</Button>
                {editing
                  ? <><Button onClick={saveEdits}>{tx('Kaydet')}</Button><Button variant="secondary" onClick={() => { setEdits({}); setEditing(false); setEditError(null); }}>{tx('Vazgeç')}</Button></>
                  : <Button variant="secondary" onClick={() => setEditing(true)} disabled={approved !== null || run.status === 'UNSUPPORTED'}>{t('target.change')}</Button>}
                <Button variant="secondary" onClick={() => setExceptionOpen(!exception.open)} disabled={approved !== null || exception.sent} disabledReason={exception.sent ? tx('İstisna talebi gönderildi; bölge direktörü karar verir') : undefined}>{t('target.exception')}</Button>
              </div>
              <button type="button" className="link caption" onClick={simulateConcurrentEdit}>{tx('Eşzamanlı düzenlemeyi dene')}</button>
            </div>
            {editError ? <p className="bold">{editError}</p> : null}
            {editing ? <p className="caption">{tx('Öneri sütunundaki değerleri aralık içinde değiştirin; projeksiyon anında güncellenir.')}</p> : null}
            {exception.open && !exception.sent ? (
              <div className="notice stack">
                <Kicker>{tx('Uygun değil · istisna talebi')} · {tx('Konak Şubesi')}</Kicker>
                <div className="row">
                  <div style={{ minWidth: '30ch' }}><Field id="exc-reason" kind="select" label={tx('Neden')} value={exception.reason} onChange={e => setException(x => ({ ...x, reason: e.target.value }))}>{EXC_REASONS.map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</Field></div>
                  <div style={{ width: '14ch' }}><Field id="exc-value" type="number" label={tx('Önerdiğim hedef')} value={exception.value} step={0.5} onChange={e => setException(x => ({ ...x, value: Number(e.target.value) }))} /></div>
                  <div style={{ flex: 1, minWidth: '30ch' }}><Field id="exc-text" type="text" label={tx('Gerekçe (bir cümle)')} value={exception.text} onChange={e => setException(x => ({ ...x, text: e.target.value }))} /></div>
                </div>
                <div className="row"><Button onClick={() => setException(x => ({ ...x, sent: true, open: false }))} disabled={exception.text.trim().length < 5} disabledReason={exception.text.trim().length < 5 ? tx('Gerekçe zorunlu') : undefined}>{tx('Talebi gönder')}</Button><Button variant="secondary" onClick={() => setExceptionOpen(false)}>{tx('Vazgeç')}</Button></div>
              </div>
            ) : null}
            {exception.sent ? <p className="caption">{tx('İstisna talebi gönderildi')}: {tx(EXC_REASONS.find(r => r[0] === exception.reason)?.[1] ?? '')} · {tx('önerilen')} {fmt(exception.value)} · {tx('talep eden onaylayamaz; karar bölge direktöründe')}</p> : null}
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{t('target.unit')}</th><th>{tx('Tür')}</th><th className="num">{t('target.baseline')}</th><th className="num">{t('target.range')}</th><th className="num">{t('target.proposal')}</th><th className="num">{tx('Fark')}</th><th>{tx('Kaynak')}</th><th className="num">{tx('Ağırlık')}</th><th className="num">{tx('Katkı projeksiyonu')}</th></tr></thead>
                <tbody>
                  {rows.map(p => { const v = targetOf(p.unitId, p.target); return (
                    <tr key={p.unitId}><td className={p.unitId === 'SUBE-KONAK' ? 'bold' : ''}>{nameOf(p.unitId)}{p.fixed ? ` (${tx('sabit')})` : ''}</td><td className="caption">{tx(KIND[p.kind] ?? p.kind)}</td>
                      <td className="num"><Score value={p.baseline} /></td><td className="num">{fmt(p.low)}–{fmt(p.high)}</td>
                      <td className="num bold">{editing && !p.fixed ? <input className="field__input num" style={{ width: '9ch', display: 'inline-block', textAlign: 'right' }} type="number" step={0.5} value={v} aria-label={nameOf(p.unitId)} onChange={e => setEdits(x => ({ ...x, [p.unitId]: Number(e.target.value) }))} /> : <Score value={v} />}</td>
                      <td className="num"><Delta value={v - p.baseline} /></td><td className="caption">{tx(SOURCE[p.source] ?? p.source)}</td>
                      <td className="num">{p.weight}</td><td className="num">{fmt(p.contribution, 2)}</td></tr>); })}
                  {run.nonArithmetic.map(n => <tr key={n.unitId}><td>{nameOf(n.unitId)}</td><td className="caption">{tx(REASON[n.reason] ?? n.reason)}</td><td className="num">—</td><td className="num">—</td><td className="num">—</td><td className="num">—</td><td>—</td><td className="num">—</td><td className="num">—</td></tr>)}
                  {run.hiddenParticipants.map(id => <tr key={id}><td>{nameOf(id)}</td><td className="caption">{tx('gizli')}</td><td className="num">—</td><td className="num">—</td><td className="num">—</td><td className="num">—</td><td className="caption">{tx('üst birim önceliği')}</td><td className="num">—</td><td className="num">—</td></tr>)}
                </tbody>
              </table>
            </div>
            <p className="caption">{tx('Hedef üç yerde girilir: kurumsal istenen değeri Genel Müdür Kurumsal ekranında onaylar; bölge direktörü ya da İK iş ortağı burada istenen değeri girer, yerel önerilerle uzlaştırır ve onaylar; şube müdürü kendi yerel hedefini kabul eder ya da "uygun değil" der.')}</p>
          </div>
        </section>
      ) : null}
    </>
  );
}
