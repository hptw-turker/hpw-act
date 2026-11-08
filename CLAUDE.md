# HPW Act — Claude Code proje talimatı

> **v3.0 (08.11.2026): önce `DEVIR-v3.0.md` ve `docs/adr/ADR-0043-sade-hpw-act-v3.md` okunur.** Ürün sadeleştirildi: rapordaki yol haritasının takibi. Aşağıdaki aksiyomlar ve v2 kuralları kapalı modüllerin içinde geçerlidir; çelişkide ADR-0043 kazanır. Kodlama kuralları (Türkçe karakter, tenant izolasyonu, komut zarfı, audit, marka, i18n) aynen geçerlidir.

Bu depo **HPW Act — Employee Experience Execution Platform** ürününün kaynak kodudur. Ürün, Happy Place to Work® (HPTW) anket sonuçlarını (ve dış anket sonuçlarını) organizasyon çapında hedef, aksiyon, kanıt ve etki takibine dönüştüren çok kiracılı bir SaaS'tır. Anket yapmaz; performans, OKR, LMS, recognition aracı değildir.

## Önce oku
1. `docs/00-baslangic.md` — okuma sırası ve çalışma biçimi
2. `docs/architecture/hpw-act-mimari-v2.3.md` — bağlayıcı mimari (tek gerçek kaynak)
3. `docs/domain/invariants.md` — asla ihlal edilmeyecek kurallar
4. `docs/backlog/faz0.md` — şu an yapılacak işler, sırasıyla
5. İlgili modül spesifikasyonu `docs/specs/M??-*.md` ve ADR'ler `docs/adr/`
6. Arayüz işi için `docs/design/hpw-act-arayuz-sistemi.md` — Happy Place to Work® marka brifinin ürüne uyarlanması (bağlayıcı)

Mimari belge ile bu dosya çelişirse mimari belge kazanır; mimariyi değiştirmek gerekiyorsa önce ADR yaz.

## On üç aksiyom (kısa)
1. Organizasyon bir graftır; skor tam olarak bir roll-up hiyerarşisinden toplanır, sorumluluk birden çok ilişkiden gelir.
2. Sonuç ≠ Hedef ≠ Aksiyon ≠ Uygulama ≠ Etki. Hiçbiri diğerinden türetilmez.
3. Hedef bir ağın düğümüdür; kaynağı, katkısı, istisnası veri modelindedir. İlişki yalnız kapsam ve soy içindir; aritmetik yalnız uzlaştırma koşusunda: istenen değer, yerel önerilerin resmî ağırlıklı projeksiyonuyla karşılaştırılır (SUPPORTED / GAP / UNSUPPORTED), fark dağıtılmaz.
4. Aksiyon ↔ hedef çoktan çoğadır; ana aksiyon (master) hiçbir zaman tek bir "tamamlandı" durumu almaz, yerel uygulamaların (local_execution) dağılımıdır.
5. "Tamamlandı" bir beyandır: yaşam döngüsü `declared_complete`, doğrulama ayrı eksende. Kanıtta sıra geçerlilik (tür, kapsam, tarih penceresi, tekil gerçekleşme) → E0–E4 politikası → inceleme; geçersiz kanıt gereksinime sayılmaz, E3 her zaman insan, E4 her zaman örneklem.
6. Karşılaştırılamayan ölçüm hedef tutturmaz; not_comparable → NOT_EVALUATED; review_required + geçerli metodolog onayı yok → PENDING_REVIEW / NOT_EVALUATED (gözlem ayrı). A/B atıf yalnız kayıtlı tasarımla.
7. Gizlilik (n<5) skoru gizler, aksiyon uygunluğunu engellemez. Karar varsayılan RET: bilinmeyen birim/görüntüleyen/yetersiz yanıt reddedilir; gizlilik n'den hesaplanır; iç toplama nesnesi ile dış DTO ayrıdır, `priority_only` sayı taşımaz.
8. Tarih yeniden yazılmaz: effective-dated birimler, sürümlü hedefler, append-only audit, reorg lineage.
9. Kullanıcı metodoloji bilmez: boş form yok, en fazla üç öneri, kabul / değiştir / uygun değil.
10. AI önerir, insan karar verir. AI hiçbir nesnenin durumunu değiştirmez.
11. Sistem dikkat yönetir: her rolün giriş ekranı AttentionItem kuyruğudur.
12. Hedef matematiği dondurulmuş TargetCohort üzerinde çalışır; bir birim üst hedefe yalnızca bir kanonik kenardan sayılır; ResponsibilityAllocation payı skor matematiğine girmez.
13. Süreç durumu kalıcıdır (WorkflowInstance); her komut command_id + expected_version taşır; her olay en az bir kez teslim edilir, iş etkisi en fazla bir kez uygulanır.
14. Kurumsal ambition ≠ yerel hedef ≠ katkı projeksiyonu — ÜÇ AYRI TABLO. Yerel hedef yalnız yerel veriden ve metodolojik fizibiliteden üretilir; ambition yerel hedef algoritmasına girdi olmaz; uzlaştırma farkı sessizce dağıtmaz, karar Genel Müdür'e sunulur. Ağırlık HPTW'nin resmî toplama ağırlığıdır; projeksiyon gelecekteki gerçek üst sonuç değildir.
15. Öncelik beş ayrı eksendir: çalışan şiddeti, veri güveni, kontrol edilebilirlik, iş yükü, stratejik önem. Güven şiddeti küçültmez; yük sorunu gizlemez; kontrol sahibi belirler; strateji şiddeti değiştirmez. Veri güveni kullanıcıya etiketle gösterilir.
16. Gizlilik bir yanıt üretim politikasıdır: her okuma ifşa kararından geçer ve kaydedilir; gizli birim hiçbir sayısal hedef, fark, katkı ya da açıklama üretmez; iki sorgunun farkından gizli birim çıkarılamaz; export aynı yoldur.
17. Çalışan sahiplik zincirine girmez; sahip her zaman bir organizasyonel roldür (kişi tarih aralıklı çözülür). Kanıt seviyesi kuraldan seçilir, puan triyajdır; sonuç atıf kanıtı derecesi taşır (C = zamansal ilişki), nedensellik iddiası taşımaz. Yük sınırları (2 yerel hedef, 3 aksiyon) domain politikasıdır. Arayüzde yasaklı terimler yoktur (docs/design/terminoloji-sozlugu.md).

