import { tt, LANG } from '../i18n';
import { LangSwitch } from '../App';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError, commandApi, describeError, EMAIL_RE } from '../api';
import { useMe } from '../App';
import { Field } from '../../components/Field';
import { Button } from '../../components/Button';
import { Kicker } from '../../components/Kicker';

export function Login() {
  const { refresh } = useMe(); const nav = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [sp] = useSearchParams(); const expired = sp.get('oturum') === 'doldu'; const [emailErr, setEmailErr] = useState<string | null>(null);
  // F14: tek giriş isteği — koruma submit içinde (düğmenin kapalı olmasına güvenilmez); Enter ve tıklama aynı yoldan geçer
  const inFlight = useRef(false);
  const submit = async () => { if (inFlight.current) return; const em = email.trim(); if (!EMAIL_RE.test(em)) { setEmailErr(tt("Geçerli bir e-posta adresi girin (örnek: ad.soyad@sirket.com)")); return; } setEmailErr(null); if (!password) { setErr(tt("Parola zorunludur")); return; } inFlight.current = true; setBusy(true); setErr(null); try { const r = await api<{ realm: string; memberships: { tenant_id: string }[] }>('POST', '/api/auth/login', { email: em, password }); await refresh(); nav(r.realm === 'platform' ? '/platform' : `/t/${r.memberships[0]?.tenant_id}`); } catch (e) { setErr(describeError(e)); } finally { inFlight.current = false; setBusy(false); } };
  // BOŞ kurulumda ilk HPW yöneticisi bu ekrandan kurulur (tek seferlik; kurulum anahtarı başlatıcının yazdığı yerel dosyadan alınır, HTML'e gömülmez)
  const [boot, setBoot] = useState<{ needsBootstrap: boolean; setupKeyRequired: boolean; env: string } | null>(null); const [bf, setBf] = useState({ email: '', displayName: '', password: '', password2: '', setupKey: '' }); const [bootMsg, setBootMsg] = useState<string | null>(null);
  useEffect(() => { api<{ needsBootstrap: boolean; setupKeyRequired: boolean; env: string }>('GET', '/api/platform/bootstrap-status').then(setBoot).catch(() => setBoot(null)); }, []);
  const bootstrap = async () => { setErr(null); if (bf.password !== bf.password2) { setErr(tt("Parolalar eşleşmiyor")); return; } setBusy(true); try { await api('POST', '/api/platform/bootstrap', { email: bf.email, password: bf.password, displayName: bf.displayName || tt("HPW Yönetici"), ...(bf.setupKey ? { setupKey: bf.setupKey } : {}) }); setBootMsg(tt("İlk HPW yöneticisi kuruldu; şimdi bu e-posta ve parolayla giriş yapın.")); setEmail(bf.email); setBoot({ ...boot!, needsBootstrap: false }); } catch (e) { setErr(describeError(e)); } finally { setBusy(false); } };
  return (
    <main className="section surface-red" style={{ minHeight: '100vh' }}>
      <div className="container grid">
        <div className="col-6 stack-4 hero-col"><div className="row row--between"><p className="h3">Happy Place to Work® Act</p><LangSwitch /></div><h1 className="display-xl hero-title">{tt("Sonuç bir başlangıçtır.")}</h1><p className="body-l">{tt("Kullanıcı adınız e-postanızdır; parolanızı davet bağlantısıyla siz belirlediniz.")}</p>{boot ? <p className="caption">{tt("Ortam:")}{' '}{boot.env === 'demo' ? tt("DOLU DEMO — sentetik veri") : boot.env === 'bos' ? tt("BOŞ BAŞLANGIÇ — sizin veriniz") : boot.env.toLocaleUpperCase(LANG === 'en' ? 'en-GB' : 'tr-TR')}</p> : null}</div>
        {boot?.needsBootstrap ? <div className="col-6 stack">
          <Kicker>{tt("İlk kurulum · HPW yöneticisi")}</Kicker>
          <p className="body-l">{tt("Bu kurulumda henüz HPW yöneticisi yok. İlk yöneticiyi siz belirleyin; bu işlem tek seferliktir ve ikinci deneme reddedilir. Varsayılan ya da herkese açık parola yoktur.")}</p>
          <Field id="b-email" label={tt("E-posta (kullanıcı adı)")} type="email" value={bf.email} onChange={e => setBf({ ...bf, email: e.target.value })} autoComplete="username" />
          <Field id="b-name" label={tt("Ad Soyad")} value={bf.displayName} onChange={e => setBf({ ...bf, displayName: e.target.value })} />
          <Field id="b-pw" label={tt("Parola (en az 10 karakter, harf ve rakam)")} type="password" value={bf.password} onChange={e => setBf({ ...bf, password: e.target.value })} autoComplete="new-password" />
          <Field id="b-pw2" label={tt("Parola (tekrar)")} type="password" value={bf.password2} onChange={e => setBf({ ...bf, password2: e.target.value })} autoComplete="new-password" />
          {boot.setupKeyRequired ? <Field id="b-key" label={tt("Kurulum anahtarı")} value={bf.setupKey} onChange={e => setBf({ ...bf, setupKey: e.target.value })} hint={tt("Başlatıcının CALISTIRMA klasörüne yazdığı ILK_KURULUM_ANAHTARI.txt dosyasındaki tek satır; e-postayla gelmez, HTML'de yoktur")} /> : null}
          {err ? <p className="bold">{err}</p> : null}
          <Button onClick={bootstrap} disabled={busy || !bf.email || bf.password.length < 10 || (boot.setupKeyRequired && !bf.setupKey)}>{tt("İlk yöneticiyi kur")}</Button>
        </div> : <div className="col-6 stack">
          <Kicker>{tt("Giriş")}</Kicker>{bootMsg ? <p className="body-l">{bootMsg}</p> : null}
          {expired ? <p className="body-l">{tt("Oturumunuzun süresi doldu; yeniden giriş yapın.")}</p> : null}<Field id="email" label={tt("E-posta")} type="email" value={email} error={emailErr ?? undefined} onChange={e => { setEmail(e.target.value); setEmailErr(null); }} autoComplete="username" />
          <Field id="password" label={tt("Parola")} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } }} />
          {err ? <p className="bold">{err}</p> : null}
          <Button onClick={submit} disabled={busy || !email || !password}>{tt("Giriş yap")}</Button>
          <p className="caption"><Link className="link" to="/parola">{tt("Parolamı unuttum")}</Link></p>
        </div>}
      </div>
    </main>
  );
}
export function InviteAccept() {
  const { token } = useParams(); const nav = useNavigate(); const { refresh } = useMe();
  const [info, setInfo] = useState<{ tenantName: string; email: string; displayName: string; expiresAt: string; hasPassword: boolean } | null>(null); const [err, setErr] = useState<string | null>(null);
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  useEffect(() => { api<typeof info>('GET', `/api/invitations/${token}`).then(setInfo).catch(e => setErr(describeError(e))); }, [token]);
  const submit = async () => { if (!info?.hasPassword && pw !== pw2) { setErr(tt("Parolalar eşleşmiyor")); return; } try { const r = await commandApi<{ tenantId: string }>(`/api/invitations/${token}/accept`, { password: pw }); setPw(''); setPw2(''); /* F07: parola yalnız gerektiği sürece bellekte */ await refresh(); nav(`/t/${r.tenantId}`); } catch (e) { setErr(describeError(e)); } };
  return (
    <main className="section surface-white"><div className="container grid">
      <div className="col-6 stack-4"><Kicker>{tt("Davet")}</Kicker>{info ? <><h1 className="h1">{info.tenantName}</h1><p className="body-l">{info.displayName} {tt("· kullanıcı adınız")}{' '}<strong>{info.email}</strong>{tt(". Bu bağlantı yalnız size aittir ve tek kullanımlıktır;")}{' '}{info.hasPassword ? tt("hesabınız zaten var: mevcut parolanızla daveti bu şirkete bağlayın (parolanız değişmez).") : tt("parolanızı belirleyince hesabınız açılır.")}</p></> : <p className="body-l">{err ?? tt("Davet kontrol ediliyor…")}</p>}</div>
      {info ? <div className="col-6 stack">{info.hasPassword ? <Field id="pw" label={tt("Mevcut parolanız")} type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" /> : <><Field id="pw" label={tt("Yeni parola (en az 10 karakter, harf ve rakam)")} type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /><Field id="pw2" label={tt("Parola (tekrar)")} type="password" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" /></>}{err ? <p className="bold">{err}</p> : null}<Button onClick={submit} disabled={info.hasPassword ? !pw : pw.length < 10}>{info.hasPassword ? tt("Daveti hesabıma bağla") : tt("Parolayı belirle ve giriş yap")}</Button></div> : null}
    </div></main>
  );
}

