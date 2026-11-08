/** Kurulum adımı 10 — müşteri teyidi (şirketin kendi alanında).
 * v2.10.1 (V210-02/04): durum sunucunun merkezle ORTAK geçerlilik hesabından gelir (state); yükleniyor / HPW onayı yok / teyit bekleniyor / teyit edildi /
 * yeniden kontrol gerekli / yükleme hatası ayrı gösterilir. İlk yükleme hatası ya da bozuk yanıt görünür uyarı ve çalışan “Yeniden dene” üretir;
 * başarılı tekrar hatayı temizler. Teyit düğmesi yalnız yetki bilgisi alınmış şirket genelindeki İK yöneticisine ve yalnız “teyit bekleniyor” durumunda açılır. */
import { useEffect, useRef, useState } from 'react';
import { tt } from '../i18n';
import { api, commandApi, describeError } from '../api';
import { checkDto, DTO } from '../dto';
import { useMe } from '../App';
import { usePerms } from '../permissions';
import { ConfirmDialog } from '../Dialog';
import { Button } from '../../components/Button';
type St = { state: 'not_started' | 'blocked' | 'in_progress' | 'done' | 'recheck'; hpwApprovedAt: string | null; customerConfirmedAt: string | null; awaitingCustomer: boolean; fingerprint: string | null };
export function GoLiveCard({ tid }: { tid: string }) {
  const { me } = useMe(); const perms = usePerms(tid, null); const [st, setSt] = useState<St | null>(null); const [err, setErr] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false); const [dErr, setDErr] = useState<string | null>(null); const [done, setDone] = useState<string | null>(null); const openFor = useRef(''); const openFp = useRef(''); const cur = useRef(tid); cur.current = tid; const gen = useRef(0);
  const load = async () => { const t = tid; const g = ++gen.current; setLoading(true);
    try { const v = checkDto<St>(await api('GET', `/api/t/${t}/onboarding/go-live`), DTO.goLiveCustomer, '/onboarding/go-live'); if (t !== cur.current || g !== gen.current) return; setSt(v); setErr(null); }
    catch (e) { if (t !== cur.current || g !== gen.current) return; setSt(null); setErr(describeError(e)); } finally { if (t === cur.current && g === gen.current) setLoading(false); } };
  useEffect(() => { setSt(null); setErr(null); setOpen(false); if (me?.realm === 'customer') void load(); }, [tid, me?.realm]);
  if (me?.realm !== 'customer') return null;
  /** v2.10.1 (V2101-02): teyit komutu açılıştaki şirket ve onay kanıtıyla (openFp) gönderilir; yeniden deneme aynı gövde → aynı işlem anahtarı.
   * Makbuz kaybolursa sonuç güncel kayıttan doğrulanır (verify): doğrulanırsa pencere kapanır ve sonuç gösterilir; doğrulanamazsa belirsizlik açıkça yazılır ve
   * “Teyit et” aynı anahtarla gerçekten yeniden gönderir. Sessizce hiçbir şey yapmayan etkin düğme bırakılmaz. */
  const confirm = async ({ reason }: { reason: string }) => { const t = openFor.current; if (t !== cur.current) return; setDErr(null);
    const verify = async () => { const v = checkDto<St>(await api('GET', `/api/t/${t}/onboarding/go-live`), DTO.goLiveCustomer, '/onboarding/go-live'); return v.state === 'done' && !!v.customerConfirmedAt; };
    try { await commandApi(`/api/t/${t}/onboarding/go-live/confirm`, { reason, expectedFingerprint: openFp.current }, { verify }); if (t !== cur.current) return; setOpen(false); setDone(tt('Teyidiniz kaydedildi.')); await load(); }
    catch (e) { if (t !== cur.current) return; const code = (e as { code?: string }).code;
      if (code === 'receipt_lost') { setOpen(false); setDone(tt('Teyidiniz daha önce kaydedilmişti (yanıt yolda kaybolmuştu); güncel kayıt okundu ve sonuç doğrulandı.')); await load(); return; }
      if (code === 'evidence_changed') { setOpen(false); setDone(tt('Onaylanan kurulum durumu siz görüntüledikten sonra değişti; teyit kaydedilmedi. Güncel durum aşağıda.')); await load(); return; }
      setDErr(describeError(e)); await load(); } };
  const canConfirm = perms.ready && perms.tenant('goLiveConfirm');
  return <div className="col-12 notice stack-1" role="region" aria-label={tt('Kullanıma açılış')}>
    {done ? <p className="bold" role="status">{done}</p> : null}
    {err ? <><p className="bold" role="alert">{tt('Kullanıma açılış durumu yüklenemedi: {0}', err)}</p><div><button type="button" className="link caption" onClick={() => void load()}>{tt('Yeniden dene')}</button></div></>
    : !st ? <p className="caption" role="status">{loading ? tt('Kullanıma açılış durumu yükleniyor…') : ''}</p>
    : st.state === 'in_progress' && st.awaitingCustomer ? <>
      <p className="bold">{tt('Happy Place to Work kurulumu tamamlayıp kullanıma açılışı {0} tarihinde onayladı.', String(st.hpwApprovedAt).slice(0, 10))}</p>
      <p className="caption">{tt('Kurulum adım 10, şirketinizin İK yöneticisinin teyidiyle tamamlanır. Teyidiniz HPW’nin onayladığı kurulum durumuna bağlanır.')}</p>
      {canConfirm ? <div><Button onClick={() => { openFor.current = tid; openFp.current = st.fingerprint ?? ''; setDErr(null); setDone(null); setOpen(true); }}>{tt('Kullanıma açılışı teyit et')}</Button></div> : <p className="caption">{tt('Teyidi şirket genelindeki İK yöneticisi verir.')}</p>}
    </> : st.state === 'done' ? <p className="caption">{tt('Kullanıma açılış {0} tarihinde teyit edildi.', String(st.customerConfirmedAt).slice(0, 10))}</p>
    : st.state === 'recheck' ? <p className="caption">{tt('HPW’nin kullanıma açılış onayından sonra kurulum durumu değişti; onay geçerliliğini yitirdi. HPW yeniden onayladığında teyidiniz istenecek.')}</p>
    : <p className="caption">{tt('Kullanıma açılış: HPW onayı henüz verilmedi.')}</p>}
    <ConfirmDialog open={open} title={tt('Kullanıma açılışı teyit et')} description={tt('Şirketiniz adına kurulumun tamamlandığını ve kullanıma açılışı kabul ettiğinizi teyit ediyorsunuz. Kayıt kişi, zaman ve gerekçeyle saklanır.')} confirmLabel={tt('Teyit et')} reason={{ label: tt('Gerekçe / not (zorunlu)'), minLength: 3 }} stale={open && openFor.current !== tid ? tt('Onay sırasında şirket değişti; işlem gönderilmedi') : null} error={dErr} onConfirm={confirm} onCancel={() => setOpen(false)} />
  </div>;
}
