/** v3.0 dosya yükleme: şablonu indir → dosyayı seç → doğrula (önizleme, hata ve uyarılar) → onayla. Geri bildirim her zaman düğmenin altında görünür. */
import { useRef, useState } from 'react';
import { tt } from '../i18n';
import { api, commandApi, describeError, download, type ImportResult } from '../api';

type Kind = 'org' | 'roadmap2' | 'users';
const FILE: Record<Kind, string> = { org: 'organizasyon', roadmap2: 'yol_haritasi', users: 'kullanicilar' };

function Preview({ kind, p }: { kind: Kind; p: Record<string, unknown> }) {
  if (kind === 'roadmap2') {
    const r = p as { report?: string; startDate?: string; cycle?: string; roadmaps?: { unit: string; name: string; layer: string; plans: number; targets: number; ikSteps: number; managementSteps: number; employeeSteps: number; references: number }[] };
    return <div className="v-field"><p><b>{r.report}</b> · {tt('Dönem')} {r.cycle} · {tt('Başlangıç')} {r.startDate ? `${r.startDate.slice(8, 10)}.${r.startDate.slice(5, 7)}.${r.startDate.slice(0, 4)}` : '—'}</p>
      <div className="v-tablewrap"><table className="v-table"><thead><tr><th>{tt('Birim')}</th><th>{tt('Katman')}</th><th>{tt('Plan')}</th><th>{tt('Hedefli')}</th><th>{tt('İK adımı')}</th><th>{tt('Yönetim adımı')}</th><th>{tt('Çalışan')}</th><th>{tt('Kurum atfı')}</th></tr></thead>
        <tbody>{(r.roadmaps ?? []).map(x => <tr key={x.unit}><td><b>{x.name}</b><br /><span className="v-meta">{x.unit}</span></td><td>{x.layer === 'KURUM' ? tt('Kurum') : tt('İşletme')}</td><td>{x.plans}</td><td>{x.targets}</td><td>{x.ikSteps}</td><td>{x.managementSteps}</td><td>{x.employeeSteps}</td><td>{x.references}</td></tr>)}</tbody></table></div></div>;
  }
  if (kind === 'org') { const o = p as { unitTypes?: number; units?: { create: number; update: number; close: number }; roles?: { create: number; update: number; close: number } };
    return <p>{tt('Birim tipi')}: <b>{o.unitTypes ?? 0}</b> · {tt('Yeni birim')}: <b>{o.units?.create ?? 0}</b> · {tt('Güncellenen birim')}: <b>{o.units?.update ?? 0}</b> · {tt('Yeni rol')}: <b>{o.roles?.create ?? 0}</b></p>; }
  const u = p as { users?: { create: number; update: number; deactivate: number }; invitations?: number; assignments?: number };
  return <p>{tt('Yeni kullanıcı')}: <b>{u.users?.create ?? 0}</b> · {tt('Güncellenen')}: <b>{u.users?.update ?? 0}</b> · {tt('Davet edilecek')}: <b>{u.invitations ?? 0}</b> · {tt('Rol ataması')}: <b>{u.assignments ?? 0}</b></p>;
}

export function Upload({ tid, kind, title, help, onDone }: { tid: string; kind: Kind; title: string; help: string; onDone?: () => void }) {
  const [file, setFile] = useState<File | null>(null); const [res, setRes] = useState<ImportResult | null>(null); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null); const [done, setDone] = useState<string | null>(null); const gen = useRef(0); const inputId = `f-${kind}`;
  const validate = async () => { if (!file) return; const my = ++gen.current; setBusy(true); setErr(null); setDone(null); setRes(null);
    try { const fd = new FormData(); fd.append('file', file); const r = await api<ImportResult>('POST', `/api/t/${tid}/imports/${kind}`, fd); if (my === gen.current) setRes(r); } catch (e) { setErr(describeError(e)); } finally { setBusy(false); } };
  const commit = async () => { if (!res?.canCommit) return; setBusy(true); setErr(null);
    try { await commandApi(`/api/t/${tid}/imports/${res.jobId}/commit`, {}); setDone(tt('Yüklendi. {0} satır işlendi.', res.rowCount)); setRes(null); setFile(null); onDone?.(); } catch (e) { setErr(describeError(e)); } finally { setBusy(false); } };
  return <div className="v-field">
    <p className="v-h3">{title}</p><p className="v-meta">{help}</p>
    <div className="v-btns"><button type="button" className="v-btn2" onClick={() => download(`/api/t/${tid}/templates/${kind}.xlsx`, `HPW_Act_${FILE[kind]}_sablonu.xlsx`).catch(e => setErr(describeError(e)))}>{tt('Boş şablonu indir')}</button></div>
    <div className="v-file"><label htmlFor={inputId} className="v-fl v-lbl">{tt('Doldurulmuş dosya (.xlsx)')}</label><input id={inputId} type="file" accept=".xlsx" onChange={e => { gen.current++; setFile(e.target.files?.[0] ?? null); setRes(null); setDone(null); setErr(null); }} /></div>
    <div className="v-btns"><button type="button" className="v-btn" disabled={!file || busy} onClick={() => void validate()}>{busy && !res ? tt('Denetleniyor…') : tt('Dosyayı denetle')}</button>
      {res ? <button type="button" className="v-btn" disabled={!res.canCommit || busy} onClick={() => void commit()}>{tt('Onayla ve yükle')}</button> : null}</div>
    {err ? <p className="v-alert" role="alert">{err}</p> : null}
    {done ? <p className="v-ok" role="status">{done}</p> : null}
    {res ? <div className="v-field" aria-live="polite">
      <p className={res.canCommit ? 'v-ok' : 'v-alert'}>{res.canCommit ? tt('Dosya geçerli: {0} satır · {1} uyarı. Aşağıdaki özeti kontrol edip "Onayla ve yükle"ye basın.', res.rowCount, res.warningCount) : tt('Dosyada {0} hata var; düzeltip yeniden yükleyin. Hata varken yükleme yapılamaz.', res.errorCount)}</p>
      {res.canCommit ? <Preview kind={kind} p={res.preview} /> : null}
      {res.issues.length ? <div className="v-tablewrap"><table className="v-table"><thead><tr><th>{tt('Önem')}</th><th>{tt('Sayfa')}</th><th>{tt('Satır')}</th><th>{tt('Sütun')}</th><th>{tt('Açıklama')}</th><th>{tt('Değer')}</th></tr></thead>
        <tbody>{res.issues.slice(0, 200).map((i, k) => <tr key={k}><td>{i.severity === 'error' ? <b>{tt('Hata')}</b> : tt('Uyarı')}</td><td>{i.sheet}</td><td>{i.row ?? '—'}</td><td>{i.col ?? '—'}</td><td className="v-wrap">{i.message}</td><td className="v-wrap">{i.value ?? ''}</td></tr>)}</tbody></table></div> : null}
      {res.errorCount ? <div className="v-btns"><button type="button" className="v-btn2" onClick={() => download(`/api/t/${tid}/imports/${res.jobId}/errors.xlsx`, 'hata_satirlari.xlsx').catch(e => setErr(describeError(e)))}>{tt('Hata satırlarını indir')}</button></div> : null}
    </div> : null}
  </div>;
}
