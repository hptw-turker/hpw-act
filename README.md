# HPW Act — Employee Experience Execution Platform

> **Güncel sürüm 3.0.0 (sade yol haritası takibi).** Başlangıç: `DEVIR-v3.0.md`; sunucu kurulumu: `ops/sunucu/SUNUCU-KURULUMU.md`.

Happy Place to Work® anket sonuçlarını organizasyon çapında ölçülebilir değişime dönüştüren yürütme sistemi: sonuç → odak alanı → hedef ağı → aksiyon (ana/yerel) → kanıt → etki değerlendirme → hesap verebilirlik.

- Mimari (bağlayıcı): `docs/architecture/hpw-act-mimari-v2.3.md`
- Claude Code talimatı: `CLAUDE.md`
- Başlangıç: `docs/00-baslangic.md`
- Backlog: `docs/backlog/faz0.md`

Durum: Faz 0 — domain çekirdeği ve pilot sertleştirmesi; v2.2 semantik kilit uygulandı (ADR-0017..0024). `packages/domain-core` içinde allocation, kanıt güveni, karşılaştırılabilirlik, öncelik ve kanonik kenar algoritmaları testli olarak hazır; `tools/seed` Atlas Holding sentetik veri setini üretir.

`apps/web`: React + Vite arayüzü, Happy Place to Work® marka brifine göre (üç renk, Poppins 400/700, 12 px grid); `pnpm web:dev` ile Atlas verisi üzerinde çalışır.

## v2.3.1 — inceleme raporu sonrası durum (24.09.2026)

- Karar çekirdeği: 57 test (22 karşı örnek dahil) yeşil — `pnpm -r test` (`packages/domain-core`: `npx tsx --test test/*.test.ts`).
- Şema: `db/migrations/0001_core.sql` 63 tablo, pglast parse + `pnpm rls-check`. API: `docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz)` (YAML doğrulandı; SQL = domain = API sözlüğü).
- Prototip: `apps/web` — `npm run build:single` → `dist/hpw-act-prototip.html`; denetimler `tools/scripts/ui-dugme-test.py` (37 akış), `ui-dil-tara.py`, `ui-dil-tara-en.py`, `ui-kota-dili-tara.py`, `tr-kontrol.mjs`, `brand-qa.mjs`.
- Kurulum ve derleme: `KURULUM.md` (temiz ZIP’ten doğrulanmış komutlar). Paket yöneticisi: her uygulama kendi `package-lock.json` dosyasıyla `npm ci` kullanır; kökteki `pnpm-lock.yaml` yalnız pnpm çalışma alanı içindir, teslimat derlemesi ona bağlı değildir.
- Bulgu → değişiklik → test eşlemesi: `docs/reviews/2026-09-23-v23-inceleme-yaniti.md`. Yeni ADR'ler: 0033–0038.
- Bu ortamda yapılamayanlar (G0/G1 kapıları, ADR-0038): gerçek PostgreSQL'de RLS/kısıt/eşzamanlılık testi; izinli gerçek HPTW sonuç dosyasıyla resmî üst skor mutabakatı; hukuk/güvenlik uygunluğu; canlı pilot.

## v2.4 — madde düzeyi takip ve anket-agnostik enstrüman (24.09.2026)

- Takip birimi madde; enstrüman modeli `packages/domain-core/src/instrument/` (HPTW 2026 referansı: 75 madde, etkileşim alanı, sorumluluk merkezi); sonuç paketi `hpw-act-result-bundle v1` (örnek: `packages/domain-core/test/fixtures/`).
- Testler: 65 (T-70..T-76 dahil). Şema 72 tablo. API: /cycles/{id}/bundles, /instruments/{id}, /instruments/{id}/panels.
- Prototip: birim sonuçları madde tablosu, madde bazlı yerel hedef/aksiyon/kanıt, bölge uzlaştırmasında madde seçici, içe almada algılama ve panel türetme. 39 düğme akışı.
- Metodoloji onayı bekleyen: sorumluluk merkezi eşlemesi (ADR-0041 açık nokta).

## v2.5 — çalışan ürün dilimi (24.09.2026)

- `apps/api`: Fastify + PostgreSQL 16, gerçek RLS; `db/migrations/0002_product.sql` (kimlik, üyelik, oturum, davet, e-posta kuyruğu, içe alma işi, tenant kataloğu, enstrüman puanlama, atomik sonuç sürümü). Kurulum ve akışlar: `apps/api/README.md`.
- `apps/web/app.html` → ürün ön yüzü (API'ye bağlı): giriş, davet kabulü, platform/müşteriler, genel bakış, organizasyon, soru seti, dönemler ve sonuçlar, kullanıcılar/davet, şablon indir–yükle–doğrula–onayla, birim sonuçları, hedefler, aksiyonlar ve kanıt, takip, dikkat. `index.html` v2.4 prototipidir (`/prototip`).
- Testler: domain 70/70; API uçtan uca 10/10 (iki şirket sıfırdan, gerçek PostgreSQL, tenant izolasyonu ve RLS denetimi).
