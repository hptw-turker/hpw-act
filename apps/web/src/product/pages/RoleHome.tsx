/** v2.13.2: rol bazlı sade ana ekranlar. Üst yönetim: DURUM / RİSK / KARAR (üç kart, "Detaya git"). Diğer müşteri rolleri: işine odaklı özet.
 * Veri yalnız mevcut uçlardan okunur; yetki, kural ve hesap değişmez. Teknik sayaçlar ve terimler ana ekranda gösterilmez; ayrıntı "Detaya git" ile mevcut ekranlardadır. */
import { tt } from '../i18n';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Kicker } from '../../components/Kicker';

type CT = Record<string, Record<string, number>>;
type Amb = { id: string; item_code: string; status: string; ambition_value?: number; cohort_size?: number };
type Att = { id?: string; title?: string; konu?: string; kind?: string; type?: string; importance?: string; status?: string }[];
type Act = { id: string; title: string; unit_name?: string; lifecycle_state: string; due_date: string | null };
const n = (ct: CT | null, g: string, k: string) => Number(ct?.[g]?.[k] ?? 0);
const today = () => new Date().toISOString().slice(0, 10);

export function ExecutiveHome({ tid }: { tid: string }) {
  const [ct, setCt] = useState<CT | null>(null); const [amb, setAmb] = useState<Amb[]>([]); const [att, setAtt] = useState<Att>([]); const [acts, setActs] = useState<Act[]>([]); const [ready, setReady] = useState(false);
  useEffect(() => { let on = true; Promise.all([
    api<CT>('GET', `/api/t/${tid}/corporate/control-tower`).catch(() => null),
    api<{ ambitions?: Amb[] } | Amb[]>('GET', `/api/t/${tid}/corporate/ambitions`).then(r => Array.isArray(r) ? r : (r.ambitions ?? [])).catch(() => []),
    api<Att | { items?: Att }>('GET', `/api/t/${tid}/attention`).then(r => Array.isArray(r) ? r : (r.items ?? [])).catch(() => []),
    api<Act[]>('GET', `/api/t/${tid}/actions`).catch(() => []),
  ]).then(([c, a, t, x]) => { if (!on) return; setCt(c); setAmb(a); setAtt(t); setActs(Array.isArray(x) ? x : []); setReady(true); }); return () => { on = false; }; }, [tid]);
  if (!ready) return <p className="caption">{tt('Yükleniyor')}</p>;
  const uzlasti = n(ct, 'ambitions', 'reconciled') || amb.filter(a => a.status === 'reconciled').length, acik = n(ct, 'ambitions', 'total') || amb.length;
  const devam = n(ct, 'actions', 'in_progress'), beyan = n(ct, 'actions', 'declared'), kapali = n(ct, 'actions', 'closed');
  const uyumlu = n(ct, 'cohort', 'aligned'), fark = n(ct, 'cohort', 'gap'), destek = n(ct, 'cohort', 'unsupported');
  const geciken = acts.filter(a => a.due_date && a.due_date < today() && ['planned', 'in_progress', 'paused'].includes(a.lifecycle_state));
  const sahipsiz = n(ct, 'queue', 'orphans'), bekleyenKarar = n(ct, 'queue', 'open'), istisna = n(ct, 'queue', 'exceptions');
  const durum: string[] = [];
  if (acik) durum.push(tt('{0} kurumsal öncelik tanımlı; {1} tanesinde birimlerle uyum sağlandı.', acik, uzlasti)); else durum.push(tt('Henüz kurumsal öncelik tanımlanmamış.'));
  if (devam + beyan + kapali) durum.push(tt('Aksiyonlar: {0} devam ediyor, {1} tamamlandı beyanı doğrulama bekliyor, {2} tamamlandı.', devam, beyan, kapali)); else durum.push(tt('Henüz yürürlükte aksiyon yok.'));
  if (uyumlu + fark + destek) durum.push(tt('İlgili birimlerin {0} tanesi kurumsal beklentiyle uyumlu, {1} tanesinde fark var.', uyumlu, fark));
  const risk: { konu: string; neden: string; kapsam: string }[] = [];
  if (geciken.length) risk.push({ konu: tt('{0} aksiyon termin tarihini geçti', geciken.length), neden: tt('Gecikme, hedefin takip döneminde ölçülebilir sonuç vermesini tehlikeye atar.'), kapsam: geciken.slice(0, 3).map(a => a.unit_name ?? a.title).join(', ') });
  if (fark + destek) risk.push({ konu: tt('Kurumsal beklenti ile yerel hedefler arasında fark var'), neden: tt('Birimler beklentiyi karşılayamayacağını bildirdi ya da katkı verecek durumda değil.'), kapsam: tt('{0} birimde fark, {1} birimde destek yok', fark, destek) });
  if (sahipsiz) risk.push({ konu: tt('{0} konunun sahibi yok', sahipsiz), neden: tt('Sahipsiz konu ilerlemez; önce bir sorumlu atanmalıdır.'), kapsam: tt('Bekleyen kararlar') });
  const karar: { konu: string; neden: string; bekleyen: string }[] = [];
  if (bekleyenKarar) karar.push({ konu: tt('{0} istisna / karşı teklif / kaynak isteği', bekleyenKarar), neden: tt('Birimler yerel gerçeklikle kurumsal beklenti arasındaki farkı bildirdi.'), bekleyen: tt('Kabul ya da ret') });
  if (istisna) karar.push({ konu: tt('{0} istisna talebi', istisna), neden: tt('Birim, beklentinin kendisi için geçerli olmadığını gerekçelendirdi.'), bekleyen: tt('İstisnayı onaylama ya da reddetme') });
  const kart = (baslik: string, soru: string, govde: React.ReactNode, link: string, testid: string) => (
    <div className="col-4 stack-1 exec-kart" data-testid={testid}><Kicker>{baslik}</Kicker><p className="h3">{soru}</p>{govde}<Link className="link" to={link}>{tt('Detaya git')}</Link></div>);
  return (<>
    <div className="col-12"><h1 className="h1">{tt('Yönetim özeti')}</h1><p className="body-l">{tt('Şirketin genel durumunu, yönetim dikkatine ihtiyaç duyan riskleri ve sizden beklenen kararları buradan takip edebilirsiniz.')}</p></div>
    {kart(tt('Durum'), tt('Şu anda neredeyiz?'), <ul className="notes">{durum.map((d, i) => <li key={i} className="body">{d}</li>)}</ul>, `/t/${tid}/kurumsal`, 'exec-durum')}
    {kart(tt('Risk'), tt('Nerede yönetim dikkatine ihtiyaç var?'), risk.length ? <div className="stack-1">{risk.slice(0, 3).map((r, i) => <div key={i}><p className="body bold">{r.konu}</p><p className="caption">{tt('Neden önemli?')}{' '}{r.neden}</p><p className="caption">{tt('Etkilenen kapsam:')}{' '}{r.kapsam}</p></div>)}</div> : <p className="body">{tt('Yönetim dikkatine ihtiyaç duyan kritik konu bulunmuyor.')}</p>, `/t/${tid}/kurumsal`, 'exec-risk')}
    {kart(tt('Karar'), tt('Benden hangi karar bekleniyor?'), karar.length ? <div className="stack-1">{karar.map((k, i) => <div key={i}><p className="body bold">{k.konu}</p><p className="caption">{tt('Neden karar gerekiyor?')}{' '}{k.neden}</p><p className="caption">{tt('Bekleyen karar:')}{' '}{k.bekleyen}</p></div>)}</div> : <p className="body">{tt('Şu anda sizden beklenen karar bulunmuyor.')}</p>, `/t/${tid}/dikkat`, 'exec-karar')}
    {att.length ? <div className="col-12"><p className="caption">{tt('Dikkat listenizde {0} konu var.', att.length)}{' '}<Link className="link" to={`/t/${tid}/dikkat`}>{tt('Bekleyen işler')}</Link></p></div> : null}
  </>);
}

