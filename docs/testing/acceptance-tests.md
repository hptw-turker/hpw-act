# Kabul testleri (sürüm kapısı) — mimari bölüm 22


Aşağıdaki 54 test, büyük müşteri üretimine geçişin kapısıdır. Zorunlu geçiş kriteri olarak işaretlenenler (★) sağlanmadan kurumsal üretim vaadi verilmez; pilot için yalnızca Faz 0 sütunundakiler gerekir.

| Test | Senaryo | Beklenen sonuç | Faz |
|---|---|---|---|
| T-01 | 12 GMY, 35 müdürlük, 400 şube, 200 alt birim yüklenir | Graf ve kapsam doğru oluşur, düğüm kaybı yok | 0 |
| T-02 | Şirket istenen Güven 62→68 | Yerel öneriler ambition'dan bağımsız üretilir; resmî ağırlıklı projeksiyon istenenle karşılaştırılır (SUPPORTED/GAP/UNSUPPORTED); hiçbir öneri tavanı aşmaz; fark dağıtılmaz | 0 |
| T-03 ★ | İstenen değer üst senaryonun üstünde | Rastgele agresif hedef üretilmez; UNSUPPORTED ("mevcut planla desteklenmiyor"), üst senaryo ve seçenekler döner | 0 |
| T-04 | Baseline 44 ve 82 olan iki birim | Aynı hedef sayısı kopyalanmaz | 0 |
| T-05 ★ | Yeni açılan şube, baseline yok | Kohort politikası uygulanır, tanımsız aritmetik oluşmaz, birim aksiyon kapsamına girer | 0 |
| T-06 | n<5 birim | Sayısal skor arayüze ve API'ye sızmaz, aksiyon kapsamı devam eder | 0 |
| T-07 ★ | Aynı birim iki shared ilişkiyle aynı üst hedefe bağlanmaya çalışılır | Kanonik roll-up kısıtı reddeder | 0 |
| T-08 | Aksiyon üç hedefe katkı verir | Aksiyon bir kez yürütülür, üç katkı kaydı raporlanır | 0 |
| T-09 | Ortak hedefte Operasyon %40, Teknoloji %35, şube %25 | Paylar skor roll-up'ına karışmaz | 0 |
| T-10 | 400 şubeye ana aksiyon | 400 yerel uygulama oluşur, ana aksiyon durumu dağılımdır | 0 |
| T-11 | 20.000 yerel uygulama toplu dağıtımı | Asenkron iş SLO içinde biter, istek zaman aşımı yok | 2 |
| T-12 ★ | 50 yerel uygulama oluştuktan sonra worker çöker | Süreç yeniden başlayınca kalanlar devam eder, çift kayıt yok | 0 |
| T-13 | Outbox relay aynı olayı iki kez yollar | İş etkisi bir kez uygulanır | 0 |
| T-14 ★ | İki HRBP aynı hedefin 11. sürümünü değiştirir | Biri başarılı, diğeri 409 alır ve değişen alanları görür | 0 |
| T-15 | İstisna onaylanırken üst hedef değişir | Süreç eski sürümü fark eder, fizibiliteyi yeniden ister | 1 |
| T-16 | 40 şube reorg ile yeni bölgeye geçer | Tarihçe eski yapıyı korur, güncel kapsam doğru güncellenir | 0 |
| T-17 | Bölünmüş birimde yanıt düzeyi veri yok | Türetilmiş baseline işaretlenir, karşılaştırılabilirlik düşer | 2 |
| T-18 ★ | Yönetici ayrılırken 17 hedef ve 31 aksiyon açık | Tümü sahipsiz iş kuyruğuna düşer, hiçbir iş kaybolmaz | 1 |
| T-19 | Vekâlet süresi kanıt incelemesi sırasında biter | Yeni karar aktif yetkiliye gider, eski vekil karar veremez | 1 |
| T-20 ★ | Sahip kritik kanıtta doğrulayıcı olmaya çalışır | Politika reddeder | 1 |
| T-21 | Bağımlılık Teknoloji tarafından bloke | Escalation şube sahibine değil bağımlılık sahibine gider | 1 |
| T-22 | Aynı PDF 14 ilişkisiz aksiyonda yüklenir | Hash anomalisi üretir, otomatik sahte ilan edilmez, inceleme kuyruğuna düşer | 2 |
| T-23 | Sahip "200 katılımcı" der, LMS 83 gösterir | Düşük güven, insan incelemesi | 2 |
| T-24 | Sekiz toplantı beklenir, yedi doğrulanır | partially_verified, completed olmaz | 0 |
| T-25 | "Tamamlandı" düğmesi, kanıt yok | evidence_pending, verified olmaz | 0 |
| T-26 | Uygulama doğrulandı, takip skoru düştü | Uygulama = verified ve etki = deterioration aynı anda gösterilir | 2 |
| T-27 | Aksiyon yapılmadı, skor yükseldi | İyileşme gösterilir, aksiyona başarı atfedilmez | 2 |
| T-28 ★ | Takip n 650→41 | Karşılaştırılabilirlik `review_required`; geçerli metodolog onayı yokken status PENDING_REVIEW ve attainment NOT_EVALUATED (gözlem `observed_above_target` ayrı); onay aynı sonuç revizyonu ve karşılaştırılabilirlik sürümünü referans göstermezse geçersiz | 2 |
| T-29 | Anket maddesi materially changed | not_comparable veya metodolog incelemesi | 2 |
| T-30 ★ | Çevrimdışı/gecikmiş check-in, merkez aksiyonu bu sırada iptal etmiş | Anlamsal çatışma ekranı, sessiz üzerine yazma yok | 1 |
| T-31 | Aynı komut iki kez gönderilir | command_id ile tek check-in | 0 |
| T-32 ★ | Tenant A 200 bin bildirimlik toplu iş başlatır | Tenant B etkileşimli p95 kabul sınırında kalır | 2 |
| T-33 ★ | PostgreSQL birincil aniden kapanır | Failover RTO/RPO içinde gerçekleşir | 2 |
| T-34 | Kuyruk düğümü düşer | Mesaj kaybolmaz, worker işlemleri devam eder | 2 |
| T-35 | Raporlama projeksiyonu 20 dk durur | Çekirdek yazma devam eder, arayüz tazelik uyarısı gösterir | 2 |
| T-36 | LMS bağlayıcısı 6 saat kapalı | Kanıt işleri retry/DLQ'da kalır, çekirdek bloke olmaz | 2 |
| T-37 ★ | HRIS aynı reorg olayını üç kez yollar | Reorg bir kez uygulanır | 0 |
| T-38 | SCIM yönetici deprovision gelir | Oturum kapanır, sahiplik devri süreci başlar, kişi silinmez | 1 |
| T-39 | Bütçe 2 milyon talep, taahhüt 1,35 milyon | 650 bin açık ve aksiyon risk durumu görünür | 1 |
| T-40 ★ | Saklama süresi dolmuş kanıt, yasal tutma yok | Politikaya göre silme/imha süreci işler ve kayıt tutulur | 2 |
| T-41 | Saklama süresi dolmuş kanıtta yasal tutma var | Silme durur, tutma audit edilir | 2 |
| T-42 | Türkçe "İnsan / ı / I / i" araması | Doğru collation ve büyük/küçük harf sonucu | 0 |
| T-43 | Türkiye ve MENA hafta sonları farklı | Termin ve escalation doğru çalışma gününe göre hesaplanır | 2 |
| T-44 | AI servisi tamamen kapalı | Hedef/aksiyon yönetimi çalışır, deterministik geri dönüş | 3 |
| T-45 | 3.000 eşzamanlı kullanıcı ilk 15 dakikada giriş yapar | p95/p99 ve hata oranı SLO içinde | 2 |
| T-46 | 1 milyon Result içe alınır | Toplu iş atomik ve yeniden başlatılabilir, çift sonuç yok | 0 |
| T-47 ★ | Kullanıcı başka tenant kimliğiyle nesne okumayı dener | Politika ve RLS reddeder | 0 |
| T-48 | Uygulama veritabanı rolüne yanlışlıkla BYPASSRLS verilir | Dağıtım güvenlik testi başarısız olur | 1 |
| T-49 | Üst hedef düşürülür, alt hedefler önceden onaylı | Alt hedefler sessizce değiştirilmez, yeni öneri süreci açılır | 1 |
| T-50 ★ | Üst hedef yükseltilir ama kalan alan yok | Fizibilite alarmı ve ulaşılabilir en yüksek değer üretilir | 0 |
| T-51 | 73 şube aynı konuyu "kontrolüm dışında" ile eskale eder | Tek IssueCluster oluşur, kurumsal aksiyon önerisi merkezi HR'a gider, 73 yerel taslak kapatılır | 2 |
| T-52 | Satış hacmi ↑ ve iş yükü ↓ hedefleri aynı birimde aktif | TargetConflict tespit edilir, ortak üst yöneticiye dikkat öğesi, çözümsüzse iki hedef riskte | 2 |
| T-53 | Şube müdürü "bana uygun değil / bütçe gerekiyor" seçer | ResourceRequirement açılır, alternatif aksiyon önerilir, boş form gösterilmez | 1 |
| T-54 | CEO'nun dikkat öğesi SLA'sı aşılır | attention_item_sla_breach metriği artar, HR Admin'e yükseltilir | 1 |

