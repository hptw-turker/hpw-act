/** v3.0 HPW Merkezi: şirketler ve üç adımlı kurulum (organizasyon → yol haritası → kullanıcılar ve davet). Dosyaları HPW sorumlusu yükler. */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { tt } from '../i18n';
import { api, commandApi, describeError, EMAIL_RE } from '../api';
import { useMe } from '../App';
import { Header, useLogout } from './Shell';
import { Upload } from './Upload';
import { People } from './People';
import { fmtDate } from './parts';

function Frame({ children, company }: { children: React.ReactNode; company?: string }) {
  const { me } = useMe(); const logout = useLogout();
  return <div className="v3"><Header company={company ?? tt('HPW Merkezi')} actions={<button type="button" className="v-btn2" onClick={() => void logout()}>{tt('Çıkış yap')}</button>}><div className="v-who"><b>{me?.displayName}</b><span>{tt('Happy Place to Work')}</span></div></Header>
    <main className="v-main" id="main"><div className="v-page v-narrow">{children}</div></main></div>;
}

interface Tenant { id: string; code: string; name: string; status: string; created_at: string }
export function Companies() {
  const [list, setList] = useState<Tenant[] | null>(null); const [err, setErr] = useState<string | null>(null); const [open, setOpen] = useState(false); const nav = useNavigate();
  const load = useCallback(async () => { try { setList(await api<Tenant[]>('GET', '/api/platform/tenants')); } catch (e) { setErr(describeError(e)); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <Frame>
    <div className="v-today-head"><div><h1 className="v-h1">{tt('Şirketler')}</h1><p className="v-sub">{tt('Her şirketin kendi giriş adresi ve kendi yol haritası vardır.')}</p></div>
      <button type="button" className="v-btn" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? tt('Vazgeç') : tt('Yeni şirket')}</button></div>
    {open ? <NewCompany onCreated={id => nav(`/platform/sirket/${id}`)} /> : null}
    {err ? <p className="v-alert" role="alert">{err}</p> : null}
    {list ? list.length ? <div className="v-co">{list.map(t => <div key={t.id} className="v-co-row">
      <div><b>{t.name}</b><br /><span className="v-meta">{t.code}{t.status !== 'active' ? ` · ${tt('durdurulmuş')}` : ''}</span></div>
      <span className="v-meta">{tt('Giriş adresi')}: {window.location.origin}/g/{t.code}</span>
      <Link className="v-btn2" to={`/platform/sirket/${t.id}`}>{tt('Kurulumu aç')}</Link></div>)}</div>
      : <p className="v-empty">{tt('Henüz şirket yok. "Yeni şirket" ile başlayın.')}</p> : <p className="v-meta">{tt('Yükleniyor…')}</p>}
  </Frame>;
}

function NewCompany({ onCreated }: { onCreated: (id: string) => void }) {
  const [f, setF] = useState({ code: '', name: '', adminName: '', adminEmail: '' }); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const go = async (e: FormEvent) => { e.preventDefault(); setErr(null);
    const code = f.code.trim().replace(/[a-z]/g, c => String.fromCharCode(c.charCodeAt(0) - 32));
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) { setErr(tt('Şirket kodu 3–24 karakter olmalı; yalnız İngilizce büyük harf, rakam, tire ve alt çizgi.')); return; }
    if (f.name.trim().length < 2) { setErr(tt('Şirket adını yazın.')); return; }
    if (!EMAIL_RE.test(f.adminEmail.trim())) { setErr(tt('İK yöneticisinin e-postası geçerli değil.')); return; }
    setBusy(true); try { const r = await commandApi<{ id: string }>('/api/platform/tenants', { code, name: f.name.trim(), adminEmail: f.adminEmail.trim(), adminName: f.adminName.trim() || tt('İK yöneticisi') }); onCreated(r.id); } catch (x) { setErr(describeError(x)); } finally { setBusy(false); } };
  const inp = (k: keyof typeof f, label: string, hint: string, type = 'text') => <div className="v-field"><label htmlFor={`nc-${k}`}>{label}</label><input className="v-inp" id={`nc-${k}`} type={type} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /><small>{hint}</small></div>;
  return <form className="v-step3" onSubmit={go} noValidate>
    <p className="v-h2">{tt('Yeni şirket')}</p>
    <div className="v-grid2">
      {inp('code', tt('Şirket kodu'), tt('Giriş adresinde görünür, sonradan değişmez. Örnek: ORNEK → adres /g/ORNEK'))}
      {inp('name', tt('Şirket adı'), tt('Ekranların üstünde ve giriş sayfasında görünür. Örnek: Örnek Holding'))}
      {inp('adminName', tt('Şirketin İK yöneticisi (ad soyad)'), tt('Müşteri tarafındaki ilk kullanıcı; kişileri ve davetleri izler.'))}
      {inp('adminEmail', tt('İK yöneticisinin e-postası'), tt('Davet bu adrese gider; kişi parolasını kendisi belirler.'), 'email')}
    </div>
    {err ? <p className="v-alert" role="alert">{err}</p> : null}
    <div className="v-btns"><button type="submit" className="v-btn" disabled={busy}>{tt('Şirketi oluştur')}</button></div>
  </form>;
}

interface Setup3 { organization: { units: number; done: boolean }; roadmap: { roadmaps: number; plans: number; startDate: string | null; done: boolean }; users: { members: number; unsent: number; pending: number; accepted: number; done: boolean }; loginPath: string }
export function CompanySetup() {
  const { tid } = useParams() as { tid: string };
  const [d, setD] = useState<{ tenant: { name: string; code: string; status: string }; setup3: Setup3 } | null>(null); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => { try { setD(await api('GET', `/api/platform/tenants/${tid}`)); } catch (e) { setErr(describeError(e)); } }, [tid]);
  useEffect(() => { void load(); }, [load]);
  if (err) return <Frame><p className="v-alert" role="alert">{err}</p><Link to="/platform">{tt('Şirketlere dön')}</Link></Frame>;
  if (!d) return <Frame><p className="v-meta">{tt('Yükleniyor…')}</p></Frame>;
  const s = d.setup3; const url = `${window.location.origin}${s.loginPath}`;
  const tag = (ok: boolean) => <span className={`v-st v-st-${ok ? 'DONE' : 'OPEN'}`}>{ok ? tt('Tamam') : tt('Bekliyor')}</span>;
  return <Frame company={d.tenant.name}>
    <p className="v-meta"><Link to="/platform">{tt('Şirketler')}</Link> · {d.tenant.code}</p>
    <h1 className="v-h1">{tt('Kurulum')}</h1>
    <p className="v-sub">{tt('Üç dosya sırayla yüklenir. Her dosya önce denetlenir; hata varken yükleme yapılmaz. Dosyalar daha sonra yeniden yüklenebilir: yeni yol haritası eskisinin yerini alır, yapılmış adımların durumu korunur.')}</p>
    <div className="v-steps3">
      <section className="v-step3"><div className="v-step3-h"><p className="v-h2">1 · {tt('Organizasyon')}</p>{tag(s.organization.done)}</div>
        <p className="v-meta">{tt('Kayıtlı birim')}: {s.organization.units}</p>
        <Upload tid={tid} kind="org" title={tt('Organizasyon dosyası')} help={tt('Kurum (kök birim), işletmeler ve roller. Rol satırındaki yetki profili kimin hangi adımı işaretleyeceğini belirler: HR_ADMIN (İK), EXEC (üst yönetim), UNIT_MANAGER (işletme müdürü), VIEWER (izleyici).')} onDone={load} /></section>
      <section className="v-step3"><div className="v-step3-h"><p className="v-h2">2 · {tt('Yol haritası')}</p>{tag(s.roadmap.done)}</div>
        <p className="v-meta">{s.roadmap.done ? tt('{0} yol haritası, {1} eylem planı · başlangıç {2}', s.roadmap.roadmaps, s.roadmap.plans, fmtDate(s.roadmap.startDate)) : tt('Henüz yüklenmedi')}</p>
        <Upload tid={tid} kind="roadmap2" title={tt('Yol haritası dosyası (rapordan)')} help={tt('Kurum raporu ve işletme raporlarının yol haritası bölümü: planlar, hedefler, rollerin adımları ve çıktıları. Başlangıç tarihi sunum günüdür; terminler buradan hesaplanır.')} onDone={load} /></section>
      <section className="v-step3"><div className="v-step3-h"><p className="v-h2">3 · {tt('Kullanıcılar ve davet')}</p>{tag(s.users.done)}</div>
        <p className="v-meta">{tt('{0} kullanıcı · {1} davet gönderilmedi · {2} davet bekliyor · {3} kişi giriş yaptı', s.users.members, s.users.unsent, s.users.pending, s.users.accepted)}</p>
        <Upload tid={tid} kind="users" title={tt('Kullanıcı dosyası')} help={tt('Kişiler ve rolleri. "invite_requested" sütununda evet yazan kişilere davet hazırlanır; davetler aşağıdaki düğmeyle gönderilir.')} onDone={load} />
        <People tid={tid} compact key={`${s.users.members}-${s.users.unsent}-${s.users.pending}`} /></section>
      <Sandbox refresh={s.users.pending} />
      <section className="v-step3"><div className="v-step3-h"><p className="v-h2">{tt('Şirketin giriş adresi')}</p></div>
        <p className="v-h3 v-wrap">{url}</p>
        <p className="v-meta">{tt('Bu adresi davet e-postasıyla birlikte şirkete iletin. Kişiler e-posta ve parolalarıyla girer; iki adımlı doğrulama yoktur.')}</p>
        <div className="v-btns"><button type="button" className="v-btn2" onClick={() => { void navigator.clipboard?.writeText(url); }}>{tt('Adresi kopyala')}</button><Link className="v-btn2" to={`/t/${tid}/planlar`}>{tt('Şirketin planlarını incele')}</Link></div></section>
    </div>
  </Frame>;
}

