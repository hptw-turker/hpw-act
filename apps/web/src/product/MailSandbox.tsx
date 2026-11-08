import { tt } from './i18n';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api';
import { Kicker } from '../components/Kicker';
type Mail = { id: string; to: string; subject: string; date: string; body: string; link: string | null; transport: string };
/** Test posta kutusu (yalnız sandbox modunda ve üretim dışında): gönderilen davet/parola postaları ve tek kullanımlık bağlantılar. Gerçek teslimat değildir ve öyle etiketlenir. */
export function MailSandbox({ url, title, refreshKey = 0 }: { url: string; title: string; refreshKey?: number }) {
  const [data, setData] = useState<{ note: string; mails: Mail[] } | null>(null); const [unavailable, setUnavailable] = useState<string | null>(null); const [open, setOpen] = useState<string | null>(null);
  const load = () => api<{ note: string; mails: Mail[] }>('GET', url).then(d => { if (!d || typeof d !== 'object' || !Array.isArray((d as { mails?: unknown }).mails)) { setData(null); setUnavailable(tt("Test posta kutusu yanıtı beklenen biçimde değil")); return; } setData(d); setUnavailable(null); }) /* F10: bozuk/beklenmeyen yanıt ekranı çökertmez */.catch(e => setUnavailable((e as Error).message));
  useEffect(() => { void load(); }, [url, refreshKey]);
  if (unavailable) return <p className="caption">{tt("Test posta kutusu bu ortamda yok (")}{unavailable}{tt("); gerçek posta sağlayıcısı yapılandırılmış ya da üretim ortamı.")}</p>;
  if (!data) return null;
  const hash = (l: string) => l.slice(l.indexOf('#'));
  return (<div className="stack"><Kicker>{title} {tt("· sandbox (gerçek teslimat değil)")}</Kicker><p className="caption">{data.note}{tt(". Bağlantılar tek kullanımlık ve sürelidir; kabul akışı gerçek hesabı açar.")}{' '}<button type="button" className="link caption" onClick={() => void load()}>{tt("yenile")}</button></p>
    <div className="table-wrap"><table className="table"><thead><tr><th>{tt("Tarih")}</th><th>{tt("Alıcı")}</th><th>{tt("Konu")}</th><th>{tt("Bağlantı")}</th><th></th></tr></thead><tbody>{data.mails.length === 0 ? <tr><td colSpan={5} className="caption">{tt("Kutu boş.")}</td></tr> : data.mails.map(m => <tr key={m.id}><td className="caption">{m.date.slice(0, 16).replace('T', ' ')}</td><td>{m.to}</td><td>{m.subject}</td><td>{m.link ? <Link className="link" to={hash(m.link)} target="_blank" rel="noreferrer">{m.link.includes('#/davet/') ? tt("daveti aç") : tt("parola bağlantısını aç")}</Link> : <span className="caption">—</span>}</td><td><button type="button" className="link caption" onClick={() => setOpen(open === m.id ? null : m.id)}>{open === m.id ? tt("kapat") : tt("metin")}</button></td></tr>)}</tbody></table></div>
    {open ? <pre className="caption" style={{ whiteSpace: 'pre-wrap' }}>{data.mails.find(m => m.id === open)?.body}</pre> : null}</div>);
}
