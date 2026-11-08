# ADR-0029: Gizlilik bir yanıt üretim politikasıdır: DisclosureDecision, fark sorgusu koruması, export aynı yol

**Durum:** Kabul edildi (v2.3 kanonik, 24.09.2026)

## Karar
`decide(viewer, output, query, units, history)` her okuma isteğinde çalışır ve `disclosure_decision` olarak denetim izine yazılır. Korunan çıktılar: score, baseline, target, target_range, delta, contribution, rank, benchmark_gap, explanation_numeric, response_rate, comment (eşik 10). Kurallar: gizli birim sayısal çıktı almaz; tam bir gizli alt birim varsa ikincil baskılama; iki sorgunun farkından gizli birim çıkarılabiliyorsa ikinci sorgu bastırılır (`differencingRisk`); eşik altı filtre değeri toplansa bile kullanılmaz; API, arayüz ve export aynı motoru kullanır; ham gizli sayı istemciye hiç gönderilmez; aksiyon gerekçesi gizli skoru ima etmez.

## Gerekçe
Minimum n tek başına yeterli değildir; küçük grup ekle-çıkar farkıyla hesaplanabilir. KVKK'da maskeleme dolaylı tanımlayıcılar nedeniyle anonimlik sağlamayabilir.

## Sonuçlar
- Mimari belge v2.3 bağlayıcıdır; `packages/domain-core` ve `db/migrations/0001_core.sql` bu kararı uygular; kabul testleri T-64..T-69 doğrular.
