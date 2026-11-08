/** v2.14 Tasarım B — ortak arayüz parçaları. Kaynak: onaylanan rol prototipleri (Ekim 2026) ve docs/design/hpw-act-arayuz-sistemi.md §Tasarım B.
 * Kurallar: yalnız gerekli bilgi; önce karar, sonra risk, sonra durum; her sayı grafikle ve grafiğin üstünde tek satır açıklama; ilerleme kareyle;
 * düğme ne yaptığını söyler; düğmeler içeriğin altında; "Nasıl okunur?" sağ kenardaki kapalı kulptan açılır; madde metinleri kesilmez; form alanları aynı hizada. */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { tt, locale } from '../i18n';

/** Sayı biçimi: 13,8 (tr) · 13.8 (en) */
export const f1 = (v: number) => Number(v).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const f0 = (v: number) => Number(v).toLocaleString(locale(), { maximumFractionDigits: 0 });

/* ------------------------------------------------------------------ Nasıl okunur? (sağ kenar paneli) */
type Not = { baslik: string; metin: ReactNode };
const NotCtx = createContext<{ add: (n: Not) => () => void } | null>(null);
/** Ekran kabı: notları toplar, sağ kenarda "Nasıl okunur?" kulpu ve paneli çizer. */
export function Ekran({ baslik, children }: { baslik: string; children: ReactNode }) {
  const [notlar, setNotlar] = useState<Not[]>([]); const [acik, setAcik] = useState(false);
  const ctx = useMemo(() => ({ add: (n: Not) => { setNotlar(l => [...l, n]); return () => setNotlar(l => l.filter(x => x !== n)); } }), []);
  return <NotCtx.Provider value={ctx}><div className="rel">{children}
    <div className="cekmece"><button type="button" className="kulp" onClick={() => setAcik(a => !a)} aria-expanded={acik} aria-controls="tb-yardim">{tt('Nasıl okunur?')}</button></div>
    <aside className={`panel${acik ? ' on' : ''}`} id="tb-yardim" aria-label={tt('Nasıl okunur?')} hidden={!acik}><div className="kicker">{tt('Nasıl okunur?')}</div><h3 style={{ marginTop: '.5rem' }}>{baslik}</h3>
      {notlar.length ? notlar.map((n, i) => <div key={i}><h4>{n.baslik}</h4><p>{n.metin}</p></div>) : <p>{tt('Bu ekranda ek açıklama yok.')}</p>}
      <div style={{ marginTop: '1rem' }}><button type="button" className="ybtn" onClick={() => setAcik(false)}>{tt('Kapat')}</button></div></aside>
  </div></NotCtx.Provider>;
}
/** Bölüme bağlı açıklama: ekranda yer kaplamaz, panelde listelenir */
export function Not({ baslik, children }: { baslik: string; children: ReactNode }) {
  const ctx = useContext(NotCtx);
  useEffect(() => { if (!ctx) return; return ctx.add({ baslik, metin: children }); }, [ctx, baslik]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/* ------------------------------------------------------------------ Başlık, şerit, bölüm */
export function Baslik({ kicker, h1, cap, sag }: { kicker: string; h1: ReactNode; cap?: ReactNode; sag?: ReactNode }) {
  return <div className="tb-baslik"><div><div className="kicker">{kicker}</div><h1 style={{ marginTop: '.625rem' }}>{h1}</h1>{cap ? <p className="cap" style={{ marginTop: '.5rem' }}>{cap}</p> : null}</div>{sag ? <div className="ikili">{sag}</div> : null}</div>;
}
/** Siyah özet şeridi: en fazla üç hücre; vurgu kutuları büyük yazı, açıklama hücresi düz metin */
export function Serit({ hucreler }: { hucreler: { k: string; v: ReactNode; duz?: boolean }[] }) {
  return <div className="b-ozet">{hucreler.map((h, i) => <div key={i}><div className="k">{h.k}</div>{h.duz ? <div className="t">{h.v}</div> : <div className="v">{h.v}</div>}</div>)}</div>;
}
/** Üç büyük başlık satırı (gündem): kırmızı üst çizgi = sizden beklenen */
export function Buyuk({ hucreler }: { hucreler: { ol: string; sayi: ReactNode; p: ReactNode; red?: boolean }[] }) {
  return <div className="bigrow">{hucreler.map((h, i) => <div key={i} className={`big${h.red ? ' red' : ''}`}><div className="ol">{h.ol}</div><div className="sayi">{h.sayi}</div><p>{h.p}</p></div>)}</div>;
}
/** Numaralı bölüm: solda numara ve soru, sağda içerik (tam genişlik); düğmeler içeriğin altında */
export function Bolum({ n, kicker, soru, red, ilk, children, dugmeler, not }: { n: ReactNode; kicker: string; soru: ReactNode; red?: boolean; ilk?: boolean; children: ReactNode; dugmeler?: ReactNode; not?: ReactNode }) {
  return <div className={ilk ? 'b-row b-row--ilk' : 'b-row'}>
    <div><div className="b-no">{n}</div><div className={`kicker${red ? '' : ' k-ink'}`} style={{ marginTop: '.75rem' }}>{kicker}</div><h3 style={{ marginTop: '.375rem' }}>{soru}</h3></div>
    <div className="tb-icerik">{children}{dugmeler ? <div className="ikili">{dugmeler}</div> : null}</div>
    {not ? <Not baslik={`${typeof n === 'string' || typeof n === 'number' ? n + ' · ' : ''}${kicker}`}>{not}</Not> : null}
  </div>;
}
/** Tam genişlik bölüm (grafik ve tablolar): kicker, soru, tek satır açıklama, içerik */
export function Tam({ kicker, soru, cap, red, children, id }: { kicker: string; soru: ReactNode; cap?: ReactNode; red?: boolean; children: ReactNode; id?: string }) {
  return <div className="degwrap" id={id}><div className="deghead"><div className={`kicker${red ? '' : ' k-ink'}`}>{kicker}</div><h3>{soru}</h3>{cap ? <p className="cap">{cap}</p> : null}</div>{children}</div>;
}
export function Uyari({ children, id, gizli }: { children: ReactNode; id?: string; gizli?: boolean }) { return gizli ? null : <div className="uyari" id={id} role="status">{children}</div>; }
export function Hata({ children }: { children: ReactNode }) { return <div className="hata" role="alert">{children}</div>; }
export function Rozet({ t, k }: { t: ReactNode; k?: 's' | 'k' }) { return <span className={`rozet${k ? ' ' + k : ''}`}>{t}</span>; }
export function Ornek({ t }: { t?: string }) { return <span className="ornek">{t ?? tt('Örnek değer')}</span>; }

/* ------------------------------------------------------------------ Kare ilerleme */
export function Kare({ dolu, toplam, buyuk, etiket }: { dolu: number; toplam: number; buyuk?: boolean; etiket?: string }) {
  const t = Math.max(0, Math.min(60, Math.round(toplam))); const d = Math.max(0, Math.min(t, Math.round(dolu)));
  return <span className={`kare${buyuk ? ' b' : ''}`} role="img" aria-label={etiket ?? tt('{0} planlanandan {1} yapıldı', t, d)}>{Array.from({ length: t }, (_, i) => <span key={i} className={i < d ? 'sw d' : 'sw'} />)}</span>;
}
export function KareLeg() { return <div className="leg"><span><span className="sw" style={{ background: 'var(--red)' }} />{tt('yapıldı ve kaydedildi')}</span><span><span className="sw sw--bos" />{tt('henüz yapılmadı')}</span></div>; }
export function Legend({ items }: { items: [string, string][] }) { return <div className="leg">{items.map(([c, t], i) => <span key={i}><span className="sw" style={{ background: c }} />{t}</span>)}</div>; }

/* ------------------------------------------------------------------ Çubuk tabloları */
export type BarSatir = { metin: ReactNode; b: number; s: number; pct?: boolean };
/** Birim – şirket geneli ikili çubuk tablosu: Madde · çubuk · Bu birim · Şirket geneli · Durum */
export function BarTablo({ satirlar, eb = tt('Bu birim'), es = tt('Şirket geneli'), ed = tt('Durum'), madde = tt('Madde'), cap, grafik = tt('Olumlu yanıt oranı · çubuk') }: { satirlar: BarSatir[]; eb?: string; es?: string; ed?: string; madde?: string; cap?: ReactNode; grafik?: string }) {
  const c = cap ?? tt('Siyah çubuk {0}, gri çubuk {1}; değerler olumlu yanıt oranı (%).', eb.toLocaleLowerCase('tr-TR'), es.toLocaleLowerCase('tr-TR'));
  return <div className="bgrid"><p className="cap">{c}</p><div className="h">{madde}</div><div className="h">{grafik}</div><div className="h">{eb}</div><div className="h">{es}</div><div className="h">{ed}</div>
    {satirlar.map((r, i) => { const d = r.b - r.s; const P = r.pct === false ? '' : '%'; return <Satir key={i} r={r} d={d} P={P} />; })}</div>;
}
function Satir({ r, d, P }: { r: BarSatir; d: number; P: string }) {
  return <><div className="t">{r.metin}</div><div><div className="btrack"><div className="bar2 b" style={{ width: `${r.b * 2.5}px` }} /><div className="bar2 s" style={{ width: `${r.s * 2.5}px` }} /></div></div><div className="c">{P}{f1(r.b)}</div><div className="c m">{P}{f1(r.s)}</div><div className={`c${d < 0 ? ' red' : ''}`}>{tt('{0} puan {1}', f1(Math.abs(d)), d < 0 ? tt('geride') : tt('önde'))}</div></>;
}
/** Önceki ölçümle karşılaştırma: Madde · çubuk · 2025 · 2026 · Değişim */
export function DegTablo({ satirlar, a, b, cap }: { satirlar: { metin: ReactNode; a: number; b: number; ornek?: boolean }[]; a: string; b: string; cap?: ReactNode }) {
  return <div className="bgrid deg"><p className="cap">{cap ?? tt('Üstteki gri çubuk {0} ölçümü, alttaki siyah çubuk {1} ölçümü; kırmızı rakam düşüş.', a, b)}</p><div className="h">{tt('Madde')}</div><div className="h">{a} → {b} · {tt('çubuk')}</div><div className="h">{a}</div><div className="h">{b}</div><div className="h">{tt('Değişim')}</div>
    {satirlar.map((r, i) => { const d = r.b - r.a; return <div key={i} style={{ display: 'contents' }}><div className="t">{r.metin}{r.ornek ? <> <span className="ornek" style={{ fontSize: 10, padding: '2px 6px' }}>{tt('örnek')}</span></> : null}</div><div><div className="degtrack" style={{ height: 34, position: 'relative' }}><div className="bar2 s" style={{ width: `${r.a * 4.4}px`, top: 2 }} /><div className="bar2 b" style={{ width: `${r.b * 4.4}px`, top: 18 }} /></div></div><div className="c m">%{f1(r.a)}</div><div className="c">%{f1(r.b)}</div><div className={`c${d < 0 ? ' red' : ''}`}>{tt('{0} puan {1}', f1(Math.abs(d)), d < 0 ? tt('düşüş') : tt('artış'))}</div></div>; })}</div>;
}
/** Fark çubuğu (ortadan): sola kırmızı geride, sağa siyah önde */
export function FarkCubuk({ d }: { d: number }) { const w = Math.min(Math.abs(d) * 8, 125); return <div className="div"><span className={d < 0 ? 'neg' : 'pos'} style={{ width: `${w}px` }} /></div>; }

/* ------------------------------------------------------------------ Yığın şeridi (dağılım) */
export function Yigin({ parcalar, h = 22 }: { parcalar: [number, string][]; h?: number }) { const top = parcalar.reduce((a, p) => a + p[0], 0) || 1; return <div className="stack-bar" style={{ height: h }}>{parcalar.map(([v, c], i) => <div key={i} style={{ width: `${(v / top) * 100}%`, background: c }} />)}</div>; }

/* ------------------------------------------------------------------ Açılır liste (etiket: değer) */
export function Secici({ etiket, deger, secenekler, onSec, id }: { etiket: string; deger: string; secenekler: { v: string; t: ReactNode; alt?: ReactNode }[]; onSec: (v: string) => void; id?: string }) {
  const [acik, setAcik] = useState(false); const [q, setQ] = useState(''); const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (!acik) return; const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAcik(false); }; document.addEventListener('click', h); return () => document.removeEventListener('click', h); }, [acik]);
  const ql = q.toLocaleLowerCase('tr-TR'); const liste = secenekler.filter(s => !ql || String(typeof s.t === 'string' ? s.t : '').toLocaleLowerCase('tr-TR').includes(ql) || String(s.v).toLocaleLowerCase('tr-TR').includes(ql));
  const cur = secenekler.find(s => s.v === deger);
  return <span className={`secw${acik ? ' on' : ''}`} ref={ref} id={id}><button type="button" className="sec" aria-haspopup="listbox" aria-expanded={acik} onClick={() => setAcik(a => !a)}>{etiket}: <span className="secv">{cur?.t ?? deger}</span></button>
    {acik ? <div className="ddl" role="listbox"><input className="ara" value={q} onChange={e => setQ(e.target.value)} aria-label={tt('Yaz, liste daralır…')} placeholder={tt('Yaz, liste daralır…')} />{liste.map(s => <div key={s.v} className="it" role="option" aria-selected={s.v === deger} tabIndex={0} onClick={() => { onSec(s.v); setAcik(false); setQ(''); }} onKeyDown={e => { if (e.key === 'Enter') { onSec(s.v); setAcik(false); } }}>{s.t}{s.alt ? <> <span className="cap">· {s.alt}</span></> : null}</div>)}{liste.length === 0 ? <div className="it cap">{tt('Eşleşen kayıt yok')}</div> : null}</div> : null}</span>;
}

