# Kapanış manifesti (v2.15.0, build __BUILD__) — KAPANIS.json'dan üretilmiştir

**Güncel durum yalnız ilk bölümdedir.** Sonraki bölümler tarihçedir; çelişen eski satırlar “superseded” olarak işaretlidir. Durumlar: doğrulandı (gerçek PostgreSQL/HTTP/tarayıcı/paket testi), kısmi, açık, dış bağımlılık, superseded. A99: PASS / PARTIAL / BLOCKED.


## v2.15.0 — sunumla birebir yol haritası (yeni özellik; ADR-0042)

| # | Durum | Kanıt |
|---|---|---|
| YH-VERI-MODELI | tamamlandı | migrasyon 0023 (roadmap, roadmap_plan, roadmap_step, roadmap_milestone; RLS + FORCE; içerik yalnız ekleme, durum sütunları sütun düzeyi yetki) |
| YH-FORM-ICE-ALIM | doğrulandı | importers/roadmap.ts (17 sayfa, tek tablo); v2150 YH-01 şablon, YH-02 doğrulama hataları, YH-03 aynen saklama ve terminler |
| YH-YETKI | doğrulandı | v2150 YH-04: birim kapsamı, IK/YONETIM ayrımı, çalışan adımı takip edilmez, üst yönetim salt okur, sürüm çakışması 409 |
| YH-YENIDEN-YUKLEME | doğrulandı | v2150 YH-05: eski sürüm superseded, durum taşıma, eski sürüme yazma 409 |
| YH-YALITIM | doğrulandı | v2150 YH-06: şirketler arası okuma/yazma yok |
| YH-ARAYUZ | tamamlandı | pages/Roadmap.tsx (Tasarım B bileşenleri); TR/EN kapsam OK; marka QA OK; 390 px taşma yok (Ant Yapı ekran turu) |
| YH-ANTYAPI-AKTARIM | doğrulandı | 8 birim, 25 plan, 198 adım, 75 takvim satırı; ürünün içe alım hattıyla; Ant Yapı geneli değerleri sunumla eşleşti |
| TASARIM-KILIDI | korundu | 1440 px, aynı veri/rol/dil: şube müdürü ve GMY ekranlarında tek fark menüdeki yeni öğe; İK ekranlarında menü ikinci satıra geçtiği için içerik 29 px aşağıda, içerik aynı (test-ciktilari/v2150/tasarim-kilidi-*) |
| BUTUN-KAPI | geçti | API 116/117 (tek başarısız V269-WEEKLY-SLOT, aşağıda); v2150 6/6; domain 70/70; sözleşme 1382 yanıt 0 sapma, 133 uç kapsam 0 sorun; FE kapısı paket web çıktısında çıkış 0 (denetçi 26/27, bilinen LOGIN-ENTER); v2141 23/23, v2142 35/35 paket web çıktısında; paket başlatıcı smoke (Ant Yapı) |
| YH-GIRIS-OZETI | tamamlandı | RoleHomeB.tsx + Roadmap.tsx RoadmapHomeSection: birim müdürü/izleyici (tek birim) kv2, bölge/İK iş ortağı/üst yönetim birimler tablosu; yol haritası yoksa bölüm çizilmez; aksiyon sorumlusunda yok; "sıradaki termin" yalnız termini gelmemiş açık satır (roadmaps listesi next_due düzeltmesi) |
| YH-KILAVUZ | tamamlandı | 8 rol kılavuzuna "6 · Yol haritası" (tools/guides/v2150-yol-haritasi; Saha sentetik ekranlar, numaralı düğme tabloları); kapak, içindekiler, altbilgi v2.15.0; 1–5. bölümler değişmedi |
| YH-SAHA-DEMO | tamamlandı | standart ve Ant Yapı DOLU DEMO veritabanlarına Saha sentetik örnek yol haritası (5 şube, 14 plan, 96 adım, 42 takvim satırı) ürünün içe alım hattıyla; Ant Yapı adımları "Başlamadı" |
| YH-DTO | düzeltildi | giriş bölümü bozuk yanıtta çöküyordu (V2132 üç regresyon, düzenek `[]`); dto.ts roadmaps/roadmapDetail/roadmapHrSteps; FE kapısı yeniden çıkış 0 (test-ciktilari/v2150/fe-kapi-son.log); testler değiştirilmedi |
| MOBIL-KULP | düzeltildi | ≤820 px'te "Nasıl okunur?" kulpu yazının üstüne biniyordu; .tb .rel sağ boşluk 1.75rem; 4 cihaz × 76 ekran çakışma 0, taşma 0; masaüstü kuralı değişmedi |
| V269-WEEKLY-SLOT | açık (önceden var) | v01-v28 "weekly 70 gün ≈ 10 slot" kontrolü 2026-11-07 tarihinde 12 slot verir; değişmemiş v2.14.2 kaynağında da aynı sonuç (yıl sonunu geçen haftalık pencere). Test gevşetilmedi. |

## v2.14.2 — son düzeltme A06 hiza, A03 etiket, A04 gecikme; Tasarım B kilitli

| # | Durum | Kanıt |
|---|---|---|
| A06-BASLIK-VERI-HIZASI | düzeltildi | tb.tsx kaydırma kabı; v2142 A06-HIZA-* 320/390/820 TR/EN sapma 0, düğmeye erişim |
| A03-MOBIL-ETIKET-SINIRI | düzeltildi | Grafik.tsx mobil etiket konumu; v2142 A03-ETIKET-* 0/98/100 TR/EN 390/320 |
| A04-KISMI-DONEM-GECIKME | düzeltildi | ChainB slotBitis; v2142 A04-* kontrollü saat 15 sınır durumu |
| ONCEKI-23-KONTROL | geçti | v2141-karsi-ornek.cjs 23/23 (final ZIP) |
| TASARIM-KILIDI | korundu | masaüstü 1440 piksel farkı 0 (v2.14.1 ile aynı koşullar) |
| BUTUN-KAPI | tamamlandı | FE A/R 215/B/C; API 111/111; sözleşme 0 sapma |

## v2.14.1 — dar düzeltme A01–A06; Tasarım B kilitli (pilot; bağımsız karar bekleniyor)

| # | Durum | Kanıt |
|---|---|---|
| A01-ANA-EKRAN-HATA | düzeltildi | RoleHomeB.tsx useLoad; v2141 karşı örnek A01-* önce FAIL → sonra PASS |
| A02-SAYIM-TUTARLI | düzeltildi | GET /actions fulfilled_slots; API v01-v28 V16 ek kontrol; A02-SAYIM, A02-ANAEKRAN |
| A03-MOBIL-GRAFIK | düzeltildi | tasarim-b.css sıra; A03-HEDEF-390/820/1440 |
| A04-TAKVIM-PLAN-DONEMI | düzeltildi | ChainB takvim() slots; sunucu slotlu(); A04-* beş ritim; API eski aksiyon kontrolü |
| A05-PLAN-ADIMI-HATA | düzeltildi | ChainB sq hata durumu; A05-PLAN-ADIMI-500 |
| A06-MOBIL-TASMA | düzeltildi | tasarim-b.css min-width:0 + tablo kaydırma; A06-* 320/390/820 TR/EN |
| TASARIM-KILIDI | korundu | masaüstü 1440 piksel farkı %0,00; farklar yalnız hata bölgelerinde (docs/test-ciktilari/v2141) |
| BUTUN-KAPI | tamamlandı | FE A/R 215/B/C; API 111/111; sözleşme 0 sapma; dil, marka OK |

## v2.14.0 — Tasarım B: onaylanan rol prototiplerinin ürüne uygulanması + plan adımı takibi (pilot; bağımsız karar bekleniyor)

| # | Durum | Kanıt |
|---|---|---|
| TASARIM-SISTEMI | tamamlandı | tokens.css (sarı + dört gri ton), tasarim-b.css, brand-qa OK (charts altında SVG veri grafiği izni) |
| ORTAK-BILESENLER | tamamlandı | product/ui/tb.tsx (şerit, numaralı bölüm, kare, çubuk tabloları, açılır liste, "Nasıl okunur?"), product/ui/charts/Grafik.tsx (mermi grafik, Gantt) |
| ROL-EKRANLARI-TASARIM-B | tamamlandı | ChainB.tsx, RoleHomeB.tsx; V2132-*, F04-*, V2130-*, V2131-* regresyonları aynı beklentilerle geçti (215/215, koşu v2140) |
| AKSIYON-PANOSU | tamamlandı | bu dönem / gerçekleşme takvimi (ay × kare) / plan adımları / kayıtlar / aksiyon yönetimi; ACTION-REFRESH, ACTION-CANCEL, V2140-PANO-* |
| PLAN-ADIMI-TAKIBI | tamamlandı | migrasyon 0022 (RLS zorunlu, yalnız ekleme), GET/POST plan-steps, e2e test 14b, sözleşme 128 uç 0 sapma, V2140-PANO-PLAN-ADIMI / V2140-PANO-PLANSIZ |
| YAPAY-ZEKA-PLANI-T3R | tamamlandı | AiPlan.tsx faz blokları + Gantt; V2130-AI-*, V2131-* regresyonları |
| KURULUM-VE-PLATFORM-GORUNUM | kısmi | görünüm Tasarım B (tablo, alan, sekme, üst bilgi); yapı eski düzende — sonraki sürümde şerit ve numaralı bölüm |
| INGILIZCE | tamamlandı | 180+ yeni anahtar; i18n-coverage eksik 0; EN-* regresyonları |
| TELEFON | tamamlandı | 820 px altı tek sütun; LAYOUT-375/768/1440; 390 px gerçek demo verisiyle görsel kontrol |
| BUTUN-KAPI | tamamlandı | FE A+R+B+C geçti; API 111/111 (PostgreSQL 16, migrasyon 0022); domain-core 70/70; brand-qa, tr-kontrol OK |
| GERCEK-OPENAI-CAGRISI | v2.14.0 için yapılmadı | sahte sağlayıcı; plan adımı takibi sağlayıcıdan bağımsız |

## v2.13.2 — rol bazlı sadeleştirme ve yapay zekâ uygulama planı (pilot; bağımsız karar bekleniyor)

| # | Durum | Kanıt |
|---|---|---|
| UST-YONETIM-DURUM-RISK-KARAR | tamamlandı | v2132/gorsel-anahtarsiz/yonetim-*.png, V2132-EXEC-* |
| ROL-ANA-EKRANLARI | tamamlandı | V2132-SUBE-ANA-EKRAN, gorsel |
| KULLANICI-DILI | tamamlandı | V2132-DIKKAT-BOS, V2132-IZLEYICI-ARALIK-YOK, F04-EXEC-CORP |
| AI-UYGULAMA-PLANI-V3 | tamamlandı | api e2e 20/20, V2130/V2131/V2132 UI, paket-ai-akisi, gorsel-ai-acik |
| SIRKET-DUZEYI-AKSIYON-ENGELI | tamamlandı | ai.ts, V2132-SIRKET-DUZEYI-AKSIYON |
| TEST-TARIH-FIKSTURU | düzeltildi | v01-v28.test.ts ILERI_TARIH |
| GERCEK-OPENAI-CAGRISI | v2.13.2 için yapılmadı (V3 şema gerçek sağlayıcıyla sınanmadı) | sahte sağlayıcı |

