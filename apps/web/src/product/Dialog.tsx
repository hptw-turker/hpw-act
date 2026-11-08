/** v2.10.0 erişilebilir onay penceresi (MP16): açılışta odağı ilk alana taşır, Tab/Shift+Tab odağı pencere içinde tutar, Escape ve görünür “Vazgeç” ile kapanır,
 * kapanışta odağı pencereyi açan öğeye geri verir; başlık ve açıklama aria-labelledby/aria-describedby ile duyurulur; gönderim sürerken ikinci gönderim engellenir;
 * bağlam (şirket/yetki) değiştiyse (stale) gönderim yapılmaz ve açıklama çıkar. Seçim alanı (ör. süre, dönem) ve gerekçe alanı isteğe bağlıdır.
 * v2.10.1 (V210-05, W3C APG dialog-modal): pencere belge köküne taşınır (portal) ve açıkken uygulama kökü `inert` olur — arka plan fare, klavye ve yardımcı
 * teknolojiye kapanır. Gönderim sürerken alanlar devre dışı bırakılmaz (salt okunur + aria-disabled): odak hedefi pencerede kalır, Tab/Shift+Tab döngüsü sürer. */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { tt } from './i18n';
export type DialogProps = {
  open: boolean; title: string; description?: ReactNode; confirmLabel: string; danger?: boolean;
  reason?: { label: string; minLength: number } | null; select?: { label: string; options: [string, string][]; initial?: string } | null;
  date?: { label: string; min: string; max: string; initial?: string } | null; // v2.11.0: tarih alanı (erteleme/reddetme süresi); değer YYYY-AA-GG
  requireAck?: string | null;
  // v2.11.3 (V2111-R1-A/B): sonucu belirsiz, daha önce onaylanmış komutun aynen yeniden gönderimi — tarih aralığı yeni komutlar içindir; bu dönüş true ise aralık denetimi atlanır
  dateBypass?: (date: string, reason: string) => boolean; reasonInitial?: string; notice?: string | null; // v2.11.1 (V211-04): kayıt değiştiğinde kullanıcı güncel kaydı incelediğini işaretlemeden gönderim yapılmaz; taslak korunur
  stale?: string | null; error?: string | null;
  onConfirm: (v: { reason: string; choice: string; date: string }) => Promise<void> | void; onCancel: () => void;
};
export function ConfirmDialog(p: DialogProps) {
  const id = useId(); const box = useRef<HTMLDivElement>(null); const opener = useRef<Element | null>(null);
  // v2.11.5: alanlar ilk çizimde doğrudan başlangıç değerleriyle kurulur (kapatılıp yeniden açılan pencerede önceki taslak bir an bile görünmez; çağıran her açılışta yeniden bağlar)
  const [reason, setReason] = useState(() => p.reasonInitial ?? ''); const [choice, setChoice] = useState(''); const [date, setDate] = useState(() => p.date?.initial ?? ''); const [ackd, setAckd] = useState(false);
  useEffect(() => { setAckd(false); }, [p.requireAck]); const [busy, setBusy] = useState(false); const [fieldErr, setFieldErr] = useState<string | null>(null);
  useEffect(() => {
    if (!p.open) return;
    opener.current = document.activeElement; setReason(p.reasonInitial ?? ''); setDate(p.date?.initial ?? ''); setChoice(p.select?.initial ?? p.select?.options[0]?.[0] ?? ''); setFieldErr(null); setBusy(false);
    const t = setTimeout(() => { const first = box.current?.querySelector<HTMLElement>('input[type=date], textarea, select, button[data-confirm]'); first?.focus(); }, 0);
    return () => { clearTimeout(t); const o = opener.current as HTMLElement | null; if (o && document.contains(o)) setTimeout(() => o.focus(), 0); };
  }, [p.open]);
  useEffect(() => { if (!p.open) return; const root = document.getElementById('root'); if (!root) return; const prev = root.inert; root.inert = true; root.setAttribute('aria-hidden', 'true'); return () => { root.inert = prev; root.removeAttribute('aria-hidden'); }; }, [p.open]);
  if (!p.open) return null;
  const focusables = () => Array.from(box.current?.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]') ?? []);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); if (!busy) p.onCancel(); return; }
    if (e.key !== 'Tab') return; const f = focusables(); if (!f.length) return; const first = f[0]!, last = f[f.length - 1]!;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const submit = async () => {
    if (busy || p.stale || (p.requireAck && !ackd)) return; // gönderim sürerken ikinci gönderim yok (düğme odaklanabilir kalır, aria-disabled)
    if (p.date && !(p.dateBypass && p.dateBypass(date, reason.trim())) && (!date || date < p.date.min || date > p.date.max)) { setFieldErr(tt('Tarih {0} ile {1} arasında olmalıdır', p.date.min, p.date.max)); box.current?.querySelector<HTMLElement>('input[type=date]')?.focus(); return; }
    if (p.reason && reason.trim().length < p.reason.minLength) { setFieldErr(tt('Gerekçe en az {0} karakter olmalıdır', p.reason.minLength)); box.current?.querySelector<HTMLElement>('textarea')?.focus(); return; }
    setFieldErr(null); setBusy(true); try { await p.onConfirm({ reason: reason.trim(), choice, date }); } finally { setBusy(false); }
  };
  return createPortal(<div className="dialog-layer">
    <div className="dialog-backdrop" aria-hidden="true" />
    <div ref={box} className="dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={p.description ? `${id}-d` : undefined} onKeyDown={onKey}>
      <h2 className="h3" id={`${id}-t`}>{p.title}</h2>
      {p.description ? <div className="body-l" id={`${id}-d`}>{p.description}</div> : null}
      {p.select ? <label className="field" htmlFor={`${id}-s`}><span className="field__label caption">{p.select.label}</span><select id={`${id}-s`} className="field__input" value={choice} onChange={e => setChoice(e.target.value)} aria-disabled={busy} onMouseDown={e => { if (busy) e.preventDefault(); }}>{p.select.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label> : null}
      {p.date ? <label className="field" htmlFor={`${id}-dt`}><span className="field__label caption">{p.date.label}</span><input id={`${id}-dt`} type="date" className="field__input" min={p.date.min} max={p.date.max} value={date} onChange={e => setDate(e.target.value)} readOnly={busy} aria-invalid={!!fieldErr && !date} /></label> : null}
      {p.reason ? <label className="field" htmlFor={`${id}-r`}><span className="field__label caption">{p.reason.label}</span><textarea id={`${id}-r`} className="field__input" rows={3} value={reason} onChange={e => setReason(e.target.value)} aria-invalid={!!fieldErr} aria-describedby={fieldErr ? `${id}-e` : undefined} readOnly={busy} aria-readonly={busy} /></label> : null}
      {fieldErr ? <p className="bold" id={`${id}-e`} role="alert">{fieldErr}</p> : null}
      {p.notice ? <p className="bold" role="status">{p.notice}</p> : null}
      {p.requireAck ? <label className="row" htmlFor={`${id}-ack`} style={{ gap: 12, alignItems: 'center' }}><input id={`${id}-ack`} type="checkbox" checked={ackd} onChange={e => setAckd(e.target.checked)} disabled={busy} /><span className="body-l">{p.requireAck}</span></label> : null}
      {p.stale ? <p className="bold" role="alert">{p.stale}</p> : null}
      {p.error ? <p className="bold" role="alert">{p.error}</p> : null}
      {busy ? <p className="caption" role="status">{tt('Gönderiliyor…')}</p> : null}
      <div className="dialog-actions"><button type="button" className="btn btn--secondary" onClick={() => { if (!busy) p.onCancel(); }} aria-disabled={busy}>{tt('Vazgeç')}</button><button type="button" data-confirm className={p.danger ? "btn btn--red" : "btn"} onClick={submit} disabled={(!!p.stale || (!!p.requireAck && !ackd)) && !busy} aria-disabled={busy || !!p.stale || (!!p.requireAck && !ackd)} aria-busy={busy}>{busy ? tt('Gönderiliyor…') : p.confirmLabel}</button></div>
    </div>
  </div>, document.body);
}
