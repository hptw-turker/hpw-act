/** Madde metni normalizasyonu (Y05/F99-07): sayı içindeki ondalık ayırıcı korunur (1,5 = 1.5 ≠ 15); boşluk ve noktalama anlam taşımaz. Anlam değişimi otomatik eşitlenmez; sürümlü HPW kararı önce gelir. */
export const normTxt = (x: string): string => x.toLocaleLowerCase('tr-TR').replace(/(\d)[.,](\d)/g, '$1|$2').replace(/[.,;:!?'"()]/g, '').replace(/\s+/g, ' ').trim();
