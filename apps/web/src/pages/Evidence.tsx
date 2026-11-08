import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { Kicker } from '../components/Kicker';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { usePersona } from '../state/persona';
import { store, useStore, type StoredAction } from '../state/store';
import { validateEvidence, verifierAllowed } from '@hpw-act/domain-core';

const LIFE: Record<string, string> = { planned: 'planlandı', in_progress: 'devam ediyor', declared_complete: 'tamamlandı (beyan)', closed: 'kapatıldı', cancelled: 'iptal', paused: 'duraklatıldı', superseded: 'yeni sürümle değişti' };
const VER: Record<string, string> = { pending: 'doğrulama bekliyor', auto_verified: 'politika beyanla karşılandı (bağımsız doğrulama yok)', human_verified: 'insan doğruladı', partial: 'kısmen doğrulandı', needs_review: 'ek kanıt / inceleme gerekli', invalidated: 'geçersizleşti' };
const HEALTH: Record<string, string> = { on_track: 'yolunda', at_risk: 'risk altında', blocked: 'engellendi', overdue: 'gecikmiş' };
const ROUTE: Record<string, string> = { auto: 'sistem izinden otomatik', none_unless_exception: 'istisna yoksa insan yok', connector_or_human: 'bağlayıcı ya da insan', human_review: 'insan incelemesi (her zaman)', sample_audit: 'örneklem denetimi (her zaman)' };

/** Kanıt (v2.3.1): aynı aksiyon kaydı; E0/E1 için PDF yok — yapılandırılmış kayıt (tarih + gerçekleşti + katılımcı sayısı). Sıra: geçerlilik (tarih penceresi, tekil gerçekleşme) → politika → doğrulama yolu.
    Dört durum ekseni ayrı: iş yaşam döngüsü, doğrulama, sağlık, sonuç. "Tamamlandı" beyanı doğrulanmış gerçek değildir. */
