# R01–R44 bulgu kapanış tablosu (v2.6, 24 Eylül 2026)

Durumlar: **Kapatıldı** = kodda giderildi ve gerçek PostgreSQL'de koşan testle doğrulandı; **Kısmen** = ana risk giderildi, kalan kapsam açık yazıldı; **Açık** = bu teslimatta yapılmadı. Test referansları: `E2E-n` = apps/api/test/e2e.test.ts n. test, `R-n` = apps/api/test/r01-r44.test.ts n. test, `UI` = tools/scripts/ui-bos-tur.py (46 adım), `D` = packages/domain-core/test. Bütün testler bu teslimatta gerçekten koşturuldu; çıktılar apps/api/var/test-ciktilari altında.

| # | Öncelik | Durum | Ne yapıldı | Kanıt |
|---|---|---|---|---|
| R01 | P0 | Kapatıldı | Üyelik sorgusu dar kapsamlı SECURITY DEFINER `auth_memberships`; şirket geçişi `auth_session_switch_tenant` üyelik/yetki kontrolüyle atomik; başarısızlıkta 403 | R-1, R-5, UI-11 |
| R02 | P0 | Kapatıldı | `requireTenantAsync` her tenant isteğinde `auth_platform_has_tenant`; menü/geçiş tek kapı değil | R-2 (6 uç 403, yazma etkisi yok), UI-10b/10c |
| R03 | P0 | Kapatıldı | Kapsam yoksa sıfır erişim; şirket geneli görünüm yalnız açık yetki (`membership.company_wide` / HR_ADMIN, EXEC); HRBP `membership_scope` ağacı | R-3, UI-7 |
| R04 | P0 | Kapatıldı | Kullanıcı yüklemesi yalnız HR_ADMIN; `grantableProfiles` XLSX ve API'de aynı; HRBP HR_ADMIN veremez | R-4 |
| R05 | P0 | Kapatıldı | Etkin profil her istekte bugün geçerli rol atamalarından çözülür (`resolveMembership`); rol CLOSE/vekâlet bitişi yetkiyi düşürür; Ek_Erisim çoklu + include_descendants | R-3 (CLOSE sonrası VIEWER, kapsam sıfır) |
| R06 | P0 | Kapatıldı | verify: kapsam (`assertUnitVisible`) + görev ayrımı + kanıt kapsaması; eksik gerçekleşme onayla tamamlanmaz (422 coverage_insufficient); muafiyet yalnız HR_ADMIN ve `partial` | R-7, UI-8 |
| R07 | P0 | Kapatıldı | Fastify JSON şemaları (verify, transition, review, hedef, kanıt, takip incelemesi, giriş, platform); `coerceTypes:false`; `ok:"false"`, eksik karar/gerekçe, NaN 400 | E2E-7, R-7 |
| R08 | P0 | Kapatıldı | Takip ekranı seçili hedef kimliğini state'te tutar; yanıt targetId/cycleId taşır; onay yalnız o kimliğe | UI-9c |
| R09 | P0 | Kapatıldı | NOT_MEASURED / gizli / incelemede ayrı kartlar; seçim değişince eski yanıt temizlenir, geç yanıt sıra numarasıyla düşürülür | UI-9, kod |
| R10 | P0 | Kapatıldı | Pasif hesap oturum açamaz (`auth_session_lookup`); ikinci şirket daveti parolayı değiştirmez (`membership_joined`), mevcut parola doğrulanır; parola kurulunca oturumlar kapanır; üyelik iptali yalnız o tenant | R-5, R-8 |
| R11 | P0 | Kısmen | Gizli sonuçta sayısal alanlar null; hedef listesi gizli başlangıçta sayı vermez; null asla 0 değil. Çoklu toplam/rank çıkarım koruması API rapor planına henüz bağlanmadı | kod; açık: domain koruması API'ye bağlanacak |
| R12 | P0 | Kısmen | Şirket değeri yalnız yaprak birimlerden (alt sonucu da yüklü üst birim çift sayılmaz). Resmî ağırlık/kapsam sözleşmesi HPW onayı bekliyor (R44) | kod |
| R13 | P0 | Kapatıldı | Sabitler kaldırıldı: katılım oranı = n/headcount, trend riski önceki dönemden, iş yükü aktif aksiyonlardan; bilinmeyenler `assumptions` listesinde; sentetik etki istatistiği yalnız HPW_DEMO_DATA=1 | kod, R-7 |
| R14 | P0 | Kapatıldı | `?preview=1` öneri (kayıt yazmaz) → kabul; aday olmayan rol 422; düşük güven/REVIEW_REQUIRED → under_review; takip dönemi ve ufuk kabulden önce | R-7, UI-7b |
| R15 | P0 | Kapatıldı | Şablon yoksa kontrollü özel aksiyon (`custom` başlık+ritim), kanıt gereksinimi ritimden; ekranda özel form | R-7, UI-7d (özel/şablon) |
| R16 | P1 | Açık | Çoklu kesit/demografik analiz kesiti ve unvan/pozisyon ayrımı yok; MVP kapsamı birim ağacı ile sınırlı | — |
| R17 | P0 | Kapatıldı | Eşdeğerlik önceki sürümdeki soru metni+ölçeğe göre yazılır (instrument commit) ve takipte yeniden hesaplanır; referans kataloğa uygunluk ayrı | kod, E2E-8 |
| R18 | P0 | Açık | Kısmi indeks aynı adla üretilmeye devam ediyor; ayrı ad/kapsam etiketi ve immutable üyelik sürümü yapılmadı | — |
| R19 | P0 | Kapatıldı | Aynı sorunun göstergeleri tek dağılımdan; çelişki `distribution_conflict` | R-6 |
| R20 | P0 | Kapatıldı | Benchmark ölçek sınırı, metrik/set tekilliği, paketle gelen anlık görüntü (eski satır kalmaz), `import_batch_id` bağı | R-6 |
| R21 | P0 | Kapatıldı | Paket üstbilgisi zorunlu; her satırda cycle_code kontrolü | R-6 |
| R22 | P0 | Kapatıldı | FULL_REPLACE / PATCH sözleşmesi; düşecek hücreler önizlemede, onayda `confirmReplace` teyidi; PATCH değişmeyen sonuçları soy bilgisiyle taşır | R-6 |
| R23 | P0 | Kapatıldı | Doğrulamada enstrüman ve aktif paket pinlenir (`import_job.pinned`); commit'te değişmişse 409 revalidate_required | R-6 |
| R24 | P0 | Kapatıldı | `result.source_reference` ve `carried_from_batch_id` satırda kalıcı | R-6 |
| R25 | P0 | Kapatıldı | Başlangıç düzeltmesi hedefi under_review + baseline_superseded yapar; kabulde keep/rebase zorunlu; rebase dayanağı günceller | R-7 |
| R26 | P1 | Kapatıldı | Ritim slotu başına tek gerçekleşme (telafi yalnız occurrenceKey ile); gelecek tarih reddi | E2E-7, R-7, UI-7f |
| R27 | P1 | Kapatıldı | Kapasite duraklatılmış/beyan edilmiş işleri sayar; birim satırı kilitli; acil bayrağı yalnız HR_ADMIN + gerekçe | R-7 |
| R28 | P0 | Kapatıldı | `Idempotency-Key` başlığı: aynı anahtar+gövde önceki yanıt, farklı gövde 409 (tenant kapsamlı tablo) | R-7 |
| R29 | P0 | Kısmen | `audit_event` yazımı: hedef oluşturma/inceleme, aksiyon oluşturma/geçiş/doğrulama, kanıt, yükleme commit, davet, iptal, şirket oluşturma. Değerlendirmeler hâlâ upsert (immutable revizyon değil) | R-7 |
| R30 | P1 | Açık | Tarihsel yapı/devir süreci (ReorganizationRun) yok | — |
| R31 | P1 | Açık | Ana aksiyon/400'lü dağıtım, bağımlılık, merkezi karar kuyruğu yok; MVP yerel dilim | — |
| R32 | P0 | Kısmen | nodemailer kilitli bağımlılık; MAIL_FROM zorunlu, MAIL_ALLOWLIST dışı alıcı `blocked`; sandbox açık etiketli. Gerçek teslimat webhook'u ve sağlayıcı doğrulaması dış bağımlılık, denenmedi | kod |
| R33 | P0 | Kapatıldı | Atomik kira (processing + lease_until), süresi dolan kira geri alınır, üstel bekleme, 5 denemede perm_fail | R-9 |
| R34 | P1 | Kapatıldı | Yeniden gönderim seçili alıcılara, satır kilidi; platform personeli parola kurma bağlantısı (`password_token`, /parola/:token) | R-2, UI |
| R35 | P0 | Kapatıldı | Üretimde fail-closed yapılandırma; bootstrap tek seferlik/atomik/SETUP_KEY; giriş hız sınırı (8/15 dk); parola sıfırlama; token log'a yazılmaz | R-8, UI-0/0b/11 |
| R36 | P0 | Kısmen | PUBLIC EXECUTE iptali, search_path sabit, ortam başına ayrı servis hesabı ve DB CONNECT ayrımı. Migrasyon sahibi hâlâ postgres; auth owner ayrı rol değil | ops/create-env.sh |
| R37 | P1 | Kısmen | Gizli değer hata dosyasına kopyalanmıyor; satır/boyut sınırı var. Zip bombası/işçi izolasyonu/karantina yok | kod |
| R38 | P0 | Kapatıldı | reset yalnız *_test ve ALLOW_DB_RESET=1; migrasyon defteri SHA-256 + danışma kilidi; değişmiş migrasyonda durur | R-8 |
| R39 | P0 | Kısmen | domain-core bağımlılığı package.json'da; typecheck/build/test script'leri; typecheck temiz. Fastify 4 kaldı (5'e yükseltme ayrı iş), pnpm/npm lock ikiliği sürüyor | `npm run typecheck` |
| R40 | P1 | Kısmen | Düzen çökmesinin kök nedeni bulundu (col-5/col-7 ve --s-3 tanımsızdı) ve giderildi; rol/unvan çoklu seçici + kapsam önizlemesi; ham JSON yerine Türkçe durumlar kısmen | UI ekran görüntüleri |
| R41 | P1 | Kapatıldı | Yayım şartı toplam madde; doğrulama gerekçe/ret; seçim değişiminde state temizliği; gövdesiz POST'ta JSON başlığı hatası (400) giderildi | UI |
| R42 | P1 | Kısmen | Genel bakış gerçek durum/eksik/bağlantı tablosu; portföy/karar kuyruğu yok | UI-2c |
| R43 | P0 | Kapatıldı | Bulgu → test izlenebilirliği bu tablo; negatif yetki matrisi, çoklu hedef UI, gerçek Excel turu, verili migrasyon (0003) koşuldu | tüm testler |
| R44 | P1 | Açık | HPW metodolog onayı ve gerçek veri pilotu dış bağımlılık; ölçek/toplama/sertifikasyon politikaları HPW onayı bekliyor | — |

Kapatıldı 27 · Kısmen 11 · Açık 6.
