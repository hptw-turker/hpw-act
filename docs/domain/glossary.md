# Sözlük (mimari bölüm 3'ten türetilmiştir; değişiklik mimari belgede yapılır)

v2.2 eklemeleri: **Kurumsal ambition** — yönetimin istediği şirket değeri; kota değildir. **Yerel hedef** — birimin kendi verisinden üretilen hedef. **Katkı tahmini** — yerel hedefin üst değere öngörülen katkısı; açıklama içindir, birim düzeyinde gösterilmez. **Uzlaştırma (TargetReconciliationRun)** — yerel önerilerin toplamı ile ambition'ın karşılaştırılması: SUPPORTED / GAP / INFEASIBLE. **Resmî toplama ağırlığı** — HPTW üst skor hesabındaki ağırlık; sonuç dosyasından gelir. **Şiddet / veri güveni / kontrol edilebilirlik / iş yükü** — önceliğin dört ayrı ekseni. **Anlamlı en küçük hareket** — altında hedef türü MAINTAIN olan eşik. **Gizlilik çıktı kapısı** — türetilmiş çıktıların birlikte denetlendiği nokta. **Kanıt seviyesi E0–E4** — riske göre seçilen kanıt gücü. **Atıf kanıtı derecesi A–D** — A deneysel, B güçlü yarı-deneysel, C zamansal ilişki (nedensellik kanıtlanmadı), D değerlendirilemez. **Katkı projeksiyonu** — türetilmiş; hedef değil. **Metrik sürümü** — hedefin bağlı olduğu ölçüm tanımı ve puanlama kuralı sürümü. **İfşa kararı** — her okuma isteğinde verilen ve kaydedilen gizlilik kararı. **Rol merkezli sahiplik** — sorumluluk organizasyonel rolde, kişi tarih aralıklı çözülür.

