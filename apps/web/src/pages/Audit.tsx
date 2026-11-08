import { useI18n } from '../i18n';
import { Kicker } from '../components/Kicker';
/** Denetim (Happy Place to Work Denetçi): yalnız eklenen denetim izi; aktör referansla, kişisel veri yok. Salt okunur; kırmızı: tek satır (görev ayrımı ihlali denemesi). */
export default function Audit() {
  const { fmtDate } = useI18n();
  const rows = [
    { at: '2026-09-22T14:32:00Z', entity: 'Hedef', id: 'hedef-ege-guven', action: 'onay', actor: 'kişi:İKİO-A', ver: '11 → 12', corr: 'zincir-8f2a', note: 'hedef tarihi değişti' },
    { at: '2026-09-22T14:32:07Z', entity: 'Hedef', id: 'hedef-ege-guven', action: 'ret (sürüm çatışması)', actor: 'kişi:İKİO-B', ver: '11 ≠ 12', corr: 'zincir-8f2b', note: 'değişen alan: sahip' },
    { at: '2026-09-22T14:40:12Z', entity: 'Aksiyon', id: 'aksiyon-konak-vardiya', action: 'durum bildirimi reddi', actor: 'kişi:sahip-konak', ver: '7', corr: 'zincir-91c0', note: 'kayıt bu arada iptal edilmiş → yorum olarak eklendi' },
    { at: '2026-09-22T09:10:44Z', entity: 'Kanıt', id: 'kanıt-4471', action: 'doğrulama reddedildi', actor: 'kişi:sahip-118', ver: '—', corr: 'zincir-77a1', note: 'görev ayrımı: doğrulayıcı = yükleyen', red: true },
    { at: '2026-09-21T16:05:30Z', entity: 'Organizasyon değişikliği', id: 'İKS-ORG-2026-002', action: 'tekilleştirme', actor: 'bağlantı:ik-sistemi', ver: '—', corr: 'zincir-5d10', note: 'aynı olay numarası zaten uygulanmış' },
    { at: '2026-09-21T11:48:02Z', entity: 'Kişi', id: 'anonim:7f3e', action: 'anonimleştirme', actor: 'görev:saklama', ver: '—', corr: 'zincir-2b9e', note: 'silme talebi tamamlandı; referans anonim kimliğe döndü' },
  ];
  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>Denetim izi · yalnız eklenir, değiştirilmez · kişisel veri referansla · son 48 saat</Kicker></div>
          <div className="col-8"><h1 className="h1">Tarih yeniden yazılmaz.</h1><p className="body-l measure" style={{ marginTop: 'var(--s-2)' }}>Her komut numarası, sürümü ve olay zinciriyle burada. Silme, aktör referansını anonim kimliğe çevirir; kaydı silmez.</p></div>
        </div>
      </section>
      <section className="section--tight surface-white">
        <div className="container table-wrap">
          <table className="table">
            <thead><tr><th>Zaman</th><th>Kayıt</th><th>İşlem</th><th>Aktör (referans)</th><th className="num">Sürüm</th><th>Zincir</th><th>Not</th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}><td className="num">{fmtDate(r.at)} {r.at.slice(11, 16)}</td><td>{r.entity} · {r.id}</td><td className={r.red ? 'bold red' : 'bold'}>{r.action}</td><td>{r.actor}</td><td className="num">{r.ver}</td><td className="caption">{r.corr}</td><td>{r.note}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
