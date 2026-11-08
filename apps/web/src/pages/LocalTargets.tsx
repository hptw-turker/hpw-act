import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useTx } from '../i18n/tx';
import { data } from '../api/mock';
import { targetableItems, DIM_LABEL } from '../api/items';
import { Kicker } from '../components/Kicker';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { proposeLocal, canAddLocalTarget, CENTER_LABEL, type LocalTargetProposal } from '@hpw-act/domain-core';
import { usePersona } from '../state/persona';
import { store, useStore } from '../state/store';

type Mode = 'idle' | 'editing' | 'accepted' | 'declined';
const EXC_REASONS: [string, string][] = [['merger_or_closure', 'Birleşme ya da kapanış bekleniyor'], ['uncontrollable_lever', 'Sorunun kaldıracı kontrolümde değil'], ['unrealistic', 'Süre içinde gerçekçi değil'], ['no_resources', 'Kaynak yok'], ['other', 'Diğer']];
const SOURCE: Record<string, string> = { peer_history: 'benzer şubelerin karşılaştırılabilir gelişimi', methodologist_band: 'HPTW hedef politikası bantları', approved: 'onaylı', exception: 'istisna', fixed_member: 'sabit' };
type Numeric = Extract<LocalTargetProposal, { kind: 'numeric' | 'maintain' }>;


/** Şube müdürü görünümü (v2.3.1): yalnız yerel gelişim hedefleri (≤2); iki sorumluluk etiketi ayrı: "sonucu izleyen rol" ve "müdahaleyi yapmaya yetkili rol".
    Kabul edilen hedef sürümlü kayıt olarak depoya yazılır; Aksiyonlar ve Kanıt aynı kaydı kullanır. Sayı, aralık ve dayanak; katkı ve kardeş şubeler gösterilmez. */
