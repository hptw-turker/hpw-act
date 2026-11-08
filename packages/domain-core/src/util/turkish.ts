/**
 * Türkçe büyük/küçük harf dönüşümü. String.prototype.toUpperCase/toLowerCase i/İ ve ı/I ayrımını bilmez.
 * Bu iki fonksiyon depo genelinde tek izinli yoldur (CLAUDE.md).
 */
export function trUpper(s: string): string {
  // i → İ, ı → I, sonra locale-bağımsız üst dönüşüm
  return s.replace(/i/g, 'İ').replace(/ı/g, 'I').toLocaleUpperCase('tr-TR');
}
export function trLower(s: string): string {
  // İ → i, I → ı, sonra locale-bağımsız alt dönüşüm
  return s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr-TR');
}
export const trCollator = new Intl.Collator('tr-TR', { sensitivity: 'base' });
export function trCompare(a: string, b: string): number { return trCollator.compare(a, b); }
