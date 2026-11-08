/** v2.14 Tasarım B — rol ana ekranları. Gündem düzeni: önce sizden beklenen karar/iş, sonra risk, sonra durum (ilke 2).
 * Veri yalnız mevcut uçlardan okunur; yetki, kural ve hesap değişmez. Üst yönetim: Durum / Risk / Karar üç büyük başlık; diğer roller: bekleyen iş, aksiyonlar, kısayollar. */
import { tt, locale } from '../i18n';
import React from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { trl } from '../labels';
import { useLoad } from '../hooks';
import { LoadError } from './Chain';
import { useRoadmapSummary, roadmapVisible, RoadmapHomeSection } from './Roadmap';
import { Ekran, Not, Baslik, Buyuk, Bolum, Tablo, Kare, KareLeg } from '../ui/tb';

type CT = Record<string, Record<string, number>>;
type Amb = { id: string; item_code: string; status: string; ambition_value?: number; cohort_size?: number };
type Att = { id?: string; title?: string; konu?: string; kind?: string; type?: string; severity?: string; importance?: string; status?: string; route?: string; unitId?: string | null; cycleId?: string | null; entityId?: string }[];
type Act = { id: string; title: string; unit_id?: string; unit_name?: string; lifecycle_state: string; due_date: string | null; valid_evidence?: number; fulfilled_slots?: number; requirement?: { expected: number; label?: string }; targets?: { itemCode: string }[] | null };
const n = (ct: CT | null, g: string, k: string) => Number(ct?.[g]?.[k] ?? 0);
const today = () => new Date().toISOString().slice(0, 10);
const GUN = (d: Date | string) => new Date(d).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
const ROUTES: Record<string, string> = { results: 'donemler', users: 'kullanicilar', targets: 'hedefler', actions: 'aksiyonlar' };
const attLink = (tid: string, i: Att[number]) => `/t/${tid}/${ROUTES[i.route ?? ''] ?? 'dikkat'}${i.unitId ? `?unit=${i.unitId}${i.cycleId ? '&cycle=' + i.cycleId : ''}${i.entityId ? (i.route === 'actions' ? '&action=' : i.route === 'targets' ? '&target=' : '&sel=') + i.entityId : ''}` : ''}`;