## v2.13.1 — AI dar düzeltme (pilot; bağımsız karar bekleniyor)

| # | Durum | Kanıt |
|---|---|---|
| AI-HEDEF-ONCESI | üretici kanıtı: tamamlandı (yerel sahte OpenAI) | v2131/api-e2e-ai.log, paket-ai-akisi, fe-paket V2131 |
| AI-AKSIYON-TARIH-SIKLIK | tamamlandı | v2131/paket-ai-akisi (2026-09-30 → 2026-12-29, biweekly) |
| AI-PLAN-AYRINTISI-AKSIYONLAR | tamamlandı | V2131-AKSIYON-AI-PLANI, e2e test 18 |
| AI-BAYAT-AKTARIM-KORUMASI | tamamlandı | e2e test 18 (409 plan_stale), V2131-AI-BAYAT-AKTARIM-YOK |
| KURUMSAL-ISTEK-BAGLAMI | düzeltildi (v2.13.0 hatası) | context.ts ambitions yanıt biçimi |
| GERCEK-OPENAI-CAGRISI | yapılmadı | gerçek anahtar yok |
| BUYUK-SIRKET-HEDEF-PERFORMANSI | açık | ölçülmedi |
| KILAVUZ-AI-BOLUMU | açık | bu düzeltmeye dahil değil |

## v2.13.0 — AI Hedef ve Aksiyon Planı (pilot; bağımsız karar bekleniyor)

| # | Durum | Kanıt |
|---|---|---|
| AI-HEDEF-AKSIYON-PLANI | üretici kanıtı: tamamlandı (yerel sahte OpenAI ile) | v2130/api-parca1.log, api-parca2.log, api-sozlesme.log, fe-paket (V2130 16/16), gorsel-ai-acik, gorsel-anahtarsiz, paket-pilot-kabul |
| GERCEK-OPENAI-CAGRISI | yapılmadı | gerçek anahtar yok |
| AI-HEDEF-DEGERI-TASLAGA-TASIMA | açık | oluşturulmuş hedefin değerini değiştiren uç yok; öneri bilgi olarak gösterilir |
| DAR-EKRAN-TABLO-TASMASI | düzeltildi | gorsel-anahtarsiz 375/390 |
| BUYUK-SIRKET-HEDEF-PERFORMANSI | açık | yük altında ölçülmedi |

## v2.11.6 — v2.11.5 denetim yanıtı (bağımsız karar bekleniyor)

| # | Durum | Kanıt |
|---|---|---|
| V2115-A01 | üretici kanıtı: düzeltildi | multi-pending-ui önce 1/3, sonra 3/3; V2117 6/6 |
| OTURUM-DISI-KOSU-2026-09-29T1303 | karantinaya alındı; kaynağı belirlenemedi | v2116/cakisma-tanisi |
| WEBKIT-V2100-URL | açık | neden belirlenemedi |
| DILIM-3-VE-CANLI | açık | yük, Genel bakış, Sistem ve teslimatlar, Safari, erişilebilirlik, canlıya çıkış |

## v2.11.5 — v2.11.4 denetim yanıtı (bağımsız karar bekleniyor)

| # | Durum | Kanıt |
|---|---|---|
| V2114-A01 | üretici kanıtı: düzeltildi | outcome-order-ui önce 2/3, sonra 3/3; V2115 4/4; V2116 3/3; v2115.test.ts [DB] 3/3 |
| SHA-FARKI-V2114 | sınıflandırıldı; köken belirlenemedi | v2115/sha-karsilastirma |
| WEBKIT-V2100-URL | açık | neden belirlenemedi |
| DILIM-3-VE-CANLI | açık | yük, Genel bakış, Sistem ve teslimatlar, Safari, erişilebilirlik, canlıya çıkış |

## v2.11.4 — v2.11.3 yeniden denetim yanıtı (bağımsız karar bekleniyor)

| # | Durum | Kanıt |
|---|---|---|
| V2113-A01 | üretici kanıtı: düzeltildi | reconcile-ui uyarlamalı 4/4 (özgün: 1/4 → beklenen 2/4); V2114 ×7; sonuç ucu DB 2/2 |
| V2113-A02 | üretici kanıtı: düzeltildi | EXPIRED-UNREADABLE önce FAIL, sonra PASS; V2114-SURE-DOLDU-OKUNAMADI |
| WEBKIT-V2100-URL | açık | neden belirlenemedi |
| DILIM-3-VE-CANLI | açık | yük, Safari, ekran okuyucu, %200, Genel bakış, Sistem ve teslimatlar, canlıya çıkış |

## v2.11.4 — v2.11.3 yeniden denetim yanıtı (bağımsız karar bekleniyor)

| # | Durum | Kanıt |
|---|---|---|
| V2113-A01 | üretici kanıtı: düzeltildi | reconcile-ui önce 1/4, uyarlamalı sonra 4/4; V2114 ×7; v2114.test.ts [DB] |
| V2113-A02 | üretici kanıtı: düzeltildi | reconcile-ui EXPIRED-UNREADABLE önce FAIL, sonra PASS; V2114 süre dolması |
| WEBKIT-V2100-URL | açık | neden belirlenemedi |
| DILIM-3-VE-CANLI | açık | yük, Safari, ekran okuyucu, %200, Genel bakış, Sistem ve teslimatlar, canlıya çıkış |

## v2.11.3 — v2.11.2 yeniden denetim yanıtı (bağımsız karar bekleniyor)

| # | Durum | Kanıt |
|---|---|---|
| V2111-R1-A | üretici kanıtı: düzeltildi | pending-ui MIDNIGHT önce FAIL, sonra PASS; V2113 gece yarısı ×2 |
| V2111-R1-B | üretici kanıtı: düzeltildi | pending-ui REOPEN önce FAIL, sonra PASS; V2113 Vazgeç/Escape ×4, alan ×2 |
| BOS-7H | üretici kanıtı: üç temiz turda 54/54 | bos-turlari/OKU.md |
| WEBKIT-V2100-URL | açık | neden belirlenemedi |
| DILIM-3-VE-CANLI | açık | yük, Safari, ekran okuyucu, %200, Genel bakış, Sistem ve teslimatlar, canlıya çıkış |

## v2.11.2 — v2.11.1 yeniden denetim kapanışı

| # | Durum | Kanıt |
|---|---|---|
| V2111-R1 | doğrulandı | denetçi edge-ui RETRY 2/2 (önce MAXIMUM FAIL); V2112-R1 ×6; DB sınır testi |
| V2111-R2 | doğrulandı | denetçi edge-ui DTO 5/5 (önce 3 FAIL); V2112-R2 ×6 |
| BOS-7H | kök neden bulundu (test verisi) | bos-7h-tani; tur kararlı özetle 52/52 (tek koşu) |
| WEBKIT-V2100-URL | açık | neden belirlenemedi |
| DILIM-3-VE-CANLI | açık | yük, Safari, ekran okuyucu, %200, Genel bakış, Sistem ve teslimatlar, canlıya çıkış |

## v2.11.2 — v2.11.1 yeniden denetim kapanışı

| # | Durum | Kanıt |
|---|---|---|
| V2111-R1 | doğrulandı | edge-ui RETRY-MAXIMUM (önce FAIL, sonra PASS); V2112-R1 ×6 |
| V2111-R2 | doğrulandı | edge-ui DTO ×3 (önce FAIL, sonra PASS); V2112-R2 ×6 |
| V211-01-SIRA-KANITI | doğrulandı | v2111.test.ts pg_locks sinyalleri (gerçek PostgreSQL) |
| BOS-7H | kök neden bulundu (test verisi); düzeltme sonrası 1 koşu 52/52 | bos-7h-tani/OKU.md |
| WEBKIT-V2100-URL | açık | neden belirlenemedi |
| DILIM-3-VE-CANLI | açık | yük, Safari, ekran okuyucu, %200, Genel bakış, Sistem ve teslimatlar, canlıya çıkış |

## v2.11.1 — v2.11.0 denetim kapanışı

| # | Durum | Kanıt |
|---|---|---|
| V211-01 | doğrulandı | v2111.test.ts yarış 3/3 (gerçek PostgreSQL); önce: v2.11.0 3/3 FAIL |
| V211-02 | doğrulandı | V2111-02 ×3; önce FAIL |
| V211-03 | doğrulandı | V2111-03; önce FAIL |
| V211-04 | doğrulandı | V2111-04; önce FAIL |
| V211-05 | doğrulandı | V2111-05; önce FAIL |
| V211-06 | doğrulandı | V2111-06 ×5 + DB sınır testi; önce 4/5 FAIL |
| DENETCI-BETIKLERI-V2110 | açık | kanıt ZIP iletilmedi; özgün betikler çalıştırılamadı |
| WEBKIT-V2100-URL | açık | neden belirlenemedi |
| TEK-SEFERLIK-DEEP-LINK-FIREFOX | açık | yeniden üretilemedi |
| DILIM-3-VE-CANLI | açık | yük, BOŞ 7h, Safari, ekran okuyucu, %200, Genel bakış, Sistem ve teslimatlar, canlıya çıkış |

## v2.11.0 — Bekleyen işler bölümü

| # | Durum | Kanıt |
|---|---|---|
| MP08-KURALLAR | doğrulandı | v2110.test.ts (gerçek PostgreSQL) |
| MP08-ISLEMLER | doğrulandı | v2110.test.ts; V2110-* UI |
| MP10-ILK-GORUNUM-DAR | doğrulandı | v2110 kısmi hata testi; V2110-ILK-GORUNUM (yük testi değildir) |
| V211-DAVET | doğrulandı | davet-teslimat.test.ts; önce: baseline-v2102 |
| MP17-SOZLESME | doğrulandı | 1110 yanıt 0 sapma; 151 kural |
| YUKSELTME-2102-2110 | doğrulandı | test-ciktilari/v2110/yukseltme-v2102 |
| WEBKIT-V2100-URL | açık | çökme; neden belirlenemedi (webkit-tani) |
| YUK-TESTI | açık | tanım yazıldı; ölçülmedi |
| BOS-7H | açık | kök neden bulunamadı |
| TARAYICI-ERISILEBILIRLIK | açık | Safari/cihaz, ekran okuyucu, gerçek %200 test edilmedi |
| SONRAKI-ASAMALAR | açık | Genel bakış, Sistem ve teslimatlar, canlıya çıkış |

## Bağımsız kabul — v2.10.2 (28.09.2026)

