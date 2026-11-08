import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { data } from '../api/mock';
import { Kicker } from '../components/Kicker';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { parseBundle, detectInstrument, derivePanels, HPTW_2026, type DetectionSummary, type PanelSpec } from '@hpw-act/domain-core';
import { SAMPLE_BUNDLE } from '../fixtures/bundle';

const PANEL_KIND: Record<string, string> = { item_table: 'madde tablosu', dimension_summary: 'boyut özeti (türetilmiş)', heatmap_unit_item: 'birim × madde ısı haritası', nps: 'NPS', custom_items: 'şirkete özel maddeler', index_card: 'indeks kartı', responsibility_map: 'sorumluluk merkezi haritası', interaction_areas: 'dört etkileşim alanı' };
/** Sonuç alma (v2.4): sonuç paketi (manifest + instrument + results_item [+ results_index, benchmarks]) belirli formatta yüklenir; sistem enstrümanı algılar (hangi boyutlar var, hangileri çıkarılmış, özel maddeler), Top Box'ı dağılımdan yeniden hesaplar, resmî indeksle mutabakat yapar ve panelleri türetir. */
export default function Import() {
  const { t, fmt } = useI18n();
  const [file, setFile] = useState<string | null>(null);
  const [stage, setStage] = useState<'idle' | 'validated' | 'imported'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [detection, setDetection] = useState<DetectionSummary | null>(null);
  const [panels, setPanels] = useState<PanelSpec[]>([]);
  const [broken, setBroken] = useState(false);
  const rowsAll = useMemo(() => data.units.filter(u => u.trust !== null).length * 77, []);
  const validate = () => {
    try {
      const files = broken ? { ...SAMPLE_BUNDLE, resultsItem: SAMPLE_BUNDLE.resultsItem.replace('SUBE-KONAK;BAS-01;32;68.8;3;2;5;11;11', 'SUBE-KONAK;BAS-01;32;90.0;3;2;5;11;11') } : SAMPLE_BUNDLE;
      const bundle = parseBundle(files); const d = detectInstrument(bundle, HPTW_2026);
      setDetection(d); setPanels(derivePanels(bundle.instrument)); setError(null); setStage('validated');
    } catch (e) { setError(String((e as Error).message)); setDetection(null); setPanels([]); setStage('idle'); }
  };
  const canPublish = stage === 'validated' && !!detection && !detection.warnings.some(w => w.includes('mutabakat') || w.startsWith('Sertifikasyon'));
  return (
    <>
      <section className="section surface-white">
        <div className="container grid">
          <div className="col-12"><Kicker>{t('results.kicker')} · sonuç paketi · hpw-act-result-bundle v1</Kicker></div>
          <div className="col-6 stack-4">
            <h1 className="h1">Sonuçlar bir kez alınır, tarih yeniden yazılmaz.</h1>
            <p className="body-l measure">HPTW sonuç paketi beş dosyadır: manifest.json (dönem, enstrüman, puanlama kuralı), instrument.csv (madde, boyut, ölçek, etkileşim alanı, sorumluluk merkezi), results_item.csv (birim × madde: n, yanıt dağılımı), results_index.csv (resmî indeks değerleri; mutabakat için), benchmarks.csv. Sistem enstrümanı bu paketten algılar; şirket bir boyutu çıkarmışsa paneli kurulmaz, madde eklemişse ayrı panelde görünür.</p>
            <div className="stack">
              <Field id="cycle" kind="select" label="Dönem" defaultValue="2026-ANA"><option value="2026-ANA">2026 Ana Ölçüm · 06–24 Nisan 2026</option></Field>
              <Field id="group" kind="select" label="Toplama hiyerarşisi (dönem başına bir)" defaultValue="idari"><option value="idari">İdari</option><option value="cografi">Coğrafi</option></Field>
              <label className="field file"><span className="field__label caption">Sonuç paketi (.zip: manifest.json + CSV'ler)</span><span className="btn btn--secondary">Dosya seç</span><input type="file" accept=".zip,.json,.csv" onChange={e => { setFile(e.target.files?.[0]?.name ?? null); setStage('idle'); setDetection(null); }} /><span className="field__hint" style={{ display: 'block' }}>{file ? `Seçildi: ${file} (prototip örnek paketi kullanılır)` : 'Paket şablonunu HPTW danışmanınızdan alın'}</span></label>
              <label className="row caption" style={{ gap: 'var(--s-1)' }}><input type="checkbox" checked={broken} onChange={e => { setBroken(e.target.checked); setStage('idle'); setDetection(null); }} /> Deneme: paketin Top Box değerini dağılımla çelişecek biçimde boz</label>
              <div className="row">
                <Button onClick={validate} disabled={!file || stage !== 'idle'} disabledReason={!file ? 'Önce dosya seçin' : stage !== 'idle' ? 'Doğrulandı' : undefined}>Doğrula ve önizle</Button>
                <Button variant="secondary" onClick={() => setStage('imported')} disabled={!canPublish} disabledReason={stage === 'imported' ? 'Yayımlandı · süreç tamamlandı' : stage === 'idle' ? 'Önce doğrulayın' : 'Mutabakat ya da çekirdek uyarısı varken yayımlanamaz'}>Yayımla</Button>
              </div>
              {error ? <p className="bold">Paket reddedildi: {error}</p> : null}
            </div>
          </div>
          <div className="col-6 stack">
            <Kicker>Algılanan enstrüman</Kicker>
            {detection ? (
              <table className="table"><tbody>
                <tr><td>Enstrüman</td><td className="bold">{detection.instrumentCode} {detection.version}</td></tr>
                <tr><td>Madde / boyut</td><td className="num bold red">{detection.itemCount} / {detection.dimensionCount}</td></tr>
                <tr><td>Modüller</td><td>çekirdek {detection.modules.core} · bağlılık {detection.modules.engagement} · ekosistem {detection.modules.ecosystem} · şirkete özel {detection.modules.custom}</td></tr>
                <tr><td>Çıkarılan boyut</td><td>{detection.removedDimensions.length ? detection.removedDimensions.map(d => d.name).join(', ') : '—'}</td></tr>
                <tr><td>Özel madde</td><td>{detection.customItems.length ? detection.customItems.map(c => `${c.code} "${c.text}"`).join(' · ') : '—'}</td></tr>
                <tr><td>Ölçekler</td><td>{Object.entries(detection.scales).map(([k, v]) => `${k}: ${v}`).join(' · ')}</td></tr>
                <tr><td>İndeks mutabakatı</td><td>{detection.indexReconciliation.map(r => `${r.unitId} ${r.indexCode} resmî ${fmt(r.official)} / hesaplanan ${r.computed === null ? '—' : fmt(r.computed)} ${r.ok ? 'eşleşiyor' : 'EŞLEŞMİYOR'}`).join(' · ')}</td></tr>
                <tr><td>Uyarı</td><td>{detection.warnings.length ? detection.warnings.join(' · ') : 'yok'}</td></tr>
              </tbody></table>
            ) : (
              <table className="table"><tbody>
                <tr><td>Beklenen satır (tam yükleme)</td><td className="num bold red">{fmt(rowsAll, 0)}</td></tr>
                <tr><td>Birim</td><td className="num">{fmt(data.units.length, 0)}</td></tr>
                <tr><td>Gizlenecek satır (n &lt; 5)</td><td className="num">{fmt(data.units.filter(u => u.suppressed).length * 77, 0)}</td></tr>
              </tbody></table>
            )}
            <p className="caption">{stage === 'imported' ? 'Yayımlandı: enstrüman sürümü kaydedildi, paneller kuruldu, madde metrikleri açıldı. Eski sonuçlar silinmedi (revizyon).' : stage === 'validated' ? 'Doğrulandı (taslak). Top Box dağılımdan yeniden hesaplandı; gizli birimler (n<5) pakette bile sayı taşımaz. "Yayımla" tek görünürlük geçişidir.' : 'Paket seçip doğrulayın; tablo algılanan enstrümanı gösterir.'}</p>
          </div>
        </div>
      </section>
      {panels.length ? (
        <section className="section--tight surface-white">
          <div className="container stack-1">
            <Kicker>Türetilen paneller · {panels.length}</Kicker>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Panel</th><th>Tür</th><th className="num">Metrik</th><th>Not</th></tr></thead>
              <tbody>{panels.map(p => <tr key={p.id}><td className="bold">{p.title}</td><td className="caption">{PANEL_KIND[p.kind]}</td><td className="num">{p.metricCodes.length}</td><td className="caption">{p.note ?? '—'}</td></tr>)}</tbody>
            </table></div>
            <p className="caption">Paneller enstrümandan türetilir: çıkarılan boyutun paneli yoktur; NPS maddesi yoksa NPS paneli kurulmaz; şirkete özel maddeler benchmark'sız ayrı paneldedir. Boyut özeti türetilmiştir ve boyut içi yayılımı gizler; takip birimi maddedir.</p>
          </div>
        </section>
      ) : null}
    </>
  );
}