/** Yerel deneme kurulumunda gerçek e-posta yoktur: davetler test posta kutusuna yazılır. Kutu yalnız sandbox modunda görünür (üretimde uç kapalıdır). */
function Sandbox({ refresh }: { refresh: number }) {
  type Mail = { id: string; to: string; subject: string; date: string; link: string | null };
  const [mails, setMails] = useState<Mail[] | null>(null);
  const load = useCallback(() => { api<{ mails?: Mail[] }>('GET', '/api/platform/mail-sandbox').then(d => setMails(Array.isArray(d?.mails) ? d.mails : null)).catch(() => setMails(null)); }, []);
  useEffect(() => { load(); }, [load, refresh]);
  if (!mails) return null;
  return <section className="v-step3" aria-label={tt('Test posta kutusu')}>
    <div className="v-step3-h"><p className="v-h2">{tt('Test posta kutusu')}</p><button type="button" className="v-link" onClick={load}>{tt('Yenile')}</button></div>
    <p className="v-meta">{tt('Bu kurulumda gerçek e-posta gönderilmez; davetler burada görünür. Bağlantılar tek kullanımlıktır.')}</p>
    {mails.length ? <div className="v-tablewrap"><table className="v-table"><thead><tr><th>{tt('Alıcı')}</th><th>{tt('Konu')}</th><th><span className="v-sr">{tt('Bağlantı')}</span></th></tr></thead>
      <tbody>{mails.slice(0, 50).map(m => <tr key={m.id}><td className="v-wrap">{m.to}</td><td className="v-wrap">{m.subject}</td><td>{m.link ? <a href={m.link.slice(m.link.indexOf('#'))} target="_blank" rel="noreferrer">{m.link.includes('#/davet/') ? tt('Daveti aç') : tt('Bağlantıyı aç')}</a> : '—'}</td></tr>)}</tbody></table></div> : <p className="v-meta">{tt('Kutu boş.')}</p>}
  </section>;
}