## Pazarlık edilemez kodlama kuralları
- **Türkçe karakter:** `String.prototype.toUpperCase/toLowerCase` YASAK. `packages/domain-core/src/util/turkish.ts` içindeki `trUpper/trLower` kullanılır. Veritabanında metin sıralama/arama `tr-TR` collation ile. ESLint `no-restricted-syntax` kuralı bunu engeller; CI'da `pnpm tr-kontrol` çalışır.
- **Tenant izolasyonu:** her tablo `tenant_id` taşır; RLS açık ve `FORCE ROW LEVEL SECURITY`. Uygulama DB rolü tablo sahibi değildir ve `BYPASSRLS` taşımaz (`db/README.md`). Sorgular tenant bağlamı olmadan çalışmaz.
- **Komut zarfı:** her yazma isteği `Idempotency-Key` (command_id), `If-Match` (expected_version), `X-Correlation-Id`, `X-Causation-Id` başlıklarını taşır; sürüm uyuşmazlığı 409 + değişen alanlar döner. Aynı command_id ikinci kez gelirse aynı sonuç döner, iş etkisi tekrarlanmaz (`command_log`).
- **Olaylar:** yazma işlemi ve outbox kaydı aynı transaction'da. Tüketiciler `event_id` ile tekilleştirir. Başarısız olay DLQ'ya, replay mümkün.
- **Görev ayrımı:** istisna talep eden ≠ onaylayan; kritik kanıtta sahip ≠ doğrulayan; vekâlet alan kendi vekâletini onaylayamaz. Politika karar noktasında (`packages/policy`) uygulanır, UI'da sadece yansıtılır.
- **İki eksen:** `execution_status` ve `impact_status` hiçbir DTO'da, hiçbir ekranda tek sayıya indirgenmez. HealthScore yalnızca iç risk sinyalidir.
- **Audit'te kişisel veri yok:** aktör ve nesne referansla; silmede referans anonim kimliğe döner.
- **Sayısal:** skorlar `numeric(5,2)`; ham skor asla kaybolmaz (`raw_score`, `scale_min/max`, `metric_type`).
- **Tarih/saat:** UTC saklanır, birim/kişi zaman diliminde gösterilir; termin hesabı birimin çalışma takvimiyle.
- **Arayüz dili:** tr-TR varsayılan, EN/AR hazır; tüm metinler i18n kataloğunda, kodda Türkçe sabit string yok.
- **Erişilebilirlik:** WCAG 2.2 AA; her etkileşimli öğe klavye ile erişilebilir.
- **Marka:** üç renk (#CF051E, #231A15, #FFFFFF) yalnız `apps/web/src/styles/tokens.css` içinde; kodda başka hex yok. Poppins 400/700, italik yok. `border-radius: 0`, gölge yok, degrade yok, opaklık yok, ikon/emoji yok. Aralıklar 12 · 24 · 48 · 72 · 96 · 144. Her bölümde kırmızı bir kez; durum renk değil kelime. `pnpm brand-qa` geçmeden PR açılmaz.

## Teknoloji ve depo düzeni
- pnpm workspace, TypeScript strict, Node 22.
- `apps/api` — NestJS (modüler monolit; modül sınırları = mimari bölüm 4). `apps/web` — React + Vite + i18n (mevcut; mock adaptörle çalışır, API gelince `src/api/mock.ts` değişir). `packages/domain-core` — saf domain algoritmaları (framework bağımsız, %100 test). `packages/policy` — RBAC+ABAC politika karar noktası. `packages/workflow` — motor bağımsız süreç yürütücü (Faz 0: Postgres adım yürütücüsü). `db/migrations` — SQL migrasyonları (Drizzle ile uygulanır). `tools/seed` — Atlas Holding sentetik veri üreteci.
- PostgreSQL 16, Redis (kuyruk BullMQ), nesne depolama S3 uyumlu, OpenTelemetry.
- Test: `node --test` + tsx (domain-core), Vitest (apps), Playwright (e2e), Gherkin kabul testleri `docs/testing`.

## Çalışma biçimi
- Bir story'ye başlamadan önce ilgili spec'in "Kabul kriterleri" ve test kodlarını (T-xx) oku; önce testi yaz.
- Domain kuralı `packages/domain-core`'a saf fonksiyon olarak yazılır, NestJS servisleri onu çağırır. Domain-core hiçbir framework'e bağımlı olamaz.
- Her yeni tablo: `tenant_id`, `created_at`, `updated_at`, `version` (int), RLS politikası, migrasyonda `FORCE ROW LEVEL SECURITY`.
- Her durum geçişi `docs/domain/state-machines.md` ile uyumlu; kodda geçiş tablosu tek yerde (`packages/domain-core/src/state`).
- Her komut handler'ı: zarf doğrula → command_log kontrol → yükle + expected_version kontrol → domain fonksiyonu → tek transaction'da yaz + outbox + audit + command_log. Bu sıra değişmez.
- PR açıklamasında hangi T-xx testlerinin kapsandığı yazılır. `pnpm test`, `pnpm lint`, `pnpm tr-kontrol`, `pnpm rls-check` geçmeden PR açılmaz.
- Belirsizlikte tahmin etme: `docs/backlog/*.md` içindeki "Açık sorular" listesine yaz ve varsayımını kodda `// ASSUMPTION:` ile işaretle.
- Türkçe yaz: commit mesajları, PR açıklamaları ve dokümanlar Türkçe; kod tanımlayıcıları İngilizce (mimari belgedeki adlarla birebir).

## Komutlar
```
pnpm install
pnpm -r build
pnpm -r test
pnpm seed:atlas          # tools/seed → data/atlas/*.json,csv
pnpm tr-kontrol          # Türkçe casing denetimi
pnpm rls-check           # migrasyonlarda RLS/FORCE denetimi
pnpm brand-qa            # marka QA (apps/web)
python3 tools/scripts/ui-kota-dili-tara.py   # yasaklı arayüz terimleri
pnpm web:dev             # arayüz geliştirme sunucusu
pnpm guides              # rol bazlı PDF kullanma kılavuzları (docs/guides)
```
18. (v2.3.1) Geçersiz girdi hiçbir sınırda sessizce geçmez: sonlu, ≥0 ağırlık; ölçek içi değerler; boş küme ölçümsüz; yanıt eşiği altında sayısal karar yok; zaman UTC anıyla; eşzamanlı çakışan atama hata. Her yerel hedef iki rol taşır (sonucu izleyen / müdahaleye yetkili). Dikkat öğesini kapatmak yükümlülüğü bitirmez. Sonuç verisi ve ana aksiyon sürümlüdür; düzeltme tarihçe silmez. Tek sözlük: SQL = domain = API; teslimat karşı örnek testleriyle kanıtlanır (docs/reviews/).
19. (v2.4) Takip birimi MADDE: öncelik, hedef, aksiyon, kanıt, sonuç yalnız madde metriğine bağlanır; boyut ve indeks görünüm/projeksiyon. Enstrüman anket-agnostik ve sürümlüdür; sonuç paketi (hpw-act-result-bundle) algılanır, paneller türetilir; Top Box dağılımdan hesaplanır, resmî indeksle mutabakat zorunlu. Her madde etkileşim alanı ve sorumluluk merkezi taşır; müdahaleye yetkili rol buradan gelir; Bağlılık ve kişisel eğilim maddeleri hedef almaz.
