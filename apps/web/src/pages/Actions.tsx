import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { data } from '../api/mock';
import { Kicker } from '../components/Kicker';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { FitText } from '../components/FitText';
import { usePersona } from '../state/persona';
import { store, useStore } from '../state/store';
import { recommendActions, evidenceLevelByRules, verificationRoute, canOpenAction, type ActionTemplateVersion } from '@hpw-act/domain-core';

/** Aksiyon kütüphanesi (şablon sürümleri): metrik/sürücü/birim tipi uygunluğu; gözlemsel etkinlik yalnız son sıralama kriteri. */
const LIBRARY: ActionTemplateVersion[] = [
  // Güven maddeleri
  { code: 'vardiya-katilimci', version: '3.2', title: 'Vardiya planını çalışanla birlikte yap', targetMetrics: ['GUV-04', 'OZL-01', 'ISG-03', 'CAL-02'], driverItems: [], unitTypes: ['branch'], lever: 'vardiya_planlama', accountableRole: 'branch_manager', effort: 'medium', cost: 'none', timeToSignalWeeks: 8, evidenceLevel: 'E1', leadingKpi: 'ortak planlama toplantısı gerçekleşme', observedAssociation: { medianChange: 4.2, sampleSize: 61 } },
  { code: 'birebir-programi', version: '2.0', title: 'Aylık birebir görüşme programı', targetMetrics: ['GUV-01', 'GUV-03', 'LID-02', 'GUR-01'], driverItems: [], unitTypes: ['branch', 'call_center'], lever: 'yonetici_iletisimi', accountableRole: 'branch_manager', effort: 'low', cost: 'none', timeToSignalWeeks: 6, evidenceLevel: 'E1', leadingKpi: 'aylık görüşme gerçekleşme %', observedAssociation: { medianChange: 2.1, sampleSize: 140 } },
  { code: 'kararlarin-gerekcesi', version: '1.4', title: 'Şube kararlarının gerekçesini haftalık paylaş', targetMetrics: ['GUV-03', 'ERI-04', 'LID-01'], driverItems: [], unitTypes: ['branch'], lever: 'seffaflik', accountableRole: 'branch_manager', effort: 'low', cost: 'none', timeToSignalWeeks: 6, evidenceLevel: 'E0', leadingKpi: 'haftalık paylaşım gerçekleşme' },
  { code: 'haftalik-ekip-sozu', version: '1.0', title: 'Haftalık ekip toplantısında her çalışana söz ve gündem hakkı', targetMetrics: ['GUV-01', 'LID-02', 'LID-03', 'GUV-03'], driverItems: [], unitTypes: ['branch', 'call_center'], lever: 'yonetici_iletisimi', accountableRole: 'branch_manager', effort: 'low', cost: 'none', timeToSignalWeeks: 6, evidenceLevel: 'E0', leadingKpi: 'haftalık toplantı gerçekleşme' },
  { code: 'yonetici-sahada', version: '1.0', title: 'Yönetici haftada yarım gün çalışanla birlikte gişede/sahada', targetMetrics: ['GUV-01', 'ERI-01', 'LID-02'], driverItems: [], unitTypes: ['branch'], lever: 'erisilebilirlik', accountableRole: 'branch_manager', effort: 'medium', cost: 'none', timeToSignalWeeks: 8, evidenceLevel: 'E1', leadingKpi: 'saha yarım günü gerçekleşme' },
  // Gurur / takdir
  { code: 'takdir-ritmi', version: '1.0', title: 'Aylık takdir ve geri bildirim ritmi kur', targetMetrics: ['GUR-01', 'GUR-02', 'PER-02', 'PER-03'], driverItems: [], unitTypes: ['branch'], lever: 'takdir', accountableRole: 'branch_manager', effort: 'low', cost: 'none', timeToSignalWeeks: 6, evidenceLevel: 'E0', leadingKpi: 'aylık takdir toplantısı', observedAssociation: { medianChange: 3.4, sampleSize: 88 } },
  { code: 'basari-panosu', version: '1.0', title: 'Ekip başarılarını haftalık toplantıda görünür kıl', targetMetrics: ['GUR-02', 'BAS-03'], driverItems: [], unitTypes: ['branch'], lever: 'takdir', accountableRole: 'branch_manager', effort: 'low', cost: 'none', timeToSignalWeeks: 6, evidenceLevel: 'E0', leadingKpi: 'haftalık paylaşım gerçekleşme' },
  // Kariyer / gelişim (merkezi sistem + yerel görüşme)
  { code: 'kariyer-gorusmesi', version: '1.2', title: 'Her çalışanla altı aylık kariyer ve gelişim görüşmesi', targetMetrics: ['GUR-03', 'YEK-03', 'BAS-04', 'EGI-01'], driverItems: [], unitTypes: ['branch'], lever: 'kariyer', accountableRole: 'branch_manager', effort: 'medium', cost: 'low', timeToSignalWeeks: 12, evidenceLevel: 'E1', leadingKpi: 'kariyer görüşmesi gerçekleşme', observedAssociation: { medianChange: 3.0, sampleSize: 45 } },
  { code: 'terfi-kriterleri-paylasim', version: '1.0', title: 'Terfi kriterlerini ve açık pozisyon sürecini ekiple paylaş', targetMetrics: ['GUR-03', 'YEK-01', 'YEK-04'], driverItems: [], unitTypes: ['branch'], lever: 'kariyer', accountableRole: 'branch_manager', effort: 'low', cost: 'none', timeToSignalWeeks: 8, evidenceLevel: 'E0', leadingKpi: 'paylaşım toplantısı gerçekleşme' },
  { code: 'yetenek-aday-listesi', version: '1.0', title: 'Şube içi yetenek aday listesini İK ile çeyreklik gözden geçir', targetMetrics: ['GUR-03', 'YEK-02'], driverItems: [], unitTypes: ['branch'], lever: 'yetenek', accountableRole: 'branch_manager', effort: 'low', cost: 'none', timeToSignalWeeks: 12, evidenceLevel: 'E1', leadingKpi: 'çeyreklik gözden geçirme gerçekleşme' },
  // Başarı / iş tasarımı
  { code: 'hedef-netligi', version: '1.1', title: 'Bireysel hedefleri çeyrek başında birlikte netleştir', targetMetrics: ['BAS-03', 'LID-01', 'PER-01'], driverItems: [], unitTypes: ['branch'], lever: 'hedef_netligi', accountableRole: 'branch_manager', effort: 'low', cost: 'none', timeToSignalWeeks: 8, evidenceLevel: 'E1', leadingKpi: 'hedef görüşmesi gerçekleşme', observedAssociation: { medianChange: 3.0, sampleSize: 45 } },
  { code: 'gelisim-plani', version: '1.0', title: 'Her çalışanla altı aylık gelişim planı görüşmesi', targetMetrics: ['BAS-04', 'BAS-02', 'EGI-03'], driverItems: [], unitTypes: ['branch'], lever: 'gelisim', accountableRole: 'branch_manager', effort: 'medium', cost: 'low', timeToSignalWeeks: 12, evidenceLevel: 'E1', leadingKpi: 'gelişim görüşmesi gerçekleşme' },
  { code: 'yetki-devri', version: '1.0', title: 'Rutin kararlarda yetki devri listesi ve onay eşiklerini yaz', targetMetrics: ['YET-01', 'YET-02', 'YET-03', 'BAS-02'], driverItems: [], unitTypes: ['branch'], lever: 'yetki_devri', accountableRole: 'branch_manager', effort: 'low', cost: 'none', timeToSignalWeeks: 8, evidenceLevel: 'E0', leadingKpi: 'yetki devri listesi yayımlandı' },
];
const LEVEL_LABEL: Record<string, string> = { E0: 'E0 · yapılandırılmış beyan', E1: 'E1 · yapılandırılmış kayıt (tarih + gerçekleşti + katılımcı)', E2: 'E2 · sistem izi / belge', E3: 'E3 · bağımsız doğrulama', E4: 'E4 · örneklem denetimi' };
const ROUTE_LABEL: Record<string, string> = { auto: 'sistem izinden otomatik', none_unless_exception: 'istisna yoksa insan yok', connector_or_human: 'bağlayıcı ya da insan', human_review: 'insan incelemesi (her zaman)', sample_audit: 'örneklem denetimi (her zaman)' };

