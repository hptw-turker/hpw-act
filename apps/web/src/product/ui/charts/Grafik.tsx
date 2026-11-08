/** v2.14 Tasarım B — veri grafikleri (SVG, ikon değil): mermi grafik (bugün / hedef, gerçekçi aralık bandı) ve Gantt takvimi (aksiyon süreleri, bugün çizgisi).
 * Renkler yalnız tokenlardan; masaüstünde geniş, telefonda dar sürüm (.svg-d / .svg-m). */
import { tt, locale } from '../../i18n';
const INK = 'var(--hpw-ink)', RED = 'var(--hpw-red)', GRI = 'var(--hpw-gray)', SOFT = 'var(--hpw-soft)', MID = 'var(--hpw-mid)', MUTE = 'var(--hpw-mute)';
const f1 = (v: number) => Number(v).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export type Mermi = { bugun: number; hedef: number | null; low: number | null; high: number | null; bugunEtiket?: string; hedefEtiket?: string };
function MermiRaw({ m, w, x0 }: { m: Mermi; w: number; x0: number }) {
  const h = 120, aw = w - x0 - 40; const ax = (v: number) => x0 + (v / 100) * aw; const small = w < 600;
  const r0: [string, number, string] = [m.bugunEtiket ?? tt('Bugün'), m.bugun, INK]; const rows: [string, number, string][] = [r0]; if (m.hedef !== null) rows.push([m.hedefEtiket ?? tt('Hedef'), m.hedef, RED]); const r1 = rows[1];
  return <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={tt('{0} %{1}, {2} %{3}', r0[0], f1(r0[1]), r1 ? r1[0] : '', r1 ? f1(r1[1]) : '')} fontFamily="var(--font)">
    {rows.map(([lab, val, col], i) => { const y = 18 + i * 44; return <g key={i}><text x={0} y={y + 20} fontSize={small ? 11 : 14} fontWeight={700} fill={INK}>{lab}</text><rect x={x0} y={y} width={aw} height={28} fill={SOFT} />{m.low !== null && m.high !== null ? <rect x={ax(m.low)} y={y} width={ax(m.high) - ax(m.low)} height={28} fill={MID} /> : null}<rect x={x0} y={y + 8} width={Math.max(0, ax(val) - x0)} height={12} fill={col} />{(() => { const lbl = `%${f1(val)}`; if (!small) return <text x={ax(val) + 8} y={y + 19} fontSize={15} fontWeight={700} fill={col}>{lbl}</text>; const est = 12 + 7 * lbl.replace(/[^0-9]/g, '').length + 4; /* v2.14.1 (A03): mobilde etiket viewBox dışına taşarsa sağ kenara yaslanır; çubuğa binecekse çubuğun altına iner (renk, boyut, ölçek aynen) */ if (ax(val) + 8 + est <= w) return <text x={ax(val) + 8} y={y + 19} fontSize={11} fontWeight={700} fill={col}>{lbl}</text>; if (w - 1 - est >= ax(val) + 2) return <text x={w - 1} y={y + 19} fontSize={11} fontWeight={700} fill={col} textAnchor="end">{lbl}</text>; return <text x={w - 1} y={y + 28 + 11} fontSize={11} fontWeight={700} fill={col} textAnchor="end">{lbl}</text>; })()}</g>; })}
    {Array.from({ length: 11 }, (_, k) => k * 10).map(v => <text key={v} x={ax(v)} y={h - 4} fontSize={small ? 8 : 11} fill={MUTE} textAnchor="middle">%{v}</text>)}
    {m.low !== null && m.high !== null ? <text x={ax((m.low + m.high) / 2)} y={12} fontSize={small ? 9 : 11} fill={MUTE} textAnchor="middle">{tt('gerçekçi aralık %{0}–%{1}', f1(m.low), f1(m.high))}</text> : null}
  </svg>;
}
/** Mermi grafik: üst çubuk bugün (siyah), alt çubuk hedef/öneri (kırmızı), koyu gri bant gerçekçi aralık */
export function MermiGrafik({ m, w = 1296 }: { m: Mermi; w?: number }) { return <><div className="svg-d"><MermiRaw m={m} w={w} x0={180} /></div><div className="svg-m"><MermiRaw m={m} w={350} x0={70} /></div></>; }

