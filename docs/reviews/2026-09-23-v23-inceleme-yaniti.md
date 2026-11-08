# v2.3 inceleme raporuna yanıt (v2.3.1) — bulgu → değişiklik → kanıt

Rapor: `HPW_Act_v23_Inceleme_Raporu.md` (23.09.2026). Karar: bulguların tamamına yakını kabul; itiraz yok. Aşağıda her bulgu için yapılan değişiklik ve doğrulama yeri.

| Bulgu | Karar | Değişiklik | Kanıt / test |
|---|---|---|---|
| P0-01 gizlilik kapalı varsayım (A01–A05) | Kabul | Varsayılan ret; n'den hesap; yorum eşiği; iç/dış DTO; `priority_only` sayısız; rapor hücresi baskılaması; en az yetki (hpw_app ham result okuyamaz, hpw_worker) | gateway.ts, allocate.ts, SQL GRANT/REVOKE; privacy-risk.test (A01–A04), allocate.test (A05); ADR-0034 |
| P0-02 inceleme bekleyen ölçümden kesin başarı (A06) | Kabul | PENDING_REVIEW / NOT_EVALUATED; `ComparabilityReview` sürüm eşleşmesi; A/B yalnız kayıtlı tasarımla; T-28 test beklentisi düzeltildi | assess.ts; comparability.test; SQL outcome_assessment/comparability_review; ADR-0035 |
| P0-03 kanıt puanı geçerliliğin yerine (A13–A18) | Kabul | `validateEvidence` önce; E3/E4 sistem iziyle atlanmaz; dört durum ekseni; E0 "beyanla karşılandı" etiketi | validity.ts, confidence.ts, risk.ts, states.ts; karsi-ornekler.test; ADR-0035/0036 |
| P0-04 sayısal sözleşme (A07–A12) | Kabul | Girdi doğrulama (sonlu, ≥0, ölçek, boş küme, sıfır ağırlık); tam hassasiyet; `methodologist_band` etiketi + `peer_observation`; "üst senaryo / mevcut planla desteklenmiyor" | allocate.ts, errors.ts; allocate.test; SQL local_target CHECK'leri |
| P0-04 gerçek HPW skor mutabakatı | Kabul, bu ortamda yapılamaz | Mock'ta yanıt sayısı = ağırlık demo varsayımı olarak işaretli; G1 kapısına bağlandı | backlog S0.6b.10; ADR-0038 |
| P0-05 SQL kısıtları ve erişim | Kabul | Tenant'lı FK'lar (result, local_target, action); n≥5∨suppressed; sayısal olmayan tür sayı taşımaz; istisna kimliği; kanonik kenar tüm türlerde; deployment iş anahtarı; EXCLUDE örtüşme; security_invoker; NOT NULL'lar | 0001_core.sql (63 tablo, parse + RLS-CHECK OK) |
| P0-05 gerçek PostgreSQL testi | Kabul, bu ortamda yapılamaz | G0 kapısı iş paketi | backlog S0.6b.9 |
| P0-06 düzeltme/sürüm/sahiplik (A21, A22) | Kabul | import_batch / result.revision / correction_run; master_action_revision / deployment.master_revision / deployment_occurrence; pause/supersede/reopen/invalidate; UTC kıyas; çakışma hatası | SQL; accountability.ts; karsi-ornekler.test; ADR-0033 |
| P0-07 tek kanonik sözleşme | Kabul | Mimari 8.1 tablosu, 8.1a sözde kod, 13.2, 15, 17 sıra diyagramı, 21, 22 (T-02/T-03), 23 (açık karar 10), 24 yeniden yazıldı; openapi.yaml yeni sözlükle; SQL enum = domain tip; ADR-0021 superseded; lockfile ZIP'te | docs/architecture, docs/api, docs/adr; invariants I-52 |
| P0-08 uçtan uca aynı kayıt; sorumluluk bulanıklığı | Kabul | Prototipte sürümlü kayıt deposu: hedef kabul (lt-…) → aksiyon (act-lt-…) → kanıt aynı kimlik; iki rol etiketi; Güven/vardiya hesap vereni Operasyon Planlama | apps/web/src/state/store.ts, LocalTargets/Actions/Evidence.tsx; ui-dugme-test (37 akış); ADR-0037 |
| Yanlış soruna doğru aksiyon | Kabul | Sürücü madde verisi yoksa program varsayımı yazar ve bağlam teyidi ister | Actions.tsx |
| Kanıt bürokrasisi | Kabul | E0/E1'de yapılandırılmış kayıt (tarih + gerçekleşti + katılımcı); PDF/tutanak yok; kılavuzlar güncellendi | Evidence.tsx; tools/guides/content.py |
| HRBP darboğazı | Kabul | Duyarlılık hesabı ADR'ye; ölçüm pilotta | ADR-0038 |
| Sayaç kapatma | Kabul | Beş kapatma anlamı; gerekçe okunur; yükümlülük bitmez | dismiss.ts; Home.tsx; ADR-0037 |
| Skor baskısı / acil vaka | Kabul | "Kim tutturamadı" görünümü kaldırıldı; acil vaka sınıra takılmaz, kurumsal sürece yönlenir | workload.ts; mimari 15; ADR-0037 |
| Pilot kapıları G0/G1/G2; şema kilidi ≠ dondurma | Kabul | Sürümlü migrasyon disiplini; üç kapı | ADR-0038; mimari 24 |

Bu ortamda kapatılamayanlar ve sahibi: gerçek PostgreSQL saldırı/kısıt/eşzamanlılık testi (backend geliştirici, G0); izinli gerçek HPTW sonuç dosyasıyla resmî skor mutabakatı (HPW metodoloji + QA, G1); hukuk/güvenlik uygunluğu (yetkili sorumlular, G1); canlı pilot ölçümleri (müşteri sponsor + HRBP + HPW, G1/G2).

## v2.4 eki (24.09.2026) — inceleme sonrası ürün kararı

Kurucu kararıyla takip birimi boyuttan MADDEYE taşındı ve enstrüman anket-agnostik hale getirildi (ADR-0039..0041; mimari 6.0). İnceleme raporunun v2.3.1 kabulleri korunur; madde düzeyi geçiş bunların üstüne gelir: gizlilik, uzlaştırma, kanıt ve durum sözleşmeleri artık madde metriğinde çalışır. Yeni testler T-70..T-76 (sonuç paketi, algılama, indeks mutabakatı, panel türetme, madde düzeyi kısıtı, sorumluluk merkezi). Metodoloji onayı bekleyen: 75 maddelik sorumluluk merkezi eşlemesi.
