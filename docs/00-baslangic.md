# Başlangıç: okuma sırası ve çalışma biçimi

## Okuma sırası
1. `CLAUDE.md` (kurallar)
2. `docs/architecture/hpw-act-mimari-v2.3.md` — kanonik belge (tek algoritma); bölüm 0, 1, 3, 7.2, 8.1a–8.2, 10.6, 13.2, 14.x–y, 16, 22, 24; eski sürümler `docs/architecture/arsiv/` (bağlayıcı değil)
3. `docs/domain/invariants.md`, `docs/domain/state-machines.md`, `docs/domain/entities.md`
4. `docs/adr/` — kararların gerekçesi
5. `docs/specs/M??-*.md` — modül spesifikasyonu (API, olaylar, kabul kriterleri)
6. `docs/testing/acceptance-tests.md` — T-01..T-54
7. `docs/backlog/faz0.md` — sıralı iş listesi

## Modül → mimari bölüm eşlemesi
| Modül | Spec | Mimari bölüm |
|---|---|---|
| Sonuç alma ve eşleme | M01 | 6 |
| Organizasyon grafı, reorg, vekâlet | M02 | 5 |
| Analiz, öncelik, segmentasyon | M03 | 7 |
| Hedef ağı, kohort, cascade, istisna, çatışma | M04 | 8 |
| Aksiyon, ana/yerel, katkı, kaynak, kümeleme, kapasite | M05 | 9 |
| Kanıt ve doğrulama | M06 | 10 |
| Yürütme, check-in, toplu işlem, komut zarfı | M07 | 11 |
| Kural, escalation, dikkat motoru | M08 | 12 |
| Yeniden ölçüm, karşılaştırılabilirlik, sonuç | M09 | 13 |
| Yetkilendirme (RBAC+ABAC, SoD) | M10 | 14 |
| Raporlama, Control Tower, açıklanabilirlik | M11 | 15 |
| Entegrasyonlar, teknik altyapı, süreç motoru, veri yaşam döngüsü | M12 | 18–19 |

## Çalışma döngüsü (her story için)
1. Spec'teki kabul kriterlerini ve eşlenen T-xx testlerini oku.
2. Domain kuralı varsa önce `packages/domain-core`'a saf fonksiyon + test.
3. Migrasyon (varsa) → RLS → repository → komut handler (zarf sırası) → API → olay → projeksiyon.
4. Kabul testini (Gherkin veya vitest) yaz, geçir.
5. `docs/backlog/faz0.md` içinde story'yi tamamlandı işaretle; açık soru varsa "Açık sorular" bölümüne ekle.

## Bilinçli olarak ertelenenler (yapma)
- Çevrimdışı PWA senkronizasyonu (komut zarfı hazır, istemci sonra)
- ERP bağlayıcısı (ResourceCommitment manuel)
- Temporal'a geçiş (Faz 2; Faz 0'da Postgres adım yürütücüsü)
- AI öneri katmanı ve etkinlik bilgi tabanı (Faz 3)
