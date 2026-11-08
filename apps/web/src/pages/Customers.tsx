import { Kicker } from '../components/Kicker';
import { Score } from '../components/Score';
/** Müşteriler (Happy Place to Work): çok müşterili görünüm yalnız açıkça yetkilendirilmiş müşteri listesiyle. Tek kırmızı: hizmet hedefi dışındaki müşteri sayısı. usage = kullanım sınırı oranı. */
export default function Customers() {
  const rows = [
    { name: 'Atlas Holding', region: 'Türkiye', units: 737, users: 2400, cycle: '2026 Ana Ölçüm', lag: 41, queue: 12400, usage: 61, ok: false },
    { name: 'Beta Sigorta', region: 'Türkiye', units: 84, users: 310, cycle: '2026 Ana Ölçüm', lag: 4, queue: 120, usage: 92, ok: true },
    { name: 'Gamma Perakende', region: 'Türkiye', units: 412, users: 1150, cycle: '2026 Bahar', lag: 9, queue: 860, usage: 38, ok: true },
    { name: 'Delta Lojistik (Körfez)', region: 'BAE', units: 96, users: 280, cycle: '2026 3. Çeyrek', lag: 6, queue: 45, usage: 21, ok: true },
  ];
  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>Müşteriler · 4 aktif · veri yerleşimi Türkiye / BAE · yalnız yetkilendirilmiş müşteri listesi görünür · her müşteri ayrı kiracı alanı, kimlik alanı, ayarlar ve dönemler</Kicker></div>
          <div className="col-6">
            <p className="display-xxl num red enter">{rows.filter(r => !r.ok).length}</p>
            <h1 className="h2" style={{ marginTop: 'var(--s-2)' }}>müşteri hizmet hedefinin dışında. Görünüm gecikmesi ekranlarda tazelik uyarısı olarak çıkar; kayıt işlemleri etkilenmez.</h1>
          </div>
          <div className="col-6 stack">
            <Kicker>Hizmet hedefleri</Kicker>
            <table className="table"><tbody>
              <tr><td>Skor okuma (isteklerin %95'i)</td><td className="num">≤ 300 ms</td></tr><tr><td>Hedef onayı (isteklerin %95'i)</td><td className="num">≤ 800 ms</td></tr>
              <tr><td>Görünüm gecikmesi</td><td className="num">≤ 30 sn</td></tr><tr><td>Bildirim teslimi</td><td className="num">≤ 60 sn</td></tr>
              <tr><td>Veri kaybı / kurtarma süresi</td><td className="num">5 dk / 30 dk</td></tr>
            </tbody></table>
          </div>
        </div>
      </section>
      <section className="section--tight surface-white">
        <div className="container table-wrap">
          <table className="table">
            <thead><tr><th>Müşteri</th><th>Veri yerleşimi</th><th className="num">Birim</th><th className="num">Kullanıcı</th><th>Dönem</th><th className="num">Görünüm gecikmesi (sn)</th><th className="num">Kuyruk</th><th className="num">Kullanım sınırı</th></tr></thead>
            <tbody>{rows.map(r => <tr key={r.name}><td className="bold">{r.name}</td><td>{r.region}</td><td className="num">{r.units}</td><td className="num">{r.users}</td><td>{r.cycle}</td><td className={`num ${r.ok ? '' : 'bold'}`}>{r.lag}</td><td className="num">{r.queue}</td><td className="num">%<Score value={r.usage} digits={0} /></td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