/** Diğer müşteri rolleri: işine odaklı sade giriş; sayaçlar yerine cümleler */
export function RoleHome({ tid, profile }: { tid: string; profile: string | null }) {
  const [att, setAtt] = useState<Att | null>(null);
  useEffect(() => { let on = true; api<Att | { items?: Att }>('GET', `/api/t/${tid}/attention`).then(r => { if (on) setAtt(Array.isArray(r) ? r : (r.items ?? [])); }).catch(() => { if (on) setAtt([]); }); return () => { on = false; }; }, [tid]);
  const P = profile ?? '';
  const basliklar: Record<string, [string, string]> = { UNIT_MANAGER: ['Sonucum, hedefim, aksiyonlarım', 'Önce bekleyen işlerinize, sonra sonuçlarınıza bakın; hedef koyup aksiyonları buradan yönetirsiniz.'], REGION_MANAGER: ['Bölge durumu', 'Dikkat gereken birimlere, hedeflere ve aksiyonlara buradan ulaşırsınız.'], HR_PARTNER: ['Birimlerim', 'Kapsamınızdaki birimlerin riskleri, bekleyen hedefler, aksiyonlar ve doğrulama.'], ACTION_OWNER: ['Görevim', 'Size verilen aksiyonu uygular, her gerçekleşmeyi kaydeder ve kanıtlarsınız.'], VIEWER: ['Durum', 'Yetkili olduğunuz birimlerin sonuçlarını, hedeflerini ve aksiyonlarını görürsünüz.'] };
  const [h, alt] = basliklar[P] ?? ['Genel bakış', ''];
  const kart = (etiket: string, metin: string, link: string | null) => (<div className="col-4 stack-1 rol-kart"><Kicker>{etiket}</Kicker><p className="body">{metin}</p>{link ? <Link className="link" to={link}>{tt('Detaya git')}</Link> : null}</div>);
  const bekleyen = att === null ? tt('Yükleniyor') : att.length ? tt('{0} konu sizi bekliyor.', att.length) : tt('Şu anda bekleyen işiniz bulunmuyor.');
  return (<>
    <div className="col-12"><h1 className="h1">{tt(h)}</h1>{alt ? <p className="body-l">{tt(alt)}</p> : null}</div>
    {P !== 'VIEWER' ? kart(tt('Bekleyen işleriniz'), bekleyen, `/t/${tid}/dikkat`) : null}
    {P !== 'ACTION_OWNER' ? kart(tt('Sonuçlar'), tt('Dönem ve birim seçip her sorunun Top Box değerini ve şirketle farkını okuyun.'), `/t/${tid}/birimler`) : null}
    {P !== 'ACTION_OWNER' ? kart(tt('Hedefler'), P === 'VIEWER' ? tt('Hedeflerin durumunu izlersiniz.') : tt('Gelişim alanı seçin, önerilen hedef aralığını görün, gerekirse yapay zekâdan yardım alın ve hedefi oluşturun.'), `/t/${tid}/hedefler`) : null}
    {kart(tt('Aksiyonlar'), P === 'ACTION_OWNER' ? tt('Aksiyonunuzu açın, "AI planını gör" ile adımları okuyun, her gerçekleşmeyi "Kaydı ekle" ile kaydedin.') : P === 'VIEWER' ? tt('Aksiyonların hangi aşamada olduğunu görürsünüz.') : tt('Hedefe aksiyon açın ya da plandan aktarın; gerçekleşmeleri ve kanıtları buradan izleyin.'), `/t/${tid}/aksiyonlar`)}
    {['UNIT_MANAGER', 'REGION_MANAGER', 'HR_PARTNER'].includes(P) ? kart(tt('Takip'), tt('Takip dönemi gelince hedefin tutup tutmadığını aynı madde için karşılaştırın.'), `/t/${tid}/takip`) : null}
  </>);
}