Zorunlu geçiş kriteri: T-03, T-05, T-07, T-12, T-14, T-18, T-20, T-28, T-30, T-32, T-33, T-37, T-40, T-47, T-50. Bu setin bütünü aynı dönem içinde, aynı Atlas veri setiyle koşulur; şu olay zinciri tek testte birleştirilir: bir yönetici hedefi düzenlerken HRIS reorg mesajı gelir, HRBP toplu yeniden atama yapar, zamanlayıcı gecikme escalation'ı üretir, worker yeniden başlar ve aynı mesajı ikinci kez teslim eder, kullanıcı eski ekrandan önceki sürümü kaydetmeye çalışır — sonuçta hiçbir hedef kaybolmaz, iki aktif sahip oluşmaz, hiçbir bildirim iki escalation yaratmaz.

---



## v2.2 eklemeleri (zorunlu)
| Kod | Senaryo | Beklenen |
|---|---|---|
| T-55 | Aynı sorun, n=6 ve n=40 | Şiddet aynı; düşük güvende karar 'doğrulama gerekli', sayısal hedef yok. Kontrol düşükse sahip hesap veren birim; yük doluysa alternatif sahip önerisi, sorun kaybolmaz |
| T-56 | Ambition 66 → 69 aynı kohort | Yerel öneriler değişmez; durum GAP; esnetme seçeneği tavan içinde; hiçbir hedef otomatik yükselmez |
| T-57 | Sonuç dosyasında resmî ağırlıklar | HPW Act üst skoru = HPTW rapor üst skoru (±0,05) |
| T-58 | n=4 ekip | Skor, hedef, fark, katkı, sıra, kıyas açığı, sayısal açıklama hiçbir API'de dönmez; yalnız üst birim önceliği kalıbı |
| T-59 | Üst görünür, 3 alt birimden 1'i gizli | En küçük görünen alt birim de gizlenir; iki filtre farkıyla çıkarım yapılamaz |
| T-60 | Düşük riskli rutin iş / 400 şubeye yayılan hedefe bağlı iş / önceki anomalili sahip | E0 / en az E1 / bir basamak yukarı; seviye kabulde donar |
| T-61 | Önce/sonra yüksek karşılaştırılabilirlik / eşleştirilmiş kıyas / karşılaştırılamaz | C / B (tahmini etki = fark-içinde-fark) / D ve NOT_EVALUATED |
| T-62 | Çalışan hesabına hedef veya aksiyon atama denemesi | Politika reddeder; sahip yönetici olmalı |
| T-64 | İki filtre sorgusunun farkı tek gizli birim | İkinci sorgu bastırılır; ifşa kararı kaydedilir; export aynı sonucu verir |
| T-65 | Aynı boyutta iki metrik sürümü (Q7 v2 → v3) | Hedef metric_version'a bağlı; sürüm değişince eski hedef etiketi bozulmaz, yeni karşılaştırma kapıdan geçer |
| T-66 | Sahip rolündeki kişi ayrılır | Yerel hedef ve aksiyonlar rolde kalır (vacant); kuyruğa düşer; audit'te kişi referansı korunur |
| T-67 | 4. aksiyon açma denemesi | Politika reddeder; merkezi destek/alternatif sahip önerisi; 3. yerel hedef izleme listesinde kalır |
| T-68 | Stratejik önem 0 ve 1 | Şiddet ve karar aynı; yalnız sıralama değişir |
| T-69 | C derecesi sonuç | `estimated_effect` boş, `observed_change` dolu; arayüz "zamansal ilişki var; nedensellik kanıtlanmadı" der |
| T-63 | 400 şube gölge çalıştırma | Kullanıcısız üretilen hedef/sahip/öncelik seti uzman değerlendirmesinden geçer; sapma oranları raporlanır |

