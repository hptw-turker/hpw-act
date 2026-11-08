import { useState } from 'react';
import { data } from '../api/mock';
import { useI18n } from '../i18n';
import { Kicker } from '../components/Kicker';
import { Button } from '../components/Button';
/** Organizasyon (HR Admin): HRIS'ten gelen taslak reorg olayları; onay → süreç; tekrar olay tekilleştirilir (T-37). Tek kırmızı: onay bekleyen olay sayısı. */
export default function Organization() {
  const { fmtDate } = useI18n();
  const [state, setState] = useState<Record<string, 'approved' | 'rejected' | undefined>>({});
  const events = [
    { id: 'İKS-ORG-2026-001', type: 'birleştirme', desc: 'Finans Müdürlüğü 1 + Hukuk Müdürlüğü 1 → yeni müdürlük', effect: 'Geçmiş bağı kurulur: iki başlangıç skoru ağırlıklı birleştirilir; hedefler yeniden önerilir', date: '2026-07-01', dup: false },
    { id: 'İKS-ORG-2026-002', type: 'taşıma', desc: '40 şube Marmara → İstanbul Anadolu', effect: 'Hedefler şubeyle taşınır; üst ilişki yeniden bağlanır; iki bölgede ulaşılabilirlik yeniden hesaplanır', date: '2026-07-01', dup: false },
    { id: 'İKS-ORG-2026-003', type: 'kapanış', desc: '10 şube kapanış', effect: 'Hedefler gerekçeyle kapatılır; yerel uygulamalar iptal edilir (geçmiş notuyla)', date: '2026-07-01', dup: false },
    { id: 'İKS-ORG-2026-004', type: 'açılış', desc: '15 yeni şube', effect: 'Başlangıç skoru yok · yalnız öncelik hedefi · ana aksiyonlara otomatik yerel uygulama', date: '2026-07-01', dup: false },
    { id: 'İKS-ORG-2026-002', type: 'taşıma', desc: '40 şube Marmara → İstanbul Anadolu (tekrar)', effect: 'Aynı olay numarası: tekilleştirildi, uygulanmaz', date: '2026-07-01', dup: true },
  ];
  const pending = events.filter(e => !e.dup && !state[e.id]).length;
  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>Organizasyon · toplama hiyerarşisi: idari · {data.units.length} birim · 4 hiyerarşi grubu</Kicker></div>
          <div className="col-6">
            <p className="display-xxl num red enter">{pending}</p>
            <h1 className="h2" style={{ marginTop: 'var(--s-2)' }}>taslak organizasyon değişikliği onayınızı bekliyor. Onay bir süreç başlatır; yarıda kesilirse kaldığı öğeden devam eder.</h1>
          </div>
          <div className="col-6 stack">
            <Kicker>Hiyerarşi grupları</Kicker>
            <table className="table"><tbody>
              <tr><td className="bold">İdari</td><td>toplama hiyerarşisi · skorlar burada toplanır · 2026-ANA</td></tr>
              <tr><td>Coğrafi</td><td>bölge görünürlüğü</td></tr>
              <tr><td>İK</td><td>İK İş Ortağı kapsamı</td></tr>
              <tr><td>Teknoloji</td><td>Şube sistemleri sorumluluğu</td></tr>
            </tbody></table>
          </div>
        </div>
      </section>
      <section className="section--tight surface-white">
        <div className="container rows">
          {events.map((e, i) => (
            <article key={i} className="rowline">
              <div className="stack-1">
                <Kicker>{e.id} · {e.type} · geçerlilik {fmtDate(e.date)} · {e.dup ? 'tekrar' : state[e.id] === 'approved' ? 'onaylandı' : state[e.id] === 'rejected' ? 'reddedildi' : 'taslak'}</Kicker>
                <h2 className="body-l bold">{e.desc}</h2>
                <p>{e.effect}</p>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button onClick={() => setState(s => ({ ...s, [e.id]: 'approved' }))} disabled={e.dup || !!state[e.id]} disabledReason={e.dup ? 'Aynı olay numarası zaten uygulanmış' : undefined}>Onayla</Button>
                <Button variant="secondary" onClick={() => setState(s => ({ ...s, [e.id]: 'rejected' }))} disabled={e.dup || !!state[e.id]}>Reddet</Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
