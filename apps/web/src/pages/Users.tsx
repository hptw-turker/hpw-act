import { useState } from 'react';
import { Kicker } from '../components/Kicker';
import { Field } from '../components/Field';
import { Button } from '../components/Button';
import { PERSONAS } from '../personas';
/** Kullanıcılar ve roller (HR Admin): rol atamaları, vekâletler, sahipsiz iş. Tek kırmızı: sahipsiz iş sayısı. */
export default function Users() {
  const [assign, setAssign] = useState<Record<string, string | 'choosing' | undefined>>({});
  const candidates = ['Deniz Koç (Bölge Direktörü)', 'Emre Çelik (İK İş Ortağı)', 'Ayşe Yılmaz (Konak Şube Müdürü)', 'Yeni işe alım (bekleniyor)'];
  const orphans = [{ who: 'Şube 302 Müdürü (ayrıldı 12.09)', items: '3 hedef · 6 aksiyon', tmp: 'İzmir Alan Müdürlüğü 3' }, { who: 'Şube 303 Müdürü (ayrıldı 12.09)', items: '3 hedef · 5 aksiyon', tmp: 'İzmir Alan Müdürlüğü 3' }, { who: 'Şube 305 Müdürü (ayrıldı 15.09)', items: '3 hedef · 4 aksiyon', tmp: 'İzmir Alan Müdürlüğü 3' }, { who: 'Operasyon Merkezi 2 Müdürü (ayrıldı 18.09)', items: '4 hedef · 9 aksiyon', tmp: 'Operasyon GMY' }];
  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>Kullanıcılar ve roller · kimlik dizini bağlı · 2.400 yönetici · 20 aktif vekâlet</Kicker></div>
          <div className="col-6">
            <p className="display-xxl num red enter">64</p>
            <h1 className="h2" style={{ marginTop: 'var(--s-2)' }}>sahipsiz iş: 8 yönetici ayrıldı, geçici sorumlu atandı, yeni sahip bekleniyor.</h1>
          </div>
          <div className="col-6 stack">
            <div className="rows">
              {orphans.map(o => (
                <div key={o.who} className="rowline"><div className="stack-1"><Kicker>{o.items} · geçici: {o.tmp}</Kicker><p className="bold">{o.who}</p>{assign[o.who] && assign[o.who] !== 'choosing' ? <p className="caption">Yeni sahip: {assign[o.who]} · ilk girişte devir ekranı açılır</p> : null}</div>
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    {assign[o.who] === 'choosing' ? <><div style={{ minWidth: '26ch' }}><Field id={`np-${o.who}`} kind="select" label="Yeni sahip" defaultValue={candidates[0]}>{candidates.map(c => <option key={c}>{c}</option>)}</Field></div><Button onClick={() => { const el = document.getElementById(`np-${o.who}`) as HTMLSelectElement | null; setAssign(a => ({ ...a, [o.who]: el?.value ?? candidates[0] })); }}>Ata</Button></>
                      : <Button variant="secondary" onClick={() => setAssign(a => ({ ...a, [o.who]: 'choosing' }))} disabled={!!assign[o.who]}>Yeni sahip ata</Button>}
                  </div></div>
              ))}
            </div>
            <p className="caption">{Object.values(assign).filter(v => v && v !== 'choosing').length} atandı · 4 yönetici daha · toplu atama ve devir ekranı yeni sahip ilk girişte açılır</p>
          </div>
        </div>
      </section>
      <section className="section--tight surface-white">
        <div className="container table-wrap">
          <table className="table">
            <thead><tr><th>Kişi</th><th>Rol</th><th>Kapsam</th><th>Hiyerarşi grubu</th><th>Vekâlet</th><th>Görev ayrımı</th></tr></thead>
            <tbody>
              {PERSONAS.filter(p => p.org === 'Atlas Holding').map(p => (
                <tr key={p.id}><td className="bold">{p.name}</td><td>{p.roleLabel}</td><td>{p.unitLabel}</td><td className="caption">{p.scope === 'region' ? 'İdari + Coğrafi' : p.scope === 'unit' ? 'İdari' : p.scope === 'tenant' ? 'Tümü' : 'İdari'}</td>
                  <td>{p.id === 'branch_manager' ? '→ Can Öztürk (izin, 01.06–01.09)' : '—'}</td><td className="caption">{p.roleCode === 'hr_admin' ? 'Veri yöneticisi ≠ teknik yönetici' : p.roleCode === 'line_manager' ? 'Kritik kanıtta doğrulayıcı olamaz' : '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
