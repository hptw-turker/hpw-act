# ADR-0038: Pilot kapıları (G0/G1/G2) ve sürümlü şema

**Durum:** Kabul edildi (v2.3.1, 24.09.2026) — inceleme raporu bölüm 14–16

## Karar
"Şema kilidi" bir dondurma değil, sürümlü migrasyon disiplinidir: canlı pilot çalışan ve sürümlü bir backend gerektirir; genişlet-daralt geçişleri, geriye uyumlu API, veri düzeltme akışı (ADR-0033) ve geri dönüş planı değişiklik maliyetini yönetir. Kararlar üç kapıya bölünür.

- **G0 — Sentetik veriyle geri alınabilir backend geliştirmesi.** Ortak tip/durum sözlüğü (SQL = domain = API), gizlilikte varsayılan ret (ADR-0034), karşı örnek testleri yeşil; bunlar olmadan yeni bağımlı modüllere yayılma yok.
- **G1 — Gerçek çalışan verisiyle 40 şubelik pilot.** Yetkilendirme, veri minimizasyonu/saklama, kaynak düzeltmesi, kritik karar doğruluğu, gerçek PostgreSQL'de RLS/kısıt/eşzamanlılık testi, izinli gerçek sonuç dosyasıyla resmî üst skor mutabakatı (T-57). HPTW'nin gizlilik ve aktarım yükümlülükleri yetkili hukuk/güvenlik sorumlularınca ayrıca kontrol edilir; teknik RLS varlığı hukuki uygunluk belgesi değildir. Pilot birimleri farklı büyüklük, yüksek/düşük sonuç, küçük gizli ekip, farklı dijital beceri, merkezi bağımlılık ve yönetici değişimini kapsayacak biçimde seçilir.
- **G2 — 100→400 şube yayılımı.** Bildirim/kanıt/HRBP kuyruğu, reorg fan-out, geri yükleme ve müşteri izolasyonu gerçekçi yükte sınanır. HRBP yükü duyarlılık hesabıyla (400 şube × 2 aksiyon × aylık 5 dk inceleme = 66,7 saat/ay; %10 insan incelemesiyle 6,7 saat) değil pilotta ölçülür.

Bir canlı pilot birkaç haftada kullanım kolaylığını ölçer; yıllık anket üzerindeki etkisini kanıtlayamaz. Mimari hedefleri (plan girişi ≤5 dk, check-in ≤60 sn) gözlenmiş sonuç değil, pilotta sınanacak kabul hedefleridir. Sürüm teslimatı "bir sonraki sürüm numarası" değil, eski karşı örneklerde başarısız olup düzeltmeden sonra doğru sonuç veren testler ve aynı kayıtla çalışan kullanıcı akışıdır.

## Kanıt
`packages/domain-core/test/karsi-ornekler.test.ts`; `docs/reviews/2026-09-23-v23-inceleme-yaniti.md`; `docs/backlog/faz0.md` G0/G1/G2 maddeleri.