export function ExecutiveHome({ tid, ust }: { tid: string; ust?: React.ReactNode }) {
  // v2.14.1 (A01): her kaynak ayrı yüklenir; hata boş sonuca çevrilmez. Yükleniyor / hata / başarılı ayrı; kısmi hatada sağlıklı bölümler verisini korur.
  const ctq = useLoad<CT>(`ct|${tid}`, async signal => api<CT>('GET', `/api/t/${tid}/corporate/control-tower`, undefined, { signal }));
  const ambq = useLoad<Amb[]>(`amb|${tid}`, async signal => { const r = await api<{ ambitions?: Amb[] } | Amb[]>('GET', `/api/t/${tid}/corporate/ambitions`, undefined, { signal }); return Array.isArray(r) ? r : (r.ambitions ?? []); });
  const attq = useLoad<Att>(`att|${tid}`, async signal => { const r = await api<Att | { items?: Att }>('GET', `/api/t/${tid}/attention`, undefined, { signal }); return Array.isArray(r) ? r : (r.items ?? []); });
  const actq = useLoad<Act[]>(`act|${tid}`, async signal => { const r = await api<Act[]>('GET', `/api/t/${tid}/actions`, undefined, { signal }); return Array.isArray(r) ? r : []; });
  const yukleniyor = [ctq, ambq, attq, actq].some(q => q.status === 'loading' || q.status === 'idle');
  const ct = ctq.data, amb = ambq.data ?? [], att = attq.data ?? [], acts = actq.data ?? [];
  const hata = (qs: { status: string; message: string | null; reload: () => Promise<boolean> }[]) => { const h = qs.filter(q => q.status === 'error'); return h.length ? <LoadError message={h.map(q => q.message).filter(Boolean).join(' · ') || tt('Veri alınamadı')} retry={() => { h.forEach(q => { void q.reload(); }); }} /> : null; };
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
  const kararHata = hata([ctq]), riskHata = hata([ctq, actq]), durumHata = hata([ctq, ambq]);
  const yh = useRoadmapSummary(tid, true); const yhVar = roadmapVisible(yh); // v2.15.0: yol haritası yüklüyse 4. bölüm
  const bas = (h: React.ReactNode, ok: React.ReactNode) => yukleniyor ? '…' : h ? '—' : ok;
  return <main className="tb"><div className="wrap"><Ekran baslik={tt('Yönetim özeti')}>{ust}
    <Baslik kicker={`${tt('Gündem')} · ${GUN(new Date())}`} h1={tt('Yönetim özeti')} cap={tt('Şirketin genel durumunu, yönetim dikkatine ihtiyaç duyan riskleri ve sizden beklenen kararları buradan takip edebilirsiniz.')} />
    <Not baslik={tt('Gündem')}>{tt('Gündem önem sırasıyla dizilir: önce sizden beklenen karar, sonra dikkat isteyen konular, en son genel durum.')}</Not>
    <Buyuk hucreler={[{ ol: tt('Sizden beklenen karar'), sayi: bas(kararHata, karar.length ? tt('{0} konu', karar.length) : tt('Yok')), p: yukleniyor ? tt('Yükleniyor') : kararHata ? tt('Veri alınamadı') : karar.length ? karar[0]!.konu : tt('Şu anda sizden beklenen karar bulunmuyor.'), red: true }, { ol: tt('Dikkat isteyen konu'), sayi: bas(riskHata, risk.length ? tt('{0} konu', risk.length) : tt('Yok')), p: yukleniyor ? tt('Yükleniyor') : riskHata ? tt('Veri alınamadı') : risk.length ? risk[0]!.konu : tt('Yönetim dikkatine ihtiyaç duyan kritik konu bulunmuyor.') }, { ol: tt('Genel durum'), sayi: bas(durumHata, acik ? tt('{0} öncelik', acik) : tt('Öncelik yok')), p: yukleniyor ? tt('Yükleniyor') : durumHata ? tt('Veri alınamadı') : durum[0] ?? '' }]} />
    <div data-testid="exec-karar"><Bolum n="1" ilk kicker={tt('Karar')} soru={tt('Benden hangi karar bekleniyor?')} red dugmeler={<Link className="btn btn--secondary" to={`/t/${tid}/dikkat`}>{tt('Detaya git')}</Link>}>
      {yukleniyor ? <p className="cap">{tt('Yükleniyor')}</p> : kararHata ? kararHata : karar.length ? <Tablo bas={[tt('Konu'), tt('Neden karar gerekiyor?'), tt('Bekleyen karar')]} satirlar={karar.map(k => [<span className="bold">{k.konu}</span>, <span className="cap">{k.neden}</span>, k.bekleyen])} /> : <p>{tt('Şu anda sizden beklenen karar bulunmuyor.')}</p>}
    </Bolum></div>
    <div data-testid="exec-risk"><Bolum n="2" kicker={tt('Risk')} soru={tt('Nerede yönetim dikkatine ihtiyaç var?')} dugmeler={<Link className="btn btn--secondary" to={`/t/${tid}/kurumsal`}>{tt('Detaya git')}</Link>}>
      {yukleniyor ? <p className="cap">{tt('Yükleniyor')}</p> : riskHata ? riskHata : risk.length ? <Tablo bas={[tt('Konu'), tt('Neden önemli?'), tt('Etkilenen kapsam:')]} satirlar={risk.slice(0, 3).map(r => [<span className="bold">{r.konu}</span>, <span className="cap">{r.neden}</span>, <span className="cap">{r.kapsam}</span>])} /> : <p>{tt('Yönetim dikkatine ihtiyaç duyan kritik konu bulunmuyor.')}</p>}
    </Bolum></div>
    <div data-testid="exec-durum"><Bolum n="3" kicker={tt('Durum')} soru={tt('Şu anda neredeyiz?')} dugmeler={<Link className="btn btn--secondary" to={`/t/${tid}/kurumsal`}>{tt('Detaya git')}</Link>}>
      {yukleniyor ? <p className="cap">{tt('Yükleniyor')}</p> : durumHata ? durumHata : <ul className="liste">{durum.map((d, i) => <li key={i}>{d}</li>)}</ul>}
    </Bolum></div>
    {yhVar ? <RoadmapHomeSection tid={tid} q={yh} n="4" /> : null}
    {attq.status === 'error' ? <div style={{ marginTop: '1rem' }}>{hata([attq])}</div> : att.length ? <p className="cap" style={{ marginTop: '1rem' }}>{tt('Dikkat listenizde {0} konu var.', att.length)} <Link className="link" to={`/t/${tid}/dikkat`}>{tt('Bekleyen işler')}</Link></p> : null}
  </Ekran></div></main>;
}

