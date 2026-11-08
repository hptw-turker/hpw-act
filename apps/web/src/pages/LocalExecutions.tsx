import { useState } from 'react';
import { useI18n } from '../i18n';
import { data } from '../api/mock';
import { Kicker } from '../components/Kicker';
import { DistributionBars } from '../components/DistributionBars';
import { Button } from '../components/Button';
/** Ana aksiyonun tek "tamamlandı" durumu yoktur; dağılım gösterilir. Tek kırmızı: gecikmiş satır. */
export default function LocalExecutions() {
  const { t, fmt, fmtDate } = useI18n();
  const m = data.masterAction; const total = Object.values(m.distribution).reduce((s, v) => s + v, 0);
  const [note, setNote] = useState<string | null>(null);
  const done = (m.distribution.verified + m.distribution.partially_verified) / total;
  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>{t('exec.kicker')} · {m.title}</Kicker></div>
          <div className="col-6">
            <p className="display-xxl num enter">%{fmt(done * 100, 0)}</p>
            <h1 className="h2" style={{ marginTop: 'var(--s-2)' }}>Doğrulanan yerel uygulama. {t('exec.threshold')} %{fmt(m.completionThreshold * 100, 0)}; bu ana aksiyon henüz "tamamlandı" değildir.</h1>
          </div>
          <div className="col-6"><DistributionBars distribution={m.distribution} total={total} highlight="delayed" /></div>
        </div>
      </section>
      <section className="section surface-ink">
        <div className="container grid">
          <div className="col-12"><Kicker>Kural</Kicker></div>
          <div className="col-8"><p className="h2">Merkez "yaptık" dediğinde 400 şubede ne olduğu değişmez. Uygulama <span className="red">şubede</span> olur, kanıtı şube verir, etkisi şubede ölçülür.</p></div>
        </div>
      </section>
      <section className="section surface-white">
        <div className="container stack-4">
          <div className="row row--between">
            <Kicker>{t('exec.delayedList')} · {m.distribution.delayed}</Kicker>
            <div className="row"><Button variant="secondary" onClick={() => setNote(`${m.distribution.delayed} şubeye hatırlatma gönderildi · uygulama içi + e-posta · teslim makbuzu bekleniyor`)}>{t('exec.remind')}</Button><Button variant="secondary" onClick={() => setNote('Konu bölge müdürlerine iletildi · dikkat kuyruklarına düştü · 5 iş günü')}>{t('exec.escalate')}</Button></div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Şube</th><th>Sahip</th><th className="num">Termin</th><th className="num">Gecikme</th><th>Son durum bildirimi güveni</th></tr></thead>
              <tbody>
                {data.units.filter(u => u.type === 'branch').slice(40, 48).map((u, i) => (
                  <tr key={u.id}><td>{u.name}</td><td>{data.units.length ? 'Şube Müdürü' : ''}</td><td className="num">{fmtDate('2026-09-15')}</td><td className="num">{7 + i * 3} gün</td><td className="caption">{i % 3 === 0 ? 'Düşük' : 'Orta'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {note ? <p className="bold">{note}</p> : null}
          <p className="caption">{m.distribution.delayed - 8} şube daha · merkezi uyarı: %20 gecikme eşiği aşıldı mı? Hayır (%9).</p>
        </div>
      </section>
    </>
  );
}
