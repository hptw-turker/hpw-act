# ADR-0037: İki sorumluluk etiketi, dikkat kapatma anlamı, acil vaka yönlendirmesi

**Durum:** Kabul edildi (v2.3.1, 24.09.2026) — inceleme raporu P0-08 ve "pratikte en büyük beş engel"

## Karar
**İki rol.** Her yerel hedef iki rol taşır: "şubede sonucu izleyen rol" (`owner_role_id`) ve "bu müdahaleyi yapmaya yetkili rol" (`intervention_owner_role_id`, öncelik sahipliğinden). Merkezi kaldıraçta (vardiya) şube sonucu izler ve yerel uygulamayı yapar; çözümün hesap vereni değişmez. Arayüz ikisini ayrı yazar.

**Kapatma anlamı.** Dikkat öğesini listeden çıkarmak yükümlülüğü bitirmez. Beş eylem ayrıdır: okundu (yalnız bilgi öğeleri), ertele (kuyrukta kalır, tarih gerekir), yeniden yönlendir (yeni sorumlu + gerekçe), çöz (yalnız sahip, yükümlülük gerçekten kapandıysa), muafiyet (gerekçe + üst yetki).

**Yanlış soruna doğru aksiyon.** "Güven düşük" tek başına "vardiya planı yanlış" demek değildir: madde düzeyinde sürücü verisi varsa kullanılır, yoksa program varsayımı yazar ve yöneticiden/İK iş ortağından kısa bağlam teyidi ister. Çalışanın çözüm seçimine katkısı olabilir; kendisine skor hedefi ya da kanıt yükü verilemez.

**Acil vaka.** Üç aktif aksiyon sınırı, acil güvenlik, taciz ya da ciddi çalışan riski bildirimini bekletme gerekçesi olamaz (`canOpenAction(…, urgent)`); ürün bu vakaları mevcut kurumsal sürece (etik hattı, İSG) yönlendirir, vaka yönetimi platformuna dönüşmez.

**Skor baskısı.** Skor hedefi referans olarak kullanılır, tek başına bireysel prim/ceza girdisi olmaz; "kim tutturamadı" karnesi yoktur (ADR-0032).

## Kanıt
`packages/domain-core/src/attention/dismiss.ts`, `src/policy/workload.ts`; `apps/web/src/pages/{LocalTargets,Actions,Home}.tsx`; SQL `local_target.intervention_owner_role_id`.
