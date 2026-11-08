import { useState } from 'react';
import { useI18n } from '../i18n';
import { data, runReconciliation, egeContributions, DEFAULT_ITEM } from '../api/mock';
import { ITEM_LABEL } from '../api/items';
import { Kicker } from '../components/Kicker';
import { Score, Delta } from '../components/Score';
/** Scorecard: iki görünüm (baseline organizasyonu / bugünkü). Uygulama ve etki ayrı sütunlar; asla tek yüzde. Tek kırmızı: hedefi tutturmamış birim sayısı. */
export default function Scorecard() {
  const { t, fmt } = useI18n();
  const [view, setView] = useState<'frozen' | 'current'>('frozen');
  const run = runReconciliation(66);
  const rows = egeContributions().map((p, i) => ({ ...p, name: data.egeRegion.branches.find(b => b.id === p.unitId)?.name ?? p.unitId, execution: ['verified', 'partially_verified', 'evidence_pending', 'in_progress', 'delayed'][i % 5]!, impact: 'not_measured', comparability: 'Yüksek' }));
  const atRisk = rows.filter(r => r.execution === 'delayed').length;
  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12 row row--between">
            <Kicker>{t('scorecard.kicker')} · Güven · 2026-ANA → 2027-ANA</Kicker>
            <div className="row caption">
              <button type="button" className="link caption" aria-current={view === 'frozen'} onClick={() => setView('frozen')}>{t('scorecard.frozen')}</button>
              <button type="button" className="link caption" aria-current={view === 'current'} onClick={() => setView('current')}>{t('scorecard.current')}</button>
            </div>
          </div>
          <div className="col-12">
            <p className="display-xxl num red enter">{atRisk}</p>
            <h1 className="h2" style={{ marginTop: 'var(--s-2)' }}>şube gecikmiş. Etki henüz ölçülmedi; 2027 Ana Ölçüm karşılaştırılabilirlik kapısından geçince yazılır.</h1>
          </div>
        </div>
      </section>
      <section className="section--tight surface-white">
        <div className="container table-wrap">
          <table className="table">
            <thead><tr><th>Birim</th><th className="num">Başlangıç</th><th className="num">Hedef</th><th className="num">Fark</th><th>Uygulama</th><th>Etki</th><th>Karşılaştırılabilirlik</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.unitId}><td>{r.name}{view === 'current' && r.unitId === 'SUBE-KONAK' ? ' · İzmir Alan 2 (organizasyon değişikliği 07/2026)' : ''}</td>
                  <td className="num"><Score value={r.baseline} /></td><td className="num bold"><Score value={r.target} /></td><td className="num"><Delta value={r.target - r.baseline} /></td>
                  <td className="caption">{t(`status.${r.execution}`)}</td><td className="caption">Ölçülmedi</td><td className="caption">{r.comparability}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="caption" style={{ marginTop: 'var(--s-2)' }}>Madde {DEFAULT_ITEM} "{ITEM_LABEL(DEFAULT_ITEM)}" · bölge projeksiyonu {fmt(run.supportedProjection)} (herkes önerisini kabul ederse) · resmî ağırlıklar · uzlaştırma sürümü 2.3.1</p>
        </div>
      </section>
    </>
  );
}
