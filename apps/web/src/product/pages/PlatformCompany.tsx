/** v2.10.0 şirket detayı (gereksinimler §4.2; tasarım v2 5.4): Özet, Kurulum, Dönemler ve ilerleme, HPW sorumluları, Geçmiş.
 * Bölüm adres çubuğunda (?bolum=); yanıt, istek anındaki şirketle eşleşmiyorsa uygulanmaz; bütün yazmalar sürüm ve kanıt parmak izi denetimli,
 * onaylar erişilebilir pencereyle; pencere açıkken şirket değişirse gönderilmez. Şirket içi işler mevcut şirket ekranlarında kalır (ikinci düzenleyici yok). */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { tt, locale } from '../i18n';
import { api, commandApi, describeError } from '../api';
import { checkDto, DTO } from '../dto';
import { useMe } from '../App';
import { ConfirmDialog } from '../Dialog';
import { Field } from '../../components/Field';
import { Button } from '../../components/Button';
import { Kicker } from '../../components/Kicker';
import { AuditTab, STEP_TR, merkezUrl, transLabel, transInfo } from './Platform';
type Step = { key: string; no: number; state: string; owner: string; facts: Record<string, unknown>; blockedBy: string | null; approval: { by: string | null; at: string; reason: string } | null };
type Detail = { tenant: { id: string; code: string; name: string; status: string; status_reason: string | null; archived_at: string | null; tracked_cycle_id: string | null; ops_version: number; service_record: { ref: string; scope: string; owners: string; retentionPolicyRef: string } | null; service_record_at: string | null };
  onboarding: { steps: Step[]; summary: { done: number; total: number; firstOpen: string | null }; fingerprints: { service_record: string | null; go_live: string } };
  cycles: { id: string; code: string; name: string; period_start: string; period_end: string; active_batch_id: string | null; tracked: boolean }[];
  assignments: { user_id: string; display_name: string; duty: string; role: string | null }[]; recentEvents: { id: string; occurred_at: string; actor_email: string | null; action: string; reason: string | null }[];
  can: { setup: boolean; manage: boolean; approveServiceRecord: boolean; approveGoLive: boolean } };
