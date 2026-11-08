import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, errorKind, describeError, registerReconciler, type ErrorKind } from './api';
import { checkDto, type Schema } from './dto';
/** F01/F10: bağlam anahtarına bağlı veri yükleme. Her yeni anahtar önceki isteği iptal eder; geç gelen eski yanıt yok sayılır.
 * Durumlar ayrıdır: loading (yükleniyor), ok (veri; boş dizi = kayıt yok), error (servis/ağ/zaman aşımı/yetki). Aynı anahtarın verisi dışında veri gösterilmez. */
export type LoadState<T> = { key: string; status: 'idle' | 'loading' | 'ok' | 'error'; data: T | null; error: ApiError | null; kind: ErrorKind | null; message: string | null };
export function useLoad<T>(key: string | null, fetcher: (signal: AbortSignal) => Promise<T>) {
  const [st, setSt] = useState<LoadState<T>>({ key: '', status: 'idle', data: null, error: null, kind: null, message: null });
  const seq = useRef(0); const ctl = useRef<AbortController | null>(null); const f = useRef(fetcher); f.current = fetcher;
  const run = useCallback(async (k: string | null, keepData = false): Promise<boolean> => {
    ctl.current?.abort(); const my = ++seq.current;
    if (!k) { setSt({ key: '', status: 'idle', data: null, error: null, kind: null, message: null }); return true; }
    const c = new AbortController(); ctl.current = c;
    setSt(prev => ({ key: k, status: 'loading', data: keepData && prev.key === k ? prev.data : null, error: null, kind: null, message: null }));
    try { const d = await f.current(c.signal); if (my !== seq.current) return false; setSt({ key: k, status: 'ok', data: d, error: null, kind: null, message: null }); return true; }
    catch (e) { if (my !== seq.current || errorKind(e) === 'aborted') return false; setSt({ key: k, status: 'error', data: null, error: e as ApiError, kind: errorKind(e), message: describeError(e) }); return false; }
  }, []);
  useEffect(() => { void run(key); return () => { ctl.current?.abort(); }; }, [key, run]);
  const reload = useCallback(() => run(key, true), [key, run]);
  // Güncel olmayan anahtarın verisi hiçbir zaman döndürülmez
  const current = st.key === (key ?? '') ? st : { ...st, status: key ? 'loading' as const : 'idle' as const, data: null, error: null, kind: null, message: null };
  return { ...current, reload };
}
/** GET kısayolu: iptal sinyaliyle */
export const getJson = <T,>(url: string, schema?: Schema) => async (signal: AbortSignal) => { const d = await api<T>('GET', url, undefined, { signal }); return schema ? checkDto<T>(d, schema, url) : d; };
/** Ekran yeniden okuma işlevini receipt_lost uzlaştırmasına kaydeder; işlev okuma başarısızsa hata fırlatmalıdır (uzlaştırma ancak gerçek okumayla tamamlanır) */
export function useReconciler(fn: () => Promise<unknown>, contextKey = '', optional = false) { const r = useRef(fn); r.current = fn; const k = useRef(contextKey); k.current = contextKey; useEffect(() => registerReconciler(() => r.current(), () => k.current, optional), []); }