Paket `HPW_Act_TESLIMAT_v2.10.2_3040f1ae93df.zip` (SHA-256 `cabf461f…f038f`). Karar: V2101-01 ve V2101-02 bağımsız testlerle kapandı; şirket işletimi düzeltmeleri için OK; sonraki onaylı dilime geçilebilir. Kapalı gösterilmeyecekler: BOŞ 7h kök nedeni, Safari/Firefox/WebKit, ekran okuyucu ve gerçek %200 yakınlaştırma, gerçek PostgreSQL bağımsız kabulü, 20 şirket yük/ölçek kabulü, v2.11 işlevleri ve canlıya çıkış kapıları. Rapor: `docs/denetim/v2.10.2/`.

## v2.10.2 — v2.10.1 yeniden denetim kapanışı

| # | Durum | Kanıt |
|---|---|---|
| V2101-01 | doğrulandı | denetçi V2101-R1/R2; V2102-R1-ESKI-409/503, V2102-R2-409, V2102-R2-BASARI-MESAJ |
| V2101-02 | doğrulandı | denetçi V2101-R3; V2102-R3-*; v2101.test.ts makbuz zinciri (gerçek PostgreSQL) |
| KANIT-DUZELTME-v2101-C | doğrulandı | sonuç denetimi koşu kimliğine bağlandı (DENETIM-YANITI-v2.10.2 §3) |
| YUKSELTME-291-2102 | doğrulandı | test-ciktilari/v2102/yukseltme-v291 |
| BOS-7H | açık | kök neden bulunamadı; tanı kaydı turda |
| TARAYICI-DIGER | açık | Mac/Safari, Firefox, WebKit, ekran okuyucu, gerçek %200 TEST EDİLMEDİ |
| DILIM-3 | açık | v2.11, 20 şirket yük testi, canlıya çıkış kapıları |

## v2.10.1 — v2.10.0 denetim kapanışı

| # | Durum | Kanıt |
|---|---|---|
| V210-01 | doğrulandı | denetçi V210-A/A2; V2101-A-* |
| V210-02 | doğrulandı | denetçi V210-F (kontrollü DB); v2101.test.ts (gerçek PostgreSQL, iki bağlantılı yarışlar) |
| V210-03 | doğrulandı | denetçi V210-B; V2101-B-* |
| V210-04 | doğrulandı | denetçi V210-C (503, bozuk); V2101-C-* |
| V210-05 | doğrulandı | denetçi V210-D; V2101-D-ODAK |
| V210-06 | doğrulandı | denetçi V210-E; V2101-E-DAR (320/640 px) |
| YUKSELTME-291-2101 | doğrulandı | test-ciktilari/v2101/yukseltme-v291 |
| BOS-7H | açık | ilk v2.10.0 koşusunda zaman aşımı; tanı kaydı eklendi; sonraki 3 temiz koşu 52/52; kök neden bulunamadı |
| TARAYICI-DIGER | açık | Mac/Safari, Firefox, WebKit, ekran okuyucu, gerçek %200 yakınlaştırma TEST EDİLMEDİ |
| DILIM-3 | açık | 2.11 kapsamı; canlıya çıkış kapıları |

## v2.10.0 — şirket işletimi

| # | Durum | Kanıt |
|---|---|---|
| MP03-KURULUM | doğrulandı | v2100.test.ts; V2100-KURULUM |
| MP03-ACILIS-ZINCIRI | doğrulandı | v2100.test.ts Kurulum 4 ve 10; V2100-MUSTERI-TEYIT |
| MP04-BAGLAM | doğrulandı | regresyon C; V2100-GEC-YANIT/DLG-BAGLAM/IKI-SEKME |
| MP07-DONEM | doğrulandı | v2100 Dönem kapsamı; V2100-DONEM-YOK |
| MP09-DEVIR | doğrulandı | regresyon A; SEC-EKIP |
| MP11-YASAM-DONGUSU | doğrulandı | v2100 Arşiv + Durdurma/arşiv geçişi |
| MP12-IZ-ANAHTARI | doğrulandı | regresyon B |
| MP14-URL | doğrulandı | V2100-URL; V2100-MERKEZE-DON |
| MP16-ONAY-PENCERESI | doğrulandı | V2100-DLG-KLAVYE |
| MP17-SOZLESME | doğrulandı | 871 yanıt 0 sapma; 134 kural |
| YUKSELTME-291-2100 | doğrulandı | test-ciktilari/v2100/yukseltme-v291 |
| TARAYICI-DIGER | açık | Mac/Safari, Firefox, WebKit, ekran okuyucu TEST EDİLMEDİ |
| DILIM-3 | açık | 2.11.0 kapsamı |
| BOS-TUR-ILK-KOSU | açık | ilk koşuda 7h zaman aşımı; ikinci koşu 52/52; kök neden bulunamadı |

## v2.9.1 — v2.9.0 denetim kapanışı

| # | Durum | Kanıt |
|---|---|---|
| V290-01 | doğrulandı | independent-ui V290-UI-04; V291-ASG-* |
| V290-02 | doğrulandı | independent-ui V290-UI-03; V291-GECMIS-* |
| V290-03 | doğrulandı | independent-ui V290-UI-01/02; V291-DTO-*; dto-contract 26 uç |
| V290-04 | doğrulandı | v291.test.ts test 1 (gerçek PostgreSQL) |
| V290-05 | doğrulandı | config-mfa.test.ts 16; production-config.mjs; yükseltme |
| V290-06 | doğrulandı | v291.test.ts test 5 (gerçek PostgreSQL); independent-api.mjs |
| ROL-DEGISMEZLERI | doğrulandı | v291.test.ts test 2-4 |
| YUKSELTME-290-291 | doğrulandı | test-ciktilari/v291/yukseltme |
| DILIM-2-3 | açık | 2.10.0/2.11.0 kapsamı; bu sürümde yok |
| TARAYICI-DIGER | açık | Mac/Safari, Firefox TEST EDİLMEDİ |

## v2.9.0 — İngilizce arayüz ve güvenlik dilimi

| # | Durum | Kanıt |
|---|---|---|
| I18N-TR-EN | doğrulandı | i18n-coverage + 8 EN tarayıcı testi |
| MP05-ROL-ATAMA | doğrulandı | API test 44; SEC-EKIP |
| MP06-ERISIM-IPTALI | doğrulandı | API test 44 (oturum 401) |
| MP12-PLATFORM-GECMIS | doğrulandı | API test 44; SEC-GECMIS |
| MP15-YAZMA-KORUMASI | doğrulandı | API test 44 (veritabanı doğrudan yazma reddi) |
| K7-MUDAHALE | doğrulandı | API test 44; SEC-MUDAHALE |
| K9-MFA | doğrulandı | API test 45; MFA-KURULUM; MFA-YENIDEN; BOŞ tur 1a |
| KILAVUZ-2.9 | açık | yeni ekranlar ve MFA kılavuzda yok |
| DILIM-2-3 | açık | 2.10.0 ve 2.11.0 yapılmadı |
| TARAYICI-DIGER | açık | Mac/Safari ve Firefox TEST EDİLMEDİ |

## v2.8.0 — HPW merkez paneli (temel)

| # | Durum | Kanıt |
|---|---|---|
| MP-TEMEL | doğrulandı | docs/SURUM-NOTU-v2.8.0.md; test-ciktilari/v280 |
| MP-OLCEK | açık | 20 şirket + 5 eşzamanlı HPW oturumu ölçülmedi; portföy sıralı okuma |
| MP-YETKI-DARALTMA | açık | danışman/metodolog/denetçi rolleri ve platform yazma kısıtı iş sahibi kararı bekliyor |
| TARAYICI-DIGER | açık | Mac/Safari ve Firefox TEST EDİLMEDİ |

## v2.7.6 — R04 sözleşme kapanışı

| # | Durum | Kanıt |
|---|---|---|
| R04 | doğrulandı | docs/DENETIM-YANITI-v2.7.6.md; domain-map.ts 94 kural; contract-remaining 4/4; kapsam denetimi 0 sorun; API 42/42, 554 yanıt 0 sapma |
| TARAYICI-DIGER | açık | Mac/Safari ve Firefox TEST EDİLMEDİ |
| CANLI-HAZIRLIK | açık | HTTPS/Mac, Docker, SMTP, upload güvenliği, retention, yedekten dönüş, yük (canlıya çıkış kapıları) |

## v2.7.5 — bağımsız yeniden denetim (R01–R04)

| # | Durum | Kanıt |
|---|---|---|
| R01 | doğrulandı | docs/DENETIM-YANITI-v2.7.5.md; test-ciktilari/v275 |
| R02 | doğrulandı | docs/DENETIM-YANITI-v2.7.5.md; test-ciktilari/v275 |
| R03 | doğrulandı | docs/DENETIM-YANITI-v2.7.5.md; test-ciktilari/v275 |
| R04 | doğrulandı | docs/DENETIM-YANITI-v2.7.5.md; test-ciktilari/v275 |
| TARAYICI-DIGER | açık | Mac/Safari ve Firefox TEST EDİLMEDİ |
| CANLI-HAZIRLIK | açık | HTTPS/Mac dağıtımı, Docker, SMTP, upload güvenliği, retention, yedekten dönüş, yük: canlıya çıkış kapıları (backend hazırlığından ayrı) |
| ENUM-KAPSAM | kısmi | 66 tek anlamlı enum alanının tamamı elle iş kuralına karşı doğrulanmadı; yalnız denetçinin 3 karşı örneği ve 545 gerçek yanıt örneklemesi doğrulandı |

## v2.7.4 — bağımsız yeniden denetim (N01–N04)

| # | Durum | Kanıt |
|---|---|---|
| N01 | doğrulandı | docs/DENETIM-YANITI-v2.7.4.md; test-ciktilari/v274 |
| N02 | doğrulandı | docs/DENETIM-YANITI-v2.7.4.md; test-ciktilari/v274 |
| N03 | doğrulandı | docs/DENETIM-YANITI-v2.7.4.md; test-ciktilari/v274 |
| N04 | doğrulandı | docs/DENETIM-YANITI-v2.7.4.md; test-ciktilari/v274 |
| TARAYICI-DIGER | açık | Mac/Safari ve Firefox TEST EDİLMEDİ |
| CANLI-HAZIRLIK | açık | HTTPS/Mac dağıtımı, Docker, SMTP, upload güvenliği, retention, yedekten dönüş, yük: canlıya çıkış kapıları (backend hazırlığından ayrı) |

## v2.7.3 — ön yüz ve backend hazırlık denetimi (F01–F16)

