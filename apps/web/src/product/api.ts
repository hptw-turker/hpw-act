import { tt, ttServer } from './i18n';
/** API istemcisi: aynı köken; çerez tabanlı oturum. Hata gövdesi {error, message, details} olarak fırlatılır.
 * F10: süre aşımı, iptal, ağ kesintisi, bozuk yanıt ve oturum sonu ayrı hata kodlarıyla ayrılır; 401 uygulama genelinde oturum sonu olayı üretir. */
export class ApiError extends Error { status: number; code: string; details: unknown; constructor(status: number, code: string, message: string, details?: unknown) { super(message); this.status = status; this.code = code; this.details = details; } }
export const newIdempotencyKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const DEFAULT_TIMEOUT_MS = 20000;
/** Hata türü: ekran yükleniyor / boş / hata / yetkisiz / oturum sonu ayrımını bunun üzerinden yapar */
export type ErrorKind = 'session' | 'forbidden' | 'not_found' | 'conflict' | 'invalid' | 'rate_limited' | 'unavailable' | 'server' | 'network' | 'timeout' | 'aborted' | 'bad_response';
export function errorKind(e: unknown): ErrorKind {
  const a = e as ApiError; const s = a?.status ?? 0;
  if (a?.code === 'aborted') return 'aborted'; if (a?.code === 'timeout') return 'timeout'; if (a?.code === 'network') return 'network'; if (a?.code === 'bad_response') return 'bad_response';
  if (s === 401) return 'session'; if (s === 403) return 'forbidden'; if (s === 404) return 'not_found'; if (s === 409) return 'conflict'; if (s === 400 || s === 422) return 'invalid'; if (s === 429) return 'rate_limited'; if (s === 502 || s === 503 || s === 504) return 'unavailable'; if (s >= 500) return 'server'; return 'server';
}
/** Kullanıcıya gösterilecek açıklama: sunucu mesajı varsa o, yoksa türüne göre Türkçe metin */
export function describeError(e: unknown): string {
  const a = e as ApiError; const k = errorKind(e);
  const fallback: Record<ErrorKind, string> = { session: tt("Oturumunuzun süresi doldu; yeniden giriş yapın."), forbidden: tt("Bu işlem için yetkiniz yok."), not_found: tt("Kayıt bulunamadı ya da kapatılmış."), conflict: tt("Kayıt siz görüntüledikten sonra değişti; güncel hâli yüklendi."), invalid: tt("Girilen bilgiler geçersiz."), rate_limited: tt("Çok sayıda istek gönderildi; biraz bekleyip yeniden deneyin."), unavailable: tt("Servis şu an yanıt vermiyor; biraz sonra yeniden deneyin."), server: tt("Beklenmeyen bir sunucu hatası oluştu."), network: tt("Sunucuya ulaşılamadı; bağlantınızı kontrol edip yeniden deneyin."), timeout: tt("Sunucu zamanında yanıt vermedi; yeniden deneyin."), aborted: tt("İstek iptal edildi."), bad_response: tt("Sunucudan okunamayan bir yanıt geldi; yeniden deneyin.") };
  const useServer = a?.message && a.message !== `HTTP ${a.status}` && !['network', 'timeout', 'aborted'].includes(k) && !(k === 'bad_response' && a.message === 'Sunucudan okunamayan bir yanıt geldi');
  // İngilizce arayüz: sunucunun Türkçe iletisi sözlükte varsa çevrilir; yoksa hata türünün İngilizce genel iletisi (Türkçe metin sızmaz)
  if (useServer) { const m = ttServer(a.message); if (m !== null) return m; }
  return fallback[k];
}
const AUTH_FREE = /^\/api\/(auth\/(login|me|forgot|reset)|invitations\/|platform\/bootstrap)/;
export const SESSION_EVENT = 'hpw:session-expired';
export async function api<T = unknown>(method: 'GET' | 'POST' | 'PATCH', url: string, body?: unknown, opts: { idempotencyKey?: string; signal?: AbortSignal; timeoutMs?: number } = {}): Promise<T> {
  const ctl = new AbortController(); let timedOut = false; const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onAbort = () => ctl.abort(); if (opts.signal) { if (opts.signal.aborted) ctl.abort(); else opts.signal.addEventListener('abort', onAbort, { once: true }); }
  let res: Response;
  try {
    res = await fetch(url, { method, credentials: 'include', signal: ctl.signal, headers: { ...(body instanceof FormData || body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}) } /* gövdesiz POST'ta JSON başlığı yok; N11 */, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    clearTimeout(timer); opts.signal?.removeEventListener('abort', onAbort);
    if (timedOut) throw new ApiError(0, 'timeout', tt("Sunucu zamanında yanıt vermedi"));
    if (opts.signal?.aborted || (e as Error)?.name === 'AbortError') throw new ApiError(0, 'aborted', tt("İstek iptal edildi"));
    throw new ApiError(0, 'network', tt("Sunucuya ulaşılamadı"));
  }
  let txt = ''; try { txt = await res.text(); } catch { clearTimeout(timer); throw new ApiError(0, timedOut ? 'timeout' : 'network', tt("Yanıt tamamlanamadı")); }
  clearTimeout(timer); opts.signal?.removeEventListener('abort', onAbort);
  let data: unknown = null; let parsed = true; if (txt.length) { try { data = JSON.parse(txt); } catch { parsed = false; data = txt; } }
  if (!res.ok) {
    const e = (parsed && data && typeof data === 'object' ? data : {}) as { error?: string; message?: string; details?: unknown };
    if (res.status === 401 && !AUTH_FREE.test(url) && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SESSION_EVENT));
    throw new ApiError(res.status, e.error ?? (res.status === 401 ? 'unauthorized' : 'error'), e.message ?? tt("HTTP {0}", res.status), e.details);
  }
  if (!parsed) throw new ApiError(502, 'bad_response', tt("Sunucudan okunamayan bir yanıt geldi"));
  return data as T;
}
export async function download(url: string, filename: string) { const res = await fetch(url, { credentials: 'include' }); if (!res.ok) { const t = await res.text(); throw new ApiError(res.status, 'download_failed', t.slice(0, 200)); } const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
export interface Me { userId: string; email: string; displayName: string; realm: 'customer' | 'platform'; tenantId: string | null; profile: string | null; companyWide?: boolean; scopes?: { unitId: string; profile: string }[]; memberships?: { tenant_id: string; tenant_name: string; tenant_code: string }[]; env?: string; }
export interface Issue { severity: 'error' | 'warning'; sheet: string; row: number | null; col: string | null; code: string; message: string; value?: string; }
export interface ImportResult { jobId: string; state: 'validated' | 'failed'; rowCount: number; errorCount: number; warningCount: number; issues: Issue[]; preview: Record<string, unknown>; canCommit: boolean; }

/** Komut çağrısı (P0-2, F06, F07, F13): kullanıcı niyeti boyunca kararlı Idempotency-Key.
 * - Niyet kimliği OPAK'tır: aktör + şirket + yöntem + işlem yolu + gövde üzerinden hesaplanan özet; depoya yalnız {anahtar, durum, zaman, aktör, şirket} yazılır — ne URL ne gövde.
 * - Hassas komutlar (davet kabulü, parola sıfırlama, giriş; gövdesinde parola bulunan her komut) depoya HİÇ yazılmaz; yalnız bellekte, istek sürerken tutulur.
 * - sessionStorage kullanılamazsa gerçek bellek yedeği kullanılır; belirsiz sonuç sonrası aynı niyetin tekrarı aynı anahtarı alır.
 * - çift tık: aynı isteğin sonucu beklenir; ağ hatası: aynı anahtarla otomatik yeniden deneme; denemeler bitince niyet outcome_unknown olarak KALIR.
 * - receipt_lost: komut sunucuda yapılmıştır; kayıtlı uzlaştırıcılar (ekranın yeniden okuma işlevleri) çalıştırılır, okuma başarılıysa niyet kapanır; okunamazsa niyet açık kalır ve aynı anahtar korunur.
 * - Çıkışta ya da kullanıcı değişiminde bütün niyetler temizlenir (clearIntents). */
const INTENT_NS = 'hpwact.intents.v2';
type Intent = { key: string; state: 'pending' | 'outcome_unknown' | 'receipt_lost'; at: number; actor: string; tenant: string };
const memStore = new Map<string, Intent>(); let storageOk: boolean | null = null;
function storageAvailable(): boolean { if (storageOk !== null) return storageOk; try { const k = '__hpw_probe__'; sessionStorage.setItem(k, '1'); sessionStorage.removeItem(k); storageOk = true; } catch { storageOk = false; } return storageOk; }
const store = {
  load(): Record<string, Intent> { if (storageAvailable()) { try { return JSON.parse(sessionStorage.getItem(INTENT_NS) ?? '{}') as Record<string, Intent>; } catch { /* bozuk ya da engelli: bellek */ } } return Object.fromEntries(memStore); },
  save(m: Record<string, Intent>) { memStore.clear(); for (const [k, v] of Object.entries(m)) memStore.set(k, v); if (storageAvailable()) { try { sessionStorage.setItem(INTENT_NS, JSON.stringify(m)); } catch { storageOk = false; } } },
};
let ctxActor = 'anon', ctxTenant = '-';
/** Oturumdaki aktör ve şirket; aktör değişirse önceki kullanıcının niyetleri silinir */
export function setCommandContext(actor: string | null, tenant: string | null) { const a = actor ?? 'anon'; if (a !== ctxActor && ctxActor !== 'anon') clearIntents(); ctxActor = a; ctxTenant = tenant ?? '-'; }
export function clearIntents() { memStore.clear(); inflight.clear(); if (storageAvailable()) { try { sessionStorage.removeItem(INTENT_NS); sessionStorage.removeItem('hpwact.intents.v1'); } catch { /* yok */ } } }
const SENSITIVE_URL = /^\/api\/(invitations\/|auth\/|platform\/bootstrap)/;
const isSensitive = (url: string, body: unknown) => SENSITIVE_URL.test(url) || (!!body && typeof body === 'object' && Object.keys(body as object).some(k => /password|parola|token|setupKey/i.test(k)));
/** 53 bit FNV/Cyrb özeti: niyet kimliği içeriği geri üretilemeyecek biçimde kısaltılır (asıl koruma: hassas komutların depoya hiç yazılmaması) */
function digest(s: string): string { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); }
const inflight = new Map<string, Promise<unknown>>();
const sensitiveIntents = new Map<string, Intent>();
/** Ekranların yeniden okuma işlevleri: receipt_lost uzlaştırması bunları çalıştırır */
type Reconciler = { fn: () => Promise<unknown>; key: () => string; optional: boolean };
const reconcilers = new Set<Reconciler>();
/** N01: ekran okuyucusu kendi bağlam anahtarıyla kaydolur (ör. şirket|dönem|birim). Uzlaştırma yalnız komut başladığında kayıtlı olan, hâlâ bağlı ve bağlamı DEĞİŞMEMİŞ okuyucularla yapılır. */
export function registerReconciler(fn: () => Promise<unknown>, key: () => string = () => '', optional = false): () => void { const r = { fn, key, optional }; reconcilers.add(r); return () => { reconcilers.delete(r); }; }
export function pendingIntents(): number { return Object.values(store.load()).filter(i => i.state !== 'pending' && i.actor === ctxActor).length; }
/** v2.9.0: hassas işlemde sunucu yeniden doğrulama isterse (reauth_required) bu sağlayıcı kodu alır ve doğrular; başarılıysa aynı niyet aynı anahtarla bir kez yeniden gönderilir */
let reauthProvider: (() => Promise<boolean>) | null = null;
export function setReauthProvider(fn: (() => Promise<boolean>) | null) { reauthProvider = fn; }
/** v2.11.4 (V2113-A01): açık niyetin işlem anahtarı — komut sonucu sunucudan bu anahtarla sorgulanır (hassas komutlar hariç) */
export function intentKeyFor(url: string, body?: unknown, method: 'POST' | 'PATCH' = 'POST'): string | null { const id = 'i' + digest(`${ctxActor}|${ctxTenant}|${method}|${url}|${JSON.stringify(body ?? null)}`); return store.load()[id]?.key ?? null; }
/** v2.11.4: sonucu kesinleşen niyeti (sunucu kaydıyla doğrulanmış ya da kesin uygulanmamış) istemci deposundan kapatır — ekran deposuyla tutarlı */
export function settleIntent(url: string, body?: unknown, method: 'POST' | 'PATCH' = 'POST') { const id = 'i' + digest(`${ctxActor}|${ctxTenant}|${method}|${url}|${JSON.stringify(body ?? null)}`); const m = store.load(); if (m[id]) { delete m[id]; store.save(m); } }
export async function commandApi<T = unknown>(url: string, body?: unknown, opts: { method?: 'POST' | 'PATCH'; retries?: number; verify?: () => Promise<boolean> } = {}): Promise<T> {
  const method = opts.method ?? 'POST'; const sensitive = isSensitive(url, body);
  const id = 'i' + digest(`${ctxActor}|${ctxTenant}|${method}|${url}|${JSON.stringify(body ?? null)}`);
  const cur = inflight.get(id); if (cur) return cur as Promise<T>;
  const startCtx = `${ctxActor}|${ctxTenant}`; const startRecs = [...reconcilers].map(r => ({ r, k: r.key() })); // N01: komutun başladığı bağlam ve ekran okuyucuları
  let it: Intent;
  if (sensitive) { it = sensitiveIntents.get(id) ?? { key: newIdempotencyKey(), state: 'pending', at: Date.now(), actor: ctxActor, tenant: ctxTenant }; sensitiveIntents.set(id, it); }
  else { const map = store.load(); it = map[id] ?? { key: newIdempotencyKey(), state: 'pending', at: Date.now(), actor: ctxActor, tenant: ctxTenant }; if (!map[id]) { map[id] = it; store.save(map); } }
  const setState = (state: Intent['state']) => { if (sensitive) { const x = sensitiveIntents.get(id); if (x) x.state = state; return; } const m = store.load(); if (m[id]) { m[id].state = state; store.save(m); } };
  const close = () => { if (sensitive) { sensitiveIntents.delete(id); return; } const m = store.load(); delete m[id]; store.save(m); };
  const run = async (): Promise<T> => {
    let lastErr: unknown = null; let reauthTried = false;
    for (let attempt = 0; attempt <= (opts.retries ?? 2); attempt++) {
      try { const r = await api<T>(method, url, body, { idempotencyKey: it.key }); close(); return r; }
      catch (e) {
        lastErr = e; const err = e as ApiError;
        if (err.code === 'receipt_lost') {
          setState('receipt_lost');
          const live = startRecs.filter(x => reconcilers.has(x.r) && x.r.key() === x.k); let verified: boolean | null = null;
          try { if (`${ctxActor}|${ctxTenant}` !== startCtx) throw new Error(tt("oturum ya da şirket değişti")); const req = live.filter(x => !x.r.optional); if (req.length === 0 && !opts.verify) throw new Error(tt("bu işlemin kaydını okuyacak ekran yok ya da bağlam değişti")); if (opts.verify) verified = await opts.verify(); await Promise.all(req.map(x => x.r.fn())); await Promise.all(live.filter(x => x.r.optional).map(x => x.r.fn().catch(() => null))); /* yardımcı okuyucular (ör. dağıtım paneli) okunamasa da ana kayıt okunduysa uzlaştırma sürer */ }
          catch (re) { throw new ApiError(409, 'receipt_lost_unreconciled', tt("Bu işlem sunucuda daha önce gerçekleşmiş görünüyor, ancak güncel kayıt okunamadı. Aynı düğmeye yeniden bastığınızda aynı işlem anahtarıyla uzlaştırılır; ikinci kez uygulanmaz."), { cause: re instanceof ApiError ? describeError(re) : String((re as Error)?.message ?? re) }); }
          // N01: niyet yalnız işlemin sonucu kayıtta DOĞRULANINCA kapanır; yalnız okuma yapılmışsa anahtar korunur
          if (verified === true) { close(); throw new ApiError(409, 'receipt_lost', tt("Bu işlem daha önce gerçekleşmişti; kayıt yeniden okundu ve sonucu doğrulandı."), err.details); }
          throw new ApiError(409, 'receipt_lost_unverified', verified === false ? tt("Sunucu bu işlemin daha önce gerçekleştiğini bildirdi, ancak kayıt yeniden okunduğunda sonucu görünmüyor. Aynı düğmeye yeniden basarsanız aynı işlem anahtarıyla uzlaştırılır; ikinci kez uygulanmaz.") : tt("Bu işlem daha önce gerçekleşmişti; kayıt yeniden okundu ve güncel durum gösteriliyor. Aynı düğmeye yeniden basarsanız aynı işlem anahtarı kullanılır; ikinci kez uygulanmaz."), err.details);
        }
        if (err.code === 'reauth_required' && reauthProvider && !reauthTried) { reauthTried = true; if (await reauthProvider()) { attempt--; continue; } throw e; }
        if (err.code === 'idempotency_in_progress') { await new Promise(res => setTimeout(res, 700 * (attempt + 1))); continue; }
        if (err.status && err.status !== 0 && err.status < 500) { close(); throw e; }
        if (err.code === 'aborted') { setState('outcome_unknown'); throw e; }
        await new Promise(res => setTimeout(res, 400 * (attempt + 1)));
      }
    }
    setState('outcome_unknown');
    throw new ApiError(0, 'outcome_unknown', tt("Ağ yanıtı alınamadı; işlem sunucuda yapılmış olabilir. Aynı düğmeye tekrar basınca aynı işlem anahtarıyla uzlaştırılır, ikinci kez uygulanmaz."), describeError(lastErr));
  };
  const pr = run().finally(() => inflight.delete(id)); inflight.set(id, pr); return pr as Promise<T>;
}
/** F12: sayısal alan çözümleme — boş, virgüllü ondalık, harf, aralık dışı; NaN hiçbir zaman gönderilmez */
export type NumResult = { ok: true; value: number | null } | { ok: false; error: string };
export function parseNum(raw: string, o: { min?: number; max?: number; integer?: boolean; required?: boolean; label?: string } = {}): NumResult {
  const s = (raw ?? '').trim(); const L = o.label ?? tt("Değer");
  if (!s) return o.required ? { ok: false, error: `${L} zorunludur` } : { ok: true, value: null };
  if (!/^-?\d+([.,]\d+)?$/.test(s)) return { ok: false, error: `${L} yalnız sayı olmalıdır (örnek: 72,5)` };
  const v = Number(s.replace(',', '.')); if (!Number.isFinite(v)) return { ok: false, error: `${L} geçerli bir sayı değil` };
  if (o.integer && !Number.isInteger(v)) return { ok: false, error: `${L} tam sayı olmalıdır` };
  if (o.min !== undefined && v < o.min) return { ok: false, error: `${L} en az ${String(o.min).replace('.', ',')} olmalıdır` };
  if (o.max !== undefined && v > o.max) return { ok: false, error: `${L} en fazla ${String(o.max).replace('.', ',')} olabilir` };
  return { ok: true, value: v };
}
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** R02: catch bloklarının ortak, tür güvenli hata sunumu. err.details dizi (Issue[]), nesne, metin ya da yok olabilir; hiçbiri render'ı çökertmez. */
export function describeErrorDetail(e: unknown): string {
  const a = e as ApiError; const d = a?.details;
  // receipt_lost ailesi: dış mesaj (uzlaştırma sonucu) her zaman öncelikli; { cause } yalnız iç ayrıntıdır, ana iletiyi ezmemeli
  if (typeof a?.code === 'string' && a.code.startsWith('receipt_lost')) return describeError(e);
  if (Array.isArray(d)) { const msgs = d.map(x => (x && typeof x === 'object' && 'message' in x ? String((x as { message: unknown }).message) : typeof x === 'string' ? x : null)).filter((x): x is string => !!x); if (msgs.length) return msgs.join(' · '); }
  else if (typeof d === 'string' && d) return d;
  else if (d && typeof d === 'object' && 'cause' in d && typeof (d as { cause: unknown }).cause === 'string') return `${describeError(e)} (${(d as { cause: string }).cause})`;
  return describeError(e);
}

