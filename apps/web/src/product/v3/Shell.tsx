/** v3.0 kabuk: üst bant, sekmeler, rotalar. Bütün roller aynı mantık: "Bugün" (kendi adımları) → "Planlar" (iki bölme + plan kartları). */
import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate, useParams, useLocation } from 'react-router-dom';
import { tt, LANG, setLang, type Lang } from '../i18n';
import { api, clearIntents, describeError, errorKind } from '../api';
import { useMe, ScreenBoundary } from '../App';
import { InviteAccept, PasswordReset } from '../pages/Auth';
import { Login3 } from './Login';
import { Today } from './Today';
import { Plans } from './Plans';
import { People } from './People';
import { Companies, CompanySetup } from './Hpw';
import { Help } from './parts';

export const PROFILE_LABEL = (p: string | null | undefined) => ({ HR_ADMIN: tt('İnsan Kaynakları yöneticisi'), HR_PARTNER: tt('İnsan Kaynakları'), EXEC: tt('Üst yönetim'), REGION_MANAGER: tt('Bölge müdürü'), UNIT_MANAGER: tt('Birim müdürü'), VIEWER: tt('İzleyici') } as Record<string, string>)[p ?? ''] ?? tt('İzleyici');
/** Kendi adımı olan profiller: "Bugün" sekmesi yalnız bunlarda görünür */
export const OWN_PROFILES = ['HR_ADMIN', 'HR_PARTNER', 'EXEC', 'UNIT_MANAGER', 'REGION_MANAGER'];
/** Planlarda kişinin kendi rolü (önce gösterilir): İK → IK; üst yönetim → kurum yönetimi; birim/bölge müdürü → işletme yönetimi */
export function ownRole(profile: string | null | undefined, layer: 'KURUM' | 'ISLETME'): 'IK' | 'YONETIM' | null {
  if (profile === 'HR_ADMIN' || profile === 'HR_PARTNER') return 'IK';
  if (profile === 'EXEC') return layer === 'KURUM' ? 'YONETIM' : null;
  if (profile === 'UNIT_MANAGER' || profile === 'REGION_MANAGER') return layer === 'ISLETME' ? 'YONETIM' : null;
  return null;
}

export function Header({ company, children, actions }: { company?: string | null; children?: React.ReactNode; actions?: React.ReactNode }) {
  return <header className="v-hdr"><div className="v-hdr-in">
    <p className="v-brand">{company ? <><b>{company}</b><span className="v-sep">·</span></> : null}HPW Act</p>
    {children}
    <span className="v-langs" role="group" aria-label={tt('Dil')}>{(['tr', 'en'] as Lang[]).map(l => <button key={l} type="button" className="v-opt" aria-pressed={LANG === l} onClick={() => setLang(l)}>{l === 'tr' ? 'TR' : 'EN'}</button>)}</span>
    {actions ? <span className="v-acts">{actions}</span> : null}
  </div></header>;
}

export function useLogout() {
  const { refresh, me } = useMe(); const nav = useNavigate();
  return async () => { let code: string | null = null; try { code = localStorage.getItem('hpwact.v3.company'); } catch { /* yok */ } try { await api('POST', '/api/auth/logout'); } catch { /* oturum zaten bitmiş olabilir */ } clearIntents(); await refresh(); nav(me?.realm === 'customer' && code ? `/g/${code}` : '/giris'); };
}

export function V3Routes() {
  const { me } = useMe();
  return <Routes>
    <Route path="/davet/:token" element={<InviteAccept />} />
    <Route path="/parola" element={<PasswordReset />} /><Route path="/parola/:token" element={<PasswordReset />} />
    <Route path="/g/:code" element={me ? <Navigate to={me.realm === 'platform' ? '/platform' : `/t/${me.tenantId}`} /> : <Login3 />} />
    <Route path="/giris" element={me ? <Navigate to={me.realm === 'platform' ? '/platform' : `/t/${me.tenantId}`} /> : <Login3 />} />
    <Route path="/platform" element={me?.realm === 'platform' ? <ScreenBoundary resetKey="v3-platform"><Companies /></ScreenBoundary> : <Navigate to="/giris" />} />
    <Route path="/platform/sirket/:tid" element={me?.realm === 'platform' ? <ScreenBoundary resetKey="v3-sirket"><CompanySetup /></ScreenBoundary> : <Navigate to="/giris" />} />
    <Route path="/t/:tid/*" element={me ? <TenantShell3 /> : <Navigate to="/giris" />} />
    <Route path="*" element={<Navigate to="/giris" />} />
  </Routes>;
}

