# Bağımsız v2.11.3 test betiği — depo uyarlamaları

Kaynak: `HPW-v2.11.3-Denetim-Kanitlari.zip` (139 dosyalık envanter kendi `SHA256SUMS.json` listesiyle doğrulandı). Önceki turların betikleri (`pending-ui.cjs`, `edge-ui.cjs`, `cas-api.mjs`) depodakilerle aynı.

`tests/reconcile-ui.cjs` **değiştirilmeden** saklandı. Ortam uyarlaması: kök `pw.cjs` (önceki turlardaki gibi; özgünü `pw.orijinal.cjs`).

**Düzenek uyarlaması** — `tests/outcome-adapted/reconcile-ui.cjs` (fark: `adaptation.diff`, 23 satır): v2.11.4'te uzlaştırmanın kanıtı komut kaydına bağlandı (`GET /api/platform/commands/:key/outcome`). Özgün düzenek bu ucu yanıtlamadığı için uyarlanmış kopya, senaryonun kendi olgusuna uygun yanıt ekler: `own-saved-control` (özgün komut kaydedildi) → `applied`; `other-close`/`other-edit` (özgün komut kaydedilmedi) → `not_found`; `expired-unreadable`'ın okunamaz aşaması → 503. Başka değişiklik yok (yalnız `pw.cjs` göreli yolu bir düzey derinleşti); senaryolar, adımlar ve geçiş koşulları aynı.

Özgün betiğin yeni sürümdeki sonucu da kayıtlıdır: `own-saved-control` başarısız (özgün düzenekte komut kaydı kanıtı yok; liste alanlarının aynı olması artık kanıt sayılmıyor), `other-edit` zaman aşımı (düzenek sonuç ucuna `[]` döndürür, istemci sonucu doğrulanamaz sayar ve beklenen liste okumasını yapmaz; yanlış başarı üretilmez), `other-close` ve `expired-unreadable` geçer.

Arşiv notu: denetçinin referans verdiği gerçek v2.11.2 `ui-regresyon.cjs` kopyası `tools/tests/fe/arsiv/ui-regresyon.v2112-tam-ozgun.cjs` olarak saklandı (SHA-256 9c997f27c5eb76b28d593200b56560590a3df5a2a5f3d9b59d948415142790eb). Yanlış adlandırılmış eski arşiv `ui-regresyon.v2113-gelistirme-ara-surum.cjs` olarak yeniden adlandırıldı.

## v2.14.0 notu
Tasarım B ile görünen düğme adları değişti; denetçi betikleri yalnız bu adlarda uyarlandı (`tools/tests/fe/ui-regresyon.cjs`, `ui-audit.cjs`, `ui-audit.hazir-bekleme.cjs`): "aç" → "Aksiyonu aç", "git" → "Konuya git", "✨ Yapay zekâdan yardım al" → "Yapay zekâdan yardım al"; EN-HEDEF beklentisi "Local improvement targets" → "Where does my goal stand?". Başka beklenti değişmedi; bağımsız paketler (bagimsiz-v*) değiştirilmedi ve tamamı geçti.