/** Diğer müşteri rolleri: önce bekleyen iş, sonra aksiyonlar, sonra kısayollar */
export function RoleHome({ tid, profile, ust }: { tid: string; profile: string | null; ust?: React.ReactNode }) {
  // v2.14.1 (A01): bekleyen iş ve aksiyonlar ayrı yüklenir; hata boş sonuca çevrilmez; bağlam (tid) değişince eski veri taşınmaz (useLoad anahtarı).
  const attq = useLoad<Att>(`att|${tid}`, async signal => { const r = await api<Att | { items?: Att }>('GET', `/api/t/${tid}/attention`, undefined, { signal }); return Array.isArray(r) ? r : (r.items ?? []); });
  const actq = useLoad<Act[]>(`act|${tid}`, async signal => { const r = await api<Act[]>('GET', `/api/t/${tid}/actions`, undefined, { signal }); return Array.isArray(r) ? r : []; });
  const att = attq.status === 'ok' ? (attq.data ?? []) : null; const acts = actq.status === 'ok' ? (actq.data ?? []) : null;
  const attHata = attq.status === 'error' ? <LoadError message={attq.message ?? tt('Veri alınamadı')} retry={() => { void attq.reload(); }} /> : null;
  const actHata = actq.status === 'error' ? <LoadError message={actq.message ?? tt('Veri alınamadı')} retry={() => { void actq.reload(); }} /> : null;
  const P = profile ?? '';
  // v2.15.0: yol haritası özeti — yalnız yol haritası yüklüyse çizilir; bölüm numaraları buna göre kayar
  const yh = useRoadmapSummary(tid, P !== 'ACTION_OWNER'); const yhVar = roadmapVisible(yh);
  const basliklar: Record<string, [string, string]> = { UNIT_MANAGER: [tt('Sonucum, hedefim, aksiyonlarım'), tt('Önce bekleyen işlerinize, sonra sonuçlarınıza bakın; hedef koyup aksiyonları buradan yönetirsiniz.')], REGION_MANAGER: [tt('Bölge durumu'), tt('Dikkat gereken birimlere, hedeflere ve aksiyonlara buradan ulaşırsınız.')], HR_PARTNER: [tt('Birimlerim'), tt('Kapsamınızdaki birimlerin riskleri, bekleyen hedefler, aksiyonlar ve doğrulama.')], ACTION_OWNER: [tt('Görevim'), tt('Size verilen aksiyonu uygular, her gerçekleşmeyi kaydeder ve kanıtlarsınız.')], VIEWER: [tt('Durum'), tt('Yetkili olduğunuz birimlerin sonuçlarını, hedeflerini ve aksiyonlarını görürsünüz.')] };
  const [h, alt] = basliklar[P] ?? [tt('Genel bakış'), ''];
  const acik = (acts ?? []).filter(a => ['in_progress', 'paused', 'planned'].includes(a.lifecycle_state)); const geciken = acik.filter(a => a.due_date && a.due_date < today());
  const bekleyen = attHata ? tt('Veri alınamadı') : att === null ? tt('Yükleniyor') : att.length ? tt('{0} konu sizi bekliyor.', att.length) : tt('Şu anda bekleyen işiniz bulunmuyor.');
  const kritik = (att ?? []).filter(i => (i.severity ?? i.importance) === 'critical');
  return <main className="tb"><div className="wrap"><Ekran baslik={h}>{ust}
    <Baslik kicker={`${h} · ${GUN(new Date())}`} h1={tt('Bugün ne yapmalıyım?')} cap={alt || undefined} />
    <Not baslik={tt('Gündem')}>{tt('önce sizden beklenen iş, sonra hedefiniz, sonra aksiyonlarınız ve sonucunuz.')}</Not>
    <Buyuk hucreler={[{ ol: tt('Sizden beklenen'), sayi: attHata ? '—' : att === null ? '…' : kritik.length ? tt('{0} iş', kritik.length) : att.length ? tt('{0} konu', att.length) : tt('Yok'), p: bekleyen, red: true }, { ol: tt('Aksiyonlar'), sayi: actHata ? '—' : acts === null ? '…' : String(acik.length), p: actHata ? tt('Veri alınamadı') : acts === null ? tt('Yükleniyor') : acik.length ? tt('{0} devam ediyor · {1} termin tarihini geçti', acik.filter(a => a.lifecycle_state === 'in_progress').length, geciken.length) : tt('Henüz yürürlükte aksiyon yok.') }, { ol: tt('Sonucum'), sayi: tt('Birim sonuçları'), p: P === 'ACTION_OWNER' ? tt('Aksiyonunuzun bağlı olduğu hedefi aksiyon panosunda görürsünüz.') : tt('Dönem ve birim seçip her maddenin olumlu yanıt oranını ve şirketle farkını okuyun.') }]} />
    {P !== 'VIEWER' ? <Bolum n="1" ilk kicker={tt('Bekleyen iş')} soru={tt('Benden ne bekleniyor?')} red dugmeler={<Link className="btn btn--secondary" to={`/t/${tid}/dikkat`}>{tt('Bekleyen işler')}</Link>}>
      {attHata ? attHata : att === null ? <p className="cap">{tt('Yükleniyor')}</p> : att.length ? <Tablo bas={[tt('Konu'), tt('Önem'), '']} satirlar={att.slice(0, 6).map(i => [i.title ?? i.konu ?? '', <span className={(i.severity ?? i.importance) === 'critical' ? 'red bold' : 'cap'}>{trl(i.severity ?? i.importance ?? '')}</span>, <Link className="kucukbtn" to={attLink(tid, i)}>{tt('Konuya git')}</Link>])} /> : <p>{bekleyen}</p>}
    </Bolum> : null}
    {yhVar ? <RoadmapHomeSection tid={tid} q={yh} n={P !== 'VIEWER' ? '2' : '1'} ilk={P === 'VIEWER'} /> : null}
    <Bolum n={String((P !== 'VIEWER' ? 2 : 1) + (yhVar ? 1 : 0))} ilk={P === 'VIEWER' && !yhVar} kicker={tt('Aksiyonlar')} soru={tt('Aksiyonlar ne durumda?')} dugmeler={<Link className="btn btn--secondary" to={`/t/${tid}/aksiyonlar`}>{tt('Aksiyonlar')}</Link>}>
      {actHata ? actHata : acts === null ? <p className="cap">{tt('Yükleniyor')}</p> : acik.length ? <><Tablo bas={[tt('Aksiyon'), tt('Birim'), tt('Durum'), tt('Gerçekleşme (yapılan / planlanan)'), tt('Bitiş')]} satirlar={acik.slice(0, 8).map(a => [<span className="bold">{a.title}</span>, <span className="cap">{a.unit_name ?? ''}</span>, trl(a.lifecycle_state), a.requirement ? <><Kare dolu={a.fulfilled_slots ?? a.valid_evidence ?? 0} toplam={a.requirement.expected} /> <span className="cap">{a.fulfilled_slots ?? a.valid_evidence ?? 0} / {a.requirement.expected}</span></> : '—', <span className={a.due_date && a.due_date < today() ? 'red' : 'cap'}>{a.due_date ? GUN(a.due_date) : '—'}</span>])} /><KareLeg /></> : <p>{tt('Henüz yürürlükte aksiyon yok.')} {P === 'VIEWER' ? tt('Aksiyonların hangi aşamada olduğunu görürsünüz.') : P === 'ACTION_OWNER' ? tt('Aksiyonunuzu açın, "AI planını gör" ile adımları okuyun, her gerçekleşmeyi "Kaydı ekle" ile kaydedin.') : tt('Hedefe aksiyon açın ya da plandan aktarın; gerçekleşmeleri ve kanıtları buradan izleyin.')}</p>}
    </Bolum>
    {P !== 'ACTION_OWNER' ? <Bolum n={String((P !== 'VIEWER' ? 3 : 2) + (yhVar ? 1 : 0))} kicker={tt('Sonuç ve hedef')} soru={tt('Nereden devam edeyim?')} dugmeler={<><Link className="btn btn--secondary" to={`/t/${tid}/birimler`}>{tt('Birim sonuçları')}</Link><Link className="btn btn--secondary" to={`/t/${tid}/hedefler`}>{tt('Hedefler')}</Link>{['UNIT_MANAGER', 'REGION_MANAGER', 'HR_PARTNER'].includes(P) ? <Link className="btn btn--secondary" to={`/t/${tid}/takip`}>{tt('Takip ölçümü')}</Link> : null}</>}>
      <p>{P === 'VIEWER' ? tt('Hedeflerin durumunu izlersiniz.') : tt('Gelişim alanı seçin, önerilen hedef aralığını görün, gerekirse yapay zekâdan yardım alın ve hedefi oluşturun.')} {['UNIT_MANAGER', 'REGION_MANAGER', 'HR_PARTNER'].includes(P) ? tt('Takip dönemi gelince hedefin tutup tutmadığını aynı madde için karşılaştırın.') : ''}</p>
    </Bolum> : null}
  </Ekran></div></main>;
}
