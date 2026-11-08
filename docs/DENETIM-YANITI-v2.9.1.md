# HPW Act v2.9.1 — Bağımsız v2.9.0 denetimine yanıt

Yanıtlanan: "HPW Act v2.9.0 — Bağımsız yeniden denetim" (27.09.2026, build 119ebdc06f49) ve "v2.9.0 düzeltme görevi". Referans ZIP SHA-256 `b13871fc5a2f49b2269b6854af8d6ccafdf125cfa143171440c2155af3146a21` bağımsız olarak doğrulandı.
Teslim: `HPW_Act_TESLIMAT_v2.9.1_4857cd642157.zip` (SHA-256 teslim notunda). Kapsam yalnız bu düzeltme dilimidir; 2.10.0/2.11.0 özellikleri eklenmedi ve "merkez panelinin tamamı bitti" denmez.

Kanıt kökü: `GELISTIRICI_KAYNAK/docs/test-ciktilari/v291/` (aşağıda kısaca `v291/`).
Test türleri: **[DB]** gerçek PostgreSQL + gerçek Fastify HTTP (app.inject); **[TARAYICI]** Chromium, kontrollü HTTP yanıtları; **[FASTIFY-ARIZA]** gerçek işleyiciler + pool.connect düzeyinde kontrollü DB arızası (gerçek PostgreSQL değil); **[YAPILANDIRMA]** ayrı süreçte gerçek ortam değişkenleriyle yapılandırma/şifreleme kodu; **[PAKET]** teslim ZIP'inden gerçek başlatıcı + gerçek PostgreSQL.

## 1. Önce: bulguların eski build'de yeniden üretilmesi

