import { tt, LANG, setLang, locale, type Lang } from './i18n';
import { Component, useEffect, useState, createContext, useContext, type ReactNode } from 'react';
import { checkDto, DTO } from './dto';
import { Routes, Route, Navigate, NavLink, useNavigate, useParams, useLocation } from 'react-router-dom';
import { api, commandApi, setReauthProvider, type Me, setCommandContext, clearIntents, SESSION_EVENT, errorKind, describeError } from './api';
import { usePerms, type Screen, type PlatformPerm } from './permissions';
import { Login, InviteAccept, PasswordReset } from './pages/Auth';
import { Platform, merkezUrl } from './pages/Platform';
import { PlatformCompany } from './pages/PlatformCompany';
import { Overview, Organization, QuestionSet, Cycles, Users, ImportPage, CorporateDetail } from './pages/Setup';
import { UnitResults, Targets, Actions, Followup, Attention } from './pages/ChainB';
import { Roadmap, RoadmapRoute } from './pages/Roadmap';
import { V3Routes } from './v3/Shell';

export const MeCtx = createContext<{ me: Me | null; refresh: () => Promise<void> }>({ me: null, refresh: async () => {} });
export const useMe = () => useContext(MeCtx);

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  // v3.0 (ADR-0043): sunucu kapalı modüller anahtarına göre arayüz kipini bildirir; yanıt yoksa eski arayüz (test düzenekleri)
  const [mode, setMode] = useState<'v3' | 'legacy' | undefined>(undefined);
  useEffect(() => { api<{ mode?: string }>('GET', '/api/public/app').then(r => setMode(r && (r as { mode?: string }).mode === 'v3' ? 'v3' : 'legacy')).catch(() => setMode('legacy')); }, []);
  const nav0 = useNavigate();
  const refresh = async () => { try { const m = checkDto<Me>(await api<Me>('GET', '/api/auth/me'), DTO.me, '/auth/me'); setCommandContext(m.userId, m.tenantId); setMe(m); } catch { setCommandContext(null, null); setMe(null); } };
  useEffect(() => { void refresh(); }, []);
  // v2.9.0: HPW personelinde hassas işlem yeniden doğrulaması (doğrulama uygulaması kodu)
  useEffect(() => { if (me?.realm !== 'platform' || mode === 'v3') { setReauthProvider(null); return; } setReauthProvider(async () => { const code = prompt(tt('Güvenlik için doğrulama uygulamanızdaki 6 haneli kodu girin')); if (code === null) return false; if (!/^\d{6}$/.test(code.trim())) { alert(tt('Kod 6 haneli olmalıdır')); return false; } try { await api('POST', '/api/auth/reauth', { code: code.trim() }); return true; } catch (e) { alert(describeError(e)); return false; } }); }, [me?.realm, mode]);
  // F10: oturum sonu — herhangi bir istekte 401 gelirse oturum kapanır, bekleyen niyetler temizlenir ve giriş ekranına açıklamayla dönülür
  useEffect(() => { const h = () => { clearIntents(); setCommandContext(null, null); setMe(null); nav0('/giris?oturum=doldu', { replace: true }); }; window.addEventListener(SESSION_EVENT, h); return () => window.removeEventListener(SESSION_EVENT, h); }, []);
  if (me === undefined || mode === undefined) return <main className="section surface-white"><div className="container"><p className="caption">{tt("Yükleniyor…")}</p></div></main>;
  if (mode === 'v3') return <MeCtx.Provider value={{ me, refresh }}><V3Routes /></MeCtx.Provider>;
  return (
    <MeCtx.Provider value={{ me, refresh }}>
      <Routes>
        <Route path="/davet/:token" element={<InviteAccept />} />
        <Route path="/parola" element={<PasswordReset />} /><Route path="/parola/:token" element={<PasswordReset />} />
        <Route path="/giris" element={me ? <Navigate to={me.realm === 'platform' ? '/platform' : `/t/${me.tenantId}`} /> : <Login />} />
        <Route path="/platform" element={me?.realm === 'platform' ? <ScreenBoundary resetKey="platform"><Platform /></ScreenBoundary> : <Navigate to="/giris" />} />
        <Route path="/platform/sirket/:tid" element={me?.realm === 'platform' ? <ScreenBoundary resetKey="platform-sirket"><PlatformCompany /></ScreenBoundary> : <Navigate to="/giris" />} />
        <Route path="/t/:tid/*" element={me ? <TenantShell /> : <Navigate to="/giris" />} />
        <Route path="*" element={<Navigate to="/giris" />} />
      </Routes>
    </MeCtx.Provider>
  );
}
const NAV: { to: string; label: string; screen: Screen }[] = [
  { to: '', label: tt("Genel bakış"), screen: 'genel' }, { to: 'dikkat', label: tt("Dikkat"), screen: 'dikkat' }, { to: 'organizasyon', label: tt("Organizasyon"), screen: 'organizasyon' }, { to: 'soru-seti', label: tt("Soru seti"), screen: 'soruSeti' }, { to: 'donemler', label: tt("Dönemler ve sonuçlar"), screen: 'donemler' }, { to: 'kullanicilar', label: tt("Kullanıcılar"), screen: 'kullanicilar' }, { to: 'birimler', label: tt("Birim sonuçları"), screen: 'birimler' }, { to: 'hedefler', label: tt("Hedefler"), screen: 'hedefler' }, { to: 'aksiyonlar', label: tt("Aksiyonlar ve kanıt"), screen: 'aksiyonlar' }, { to: 'takip', label: tt("Takip ölçümü"), screen: 'takip' }, { to: 'yol-haritasi', label: tt("Yol haritası"), screen: 'yolHaritasi' },
];
/** v2.9.0 HPW bağlam satırı (tasarım v2 5.9): şirket ekranında HPW personeli; rol, yetki ve müdahale modu */
export const PLATFORM_ROLE_TR: Record<string, string> = { admin: tt('HPW Sistem Yöneticisi'), consultant: tt('HPW Danışmanı'), methodologist: tt('HPW Metodoloğu'), auditor: tt('HPW Denetçisi') };
function PlatformBar({ tid, tenantName, pl }: { tid: string; tenantName: string; pl: PlatformPerm }) {
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const caps = pl.capabilities; const w = (c: string) => caps.includes(c as never);
  const rights = [w('setup') ? tt('kurulum (yazma)') : tt('kurulum (yalnız okuma)'), w('methodology') ? tt('metodoloji (yazma)') : null, w('business') ? tt('işletme (müdahale modunda yazma)') : tt('işletme (yalnız okuma)')].filter(Boolean).join(', ');
  const start = async () => { const reason = prompt(tt('Müdahale gerekçesi (en az 20 karakter; vazgeçmek için İptal). Süre boyunca müşterinin işletme kararlarını yazabilirsiniz; her işlem kayıt altına alınır ve şirketin İK yöneticisi görür.')); if (reason === null) return; if (reason.trim().length < 20) { setErr(tt('Gerekçe en az 20 karakter olmalıdır; müdahale başlatılmadı')); return; } const m = prompt(tt('Süre (dakika): 15, 30 ya da 60'), '15'); if (m === null) return; const minutes = Number(m); if (![15, 30, 60].includes(minutes)) { setErr(tt('Süre 15, 30 ya da 60 dakika olmalıdır')); return; } setBusy(true); setErr(null); try { await commandApi(`/api/platform/tenants/${tid}/intervention`, { reason: reason.trim(), minutes }); window.location.reload(); } catch (e) { setErr(describeError(e)); } finally { setBusy(false); } };
  const end = async () => { if (!pl.intervention) return; setBusy(true); try { await commandApi(`/api/platform/interventions/${pl.intervention.id}/end`, {}); window.location.reload(); } catch (e) { setErr(describeError(e)); } finally { setBusy(false); } };
  const endsAt = pl.intervention ? new Date(pl.intervention.endsAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : '';
  return <div className="container" role="region" aria-label={tt('HPW bağlamı')}>
    {pl.intervention?.mine ? <div className="intervention-strip" role="status"><span className="bold">{tt('Müdahale modu açık')}</span> · {tt('bitiş {0}', endsAt)} · {tt('yaptığınız her işlem kayıt altına alınıyor')} <button type="button" className="link" onClick={end} disabled={busy}>{tt('Müdahaleyi bitir')}</button></div> : null}
    <p className="caption platform-bar">{tt('HPW Merkezi olarak görüntülüyorsunuz')} · {tt('Şirket:')} {tenantName} · {tt('Rolünüz:')} {PLATFORM_ROLE_TR[pl.role ?? ''] ?? '—'} · {tt('Yetkiniz:')} {rights}{pl.tenantStatus !== 'active' ? <> · <span className="bold">{tt('Şirket durdurulmuş: HPW yalnız okuyabilir')}</span></> : null}{' '}· <NavLink className="link" to={merkezUrl()}>{tt('Merkeze dön')}</NavLink>{pl.role === 'admin' && pl.tenantStatus === 'active' && !pl.intervention ? <> · <button type="button" className="link" onClick={start} disabled={busy}>{tt('Müdahale modunu aç')}</button></> : null}</p>
    {err ? <p className="bold" role="alert">{err}</p> : null}
  </div>;
}
/** Dil seçici: iki ayrı düğme; seçili olan yalnız renkle ayrılır (sembol, boyut değişimi yok). Seçim tarayıcıda saklanır ve sayfa yeniden yüklenir. */
export function LangSwitch() { return <span className="lang-switch" role="group" aria-label={tt('Dil')}>{(['tr', 'en'] as Lang[]).map(l => <button key={l} type="button" className={`lang-btn${LANG === l ? ' lang-btn--on' : ''}`} aria-pressed={LANG === l} onClick={() => setLang(l)}>{l === 'tr' ? 'TR' : 'EN'}</button>)}</span>; }
/** N03: beklenmeyen çizim hatasına karşı son savunma (asıl koruma DTO doğrulamasıdır): ekran boşalmaz, açıklama ve yeniden dene gösterilir */
export class ScreenBoundary extends Component<{ children: ReactNode; resetKey: string }, { err: string | null; key: string }> { state = { err: null as string | null, key: '' }; static getDerivedStateFromError(e: Error) { return { err: e?.message ?? tt("bilinmeyen hata") }; } static getDerivedStateFromProps(p: { resetKey: string }, s: { err: string | null; key: string }) { return p.resetKey !== s.key ? { err: null, key: p.resetKey } : null; } render() { return this.state.err ? <main className="section surface-white"><div className="container stack"><p className="h2">{tt("Bu ekran gösterilemedi.")}</p><p className="caption">{tt("Beklenmeyen bir durum oluştu (")}{this.state.err}{tt("). Sayfayı yeniden deneyin; sorun sürerse sistem yöneticisine bildirin.")}</p><button className="link" onClick={() => this.setState({ err: null })}>{tt("Yeniden dene")}</button></div></main> : this.props.children; } }
/** F04: doğrudan adres erişimi — rolün açamayacağı ekran içerik yerine açıklama gösterir (sunucu zaten reddeder) */
function Guard({ ok, children }: { ok: boolean; children: ReactNode }) { const { tid } = useParams(); return ok ? <>{children}</> : <main className="section surface-white"><div className="container stack"><p className="h2">{tt("Bu ekran rolünüz için açık değil.")}</p><p className="caption">{tt("Menüde görünmeyen ekranlara doğrudan adresle de erişilemez. Bu işe ihtiyacınız varsa şirketinizin İK yöneticisine başvurun.")}</p><NavLink className="link" to={`/t/${tid}`}>{tt("Genel bakışa dön")}</NavLink></div></main>; }
function ImportGuard({ perms }: { perms: ReturnType<typeof usePerms> }) { const { kind } = useParams(); return <Guard ok={kind === 'users' ? perms.screen('kullanicilar') : perms.screen('yukle')}><ImportPage /></Guard>; }
function TenantShell() {
  const loc = useLocation(); const { me, refresh } = useMe(); const { tid } = useParams(); const nav = useNavigate();
  const [ov, setOv] = useState<{ tenant: { name: string; code: string }; principal: { profile: string; companyWide?: boolean }; env?: string } | null>(null);
  const [err, setErr] = useState<{ kind: string; message: string } | null>(null); const [attempt, setAttempt] = useState(0);
  useEffect(() => { let live = true; setErr(null); api<typeof ov>('GET', `/api/t/${tid}/overview`).then(o => { if (live) setOv(checkDto<typeof ov>(o, DTO.overview, '/overview')); }).catch(e => { if ((e as { code?: string }).code === 'mfa_required') { nav('/platform'); return; } if (live && errorKind(e) !== 'session') setErr({ kind: errorKind(e), message: describeError(e) }); }); return () => { live = false; }; }, [tid, attempt]);
  const PROFILE_TR: Record<string, string> = { HR_ADMIN: tt('İK Yöneticisi'), HR_PARTNER: tt('İK İş Ortağı'), EXEC: tt('Üst Yönetim'), REGION_MANAGER: tt('Bölge Müdürü'), UNIT_MANAGER: tt('Birim Müdürü'), ACTION_OWNER: tt('Aksiyon Sorumlusu'), VIEWER: tt('İzleyici') }; const profileCode = ov?.principal.profile ?? me?.profile ?? 'VIEWER'; const profile = PROFILE_TR[String(profileCode)] ?? profileCode; // Türkçe arayüzde kod gösterilmez
  const perms = usePerms(String(tid), null, ov?.principal.profile ?? me?.profile ?? null);
  const logout = async () => { try { await api('POST', '/api/auth/logout'); } catch { /* oturum zaten bitmiş olabilir */ } clearIntents(); await refresh(); nav('/giris'); };
  if (err) return <main className="section surface-white"><div className="container stack">{['forbidden', 'not_found'].includes(err.kind) ? <><p className="h2">{tt("Bu şirkete erişiminiz yok.")}</p><p className="caption">{err.message}</p></> : <><p className="h2">{tt("Şirket bilgileri şu an yüklenemedi.")}</p><p className="caption">{err.message}</p><button className="link" onClick={() => setAttempt(a => a + 1)}>{tt("Yeniden dene")}</button></>}<button className="link" onClick={logout}>{tt("Çıkış")}</button></div></main>;
  return (
    <div className="tb">
      <header className="tb-shell-head">
        <p className="logo">Happy Place to Work® <b>Act</b></p>
        <p className="who">{ov?.env && ov.env !== 'production' ? <span className="bold">[{ov.env.toLocaleUpperCase(LANG === 'en' ? 'en-GB' : 'tr-TR')}] </span> : null}{ov?.tenant.name ?? ''} · {ov?.tenant.code ?? ''} · {me?.displayName} · {profile}{ov?.principal.companyWide === false ? tt(" (kapsamlı)") : ''}{me?.realm === 'platform' ? <> · <NavLink className="link" to="/platform">{tt("Müşteriler")}</NavLink></> : null}{me?.realm === 'customer' && (me.memberships?.length ?? 0) > 1 ? <> · <select className="caption" value={tid} onChange={async e => { const t = e.target.value; try { await api('POST', '/api/auth/switch-tenant', { tenantId: t }); await refresh(); nav(`/t/${t}`); } catch { setErr({ kind: 'forbidden', message: tt("Bu şirkete geçiş yetkiniz yok") }); } }}>{me.memberships!.map(m => <option key={m.tenant_id} value={m.tenant_id}>{m.tenant_name}</option>)}</select></> : null} · <button type="button" className="link" onClick={logout}>{tt("Çıkış")}</button> <LangSwitch /></p>
      </header>
      <nav className="tb-shell-nav" aria-label={tt('Ana menü')}>
        {NAV.filter(n => perms.screen(n.screen)).map(n => <NavLink key={n.to} to={`/t/${tid}/${n.to}`} end={n.to === ''} className={({ isActive }) => isActive ? 'on' : ''}>{n.label}</NavLink>)}
      </nav>
      {me?.realm === 'platform' && perms.platform ? <PlatformBar tid={String(tid)} tenantName={ov?.tenant.name ?? ''} pl={perms.platform} /> : null}
      <ScreenBoundary resetKey={loc.pathname}>
      <Routes>
        <Route index element={<Overview />} /><Route path="kurumsal" element={<Guard ok={perms.companyWide || !!perms.platform}><CorporateDetail /></Guard>} /><Route path="dikkat" element={<Guard ok={perms.screen('dikkat')}><Attention /></Guard>} /><Route path="organizasyon" element={<Guard ok={perms.screen('organizasyon')}><Organization /></Guard>} /><Route path="soru-seti" element={<Guard ok={perms.screen('soruSeti')}><QuestionSet /></Guard>} /><Route path="donemler" element={<Guard ok={perms.screen('donemler')}><Cycles /></Guard>} /><Route path="kullanicilar" element={<Guard ok={perms.screen('kullanicilar')}><Users /></Guard>} /><Route path="yukle/:kind" element={<ImportGuard perms={perms} />} />
        <Route path="birimler" element={<Guard ok={perms.screen('birimler')}><UnitResults /></Guard>} /><Route path="hedefler" element={<Guard ok={perms.screen('hedefler')}><Targets /></Guard>} /><Route path="aksiyonlar" element={<Guard ok={perms.screen('aksiyonlar')}><Actions /></Guard>} /><Route path="takip" element={<Guard ok={perms.screen('takip')}><Followup /></Guard>} /><Route path="yol-haritasi" element={<Guard ok={perms.screen('yolHaritasi')}><Roadmap /></Guard>} /><Route path="yol-haritasi/:rid" element={<Guard ok={perms.screen('yolHaritasi')}><RoadmapRoute /></Guard>} />
      </Routes>
      </ScreenBoundary>
    </div>
  );
}