| # | Durum | Kanıt |
|---|---|---|
| F01 | doğrulandı | bkz. docs/DENETIM-YANITI-v2.7.3.md; test-ciktilari/v273 |
| F02 | doğrulandı | bkz. docs/DENETIM-YANITI-v2.7.3.md; test-ciktilari/v273 |
| F03 | doğrulandı | bkz. docs/DENETIM-YANITI-v2.7.3.md; test-ciktilari/v273 |
| F04 | doğrulandı | bkz. docs/DENETIM-YANITI-v2.7.3.md; test-ciktilari/v273 |
| F05 | doğrulandı | bkz. docs/DENETIM-YANITI-v2.7.3.md; test-ciktilari/v273 |
| F06 | doğrulandı | bkz. docs/DENETIM-YANITI-v2.7.3.md; test-ciktilari/v273 |
| F07 | doğrulandı | bkz. docs/DENETIM-YANITI-v2.7.3.md; test-ciktilari/v273 |
| F08 | doğrulandı | bkz. docs/DENETIM-YANITI-v2.7.3.md; test-ciktilari/v273 |
| F09 | doğrulandı | bkz. docs/DENETIM-YANITI-v2.7.3.md; test-ciktilari/v273 |
| F10 | doğrulandı | bkz. docs/DENETIM-YANITI-v2.7.3.md; test-ciktilari/v273 |
| F11 | doğrulandı | bkz. docs/DENETIM-YANITI-v2.7.3.md; test-ciktilari/v273 |
| F12 | doğrulandı | bkz. docs/DENETIM-YANITI-v2.7.3.md; test-ciktilari/v273 |
| F13 | doğrulandı | bkz. docs/DENETIM-YANITI-v2.7.3.md; test-ciktilari/v273 |
| F14 | doğrulandı | bkz. docs/DENETIM-YANITI-v2.7.3.md; test-ciktilari/v273 |
| F15 | doğrulandı | bkz. docs/DENETIM-YANITI-v2.7.3.md; test-ciktilari/v273 |
| F16 | doğrulandı | bkz. docs/DENETIM-YANITI-v2.7.3.md; test-ciktilari/v273 |
| TARAYICI-DIGER | açık | Mac/Safari ve Firefox TEST EDİLMEDİ (ortamda yok) |

Özet: doğrulandı 16, açık 1

## GÜNCEL DURUM — v2.7.0 denetimi ve açık kapsam (tek kaynak)

| # | Durum | Kanıt |
|---|---|---|
| V270-P0-01 | doğrulandı | Kuyruk sözleşmesi A: istisna/karar/kaynak türlerinde kararsız kapatma 422 decision_required, sonuçsuz karar 422; kuyruk kararı alttaki kaydı aynı işlemde sonuçlandırır (kaynak isteği onay/ret, karşı teklif/istisna, fark kabulü, dağıtım reddi kabul/geri çevirme); alttaki kayıt karar verilebilir değilse 409 ve kuyruk değişmez; sürüm geçişi kaydı bekleyen varken kapanmaz, son birim kararıyla kendiliğinden kapanır; 0011 migrasyonu eski kararsız kapatılmış kayıtları yeniden açar (API test 19; tarayıcı ui-400-dagitim adım 6) |
| V270-P0-02 | doğrulandı | Gizli kohort satırı gizlilik güvenli DTO: sayılar yanında uzlaştırma durumu “hidden”, yerel hedef kimliği, istisna gerekçesi, karar verenler null; detay kırılımı, uzlaştırma yanıtı, Control Tower istek ve üst düzey kohort sayımları gizli satırın durumunu saymaz (API test 19, eşik 5→25). “Değer gizli ama iş akışı durumu görünür” politikası HPW onayı olmadan açılmadı |
| V270-P1-03 | kısmi | 400 şube tam yaşam döngüsü gerçek HTTP + PostgreSQL (DOLU DEMO kopyası, birimler demo verisinden): 400 şubede hedef API ile, 400 dağıtım, 380 eşzamanlı kabul + yerel aksiyon (p95 167.0 ms), 20 ret, 150 kanıt, 380 eşzamanlı sürüm kararı, 20 kuyruk kararı; 0 hata; sürüm kaydı kapandı (olcek-lifecycle-yerel.json). Tarayıcıdan 400 şubeye dağıtım 7/7 (ui-400-dagitim). KOŞULMADI: 400 yerel yanıtın tarayıcıdan tek tek verilmesi, 400 birimde takip dönemi ölçümü (sonraki dönem sonucu gerekir), çok kullanıcılı eşzamanlı yazma yarışları |
| V270-P1-04 | doğrulandı | Dağıtım ve kohort dondurma tek küme tabanlı INSERT (unnest); ata-torun denetimi tek özyinelemeli sorgu. Yerel: 200: 18.9 ms, 400: 30.2 ms, 500: 26.4 ms. 5 ms gidiş-dönüş gecikme benzetimi (TCP vekil, gerçek uzak DB değildir): 200: 217.6 ms, 400: 228.7 ms, 500: 225.6 ms — birim sayısından bağımsız |
| V270-P1-05 | doğrulandı | Dağıtım yalnız bugün etkin birimlere: kapanmış ve gelecekte açılacak birim 422 unit_not_active, hiçbir satır yazılmaz; panel yalnız etkin birimleri listeler (API test 19; tarayıcı 400 etkin şube) |
| V270-P1-06 | dış bağımlılık | Kohort birim tarihi esası açık parametre: dondurma tarihi ya da anket dönemi bitişi; önizleme ve dondurma aynı fonksiyon ve aynı tarih; seçilen esas istekte saklanır; birim ve hiyerarşi aynı tarihle süzülür (API test 19; tarayıcı adım 7). Hangi esasın kanonik olduğu HPW metodoloji kararıdır; varsayılan “dondurma tarihi” bu karar gelene kadar geçicidir |
| V270-P1-07 | doğrulandı | Kapanış tek kaynak: bu bölüm güncel durumdur; çelişen eski satırlar (v2.6.8 OPS-16, v2.6.9 P1-400/P1-official-ui/P1-transfer/P1-privacy, v2.6.8 P1-9/P1-12/P1-13) superseded olarak işaretlendi, A99-23…30 güncellendi |
| PERF-01 | doğrulandı | Ölçek bulgusu ve düzeltmesi: 400 şubede hedef önizlemesi 1,6 sn idi (satır başına şirket ortalaması alt sorgusu); istek başına tek hesap + 0012 indeksleri ile ~0,23 sn; birim sonuçları ~0,30 sn. 8 eşzamanlı hedef oluşturmada p95 1,85 sn — kabul edilebilir ama izlenmeli |
| REG-01 | doğrulandı | v2.7.1’de gelen gerileme: üst çubukta yetki profilini Türkçe göstermek için değiştirilen değişken menü görünürlüğünde de kullanılıyordu; İK yöneticisinde Organizasyon, Soru seti, Dönemler ve Kullanıcılar menüsü kayboluyordu (ekranlara doğrudan adresle erişim çalışıyordu). DOLU DEMO duman testi (D4) yakaladı; menü yeniden yetki koduna bağlandı; final ZIP’te duman testi ve BOŞ tur yeniden koşuldu. Final build 5e5b18b28d58: DOLU DEMO duman testi 8/8 (menüde Kullanıcılar dahil), BOŞ tur 51/51 |
| FLAKE-01 | kısmi | BOŞ tarayıcı turu v2.7.2 ara derlemede bir kez adım 8’de (İK iş ortağı “Doğrula” düğmesi etkin olmadı) düştü; nedeni bulunamadı. Final build 5e5b18b28d58 üzerinde temiz açılışla 51/51 geçti. Tekrarlanırsa incelenecek |
| TR-02 | doğrulandı | Ekranda kalan ham durum kodları Türkçe etiketle: Dikkat önem düzeyi (kritik/uyarı/bilgi), aksiyon yaşam/doğrulama/sağlık durumları, hedef durumu, dönem durumu; BOŞ tur doğrulama adımı Türkçe etiketi kontrol ediyor |
| KILAVUZ | doğrulandı | A4 kullanma kılavuzları (tüm roller + 8 rol) v2.7.2 ekran görüntüleri ve davranışıyla yeniden üretildi: kuyrukta kararsız kapatma yok, kohort tarih esası, etkin birim dağıtımı, aksiyon devri, endeks paneli |
| OFFICIAL-UI | kısmi | Birim sonuçları ekranında endeks paneli: resmî HPW toplamı (tanım sürümü, durum) ve ayrı etiketli türetilmiş tahmin (“resmî HPW sonucu değildir”); API birim kapsamı testli (test 17). Panel tarayıcıda ayrıca test edilmedi; DOLU DEMO’da resmî toplam yüklü değil |
| TRANSFER | doğrulandı | Aksiyon devri API: yalnız aynı birim ya da üst birimdeki etkin role, kapalı aksiyon devredilemez, tarihçe (test 19); aksiyon ayrıntısında “Sorumluyu devret” düğmesi (tarayıcıda ayrıca test edilmedi). Hedef devri mevcut. Vekâlet: tarihli rol ataması (Rol_Atamaları; demo’da etkin ve süresi biten vekil) |
| MERGE | kısmi | Birim birleştirme (absorb) API: alt birimler tarihli taşınır, birim kapanır, açık hedef/aksiyon sahipsiz kuyruğuna düşer, döngü 422, yalnız şirket geneli İK (test 19); ekran yok. Bölme (split): uygulanmadı — ölçüm soy ağacı/karşılaştırılabilirlik HPW yöntem kararı gerektirir. Kapatma/açma: Excel ile mevcut |
| PRIVACY-DIFF | kısmi | Farklılaştırma kuralı: gizli alt birimlerin toplam yanıtı ya da “üst − görünür alt” kalan grup eşik altındaysa üst değer gizlenir; birden çok gizli alt birim kombinasyonları saf fonksiyon testiyle (test 20) ve tek gizli durum HTTP ile (test 16). Üründe filtre/demografik kesit ve dışa aktarma katmanı yoktur; eklenirse aynı kapıdan geçmelidir. Tarihsel örgüt görünümü üzerinden farklılaştırma testi yok |
| HPW-METOD | dış bağımlılık | Uzlaştırma yöntemi (HPW-RECON-DRAFT-2026.1), kohort tarih esası ve “gizli değer + görünür iş akışı” politikası HPW metodoloji onayı bekliyor |
| ERISIM | açık | HTTPS DOLU/BOŞ ortamları ya da imzalı/notarize Mac dağıtımı: yayın izni, alan adı/hosting ya da Apple Developer ID gerekli; yapılmadı |
| OPS | açık | Docker temiz derleme/çalıştırma, gerçek SMTP/bounce ve uzun toplu gönderim, upload güvenliği (zip bombası, zararlı yazılım), retention/imha, backup→restore tatbikatı, erişilebilirlik/klavye, gerçek uzak/hosted PostgreSQL yük testi: bu ortamda koşulmadı |
| KURUMSAL-KABUL | kısmi | Tam kurumsal/canlı kabul: yukarıdaki dış bağımlılıklar ve açık operasyon kapıları kapanmadan verilemez |

Özet: doğrulandı 10, kısmi 6, dış bağımlılık 2, açık 2

## v2.7.1 (kılavuz turu düzeltmeleri)

