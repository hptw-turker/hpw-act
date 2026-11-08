import { useI18n } from '../i18n';
/** Skor ya sayı ya da uzun tire. Baskılanmış değer istemciye zaten gelmez (null); burada yalnız gösterim. */
export function Score({ value, suppressed, digits = 1, className = '' }: { value: number | null; suppressed?: boolean; digits?: number; className?: string }) {
  const { fmt, t } = useI18n();
  if (suppressed || value === null) return <span className={`num ${className}`} aria-label={t('results.suppressed')}>—</span>;
  return <span className={`num ${className}`}>{fmt(value, digits)}</span>;
}
export function Delta({ value, digits = 1 }: { value: number; digits?: number }) {
  const { fmt } = useI18n();
  return <span className="num">{value > 0 ? '+' : value < 0 ? '−' : '±'}{fmt(Math.abs(value), digits)}</span>;
}
