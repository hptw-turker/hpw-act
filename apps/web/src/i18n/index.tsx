import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import tr from './tr.json';
import en from './en.json';

type Lang = 'tr' | 'en';
type Catalog = Record<string, string>;
const catalogs: Record<Lang, Catalog> = { tr, en };

interface I18n { lang: Lang; setLang: (l: Lang) => void; t: (key: string, vars?: Record<string, string | number>) => string; fmt: (n: number | null, digits?: number) => string; fmtDate: (iso: string | null) => string; }
const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('tr');
  const value = useMemo<I18n>(() => ({
    lang,
    setLang: (l) => { setLang(l); document.documentElement.lang = l; },
    t: (key, vars) => {
      let s = catalogs[lang][key] ?? key;
      for (const [k, v] of Object.entries(vars ?? {})) s = s.replace(`{${k}}`, String(v));
      return s;
    },
    // Sayılar tr-TR biçiminde: 60,45 — İngilizcede 60.45
    fmt: (n, digits = 1) => n === null ? '—' : new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n),
    fmtDate: (iso) => iso ? new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso)) : '—',
  }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useI18n(): I18n { const v = useContext(Ctx); if (!v) throw new Error('I18nProvider missing'); return v; }
