/** Makine okunur doğrulama raporu: kod + sayfa + satır + sütun + değer; hard error varken onay yok (F12). */
export type Severity = 'error' | 'warning';
export interface Issue { severity: Severity; sheet: string; row: number | null; col: string | null; code: string; message: string; value?: string; }
export class Report {
  issues: Issue[] = [];
  error(sheet: string, row: number | null, col: string | null, code: string, message: string, value?: string) { this.issues.push({ severity: 'error', sheet, row, col, code, message, value }); }
  warn(sheet: string, row: number | null, col: string | null, code: string, message: string, value?: string) { this.issues.push({ severity: 'warning', sheet, row, col, code, message, value }); }
  get errors() { return this.issues.filter(i => i.severity === 'error'); }
  get warnings() { return this.issues.filter(i => i.severity === 'warning'); }
  get ok() { return this.errors.length === 0; }
}
export const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function requireSheet(sheets: Record<string, { header: string[] }>, name: string, cols: string[], rep: Report): boolean {
  const s = sheets[name]; if (!s) { rep.error(name, null, null, 'sheet_missing', `"${name}" sayfası yok`); return false; }
  const missing = cols.filter(c => !s.header.includes(c)); if (missing.length) { rep.error(name, 1, missing.join(','), 'columns_missing', `Eksik sütun: ${missing.join(', ')}`); return false; }
  return true;
}