interface Overview { tenant: { name: string; code: string }; principal: { profile: string; companyWide?: boolean } }
function TenantShell3() {
  const { me, refresh } = useMe(); const { tid } = useParams() as { tid: string }; const nav = useNavigate(); const loc = useLocation(); const logout = useLogout();
  const [ov, setOv] = useState<Overview | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { let live = true; setErr(null); setOv(null); api<Overview>('GET', `/api/t/${tid}/overview`).then(o => { if (live) setOv(o); }).catch(e => { if (live && errorKind(e) !== 'session') setErr(describeError(e)); }); return () => { live = false; }; }, [tid]);
  const profile = me?.realm === 'platform' ? null : (ov?.principal.profile ?? me?.profile ?? null);
  const hasToday = !!profile && OWN_PROFILES.includes(profile);
  const tabs = [...(hasToday ? [{ to: `/t/${tid}`, label: tt('Bugün'), end: true }] : []), { to: `/t/${tid}/planlar`, label: tt('Planlar'), end: false }, ...(profile === 'HR_ADMIN' ? [{ to: `/t/${tid}/kisiler`, label: tt('Kişiler'), end: false }] : [])];
  const who = <div className="v-who"><b>{me?.displayName}</b>
    {me?.realm === 'customer' && (me.memberships?.length ?? 0) > 1
      ? <select aria-label={tt('Şirket')} value={tid} onChange={async e => { const t = e.target.value; try { await api('POST', '/api/auth/switch-tenant', { tenantId: t }); await refresh(); nav(`/t/${t}`); } catch (x) { setErr(describeError(x)); } }}>{me.memberships!.map(m => <option key={m.tenant_id} value={m.tenant_id}>{PROFILE_LABEL(profile)} · {m.tenant_name}</option>)}</select>
      : <span>{me?.realm === 'platform' ? tt('HPW · şirketi inceliyorsunuz') : PROFILE_LABEL(profile)}</span>}</div>;
  return <div className="v3">
    <Header company={ov?.tenant.name} actions={<>{me?.realm === 'platform' ? <NavLink className="v-btn2" to={`/platform/sirket/${tid}`}>{tt('Kuruluma dön')}</NavLink> : null}<button type="button" className="v-btn2" onClick={() => void logout()}>{tt('Çıkış yap')}</button></>}>{who}</Header>
    {tabs.length > 1 ? <nav className="v-tabs" aria-label={tt('Ana menü')}>{tabs.map(t => <NavLink key={t.to} to={t.to} end={t.end} className="v-tab">{t.label}</NavLink>)}</nav> : null}
    {err ? <main className="v-main"><div className="v-page"><p className="v-alert" role="alert">{err}</p></div></main> : null}
    <ScreenBoundary resetKey={loc.pathname}>
      <Routes>
        <Route index element={hasToday ? <Today tid={tid} profile={profile} /> : ov || me?.realm === 'platform' ? <Navigate to={`/t/${tid}/planlar`} replace /> : null} />
        <Route path="planlar" element={<Plans tid={tid} profile={profile} />} />
        <Route path="planlar/:rid" element={<Plans tid={tid} profile={profile} />} />
        <Route path="kisiler" element={profile === 'HR_ADMIN' ? <main className="v-main" id="main"><div className="v-page"><People tid={tid} /></div></main> : <Navigate to={`/t/${tid}`} replace />} />
        <Route path="*" element={<Navigate to={`/t/${tid}`} replace />} />
      </Routes>
    </ScreenBoundary>
    <Help />
  </div>;
}