| # | Durum | Kanıt |
|---|---|---|
| K-01 | doğrulandı | Birim sonuçları sayfası gizli/çıkarım korumalı satırda çöküyordu (birim müdürü boş sayfa); redakte satırlar boş dizilerle döner; tarayıcıda şube müdürü sayfası açılıyor (kılavuz ekran görüntüleri) |
| K-02 | doğrulandı | Birim ve bölge müdürü kendi biriminin bulunduğu kurumsal istekleri listeleyebilir; Hedefler ekranında kurumsal uzlaştırma bölümü görünür (kılavuz ekran görüntüsü 62/63) |
| K-03 | doğrulandı | Türkçe arayüz: üst çubukta yetki profili, rol/kuyruk/dağıtım/uzlaştırma durumları, etkileşim alanı ve sorumluluk merkezi seçenekleri, ritim seçenekleri Türkçe etiketle; “Top Box” ve onay penceresindeki İngilizce kodlar kaldırıldı |
| K-04 | doğrulandı | A4 kullanma kılavuzları (tüm roller + 8 rol) gerçek ekran görüntüleriyle yeniden üretildi |

Özet: doğrulandı 4

## v2.6.9 denetimi

| # | Durum | Kanıt |
|---|---|---|
| P0-269-01 | doğrulandı | closed alttaki kaydı değiştirmez (effect null); karar gerektiren türlerde outcome zorunlu (422); UI kabul/ret/kapat ayrı; test: counterproposal/exception/resource kaydına closed → durum değişmedi (test 18) |
| P0-269-02 | doğrulandı | kohort kuralı zorunlu (leaf / birim tipi / seçili); ata-torun aynı kohortta 422 cohort_overlap; cohort-preview sayı/liste; UI freeze öncesi kapsam önizlemesi; test: A+A1+A2 sonuçluyken leaf yalnız yapraklar (test 18) |
| P0-269-03 | doğrulandı | kohort detayı/projeksiyon/Control Tower read-time güncel eşikle redakte; 5→25 gizli, 25→5 geri (test 18) |
| P0-269-04 | doğrulandı | tek projeksiyon motoru projectCohort: kabul edilen istisna payda ve paydan çıkar, gizli satırlar sayılmaz; reconcile/detay/Control Tower aynı motor; test: istisna kabulü sayılan birimi düşürür (test 18). Metodoloji HPW onayı bekliyor (dış bağımlılık, yanıtta approved:false) |
| P0-269-05 | doğrulandı | yerel aksiyon planı ana aksiyon ritmi (weekly/biweekly/monthly/quarterly/once) ve ufkundan (horizon_days) planSlots ile; 5 ritim gerçek DB testi (test 18) |
| P0-269-06 | doğrulandı | master-actions ve ambitions listeleri görünür birim setiyle (scoped bayrağı); kapsamlı HRBP global sayı göremez (test 18) |
| P0-269-07 | doğrulandı | as-of: tenant org listesi, org importer diff, move current parent, orphan/yönetici rolü, görünürlük, kohort — hepsi effective_from/effective_to as-of; gelecek taşıma bugünkü listede eski üstü gösterir (test 18, test 17) |
| P0-269-08 | doğrulandı | counterproposalValue 0–100 şemada; -1/101 400; değer zorunlu 422 (test 18) |
| P1-UI | doğrulandı | ana aksiyon oluştur / yeni sürüm / yayımla / dağıt (birim tipi/kod filtresi, kapsam önizlemesi, kaç birim) ve kaynak/bütçe/bağımlılık isteği gerçek UI; tarayıcı testi ui-kurumsal-v270 |
| P1-reopen | doğrulandı | dedupe reopen: kind/title/detail/priority/state güncellenir, decision/decided_by/decided_at sıfırlanır (test 18) |
| P1-400 | superseded | yerine geçti: v2.7.2 güncel durum bölümü (önceki: 400 yaprak birim + 400 dağıtım (82 ms) + idempotent tekrar + yeni sürüm (400 pending_upgrade) + kuyruk/Control Tower/dağ) |
| P1-rollup | doğrulandı | Control Tower bölge kırılımı recursive as-of alt ağaç (B altındaki 400 şube bölgeye roll-up) (test 18) |
| P1-official-ui | superseded | yerine geçti: v2.7.2 güncel durum bölümü (önceki: resmî toplam ekranda gösterimi yapılmadı (API var)) |
| P1-transfer | superseded | yerine geçti: v2.7.2 güncel durum bölümü (önceki: aksiyon devri/vekâlet, split/merge/absorb/close-open yok) |
| P1-privacy | superseded | yerine geçti: v2.7.2 güncel durum bölümü (önceki: overlapping filtre/differencing/export testleri yok) |
| OPS | açık | HTTPS/Mac erişimi (karar+altyapı), Docker temiz derleme, SMTP/bounce, upload güvenliği, retention/imha, backup-restore, erişilebilirlik/yük (dış) yapılmadı |

Özet: doğrulandı 11, superseded 4, açık 1

## v2.6.8 denetimi

| # | Durum | Kanıt |
|---|---|---|
| P0-1 | doğrulandı | aggregates birim kapsamı (assertUnitVisible): başka birim 403, kapsamlı HRBP yalnız kendi ağacı (test 17) |
| P0-2 | doğrulandı | Control Tower şirket geneli (kapsamlı HRBP 403), kuyruk görünür birim setiyle filtreli, EXEC görür (test 17) |
| P0-3 | doğrulandı | yönetişim matrisi GOVERNANCE (corporate.ts): öneren HR_ADMIN/EXEC; freeze/reconcile/publish/deploy HR_ADMIN; birim kararı yönetici/HRBP; merkezi karar HR_ADMIN/EXEC; EXEC freeze 403, istek önerir, merkezi karar verir (test 17) |
| P0-4 | doğrulandı | liste/detay GET (ambitions, ambitions/:id, master-actions, deployments, resource-requests) + UI: Genel bakış planlama (öner/dondur/uzlaştır/detay), Hedefler uzlaştırma kararı, Aksiyonlar dağıtım kabul/red/yükselt/yerel bağ + ana aksiyon listesi, Dikkat karar kabul/ret (tarayıcı testi ui-kurumsal-v269) |
| P0-5 | doğrulandı | as-of hiyerarşi fonksiyonu org_parent_asof + tarihli sorgular; gelecek tarihli taşıma bugünü değiştirmez; döngü 422; geçmiş tarih 422 (test 17) |
| P0-6 | doğrulandı | merkezi karar altta yatan kaydı sonuçlandırır: karşı teklif kabulü projeksiyonu çeker/durumu günceller, istisna kabulü, kaynak isteği onayı; accept_gap başlığı düzeltildi (test 17) |
| P0-7 | doğrulandı | yeni sürüm: kod aynı olmalı, ambition bağı miras; dağıtım başına yükselt/eski sürümde kal/emekli et kararı tarihçeli; yükseltme yeni dağıtım yaratır (test 17) |
| P0-8 | dış bağımlılık | birim düzeyinde katkı/fizibilite semantiği (contributing/no_local_target/unsupported), kurumsal fark kohort düzeyinde; headcount ağırlıklı projeksiyon HPW-RECON-DRAFT-2026.1 onay bekliyor (yanıtta approved:false) |
| P1-10 | doğrulandı | dağıtım kabul/red gerekçeli; kabulde ana aksiyondan güvenli yerel aksiyon taslağı (kabul edilmiş hedefe bağlı), local_action_id izlenebilir (test 17, UI) |
| P1-11 | doğrulandı | Control Tower: istek/projeksiyon/kurumsal fark, kırılım, ana aksiyon bazında dağıtım/uygulama/sürüm bekleyen, veri tazeliği, riskli birimler (geciken aksiyon), karar bekleme yaşı, kaynak/bütçe/bağımlılık blokajları, bölge kırılımı, drill-down (test 17) |
| P1-14 | doğrulandı | yapılandırılmış kaynak/bütçe/bağımlılık isteği: sahip, ihtiyaç, tutar, termin, bloke, durum, karar; merkezi kuyruk bağı; karar isteği sonuçlandırır (test 17) |
| P1-15 | doğrulandı | metrik kimliği: istek yalnız *_TB metriğinde, metric_code açık; desteklenmeyen/eksik metrik 422 unsupported_metric (test 17) |
| P1-9 | superseded | yerine geçti: v2.7.2 TRANSFER/MERGE, PRIVACY-DIFF, OFFICIAL-UI (önceki: birim taşıma + hedef devri var; aksiyon devri, vekâlet, split/merge/absorb/close-open yok) |
| P1-12 | superseded | yerine geçti: v2.7.2 TRANSFER/MERGE, PRIVACY-DIFF, OFFICIAL-UI (önceki: küçük grup + tamamlayıcı gizleme as-of hiyerarşi ile; overlapping filtre/çoklu gizli hücre differencing testi ve export ) |
| P1-13 | superseded | yerine geçti: v2.7.2 TRANSFER/MERGE, PRIVACY-DIFF, OFFICIAL-UI (önceki: official/derived API var; ekranda gösterim yok) |
| OPS-16 | superseded | yerine geçti: v2.7.2 V270-P1-03/P1-04 (200/400/500 ve 400 yaşam döngüsü koşuldu) (önceki: 400/200/500 ölçek kabulü ve yük testi koşulmadı) |
| OPS-17 | açık | Mac/HTTPS erişimi karar bekliyor |
| OPS-18 | açık | Docker temiz derleme yapılmadı (BLOCKED) |
| OPS-19..20 | açık | SMTP/bounce, upload güvenliği, retention, backup/restore, erişilebilirlik açık |
| OPS-21 | doğrulandı | paketleme: KAPANIS build alanı kopyadan önce yazılır, paketleme sonrası kapanış/manifest/ZIP build eşitliği doğrulanır (aksi hâlde paketleme durur) |

Özet: doğrulandı 12, dış bağımlılık 1, superseded 4, açık 3

## v2.6.5 denetimi P1/P2

