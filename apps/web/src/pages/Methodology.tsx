import { useState } from 'react';
import { assessComparability } from '@hpw-act/domain-core';
import { Kicker } from '../components/Kicker';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
/** Metodoloji (HPTW Metodolog): madde sürümü eşdeğerliği ve karşılaştırılabilirlik incelemesi. Karar insanın; sistem kapıyı uygular. Tek kırmızı: bekleyen karar sayısı. */
const EQ: Record<string, string> = { identical: 'aynı', equivalent: 'eşdeğer', changed: 'değişti' };
const LEVEL: Record<string, string> = { HIGH: 'Yüksek', MEDIUM: 'Orta', LOW: 'Düşük' };
const STATUS: Record<string, string> = { auto_valid: 'geçerli', review_required: 'inceleme gerekli', not_comparable: 'karşılaştırılamaz' };
const reasonTr = (r: string) => r.startsWith('response_count_change_') ? `yanıt sayısı değişimi ${r.replace('response_count_change_', '').replace('pct', '%').replace('moderate', 'orta düzey')}` : ({ item_equivalent_not_identical: 'madde eşdeğer, aynı değil', response_rate_dropped: 'yanıt oranı düştü', response_rate_dropped_moderate: 'yanıt oranı bir miktar düştü', population_changed_majority: 'çalışanların çoğu değişti', population_changed_significant: 'çalışanlar önemli ölçüde değişti', reorg_in_period: 'dönem içinde organizasyon değişikliği', measurement_interval_abnormal: 'ölçüm aralığı olağan dışı', data_quality_flags: 'veri kalitesi uyarıları', item_materially_changed: 'madde ifadesi değişti', followup_below_confidentiality_threshold: 'yanıt sayısı gizlilik eşiğinin altında' } as Record<string, string>)[r] ?? r;

export default function Methodology() {
  const [eq, setEq] = useState<'identical' | 'equivalent' | 'changed'>('equivalent');
  const [decided, setDecided] = useState(false);
  const [cmpDecision, setCmpDecision] = useState<string | null>(null);
  const cmp = assessComparability({ baselineN: 650, followupN: 41, itemEquivalence: 'identical', lineageEventsInPeriod: 0, measurementIntervalDays: 365, expectedIntervalDays: 365, qualityFlagCount: 0, minN: 5 });
  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>Metodoloji · Atlas Holding · 2026-ANA → 2027-ANA</Kicker></div>
          <div className="col-6">
            <p className="display-xxl num red enter">{2 - (decided ? 1 : 0) - (cmpDecision ? 1 : 0)}</p>
            <h1 className="h2" style={{ marginTop: 'var(--s-2)' }}>metodoloji kararı bekliyor. Kapı otomatik; karar sizin.</h1>
          </div>
          <div className="col-6 stack">
            <Kicker>Madde sürümü · Güven · Q7</Kicker>
            <table className="table"><tbody>
              <tr><td>v2 (2026)</td><td>"Yöneticim verdiği sözü tutar."</td></tr>
              <tr><td>v3 (2027 taslak)</td><td>"Yöneticim söylediğini yapar."</td></tr>
            </tbody></table>
            <Field id="eq" kind="select" label="Öncekiyle eşdeğerlik" value={eq} onChange={e => setEq(e.target.value as typeof eq)}>
              <option value="identical">Aynı — eğilim ve hedef kıyası serbest</option><option value="equivalent">Eşdeğer — kıyas etiketli, karşılaştırılabilirlik −10</option><option value="changed">Değişti — karşılaştırılamaz; 2027'de hedef sonucu yazılmaz</option>
            </Field>
            <div className="row"><Button onClick={() => setDecided(true)} disabled={decided} disabledReason={decided ? `Karar kaydedildi: ${EQ[eq]} · madde sürümü 3` : undefined}>Kararı kaydet</Button></div>
          </div>
        </div>
      </section>
      <section className="section--tight surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>Karşılaştırılabilirlik incelemesi · Çağrı Merkezi 2 · n 650 → 41</Kicker></div>
          <div className="col-6 stack-1">
            <p className="h2">Skor {cmp.score} · {LEVEL[cmp.level]} · {STATUS[cmp.status]}</p>
            <p>{cmp.reasons.map(reasonTr).join(' · ')}</p>
          </div>
          <div className="col-6 stack">
            <div className="row"><Button onClick={() => setCmpDecision('Karşılaştırılabilir (etiketli) · hedef sonucu yazılır, güven Orta')} disabled={!!cmpDecision}>Karşılaştırılabilir say (etiketli)</Button><Button variant="secondary" onClick={() => setCmpDecision('Karşılaştırılamaz · hedef sonucu yazılmaz, etki: yetersiz ölçüm')} disabled={!!cmpDecision}>Karşılaştırılamaz: sonuç yazılmaz</Button></div>
            {cmpDecision ? <p className="caption">Karar kaydedildi: {cmpDecision} · denetim izine yazıldı</p> : null}
          </div>
        </div>
      </section>
    </>
  );
}