| Türkçe | İngilizce | Tanım |
|---|---|---|
| Hiyerarşi grubu | Hierarchy Group | Bir organizasyon görünümü (idari, fonksiyonel, coğrafi, İK kapsamı). Dönem başına biri roll-up hiyerarşisi olarak işaretlenir. |
| Organizasyon ilişkisi | OrgRelationship | İki birim arasında tipli, tarihli kenar: reports_to, functional_to, geographic_to, hr_scope, finance_scope, survey_reporting_scope, enables. |
| Sorumluluk haritası | Responsibility Map | Konu/kaldıraç → hesap veren birim + destekleyen birimler eşlemesi. "Vardiya planlaması → Operasyon Planlama Müd." |
| Etkilenen / hesap veren / destekleyen birim | Affected / Accountable / Enabling Unit | Sorunun görüldüğü birim, sonuçtan sorumlu birim, çözüm için gerekli destek birimi. |
| Reorg olayı, soy ağacı | ReorganizationEvent, OrgLineage | Birim yeniden adlandırma, taşıma, bölünme, birleşme, kapanma, açılma kaydı ve birimler arası "türedi" bağı. |
| Vekâlet | Delegation | Bir kişinin sorumluluklarının belirli süre ve kapsamda başka kişiye devri (izin, boşluk). |
| Ölçüm dönemi | Survey Cycle | Anket dalgası; sonuç, hedef ve karşılaştırma bağlamı. |
| Madde kataloğu (sürümlü) | Item Catalog | Anket maddeleri ve boyutları, ifade sürümleriyle; madde soy ağacı karşılaştırılabilirlik için tutulur. |
| Sonuç | Result | Birim × madde/boyut × dönem; n, yanıt oranı, baskılanmış bayrağı, roll-up kaynağı. |
| Odak alanı | Focus Area | Bir birim için çalışılmaya seçilen boyut. |
| Hedef | Target | Sayısal hedef skor + tarih + sahip + onay; ağın düğümü. |
| Hedef ilişkisi | TargetRelationship | Üst–alt hedef bağı: türü (miras, katkı, destek, yerel, ortak, istisna), katkı ağırlığı, gerekçe, onay. |
| Cascade / katkı motoru | Cascade & Contribution Engine | Üst hedefi alt birimlere ağırlıklı, baseline'a duyarlı ve fizibilite kontrollü dağıtan; alt hedefleri üste toplayan motor. |
| İstisna talebi | Exception Request | Alt birimin hedefi düşürme, erteleme veya muaf olma müzakeresi. |
| Hedef çatışması | Target Conflict | Aynı birimde ters yönlü kaldıraçlara bağlı iki aktif hedef. |
| Ana aksiyon / dağıtım / yerel uygulama | Master Action / Deployment / Local Execution | Merkezden açılan aksiyon, hangi birimlere dağıtıldığı ve her birimdeki bağımsız yürütme kaydı. |
| Aksiyon katkısı | ActionContribution | Aksiyon ↔ Hedef çoktan çoğa bağı ve ağırlığı. |
| Aksiyon katılımcısı | ActionParticipant | Aksiyonda kişinin/birimin rolü: accountable, responsible, contributor, verifier, enabler, informed. |
| Bağımlılık | Dependency | Aksiyonun başka aksiyona veya birime bağlı olması. |
| Sorun escalation'ı, sorun kümesi | Problem Escalation, Issue Cluster | "Kontrolüm dışında" ile merkeze taşınan sorun ve benzerlerinin otomatik kümelenmesi. |
| Kanıt gereksinimi | Evidence Requirement | Aksiyon açılırken şablondan gelen doğrulama kuralı: tür, seviye, beklenen adet/süre, kaynak. |
| Kanıt merdiveni | Evidence Ladder | Beyan → Yüklendi → Doğrulandı → Öncü KPI teyit → Sonuç teyit. |
| Kanıt güveni | Evidence Confidence | Kanıt setinin türü, doğrulaması ve anomali sinyallerinden türetilen Yüksek/Orta/Düşük. |
| Uygulama durumu / Etki durumu | Execution Status / Impact Status | Aksiyonun iki bağımsız ekseni. |
| Karşılaştırılabilirlik değerlendirmesi | Comparability Assessment | Baseline ile takip ölçümünün kıyaslanabilirlik derecesi ve doğrulama durumu. |
| Sonuç değerlendirme | Outcome | Hedefin yeni ölçümdeki başarısı, hareket sınıfı, dış faktörler ve karar. |
| Dikkat öğesi | Attention Item | Bir rolün karar vermesi gereken, durumu ve SLA'sı olan iş. |
| Kapasite göstergesi | Workload Index | Kişinin açık sahipliklerinden türetilen yük seviyesi. |
| Etkinlik bilgi tabanı | Effectiveness Knowledge Base | Aksiyon şablonu → gözlenen skor hareketi, başarı oranı, etkiye kadar süre (karşılaştırılabilir ölçümlerden). |
| Hedef kohortu | TargetCohort | Bir hedefin kurulduğu birim kümesi, dondurulmuş ağırlıklar ve baseline'lar; politikalar: BASELINE_FROZEN, CURRENT_ORG_DYNAMIC, LINEAGE_ADJUSTED. |
| Dağıtım koşusu | AllocationRun | Bir cascade hesabının algoritma sürümü, girdi özeti ve sonucuyla yeniden üretilebilir kaydı. |
| Sorumluluk tahsisi | ResponsibilityAllocation | Hedef/aksiyon üzerinde birimlerin rolü, payı ve karar yetkisi; skor matematiğinden ayrı. |
| Kaynak gereksinimi / taahhüdü | ResourceRequirement / ResourceCommitment | Aksiyonun istediği bütçe, kadro, tedarikçi, varlık; fiilen taahhüt edilen miktar ve onay durumu. |
| Süreç örneği | WorkflowInstance | Uzun ömürlü bir iş sürecinin (istisna müzakeresi, reorg devri, kanıt incelemesi) kalıcı durumu, adımları, zamanlayıcıları ve olayları. |
| Komut zarfı | Command Envelope | Her yazma isteğinin taşıdığı command_id, expected_version, correlation_id, causation_id, actor, acting_for. |
| Görev ayrımı | Separation of Duties | Aynı kişinin talep edip onaylamasını, yükleyip doğrulamasını engelleyen sert politika. |
| Politika karar noktası | Policy Decision Point | Rol, birim, ilişki türü, dönem, vekâlet ve nesne özniteliklerini birlikte değerlendiren yetkilendirme servisi (RBAC+ABAC). |
| Veri yaşam döngüsü | Data Lifecycle | Saklama politikası, yasal tutma, silme talebi, anonimleştirme işi, aktarım sicili. |
