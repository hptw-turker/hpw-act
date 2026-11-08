import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
interface Base { label: string; error?: string; hint?: string; id: string; }
type InputProps = Base & { kind?: 'input' } & InputHTMLAttributes<HTMLInputElement>;
type SelectProps = Base & { kind: 'select'; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>;
/** Etiket alanın üstünde, küçük ve siyah; placeholder yok. Hata: 2 px çerçeve + siyah metin. */
export function Field(props: InputProps | SelectProps) {
  const { label, error, hint, id } = props;
  const errId = error ? `${id}-err` : undefined;
  return (
    <label className={`field ${error ? 'field--error' : ''}`} htmlFor={id}>
      <span className="field__label caption">{label}</span>
      {props.kind === 'select'
        ? (() => { const { label: _l, error: _e, hint: _h, kind: _k, id: _i, children, ...rest } = props; return <span className="select-wrap"><select id={id} className="field__input" aria-describedby={errId} {...rest}>{children}</select></span>; })()
        : (() => { const { label: _l, error: _e, hint: _h, kind: _k, id: _i, ...rest } = props; return <input id={id} className="field__input" aria-invalid={!!error} aria-describedby={errId} {...rest} />; })()}
      {hint ? <span className="field__hint">{hint}</span> : null}
      {error ? <span className="field__error" id={errId}>{error}</span> : null}
    </label>
  );
}