export default function LocalTargets() {
  const { fmt } = useI18n(); const tx = useTx(); const { persona } = usePersona(); const saved = useStore();
  const unit = data.units.find(u => u.id === persona.unitId)!;
  /** Madde düzeyi (v2.4): en fazla iki yerel hedef, en öncelikli hedeflenebilir maddelerden; roller maddenin sorumluluk merkezinden. */
  const items = useMemo(() => {
    const out: { dimension: string; code: string; text: string; center: string; score: number; proposal: Numeric; roles: { monitoringRole: string; interventionOwnerRole: string }; confidence: string; direction: boolean; central: boolean }[] = [];
    for (const p of targetableItems(unit.id)) {
      if (!canAddLocalTarget(out.length).allowed) break;
      const roles = { monitoringRole: p.roles.monitoringRole, interventionOwnerRole: p.roles.interventionOwnerRole };
      const prop = proposeLocal({ unitId: unit.id, relationship: 'local', inclusionState: 'active', aggregationWeight: 1, baseline: p.score!, responseN: p.n, benchmark: p.benchmarkCertified }, roles, undefined, 'Ege Bölge', p.item.code);
      if (prop.kind !== 'numeric' && prop.kind !== 'maintain') continue;
      out.push({ dimension: DIM_LABEL(p.item.dimensionCode), code: p.item.code, text: p.item.text, center: CENTER_LABEL[p.item.responsibilityCenter], score: p.score!, proposal: prop, roles, confidence: p.assessment!.confidenceLabel, direction: p.item.dimensionCode === 'GUV', central: p.roles.controllability < 0.5 });
    }
    return out;
  }, [unit.id]);
  const [state, setState] = useState<Record<string, { mode: Mode; value: number; reason: string; text: string; open: boolean }>>({});
  const st = (d: string, fallback: number) => state[d] ?? { mode: (saved.targets.some(t => t.itemCode === d && t.unitId === unit.id) ? 'accepted' : 'idle') as Mode, value: saved.targets.find(t => t.itemCode === d && t.unitId === unit.id)?.target ?? fallback, reason: 'uncontrollable_lever', text: '', open: false };
  const set = (d: string, patch: Partial<{ mode: Mode; value: number; reason: string; text: string; open: boolean }>, fallback: number) => setState(x => ({ ...x, [d]: { ...st(d, fallback), ...patch } }));
  const accept = (it: typeof items[number], value: number) => {
    store.acceptTarget({ id: `lt-${unit.id}-${it.code}`, unitId: unit.id, dimension: it.dimension, itemCode: it.code, itemText: it.text, baseline: it.score, target: value, low: it.proposal.low, high: it.proposal.high, monitoringRole: it.roles.monitoringRole, interventionOwnerRole: it.roles.interventionOwnerRole });
    set(it.code, { mode: 'accepted', value }, it.proposal.target);
  };
  const CONF: Record<string, string> = { LOW: 'Düşük', MEDIUM: 'Orta', HIGH: 'Yüksek' };
  const first = items[0];

  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>{tx('Yerel gelişim hedefleriniz')} · {unit.name} · {tx('madde düzeyinde')} · {tx('şirket genelindeki yön')}: {tx('Güven')} · {tx('sonucu izleyen rol')}: {unit.name} {tx('Müdürü')}</Kicker></div>
          <div className="col-6">
            {first ? <>
              <p className="display-xxl num red enter">{fmt(st(first.code, first.proposal.target).value)}</p>
              <h1 className="h2" style={{ marginTop: 'var(--s-2)' }}>"{first.text}" ({tx(first.dimension)} · {first.code}) {tx('şubenizde öncelikli gelişim maddesi.')} {tx('Mevcut durum')} {fmt(first.score)}, {tx('makul gelişim aralığı')} {fmt(first.proposal.low)}–{fmt(first.proposal.high)}, {tx('önerimiz')} {fmt(first.proposal.target)}.</h1>
            </> : <h1 className="h2">{tx('Şubenizde bu dönem sayısal hedef gerektiren bir madde yok; izleme sürüyor.')}</h1>}
          </div>
          <div className="col-6 stack">
            <Kicker>{tx('Neden bu sayı?')}</Kicker>
            <p className="body-l measure">{tx('Benzer başlangıç düzeyindeki karşılaştırılabilir şubelerin ulaşabildiği gelişim ve HPTW hedef politikası dikkate alındı. Bu sizin şubenizin kendi yolu; başka birinin size verdiği bir sayı değil. Diğer şubelerin skorları ve şirket hedefinin sayısı size gösterilmez.')}</p>
            <p className="caption">{tx('Hedef boyuta değil maddeye konur: aynı boyutun iki maddesi farklı sorumluluk merkezine gider. En fazla iki aktif yerel hedef ve üç aktif aksiyon; hedefler çalışana inmez. Kabul edilen hedef sürümlü bir kayıttır; Aksiyonlar ve Kanıt ekranları aynı kaydı kullanır.')}</p>
          </div>
        </div>
      </section>
      <section className="section--tight surface-white">
        <div className="container rows">
          {items.map(it => { const s = st(it.code, it.proposal.target); return (
            <article key={it.dimension} className="rowline">
              <div className="stack-1">
                <Kicker>{tx(it.dimension)} · {it.code} · {tx('sorumluluk merkezi')}: {tx(it.center)} · {tx('mevcut')} {fmt(it.score)} · {tx('aralık')} {fmt(it.proposal.low)}–{fmt(it.proposal.high)} · {tx('veri güveni')}: {tx(CONF[it.confidence] ?? it.confidence)} · {tx('dayanak')}: {tx(SOURCE[it.proposal.source] ?? it.proposal.source)}{it.direction ? ` · ${tx('şirket genelindeki yönle aynı')}` : ` · ${tx('yalnız sizin şubenizin önceliği')}`}</Kicker>
                <h2 className="body-l bold">"{it.text}" · {tx(it.proposal.kind === 'maintain' ? 'Koru' : 'Yerel hedef')}: {fmt(it.score)} → {fmt(s.value)}</h2>
                <p className="caption">{tx('Sonucu izleyen rol')}: {it.roles.monitoringRole} · {tx('müdahaleyi yapmaya yetkili rol')}: {it.roles.interventionOwnerRole}{it.central ? ` · ${tx('kaldıraç merkezde; şubeden beklenen izleme ve yerel uygulama, merkezi çözümün kendisi değil')}` : ''}</p>
                {s.mode === 'editing' ? (
                  <div className="row">
                    <div style={{ width: '12ch' }}><Field id={`lt-${it.dimension}`} type="number" label={tx('Hedef')} value={s.value} step={0.5} onChange={e => set(it.code, { value: Number(e.target.value) }, it.proposal.target)} /></div>
                    <Button onClick={() => accept(it, s.value)} disabled={s.value < it.proposal.low || s.value > it.proposal.high} disabledReason={s.value < it.proposal.low || s.value > it.proposal.high ? `${tx('Aralık')} ${fmt(it.proposal.low)}–${fmt(it.proposal.high)}; ${tx('dışı için "Uygun değil"')}` : undefined}>{tx('Kaydet ve kabul et')}</Button>
                    <Button variant="secondary" onClick={() => set(it.code, { mode: 'idle', value: it.proposal.target }, it.proposal.target)}>{tx('Vazgeç')}</Button>
                  </div>
                ) : null}
                {s.open && s.mode === 'idle' ? (
                  <div className="notice stack">
                    <Kicker>{tx('Uygun değil · istisna talebi')}</Kicker>
                    <div className="row">
                      <div style={{ minWidth: '30ch' }}><Field id={`exr-${it.dimension}`} kind="select" label={tx('Neden')} value={s.reason} onChange={e => set(it.code, { reason: e.target.value }, it.proposal.target)}>{EXC_REASONS.map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</Field></div>
                      <div style={{ flex: 1, minWidth: '30ch' }}><Field id={`ext-${it.dimension}`} type="text" label={tx('Gerekçe (bir cümle)')} value={s.text} onChange={e => set(it.code, { text: e.target.value }, it.proposal.target)} /></div>
                    </div>
                    <div className="row"><Button onClick={() => set(it.code, { mode: 'declined', open: false }, it.proposal.target)} disabled={s.text.trim().length < 5} disabledReason={s.text.trim().length < 5 ? tx('Gerekçe zorunlu') : undefined}>{tx('Talebi gönder')}</Button><Button variant="secondary" onClick={() => set(it.code, { open: false }, it.proposal.target)}>{tx('Vazgeç')}</Button></div>
                  </div>
                ) : null}
                {s.mode === 'accepted' ? <p className="caption">{tx('Kabul edildi')}: {fmt(s.value)} · {tx('kayıt')} lt-{unit.id}-{it.code} · {tx('sürüm')} 1 · <Link className="link" to="/aksiyonlar">{tx('Aksiyonlar ekranında bu hedefe bağlı üç öneri hazır')}</Link></p> : null}
                {s.mode === 'declined' ? <p className="caption">{tx('İstisna talebi gönderildi')}: {tx(EXC_REASONS.find(r => r[0] === s.reason)?.[1] ?? '')} · {tx('talep eden onaylayamaz; karar bölge direktöründe')}</p> : null}
              </div>
              {s.mode === 'idle' && !s.open ? (
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <Button onClick={() => accept(it, it.proposal.target)}>{tx('Kabul et')}</Button>
                  <Button variant="secondary" onClick={() => set(it.code, { mode: 'editing' }, it.proposal.target)}>{tx('Değiştir')}</Button>
                  <Button variant="secondary" onClick={() => set(it.code, { open: true }, it.proposal.target)}>{tx('Uygun değil')}</Button>
                </div>
              ) : null}
            </article>); })}
        </div>
      </section>
      <section className="section surface-ink">
        <div className="container grid">
          <div className="col-12"><Kicker>{tx('Kural')}</Kicker></div>
          <div className="col-8"><p className="h2">{tx('Şirketin istediği sayı sizin hedefiniz değildir. Sizin hedefiniz şubenizin verisinden çıkar; şirket yalnız')} <span className="red">{tx('yönü')}</span> {tx('söyler. Hedef çalışana inmez, sahibi şube müdürlüğü rolüdür.')}</p></div>
        </div>
      </section>
      <section className="section--tight surface-white"><div className="container"><p className="caption">{tx('Değiştir: aralık içinde kendi sayınızı yazarsınız. Uygun değil: gerekçenizle bölge direktörüne gider; talep eden onaylayamaz. Merkezi kaldıraçta (vardiya) çözümün hesap vereni Operasyon Planlama\'dır; şubeden beklenen izleme ve yerel uygulamadır.')}</p></div></section>
    </>
  );
}