/** Aksiyonlar (v2.3.1): kabul edilen yerel hedefe bağlı öneriler; aynı kayıt kimliğiyle. "Güven düşük" tek başına "vardiya" demek değildir: sürücü madde verisi varsa kullanılır, yoksa varsayım yazılır ve bağlam teyidi istenir. */
export default function Actions() {
  const { t } = useI18n(); const { persona } = usePersona(); const saved = useStore();
  const [state, setState] = useState<Record<string, 'declined' | 'declining' | 'editing' | undefined>>({});
  const [edits, setEdits] = useState<Record<string, { due: string; owner: string }>>({});
  const [driverConfirmed, setDriverConfirmed] = useState<Record<string, boolean>>({});
  const reasons: [string, string][] = [['out_of_authority', 'Yetkim dışında'], ['budget_required', 'Bütçe gerekli'], ['staff_shortage', 'Personel yetersiz'], ['covered_by_other', 'Başka bir işle karşılanıyor'], ['not_fit_local', 'Yerel şartlara uymuyor'], ['other', 'Diğer']];
  const unitScoped = persona.scope === 'unit';
  const targets = saved.targets.filter(tg => !unitScoped || tg.unitId === persona.unitId);
  const unit = data.units.find(u => u.id === (unitScoped ? persona.unitId : 'SUBE-KONAK'))!;
  const activeActions = saved.actions.filter(a => targets.some(tg => tg.id === a.targetId));

  if (unitScoped && targets.length === 0) {
    return (
      <section className="section surface-white"><div className="container grid">
        <div className="col-12"><Kicker>{t('actions.kicker')} · {unit.name}</Kicker></div>
        <div className="col-8 stack"><h1 className="h2">Önce bir yerel hedef kabul edin.</h1><p className="body-l measure">Aksiyon önerileri kabul edilmiş hedefin kaydına bağlanır; hedef olmadan öneri üretilmez. <Link className="link" to="/hedefler">Hedefler ekranına gidin</Link>.</p></div>
      </div></section>
    );
  }
  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>{t('actions.kicker')} · {unit.name} · {targets.map(tg => `${tg.itemCode} ${tg.baseline} → ${tg.target} (kayıt ${tg.id} · sürüm ${tg.version})`).join(' · ')}</Kicker></div>
          <div className="col-12 crop"><FitText as="h1" className="h1 enter" maxPx={88} minPx={40}>{t('actions.claim')}</FitText></div>
          <div className="col-8"><p className="body-l measure">Aksiyonlar yönetsel işlerdir ve sahibi her zaman bir organizasyonel roldür ({unit.name} Müdürü); çalışana hedef, aksiyon ya da kanıt yükü atanmaz. En fazla üç aktif aksiyon ({activeActions.length}/3); kanıt seviyesi kuraldan seçilir ve kabulde dondurulur.</p></div>
        </div>
      </section>
      {targets.map(tg => {
        const central = tg.interventionOwnerRole !== tg.monitoringRole;
        const driverKnown = true; // v2.4: takip maddede; sürücü maddenin kendisidir, boyut varsayımı yok
        const recs = recommendActions(tg.itemCode, null, { unitType: 'branch', teamSize: unit.population, activeFlags: [], ownerRoleExists: () => true, controllability: l => (l === 'vardiya_planlama' ? 0.3 : 0.9), workload: activeActions.length / 3, connectors: [] }, LIBRARY);
        return (
          <section key={tg.id} className="section--tight surface-white">
            <div className="container stack-4">
              <div className="stack-1">
                <Kicker>"{tg.itemText}" · {tg.dimension} · {tg.itemCode} · yerel hedef {tg.baseline} → {tg.target} · sonucu izleyen: {tg.monitoringRole} · müdahaleye yetkili: {tg.interventionOwnerRole}</Kicker>
                {recs.length === 0
                  ? <p className="caption">Bu madde için kütüphanede şube yetkisinde bir uygulama yok; öneriler genel kaldıraç varsayımıyla üretilemez. {driverConfirmed[tg.id] ? 'Bağlam teyit edildi; İK iş ortağı kütüphaneye şablon ekleyecek.' : <>Kısa bağlam teyidi gerekli: <button type="button" className="link" onClick={() => setDriverConfirmed(x => ({ ...x, [tg.id]: true }))}>"Sorunun kaldıracı şubemde değil" olarak teyit et</button></>}</p>
                  : <p className="caption">Öneriler maddenin kendisine bağlıdır ({tg.itemCode}); boyut varsayımı yoktur. {central ? 'Merkezi çözüm yetkili rolde; aşağıdakiler şubenin kendi yetkisindeki işlerdir.' : 'Kaldıraç şubede.'}</p>}
                {central ? <p className="caption">Kaldıraç merkezde: "Konak değiştiremiyor" demek önceliği düşürmez; merkezi aksiyonun hesap vereni {tg.interventionOwnerRole}. Şubeden beklenen izleme ve yerel uygulamadır.</p> : null}
              </div>
              <div className="rows">
                {recs.map((r, i) => { const p = r.template; const id = `act-${tg.id}-${p.code}`; const existing = saved.actions.find(a => a.id === id); const lvl = evidenceLevelByRules({ boundToNumericTarget: true, deployedUnits: 1, ownerHasPriorAnomaly: false, reversible: true, costBand: p.cost }); const route = verificationRoute(lvl.level, false, false); const s = state[id]; return (
                  <article key={id} className="rowline">
                    <div className="stack-1">
                      <Kicker className={i === 0 ? 'red' : ''}>{i === 0 ? t('actions.recommended') : 'Alternatif'} · çaba {t(`level.${p.effort}`)} · maliyet {t(`level.${p.cost}`)} · sinyal {p.timeToSignalWeeks} hafta · şablon {p.code} v{p.version}{p.observedAssociation ? ` · birlikte gözlendi: medyan +${p.observedAssociation.medianChange} (n=${p.observedAssociation.sampleSize}; nedensel değil, sıralamada son kriter)` : ''}</Kicker>
                      <h2 className="body-l bold">{p.title}</h2>
                      <p>Kanıt: {LEVEL_LABEL[lvl.level]} · kural: {lvl.rule} · doğrulama: {ROUTE_LABEL[route]}. Sahip rol: {unit.name} Müdürü; öncü gösterge: {p.leadingKpi}.</p>
                      {s === 'declining' ? (
                        <div className="row">
                          <div style={{ minWidth: '28ch' }}><Field id={`reason-${id}`} kind="select" label={t('actions.reason')} defaultValue="out_of_authority">{reasons.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Field></div>
                          <Button onClick={() => setState(x => ({ ...x, [id]: 'declined' }))}>Gönder</Button>
                          <Button variant="secondary" onClick={() => setState(x => ({ ...x, [id]: undefined }))}>Vazgeç</Button>
                        </div>
                      ) : null}
                      {s === 'editing' ? (
                        <div className="row">
                          <div style={{ width: '18ch' }}><Field id={`due-${id}`} type="date" label="Termin" value={edits[id]?.due ?? '2026-12-15'} onChange={e => setEdits(x => ({ ...x, [id]: { due: e.target.value, owner: x[id]?.owner ?? `${unit.name} Müdürü` } }))} /></div>
                          <div style={{ minWidth: '24ch' }}><Field id={`owner-${id}`} kind="select" label="Sahip rol" value={edits[id]?.owner ?? `${unit.name} Müdürü`} onChange={e => setEdits(x => ({ ...x, [id]: { due: x[id]?.due ?? '2026-12-15', owner: e.target.value } }))}><option>{unit.name} Müdürü</option><option>{unit.name} Müdür Yardımcısı</option></Field></div>
                          <Button onClick={() => { const chk = canOpenAction(activeActions.length); if (!chk.allowed) return; store.acceptAction({ id, targetId: tg.id, title: p.title, lever: p.lever, ownerRole: edits[id]?.owner ?? `${unit.name} Müdürü`, accountableRole: tg.interventionOwnerRole, evidenceLevel: lvl.level, rule: lvl.rule, verificationRoute: route, requirement: { ruleType: 'count', expected: p.code === 'birebir-programi' ? 8 : 2, windowStart: '2026-10-01', windowEnd: '2026-12-31', label: p.leadingKpi } }); setState(x => ({ ...x, [id]: undefined })); }}>Kaydet ve kabul et</Button>
                          <Button variant="secondary" onClick={() => setState(x => ({ ...x, [id]: undefined }))}>Vazgeç</Button>
                        </div>
                      ) : null}
                      {existing ? <p className="caption">Kabul edildi · kayıt {existing.id} · sürüm {existing.version} · kanıt gereksinimi kilitlendi ({existing.requirement.expected} {existing.requirement.label}, {existing.requirement.windowStart}–{existing.requirement.windowEnd}) · <Link className="link" to="/kanit">Kanıt ekranında aynı kayıt</Link></p> : null}
                      {s === 'declined' ? <p className="caption">Reddedildi · sistem hesap veren birime sorun bildirimi açtı</p> : null}
                    </div>
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <Button onClick={() => { const chk = canOpenAction(activeActions.length); if (chk.allowed) store.acceptAction({ id, targetId: tg.id, title: p.title, lever: p.lever, ownerRole: `${unit.name} Müdürü`, accountableRole: tg.interventionOwnerRole, evidenceLevel: lvl.level, rule: lvl.rule, verificationRoute: route, requirement: { ruleType: 'count', expected: p.code === 'birebir-programi' ? 8 : 2, windowStart: '2026-10-01', windowEnd: '2026-12-31', label: p.leadingKpi } }); }} disabled={!!existing || s === 'declined' || (!canOpenAction(activeActions.length).allowed)} disabledReason={existing ? 'Kabul edildi' : !canOpenAction(activeActions.length).allowed ? 'Üç aktif aksiyon dolu; biri tamamlanmadan yeni aksiyon önerilmiyor (acil güvenlik/taciz bildirimi bu sınıra takılmaz, kurumsal sürece yönlenir)' : undefined}>{t('actions.accept')}</Button>
                      <Button variant="secondary" onClick={() => setState(x => ({ ...x, [id]: 'editing' }))} disabled={!!existing}>{t('actions.edit')}</Button>
                      <Button variant="secondary" onClick={() => setState(x => ({ ...x, [id]: 'declining' }))} disabled={!!existing}>{t('actions.decline')}</Button>
                    </div>
                  </article>); })}
              </div>
            </div>
          </section>
        );
      })}
      <section className="section--tight surface-white"><div className="container"><p className="caption">Çalışanın çözüm seçimine katkısı olabilir (gizli öneri kanalı); kendisine bağlılık hedefi ya da kanıt yükü verilemez. Acil güvenlik, taciz ya da ciddi çalışan riski bildirimi bu ekranın sınırlarına takılmaz; etik hattı / İSG sürecine yönlenir.</p></div></section>
    </>
  );
}
