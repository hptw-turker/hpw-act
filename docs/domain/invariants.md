# Değişmezler (invariants) — kod incelemesinde kontrol listesi

Her PR'da aşağıdakiler ihlal edilmiyor mu diye bakılır. İhlal = ret.

## Organizasyon
- I-01 Bir SurveyCycle için tam olarak bir HierarchyGroup `is_rollup` işaretlidir. Sonuç toplama, baseline ve inherited katkı yalnız bu grupta hesaplanır.
- I-02 OrgUnit ve OrgRelationship effective-dated'dir; hiçbir kayıt silinmez, `effective_to` ile kapanır.
- I-03 Her yapısal değişiklik bir ReorganizationEvent'tir; olay kimliği ile tekilleştirilir (T-37). Reorg uygulaması bir WorkflowInstance'tır, öğe bazında durum tutar (T-16).
- I-04 Person hiçbir zaman silinmez; deprovision → inactive → sahipsiz iş kuyruğu (T-18, T-38).

## Ölçüm ve gizlilik
- I-05 `n < confidentiality_threshold` → `suppressed = true`, `normalized_score` istemciye NULL; değer sunucuda kalır ve roll-up/kohorta girer (T-06).
- I-06 Ham skor kaybolmaz: `raw_score`, `scale_min/max`, `metric_type`, `normalized_score` birlikte saklanır.
- I-07 Madde ifadesi/ölçeği değişirse yeni ItemVersion; `equivalence_to_previous` boş bırakılamaz.

## Hedef ağı
- I-08 Her Target bir TargetCohort'a bağlıdır; kohort `frozen_at` sonrası değişmez (yeni politika → yeni kohort sürümü).
- I-09 `inclusion_state = no_baseline` üyeler hiçbir aritmetiğe girmez; `priority_only` hedef alır (T-05).
- I-10 Bir (parent_target, child_unit) için aktif inherited/shared/exception kenarı en fazla birdir — partial unique index (T-07).
- I-11 ResponsibilityAllocation payları allocation/roll-up fonksiyonlarına parametre olarak bile geçmez (T-09).
- I-12 Her allocation çağrısı AllocationRun yazar; aynı `input_snapshot_hash` + `algorithm_version` aynı sonucu üretir (deterministik, rastgelelik yok).
- I-13 Allocation asla `hi_i` tavanını aşan öneri üretmez; fizibil değilse INFEASIBLE döner (T-03, T-50).
- I-14 Onaylı alt hedef sistem tarafından sessizce değiştirilmez; yalnız öneri + dikkat öğesi (T-49).
- I-15 ExceptionRequest: `requested_by ≠ approver` (SoD).

## Aksiyon
- I-16 `kind = master` aksiyonun kendi `execution_status`u yoktur; dağılım hesaplanır. `local_execution` her zaman `parent_action_id` taşır.
- I-17 Action ↔ Target yalnız ActionContribution ile; aksiyon başına ağırlık toplamı ≤ 1.
- I-18 Dependency grafında döngü yoktur (kayıt anında kontrol).
- I-19 "Tamamlandı" komutu execution_status'ü yalnız `evidence_pending` yapar; `verified` yalnız doğrulama sonucu ile (T-25).
- I-20 `execution_status` ve `impact_status` aynı DTO'da ayrı alanlardır; birleşik yüzde alanı yasaktır (T-26, T-27).

## Kanıt
- I-21 EvidenceRequirement aksiyon kabulünde sürüm kilitlenir; şablon değişikliği yürüyen aksiyonu etkilemez.
- I-22 Anomali → `review_required`; sistem `rejected` yazamaz, yalnız insan (T-22, T-23).
- I-23 Kritik kanıt türlerinde `verifier ≠ submitted_by` ve `verifier` submitted_by için vekil değil (T-20).
- I-24 Hash tekrarı yalnız ilişkisiz aksiyonlar arasında sinyaldir; aynı master'ın yerel uygulamaları arasında değil.

## Yeniden ölçüm
- I-25 Outcome yazılmadan önce ComparabilityAssessment yazılır; `not_comparable` → `attainment = NOT_EVALUATED` (T-28, T-29).
- I-26 Outcome hiçbir alanında nedensellik ifadesi taşımaz (`causal_claim = false` sabittir); rapor metinleri "değişim gözlendi" kalıbını kullanır.

## Eşzamanlılık ve olaylar
- I-27 Her yazma komutu command_id ve expected_version taşır; uyuşmazlık 409 (T-14). Aynı command_id → aynı yanıt, tek iş etkisi (T-31).
- I-28 Yazma ve outbox aynı transaction'dadır; tüketici event_id ile tekilleştirir (T-13).
- I-29 Süreç adımları idempotent; yeniden başlatma çift kayıt üretmez (T-12).
- I-30 Bildirim anahtarı (kural + nesne + koşul + gün) benzersizdir; aynı koşul iki escalation üretmez.

