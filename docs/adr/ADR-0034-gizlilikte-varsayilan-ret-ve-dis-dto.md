# ADR-0034: Gizlilikte varsayılan ret, iç/dış nesne ayrımı ve en az yetki

**Durum:** Kabul edildi (v2.3.1, 24.09.2026) — inceleme raporu P0-01, P0-05 (A01–A05)

## Karar
Bilinmeyen birim, bilinmeyen metrik/dönem, yetersiz yanıt ya da çözümlenemeyen görüntüleyen için karar **DENY**'dir. Gizlilik durumu n'den hesaplanır (`isSuppressed = suppressed || n < 5`); bayrak yalnız daha kısıtlayıcı olabilir (SQL: `n >= 5 OR suppressed`). Skor eşiği (5) ve yorum eşiği (10) ayrı hesaplanır; `decide()` yorum çıktısını da denetler. İç toplama nesnesi (`InternalProposal`, gizli sayılar burada) ile dış DTO (`LocalTargetProposal`) farklı tiplerdir; `priority_only` çıktısında sayısal alan yoktur (SQL CHECK ile de zorlanır). API, dışa aktarma, bildirim ve açıklama aynı kontrollü dış DTO'dan üretilir; `export` sayısal çıktı sayılır. Fark sorgusu koruması sınırsız sorgu analizi yerine önceden tanımlı rapor hücreleri üzerinde tamamlayıcı baskılamayla (`planReportCells`) uygulanır; sorgu geçmişi ikinci katmandır. Veritabanında en az yetki: API rolü (`hpw_app`) ham `result`'ı okuyamaz, yalnız `result_visible` (security_invoker) görür; ham okuma iç analiz rolüne (`hpw_worker`) aittir.

## Gerekçe
Merkezi karar fonksiyonu yorumları kontrol etmiyor, yalnız bayrağa güveniyor ve bilinmeyen birime izin veriyordu; `proposeLocal` gizli birime sayısal öneri üretiyordu.

## Kanıt
`packages/domain-core/src/privacy/gateway.ts`, `src/allocation/{types,allocate}.ts`; testler `test/privacy-risk.test.ts` (A01–A04), `test/allocate.test.ts` (A05); SQL GRANT/REVOKE bölümü.