## Uygulama notu
Her T-xx için `docs/testing/gherkin/*.feature` içinde en az bir senaryo veya `apps/api/test/acceptance/T-xx.spec.ts` bulunur. PR açıklaması kapsanan T-xx'leri listeler; CI etiketle filtreler (`--grep T-14`).


## Karşı örnek seti (v2.3.1 — inceleme raporu A01–A22; `packages/domain-core/test/karsi-ornekler.test.ts`, `privacy-risk.test.ts`, `allocate.test.ts`, `comparability.test.ts`)

Bu testler düzeltmeden önce kırmızı, sonra yeşildir; sürüm kapısının parçasıdır.

| Karşı örnek | Beklenen doğru davranış | Test |
|---|---|---|
| A01 gizli birim için yorum talebi | DENY (`suppressed_unit`); yorum eşiği 10 ayrı | privacy-risk A01/A02/A03 |
| A02 n=4, bayrak false | DENY: gizlilik n'den hesaplanır | privacy-risk |
| A03 bilinmeyen birim / görüntüleyen | DENY (`unknown_unit` / `unknown_viewer`) | privacy-risk |
| A04 üç örtüşen toplam | Önceden tanımlı rapor hücrelerinde tamamlayıcı baskılama; gizli değer çözülemez | privacy-risk A04 |
| A05 gizli birime sayısal öneri | Dış DTO `priority_only`, sayısal alan yok; aritmetiğe girer, esnetme listesine girmez | allocate A05 / T-58 |
| A06 review_required → ACHIEVED | PENDING_REVIEW / NOT_EVALUATED; onaylı ve sürümü eşleşen incelemeyle EVALUATED; eski onay geçersiz | comparability T-28 |
| A07 negatif akran verisi bant tabanına çevrildi | Kaynak `methodologist_band`, akran gözlemi ayrı saklanır | allocate A07 |
| A08 negatif ağırlık | `invalid_weight` hatası | allocate A08–A11 |
| A09 boş küme | `empty_set` hatası (ölçümsüz) | allocate |
| A10 sıfır ağırlıkla esnetmede NaN | Sıfır ağırlık gerekçeyle dışlanır; bütün sayılar sonlu | allocate |
| A11 onaylı istisna 110 | `out_of_scale` hatası | allocate |
| A12 katkı yuvarlama | Tam hassasiyetle toplanır; yuvarlama gösterimde | allocate A12 |
| A13/A14 E3–E4 sistem iziyle auto | E3 her zaman human_review, E4 her zaman sample_audit | privacy-risk |
| A15 aynı gerçekleşmenin sekiz kopyası | Tek gerçekleşme; 7 `duplicate_occurrence` | karsi-ornekler A15 |
| A16 tarihsiz belge | `undated`, kapsamaya girmez | karsi-ornekler A16 |
| A17 eski dönem metriği | `stale_metric` | karsi-ornekler A17 |
| A18 sonuç verisi uygulama kanıtı | `outcome_not_execution` | karsi-ornekler A18 |
| A19 E0 yolu bileşimi | Entegrasyon sözleşmesi: geçerlilik → politika → yol; E0 "beyanla karşılandı" bağımsız doğrulama değil | Evidence.tsx + ADR-0035 |
| A20 sıfır yanıtla sayısal hedef | Uygunluk kapısı: n<5 → `validation_required`; güven 0 | karsi-ornekler A20 |
| A21 çakışan eşzamanlı vekiller | `assignment_conflict` hatası; DB EXCLUDE kısıtı | karsi-ornekler A21 |
| A22 zaman dilimi metin kıyası | UTC anıyla kıyas; geçersiz damga hata | karsi-ornekler A22 |
| Acil vaka | Üç aksiyon sınırına takılmaz | karsi-ornekler |
| Dikkat kapatma | Okundu yalnız bilgi; ertele/yönlendir yükümlülüğü bitirmez; muafiyet gerekçe+yetki | karsi-ornekler |
| Durum eksenleri | Geçersizleşen kanıt işi yeniden açar, tarihçe silinmez | karsi-ornekler |

