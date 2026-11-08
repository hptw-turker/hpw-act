import { useState } from 'react';
import { usePersona } from '../state/persona';
import { Kicker } from '../components/Kicker';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
/** Ayarlar: müşteri şirket (İK Yöneticisi) ya da sistem (HPTW). Eşikler, ağırlıklar, kohort politikası, onay zinciri, saklama. Tek kırmızı: kaydet düğmesi. */
export default function Settings() {
  const { persona } = usePersona(); const platform = persona.scope === 'platform';
  const [formKey, setFormKey] = useState(0); const [saved, setSaved] = useState<number | null>(null);
  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>{platform ? 'Sistem ayarları · Happy Place to Work' : 'Şirket ayarları · Atlas Holding'} · sürümlü · her değişiklik denetim izine yazılır</Kicker></div>
          <div className="col-6 stack-4">
            <h1 className="h1">{platform ? 'Varsayılanlar merkezde, kararlar müşteri şirkette.' : 'Kural burada yazılır, ekranda tartışılmaz.'}</h1>
            <p className="body-l measure">{platform ? 'Kotalar, hedef aralıkları ve hesaplama sürümleri sistem düzeyinde tanımlanır; müşteri şirket yalnız izin verilen aralıkta değiştirir.' : 'Gizlilik eşiği, hedef aralıkları, birim kümesi kuralı ve onay zinciri şirket düzeyindedir. Değişiklik yürüyen dönemi etkilemez; yeni dönemde geçerli olur.'}</p>
          </div>
          <div className="col-6 stack" key={formKey}>
            {platform ? (<>
              <Field id="q1" type="number" label="Müşteri sınırı · toplu işlem / gün" defaultValue={200} />
              <Field id="q2" type="number" label="Müşteri sınırı · bildirim / saat" defaultValue={5000} />
              <Field id="q3" kind="select" label="Dağıtım hesabı sürümü" defaultValue="2.1"><option value="2.1">Sürüm 2.1 (dondurulmuş birim kümesi)</option><option value="2.0">Sürüm 2.0</option></Field>
              <Field id="q4" kind="select" label="Süreç yürütücü" defaultValue="yerlesik"><option value="yerlesik">Yerleşik adım yürütücü (Faz 0)</option><option value="harici">Harici süreç motoru (Faz 2)</option></Field>
            </>) : (<>
              <Field id="s1" type="number" label="Gizlilik eşiği (skor)" defaultValue={5} hint="Yorumlar için 10 · sistem asgarisi 5, düşürülemez" />
              <Field id="s2" kind="select" label="Birim kümesi kuralı (varsayılan)" defaultValue="dondurulmus"><option value="dondurulmus">Başlangıç organizasyonu, dondurulmuş</option><option value="bugunku">Bugünkü organizasyon, canlı</option><option value="gecmis">Geçmiş bağı düzeltmeli (bölünme / birleşme)</option></Field>
              <Field id="s3" kind="select" label="Onay zinciri" defaultValue="two"><option value="one">Tek kademe: üst yönetici</option><option value="two">İki kademe: üst yönetici + İK İş Ortağı</option></Field>
              <Field id="s4" type="text" label="Hedef aralıkları — kalıcı taban (skor &lt;55 / 55–74 / ≥75)" defaultValue="+3…+10 / +2…+7 / +1…+4" hint="Akran dağılımı (≥30 benzer birim) varsa önce o kullanılır; bant geri çekilme zincirinin son basamağıdır" />
              <Field id="s6" type="text" label="Şiddet ağırlıkları (ihtiyaç / eğilim / göreli açık / genişlik / etki / strateji)" defaultValue="0,35 / 0,20 / 0,15 / 0,15 / 0,10 / 0,05" />
              <Field id="s7" type="text" label="Şiddet eşikleri (kritik / önerilen / izle) · asgari veri güveni" defaultValue="75 / 55 / 30 · 0,50" />
              <Field id="s8" type="number" label="Anlamlı en küçük hareket (puan)" defaultValue={1.5} step={0.5} hint="Altında hedef türü 'koru' olur" />
              <Field id="s9" kind="select" label="Onay modu" defaultValue="acik"><option value="acik">Açık onay (ilk dönem)</option><option value="politika">Politika tabanlı toplu onay, yalnız istisnada insan</option></Field>
              <Field id="s5" type="number" label="Kanıt saklama süresi (ay)" defaultValue={36} hint="Yasal bekletme silmeyi durdurur" />
            </>)}
            <div className="row"><Button variant="red" onClick={() => setSaved(v => (v ?? 4) + 1)}>Kaydet (yeni sürüm)</Button><Button variant="secondary" onClick={() => { setFormKey(k => k + 1); setSaved(null); }}>Vazgeç</Button></div>
            {saved ? <p className="caption">Kaydedildi · ayar sürümü {saved} · denetim izine yazıldı · yeni dönemde geçerli</p> : null}
          </div>
        </div>
      </section>
    </>
  );
}
