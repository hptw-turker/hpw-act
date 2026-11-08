import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { Kicker } from '../components/Kicker';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
/** Dönem: sürecin nereden başladığı. İK Yöneticisi dönemi açar; ilk hedef kurumsal hedeftir ve Genel Müdür onaylar. Tek kırmızı: sıradaki adım. */
export default function Cycle() {
  const { fmtDate } = useI18n();
  const [opened, setOpened] = useState(true);
  const steps: { no: number; title: string; who: string; where: string; state: 'done' | 'next' | 'later'; to?: string }[] = [
    { no: 1, title: 'Dönemi aç: hiyerarşi grupları, gizlilik eşiği, onay zinciri, roller', who: 'İK Yöneticisi (HPTW danışmanıyla)', where: 'Dönem · Ayarlar · Kullanıcılar', state: opened ? 'done' : 'next' },
    { no: 2, title: 'Anket sonuçlarını içe al', who: 'İK Yöneticisi', where: 'Sonuçlar', state: 'done', to: '/sonuclar' },
    { no: 3, title: 'Analiz: öncelik skoru, sorunun yeri, odak alanı önerisi (otomatik)', who: 'Sistem', where: 'Birimler', state: 'done', to: '/birimler' },
    { no: 4, title: 'Kurumsal hedef önerisini gözden geçir (60,5 → 68, 9 ay)', who: 'HPTW danışmanı + İK Yöneticisi', where: 'Kurumsal', state: 'done', to: '/kurumsal' },
    { no: 5, title: 'Kurumsal hedefi onayla — sürecin başlangıç düğmesi', who: 'Genel Müdür', where: 'Kurumsal', state: 'next', to: '/kurumsal' },
    { no: 6, title: 'Bölge ve iş kolu hedeflerini şubelere dağıt ve onayla', who: 'Bölge Direktörü / GMY (İK İş Ortağı hazırlar)', where: 'Hedefler', state: 'later', to: '/hedefler' },
    { no: 7, title: 'Şube payını kabul et ya da "uygun değil" de', who: 'Şube Müdürü', where: 'Hedefler', state: 'later' },
    { no: 8, title: 'Üç öneriden aksiyon seç, kanıt gereksinimi kilitlensin', who: 'Şube Müdürü / Aksiyon Sahibi', where: 'Aksiyonlar', state: 'later', to: '/aksiyonlar' },
    { no: 9, title: 'Uygula, durum bildir, kanıt yükle, doğrulat', who: 'Aksiyon Sahibi · doğrulayıcı', where: 'Kanıt', state: 'later', to: '/kanit' },
    { no: 10, title: 'Yeniden ölçüm: karşılaştırılabilirlik kapısı, sonuç, "kim tuttu"', who: 'Sistem · Metodolog · Genel Müdür', where: 'Karne', state: 'later', to: '/karne' },
  ];
  const next = steps.find(s => s.state === 'next');
  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>Dönem · 2026 Ana Ölçüm · Atlas Holding · açılış {fmtDate('2026-05-04')} · yeniden ölçüm 2027 Ana Ölçüm</Kicker></div>
          <div className="col-6">
            <p className="display-xxl num red enter">{next?.no ?? 0}</p>
            <h1 className="h2" style={{ marginTop: 'var(--s-2)' }}>{next ? `sıradaki adım: ${next.title}. Sorumlu: ${next.who}.` : 'Bütün adımlar tamamlandı.'}</h1>
          </div>
          <div className="col-6 stack">
            <Kicker>Dönem kaydı</Kicker>
            <div className="row">
              <div style={{ minWidth: '22ch' }}><Field id="cycle-code" type="text" label="Dönem kodu" defaultValue="2026-ANA" /></div>
              <div style={{ minWidth: '18ch' }}><Field id="cycle-group" kind="select" label="Toplama hiyerarşisi" defaultValue="idari"><option value="idari">İdari</option><option value="cografi">Coğrafi</option></Field></div>
              <Button onClick={() => setOpened(true)} disabled={opened} disabledReason={opened ? 'Dönem açık · sonuçlar alındı · analiz tamamlandı' : undefined}>Dönemi aç</Button>
            </div>
            <p className="caption">Dönemi İK Yöneticisi açar. Açılış, HPTW anketinin sonuç dosyası geldikten sonra yapılır; sonuçlar bir kez alınır.</p>
          </div>
        </div>
      </section>
      <section className="section--tight surface-white">
        <div className="container table-wrap">
          <table className="table">
            <thead><tr><th className="num">Adım</th><th>Ne yapılır</th><th>Kim yapar</th><th>Nerede</th><th>Durum</th></tr></thead>
            <tbody>
              {steps.map(s => (
                <tr key={s.no}><td className="num">{s.no}</td><td className={s.state === 'next' ? 'bold' : ''}>{s.title}</td><td>{s.who}</td><td>{s.to ? <Link to={s.to} className="link">{s.where}</Link> : s.where}</td>
                  <td className="caption">{s.state === 'done' ? 'Tamamlandı' : s.state === 'next' ? 'Sırada' : 'Bekliyor'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="section surface-ink">
        <div className="container grid">
          <div className="col-12"><Kicker>Kim başlatır</Kicker></div>
          <div className="col-8"><p className="h2">Dönemi İK Yöneticisi açar, sayıyı sistem önerir, süreci <span className="red">Genel Müdür</span> onayıyla başlatır. Onaydan sonra her kademe kendi payını görür; kimse boş bir hedef formu doldurmaz.</p></div>
        </div>
      </section>
      <section className="section--tight surface-white"><div className="container"><p className="caption">Genel Müdür onayı gecikirse konu dikkat kuyruğunda kalır ve son gün geçince İK Yöneticisine yükselir. Onay zinciri Ayarlar'da değiştirilebilir (örnek: Genel Müdür yerine GMY + İK Yöneticisi).</p></div></section>
    </>
  );
}