export default function Evidence() {
  const { t } = useI18n(); const { persona } = usePersona(); const saved = useStore();
  const unitScoped = persona.scope === 'unit';
  const actions = saved.actions.filter(a => saved.targets.some(tg => tg.id === a.targetId && (!unitScoped || tg.unitId === persona.unitId)));
  const [sel, setSel] = useState(0);
  const [log, setLog] = useState({ date: '2026-10-07', occurred: 'yes', attendance: 6 });
  const [asOwner, setAsOwner] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const a: StoredAction | undefined = actions[sel];
  if (!a) {
    return (<section className="section surface-white"><div className="container grid">
      <div className="col-12"><Kicker>{t('evidence.kicker')}</Kicker></div>
      <div className="col-8 stack"><h1 className="h2">Kanıt, kabul edilmiş bir aksiyonun kaydına bağlıdır.</h1><p className="body-l measure">Önce <Link className="link" to="/hedefler">bir yerel hedef</Link>, sonra <Link className="link" to="/aksiyonlar">o hedefe bağlı bir aksiyon</Link> kabul edin; kanıt gereksinimi kabulde dondurulur ve burada aynı kayıt kimliğiyle görünür.</p></div>
    </div></section>);
  }
  const req = { ruleType: 'count' as const, expectedValue: a.requirement.expected, windowStart: a.requirement.windowStart, windowEnd: a.requirement.windowEnd, isCritical: false };
  const items = a.logs.map((l, i) => ({ id: `log-${i}`, type: 'attestation' as const, date: l.date, submittedBy: 'owner', occurrenceKey: `${l.date}:${a.id}`, metricValue: l.attendance }));
  const validity = validateEvidence(req, items);
  const valid = validity.valid.length; const missing = Math.max(0, a.requirement.expected - valid);
  const canVerify = verifierAllowed({ ...req, isCritical: a.verificationRoute === 'human_review' }, 'owner', asOwner ? 'owner' : 'verifier', false);
  const addLog = () => {
    if (log.occurred !== 'yes') { setErr('Gerçekleşmeyen olay kayıt olarak eklenmez; gerekçesiyle durum bildirimi yapın.'); return; }
    const v = validateEvidence(req, [...items, { id: 'new', type: 'attestation', date: log.date, submittedBy: 'owner', occurrenceKey: `${log.date}:${a.id}`, metricValue: log.attendance }]);
    const rej = v.rejected.find(r => r.id === 'new');
    if (rej) { setErr(rej.reason === 'out_of_window' ? `Tarih pencere dışında (${a.requirement.windowStart}–${a.requirement.windowEnd}).` : rej.reason === 'duplicate_occurrence' ? 'Aynı tarihte aynı gerçekleşme zaten kayıtlı; ikinci kez sayılmaz.' : `Geçersiz: ${rej.reason}`); return; }
    setErr(null); store.addLog(a.id, { date: log.date, occurred: true, attendance: log.attendance });
  };
  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>{t('evidence.kicker')} · {a.title} · kayıt {a.id} · sürüm {a.version}</Kicker></div>
          <div className="col-6">
            <p className="display-xxl num red enter">{missing}</p>
            <h1 className="h2" style={{ marginTop: 'var(--s-2)' }}>{missing ? `eksik kayıt. ${valid} / ${a.requirement.expected} ${a.requirement.label} kaydı geçerli.` : 'Gereksinim karşılandı; tamamlandı beyanı verebilirsiniz.'}</h1>
            {actions.length > 1 ? <div className="row" style={{ marginTop: 'var(--s-2)' }}>{actions.map((x, i) => <button key={x.id} type="button" className={`link caption${i === sel ? ' bold' : ''}`} onClick={() => setSel(i)}>{x.title}</button>)}</div> : null}
          </div>
          <div className="col-6 stack">
            <Kicker>Gereksinim (kabulde kilitlendi)</Kicker>
            <table className="table">
              <tbody>
                <tr><td>Kural</td><td>{a.requirement.expected} {a.requirement.label} · {a.requirement.windowStart}–{a.requirement.windowEnd}</td></tr>
                <tr><td>Kanıt seviyesi (kuraldan)</td><td>{a.evidenceLevel} · kural: {a.rule} · doğrulama: {ROUTE[a.verificationRoute]}</td></tr>
                <tr><td>Kanıt biçimi</td><td>{a.evidenceLevel === 'E0' || a.evidenceLevel === 'E1' ? 'Yapılandırılmış kayıt: tarih + gerçekleşti + katılımcı sayısı. Dosya ya da görüşme notu istenmez.' : 'Sistem izi ya da belge'}</td></tr>
                <tr><td>Sahip rol / hesap veren</td><td>{a.ownerRole} / {a.accountableRole}</td></tr>
                <tr><td>Durum (dört eksen)</td><td>iş: {LIFE[a.lifecycle]} · doğrulama: {VER[a.verification]} · sağlık: {HEALTH[a.health]} · sonuç: ölçülmedi</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section className="section--tight surface-white">
        <div className="container stack-4">
          <div className="row">
            <div style={{ width: '18ch' }}><Field id="log-date" type="date" label="Tarih" value={log.date} onChange={e => setLog(x => ({ ...x, date: e.target.value }))} /></div>
            <div style={{ minWidth: '16ch' }}><Field id="log-occurred" kind="select" label="Gerçekleşti mi" value={log.occurred} onChange={e => setLog(x => ({ ...x, occurred: e.target.value }))}><option value="yes">Evet</option><option value="no">Hayır</option></Field></div>
            <div style={{ width: '12ch' }}><Field id="log-att" type="number" label="Katılımcı" value={log.attendance} min={0} onChange={e => setLog(x => ({ ...x, attendance: Number(e.target.value) }))} /></div>
            <Button onClick={addLog} disabled={a.lifecycle !== 'in_progress'} disabledReason={a.lifecycle !== 'in_progress' ? 'İş beyan sonrası; yeni kayıt için yeniden aç' : undefined}>Kaydı ekle</Button>
            <div style={{ minWidth: '20ch' }}><Field id="role" kind="select" label="Oturum (deneme)" value={asOwner ? 'owner' : 'verifier'} onChange={e => setAsOwner(e.target.value === 'owner')}><option value="owner">Sahip: {a.ownerRole}</option><option value="verifier">Doğrulayıcı: Bölge Direktörü</option></Field></div>
            <Button variant="secondary" onClick={() => store.declareComplete(a.id)} disabled={missing > 0 || a.lifecycle !== 'in_progress'} disabledReason={missing > 0 ? `Önce ${missing} geçerli kayıt` : a.lifecycle !== 'in_progress' ? 'Beyan verildi' : undefined}>Tamamlandı olarak işaretle</Button>
            <Button variant="secondary" onClick={() => store.humanVerify(a.id, true)} disabled={!canVerify || a.lifecycle !== 'declared_complete' || a.verificationRoute === 'none_unless_exception' || a.verificationRoute === 'auto'} disabledReason={!canVerify ? 'Kanıtı giren kişi doğrulayamaz.' : a.lifecycle !== 'declared_complete' ? 'Önce sahip tamamlandı beyanı verir' : 'Bu seviyede insan doğrulaması yalnız istisnada; örneklem denetimi ayrıca planlanır'}>Doğrula</Button>
          </div>
          {err ? <p className="bold">{err}</p> : null}
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Tarih</th><th>Gerçekleşti</th><th className="num">Katılımcı</th><th>Geçerlilik</th></tr></thead>
            <tbody>{a.logs.map((l, i) => { const rej = validity.rejected.find(r => r.id === `log-${i}`); return <tr key={i}><td>{l.date}</td><td>{l.occurred ? 'evet' : 'hayır'}</td><td className="num">{l.attendance}</td><td className="caption">{rej ? `geçersiz: ${rej.reason}` : 'geçerli'}</td></tr>; })}{a.logs.length === 0 ? <tr><td colSpan={4} className="caption">Henüz kayıt yok. Aylık toplantı için tarih + gerçekleşti + katılımcı yeter; PDF ya da tutanak istenmez.</td></tr> : null}</tbody>
          </table></div>
          <p className="caption">Sıra: geçerlilik (tür, tarih penceresi, tekil gerçekleşme) → E0–E4 politikası → doğrulama yolu. Aynı gerçekleşme iki kez sayılmaz; tarihsiz kayıt geçersizdir; sonuç verisi uygulama kanıtı değildir. "Tamamlandı" beyanı ile "doğrulandı" ayrı eksenlerdir; sonuç ancak yeniden ölçümde ve karşılaştırılabilirlik kapısından sonra yazılır.</p>
        </div>
      </section>
    </>
  );
}