/* ------------------------------------------------------------------ Tablo */
export function Tablo({ bas, satirlar, gen, orta, id, bos }: { bas: ReactNode[]; satirlar: ReactNode[][]; gen?: (string | undefined)[]; orta?: number[]; id?: string; bos?: ReactNode }) {
  // v2.14.1 (A06): tek tablo (başlık ve gövde aynı sütun hesabı); dar ekranda yatay kaydırma kapta
  return <div className="tbl-kaydir"><table className="tbl2" id={id}><thead><tr>{bas.map((h, i) => <th key={i} className={orta?.includes(i) ? 'orta' : (i === bas.length - 1 && h === '' ? 'dugme' : undefined)} style={gen?.[i] ? { width: gen[i] } : undefined}>{h}</th>)}</tr></thead>
    <tbody>{satirlar.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={orta?.includes(j) ? 'orta' : (j === bas.length - 1 && bas[j] === '' ? 'dugme' : undefined)}>{c}</td>)}</tr>)}{satirlar.length === 0 && bos ? <tr><td colSpan={bas.length} className="cap">{bos}</td></tr> : null}</tbody></table></div>;
}
export function KucukBtn({ children, onClick, disabled, testid }: { children: ReactNode; onClick: () => void; disabled?: boolean; testid?: string }) { return <button type="button" className="kucukbtn" onClick={onClick} disabled={disabled} data-testid={testid}>{children}</button>; }