Bu ortamda koşulamayanlar (G1 kapısı): gerçek PostgreSQL'de RLS/kısıt/eşzamanlılık saldırı testi; izinli gerçek HPTW sonuç dosyasıyla resmî üst skor mutabakatı (T-57'nin gerçek fixture'ı); canlı pilot ölçümleri.

## v2.4 — enstrüman ve madde düzeyi (`packages/domain-core/test/instrument.test.ts`)

| Test | Senaryo | Beklenen | Faz |
|---|---|---|---|
| T-70 | Sonuç paketi yüklenir | manifest + instrument + results_item çözümlenir; Top Box dağılımdan yeniden hesaplanır ve verilenle eşleşir | 0 |
| T-71 | Şirket Dijital Dönüşüm boyutunu çıkardı, 2 özel madde ekledi | Algılama: çıkarılan boyut, özel maddeler, modül sayıları, ölçekler; çekirdek tam | 0 |
| T-72 | results_index.csv resmî WBI | Madde ortalamasıyla ≤0,15 eşleşir; sahte değer yakalanır ve yayım engellenir | 0 |
| T-73 | Geçersiz paket | n<5 birim sayı taşımaz; bilinmeyen madde, dağılım/n uyuşmazlığı, Top Box uyuşmazlığı, geçersiz ölçek reddedilir | 0 |
| T-74 | Panel türetme | Çıkarılan boyutun paneli yok; özel madde ve NPS paneli var; NPS maddesi yoksa NPS paneli yok | 0 |
| T-75 | Boyut/indeks metriğine hedef | `not_item_level` hatası | 0 |
| T-76 | Gurur boyutunun üç maddesi | GUR-01 birim yöneticisi > GUR-03 kariyer sistemi > GUR-04 işveren markası kontrol edilebilirliği; Bağlılık maddesi hedeflenemez; ISG-04 operasyon planlama | 0 |
