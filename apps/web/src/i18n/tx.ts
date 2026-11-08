/** Kod içi Türkçe metin için İngilizce karşılık; DOM çevirisiyle aynı sözlüğü kullanır. Türkçe modda kimlik fonksiyonu. */
import { useI18n } from './index';
import { translateString } from './domTranslate';

export function useTx(): (s: string) => string {
  const { lang } = useI18n();
  return (s: string) => (lang === 'en' ? translateString(s) : s);
}
