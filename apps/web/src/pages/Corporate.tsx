import { useState } from 'react';
import { useI18n } from '../i18n';
import { data, corporate } from '../api/mock';
import { usePersona } from '../state/persona';
import { Kicker } from '../components/Kicker';
import { Button } from '../components/Button';
import { Score, Delta } from '../components/Score';
import { Field } from '../components/Field';
/** Kurumsal görünüm (Genel Müdür / GMY): tek dev sayı şirket skoru; Control Tower soruları tablo; siyah bölümde tek tez. */
export default function Corporate() {
  const { fmt } = useI18n(); const { persona } = usePersona();
  const [target, setTarget] = useState(corporate.ambition); const [editing, setEditing] = useState(false); const [approved, setApproved] = useState<number | null>(null);
  const [decision, setDecision] = useState<string | null>(null);
  const upperScenario = corporate.upperScenario; const supported = corporate.supported;
  const status = target <= supported ? 'SUPPORTED' : target <= upperScenario ? 'GAP' : 'UNSUPPORTED';
  const OPTS: [string, string][] = [['LOWER_AMBITION', 'Hedefi desteklenene çek'], ['ACCEPT_STRETCH_WITHIN_BOUNDS', 'Esnetmeyi bilerek kabul et (tavanlar içinde)'], ['ADD_CENTRAL_INTERVENTION', 'Merkezi müdahale ekle'], ['CHANGE_TIME_HORIZON', 'Süreyi uzat']];
  const gmys = data.units.filter(u => u.type === 'gmy').slice(0, 12).map((g, i) => ({ name: g.name.replace(' GMY', ''), trust: [58.2, 61.9, 66.4, 52.8, 63.1, 67.0, 68.4, 60.2, 65.5, 62.7, 59.8, 57.1][i]!, units: [420, 260, 35, 13, 44, 12, 9, 18, 8, 6, 11, 40][i]!, feasible: i !== 3 && i !== 11 }));
  const company = data.company;
  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>Kurumsal görünüm · {persona.unitLabel} · 2026 Ana Ölçüm · istenen değer: GUV-01 "Bağlı olduğum yönetici bana bireysel ilgi gösterir" (madde) · Wellbeing Index yalnız görünüm</Kicker></div>
          <div className="col-6">
            <p className="display-xxl num red enter"><Score value={company.trust} /></p>
            <h1 className="h2" style={{ marginTop: 'var(--s-2)' }}>Şirket Güven skoru. İstenen {fmt(target, target % 1 ? 1 : 0)}; yerel önerilerin projeksiyonu {fmt(supported)}; mevcut politika altındaki üst senaryo {fmt(upperScenario)}.</h1>
            <p className="caption" style={{ marginTop: 'var(--s-1)' }}>{status === 'SUPPORTED' ? 'İstenen değer yerel hedeflerle destekleniyor' : status === 'GAP' ? `Fark ${fmt(target - supported)} puan: dağıtılmaz, karar sizin` : 'Mevcut planla desteklenmiyor: üst senaryonun üstünde (imkânsızlık kanıtı değil)'}</p>
          </div>
          <div className="col-6 stack">
            <Kicker>Kontrol kulesi</Kicker>
            <table className="table"><tbody>
              <tr><td>İstenen / projeksiyon / üst senaryo</td><td className="num bold">{fmt(target, target % 1 ? 1 : 0)} / {fmt(supported)} / {fmt(upperScenario)}</td></tr>
              <tr><td>Hedefi olmayan birim</td><td className="num">0 / 737</td></tr>
              <tr><td>Aksiyonu olmayan hedef</td><td className="num">61</td></tr>
              <tr><td>Sahipsiz aksiyon</td><td className="num">41</td></tr>
              <tr><td>Uygulandı ama etkisiz (2025)</td><td className="num">3 aksiyon türü</td></tr>
              <tr><td>Kim hedefi tuttu (2025 → 2026)</td><td className="num">184 / 291 birim · karşılaştırılabilir %88</td></tr>
            </tbody></table>
            {status !== 'SUPPORTED' && !decision && !editing ? (
              <div className="stack-1">
                <Kicker>Seçenekler</Kicker>
                <div className="row">{OPTS.filter(([k]) => status === 'UNSUPPORTED' ? k !== 'ACCEPT_STRETCH_WITHIN_BOUNDS' : true).map(([k, v]) => <Button key={k} variant="secondary" onClick={() => { if (k === 'LOWER_AMBITION') setTarget(supported); setDecision(k); }}>{v}</Button>)}</div>
              </div>
            ) : null}
            {decision ? <p className="caption">Karar: {OPTS.find(o => o[0] === decision)?.[1]} · uzlaştırma kaydına yazıldı</p> : null}
            {editing ? (
              <div className="row">
                <div style={{ width: '12ch' }}><Field id="corp-target" type="number" label="Kurumsal hedef" value={target} min={55} max={90} step={0.5} onChange={e => setTarget(Number(e.target.value))} /></div>
                <Button onClick={() => { setEditing(false); setDecision(null); }}>Uygula</Button>
                <Button variant="secondary" onClick={() => { setTarget(68); setEditing(false); }}>Vazgeç</Button>
              </div>
            ) : (
              <div className="row">
                <Button onClick={() => setApproved(target)} disabled={approved !== null || (status !== 'SUPPORTED' && !decision)} disabledReason={approved !== null ? `Onaylandı: ${fmt(approved, approved % 1 ? 1 : 0)} · yerel hedefler aktif, uzlaştırma kaydı kapandı` : status !== 'SUPPORTED' && !decision ? 'Önce fark için karar verin' : undefined}>Kurumsal hedefi onayla ({fmt(target, target % 1 ? 1 : 0)})</Button>
                <Button variant="secondary" onClick={() => setEditing(true)} disabled={approved !== null}>Değiştir</Button>
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="section--tight surface-white">
        <div className="container table-wrap">
          <table className="table">
            <thead><tr><th>GMY</th><th className="num">Güven</th><th className="num">Şirkete göre</th><th className="num">Birim</th><th>Hedef fizibilitesi</th><th>Kaldıraç (sorun yeri)</th></tr></thead>
            <tbody>
              {gmys.map(g => (
                <tr key={g.name}><td className="bold">{g.name}</td><td className="num"><Score value={g.trust} /></td><td className="num"><Delta value={g.trust - company.trust} /></td><td className="num">{g.units}</td>
                  <td className="caption">{g.feasible ? 'Destekleniyor' : 'Fark var'}</td><td>{g.name === 'Bireysel İşler' ? 'Vardiya planlama (kurumsal)' : g.name === 'Operasyon' ? 'Fiziksel koşullar (fonksiyonel)' : 'Yönetici iletişimi (yerel)'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="section surface-ink">
        <div className="container grid">
          <div className="col-12"><Kicker>Tez</Kicker></div>
          <div className="col-8"><p className="h2">Skor sonuç, hedef niyet, aksiyon iş, kanıt beyanın karşılığı, etki ölçüm. Bu panel beşini <span className="red">ayrı</span> gösterir; hiçbirini diğerinden türetmez.</p></div>
        </div>
      </section>
      <section className="section--tight surface-white"><div className="container"><p className="caption">Yeniden ölçüm: 2027 Ana Ölçüm · karşılaştırılabilirlik kapısından geçmeyen birimlerde "tuttu / tutmadı" yazılmaz.</p></div></section>
    </>
  );
}
