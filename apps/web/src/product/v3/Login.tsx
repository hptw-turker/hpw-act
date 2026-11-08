/** v3.0 giriş: e-posta + parola, iki adımlı doğrulama yok. Şirkete özel adres /g/<kod> şirket adını başlıkta gösterir ve oturumu o şirkette açar. */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { tt } from '../i18n';
import { api, describeError, EMAIL_RE } from '../api';
import { useMe } from '../App';
import { Header } from './Shell';

const REM = 'hpwact.v3.email';
const readRem = () => { try { return localStorage.getItem(REM) ?? ''; } catch { return ''; } };
const writeRem = (v: string | null) => { try { if (v) localStorage.setItem(REM, v); else localStorage.removeItem(REM); } catch { /* tarayıcı depolaması kapalı */ } };

export function Login3() {
  const { code } = useParams(); const [sp] = useSearchParams(); const nav = useNavigate(); const { refresh } = useMe();
  const [company, setCompany] = useState<{ code: string; name: string } | null>(null); const [companyErr, setCompanyErr] = useState(false);
  const [email, setEmail] = useState(readRem()); const [password, setPassword] = useState(''); const [remember, setRemember] = useState(!!readRem());
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const inFlight = useRef(false);
  const [boot, setBoot] = useState<{ needsBootstrap: boolean; setupKeyRequired: boolean } | null>(null);
  useEffect(() => { if (!code) return; api<{ code: string; name: string }>('GET', `/api/public/tenant/${encodeURIComponent(code)}`).then(c => { setCompany(c); try { localStorage.setItem('hpwact.v3.company', c.code); } catch { /* yok */ } }).catch(() => setCompanyErr(true)); }, [code]);
  useEffect(() => { if (code) return; api<{ needsBootstrap: boolean; setupKeyRequired: boolean }>('GET', '/api/platform/bootstrap-status').then(setBoot).catch(() => setBoot(null)); }, [code]);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (inFlight.current) return; const em = email.trim();
    if (!EMAIL_RE.test(em)) { setErr(tt('Geçerli bir e-posta adresi girin (örnek: ad.soyad@sirket.com)')); return; }
    if (!password) { setErr(tt('Parola zorunludur')); return; }
    inFlight.current = true; setBusy(true); setErr(null);
    try {
      const r = await api<{ realm: string; memberships: { tenant_id: string }[] }>('POST', '/api/auth/login', { email: em, password, ...(company ? { tenantCode: company.code } : {}) });
      writeRem(remember ? em : null); await refresh(); nav(r.realm === 'platform' ? '/platform' : `/t/${r.memberships[0]?.tenant_id}`);
    } catch (x) { setErr(describeError(x)); } finally { inFlight.current = false; setBusy(false); }
  };
  if (boot?.needsBootstrap && !code) return <Bootstrap setupKeyRequired={boot.setupKeyRequired} onDone={em => { setEmail(em); setBoot({ ...boot, needsBootstrap: false }); }} />;
  return <div className="v3"><Header company={company?.name} />
    <main className="v-login" id="main"><div className="v-lbox">
      <p className="v-lco">{company?.name ?? 'Happy Place to Work®'}</p>
      <p className="v-lpr"><span>HPW Act</span> · {tt('Yol haritası takibi')}</p>
      {companyErr ? <p className="v-alert" role="alert">{tt('Bu giriş adresi tanınmadı. Adresi şirketinizin İK birimine sorun ya da genel girişi kullanın.')} <Link to="/giris">{tt('Genel giriş')}</Link></p> : null}
      {sp.get('oturum') === 'doldu' ? <p className="v-ok" role="status">{tt('Oturumunuzun süresi doldu; yeniden giriş yapın.')}</p> : null}
      <form onSubmit={submit} noValidate>
        <div className="v-field"><label htmlFor="em">{tt('E-posta')}</label><input className="v-inp" id="em" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div className="v-field"><label htmlFor="pw">{tt('Parola')}</label><input className="v-inp" id="pw" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></div>
        <button type="button" className="v-chkrow" role="checkbox" aria-checked={remember} onClick={() => setRemember(r => !r)}><span className="v-chk" /><span>{tt('E-postamı bu cihazda hatırla')}</span></button>
        {err ? <p className="v-alert" role="alert">{err}</p> : null}
        <button type="submit" className="v-btn" disabled={busy}>{busy ? tt('Giriş yapılıyor…') : tt('Giriş yap')}</button>
        <Link to="/parola" className="v-meta">{tt('Parolamı unuttum')}</Link>
      </form>
    </div></main></div>;
}

/** Boş kurulumda ilk HPW yöneticisi (tek seferlik; kurulum anahtarı sunucudaki dosyadan) */
function Bootstrap({ setupKeyRequired, onDone }: { setupKeyRequired: boolean; onDone: (email: string) => void }) {
  const [f, setF] = useState({ email: '', displayName: '', password: '', password2: '', setupKey: '' }); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const go = async (e: FormEvent) => { e.preventDefault(); setErr(null); if (f.password !== f.password2) { setErr(tt('Parolalar eşleşmiyor')); return; } setBusy(true); try { await api('POST', '/api/platform/bootstrap', { email: f.email.trim(), password: f.password, displayName: f.displayName || tt('HPW Yönetici'), ...(f.setupKey ? { setupKey: f.setupKey.trim() } : {}) }); onDone(f.email.trim()); } catch (x) { setErr(describeError(x)); } finally { setBusy(false); } };
  const inp = (k: keyof typeof f, label: string, type = 'text', ac?: string) => <div className="v-field"><label htmlFor={`b-${k}`}>{label}</label><input className="v-inp" id={`b-${k}`} type={type} autoComplete={ac} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></div>;
  return <div className="v3"><Header /><main className="v-login" id="main"><div className="v-lbox">
    <p className="v-lco">HPW Act</p><p className="v-lpr">{tt('İlk kurulum · HPW yöneticisi')}</p>
    <form onSubmit={go} noValidate>
      <p className="v-meta">{tt('Bu kurulumda henüz HPW yöneticisi yok. İlk yöneticiyi siz belirleyin; bu işlem tek seferliktir.')}</p>
      {inp('email', tt('E-posta (kullanıcı adı)'), 'email', 'username')}{inp('displayName', tt('Ad Soyad'))}
      {inp('password', tt('Parola (en az 10 karakter, harf ve rakam)'), 'password', 'new-password')}{inp('password2', tt('Parola (tekrar)'), 'password', 'new-password')}
      {setupKeyRequired ? inp('setupKey', tt('Kurulum anahtarı (sunucudaki ILK_KURULUM_ANAHTARI.txt dosyasındaki satır)')) : null}
      {err ? <p className="v-alert" role="alert">{err}</p> : null}
      <button type="submit" className="v-btn" disabled={busy || !f.email || f.password.length < 10 || (setupKeyRequired && !f.setupKey)}>{tt('İlk yöneticiyi kur')}</button>
    </form>
  </div></main></div>;
}
