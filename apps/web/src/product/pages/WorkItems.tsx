/** v2.11.0 bekleyen işler (MP08; docs/tasarim/BEKLEYEN-ISLER-KURALLARI-v2.11.md). Kurallar yalnız bu liste açıldığında değerlendirilir; arka plan değerlendiricisi yoktur.
 * Güncellik, satırın son BAŞARILI doğrulama zamanıdır; “güncel değil”, “kaynak okunamadı”, “değerlendirilemedi” ve “sorun yok” ayrı gösterilir.
 * İşlemler erişilebilir onay penceresiyle; sürüm ve işlem anahtarıyla; yanıt kaybında sonuç güncel kayıttan doğrulanır; filtre (bağlam) değişirse açık pencere gönderim yapmaz. */
import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { tt, locale } from '../i18n';
import { api, commandApi, describeError, intentKeyFor, settleIntent } from '../api';
import { checkDto, DTO } from '../dto';
import { ConfirmDialog } from '../Dialog';
import { Field } from '../../components/Field';
type Can = { claim: boolean; release: boolean; snooze: boolean; dismiss: boolean };
type WI = { id: string; tenant_id: string; tenant_code: string; tenant_name: string; tenant_status: string; rule: string; occurrence: number; state: string; owner_role: string; claimed_by: string | null; claimed_by_name: string | null; snoozed_until: string | null; dismissed_until: string | null; state_reason: string | null; opened_at: string; due_at: string; resolved_at: string | null; evidence: Record<string, unknown>; eval_status: string; eval_error: string | null; last_ok_eval_at: string | null; version: number; can: Can };
type Ev = { tenant_id: string; tenant_code: string; rule: string; status: string; detail: string | null; last_ok_at: string | null; active_item_state: string | null };
type Data = { generatedAt: string; items: WI[]; evaluations: Ev[]; evaluationFailures: { tenantId: string; error: string }[]; evaluationDeferred: string[] };
type Hist = { id: string; occurred_at: string; action: string; actor_email: string | null; actor_name: string | null; reason: string | null; after: Record<string, unknown> | null };
export const RULE_TR: Record<string, string> = { setup_overdue: tt('Kurulum gecikti'), no_admin: tt('Yöneticisiz şirket'), invite_failed: tt('Davet başarısız'), import_pending: tt('İçe aktarma bekliyor'), overdue_actions: tt('Gecikmiş uygulama'), verification_backlog: tt('Doğrulama birikti'), central_decision: tt('Merkezi karar bekliyor'), inactive: tt('Hareketsiz şirket'), methodology: tt('Metodoloji kararı') };
const ACT_TR: Record<string, string> = { 'work_item.opened': tt('iş açıldı (sistem)'), 'work_item.resolved': tt('kaynakta çözüldü (sistem)'), 'work_item.claim': tt('üstlenildi'), 'work_item.release': tt('bırakıldı'), 'work_item.snooze': tt('ertelendi'), 'work_item.dismiss': tt('reddedildi'), 'work_item.snooze_ended': tt('erteleme bitti (sistem)'), 'work_item.dismiss_ended': tt('reddetme süresi bitti (sistem)'), 'work_item.owner_lost': tt('sahibin yetkisi kalmadı; iş sahipsiz (sistem)'), 'work_item.tenant_inactive': tt('şirket askıya alındı (sistem)'), 'work_item.tenant_active': tt('şirket yeniden etkin; iş yeniden değerlendirildi (sistem)') };
const SECTION: Record<string, string> = { setup_overdue: 'kurulum', no_admin: 'kurulum', invite_failed: 'kurulum', import_pending: 'donemler', overdue_actions: 'donemler', verification_backlog: 'donemler', central_decision: 'ozet', inactive: 'ozet', methodology: 'donemler' };
const STATE_SHORT: Record<string, string> = { open: tt('açık'), claimed: tt('üstlenildi'), snoozed: tt('ertelendi'), dismissed: tt('reddedildi'), tenant_inactive: tt('şirket askıda') };
const d10 = (v: string | null | undefined) => (v ? new Date(v).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' }) : '—');
/** v2.11.1 (V211-06): takvim günü YEREL saat diliminde; seçilen günün sonu (23:59) gönderilir ve süre sınırına (30/90 gün) kadar kısılır — sunucu sınırı gevşetilmez */
const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const untilFor = (day: string, limitDays: number, now = Date.now()) => { const end = new Date(`${day}T23:59:00`).getTime(); const cap = now + limitDays * 86400000 - 60000; return new Date(Math.min(end, cap)).toISOString(); };
function evidenceText(w: WI): string {
  const e = w.evidence as Record<string, never>;
  switch (w.rule) {
    case 'setup_overdue': return tt('{0} gündür açık; eksik adım: {1}', e.daysSinceCreation ?? '—', Array.isArray(e.openSteps) ? (e.openSteps as string[]).length : '—');
    case 'no_admin': return tt('bekleyen yönetici daveti {0} tarihinden beri', d10(e.pendingSince));
    case 'invite_failed': return tt('{0} davetin son teslimatı kalıcı başarısız', e.failed ?? 0);
    case 'import_pending': return tt('{0} onay bekleyen içe aktarma{1}', Array.isArray(e.staleValidated) ? (e.staleValidated as unknown[]).length : 0, e.lastFailed ? tt(' · son içe aktarma başarısız') : '');
    case 'overdue_actions': return tt('{0} dönemi: {1}/{2} aksiyon gecikmiş, en eskisi {3} gün', e.cycle ?? '—', e.overdue ?? 0, e.eligible ?? 0, e.oldestDays ?? '—');
    case 'verification_backlog': return tt('{0} dönemi: {1} doğrulama bekliyor, en eskisi {2} gün', e.cycle ?? '—', e.pending ?? 0, e.oldestDays ?? '—');
    case 'central_decision': return tt('{0} karar 7 günden eski, en eskisi {1} gün', e.count ?? 0, e.oldestDays ?? '—');
    case 'inactive': return tt('son şirket olayı: {0}', d10(e.lastActivityAt));
    case 'methodology': return tt('{0} karşılaştırılabilirlik incelemesi bekliyor', e.pendingReviews ?? 0);
    default: return '';
  }
}
function stateText(w: WI) {
  switch (w.state) {
    case 'open': return tt('açık');
    case 'claimed': return tt('üstlenildi: {0}', w.claimed_by_name ?? '—');
    case 'snoozed': return tt('ertelendi ({0} tarihine kadar)', d10(w.snoozed_until));
    case 'dismissed': return tt('reddedildi ({0} tarihine kadar) — çözülmüş sayılmaz', d10(w.dismissed_until));
    case 'tenant_inactive': return w.tenant_status === 'archived' ? tt('şirket arşivde; işlem yapılamaz') : tt('şirket askıda; işlem yapılamaz');
    case 'resolved': return tt('kaynakta çözüldü ({0})', d10(w.resolved_at));
    default: return w.state;
  }
}
export function freshText(status: string, lastOk: string | null, detail: string | null) {
  const age = lastOk ? Date.now() - new Date(lastOk).getTime() : Infinity;
  if (status === 'unreadable') return tt('kaynak okunamadı · son başarılı doğrulama {0}', d10(lastOk));
  if (status === 'not_evaluable') return detail === 'no_tracked_cycle' ? tt('değerlendirilemedi: izlenen dönem seçilmedi · son başarılı doğrulama {0}', d10(lastOk)) : tt('değerlendirilemedi ({0}) · son başarılı doğrulama {1}', detail ?? '—', d10(lastOk));
  return age > 5 * 60 * 1000 ? tt('güncel değil · son doğrulama {0}', d10(lastOk)) : tt('güncel · {0}', d10(lastOk));
}
type Op = 'claim' | 'release' | 'snooze' | 'dismiss';
const OP_TR: Record<Op, string> = { claim: tt('üstlenme'), release: tt('bırakma'), snooze: tt('erteleme'), dismiss: tt('reddetme') };
type Pending = { key: string; body: Record<string, unknown>; unknown: boolean; date?: string; reason?: string; checking?: boolean; newAllowedFor?: string };
/** bekleyen (sonucu belirsiz) komutlar — pencere kapanınca silinmez; kapsam anahtarı kullanıcı + şirket + iş + işlem */
const pendingStore = new Map<string, Pending>();
export function WorkItemsTab({ userKey = '' }: { userKey?: string }) {
  const [sp, setSp] = useSearchParams(); const fTenant = sp.get('is_sirket') ?? '', fState = sp.get('is_durum') ?? '', fRule = sp.get('is_kural') ?? '';
  // v2.11.1 (V211-02): gösterilen veri, yüklendiği sorgunun anahtarına bağlı; bağlam değişince yeni bağlamın ilk yanıtına kadar eski satır ve işlem gösterilmez
  const [data, setData] = useState<Data | null>(null); const [dataKey, setDataKey] = useState(''); const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null); const gen = useRef(0); const ctx = useRef(0);
  // v2.11.1 (V211-05): güncellik etiketi zamanla yaşlanır (30 sn'de bir ve sekmeye dönünce yeniden çizim); kurallar yeniden değerlendirilmez, kayıt zamanı değişmez
  const [, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick(t => t + 1), 30000); const v = () => { if (document.visibilityState === 'visible') setTick(t => t + 1); }; document.addEventListener('visibilitychange', v); window.addEventListener('focus', v); return () => { clearInterval(i); document.removeEventListener('visibilitychange', v); window.removeEventListener('focus', v); }; }, []);
  const [dlg, setDlg] = useState<{ w: WI; op: Op; ctx: number; at?: number; review?: { from: WI; to: WI | null } } | null>(null);
  /** v2.11.2/2.11.3 (V2111-R1, R1-A, R1-B): onaylanan komut (gövde, mutlak bitiş anı → aynı işlem anahtarı) sonuç kesinleşene kadar korunur.
   * Bekleyen komut pencerenin ömründen bağımsızdır (modül düzeyinde depo; kapsam: kullanıcı + şirket + iş + işlem). Vazgeç/Escape sunucudaki işlemi iptal etmez;
   * yeniden açınca özgün değerler doldurulur ve aynı gövde/anahtarla devam edilir. Gün değişse de özgün komutun tekrarı yeni komutların tarih aralığına takılmaz
   * (bitiş anı hâlâ gelecekteyse). Sonuç belirsizken alan değiştirilirse önce güncel kayıt okunarak sonuç doğrulanır; uygulanmışsa pencere kapanır, uygulanmamışsa
   * bu kullanıcıya açıkça söylenir ve ancak yeni bir onayla yeni komut gönderilir. */
  const frozen = { get current() { return pendingStore.get(scopeKey()) ?? null; }, set current(v: Pending | null) { if (v) pendingStore.set(scopeKey(), v); else pendingStore.delete(scopeKey()); } };
  const scopeKey = () => dlg ? `${userKey}|${dlg.w.tenant_id}|${dlg.w.id}|${dlg.op}` : ''; const [dErr, setDErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [hist, setHist] = useState<{ id: string; rows: Hist[] | null; err: string | null } | null>(null); const hgen = useRef(0);
  const qs = () => { const n = new URLSearchParams(); if (fTenant) n.set('tenantId', fTenant); if (fState === 'resolved') n.set('includeResolved', '1'); if (fState && fState !== 'resolved') n.set('state', fState); if (fRule) n.set('rule', fRule); return n.toString(); };
  // ilk görünüm kayıtlı durumla hemen çizilir (evaluate=0); ardından değerlendirme tetiklenir ve sonuç gelince tablo güncellenir — değerlendirme uzarsa ya da bir şirket kilitte beklerse görünüm beklemez
  const [evaluating, setEvaluating] = useState(false);
  const load = async () => { const g = ++gen.current; const key = qs(); setErr(null); const base = `/api/platform/work-items?${key}${key ? '&' : ''}`;
    try { const fast = checkDto<Data>(await api('GET', base + 'evaluate=0'), DTO.workItems, '/platform/work-items'); if (g !== gen.current) return; setData(fast); setDataKey(key); } catch (e) { if (g !== gen.current) return; setErr(describeError(e)); return; }
    setEvaluating(true); try { const v = checkDto<Data>(await api('GET', base + 'evaluate=1', undefined, { timeoutMs: 20000 }), DTO.workItems, '/platform/work-items'); if (g !== gen.current) return; setData(v); setDataKey(key); } catch (e) { if (g !== gen.current) return; setErr(tt('Kurallar değerlendirilemedi; son bilinen durum gösteriliyor ({0})', describeError(e))); } finally { if (g === gen.current) setEvaluating(false); } };
  useEffect(() => { ctx.current++; setOpen(null); setHist(null); setDlg(null); setData(null); setDataKey(''); void load(); }, [fTenant, fState, fRule]);
  const setF = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n); };
  // v2.11.3: bekleyen (sonucu belirsiz) komutların uzlaştırılması — güncel liste işin beklenen duruma geçtiğini (daha yüksek sürümle) gösteriyorsa özgün komut kaydedilmiştir
  // v2.11.4 (V2113-A01): komut kimliğine bağlı sonuç sorgusu ve bekleyen komutun kapatılması — ekran deposu ile API istemcisinin niyet kaydı birlikte kapanır
  type Outcome = { key: string; status: 'applied' | 'not_found'; route: string | null };
  const urlOf = (w: { id: string }, op: Op) => `/api/platform/work-items/${w.id}/${op}`;
  const pkey = (w: { tenant_id: string; id: string }, op: Op) => `${userKey}|${w.tenant_id}|${w.id}|${op}`;
  const outcomeOf = async (w: { tenant_id: string; id: string }, op: Op, body: Record<string, unknown>): Promise<{ r: 'applied' | 'not_found' | 'unknown' }> => {
    const key = intentKeyFor(urlOf(w, op), body); if (!key) return { r: 'unknown' };
    try { const o = checkDto<Outcome>(await api('GET', `/api/platform/commands/${encodeURIComponent(key)}/outcome`), DTO.commandOutcome, '/platform/commands/:key/outcome');
      if (o.status === 'applied') return { r: o.route === `POST /work-items/${w.id}/${op}` ? 'applied' : 'unknown' }; return { r: 'not_found' }; } catch { return { r: 'unknown' }; } };
  const readItem = async (w: { tenant_id: string; id: string }) => { try { const v = checkDto<Data>(await api('GET', `/api/platform/work-items?tenantId=${w.tenant_id}&evaluate=0`), DTO.workItems, '/platform/work-items'); return v.items.find(x => x.id === w.id) ?? null; } catch { return null; } };
  const settle = (w: { tenant_id: string; id: string }, op: Op, body: Record<string, unknown>) => { pendingStore.delete(pkey(w, op)); settleIntent(urlOf(w, op), body); };
  /** v2.11.5: sonucu belirsiz özgün komut, kullanıcı bilinçli olarak yeni komut gönderirken silinmez; ayrı takipte (anahtar sonuna |onceki) kalır ve kapalı pencere uzlaştırmasında sonuçlandırılır */
  /** v2.11.6 (V2115-A01): sonucu belirsiz her eski komut KENDİ yuvasında tutulur — anahtar: kapsam + '|onceki|' + işlem anahtarı (yoksa alanların özeti).
   * Yeni komut ya da başka bir komutun sonuçlanması önceki belirsiz komutları silemez; her kayıt yalnız kendi sonuç sorgusuyla (applied/not_found) kapanır. */
  /** hangi gönderim: şirket, işlem, bitiş günü ve gerekçenin başı — kullanıcı sonucun hangi gönderime ait olduğunu ayırt eder */
  const which = (w: { tenant_code?: string }, op: Op, v: Pending) => tt('{0} · {1} · {2} · “{3}”', w.tenant_code ?? '—', OP_TR[op], v.date ?? '—', (v.reason ?? '').slice(0, 40));
  const addMsg = (m: string) => setMsg(prev => (prev && prev !== m ? `${prev} ${m}` : m));
  const supersede = (w: { tenant_id: string; id: string }, op: Op, p: Pending) => { const ik = intentKeyFor(urlOf(w, op), p.body) ?? ('f' + p.key); pendingStore.set(`${pkey(w, op)}|onceki|${ik}`, { key: p.key, body: p.body, unknown: true, date: p.date, reason: p.reason }); pendingStore.delete(pkey(w, op)); };
  const release = settle; // kesin olarak uygulanmadı (komut kaydı yok ve sürüm ilerledi): niyet kapanır, yeni komut ancak yeni onayla
  const settleIntentFor = (w: { id: string }, op: Op, body: Record<string, unknown>) => settleIntent(urlOf(w, op), body);
  // kapalı pencere: liste işin sürümünün ilerlediğini gösterirse özgün komutun sonucu komut kaydından sorgulanır (durum benzerliği kanıt değildir)
  useEffect(() => { if (!data || dataKey !== qs()) return;
    const openKey = dlg ? `${userKey}|${dlg.w.tenant_id}|${dlg.w.id}|${dlg.op}` : ''; // açık pencerenin komutu kullanıcının eylemiyle sürdürülür/doğrulanır
    for (const [k, v] of Array.from(pendingStore.entries())) { const [u, t, i, op] = k.split('|') as [string, string, string, Op]; if (u !== userKey || !v.unknown || k === openKey || v.checking) continue; const del = () => pendingStore.delete(k);
      const w = data.items.find(x => x.id === i && x.tenant_id === t); if (!w || w.version <= Number(v.body.expectedVersion)) continue; v.checking = true;
      void outcomeOf(w, op, v.body).then(o => { v.checking = false;
        if (o.r === 'applied') { del(); settleIntentFor(w, op, v.body); addMsg(tt('Önceki gönderiminiz kaydedilmişti (komut kaydı sunucuda doğrulandı): {0}.', which(w, op, v))); }
        else if (o.r === 'not_found') { del(); settleIntentFor(w, op, v.body); addMsg(tt('Önceki gönderiminiz uygulanmadı — {0}: kayıt başka bir işlemle değişti (şu an: {1}, sürüm {2}).', which(w, op, v), stateText(w), w.version)); } }); } }, [data, dataKey, dlg]);
  // şirket seçenekleri yüklenen yanıtlardan birikir (bağlam değişirken veri temizlense de seçim alanı kullanılabilir kalır; A→B→A)
  const [tenantOpts, setTenantOpts] = useState<Map<string, string>>(new Map());
  useEffect(() => { if (!data) return; setTenantOpts(prev => { const m = new Map(prev); for (const w of data.items) m.set(w.tenant_id, w.tenant_code); for (const e of data.evaluations) m.set(e.tenant_id, e.tenant_code); return m.size === prev.size ? prev : m; }); }, [data]);
  const tenants = Array.from(tenantOpts.entries()).sort((a, b) => a[1].localeCompare(b[1], 'tr'));
  const current = !!data && dataKey === qs(); // yüklenmiş veri güncel sorgunun mu
  const items = current ? (data!.items).filter(w => fState === 'resolved' ? w.state === 'resolved' : true) : [];
  const openHist = async (w: WI) => { if (open === w.id) { setOpen(null); return; } setOpen(w.id); const g = ++hgen.current; setHist({ id: w.id, rows: null, err: null }); try { const v = checkDto<Hist[]>(await api('GET', `/api/platform/work-items/${w.id}/history`), DTO.workItemHistory, '/work-items/:id/history'); if (g === hgen.current) setHist({ id: w.id, rows: v, err: null }); } catch (e) { if (g === hgen.current) setHist({ id: w.id, rows: null, err: describeError(e) }); } };
  const expect: Record<Op, string> = { claim: 'claimed', release: 'open', snooze: 'snoozed', dismiss: 'dismissed' };
  const confirm = async ({ reason, date }: { reason: string; date: string }) => {
    if (!dlg || dlg.ctx !== ctx.current) return; const { op } = dlg; const w = dlg.review?.to ?? dlg.w; if (dlg.review && (!dlg.review.to || !dlg.review.to.can[op])) return; const c = dlg.ctx; setDErr(null);
    const fk = [w.id, op, w.version, reason, date].join('|'); const pend = frozen.current;
    // v2.11.4 (V2113-A01/A02): sonuç kanıtı komut kimliğine (kullanıcı + işlem anahtarı) bağlıdır; durum/sürüm/alan benzerliği kanıt sayılmaz
    const outcome = (b: Record<string, unknown>) => outcomeOf(w, op, b);
    if (pend && pend.unknown && pend.key !== fk) {
      // alan değişti ama önceki gönderimin sonucu belirsiz: önce özgün komutun sunucudaki kaydı sorgulanır; sessizce yeni komut oluşturulmaz
      const o = await outcome(pend.body); if (c !== ctx.current) return;
      if (o.r === 'applied') { settle(w, op, pend.body); setDlg(null); setMsg(tt('Önceki gönderiminiz kaydedilmişti (komut kaydı sunucuda doğrulandı). Yeni değerler gönderilmedi.')); await load(); return; }
      if (o.r === 'unknown') { setDErr(tt('Önceki gönderimin sonucu doğrulanamadı; gönderiminiz belirsiz olarak saklanıyor. Alanları değiştirmeden aynı işlemi yeniden gönderebilir ya da biraz sonra yeniden deneyebilirsiniz.')); return; }
      // v2.11.5 (V2114-A01): not_found yalnız okuma anındaki yokluktur. İş okuması sürümün ilerlediğini gösterirse araya özgün komutun commit'i girmiş olabilir;
      // özgün anahtar, yeni sürüm GÖRÜLDÜKTEN SONRA yeniden sorgulanır (komut kaydı iş güncellemesiyle aynı transaction'da yazıldığından bu okuma o commit'i görür).
      const cur = await readItem(w); if (c !== ctx.current) return;
      if (!cur) { setDErr(tt('Önceki gönderimin sonucu doğrulanamadı; gönderiminiz belirsiz olarak saklanıyor. Alanları değiştirmeden aynı işlemi yeniden gönderebilir ya da biraz sonra yeniden deneyebilirsiniz.')); return; }
      if (cur.version > Number(pend.body.expectedVersion)) {
        const o2 = await outcome(pend.body); if (c !== ctx.current) return;
        if (o2.r === 'applied') { settle(w, op, pend.body); setDlg(null); setMsg(tt('Önceki gönderiminiz kaydedilmişti (komut kaydı sunucuda doğrulandı). Yeni değerler gönderilmedi.')); await load(); return; }
        if (o2.r === 'unknown') { setDErr(tt('Önceki gönderimin sonucu doğrulanamadı; gönderiminiz belirsiz olarak saklanıyor. Alanları değiştirmeden aynı işlemi yeniden gönderebilir ya da biraz sonra yeniden deneyebilirsiniz.')); return; }
        // yeni sürüm görüldükten sonra da özgün anahtarın kaydı yok: sürüm başka bir işlemle ilerledi; özgün komut (eski sürümle) artık uygulanamaz — kesin
        release(w, op, pend.body); setDErr(tt('Önceki gönderiminiz uygulanmadı: kayıt, siz gönderdikten sonra başka bir işlemle değişti (şu an: {0}, sürüm {1}). Güncel kaydı inceleyip yeniden onaylayın.', stateText(cur), cur.version)); setDlg(d => d && d.w.id === w.id ? { ...d, review: { from: d.w, to: cur } } : d); return;
      }
      // sürüm aynı ve kayıt yok: özgün komut henüz tamamlanmamış olabilir — kesin sonuç yok, takip SİLİNMEZ. Yeni değerler ancak bu bilgi verildikten sonra açık yeni onayla gönderilir;
      // özgün komut ayrı takipte kalır (sonradan tamamlanırsa yeni komut sürüm denetimiyle reddedilir ve özgün sonuç uzlaştırmada bildirilir).
      if (pend.newAllowedFor === fk) { supersede(w, op, pend); } // bu değerler için ikinci, bilinçli onay → aşağıda yeni komut oluşur
      else { pend.newAllowedFor = fk; setDErr(tt('Önceki gönderiminiz şu an sunucuda kayıtlı değil; henüz tamamlanmamış olabilir ve takibi sürüyor. Bu yeni değerleri ayrı bir işlem olarak göndermek için yeniden onaylayın; özgün işlem sonradan tamamlanırsa yeni işlem sürüm denetimiyle reddedilir.')); return; }
    }
    let body: Record<string, unknown>;
    if (pend && pend.key === fk) {
      body = pend.body; const u = typeof body.until === 'string' ? Date.parse(body.until) : NaN;
      if (Number.isFinite(u) && u <= Date.now()) { // özgün bitiş anı geçti: körlemesine yeniden yazılmaz; sonuç komut kaydından sorgulanır
        const o = await outcome(body); if (c !== ctx.current) return;
        if (o.r === 'applied') { settle(w, op, body); setDlg(null); setMsg(tt('Önceki gönderiminiz kaydedilmişti (komut kaydı sunucuda doğrulandı).')); await load(); return; }
        if (o.r === 'not_found') { // v2.11.5: yokluk okuma anına aittir — iş okunur; sürüm ilerlemişse özgün anahtar yeniden sorgulanır
          const cur2 = await readItem(w); if (c !== ctx.current) return;
          if (!cur2) { setDErr(tt('Özgün işlemin bitiş anı geçti; sonucu doğrulanamadı. Gönderiminiz belirsiz olarak saklanıyor; aynı değerlerle yeniden onaylayarak sonucu yeniden sorgulayabilirsiniz (yeniden yazılmaz).')); return; }
          if (cur2.version > Number(body.expectedVersion)) { const o3 = await outcome(body); if (c !== ctx.current) return;
            if (o3.r === 'applied') { settle(w, op, body); setDlg(null); setMsg(tt('Önceki gönderiminiz kaydedilmişti (komut kaydı sunucuda doğrulandı).')); await load(); return; }
            if (o3.r === 'unknown') { setDErr(tt('Özgün işlemin bitiş anı geçti; sonucu doğrulanamadı. Gönderiminiz belirsiz olarak saklanıyor; aynı değerlerle yeniden onaylayarak sonucu yeniden sorgulayabilirsiniz (yeniden yazılmaz).')); return; } }
          release(w, op, body); setDErr(tt('Özgün işlemin bitiş anı geçti ve işlem uygulanmadı (sunucuda komut kaydı yok); yeni bir tarih seçip yeniden onaylayın.')); return; }
        setDErr(tt('Özgün işlemin bitiş anı geçti; sonucu doğrulanamadı. Gönderiminiz belirsiz olarak saklanıyor; aynı değerlerle yeniden onaylayarak sonucu yeniden sorgulayabilirsiniz (yeniden yazılmaz).')); return;
      }
    } else { body = { expectedVersion: w.version }; if (op === 'snooze' || op === 'dismiss') { body.reason = reason; body.until = untilFor(date, op === 'dismiss' ? 30 : 90); } frozen.current = { key: fk, body, unknown: false, date, reason }; }
    const verify = async () => { const o = await outcomeOf(w, op, body); if (o.r === 'applied') return true; if (o.r === 'not_found') return false; throw new Error(tt('komut kaydı okunamadı')); };
    try { await commandApi(`/api/platform/work-items/${w.id}/${op}`, body, { verify }); settle(w, op, body); if (c !== ctx.current) return; setDlg(null); setMsg(tt('İşlem kaydedildi')); await load(); }
    catch (e) { const code = (e as { code?: string }).code;
      if (frozen.current) frozen.current.unknown = ['network', 'timeout', 'outcome_unknown', 'aborted', 'receipt_lost_unverified', 'receipt_lost_unreconciled'].includes(code ?? '');
      if (!frozen.current?.unknown) frozen.current = null; // kesin sonuç (başarı, çatışma, doğrulama hatası): sonraki onay yeni komuttur
      if (c !== ctx.current) return;
      if (code === 'receipt_lost') { settle(w, op, body); setDlg(null); setMsg(tt('İşlem daha önce kaydedilmişti (yanıt yolda kaybolmuştu); komut kaydı sunucuda doğrulandı.')); await load(); return; }
      if (code === 'work_item_taken' || code === 'version_conflict' || code === 'invalid_state') {
        // taslak pencerede korunur; güncel kayıt okunur ve kullanıcıya farkı gösterilir; kullanıcı incelediğini işaretlemeden yeni sürümle gönderim yapılmaz
        await load(); if (c !== ctx.current) return;
        let fresh: WI | null = null; try { const v = checkDto<Data>(await api('GET', `/api/platform/work-items?tenantId=${w.tenant_id}&evaluate=0`), DTO.workItems, '/platform/work-items'); fresh = v.items.find(x => x.id === w.id) ?? null; } catch { fresh = null; }
        if (c !== ctx.current) return;
        setDErr(code === 'work_item_taken' ? tt('Bu işi az önce başka biri üstlendi.') : tt('İş siz görüntüledikten sonra değişti.'));
        setDlg(d => d && d.w.id === w.id ? { ...d, review: { from: d.review?.to ?? d.w, to: fresh } } : d); return; }
      setDErr(describeError(e)); await load(); }
  };
  const today = new Date(); const dlgDate = dlg && (dlg.op === 'snooze' || dlg.op === 'dismiss') ? { label: dlg.op === 'dismiss' ? tt('Reddetme bitiş tarihi (en çok 30 gün; seçilen günün sonuna kadar, sınırı aşmadan)') : tt('Erteleme bitiş tarihi (en çok 90 gün; seçilen günün sonuna kadar, sınırı aşmadan)'), min: localDay(new Date(today.getTime() + 86400000)), max: localDay(new Date(today.getTime() + (dlg.op === 'dismiss' ? 30 : 90) * 86400000 - 60000)) } : null;
  const pendDlg = dlg ? pendingStore.get(`${userKey}|${dlg.w.tenant_id}|${dlg.w.id}|${dlg.op}`) : undefined; const pendOpen = !!pendDlg && pendDlg.unknown;
  const opLabel: Record<Op, string> = { claim: tt('Üstlen'), release: tt('Bırak'), snooze: tt('Ertele'), dismiss: tt('Reddet') };
  const failedCodes = (data?.evaluationFailures ?? []).map(f => data?.items.find(i => i.tenant_id === f.tenantId)?.tenant_code ?? data?.evaluations.find(e => e.tenant_id === f.tenantId)?.tenant_code ?? f.tenantId.slice(0, 8));
  const selEvals = fTenant && current ? (data!.evaluations).filter(e => e.tenant_id === fTenant) : [];
  return <div className="stack-4">
    <h2 className="h2">{tt('Bekleyen işler')}</h2>
    <p className="caption">{tt('Kurallar bu liste açıldığında değerlendirilir; arka planda düzenli çalışmaz. Zaman sütunu koşulun son başarılı doğrulandığı anı gösterir.')}</p>
    <div className="row filter-row">
      <div style={{ width: '24ch' }}><Field id="is-sirket" kind="select" label={tt('Şirket')} value={fTenant} onChange={e => setF('is_sirket', e.target.value)}><option value="">{tt('tümü')}</option>{tenants.map(([id, code]) => <option key={id} value={id}>{code}</option>)}{fTenant && !tenants.some(([id]) => id === fTenant) ? <option value={fTenant}>{fTenant.slice(0, 8)}</option> : null}</Field></div>
      <div style={{ width: '22ch' }}><Field id="is-durum" kind="select" label={tt('Durum')} value={fState} onChange={e => setF('is_durum', e.target.value)}><option value="">{tt('etkin işler')}</option><option value="open">{tt('açık')}</option><option value="claimed">{tt('üstlenildi')}</option><option value="snoozed">{tt('ertelendi')}</option><option value="dismissed">{tt('reddedildi')}</option><option value="tenant_inactive">{tt('şirket askıda')}</option><option value="resolved">{tt('kaynakta çözüldü')}</option></Field></div>
      <div style={{ width: '26ch' }}><Field id="is-kural" kind="select" label={tt('Kural')} value={fRule} onChange={e => setF('is_kural', e.target.value)}><option value="">{tt('tümü')}</option>{Object.entries(RULE_TR).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Field></div>
    </div>
    {err ? <div className="notice stack-1" role="alert"><p className="bold">{err}</p><button type="button" className="link caption" onClick={() => void load()}>{tt('Yeniden dene')}</button></div> : null}
    {failedCodes.length ? <p className="bold" role="alert">{tt('{0} şirketin kuralları şu anda değerlendirilemedi ({1}); bu şirketlerde son bilinen durum, zamanıyla gösteriliyor.', failedCodes.length, failedCodes.join(', '))}</p> : null}
    {data?.evaluationDeferred.length ? <p className="bold" role="status">{tt('{0} şirketin değerlendirmesi süre sınırı nedeniyle ertelendi; son bilinen durum gösteriliyor.', data.evaluationDeferred.length)}</p> : null}
    {evaluating ? <p className="caption" role="status">{tt('Kurallar değerlendiriliyor; tablo son bilinen durumu gösteriyor…')}</p> : null}
    {msg ? <p className="caption" role="status">{msg}</p> : null}
    {!current && !err ? <p className="caption" role="status">{tt('Yükleniyor…')}</p> : null}
    {current ? <div className="table-wrap"><table className="table"><caption className="sr-only">{tt('Bekleyen işler')}</caption><thead><tr><th scope="col">{tt('Şirket')}</th><th scope="col">{tt('Kural')}</th><th scope="col">{tt('Gerekçe')}</th><th scope="col">{tt('Durum')}</th><th scope="col">{tt('Son tarih')}</th><th scope="col">{tt('Güncellik')}</th><th scope="col"><span className="sr-only">{tt('İşlemler')}</span></th></tr></thead><tbody>
      {items.map(w => <Fragment key={w.id}><tr>
        <td className="bold">{w.tenant_code}</td><td>{RULE_TR[w.rule] ?? w.rule}{w.occurrence > 1 ? <span className="caption"> · {tt('{0}. kez', w.occurrence)}</span> : null}</td>
        <td className="caption">{evidenceText(w)}</td><td className="caption">{stateText(w)}</td><td className="caption">{d10(w.due_at)}</td><td className="caption">{freshText(w.eval_status, w.last_ok_eval_at, w.eval_error)}</td>
        <td><span className="row-actions">{(['claim', 'release', 'snooze', 'dismiss'] as Op[]).filter(op => w.can[op]).map(op => <button key={op} type="button" className="link caption" onClick={() => { setDErr(null); setMsg(null); const pp = pendingStore.get(`${userKey}|${w.tenant_id}|${w.id}|${op}`); if (pp) pp.newAllowedFor = undefined; /* yeniden açılışta yeni değerler için sonuç yeniden doğrulanır ve bilgi yeniden verilir */ setDlg({ w, op, ctx: ctx.current, at: Date.now() }); }}>{opLabel[op].toLocaleLowerCase(locale())}</button>)}<button type="button" className="link caption" aria-expanded={open === w.id} onClick={() => void openHist(w)}>{tt('geçmiş')}</button><Link className="link caption" to={`/platform/sirket/${w.tenant_id}?bolum=${SECTION[w.rule] ?? 'ozet'}`}>{tt('kaynağa git')}</Link></span></td>
      </tr>{open === w.id ? <tr><td colSpan={7}><div className="stack-1" aria-live="polite">{hist?.id === w.id && hist.err ? <p className="bold" role="alert">{hist.err}</p> : hist?.id === w.id && hist.rows ? <ol className="stack-1">{hist.rows.map(h => <li key={h.id} className="caption">{d10(h.occurred_at)} · {ACT_TR[h.action] ?? h.action} · {h.after && (h.after as { by?: string }).by === 'system' ? tt('sistem (kural değerlendirmesi; tetikleyen: {0})', h.actor_name ?? h.actor_email ?? '—') : (h.actor_name ?? h.actor_email ?? '—')}{h.reason && !(h.after && (h.after as { by?: string }).by === 'system') ? ` · ${tt('gerekçe')}: ${h.reason}` : ''}</li>)}</ol> : <p className="caption">{tt('Yükleniyor…')}</p>}</div></td></tr> : null}</Fragment>)}
      {items.length === 0 ? <tr><td colSpan={7} className="caption">{tt('Bu filtreye uyan iş yok')}</td></tr> : null}
    </tbody></table></div> : null}
    {selEvals.length ? <div className="stack-1"><h3 className="h3">{tt('Kural değerlendirmeleri (seçili şirket)')}</h3><ul className="stack-1">{selEvals.map(e => <li key={e.rule} className="caption">{RULE_TR[e.rule] ?? e.rule}: {e.active_item_state ? tt('sorun var ({0}) · {1}', STATE_SHORT[e.active_item_state] ?? e.active_item_state, freshText(e.status, e.last_ok_at, e.detail)) : e.status === 'ok' ? tt('sorun yok · {0}', freshText('ok', e.last_ok_at, null)) : freshText(e.status, e.last_ok_at, e.detail)}</li>)}</ul></div> : null}
    <ConfirmDialog key={dlg ? `${dlg.w.id}|${dlg.op}|${dlg.at ?? 0}` : 'kapali'} open={!!dlg} title={dlg ? tt('{0}: {1} — {2}', dlg.w.tenant_code, RULE_TR[dlg.w.rule] ?? dlg.w.rule, opLabel[dlg.op]) : ''} description={dlg ? (dlg.op === 'dismiss' ? tt('Reddetme, bu dönem için HPW takibinin gerekmediğini kaydeder; iş çözülmüş sayılmaz. Süre bitince sorun sürüyorsa aynı iş yeniden açılır.') : dlg.op === 'snooze' ? tt('Ertelenen iş tarih gelince, sorun sürüyorsa size (yetkiniz sürüyorsa) geri döner.') : dlg.op === 'claim' ? tt('Üstlenmek bu işin takibini size verir; müşteri tarafındaki aksiyon sahibini değiştirmez.') : tt('İş sahipsiz açık işe döner; yetkili kişiler üstlenebilir.')) : null} confirmLabel={dlg ? opLabel[dlg.op] : ''} reasonInitial={pendOpen ? pendDlg!.reason ?? '' : ''} dateBypass={(d, r) => pendOpen && pendDlg!.date === d && pendDlg!.reason === r} notice={pendOpen ? tt('Bu iş için sonucu henüz belirsiz bir gönderiminiz var (tarih {0}). Aynı değerlerle onaylarsanız aynı işlem aynı işlem anahtarıyla yeniden gönderilir ve ikinci kez uygulanmaz; değerleri değiştirirseniz önce sonucu doğrulanır.', pendDlg!.date ?? '—') : null} requireAck={dlg?.review?.to && dlg.review.to.can[dlg.op] ? tt('Güncel kaydı inceledim: durum {0} → {1}, sürüm {2} → {3}{4}. Taslağım korunarak bu sürümle yeniden onaylıyorum.', STATE_SHORT[dlg.review.from.state] ?? dlg.review.from.state, STATE_SHORT[dlg.review.to.state] ?? dlg.review.to.state, dlg.review.from.version, dlg.review.to.version, dlg.review.to.claimed_by_name ? tt(', üstlenen {0}', dlg.review.to.claimed_by_name) : '') : null} danger={dlg?.op === 'dismiss'} date={dlgDate ? { ...dlgDate, initial: pendOpen ? pendDlg!.date : undefined } : null} reason={dlg && (dlg.op === 'snooze' || dlg.op === 'dismiss') ? { label: tt('Gerekçe (zorunlu)'), minLength: 3 } : null} stale={dlg && dlg.ctx !== ctx.current ? tt('Onay sırasında liste değişti; işlem gönderilmedi') : dlg?.review && (!dlg.review.to || !dlg.review.to.can[dlg.op]) ? tt('Bu işlem güncel kayıtta artık yapılamaz (iş değişti ya da başkası üstlendi). Pencereyi kapatıp güncel satırı inceleyin.') : null} error={dErr} onConfirm={confirm} onCancel={() => setDlg(null)} />
  </div>;
}