## v2.2 semantik kilit
- I-35 PriorityAssessment dört ayrı eksen taşır; güven şiddeti hiçbir hesapta çarpmaz, iş yükü şiddetten çıkarılmaz, kontrol edilebilirlik sahibi belirler (T-55).
- I-36 Yerel hedef önerisi ambition'dan bağımsız üretilir; aynı kohort için ambition değişince yerel öneriler değişmez (T-56).
- I-37 Uzlaştırma farkı sessizce dağıtmaz: GAP durumunda esnetme yalnız seçenek olarak kaydedilir; uygulanması TargetReconciliationRun.decision ile açıkça kararlaştırılır.
- I-38 Kohort ağırlığı result.aggregation_weight'tir; HPW Act'ın üst skoru HPTW raporundaki üst skora tolerans içinde eşittir (T-57).
- I-39 Gizli birim hiçbir sayısal türetilmiş çıktı (skor, başlangıç, hedef, fark, katkı, sıra, kıyas açığı, sayısal açıklama) üretmez; ikincil baskılama üst toplam çıkarımını engeller (T-58, T-59).
- I-40 Katkı tahmini birim kapsamındaki görünümde gösterilmez.
- I-41 Fizibil artış anlamlı en küçük hareketin altındaysa hedef türü MAINTAIN'dir; sahte hassasiyet üretilmez.
- I-42 Kanıt seviyesi riskten seçilir ve kabulde dondurulur; sayısal hedefe bağlı ve birden çok birime yayılan aksiyon E0 olamaz (T-60).
- I-43 Outcome.causal_evidence_grade zorunludur; causal_claim şemada false; etkinlik istatistiği yalnız C ve üstünden öğrenir (T-61).
- I-44 Çalışan hiçbir hedef, aksiyon ya da kanıt sahipliğine giremez; sahip her zaman yöneticidir (T-62).
- I-45 Politika sınırı içindeki hedefler toplu onaya uygundur; şube müdürünün kabulü açık adım olarak kalır.

## v2.3 kanonik eklemeleri
- I-46 Hedef, sonuç ve öncelik `metric_version`'a bağlıdır; `dimension` metni bağ değildir (T-65).
- I-47 Ambition, yerel hedef ve katkı projeksiyonu ayrı tablolardır; ambition `proposeLocal`'a girdi olmaz; katkı projeksiyonu türetilmiş ve değiştirilemez, birim kapsamında gösterilmez.
- I-48 Şiddet çalışan sinyalidir; stratejik önem şiddeti ve kararı değiştirmez, yalnız sıralamayı etkiler (T-68).
- I-49 Sahip her zaman bir organizasyonel roldür; kişi effective-dated çözülür; ayrılışta iş taşınmaz, rol boşalır (T-66).
- I-50 Her okuma isteği ifşa kararından geçer ve kaydedilir; iki sorgunun farkından gizli birim çıkarılamaz; export aynı yoldur; ham gizli sayı istemciye gitmez (T-64).
- I-51 Atıf derecesi C yalnız zamansal ilişkidir; `estimated_effect` yalnız A/B'de dolar; C'de `observed_change` (T-69).
- I-52 Kanıt seviyesi kuraldan seçilir; risk puanı seviye belirlemez; sistem izi varsa dosya istenmez; E4 denetim sınıfıdır (T-60).
- I-53 Yerel yönetici için en fazla 2 aktif yerel hedef ve 3 aktif aksiyon; aşım yalnız istisna yoluyla (T-67).
- I-54 Veri güveni kullanıcıya yüzde olarak gösterilmez; gözlemsel etkinlik aksiyon sıralamasında ilk kriter olamaz.
- I-55 Arayüzde yasaklı terimler kullanılmaz (docs/design/terminoloji-sozlugu.md); tarama sürüm kapısıdır.
- I-56 Projeksiyon (dondurulmuş kohort, resmî ağırlık) ile takip döneminde gözlenen üst sonuç aynı alanda tutulmaz.

## Yetki ve veri
- I-31 Politika kararı yalnız `packages/policy` üzerinden; controller'da rol kontrolü yok. Tenant dışı okuma politika + RLS ile reddedilir (T-47).
- I-32 Uygulama DB rolü tablo sahibi değil, NOBYPASSRLS; her tablo FORCE RLS (T-48).
- I-33 AuditEvent kişisel veri içermez (yalnız referans); silme referansı anonim kimliğe çevirir, kaydı silmez.
- I-34 Saklama süresi dolmuş veri LegalHold yoksa imha süreciyle silinir/anonimleştirilir ve imha kaydı tutulur (T-40, T-41).

