import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { usePersona } from '../state/persona';
import { Kicker } from '../components/Kicker';
import { Button } from '../components/Button';
import { dismiss as dismissItem, trLower, type DismissAction } from '@hpw-act/domain-core';
import { useTx } from '../i18n/tx';

/** Rolün giriş ekranı = dikkat kuyruğu. Ekranın tek dev öğesi bekleyen karar sayısı; bölümün tek kırmızısı da odur. Satırlar sessiz. */
export default function Home() {
  const { t, fmtDate } = useI18n(); const { persona } = usePersona(); const tx = useTx();
  const [items, setItems] = useState(persona.attention);
  const [dismissing, setDismissing] = useState<string | null>(null);
  useEffect(() => { setItems(persona.attention); setDismissing(null); }, [persona]);
  const [dAction, setDAction] = useState<DismissAction>('acknowledge');
  const [dReason, setDReason] = useState('');
  const [dNote, setDNote] = useState<Record<string, string>>({});
  /** Listeden çıkarmak yükümlülüğü bitirmez: okundu (yalnız bilgi), ertele (kuyrukta kalır), yönlendir (yeni sorumlu), çöz (yalnız sahip, yükümlülük kapandıysa), muafiyet (gerekçe + yetki). */
  const dismiss = (i: (typeof items)[number]) => {
    const obligation = i.severity === 'info' ? 'info' as const : trLower(i.title).includes('kanıt') ? 'evidence' as const : trLower(i.title).includes('istisna') ? 'exception' as const : 'decision' as const;
    const r = dismissItem({ id: i.id, obligation, ownerRoleId: persona.id, state: 'open' }, { action: dAction, reason: dReason, until: dAction === 'snooze' ? '2026-10-01' : undefined, toRoleId: dAction === 'reroute' ? 'region_head' : undefined, actorRoleId: dAction === 'exempt' ? 'region_head' : persona.id });
    if (r.error) { const code = r.error; setDNote(x => ({ ...x, [i.id]: ({ acknowledge_only_for_info: 'Bu konu bilgi değil, karar bekliyor; "okundu" ile kapanmaz.', snooze_requires_until: 'Ertelemek için tarih gerekli.', reroute_requires_role_and_reason: 'Yönlendirmek için yeni sorumlu ve gerekçe gerekli.', exempt_requires_reason_and_authority: 'Muafiyet gerekçe ve üst yetki ister.', resolve_requires_owner: 'Yalnız sahip çözebilir.', resolve_requires_domain_event: 'Kart tek başına çözülmez: asıl işlemi (karar, kanıt, istisna) ilgili ekranda yapın; iş kapanınca kart kendiliğinden düşer.' } as Record<string, string>)[code] ?? code })); return; }
    if (r.obligationCleared) setItems(x => x.filter(k => k.id !== i.id)); else setDNote(x => ({ ...x, [i.id]: r.item.state === 'snoozed' ? 'Ertelendi · 01.10.2026\'de kuyruğunuza geri döner; yükümlülük sizde' : `Yönlendirildi · yeni sorumlu: Bölge Direktörü · gerekçe: ${dReason}` }));
    setDismissing(null); setDReason('');
  };
  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>{t('home.kicker')} · {persona.roleLabel} · {persona.unitLabel} · 22.09.2026</Kicker></div>
          <div className="col-12 crop">
            <p className="display-xxl red num enter nowrap" aria-hidden="true">{items.length}</p>
            <h1 className="h2" style={{ marginTop: 'var(--s-2)' }}>{items.length ? <><span className="sr-only">{items.length} </span>{persona.homeClaim}</> : persona.homeClaim}</h1>
          </div>
        </div>
      </section>
      <section className="section--tight surface-white">
        <div className="container">
          <div className="rows">
            {items.map(i => (
              <article key={i.id} className="rowline">
                <div className="stack-1">
                  <Kicker>{t(`sev.${i.severity}`)} · {i.entity}</Kicker>
                  <h2 className="body-l bold">{i.title}</h2>
                  {dismissing === i.id ? (
                    <div className="row">
                      <label className="field" style={{ minWidth: '22ch' }}><span className="field__label caption">Ne yapmak istiyorsunuz</span><span className="select-wrap"><select className="field__input" id={`d-${i.id}`} value={dAction} onChange={e => setDAction(e.target.value as DismissAction)}><option value="acknowledge">Okundu (yalnız bilgi)</option><option value="snooze">Ertele (kuyrukta kalır)</option><option value="reroute">Yönlendir (yanlış sorumlu)</option><option value="resolve">Çöz (asıl işlem yapıldıysa)</option><option value="exempt">Muafiyet (üst yetki)</option></select></span></label>
                      <label className="field" style={{ flex: 1 }}><span className="field__label caption">Gerekçe</span><input className="field__input" id={`r-${i.id}`} value={dReason} onChange={e => setDReason(e.target.value)} /></label>
                      <Button onClick={() => dismiss(i)} disabled={(dAction === 'reroute' || dAction === 'exempt') && dReason.trim().length < 3} disabledReason={(dAction === 'reroute' || dAction === 'exempt') && dReason.trim().length < 3 ? 'Gerekçe zorunlu' : undefined}>Uygula</Button>
                      <Button variant="secondary" onClick={() => setDismissing(null)}>Vazgeç</Button>
                    </div>
                  ) : null}
                  {dNote[i.id] ? <p className="caption">{dNote[i.id]}</p> : null}
                </div>
                <div className="stack-1 right">
                  <p className="caption">{i.due ? `${t('home.sla')}: ${fmtDate(i.due)} · ${tx(i.sla)}` : t('home.noDue')}</p>
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <Link to={i.to} className="link bold">{t('home.open')}</Link>
                    <button type="button" className="link" onClick={() => setDismissing(i.id)}>{t('home.dismiss')}</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