export type GanttSatir = { ad: string; alt?: string; bas: Date; bit: Date; ortak?: boolean; secili?: boolean; kareler?: { tarih: Date; dolu: boolean }[] };
function ayAdi(d: Date) { return d.toLocaleDateString(locale(), { month: 'short' }).replace('.', ''); }
function wrap2(t: string, n = 36): string[] { if (t.length <= n) return [t]; const c = t.lastIndexOf(' ', n); const cut = c > 0 ? c : n; return [t.slice(0, cut), t.slice(cut + 1)]; }
/** Gantt takvimi: aylık eksen, kesintisiz çubuklar (içinde tarih aralığı), ince kesikli "bugün" çizgisi, planlanan gerçekleşmeler kırmızı kare (dolu = kaydedildi) */
export function Gantt({ satirlar, baslangic, ayS = 12, w = 1296, basKolon = 330, bugun = new Date() }: { satirlar: GanttSatir[]; baslangic: Date; ayS?: number; w?: number; basKolon?: number; bugun?: Date }) {
  const satirH = 58, n = satirlar.length, h = 40 + n * satirH + 20, x0 = basKolon, aw = w - x0 - 20;
  const ay0 = new Date(baslangic.getFullYear(), baslangic.getMonth(), 1); const ax = (d: Date) => { const m = (d.getFullYear() - ay0.getFullYear()) * 12 + (d.getMonth() - ay0.getMonth()) + (d.getDate() - 1) / 30; return x0 + Math.max(0, Math.min(ayS, m)) / ayS * aw; };
  const aylar = Array.from({ length: ayS }, (_, i) => new Date(ay0.getFullYear(), ay0.getMonth() + i, 1));
  return <div className="degwrap-svg"><svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={tt('Aksiyon takvimi')} fontFamily="var(--font)">
    {aylar.map((a, i) => <g key={i}><line x1={ax(a)} y1={28} x2={ax(a)} y2={h - 16} stroke={SOFT} /><text x={ax(a) + aw / ayS / 2} y={18} fontSize={11} fill={MUTE} textAnchor="middle" fontWeight={700}>{ayAdi(a).toLocaleUpperCase(locale())}</text>{a.getMonth() === 0 || i === 0 ? <text x={ax(a)} y={h - 2} fontSize={10} fill={MUTE}>{a.getFullYear()}</text> : null}</g>)}
    <line x1={x0} y1={28} x2={w - 20} y2={28} stroke={INK} strokeWidth={1.5} />
    {satirlar.map((s, i) => { const y = 40 + i * satirH; const L = wrap2(s.ad); const col = s.secili ? RED : (s.ortak ? GRI : INK); const bs = ax(s.bas), bt = Math.max(ax(s.bit), bs + 6); return <g key={i}>
      <text x={0} y={y + (L.length > 1 ? 14 : 22)} fontSize={13} fontWeight={700} fill={INK}>{L[0]}</text>{L[1] ? <text x={0} y={y + 29} fontSize={13} fontWeight={700} fill={INK}>{L[1]}</text> : null}{s.alt ? <text x={0} y={y + 43} fontSize={11} fill={MUTE}>{s.alt}</text> : null}
      <rect x={bs} y={y + 6} width={bt - bs} height={30} fill={col} /><text x={bs + 10} y={y + 26} fontSize={12} fill="var(--hpw-white)" fontWeight={700}>{s.bas.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })} – {s.bit.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</text>
      {(s.kareler ?? []).map((k, j) => <rect key={j} x={ax(k.tarih) - 6} y={y + 40} width={6} height={6} fill={k.dolu ? RED : SOFT} stroke={RED} />)}</g>; })}
    <line x1={ax(bugun)} y1={28} x2={ax(bugun)} y2={h - 16} stroke={RED} strokeWidth={1} strokeDasharray="4 4" /><text x={ax(bugun) + 8} y={h - 20} fontSize={10} fill={RED} fontWeight={700}>{tt('BUGÜN')} · {bugun.toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' })}</text>
  </svg></div>;
}
