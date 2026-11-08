# apps/web — HPW Act arayüzü (React + Vite)

Happy Place to Work® tasarım ve üretim brifinin ürüne uygulanmış hâli. Kurallar `docs/design/hpw-act-arayuz-sistemi.md`; tokenlar tek dosyada `src/styles/tokens.css`.

```
pnpm --filter @hpw-act/web dev       # http://localhost:5173 — /giris ile başla
pnpm --filter @hpw-act/web build     # tsc + vite build
pnpm brand-qa                         # marka QA denetimi (CI kapısı)
pnpm --filter @hpw-act/web build:single  # dist/hpw-act-prototip.html — tek dosya, çift tıkla açılır (HashRouter, fontlar gömülü)
```

Yapı: `src/styles` (tokens, base, components — başka CSS yok), `src/i18n` (tr/en katalog; kodda sabit metin yok), `src/api` (komut zarfı `envelope.ts`; `mock.ts` Atlas fixture + domain-core `reconcile`/`assessPriority`/`evidenceConfidence` ile API hazır olana kadar çalışır), `src/components` (Kicker, FitText, Button, Field, StatusLabel, Score, DistributionBars, ConflictNotice, AppShell), `src/pages` (Giriş, Dikkat, Kurumsal, Sonuçlar, Birimler, Hedefler, Aksiyonlar, Yerel uygulamalar, Kanıt, Scorecard, Organizasyon, Kullanıcılar, Ayarlar, Tenantlar, Metodoloji, Denetim), `src/personas.ts` (13 aktör: kapsam, gezinme, dikkat kuyruğu), `src/state/persona.tsx` (aktör bağlamı; `?aktor=` ile açılabilir), `src/components/Guard.tsx` (politika kararı).

Veri: `data/atlas/web-fixture.json` (`pnpm seed:atlas` üretir; vite alias `@atlas`). Gerçek API'ye geçiş: `src/api/mock.ts` yerine `docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz)` sözleşmesini uygulayan adaptör; sayfalar değişmez.

Kurallar: `toUpperCase/toLowerCase` yasak; hex renk yalnız tokens.css'te; radius 0, gölge yok, ikon yok; aralıklar 12 px tabanı; her bölümde tek kırmızı; durum kelime, renk değil.