| # | Durum | Kanıt |
|---|---|---|
| P1-6 | doğrulandı | Soru seti sayfası: boyut satırı altında tekil madde aç/kapat; çekirdek maddeler kilitli ve gerekçeli; 4/3 seçim API testinde; sertifikasyon etkisi yayımda (test 16) |
| P1-7 | doğrulandı | interaction_area: HPW sözlüğü (work/manager/colleagues/employer_brand/system/self/outcome); XLSX Maddeler kolonu + sözlük satırı; importer/API doğrulaması (uydurma değer 422); panel seçici; DB kalıcı; sonuç satırında alan (test 16) |
| P1-8 | doğrulandı | cm_responsibility_map: madde/etkileşim alanı → sorumluluk merkezi → onaylı tenant rolü → kapsam → tarih → istisna; yalnız HR_ADMIN; hedef adayları haritadan (candidateSource=responsibility_map), sabit liste yalnız başlangıç önerisi (test 16); Organizasyon sayfasında harita paneli (tarayıcı testi) |
| P1-9 | doğrulandı | GET /cycles/:cid/units/:uid/aggregates: official (HPW official_aggregate) ≠ derived_estimate (madde ortalaması) ayrı etiket; gizli/eksik üye → tahmin üretilmez; official yoksa null (test 16) |
| P1-10 | doğrulandı | tamamlayıcı gizleme: üst birimde alt birimlerden tam biri gizliyse üst değer gösterilmez (çıkarım koruması); sonuç satırında gerekçe (test 16). Export katmanı yok |
| P1-11 | doğrulandı | reorg: birim taşıma tarihli (eski ilişki kapanır, geçmiş korunur), hedef devri (rol değişimi + tarihçe), orphan kuyruğu (yöneticisiz birimde açık hedef) (test 16); Organizasyon sayfasında taşıma paneli, uzun offline sonrası aynı anahtarla manuel yeniden deneme → tek taşıma kaydı (tarayıcı testi) |
| P2-12 | superseded | yerine geçti: v2.6.8/v2.6.9 denetimi bölümleri (API+DB+UI, 400 birim yük testi) |
| ERISIM-13 | açık | Mac/HTTPS kararı bekleniyor; yayın yok; Docker temiz makine testi yok |
| OPS-14 | açık | SMTP/bounce, upload güvenliği, retention/imha, backup-restore tatbikatı, yük testi bu ortamda koşulamaz; açık |

Özet: doğrulandı 6, superseded 1, açık 2

## v2.6.5 denetimi P0

| # | Durum | Kanıt |
|---|---|---|
| P0-1 | doğrulandı | takip gizliliği: başlangıç ve takip sonucu KENDİ dönem eşiğiyle (privacyGate satır bazlı eşik); 5→25 ve 25→5 senaryoları: HIDDEN, n/value/target/outcome/attainment/observedChange yok; ikisi de yayınlanabilirse sayı (v01-v28 test 15) |
| P0-2 | doğrulandı | commandApi: sessionStorage niyet, outcome_unknown korunur, aynı düğmede aynı anahtar; TARAYICI: bütün POST 9 sn engellendi → otomatik denemeler tükendi, ekranda açık uyarı, sonra manuel tıklama aynı anahtarla → DB etkisi bir kez (ui-kurumsal-offline-sonuc.json). Çift tık testi önceki turdan |
| P0-3 | doğrulandı | platform şirket oluşturma: aynı kodla ikinci komut 409 tenant_exists + mevcut kayıt kimliği, ikinci şirket yok; davet kabulü: tüketilen token hash aynı transaction'da işaretlenir, ikinci deneme 410 invitation_already_accepted + e-posta, belirlenen parolayla giriş çalışır (test 15) |
| P0-4 | doğrulandı | import commit: aynı anahtar aynı yanıt; committed işe anahtarsız ikinci commit recovered:true (yeniden uygulama yok); GET /imports/:jid committed_result; iş etkisi bir kez (test 15, e2e-5) |
| P0-5 | doğrulandı | PATCH komut sözleşmesinde (rezervasyon/makbuz/replay); dönem soru seti PATCH aynı anahtarla aynı yanıt, makbuz tenant kapsamlı (test 15) |
| P1-6..11 | superseded | yerine geçti: v2.6.7–v2.7.0 (P1P2_v265, v268, v269 bölümleri) |
| P2-12 | superseded | yerine geçti: v2.6.7–v2.7.0 (P1P2_v265, v268, v269 bölümleri) |
| ERISIM-13 | açık | Mac/HTTPS kararı bekleniyor; yayın yok; Docker temiz makine testi yok |
| OPS-14 | açık | SMTP/bounce, upload güvenliği, retention/imha, backup-restore, yük testi ayrı kapılar, yapılmadı |

Özet: doğrulandı 5, superseded 2, açık 2

## v2.6.4 denetimi

| # | Durum | Kanıt |
|---|---|---|
| P0-1 | doğrulandı | takip gizliliği tek kapı (privacyGate, güncel eşik, bayraktan bağımsız): threshold 25/n=20 → HIDDEN, baseline/followup value-n, target, outcome, attainment, observedChange yok; NOT_COMMITTED observed yok; UNDER_REVIEW sayı yok; DTO hidden/suppressed (v01-v28 test 14); UI gizli kartı. Çoklu rapor gizliliği ayrı açık iş |
| P0-2 | kısmi | merkezi commandApi: aynı URL+gövde için kararlı anahtar, çift tıkta tek uçuş, yanıt kaybı/ağ hatasında aynı anahtarla yeniden deneme, iş hatasında niyet kapanır; ürün sayfalarındaki 19 mutating çağrı bağlandı (önizleme/yükleme hariç). Tarayıcı: çift tık → iki istek aynı anahtar, DB +1 (ui-ciftik-sonuc.json). Bağlantı kesilmesi tarayıcı testi koşulmadı; multipart dosya hash semantiği yapılmadı (yükleme doğal tekil) |
| P0-3 | doğrulandı | GET /followup salt hesap (persisted=false, outcome_assessment yazmaz); POST /followup/assess kalıcı (yazma yetkisi, makbuz kaynağı, audit aynı transaction, komut anahtarı) (test 14, e2e-8) |
| P0-4 | açık | erişim yolu kararı bekleniyor (HTTPS: hosting/TLS/izin; Mac: Developer ID+notarization+gerçek cihaz). Yayın yapılmadı |
| P1-5 | kısmi | Docker fail-fast: final imajda psql gerekmez, grup üyeliği migrate adımında GRANT_APP_ROLES_TO ile; || true kaldırıldı; migrate/grant başarısız → API başlamaz. Docker yok → temiz checkout testi YAPILMADI |
| P1-6 | açık | interaction_area kolonu/sözlük/panel yapılmadı |
| P1-7 | açık | Responsibility Map yapılmadı |
| P1-8 | açık | official_aggregate read path yapılmadı |
| P1-9 | açık | reorg/delegation/orphan yapılmadı |
| B-12 | doğrulandı | TESLIMAT metni build/sürüm yer tutucularından; 0001–0007; tek manifest |
| B-13 | doğrulandı | A99-13: migrate gerçek exit kodu 1, betik assert eder (migrasyon-varyant-testi.log) |

Özet: doğrulandı 4, kısmi 2, açık 5

## A99 kabul senaryoları

