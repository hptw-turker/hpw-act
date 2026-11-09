/** v3.1.0 (R-09) — adım kayıtlarına eklenen dosyaların sade deposu.
 * - İçerik veritabanında değil, kalıcı dizinde durur: <HPW_FILE_DIR>/<şirket kimliği>/<rastgele anahtar>. Dosya adı ve uzantı diskte kullanılmaz;
 *   adres tahmin edilemez ve hiçbir yerden doğrudan servis edilmez — tek erişim yolu yetki denetimli indirme ucudur.
 * - Tür, içeriğin ilk baytlarından tanınır ve uzantıyla eşleşmek zorundadır; izin listesi dışındaki her şey reddedilir. İçerik hiçbir zaman çalıştırılmaz.
 * - Boyut ve adet sınırı sunucuda uygulanır (config.recordFileMaxBytes, config.recordFileMaxCount). */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, unlinkSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.js';
import { HttpError } from './db.js';

export interface StoredFile { storageKey: string; fileName: string; mime: string; size: number; sha256: string }
/** Arayüzde gösterilen tür listesi ile aynı: fotoğraf (JPEG, PNG, WEBP, GIF, HEIC), PDF, Word, Excel, PowerPoint */
export const FILE_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
const OOXML: Record<string, string> = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
const OLE: Record<string, string> = { doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint' };
/** Tarayıcıda yeni sekmede güvenle gösterilebilen görüntü türleri (HEIC tarayıcıda açılmaz; yalnız indirilir) */
export const INLINE_IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const starts = (b: Buffer, sig: number[], at = 0) => b.length >= at + sig.length && sig.every((x, i) => b[at + i] === x);
const ascii = (b: Buffer, from: number, to: number) => b.subarray(from, to).toString('latin1');

/** İçerik + uzantı → MIME; eşleşmezse null */
export function detectMime(buf: Buffer, fileName: string): string | null {
  const ext = (/\.([A-Za-z0-9]{1,5})$/.exec(fileName)?.[1] ?? '').toLocaleLowerCase('en-US');
  if (starts(buf, [0xff, 0xd8, 0xff])) return ['jpg', 'jpeg'].includes(ext) ? 'image/jpeg' : null;
  if (starts(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return ext === 'png' ? 'image/png' : null;
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return ext === 'webp' ? 'image/webp' : null;
  if (['GIF87a', 'GIF89a'].includes(ascii(buf, 0, 6))) return ext === 'gif' ? 'image/gif' : null;
  if (ascii(buf, 4, 8) === 'ftyp' && ['heic', 'heix', 'hevc', 'mif1', 'msf1'].includes(ascii(buf, 8, 12))) return ['heic', 'heif'].includes(ext) ? 'image/heic' : null;
  if (ascii(buf, 0, 5) === '%PDF-') return ext === 'pdf' ? 'application/pdf' : null;
  if (starts(buf, [0x50, 0x4b, 0x03, 0x04])) return OOXML[ext] ?? null;
  if (starts(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return OLE[ext] ?? null;
  return null;
}
/** Görünen dosya adı: yol ve denetim karakterleri atılır, 200 karakterle sınırlanır (diskte kullanılmaz) */
export function cleanFileName(raw: string): string {
  const base = String(raw ?? '').split(/[\\/]/).pop() ?? '';
  const s = base.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (!s) return 'dosya';
  if (s.length <= 200) return s;
  const m = /(\.[A-Za-z0-9]{1,5})$/.exec(s); return m ? s.slice(0, 200 - m[1]!.length) + m[1] : s.slice(0, 200);
}
const tenantDir = (tenantId: string) => { if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new HttpError(400, 'bad_tenant'); return join(config.fileDir, tenantId); };
export const filePath = (tenantId: string, storageKey: string) => { if (!/^[0-9a-f-]{36}$/.test(storageKey)) throw new HttpError(404, 'not_found'); return join(tenantDir(tenantId), storageKey); };

/** Doğrulanmış içeriği diske yazar (yeni dosya, üzerine yazmaz). Çağıran, veritabanı işlemi başarısız olursa removeStored ile geri alır. */
export function storeFile(tenantId: string, buf: Buffer, rawName: string): StoredFile {
  const fileName = cleanFileName(rawName);
  if (!buf.length) throw new HttpError(422, 'file_empty', `Dosya boş: ${fileName}`);
  if (buf.length > config.recordFileMaxBytes) throw new HttpError(413, 'file_too_large', `Dosya en fazla ${Math.round(config.recordFileMaxBytes / 1048576)} MB olabilir: ${fileName}`);
  const mime = detectMime(buf, fileName);
  if (!mime) throw new HttpError(415, 'file_type_not_allowed', `Bu dosya türü kabul edilmiyor: ${fileName}. Kabul edilenler: fotoğraf (JPEG, PNG, WEBP, GIF, HEIC), PDF, Word, Excel, PowerPoint.`);
  const dir = tenantDir(tenantId); mkdirSync(dir, { recursive: true, mode: 0o700 });
  const storageKey = randomUUID();
  writeFileSync(join(dir, storageKey), buf, { flag: 'wx', mode: 0o600 });
  return { storageKey, fileName, mime, size: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
}
export function removeStored(tenantId: string, keys: string[]) { for (const k of keys) { try { unlinkSync(filePath(tenantId, k)); } catch { /* zaten yok */ } } }
export function storedSize(tenantId: string, storageKey: string): number | null { const f = filePath(tenantId, storageKey); return existsSync(f) ? statSync(f).size : null; }
/** RFC 6266 / 5987: ASCII yedek ad + UTF-8 ad */
export function contentDisposition(kind: 'attachment' | 'inline', name: string) {
  const fallback = name.normalize('NFKD').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${kind}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