| Kontrol | Eski build sonucu | Ham kanıt |
|---|---|---|
| Denetçinin `independent-ui.cjs` (V290-01/02/03) [TARAYICI] | 4/4 hata yeniden üretildi (B seçiliyken A'ya POST; B filtresinde KAYIT_A; iki boş sayfa) | `v291/baseline-v290/evidence/independent-ui.*`, `V290-UI-0*.png` |
| Denetçinin `production-config.mjs` (V290-05) [YAPILANDIRMA] | eksik / boş / tek karakter anahtar: üçünde de sorun listesi boş | `v291/baseline-v290/evidence/production-config.*` |
| Denetçinin `independent-api.mjs` (V290-06) [FASTIFY-ARIZA] | HTTP 200, iş etkisi 1, şirket audit 1, merkezi kayıt 0 | `v291/baseline-v290/evidence/independent-api.*` |
| Yeni `test/v291.test.ts` [DB] | V290-04: A yöneticisi B atamasını **200** ile bitirdi; ana danışman devirsiz yedeğe çevrildi; iki bağlantılı eşzamanlı düşürmede **0 yönetici** kaldı; güncel yetki testi geçti | `v291/baseline-v290/api-v291-gercek-db.log` |
| Yeni 12 tarayıcı senaryosu (V291-*) eski web derlemesinde [TARAYICI] | 11/12 başarısız (A→B→A senaryosu eski kodda da tesadüfen doğru bitiyor) | `v291/baseline-v290/ui-v291-eski-build.log` |

## 2. Bulgu bazında kapanış

### V290-01 — Ekip ve erişim: seçili şirket ile işlem şirketi ayrışıyordu
- **Kök neden:** `showAsg` geç gelen yanıtı koşulsuz yazıyordu; `endAsg` seçiciyi değil eski `asg.tenantId` değerini kullanıyordu.
- **Değişen:** `apps/web/src/product/pages/Platform.tsx` (`StaffTab`): istek nesli (`asgGen`) + seçili şirket referansı (`selRef`); şirket değişince eski ayrıntı ve düğmeler hemen kalkar; yalnız en son istenen ve hâlâ seçili şirkete ait yanıt uygulanır; atama/devir/bitirme gönderimden hemen önce kaydın şirketi ile etkin seçimi karşılaştırır; onay penceresi açıkken seçim değişirse istek gönderilmez ve açıklama çıkar; kayıt sonrası yenileme yalnız şirket hâlâ seçiliyse.
- **Önce/sonra:** B seçiliyken `…/tenants/aaaa…/assignments/cccc…/end` → sonra yalnız `…/tenants/bbbb…/assignments/dddd…/end`.
- **Testler:** denetçi `V290-UI-04` [TARAYICI]; yeni `V291-ASG-BA`, `V291-ASG-ABA`, `V291-ASG-ESKIHATA` (eski şirketin geç 503'ü yeni seçimi bozmaz), `V291-ASG-ONAY` (açık onay sırasında seçim değişimi → 0 yazma) [TARAYICI].
- **Kanıt:** `v291/fe-paket/bagimsiz-v290/independent-ui.json`, `v291/fe-paket/ui-regresyon-sonuc.json`.

### V290-02 — İşlem geçmişi: filtre ile sonuç farklıydı
- **Kök neden:** `AuditTab.load` yanıtı sorgu bağlamıyla eşleştirmiyordu; eski sayfa isteği yeni listeye ekleniyordu.
- **Değişen:** `Platform.tsx` (`AuditTab`): sorgu anahtarı (şirket + olay türü) ve istek nesli; filtre değişince liste, imleç ve açık ayrıntı sıfırlanır; eski filtre ya da eski sayfa yanıtı uygulanmaz; savunma katmanı olarak satırlar etkin filtreye göre ayrıca süzülür. (Ekranda aktör filtresi yoktur; API'nin `actorId` parametresi ekranda kullanılmadığından anahtara eklenmedi.)
- **Testler:** denetçi `V290-UI-03`; yeni `V291-GECMIS-SAYFA` (A'da eski sayfa isteği sürerken B seçimi), `V291-GECMIS-OLAY` (olay türünde hızlı değişim) [TARAYICI].

### V290-03 — Yeni merkez ekranlarında DTO koruması yoktu
- **Kök neden:** TypeScript tür parametresi çalışma anı doğrulaması sayılmıştı.
- **Değişen:** `apps/web/src/product/dto.ts` (yeni: `platformMe`, `platformTenants`, `staff`, `assignments`, `auditEvents`, `mfaState`, `mfaSetup`, `mfaVerify`); `Platform.tsx` bütün merkez okumaları `checkDto` ile; sekmelerde alan hatası + "Yeniden dene"; `App.tsx` merkez rotası ayrıca `ScreenBoundary` ile sarıldı (DTO doğrulamasının yerine değil, son savunma). `tools/tests/fe/dto-contract.mts`: yeni DTO'lar OpenAPI yanıt şemalarının alt kümesi olarak denetlenir (26 uç, 0 uyumsuzluk).
- **Testler:** denetçi `V290-UI-01/02`; yeni `V291-DTO-PERSONEL-NULL`, `-PERSONEL-ALAN` (zorunlu alan eksik), `-ATAMA` (dizi yerine nesne), `-GECMIS-OGE` (bozuk öğe), `-ME`, `-MFA` [TARAYICI].
- **Not:** Şirket listesi DTO'su yalnız seçicinin kullandığı `id/code/name` alanlarını zorunlu tutar.

### V290-04 — Atama bitirmede şirket kapsamı denetlenmiyordu
- **Kök neden:** `POST /api/platform/tenants/:tid/assignments/:uid/end` ve `platform_unassign` yalnız yönetici rolünü denetliyordu; `/api/t/:tid` kapısı bu platform ucunu kapsamıyor.
- **Değişen:** `apps/api/src/routes/platform.ts` (uç girişinde `auth_platform_has_tenant`); `db/migrations/0016_v291_denetim_kapanisi.sql` (`platform_unassign`: kayıt aranmadan önce şirket erişimi). Yetkisiz ve bilinmeyen kimlik aynı `403 tenant_not_authorized` yanıtını alır (kayıt varlığı sızmaz).
- **Önce/sonra:** A yöneticisi → B yedek atamasını bitir: 200 → **403**, atama değişmez, `assignment.end` kaydı oluşmaz; doğrudan `SELECT platform_unassign(...)` da reddedilir; B yöneticisi başarıyla bitirir.
- **Test:** `apps/api/test/v291.test.ts` 1. test [DB]. Kanıt: `v291/api-npm-test.log`.

### V290-05 — Üretimde MFA anahtarı zorunlu tutulmuyordu
- **Kök neden:** `validateConfig` anahtarı denetlemiyordu; `mfa.ts` geri dönüş anahtarı ortamla sınırlı değildi; `??` boş değeri eksik saymıyordu.
- **Değişen:** `apps/api/src/config.ts` (`mfaKeyProblem`: base64url, ≥32 bayt, karakter çeşitliliği; üretim ve yerel paketlerde zorunlu; geri dönüş yalnız açıkça `dev`/`test`; `NODE_ENV`↔`HPW_ENV` çelişkisi başlangıcı durdurur; `production` iki göstergeden herhangi biriyle); `apps/api/src/mfa.ts` (anahtar kimlikli `v2` mühür; `HPW_MFA_KEY_PREVIOUS` ile değişim; başarılı doğrulamada yeniden mühürleme; `v1` okuma yalnız üretim dışı ve yalnız yükseltme için; üretimde anahtarsız `seal` reddedilir); `routes/platform.ts` (yeniden mühürleme); 0016 (`platform_mfa_reseal`); `ops/paket/launcher.template.sh` (anahtarı yerel pakette üretir, eski kuruluma bir kez ekler, değeri yazdırmaz); `docs/MFA-ANAHTARI.md` (biçim, üretim komutu, saklama, değişim, yükseltme, acil durum).
- **Önce/sonra:** eksik/boş/kısa anahtar: sorun listesi boş → her biri için başlangıç sorunu.
- **Testler:** `apps/api/test/config-mfa.test.ts` 16 test [YAPILANDIRMA] (üretim ve yerel paket × eksik/boş/kısa/bozuk biçim/düşük çeşitlilik; geçerli anahtar; iki çelişki yönü; üretimde anahtarsız mühürleme reddi; dev/test geri dönüşü; anahtar değişimi; v1 yükseltme okuması ve üretimde reddi); denetçi `production-config.mjs` [YAPILANDIRMA]; yükseltme sınaması [PAKET]. Anahtar ve MFA sırları hiçbir log/rapora yazılmadı.

### V290-06 — Müdahale kaydı iş etkisiyle atomik değildi
- **Kök neden:** `intervention.write` `onResponse` içinde ayrı transaction'da yazılıyor, hata yutuluyordu.
- **Değişen:** `apps/api/src/db.ts` (`withContext`): müdahale modundaki istekte veri değiştiren her transaction, merkezi `intervention.write` kaydını **COMMIT'ten önce aynı transaction'da** yazar; kayıt yazılamazsa transaction geri alınır ve istek başarı dönmez. İstek anahtarı (Idempotency-Key ya da istek kimliği) + transaction sırası ile tekil; 0016'da benzersiz indeks. `server.ts` onResponse yazımı kaldırıldı. Normal şirket audit'i korunur. Outbox kullanılmadı (aynı transaction seçildi).
- **Önce/sonra:** [FASTIFY-ARIZA] 200 / iş 1 / şirket audit 1 / merkezi 0 → **500 / 0 / 0 / 0**.
- **Testler:** `v291.test.ts` 5. test [DB]: iş satırı ile merkezi kaydın aynı transaction'da olduğu (`xmin` eşit); aynı komut anahtarıyla yeniden gönderimde tek kayıt; veritabanında `REVOKE INSERT` ile gerçek arıza → istek başarısız, iş etkisi ve şirket audit'i yok; arızadan sonra yeni denemede bir kez uygulanır; commit öncesi bağlantı sonlandırmada (`pg_terminate_backend`) iş satırı da merkezi kayıt da kalmaz. Denetçi `independent-api.mjs` [FASTIFY-ARIZA].

## 3. Rol modeli ek kapanış testleri [DB]

| Konu | Değişiklik (0016) | Test |
|---|---|---|
| Ana danışman devirsiz başka göreve çevrilemez | `platform_assign`: mevcut `primary` başka göreve yalnız devir fonksiyonu içinden | v291 test 2 (`409 primary_handover_required`) |
| Rol düşürme devir zorunluluğunu dolanamaz; görev-rol uyumu | `platform_role_set`: ana danışmanlık devredilmeden uyumsuz role geçiş `primary_handover_required`; diğer uyumsuz görevler `role_duty_conflict` | v291 test 2 |
| Şirket yönetilemez kalmaz (ek) | `platform_last_tenant_admin`: bir şirketin tek yöneticisi rolden düşürülemez/kaldırılamaz | v291 test 2 (`409 last_tenant_admin`) |
| Son iki yönetici eşzamanlılığı | Rol/atama değişikliklerinde ortak `pg_advisory_xact_lock`; kilitten sonra aktör yetkisi yeniden denetlenir | v291 test 3 (iki bağlantı; tam biri başarılı, diğeri `last_admin` ya da `platform_admin_required`; en az bir yönetici) |
| Güncel yetki | (0014 davranışı doğrulandı) | v291 test 4: atama bitince/süresi dolunca sonraki istek 403; portföyde görünmez; rol iptalinde oturum kaydı silinir ve istek 401 |

**Denetimin istemediği ek koruma:** `last_tenant_admin`. Gerekçe: tasarım v2 "ana sorumluluk korunsun"; tek yöneticisi kaldırılan şirkete hiçbir yönetici erişemez ve atama yapamaz. İş sahibinin onayına sunulmuştur.

## 4. Mevcut testlerde yapılan değişiklikler (gevşetme değil; gerekçeli)

1. `v01-v28.test.ts` (v2.9.0 güvenlik testi): denetçi görevi sürerken rolü metodoloğa çevirme artık 409 `role_duty_conflict` (denetimin istediği görev-rol tutarlılığı). Test önce reddi, sonra görevi bitirip başarılı rol değişimini ve oturum kapanışını sınar.
2. Aynı test: müdahale izi artık yalnız veri değiştiren transaction'da oluşur; önizleme (`?preview=1`, veri yazmaz) iz üretmez. `intervention.write` beklentisi korunmuş, müdahale içinde gerçek bir yazma (erteleme) eklenmiştir.
3. Denetçi `production-config.mjs`: yeni kod anahtarsız `seal`'i reddettiği için çocuk süreç çöküyordu; çağrı try/catch ile sarıldı, başarısızlık ölçütü değişmedi (`tools/tests/bagimsiz-v290/ADAPTASYON.md`).
4. `tools/tests/fe/run-fe-tests.mjs`: **önceki sürümlerde `WEB_DIST` değişkeni yok sayılıyordu.** v2.8.0/v2.9.0 teslimlerinde "paketin web dosyasıyla" denen ön yüz koşuları aslında depo derlemesiyle koşmuştu (dosyalar aynıydı; v2.9.0 denetçisi bunu ayrıca karşılaştırdı). Düzeltildi; bu turdaki paket koşusu gerçekten paketin `DOLU_DEMO` web ve API derlemeleriyle yapıldı.

## 5. Standart komutlara bağlananlar

- `apps/api` → `npm test`: + `test/v291.test.ts`, `test/config-mfa.test.ts` (başarısızlıkta sıfırdan farklı çıkış).
- `tools/tests/fe/run-fe-tests.mjs`: + denetçinin üç betiği (API derlemesini kendisi yapar ya da `HPW_API_RUNTIME` ile paket derlemesini kullanır); + 12 yeni tarayıcı senaryosu (`ui-regresyon.cjs`).

## 6. Final paket üzerinde koşulanlar (build 4857cd642157)

| Grup | Sonuç | Tür | Ham kanıt |
|---|---|---|---|
| API (eski 45 + v291 5 + yapılandırma 16) | 66/66; 711 gerçek yanıt 0 sapma; OpenAPI 103 uç güncel; kapsam 117 kural 0 sorun | [DB]/[YAPILANDIRMA] | `v291/api-npm-test.log` |
| Domain | 70/70 | birim | `v291/domain-test.log` |
| Ön yüz kapısı (paketin web + API derlemesi) | tamamı geçti: dil kapsamı (857/92/103, eksik 0); yetki + uç sınıfı sözleşmesi; DTO⊆sözleşme 26 uç; API istemcisi 5/5 + 10/10; denetçi 26/27 (belgeli LOGIN-ENTER); 97 regresyon; N01–N03; R01–R03; R04 3+4; kapsam; bağımsız V290 UI/yapılandırma/API | [TARAYICI]/[FASTIFY-ARIZA] | `v291/fe-kabul-paket.log`, `v291/fe-paket/` |
| BOŞ turu (başlatıcı MFA anahtarı üretir; tur MFA kurar) | 52/52 | [PAKET] | `v291/tur.log`, `v291/launch-bos.log` |
| DOLU duman | 8/8 | [PAKET] | `v291/demo-smoke.log` |
| v2.9.0 → v2.9.1 yükseltme | şema 0015→0016; anahtar eklendi; v1 sırla giriş 200, sır v2'ye yeniden mühürlendi, ikinci giriş 200; veri korundu | [PAKET] | `v291/yukseltme/` |
| Temiz kurulum (ZIP kaynağı, node_modules ve fixture yok) | domain, web, API kurulum/derleme, boş veritabanına 16 migrasyon, sözleşme --check, yapılandırma testleri: hepsi 0 | kaynak | `v291/temiz-kurulum.log` |

Uygulanmış 0014 ve 0015 dosyaları değiştirilmedi; bütün veritabanı düzeltmeleri 0016'dadır.

## 7. Kılavuzlar ve tasarım belgesi

Kılavuzlar 2.9.1 (9 PDF; HPW Sistem Yöneticisi 16 sf): roller, iki adımlı doğrulama, ekip ve erişim, müdahale modu, işlem geçmişi; görüntülerde anahtar ve kurtarma kodları gizlendi. Tasarım v2 belgesi `docs/tasarim/HPW-Merkez-Paneli-Tasarim-v2.md` olarak depoya alındı; başına onay kaynağı yazıldı: **imzalı ayrı karar kaydı yoktur**; K1–K12, iş sahibinin 27.09.2026 tarihli yazılı sohbet talimatıyla ("Önerdiğin kurguyu birebir uygula. Sadece buna İngilizce Arayüz ekle") onaylanmış sayılmıştır. İlgili maddeler: K1, K4, K6, K7, K9; bölüm 3.3–3.7.

## 8. Açık kalan sınırlar

- Toplu MFA yeniden şifreleme betiği yok (değişim, sahibinin sonraki girişinde); üretimde v2.9.0 türetilmiş anahtarıyla okuma bilerek desteklenmez (acil durum prosedürü belgede).
- Outbox kullanılmadığı için outbox dayanıklılığı testi uygulanamaz; süreç çökmesi commit öncesi bağlantı sonlandırmasıyla sınandı.
- Mac/Safari, Firefox/WebKit matrisi, erişilebilirlik ölçümü, 20 şirket yük testi, bekleyen işler, ayrıntılı şirket kurulumu, arşiv, sıralama/sayfalama ve modal onaylar: 2.10.0/2.11.0 kapsamı (tasarım v2 bölüm 15); bu sürümde yok.
- Davet e-postaları, Excel şablonları ve kılavuzlar yalnız Türkçe; İngilizce kılavuz yok.
- Bağımsız denetimin gerçek PostgreSQL tekrarını ayrıca yapması önerilir; bu yanıttaki [DB] ve [PAKET] sonuçları üretici koşularıdır.
