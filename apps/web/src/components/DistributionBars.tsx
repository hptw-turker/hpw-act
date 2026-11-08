import { useI18n } from '../i18n';
import { StatusLabel } from './StatusLabel';
/** Ana aksiyon dağılımı: siyah çubuklar, sayı ve durum kelimesi. Tek kırmızı: çağıranın seçtiği tek satır. */
export function DistributionBars({ distribution, total, highlight }: { distribution: Record<string, number>; total: number; highlight?: string }) {
  const { fmt } = useI18n();
  const order = ['verified', 'partially_verified', 'evidence_pending', 'in_progress', 'delayed', 'not_started', 'cancelled'];
  return (
    <div className="rows">
      {order.filter(k => k in distribution).map(k => {
        const v = distribution[k]!; const pct = (v / total) * 100; const isRed = highlight === k;
        return (
          <div key={k} className="rowline">
            <div className="stack-1">
              <StatusLabel status={k} red={isRed} />
              <div className={`bar ${isRed ? 'bar--red' : ''}`} aria-hidden="true"><div className="bar__track"><div className="bar__fill" style={{ width: `${pct}%` }} /></div></div>
            </div>
            <div className={`num right ${isRed ? 'red bold' : ''}`}>{v} <span className="caption">%{fmt(pct, 0)}</span></div>
          </div>
        );
      })}
    </div>
  );
}