| # | Sonuç | Kanıt |
|---|---|---|
| A99-01 | PASS | test 12 |
| A99-02 | PASS | test 12 (izleyici 403; rol kaybı Y01 test 9) |
| A99-03 | PASS | test 12 command_journal |
| A99-04 | PASS | test 13: yayım crash-window → ikinci sürüm yok; anahtarlı gerçek yayım tek sürüm + command_journal |
| A99-05 | PASS | test 13: dönem crash-window → duplicate dönem yok |
| A99-06 | PASS | test 12 (units kapsamı replay 403) |
| A99-07 | PASS | DB kısıtı result_check reddeder + gateway (test 12) |
| A99-08 | PASS | eşik 25, n=20 redakte (test 12) |
| A99-09 | PARTIAL | targets ve follow-up eşik bazlı; export yolu yok; attention slot sayar |
| A99-10 | PASS | migrasyon-varyant-testi.log: canonical 0005 → 0006/0007 |
| A99-11 | PASS | migrasyon-varyant-testi.log: alias event + 0006/0007 |
| A99-12 | PASS | migrasyon-varyant-testi.log: f8c7 varyantı (yeniden üretilen dosyanın SHA'sı alias ile birebir) → alias event + 0006/0007, veri korundu |
| A99-13 | PASS | migrasyon-varyant-testi.log: bilinmeyen hash HATA, defter ilerlemedi |
| A99-14 | PASS | migrasyon-varyant-testi.log: ikinci koşu değişiklik yok |
| A99-15 | BLOCKED | Docker yok |
| A99-16 | BLOCKED | Docker yok |
| A99-17 | PASS | demo-smoke D8 (önceki tur), launcher ayrı DB/çerez/posta |
| A99-18 | PASS | tur E1/E2 (final ZIP) |
| A99-19 | PASS | final ZIP: DB kapalı → /api/ready 503, index hazır demez; DB geri → kendiliğinden geçiş; ilk istek 200 (v02-v03-ui-sonuc.json). Bu turda bulunan hata: pg havuzu boşta bağlantı hatasında süreç düşüyordu → düzeltildi (pool error + BEGIN'de tek yeniden bağlanma) |
| A99-20 | PASS | textnorm testi + test 10 (metin değişimi → trend bilinmiyor, karar yoksa) |
| A99-21 | PASS | test 10 (equivalent kararı → trend bilinir) |
| A99-22 | PASS | test 10 (öncelik) + test 13 (takip: itemEquivalence changed, AUTO_VALID değil) |
| A99-23 | PARTIAL | bkz. v2.7.2 güncel durum: kurumsal motor API/DB/UI + 400 yaşam döngüsü (HTTP) ve tarayıcıdan 400 dağıtım PASS; tam kurumsal kabul dış bağımlılıklar nedeniyle PARTIAL |
| A99-24 | PARTIAL | bkz. v2.7.2 güncel durum: kurumsal motor API/DB/UI + 400 yaşam döngüsü (HTTP) ve tarayıcıdan 400 dağıtım PASS; tam kurumsal kabul dış bağımlılıklar nedeniyle PARTIAL |
| A99-25 | PARTIAL | bkz. v2.7.2 güncel durum: kurumsal motor API/DB/UI + 400 yaşam döngüsü (HTTP) ve tarayıcıdan 400 dağıtım PASS; tam kurumsal kabul dış bağımlılıklar nedeniyle PARTIAL |
| A99-26 | PARTIAL | bkz. v2.7.2 güncel durum: kurumsal motor API/DB/UI + 400 yaşam döngüsü (HTTP) ve tarayıcıdan 400 dağıtım PASS; tam kurumsal kabul dış bağımlılıklar nedeniyle PARTIAL |
| A99-27 | PARTIAL | bkz. v2.7.2 güncel durum: kurumsal motor API/DB/UI + 400 yaşam döngüsü (HTTP) ve tarayıcıdan 400 dağıtım PASS; tam kurumsal kabul dış bağımlılıklar nedeniyle PARTIAL |
| A99-28 | PARTIAL | bkz. v2.7.2 güncel durum: kurumsal motor API/DB/UI + 400 yaşam döngüsü (HTTP) ve tarayıcıdan 400 dağıtım PASS; tam kurumsal kabul dış bağımlılıklar nedeniyle PARTIAL |
| A99-29 | PARTIAL | bkz. v2.7.2 güncel durum: kurumsal motor API/DB/UI + 400 yaşam döngüsü (HTTP) ve tarayıcıdan 400 dağıtım PASS; tam kurumsal kabul dış bağımlılıklar nedeniyle PARTIAL |
| A99-30 | PARTIAL | bkz. v2.7.2 güncel durum: kurumsal motor API/DB/UI + 400 yaşam döngüsü (HTTP) ve tarayıcıdan 400 dağıtım PASS; tam kurumsal kabul dış bağımlılıklar nedeniyle PARTIAL |

Özet: PASS 19, PARTIAL 9, BLOCKED 2

## F99-01–F99-09

| # | Durum | Kanıt |
|---|---|---|
| F99-01 | doğrulandı | snooze: kaynak birim çözümü + requireUnitProfile + idempotencyResource + aynı transaction audit (correlation=komut anahtarı); aynı key/body iki kez → tek kayıt, aynı yanıt; izleyici 403 (v01-v28 test 12) |
| F99-02 | doğrulandı | genel çözüm: withContext komut anahtarı varsa AYNI transaction'da command_journal satırı yazar (bütün tenant yazma uçları); stale devralmada command_journal/audit izi → receipt_lost, iş yeniden yapılmaz. Test: panel birim oluşturma crash-window → ikinci birim yok; gerçek komut günlük yazıyor (test 12); soru seti yayımı ve dönem oluşturma için ayrı crash-window testleri (test 13) |
| F99-03 | doğrulandı | import commit makbuzu resource_scope=units + resource_unit_ids; replay bütün birimler için güncel yetki (kaybedilen kapsam → 403) (test 12) |
| F99-04 | doğrulandı | sonuç DTO redaksiyonu nihai karara bağlı (suppressed OR n<threshold); hedef listesi ve takip aynı eşik; DB kısıtı result_check n<5/suppressed=false satırını zaten reddediyor; eşik 25'e yükseltilmiş n=20 satırlar redakte (test 12). Export/attention sayı türetmiyor (dikkat slot sayar); çoklu rapor çıkarım koruması açık |
| F99-05 | kısmi | Dockerfile tsconfig.base.json kopyalıyor, çok aşamalı; compose ${VAR:?} zorunlu sırlar, init-roles.sh ile LOGIN servis hesabı, migrasyon sonrası grup üyeliği, healthcheck+service_healthy; DOCKER BU ORTAMDA YOK → temiz checkout build/up TEST EDİLMEDİ, hazır değil |
| F99-06 | doğrulandı | TESLIMAT notu build/sürüm yer tutucuları paketleme anında runtime build kimliğiyle doldurulur; 4f5d referansı yok; KAPANIS.json build alanı aynı kaynaktan |
| F99-07 | doğrulandı | normTxt src/textnorm.ts tek kaynak; fonksiyon testi test/textnorm.test.ts: "1,5 gün" ≠ "15 gün", "1,5" = "1.5", anlam değişimi eşit sayılmaz; entegrasyon testi (değişen metin → trend bilinmiyor) test 10 |
| F99-08 | doğrulandı | metodolog kararı: API + Soru seti sayfasında sürümlü karar formu (madde, iki sürüm, karar, HPW yöntem sürümü, gerekçe); karar öncelik ve takip yollarında geçerli (test 10). Karar listesi/geçmişi ekranı yok |
| F99-09 | superseded | yerine geçti (superseded): kurumsal akışlar gerçek API/DB/UI ile P2-12 |

## Z01–Z13

| # | Durum | Kanıt |
|---|---|---|
| Z01 | doğrulandı | 0005 kanonik yayımlanmış hâline geri alındı; M10/Y alanları ve eşdeğerlik kararı tablosu 0006'da; runner belgeli CHECKSUM_ALIASES ile ara sürümleri kabul edip defteri kanonik checksum'a çeker (olay kaydıyla). Test: demo DB (A varyantı) → 0006 uygulandı; f8c7 varyantı simülasyonu → alias kabul + 0006; temiz kurulum tur 51/51 |
| Z02 | doğrulandı | stale devralma yalnız aynı payload_hash ile (hash ezilmez); farklı gövde 409 idempotency_conflict; aynı gövde devralma [200,409] (v01-v28 test 9) |
| Z03 | doğrulandı | crash penceresi: komut anahtarı audit correlation_id ile izlenir; devralmada iz varsa 409 receipt_lost ve iş yeniden yapılmaz (test 11). Sınır: iş ve makbuz hâlâ ayrı transaction; transactional outbox yok |
| Z04 | doğrulandı | gizli satır DTO: value/n/assessment null, privacy politika etiketi; takip gizli kartında n yok; test 11. Çoklu rapor çıkarım koruması açık |
| Z05 | doğrulandı | accept/reject expectedVersion zorunlu; uyuşmazlık 409 version_changed + güncel taslak; UI sürüm gönderir ve listeyi yeniler (r01-r44 test 7, v01-v28 test 7, iki oturum 10/10) |
| Z06 | doğrulandı | normTxt sayı içindeki ondalığı korur (1,5 ≠ 15); sürümlü HPW eşdeğerlik kararı (item_equivalence_decision, POST /instruments/equivalence, yalnız şirket geneli HR_ADMIN, metodoloji sürümü ve gerekçe zorunlu) hem öncelik hem takip yolunda metin karşılaştırmasının önüne geçer; karar equivalent → trend bilinir, changed → bilinmiyor (v01-v28 test 10). Kararı yazan ekran yok; metodoloji onayı HPW tarafında |
| Z07 | açık | birincil erişim yolu kararı bekleniyor (HTTPS ortamları izin/hesap/masraf; Mac imzalama/notarization). Yayın yapılmadı |
| Z08 | kısmi | Dockerfile kaynaktan çok aşamalı derleme ve compose context/dockerfile yolu düzeltildi; Docker bu ortamda yok → temiz makine derleme testi yapılmadı |
| Z09 | kısmi | versiyon tekilleştirme: v2.6.3, paket adı build kimliği taşır, health/ready 2.6.3; önceki v2.6.2 arşivleri çıktıdan kaldırıldı |
| Z10 | kısmi | LINK_DUGME_ENVANTERI: kod kanıtlı satırlar (rol ekleme grant, taslak kabul/ret) API/tarayıcı testleriyle kapatıldı; ham JSON sadeleştirme ve klavye testi açık |
| Z11 | superseded | yerine geçti: kurumsal motor API/DB/UI (v2.6.7 build 4af4f417d7c8 → v2.7.0); bkz. v2.6.8/v2.6.9 denetimi bölümleri |
| Z12 | açık | SMTP/bounce, dosya güvenliği, retention/imha, backup-restore tatbikatı, yük testi açık |
| Z13 | doğrulandı | DB kesintisinde API süreci düşmüyor (pool error yakalama, BEGIN aşamasında tek yeniden bağlanma); 503 → toparlama; final ZIP üstünde tur 51/51 |

## Y01–Y06

| # | Durum | Kanıt |
|---|---|---|
| Y01 | doğrulandı | komut makbuzu kaynak/kapsam (unit|tenant + gerekli profiller) bütün yazma uçlarında; kapsamsız makbuz fail-closed (receipt_scope_missing); rol kapanınca aynı anahtar 403, makbuz silinmez, iş yeniden yapılmaz (v01-v28 test 9) |
| Y02 | doğrulandı | rezervasyon/devralma tek atomik INSERT…ON CONFLICT…WHERE süresi dolmuş RETURNING owner_token; yalnız sahip işleyiciye girer ve makbuzu yazar; eşzamanlı iki istek: [200,409], audit 1 (test 9). İş ve makbuz ayrı transaction: commit sonrası makbuz kaybı yeniden yürütmeye yol açabilir (bilinen sınır) |
| Y03 | doğrulandı | Hedefler ekranında pending_acceptance satırı: yeni öneri/sürüm, "taslağı kabul et" ve "gerekçeli reddet"; iki oturumlu tarayıcı testi 8/8 (y03-y04-iki-oturum-sonuc.json) |
| Y04 | doğrulandı | Takip ekranı NOT_COMMITTED ve UNDER_REVIEW kartları; undefined boolean "altında" sayılmaz; eski oturumda doğru kart (aynı test) |
| Y05 | doğrulandı | comparable_previous_result: önceki dönem yalnız madde metni+ölçek+puanlama kuralı eşdeğerse; değişen özel soruda trend bilinmiyor (test 10) |
| Y06 | kısmi | Dockerfile bu turda eklendi, compose pakette; Docker test edilmedi ve plan etiketli; build tek kaynaktan (runtime-manifest) |

## M01–M23

| # | Durum | Kanıt |
|---|---|---|
| M01 | açık | Mac ilk açılış doğrulanmadı; Apple Developer ID yok; .command Gatekeeper engeli çözülmedi (MAC_VE_HTTPS_TESLIM_PLANI.md) |
| M02 | açık | HTTPS ortamları yayınlanmadı; karar bekleniyor (alan adı/hesap/yayın izni). Dockerfile+compose artefaktı pakette, test edilmedi |
| M03 | doğrulandı | her yolda readiness + build + kalıcı kurulum kimliği (KURULUM_KIMLIGI, /api/ready install alanı); aynı build çalışırken hazırlık ve kimlik kontrolü (launch-bos-again.log) |
| M04 | doğrulandı | .env yalnız kalıcı sırlar; WEB_DIST/MIGRATIONS_DIR/MAIL_DIR/build her açılışta komut satırından; defterde previous_build; verili yükseltme demo dump ile (launch-demo.log). Geri dönüş tatbikatı yok |
| M05 | doğrulandı | PG_VERSION yokken dizin korunur ve durulur (launch-bos-M05-pgversion-yok.log: ONEMLI.txt silinmedi); initdb geçici dizin + atomik mv |
| M06 | doğrulandı | RESTORE_DEFTERI started/done + demo-manifest.txt tablo sayıları; yarım restore → durdurma (launch-demo-M06-yarim-restore.log); tam yükleme manifestle doğrulandı |
| M07 | kısmi | Node 22+/PG 16+ ve veri dizini sürüm uyumu kontrolü; kısa socket dizini ve tırnaklama (Linux). Boşluklu/Türkçe yol ve Mac denenmedi |
| M08 | kısmi | PID dosyası pid+başlangıç; durdurmada süreç args dist yolu ile doğrulanır; PID yeniden kullanımı yok sayılır. launchd/servis yaşam döngüsü yok |
| M09 | doğrulandı | onay anında birim/kapsam yetkisi (unitsAffected + requireUnitProfile); A kapsamlı HRBP B rol dosyasını onaylayamadı (v01-v28 test 7) |
| M10 | doğrulandı | tekrar yanıtından önce kaynağın güncel yetkisi (resource_unit_id + required_profiles) kontrol edilir; rol düşünce 403 (test 3) |
| M11 | doğrulandı | tamamlanmış komut kaydı silinmez (test 8: response_status 200 korunur); çökmüş rezervasyon 120 sn kirasıyla kurtarılır; iş+makbuz aynı transactionda değil (kısmi tasarım notu) — Y02 ile atomik sahiplenme eklendi |
| M12 | doğrulandı | pending_acceptance/approved_target NULL hedefe NOT_COMMITTED; gözlem ayrı; kabulden sonra değerlendirme (test 7) |
| M13 | doğrulandı | kapasiteye dahil durumlar tek liste (accepted/active/under_review/pending_acceptance); kabul ucu birim kilidi + limit (test 7) |
| M14 | doğrulandı | etki planı: değişen hücre / kaldırılan başlangıç hücresi / metrik sürümü → under_review + baseline_superseded + tarihçe; pending/under_review dahil (test 7/8) |
| M15 | doğrulandı | dikkat kuyruğu karşılanan plan slotunu sayar (test 8) |
| M16 | dış bağımlılık | HPW yöntem/indeks/benchmark onayı; kısmi ay ve kişi kapsamı metodoloji kararı |
| M17 | kısmi | yarı açık tarih aralığı ve tarihli reports_to; hiyerarşi grubu ayrımı ve tek vekâlet motoru açık |
| M18 | açık | çoklu rapor gizliliği yayın yoluna bağlanmadı |
| M19 | superseded | yerine geçti (superseded): kurumsal motor API+DB+UI v2.6.7–2.6.9 (P2-12, v2.6.8 denetimi bölümü) |
| M20 | açık | gerçek SMTP/bounce ve uzun toplu gönderim testi yok |
| M21 | açık | Fastify 4, SBOM, zip bombası, işçi izolasyonu, saklama, kurtarma tatbikatı |
| M22 | kısmi | KAPANIS.json tek kaynak; N kanıtları dolduruldu; KABUL_SONUCLARI 2.6.1 arşiv etiketli, 2.6.2 K/H eşlemesi eklendi; ancak commit/hash bağı yalnız final arşiv hash düzeyinde |
| M23 | kısmi | derin link, önizleme sıfırlama, taşma; ham JSON sadeleştirme ve klavye testi açık |

## V01–V28

| # | Durum | Kanıt |
|---|---|---|
| V01 | doğrulandı | başlatıcı env+build+kurulum kimliği (dist yolu/cwd ve pid) karşılaştırır; kendi eski sürümünü kontrollü durdurup yenisini açar; tanımadığı sürümde döngü yerine açık durdurma. Gerçek paket: launch-bos-eski-build-gecis.log |
| V02 | doğrulandı | /api/ready ayrı (DB, migrasyon defteri, definer); index ve başlatıcı yalnız ready+build ile geçer; DB kapalı → 503 ve okunur neden; tarayıcı: v02-v03-ui-sonuc.json |
| V03 | doğrulandı | nesil/istek kimliği, tek yönlendirme zamanlayıcısı, yeniden denemede appUrl/düğme/eski zamanlayıcı iptali, sonda zaman aşımı; tarayıcı: v02-v03-ui-sonuc.json |
| V04 | açık | Mac/Safari denenmedi; boşluklu/Türkçe karakterli klasör yolu, kapanıp açılma ve pencere kapatma yalnız Linux/Chromium |
| V05 | kısmi | her açılışta migrasyon (SHA-256 defter); CREATE DATABASE hatası ayrıştırılır; sırlar CALISTIRMA altında 0600; kurulum defteri; yarım initdb temizliği ve sır kapısı; yarım kurulumdan devam (env/defter kayıp) BOŞ ve DEMO paketlerinde koşuldu: initdb tekrar yok, demo verisi çift yüklenmedi (launch-*-yarim-kurulum-devam.log). Geri dönüş tatbikatı ve Mac yok |
| V06 | doğrulandı | transition/beyan/kanıt/hedef/inceleme kaynak bazlı; A-yönetici+B-izleyici B'de 403, DB etkisi yok (v01-v28 test 1) |
| V07 | doğrulandı | commit anında grantsRequired yeniden yetkilendirme; HR_ADMIN doğruladı HRBP onaylayamaz (test 6) |
| V08 | kısmi | şirket geneli yazma yalnız HR_ADMIN; inceleme makamı birim yetkisiyle; reports_to tarihli. Hiyerarşi grubu ayrımı ve vekâlet tek motoru tam değil |
| V09 | doğrulandı | outbox kimliği+tenant_id+davet; aynı e-posta iki şirkette ayrı; platform yalnız yetkili müşteri; parola bağlantıları test operatörü kutusu (test 2) |
| V10 | doğrulandı | anahtar aktör+yöntem+tam URL (önizleme≠kayıt), yetki parmak izi, rezervasyon; rol düşünce 403 (test 3) |
| V11 | doğrulandı | dönem yayını survey_cycle kilidi ([200,409]), hedef kapasitesi birim kilidi (3 eşzamanlı→2), eşzamanlı aynı anahtar tek iş (test 3). Aksiyon kapasitesi zaten kilitli; expected_version genel değil |
| V12 | doğrulandı | PATCH benchmark upsert, FULL_REPLACE tam yenileme; CLEAR = FULL_REPLACE + boş Benchmarklar (KILAVUZ ve README) (test 4) |
| V13 | kısmi | PATCH birleşik küme: kardeş gizlilik/dağılım/n reddi (test 4); indeks mutabakatı birleşik küme değerleriyle (uygulandı, hedefli test yok); resmî toplam taşıma/sürüm kuralı açık |
| V14 | doğrulandı | rebase → pending_acceptance, approved_target boşken accepted/active DB kısıtı, açık kabul ucu; yalnız değişen başlangıç hücresinin hedefi incelemeye (test r01-r44 7) |
| V15 | doğrulandı | takip onayı canlı aktif takip sonucu, hedef sürümü ve başlangıç kimliğiyle karşılaştırılır; değişmişse 409 (kod, e2e-8 canlı uyum) |
| V16 | doğrulandı | eventCount/fulfilledSlotCount/expectedSlotCount API ve ekranda ayrı; ek olay slot artırmaz (test 5) |
| V17 | doğrulandı | 0005: eski kayıtlar ritimden slota, aynı slotta yalnız en erken karşılar, türetilemeyen incelemeye, tekil indeks; demo verisinde yükseltme koşuldu |
| V18 | kısmi | plan slotları takvimden tek kaynak (pencereye giren her slot); kısmi dönem politikası HPW onayı bekler; kişi kapsamı yok |
| V19 | dış bağımlılık | HPW resmî ölçüm/indeks onayı |
| V20 | açık | çoklu rapor gizliliği API yayın planına bağlanmadı |
| V21 | superseded | yerine geçti (superseded): reorg/devir P1-11 |
| V22 | superseded | yerine geçti (superseded): Sorumluluk Haritası P1-8 |
| V23 | superseded | yerine geçti (superseded): bkz. P2-12 |
| V24 | kısmi | kira/DLQ var; uzun toplu gönderim ve gerçek teslimat testi yok |
| V25 | kısmi | genel bakış "kullanılabilir"≠"tamam"; dikkat derin linkleri seçili açar; yükleme önizlemesi bağlamda sıfırlanır, geç yanıt düşer; taşma sarması; ham JSON sadeleştirilmedi; klavye testi yok |
| V26 | açık | canlı güvenlik/veri yaşam döngüsü/bağımlılık bakımı |
| V27 | kısmi | sayılar tek JSON (KAPANIS.json) ile üretilir; envanter kapsamı tam doğrulanmış değil |
| V28 | kısmi | zip -y; Unicode ad kontrolü yapılmadı |

## N01–N36

| # | Durum | Kanıt |
|---|---|---|
| N01 | doğrulandı | launch-bos.log |
| N02 | kısmi | paketleme bağımlılık kapısı; paket kökünden derleme yok |
| N03 | doğrulandı | 404 prototip (launch-bos.log) |
| N04 | kısmi | ayrı host/çerez (demo-smoke D8); canlı çerez politikası açık |
| N05 | doğrulandı | V07 testi org rolü grant |
| N06 | doğrulandı | V06 |
| N07 | doğrulandı | V06/V08 kapsam dışı inceleme 403 |
| N08 | kısmi | takvim doğrulaması; CREATE valid_to yazımı açık |
| N09 | uygulandı/doğrulanmadı | users.ts upsert; hedefli test yok |
| N10 | uygulandı/doğrulanmadı | auth.ts hız sınırı; test yok |
| N11 | doğrulandı | V10 |
| N12 | kısmi | yayın+kapasite kilidi; expected_version genel değil |
| N13 | doğrulandı | V12 |
| N14 | kısmi | V13 kardeş çelişki |
| N15 | açık | açık |
| N16 | doğrulandı | yalnız etkilenen hedef (V14) |
| N17 | doğrulandı | V14 |
| N18 | uygulandı/doğrulanmadı | results.ts satır kontrolü; test yok |
| N19 | açık | açık |
| N20 | kısmi | yaprak kuralı; HPW mutabakatı yok |
| N21 | kısmi | ufuk/varsayımlar |
| N22 | kısmi | özel plan; tip eşlemesi yok |
| N23 | doğrulandı | E2E-7, test 5 |
| N24 | doğrulandı | E2E-7 |
| N25 | doğrulandı | V15 |
| N26 | kısmi | audit aynı transaction; upsert değerlendirme |
| N27 | kısmi | R-9 kira |
| N28 | kısmi | servis hesabı/PUBLIC EXECUTE iptali |
| N29 | açık | açık |
| N30 | kısmi | derin link (V25) |
| N31 | doğrulandı | tur E3–E5 |
| N32 | kısmi | runtime-manifest, KURULUM_DEFTERI |
| N33 | superseded | yerine geçti (superseded): ana aksiyon dağıtımı P2-12 |
| N34 | kısmi | KAPANIS.json |
| N35 | dış bağımlılık | HPW onayı |
| N36 | dış bağımlılık | pilot |

## R01–R44

| # | Durum | Kanıt |
|---|---|---|
| R01 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R02 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R03 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R04 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R05 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R06 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R07 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R08 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R09 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R10 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R11 | kısmi | bkz. R01-R44-kapanis-tablosu.md |
| R12 | kısmi | bkz. R01-R44-kapanis-tablosu.md |
| R13 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R14 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R15 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R16 | açık | bkz. R01-R44-kapanis-tablosu.md |
| R17 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R18 | açık | bkz. R01-R44-kapanis-tablosu.md |
| R19 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R20 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R21 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R22 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R23 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R24 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R25 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R26 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R27 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R28 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R29 | kısmi | bkz. R01-R44-kapanis-tablosu.md |
| R30 | açık | bkz. R01-R44-kapanis-tablosu.md |
| R31 | açık | bkz. R01-R44-kapanis-tablosu.md |
| R32 | kısmi | bkz. R01-R44-kapanis-tablosu.md |
| R33 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R34 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R35 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R36 | kısmi | bkz. R01-R44-kapanis-tablosu.md |
| R37 | kısmi | bkz. R01-R44-kapanis-tablosu.md |
| R38 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R39 | kısmi | bkz. R01-R44-kapanis-tablosu.md |
| R40 | kısmi | bkz. R01-R44-kapanis-tablosu.md |
| R41 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R42 | kısmi | bkz. R01-R44-kapanis-tablosu.md |
| R43 | doğrulandı | bkz. R01-R44-kapanis-tablosu.md |
| R44 | açık | bkz. R01-R44-kapanis-tablosu.md |