## v2.3.1 — karar çekirdeği (inceleme raporu A01–A22)
- I-40 Gizlilik kararı varsayılan RET: bilinmeyen birim/metrik/dönem/görüntüleyen ve yetersiz yanıt reddedilir; gizlilik n'den hesaplanır, bayrak yalnız daha kısıtlayıcı olabilir; skor (5) ve yorum (10) eşikleri ayrı; export sayısal çıktıdır (ADR-0034).
- I-41 İç toplama nesnesi ile dış DTO farklı tiplerdir; `priority_only` sayısal alan taşımaz; API, export, bildirim ve açıklama aynı dış DTO'dan üretilir.
- I-42 Bütün sayılar sonlu; ağırlık ≥ 0; sıfır ağırlık açıkça dışlanır; boş küme ölçümsüz durum; hedef, istisna ve onay değerleri metrik ölçeği içinde; katkı tam hassasiyetle toplanır, yuvarlama gösterimde.
- I-43 Akran verisi politika bandı dışına çıkarsa öneri banttan gelir ve kaynak `methodologist_band`; gözlem `peer_observation` alanında ayrı; arayüz gözlemi karar dayanağı gibi göstermez.
- I-44 `review_required` + geçerli onay yok → PENDING_REVIEW / NOT_EVALUATED; onay aynı sonuç revizyonu ve karşılaştırılabilirlik sürümünü referans gösterir; düzeltme eski onayı geçersizleştirir. A/B atıf yalnız kayıtlı tasarım + karşılaştırma grubu + inceleme ile; C/D'de tahmini etki yok (ADR-0035).
- I-45 Kanıtta sıra: geçerlilik (tür, kapsam, tarih penceresi, tekil gerçekleşme, eski dönem, sonuç≠uygulama) → E0–E4 politikası → inceleme önceliği/güven. E3 her zaman insan, E4 her zaman örneklem; sistem izi bağımsız kontrolü kaldırmaz. Dosya hash'i tek başına olay tanımlamaz.
- I-46 Dört durum ekseni (yaşam döngüsü, doğrulama, sağlık, sonuç) ayrı alanlardır; `declared_complete` doğrulanmış gerçek değildir; geçersizleşen kanıt işi yeniden açar, tarihçe silinmez (ADR-0036).
- I-47 Yanıt sayısı eşik altındaysa sayısal hedef kararı verilmez (`validation_required`); güven bileşenleri sıfır yanıtı telafi etmez.
- I-48 Rol çözümü UTC anıyla; aynı rol ve türde eşzamanlı iki atama çakışmadır (kod hatası + DB EXCLUDE).
- I-49 Her yerel hedef iki rol taşır: sonucu izleyen rol ve müdahaleye yetkili rol; merkezi kaldıraçta çözümün hesap vereni değişmez (ADR-0037).
- I-50 Dikkat öğesini listeden çıkarmak yükümlülüğü bitirmez; okundu/ertele/yönlendir/çöz/muafiyet ayrı anlam taşır. Acil güvenlik/taciz bildirimi yük sınırına takılmaz, kurumsal sürece yönlenir.
- I-51 Sonuç verisi taslakta doğrulanır ve tek geçişle yayımlanır; düzeltme eski gözlemi silmez (revizyon); yerel uygulama kabul ettiği ana aksiyon sürümüne bağlı kalır; periyodik iş gerçekleşme penceresiyle izlenir (ADR-0033).
- I-52 Tek sözlük: SQL enum'ları = domain tipleri = API şemaları (`ReconciliationStatus`, `ProposalSource`, dört eksen, `DisclosureDecision.reason`); kontrol kelime taramasıyla değil sözleşme testiyle yapılır.

## v2.4 — madde düzeyi takip ve enstrüman
- I-53 Takip birimi maddedir: öncelik, yerel hedef, aksiyon, kanıt ve sonuç yalnız `item` metriğine bağlanır; boyut ve indeks türetilmiş görünüm/projeksiyondur (ADR-0039).
- I-54 Enstrüman sürümlüdür ve paketten algılanır; şirket boyut çıkarabilir, madde ekleyebilir; sertifikasyon çekirdeği (15 madde) eksikse uyarı, yayım kararı metodolojide (ADR-0040).
- I-55 Top Box dağılımdan yeniden hesaplanır; verilenle çelişen paket reddedilir; resmî indeks madde ortalamasıyla 0,15 içinde eşleşmeden yayım yok; gizli birim pakette bile sayı taşımaz.
- I-56 Her madde etkileşim alanı ve sorumluluk merkezi taşır; müdahaleye yetkili rol ve kontrol edilebilirlik buradan gelir; `outcome` ve `individual` maddelerine hedef bağlanmaz (ADR-0041).
- I-57 Paneller enstrümandan türetilir: olmayan boyutun paneli yoktur; özel maddeler benchmark'sız ayrı paneldedir; boyut özeti "yayılımı gizler" notuyla verilir.
