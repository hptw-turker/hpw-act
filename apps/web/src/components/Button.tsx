import type { ButtonHTMLAttributes, ReactNode } from 'react';
type Variant = 'primary' | 'secondary' | 'red';
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; children: ReactNode; disabledReason?: string; }
/** Keskin köşe, gölgesiz. `red` yalnız bölümün tek kırmızısıysa kullanılır. Disabled: soluklaştırma yok, açıklayıcı etiket. */
export function Button({ variant = 'primary', children, disabledReason, disabled, className = '', ...rest }: Props) {
  const cls = `btn ${variant === 'secondary' ? 'btn--secondary' : variant === 'red' ? 'btn--red' : ''} ${className}`;
  return (
    <span className="stack-1 btn-wrap" style={{ display: 'inline-block' }}>
      <button type="button" className={cls} disabled={disabled} aria-disabled={disabled} {...rest}>{children}</button>
      {disabled && disabledReason ? <span className="caption btn-reason" style={{ display: 'block' }}>{disabledReason}</span> : null}
    </span>
  );
}