/** Parola sıfırlama: e-posta ile süreli, tek kullanımlık bağlantı; bağlantıyla yeni parola. Aynı sayfa platform personelinin ilk parola kurulumunda da kullanılır. */
export function PasswordReset() {
  const { token } = useParams(); const nav = useNavigate();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const ask = async () => { setErr(null); try { const r = await api<{ message: string }>('POST', '/api/auth/forgot', { email }); setMsg(r.message); } catch (e) { setErr(describeError(e)); } };
  const set = async () => { if (pw !== pw2) { setErr(tt("Parolalar eşleşmiyor")); return; } setErr(null); try { await api('POST', `/api/auth/reset/${token}`, { password: pw }); setMsg(tt("Parolanız güncellendi; giriş yapabilirsiniz.")); setTimeout(() => nav('/giris'), 800); } catch (e) { setErr(describeError(e)); } };
  return (
    <main className="section surface-white"><div className="container grid">
      <div className="col-6 stack-4"><Kicker>{tt("Parola")}</Kicker><h1 className="h1">{token ? tt("Yeni parola belirleyin") : tt("Parola sıfırlama")}</h1><p className="body-l">{token ? tt("Bağlantı süreli ve tek kullanımlıktır; parola belirlenince açık oturumlarınız kapanır.") : tt("E-postanızı girin; kayıtlı bir hesap varsa sıfırlama bağlantısı gönderilir. Parolanız hiçbir zaman e-posta ile gönderilmez.")}</p></div>
      <div className="col-6 stack">{token ? <><Field id="pw" label={tt("Yeni parola (en az 10 karakter, harf ve rakam)")} type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /><Field id="pw2" label={tt("Parola (tekrar)")} type="password" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" /><Button onClick={set} disabled={pw.length < 10}>{tt("Parolayı belirle")}</Button></> : <><Field id="email" label={tt("E-posta")} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" /><Button onClick={ask} disabled={!email}>{tt("Bağlantı gönder")}</Button></>}
        {msg ? <p className="body-l">{msg}</p> : null}{err ? <p className="bold">{err}</p> : null}<p className="caption"><Link className="link" to="/giris">{tt("Girişe dön")}</Link></p></div>
    </div></main>
  );
}
