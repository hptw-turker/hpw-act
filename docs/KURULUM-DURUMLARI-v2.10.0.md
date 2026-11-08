# HPW Act v2.10.0 — On adımlı kurulum: durumlar, parmak izleri, kullanıma açılış kanıt zinciri

Kaynak: `apps/api/src/onboarding.ts` (hesaplama), `apps/api/src/routes/platform.ts` (HPW onayı), `apps/api/src/routes/tenant.ts` (müşteri teyidi), `db/migrations/0017_v2100_sirket_isletimi.sql`. Gereksinim: "Çok Şirketli Merkez Paneli" §4.3; tasarım v2 bölüm 6.

Durumlar: `not_started` (başlamadı) · `in_progress` (devam ediyor) · `blocked` (engelli) · `done` (tamamlandı) · `recheck` (yeniden kontrol gerekli). "x/10" kurulum durumudur, şirketin gelişim puanı değildir.

**Veri alınamazsa:** hesaplama hata fırlatır; hiçbir adım "başlamadı" ya da "tamamlandı" sayılmaz. Şirket detayı hata + "Yeniden dene" gösterir; portföyde o şirketin satırı hata olarak görünür (diğer şirketler etkilenmez).

| Adım | done | in_progress | blocked | not_started | recheck |
|---|---|---|---|---|---|
| 1 Şirket kimliği | kod, ad, dil, saat dilimi dolu | biri boş | — | — | — |
| 2 Hizmet ve veri yönetimi kaydı | etkin onayın parmak izi = kaydın güncel parmak izi | kayıt var, onay yok | — | kayıt yok | kayıt onaydan sonra değişti |
| 3 HPW sorumlusu | geçerli ana danışman ataması var | — | — | yok | — |
| 4 Müşteri yöneticisi | etkin İK yöneticisi üyeliği + son daveti **kabul edilmiş** + kullanıcısı etkin | üyelik/davet var, kabul yok | davet kalıcı başarısız ya da süresi dolmuş (kabul yok) | İK yöneticisi üyeliği yok | — |
| 5 Organizasyon | etkin birim > 0 ve etkin rol > 0 | yalnız biri var | — | ikisi de yok | — |
| 6 Ölçüm tanımı | soru seti sürümü ≥ 1 | — | — | yok | — |
| 7 İlk dönem ve izlenen dönem | izlenen dönem açıkça seçilmiş | dönem var, izlenen seçilmemiş | dönem yok ve ölçüm tanımı yok (önce: 6) | ölçüm var, dönem yok | — |
| 8 Sonuçlar | izlenen dönemde etkin (yayımlı) sonuç partisi | içe aktarma var, yayım yok | izlenen dönem yok (önce: 7) ya da son içe aktarma başarısız | içe aktarma yok | — |
| 9 Kullanıcı erişimleri | İK yöneticisi dışındaki etkin üyeliklerde ≥ 1 kabul | açık davet var | başarısız davet var, kabul yok | davet yok | — |
| 10 Kullanıma açılış | geçerli HPW onayı + o onayın parmak izine bağlı müşteri teyidi | geçerli HPW onayı, müşteri teyidi yok ya da eski onaya bağlı | 1–9 tamam değil, onay yok (önce: ilk açık adım) | 1–9 tamam, onay yok | HPW onayının parmak izi güncel kanıtla eşleşmiyor ya da 1–9 artık tamam değil |

Davet oluşturulması (hazır/gönderildi) adım 4'ü tamamlamaz; yalnız kabul edilmiş davet ve etkin kullanıcı tamamlar.

## Parmak izleri (SHA-256, ilk 32 onaltılık)

| Onay | İçerdiği alanlar | Bilinçli olarak içermediği |
|---|---|---|
| Hizmet kaydı (adım 2) | kayıt referansı, kapsam, sorumlular, saklama politikası sürümü | kaydın zamanı ve kaydedeni (aynı içeriğin yeniden kaydı onayı bozmaz — test edildi) |
| Kullanıma açılış (adım 10) | izlenen dönem kimliği; o dönemin etkin sonuç partisi kimliği; ana danışman kullanıcı kimliği; kabul edilmiş İK yöneticisi üyelik kimliği; hizmet kaydı parmak izi; soru seti sürüm sayısı | zaman damgaları, şirket durumu, birim/rol sayıları, yedek danışman, ek davetler |
| Müşteri teyidi | teyit anındaki etkin HPW onayının parmak izi (kopya) | — |

## Kaynak kontrolü ile onay arasındaki eşzamanlılık

- HPW onayı gövdesinde `expectedFingerprint` (kullanıcının gördüğü kanıt) ve `expectedVersion` zorunludur. Sunucu kanıtı onay transaction'ında yeniden hesaplar; farklıysa **409 `evidence_changed`** — eski kanıt onaylanmaz.
- Onay kaydedildikten sonra kaynak değişirse (başka bir işlem), sonraki her değerlendirmede parmak izi eşleşmez → **recheck**. Onay hiçbir zaman güncel olmayan kanıtı "tamamlandı" göstermez.

## Kullanıma açılış iki taraflı kanıt zinciri — beklenen durumlar

| Olay | Sonuç |
|---|---|
| 1–9 tamam, onay yok | not_started |
| HPW onaylar | in_progress (müşteri teyidi bekleniyor) |
| Müşteri İK yöneticisi (şirket geneli) teyit eder | done |
| Kaynak değişir (ör. izlenen dönem, sonuç partisi, ana danışman, hizmet kaydı) | recheck — müşteri teyidi olsa da tamamlanmış görünmez |
| Kaynak onay anındaki haline döner | done (iki kayıt yeniden geçerli) |
| HPW yeniden onaylar (yeni parmak izi) | in_progress — eski müşteri teyidi yeni onayı karşılamaz |
| Müşteri eski onayın parmak iziyle teyit etmeye çalışır | 409 evidence_changed |
| Müşteri yeni onayı teyit eder | done |
| Eşzamanlı: HPW yeniden onaylarken müşteri teyit eder | ya 409 (müşterinin gördüğü parmak izi artık güncel değil) ya da teyit eski onaya bağlı kaydolur → in_progress; hiçbir sıralamada "done" oluşmaz |
| HPW personeli (müdahale modunda da) müşteri teyidi vermeye çalışır | 403 `customer_only` |

Kanıt: `apps/api/test/v2100.test.ts` — "Kurulum 4 ve 10" testi (gerçek PostgreSQL + HTTP).
