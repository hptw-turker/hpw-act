import ExcelJS from 'exceljs/dist/exceljs.min.js';
class HttpError extends Error { status: number; code: string; constructor(status: number, code: string, message?: string) { super(message ?? code); this.status = status; this.code = code; } }
/** XLSX okuma/yazma: formüller çalıştırılmaz (yalnız literal değer), makro/harici bağlantı yoksayılır, boyut sınırı çağıranda. Türkçe ondalık virgül sayı alanlarında normalize edilir. */
export type Row = Record<string, string>;
export interface Sheet { name: string; header: string[]; rows: { n: number; cells: Row }[]; }
export async function readWorkbook(buf: ArrayBuffer): Promise<Record<string, Sheet>> {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf); } catch { throw new HttpError(422, 'xlsx_unreadable', 'Dosya geçerli bir XLSX değil'); }
  const out: Record<string, Sheet> = {};
  wb.eachSheet(ws => {
    const header: string[] = []; const rows: Sheet['rows'] = [];
    ws.eachRow((row, rn) => {
      const vals: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, cn) => { vals[cn - 1] = cellText(cell); });
      if (rn === 1) { for (let i = 0; i < vals.length; i++) header[i] = (vals[i] ?? '').trim(); return; }
      if (header.length === 0) return;
      const cells: Row = {}; let any = false;
      header.forEach((h, i) => { if (!h) return; const v = (vals[i] ?? '').trim(); cells[h] = v; if (v !== '') any = true; });
      if (any) rows.push({ n: rn, cells });
    });
    out[ws.name] = { name: ws.name, header, rows };
  });
  return out;
}
function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value as unknown;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: string; hyperlink?: string };
    if ('formula' in (v as object) || 'sharedFormula' in (v as object)) return o.result !== undefined && o.result !== null ? String(o.result) : ''; // formül çalıştırılmaz; yalnız kaydedilmiş sonuç
    if (o.richText) return o.richText.map(r => r.text).join('');
    if (o.text) return String(o.text);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
  }
  if (typeof v === 'number' && cell.numFmt && /[dmy]/i.test(cell.numFmt) && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400 * 1000)); return d.toISOString().slice(0, 10); }
  return String(v);
}
/** Sayı: "68,75" → 68.75; "1.234,5" → 1234.5; boş → null; geçersiz → NaN */
export function num(s: string): number | null { if (s === '' || s === undefined) return null; let t = s.trim().replace(/\s/g, ''); if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(',', '.'); const n = Number(t); return Number.isFinite(n) ? n : NaN; }
export function int(s: string): number | null { const n = num(s); if (n === null) return null; return Number.isInteger(n) ? n : NaN; }
export function isoDate(s: string): string | null { if (!s) return null; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`; const t = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s); if (t) return `${t[3]}-${t[2]!.padStart(2, '0')}-${t[1]!.padStart(2, '0')}`; const n = num(s); if (n !== null && Number.isFinite(n) && n > 20000 && n < 80000) return new Date(Math.round((n - 25569) * 86400 * 1000)).toISOString().slice(0, 10); return 'INVALID'; }
/** Formül enjeksiyonuna karşı dışa aktarım: hücre = + - @ ile başlıyorsa tırnaklanır */
export const safeText = (s: unknown): string => { const t = s === null || s === undefined ? '' : String(s); return /^[=+\-@\t\r]/.test(t) ? `'${t}` : t; };

export interface TemplateSheet { name: string; columns: { key: string; header: string; width?: number; list?: string[]; required?: boolean }[]; rows?: Record<string, unknown>[]; }
export async function buildWorkbook(opts: { title: string; guide: string[]; version: string; sheets: TemplateSheet[]; dictionary: { sheet: string; field: string; desc: string; req: string; type: string; allowed?: string }[] }): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook(); wb.creator = 'HPW Act';
  const g = wb.addWorksheet('KILAVUZ'); g.getColumn(1).width = 120;
  g.addRow([opts.title]).font = { bold: true, size: 14 }; g.addRow([`Şablon sürümü: ${opts.version} · üretim tarihi: ${new Date().toISOString().slice(0, 10)}`]); g.addRow(['']);
  for (const line of opts.guide) g.addRow([line]);
  for (const s of opts.sheets) {
    const ws = wb.addWorksheet(s.name);
    ws.columns = s.columns.map(c => ({ key: c.key, header: c.header, width: c.width ?? Math.max(14, c.header.length + 4) }));
    ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', ySplit: 1 }];
    for (const r of s.rows ?? []) ws.addRow(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safeText(v)])));
    s.columns.forEach((c, i) => { if (c.list && c.list.length) { const col = ws.getColumn(i + 1).letter; for (let r = 2; r <= Math.max(500, (s.rows?.length ?? 0) + 200); r++) ws.getCell(`${col}${r}`).dataValidation = { type: 'list', allowBlank: !c.required, formulae: [`"${c.list.join(',')}"`] }; } });
  }
  const d = wb.addWorksheet('SOZLUK'); d.columns = [{ header: 'Sayfa', key: 'sheet', width: 18 }, { header: 'Alan', key: 'field', width: 26 }, { header: 'Açıklama', key: 'desc', width: 80 }, { header: 'Gereklilik', key: 'req', width: 12 }, { header: 'Veri tipi', key: 'type', width: 12 }, { header: 'İzinli değerler', key: 'allowed', width: 40 }];
  d.getRow(1).font = { bold: true }; for (const r of opts.dictionary) d.addRow(r);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
export async function errorWorkbook(errors: { sheet: string; row: number | null; col: string | null; code: string; message: string; value?: string; severity: string }[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('HATALAR');
  ws.columns = [{ header: 'Önem', key: 'severity', width: 10 }, { header: 'Sayfa', key: 'sheet', width: 16 }, { header: 'Satır', key: 'row', width: 8 }, { header: 'Sütun', key: 'col', width: 20 }, { header: 'Kod', key: 'code', width: 26 }, { header: 'Açıklama', key: 'message', width: 80 }, { header: 'Değer', key: 'value', width: 30 }];
  ws.getRow(1).font = { bold: true }; for (const e of errors) ws.addRow({ ...e, value: safeText(e.value ?? '') });
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
