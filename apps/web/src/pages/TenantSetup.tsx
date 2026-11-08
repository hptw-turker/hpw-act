import { useState } from 'react';
import { Kicker } from '../components/Kicker';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
/** Müşteri kurulumu (HPTW): yeni bir müşteri şirketin tenant olarak açılması. Yedi adım; her adım kaydedilir, süreç yarıda kalırsa kaldığı yerden devam eder.
    Tek kırmızı: sıradaki adım numarası. Müşteri verisine HPTW girmez; kurulum yalnız çerçeveyi kurar. */
export default function TenantSetup() {
  const steps = [
    { no: 1, title: 'Şirket ve sözleşme', desc: 'Şirket adı, ülke ve veri yerleşimi (Türkiye / BAE), varsayılan dil, sözleşme dönemi, HPTW danışmanı.' },
    { no: 2, title: 'Kimlik ve giriş', desc: 'Şirketin e-posta alanı (@atlasholding.com.tr) → müşteri eşlemesi; tek oturum açma sağlayıcısı (Entra, Okta, Google) ya da HPTW hesabı; kullanıcı yaşam döngüsü kimlik dizininden otomatik. HPTW personeli ayrı kimlik alanından girer.' },
    { no: 3, title: 'Organizasyon', desc: 'Birimler ve ilişkiler: İK sisteminden ya da CSV ile; hiyerarşi grupları (idari, coğrafi, İK, teknoloji); toplama hiyerarşisi seçimi.' },
    { no: 4, title: 'Roller ve ilk kullanıcılar', desc: 'İlk İK Yöneticisi daveti; rol tipleri birimlere bağlanır (Şube Müdürü rolü × 400); kişiler kimlik dizininden ya da davetle rollere oturur.' },
    { no: 5, title: 'Şirket ayarları', desc: 'Gizlilik eşiği (asgari 5), hedef aralıkları, şiddet ağırlıkları, onay zinciri, onay modu, yük sınırları, kanıt politikası, saklama süreleri. Varsayılanlar HPTW politikasından gelir.' },
    { no: 6, title: 'Dönem ve metrik sürümü', desc: 'Anket dönemi (2026 Ana Ölçüm), metrik tanımları ve sürümleri, puanlama kuralı sürümü (HPTW-2026-02), karşılaştırma tabanı olacak önceki dönem.' },
    { no: 7, title: 'Sonuç bağlantısı ve açılış', desc: 'HPTW sonuç API/dosya bağlantısı; ilk içe alma; üst skor mutabakat testi; dönem açılışı. Bundan sonra program şirketin İK Yöneticisine geçer.' },
  ];
  const [done, setDone] = useState(0);
  const [form, setForm] = useState({ name: 'Beta Sigorta A.Ş.', region: 'tr', lang: 'tr', domain: 'betasigorta.com.tr', sso: 'entra' });
  const next = steps[done];
  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>Müşteri kurulumu · Happy Place to Work · her müşteri ayrı kiracı alanı, ayrı kimlik alanı, ayrı ayarlar, ayrı dönemler</Kicker></div>
          <div className="col-6">
            <p className="display-xxl num red enter">{next ? next.no : 7}</p>
            <h1 className="h2" style={{ marginTop: 'var(--s-2)' }}>{next ? `sıradaki adım: ${next.title}.` : 'Kurulum tamamlandı; dönem şirketin İK Yöneticisine devredildi.'}</h1>
            <p className="body-l measure" style={{ marginTop: 'var(--s-1)' }}>Yüz şirket aynı sistemde çalışır; her biri yalnız kendi verisini görür (satır düzeyi güvenlik, zorunlu). HPTW personeli müşteri verisine yalnız açıkça yetkilendirilmiş müşteri listesiyle ve denetim iziyle bakar.</p>
          </div>
          <div className="col-6 stack">
            {next && next.no === 1 ? (<>
              <div className="row">
                <div style={{ minWidth: '28ch' }}><Field id="t-name" type="text" label="Şirket adı" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div style={{ minWidth: '16ch' }}><Field id="t-region" kind="select" label="Veri yerleşimi" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}><option value="tr">Türkiye</option><option value="ae">BAE</option></Field></div>
                <div style={{ minWidth: '14ch' }}><Field id="t-lang" kind="select" label="Dil" value={form.lang} onChange={e => setForm(f => ({ ...f, lang: e.target.value }))}><option value="tr">Türkçe</option><option value="en">İngilizce</option><option value="ar">Arapça</option></Field></div>
              </div>
            </>) : next && next.no === 2 ? (<>
              <div className="row">
                <div style={{ minWidth: '26ch' }}><Field id="t-domain" type="text" label="E-posta alanı" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} hint="Bu alandan gelen e-postalar bu müşteriye yönlenir" /></div>
                <div style={{ minWidth: '20ch' }}><Field id="t-sso" kind="select" label="Giriş yöntemi" value={form.sso} onChange={e => setForm(f => ({ ...f, sso: e.target.value }))}><option value="entra">Kurumsal SSO · Entra</option><option value="okta">Kurumsal SSO · Okta</option><option value="google">Kurumsal SSO · Google</option><option value="hpw">HPTW hesabı (SSO yoksa)</option></Field></div>
              </div>
            </>) : null}
            <div className="row">
              <Button onClick={() => setDone(d => Math.min(7, d + 1))} disabled={done >= 7} disabledReason={done >= 7 ? 'Bütün adımlar tamamlandı' : undefined}>{next ? `${next.title} · kaydet ve ilerle` : 'Tamamlandı'}</Button>
              <Button variant="secondary" onClick={() => setDone(0)} disabled={done === 0}>Baştan başla</Button>
            </div>
            <p className="caption">{form.name} · {form.region === 'tr' ? 'Türkiye' : 'BAE'} · {form.domain} · {form.sso === 'hpw' ? 'HPTW hesabı' : 'kurumsal SSO'} · tamamlanan adım {done}/7</p>
          </div>
        </div>
      </section>
      <section className="section--tight surface-white">
        <div className="container table-wrap">
          <table className="table">
            <thead><tr><th className="num">Adım</th><th>Ne yapılır</th><th>Kim yapar</th><th>Durum</th></tr></thead>
            <tbody>
              {steps.map(s => (
                <tr key={s.no}><td className="num">{s.no}</td><td className={s.no === done + 1 ? 'bold' : ''}>{s.title}<span className="caption" style={{ display: 'block', marginTop: 4 }}>{s.desc}</span></td><td>{s.no <= 2 ? 'HPTW Sistem Yöneticisi' : s.no <= 5 ? 'HPTW danışmanı + şirket İK Yöneticisi' : s.no === 6 ? 'HPTW Metodolog + İK Yöneticisi' : 'HPTW danışmanı'}</td><td className="caption">{s.no <= done ? 'Tamamlandı' : s.no === done + 1 ? 'Sırada' : 'Bekliyor'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="section surface-ink">
        <div className="container grid">
          <div className="col-12"><Kicker>Kural</Kicker></div>
          <div className="col-8"><p className="h2">Bir sistem, yüz şirket, yüz ayrı dünya. Şirket kendi verisini görür, HPTW <span className="red">çerçeveyi</span> kurar ve sağlığı izler; hiçbir müşteri bir diğerinin varlığını bile görmez.</p></div>
        </div>
      </section>
      <section className="section--tight surface-white"><div className="container"><p className="caption">Her anket dönemi ayrı kurulur: dönem kodu, metrik sürümü, puanlama kuralı, karşılaştırma tabanı. Aynı şirkette birden çok dönem yan yana yaşar; önceki dönem yeni dönemin karşılaştırma tabanıdır.</p></div></section>
    </>
  );
}