export const STATE_TR: Record<string, string> = { not_started: tt('başlamadı'), in_progress: tt('devam ediyor'), blocked: tt('engelli'), done: tt('tamamlandı'), recheck: tt('yeniden kontrol gerekli') };
const OWNER_TR: Record<string, string> = { hpw_admin: tt('HPW yönetici'), hpw_customer: tt('HPW ve müşteri'), consultant_customer: tt('Danışman ve müşteri'), setup_methodology: tt('Kurulum/metodoloji rolü'), consultant: tt('Danışman'), existing_roles: tt('Mevcut yetkili roller'), customer_hr: tt('Müşteri İK') };
const DUTY_TR2: Record<string, string> = { admin_scope: tt('yönetici kapsamı'), primary: tt('ana danışman'), backup: tt('yedek danışman'), methodologist: tt('metodolog'), auditor: tt('denetçi') };
const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : '—');
function factText(s: Step): string {
  const f = s.facts as Record<string, never>;
  switch (s.key) {
    case 'identity': return tt('kod {0} · dil {1} · saat dilimi {2}', f.code, f.locale, f.timezone);
    case 'service_record': return f.recorded ? tt('kayıt {0} · saklama politikası {1}', f.ref, f.retentionPolicyRef) : tt('kayıt girilmedi');
    case 'hpw_owner': return f.primary ? tt('ana: {0}{1}', f.primary, f.backup ? tt(' · yedek: {0}', f.backup) : '') : tt('ana danışman atanmadı');
    case 'customer_admin': return Number(f.admins) === 0 ? tt('İK yöneticisi yok') : tt('{0} İK yöneticisi · son davet: {1}', f.admins, f.invitation ?? '—');
    case 'organization': return tt('{0} birim · {1} rol', f.units, f.roles);
    case 'instrument': return tt('{0} sürüm', f.versions);
    case 'first_cycle': return f.tracked ? tt('{0} dönem · izlenen: {1}', f.cycles, f.tracked) : tt('{0} dönem · izlenen dönem seçilmedi', f.cycles);
    case 'results': return f.trackedCycle ? tt('izlenen dönem {0} · son içe aktarma: {1}', f.trackedCycle, f.lastImport ?? '—') : tt('izlenen dönem yok');
    case 'user_access': return tt('{0} kabul · {1} açık · {2} başarısız', f.accepted, f.open, f.failed);
    case 'go_live': return !f.hpwApproved ? tt('HPW onayı yok') : f.customerConfirmed ? tt('HPW onayladı · müşteri {0} tarihinde teyit etti', d10(f.customerConfirmedAt)) : tt('HPW onayladı · müşteri teyidi bekleniyor');
    default: return '';
  }
}
type Dlg = { kind: 'status'; to: 'active' | 'suspended' | 'archived' } | { kind: 'approve'; step: 'service_record' | 'go_live' } | { kind: 'cycle'; cycleId: string | null } | null;
export function PlatformCompany() {
  const { tid = '' } = useParams(); const [sp, setSp] = useSearchParams(); const nav = useNavigate(); const { refresh } = useMe();
  const bolum = ['ozet', 'kurulum', 'donemler', 'sorumlular', 'gecmis'].includes(sp.get('bolum') ?? '') ? sp.get('bolum')! : 'ozet';
  // v2.10.1 (V210-01/03): okuma hatası (loadErr) ile işlem hatası (opErr) ayrı; form, taslak, ileti ve bekleyen işlem şirket bağlamına bağlı
  const [d, setD] = useState<Detail | null>(null); const [loadErr, setLoadErr] = useState<string | null>(null); const [opErr, setOpErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const [dlg, setDlg] = useState<Dlg>(null); const [dlgErr, setDlgErr] = useState<string | null>(null); const dlgTid = useRef(''); const gen = useRef(0); const cur = useRef(tid); cur.current = tid;
  const EMPTY_SR = { ref: '', scope: '', owners: '', retentionPolicyRef: '' };
  const [sr, setSr] = useState(EMPTY_SR); const [srBusy, setSrBusy] = useState(false); const [srConflict, setSrConflict] = useState(false); const srDirty = useRef(false);
  // v2.10.1 (V2101-01): ziyaret nesli (aynı şirkete geri dönüş eski ziyaretten ayrılır) ve taslak sürümü (gönderimden sonraki düzenleme eski yanıtla silinmez)
  const visit = useRef(0); const draftVer = useRef(0); const live = (t: string, v: number) => cur.current === t && visit.current === v;
  const editSr = (patch: Partial<typeof EMPTY_SR>) => { srDirty.current = true; draftVer.current++; setSr(v => ({ ...v, ...patch })); };
  /** yalnız hâlâ görüntülenen şirket için okur; başka şirkete geçildiyse eski işlemin tamamlanması okuma başlatmaz ve ortak istek neslini değiştirmez */
  const load = async (forTid = tid) => { if (forTid !== cur.current) return; const g = ++gen.current; setLoadErr(null);
    try { const v = checkDto<Detail>(await api('GET', `/api/platform/tenants/${forTid}`), DTO.platformTenantDetail, '/platform/tenants/:tid'); if (g !== gen.current || forTid !== cur.current) return; setD(v); if (!srDirty.current) setSr(v.tenant.service_record ?? EMPTY_SR); }
    catch (e) { if (g !== gen.current || forTid !== cur.current) return; if ((e as { code?: string }).code === 'mfa_required') { nav('/platform'); return; } setD(null); setLoadErr(describeError(e)); } };
  useEffect(() => { visit.current++; draftVer.current = 0; setD(null); setLoadErr(null); setOpErr(null); setMsg(null); setDlg(null); setDlgErr(null); srDirty.current = false; setSr(EMPTY_SR); setSrBusy(false); setSrConflict(false); void load(tid); }, [tid]);
  const go = (b: string) => { const n = new URLSearchParams(sp); n.set('bolum', b); setSp(n); };
  const openScreen = async () => { const t = tid; try { await api('POST', '/api/auth/switch-tenant', { tenantId: t }); await refresh(); if (cur.current === t) nav(`/t/${t}`); } catch (e) { if (cur.current === t) setOpErr(describeError(e)); } };
  const openDlg = (x: Dlg) => { dlgTid.current = tid; setDlgErr(null); setDlg(x); };
  const stale = dlg && dlgTid.current !== tid ? tt('Onay sırasında şirket değişti; işlem gönderilmedi') : null;
  const conflict = async (e: unknown, t: string) => { if (cur.current !== t) return; const code = (e as { code?: string }).code; setDlgErr(code === 'version_conflict' || code === 'evidence_changed' ? tt('Kayıt siz görüntüledikten sonra değişti; güncel hali yüklendi. İnceleyip yeniden deneyin.') : describeError(e)); await load(t); };
  const confirm = async ({ reason }: { reason: string }) => {
    if (!d || !dlg || dlgTid.current !== cur.current) return; const t = dlgTid.current; const v = visit.current;
    try {
      if (dlg.kind === 'status') await commandApi(`/api/platform/tenants/${t}/status`, { status: dlg.to, reason });
      if (dlg.kind === 'approve') await commandApi(`/api/platform/tenants/${t}/onboarding/${dlg.step}/approve`, { reason, expectedVersion: d.tenant.ops_version, expectedFingerprint: d.onboarding.fingerprints[dlg.step] ?? '' });
      if (dlg.kind === 'cycle') checkDto(await commandApi(`/api/platform/tenants/${t}/tracked-cycle`, { cycleId: dlg.cycleId, expectedVersion: d.tenant.ops_version }, { method: 'PATCH' }), DTO.versionResult, '/tracked-cycle');
      if (!live(t, v)) return; setMsg(tt('İşlem kaydedildi')); setDlg(null); await load(t);
    } catch (e) { if (!live(t, v)) return; await conflict(e, t); }
  };
  const saveSr = async () => { if (!d || srBusy) return; const t = tid; const v = visit.current; const sentVer = draftVer.current; const version = d.tenant.ops_version; if (Object.values(sr).some(x => !x.trim())) { setOpErr(tt('Hizmet kaydının bütün alanları zorunludur')); return; } setSrBusy(true); setOpErr(null); setMsg(null);
    try { await commandApi(`/api/platform/tenants/${t}/service-record`, { ...sr, expectedVersion: version }); if (!live(t, v)) return; setSrConflict(false);
      if (draftVer.current === sentVer) { srDirty.current = false; setMsg(tt('Hizmet kaydı kaydedildi; onay yeniden gerekiyorsa Kurulum adım 2 bunu gösterir')); }
      else setMsg(tt('Gönderdiğiniz kayıt kaydedildi. Gönderimden sonra yaptığınız değişiklikler formda duruyor ve henüz kaydedilmedi; kaydetmek için yeniden “Kaydı kaydet”e basın.'));
      await load(t); }
    catch (e) { if (!live(t, v)) return; const code = (e as { code?: string }).code; if (code === 'version_conflict') { setSrConflict(true); setOpErr(tt('Hizmet kaydı siz görüntüledikten sonra değişti; değişikliğiniz kaydedilmedi. Taslağınız formda korundu; aşağıda sunucudaki güncel kaydı görebilirsiniz. Taslağınızı yeniden kaydederseniz güncel kaydın yerine geçer.')); } else setOpErr(describeError(e)); await load(t); }
    finally { if (live(t, v)) setSrBusy(false); } };
  const discardDraft = () => { srDirty.current = false; setSrConflict(false); setOpErr(null); setSr(d?.tenant.service_record ?? EMPTY_SR); };
  const trans: ('active' | 'suspended' | 'archived')[] = !d?.can.manage ? [] : d.tenant.status === 'active' ? ['suspended'] : d.tenant.status === 'suspended' ? ['active', 'archived'] : ['suspended'];
  const tracked = d?.cycles.find(c => c.tracked) ?? null;
  const dlgTitle = !dlg || !d ? '' : dlg.kind === 'status' ? tt('{0}: {1}', d.tenant.name, transLabel(d.tenant.status, dlg.to)) : dlg.kind === 'approve' ? (dlg.step === 'go_live' ? tt('Kullanıma açılışı onayla') : tt('Hizmet ve veri yönetimi kaydını onayla')) : dlg.cycleId ? tt('İzlenen dönemi değiştir') : tt('İzlenen dönemi kaldır');
  const dlgDesc = !dlg || !d ? null : dlg.kind === 'status' ? transInfo(dlg.to) : dlg.kind === 'approve' ? (dlg.step === 'go_live' ? tt('1–9. adımlar sunucuda yeniden doğrulanır. Onayınız şu anki kurulum kanıtına bağlanır; kanıt değişirse adım “yeniden kontrol gerekli” olur. Adımın tamamlanması için müşterinin İK yöneticisi kendi hesabıyla teyit etmelidir.') : tt('Onay, kaydın şu anki içeriğine bağlanır; kayıt değişirse yeniden onay gerekir. Bu onay hukuki uygunluk kanıtı değildir.')) : dlg.cycleId ? tt('Döneme bağlı göstergeler ({0}) yalnız bu dönemden hesaplanır.', d.cycles.find(c => c.id === dlg.cycleId)?.code ?? '') : tt('İzlenen dönem kaldırılırsa döneme bağlı göstergeler gösterilmez.');
  const back = merkezUrl();
  return <div className="tb"><main><section className="section surface-white"><div className="container stack-4">
    <nav className="row row--between" aria-label={tt('Konum')}><Link className="link" to={back}>{tt('← Merkeze dön')}</Link>{d && d.tenant.status !== 'archived' ? <button type="button" className="link" onClick={openScreen}>{tt('Şirket ekranını aç')}</button> : null}</nav>
    {loadErr ? <div className="notice stack-1" role="alert"><p className="bold">{loadErr}</p><button type="button" className="link caption" onClick={() => load()}>{tt('Yeniden dene')}</button></div> : null}
    {opErr ? <div className="notice stack-1" role="alert"><p className="bold">{opErr}</p></div> : null}
    {!d && !loadErr ? <p className="caption" role="status">{tt('Yükleniyor…')}</p> : null}
    {d ? <>
      <Kicker>{d.tenant.code} · {STATE_LABEL(d.tenant.status)}</Kicker><h1 className="h1">{d.tenant.name}</h1>
      <div className="tab-row" role="tablist" aria-label={tt('Şirket bölümleri')}>{([['ozet', tt('Özet')], ['kurulum', tt('Kurulum')], ['donemler', tt('Dönemler ve ilerleme')], ['sorumlular', tt('HPW sorumluları')], ['gecmis', tt('Geçmiş')]] as [string, string][]).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={bolum === k} className={`tab-btn${bolum === k ? ' tab-btn--on' : ''}`} onClick={() => go(k)}>{l}</button>)}</div>
      {msg ? <p className="caption" role="status">{msg}</p> : null}
      {bolum === 'ozet' ? <div className="stack">
        <p className="body-l">{tt('Durum: {0}', STATE_LABEL(d.tenant.status))}{d.tenant.status_reason && d.tenant.status !== 'active' ? ` · ${d.tenant.status_reason}` : ''}</p>
        <p className="body-l">{tracked ? tt('İzlenen dönem: {0} ({1} – {2})', tracked.code, d10(tracked.period_start), d10(tracked.period_end)) : <span className="bold">{tt('İzlenen dönem seçilmedi: döneme bağlı göstergeler (aksiyon, gecikme, doğrulama) gösterilmez.')}</span>}</p>
        <p className="body-l">{tt('Kurulum: {0}/{1} adım tamamlandı', d.onboarding.summary.done, d.onboarding.summary.total)}{d.onboarding.summary.firstOpen ? tt(' · ilk açık adım: {0}', STEP_TR[d.onboarding.summary.firstOpen] ?? d.onboarding.summary.firstOpen) : ''}</p>
        <p className="caption">{tt('Kurulum ilerlemesi kurulumun durumudur; şirketin gelişim puanı değildir.')}</p>
        {trans.length ? <div className="row-actions">{trans.map(to => <Button key={to} variant={to === 'active' ? 'primary' : 'secondary'} onClick={() => openDlg({ kind: 'status', to })}>{transLabel(d.tenant.status, to)}</Button>)}</div> : null}
      </div> : null}
      {bolum === 'kurulum' ? <div className="stack">
        <div className="table-wrap"><table className="table"><caption className="sr-only">{tt('On adımlı kurulum')}</caption><thead><tr><th scope="col">#</th><th scope="col">{tt('Adım')}</th><th scope="col">{tt('Durum')}</th><th scope="col">{tt('Kanıt')}</th><th scope="col">{tt('İş sahibi')}</th><th scope="col"><span className="sr-only">{tt('İşlem')}</span></th></tr></thead><tbody>
          {d.onboarding.steps.map(s => <tr key={s.key}><td className="num">{s.no}</td><td>{STEP_TR[s.key] ?? s.key}</td><td className="step-state">{STATE_TR[s.state] ?? s.state}{s.blockedBy ? <span className="caption"> · {tt('önce: {0}', STEP_TR[s.blockedBy] ?? s.blockedBy)}</span> : null}</td><td className="caption">{factText(s)}{s.approval ? tt(' · onay {0}: {1}', d10(s.approval.at), s.approval.reason) : ''}</td><td className="caption">{OWNER_TR[s.owner] ?? s.owner}</td>
            <td>{s.key === 'service_record' && d.can.approveServiceRecord && d.tenant.service_record && s.state !== 'done' ? <Button onClick={() => openDlg({ kind: 'approve', step: 'service_record' })}>{tt('Onayla')}</Button> : s.key === 'go_live' && d.can.approveGoLive && (s.state === 'not_started' || s.state === 'recheck') && d.onboarding.steps.slice(0, 9).every(x => x.state === 'done') ? <Button onClick={() => openDlg({ kind: 'approve', step: 'go_live' })}>{tt('Onayla')}</Button> : null}</td></tr>)}
        </tbody></table></div>
        {d.can.approveServiceRecord ? <form className="stack" onSubmit={e => { e.preventDefault(); void saveSr(); }} aria-labelledby="sr-h"><h2 className="h3" id="sr-h">{tt('Hizmet ve veri yönetimi kaydı')}</h2>
          <Field id="sr-ref" label={tt('Kayıt referansı')} value={sr.ref} onChange={e => editSr({ ref: e.target.value })} required />
          <Field id="sr-scope" label={tt('Kapsam')} value={sr.scope} onChange={e => editSr({ scope: e.target.value })} required />
          <Field id="sr-owners" label={tt('Sorumlular (HPW ve müşteri)')} value={sr.owners} onChange={e => editSr({ owners: e.target.value })} required />
          <Field id="sr-ret" label={tt('Saklama politikası sürümü')} value={sr.retentionPolicyRef} onChange={e => editSr({ retentionPolicyRef: e.target.value })} required />
          {srConflict && d.tenant.service_record ? <div className="notice stack-1"><p className="caption">{tt('Sunucudaki güncel kayıt: {0} · {1} · {2} · {3}', d.tenant.service_record.ref, d.tenant.service_record.scope, d.tenant.service_record.owners, d.tenant.service_record.retentionPolicyRef)}</p><button type="button" className="link caption" onClick={discardDraft}>{tt('Taslağı bırak, güncel kaydı forma yükle')}</button></div> : null}
          <div><Button type="submit" disabled={srBusy}>{srBusy ? tt('Gönderiliyor…') : tt('Kaydı kaydet')}</Button></div>
          <p className="caption">{tt('Saklama süresi ve başlangıcı sözleşme ve veri kategorisine göre belirlenir; panel yalnız politika referansını saklar. Kayıt hukuki uygunluk kanıtı sayılmaz.')}</p></form> : null}
      </div> : null}
      {bolum === 'donemler' ? <div className="stack">
        {!tracked ? <p className="bold" role="status">{tt('İzlenen dönem seçilmedi. En yeni dönem otomatik olarak izlenen dönem sayılmaz.')}</p> : null}
        <div className="table-wrap"><table className="table"><caption className="sr-only">{tt('Dönemler')}</caption><thead><tr><th scope="col">{tt('Kod')}</th><th scope="col">{tt('Ad')}</th><th scope="col">{tt('Dönem')}</th><th scope="col">{tt('Sonuç')}</th><th scope="col">{tt('İzlenen')}</th><th scope="col"><span className="sr-only">{tt('İşlem')}</span></th></tr></thead><tbody>
          {d.cycles.map(c => <tr key={c.id}><td className="bold">{c.code}</td><td>{c.name}</td><td className="caption">{d10(c.period_start)} – {d10(c.period_end)}</td><td className="caption">{c.active_batch_id ? tt('yayımlı') : tt('yayımlanmadı')}</td><td>{c.tracked ? tt('izlenen dönem') : '—'}</td><td>{d.can.setup ? (c.tracked ? <Button variant="secondary" onClick={() => openDlg({ kind: 'cycle', cycleId: null })}>{tt('İzlemeyi kaldır')}</Button> : <Button onClick={() => openDlg({ kind: 'cycle', cycleId: c.id })}>{tt('İzlenen dönem yap')}</Button>) : null}</td></tr>)}
          {d.cycles.length === 0 ? <tr><td colSpan={6} className="caption">{tt('Bu şirkette dönem yok')}</td></tr> : null}
        </tbody></table></div>
      </div> : null}
      {bolum === 'sorumlular' ? <div className="stack">
        <div className="table-wrap"><table className="table"><caption className="sr-only">{tt('HPW sorumluları')}</caption><thead><tr><th scope="col">{tt('Ad')}</th><th scope="col">{tt('Görev')}</th></tr></thead><tbody>
          {d.assignments.map(a => <tr key={a.user_id}><td>{a.display_name}</td><td>{DUTY_TR2[a.duty] ?? a.duty}</td></tr>)}
          {d.assignments.length === 0 ? <tr><td colSpan={2} className="caption">{tt('Bu şirkette HPW ataması yok')}</td></tr> : null}</tbody></table></div>
        {d.can.manage ? <Link className="link" to={`/platform?sekme=ekip&sirket=${d.tenant.id}`}>{tt('Ata ya da devret (Ekip ve erişim)')}</Link> : null}
      </div> : null}
      {bolum === 'gecmis' ? <AuditTab fixedTenant={d.tenant.id} /> : null}
    </> : null}
    <ConfirmDialog open={!!dlg} title={dlgTitle} description={dlgDesc} confirmLabel={dlg?.kind === 'status' && d ? transLabel(d.tenant.status, dlg.to) : dlg?.kind === 'cycle' ? tt('Kaydet') : tt('Onayla')} danger={dlg?.kind === 'status' && dlg.to !== 'active'} reason={dlg?.kind === 'cycle' ? null : { label: tt('Gerekçe (zorunlu)'), minLength: 3 }} stale={stale} error={dlgErr} onConfirm={confirm} onCancel={() => setDlg(null)} />
  </div></section></main></div>;
}
function STATE_LABEL(s: string) { return s === 'suspended' ? tt('durdurulmuş') : s === 'archived' ? tt('arşivlenmiş') : tt('aktif'); }
