# ADR-0030: Kanıt seviyesi kuraldan seçilir, puan triyajdır; doğrulama kuyruğu insanla ölçeklenmez

**Durum:** Kabul edildi (v2.3 kanonik, 24.09.2026)

## Karar
Kural tablosu: düşük riskli yerel geri alınabilir rutin → E0/E1; sayısal hedefe bağlı rutin → E1; orta maliyet ya da birden çok birime yaygın → E2; yüksek maliyet/kritik/manipülasyon riski → E3; büyük program → E4 (denetim SINIFI, her aksiyon değil). Önceki anomali bir basamak yukarı. Sistem izi varsa dosya istenmez (kanıt yolu: sistem izi > yapılandırılmış kayıt > dosya > insan). Doğrulama yolu politikası: sistem izi → otomatik; E0/E1 → istisna yoksa insan yok; E2 → bağlayıcı güveni yüksekse otomatik; E3 → insan incelemesi; E4 → örneklem denetimi. EvidenceRisk puanı yalnız inceleme sırası ve örneklem seçimi içindir.

## Gerekçe
EvidenceRisk 54 ile 56'nın pratik anlamı yapaydır; 400 şube × 3 aksiyon HRBP kuyruğunu boğar.

## Sonuçlar
- Mimari belge v2.3 bağlayıcıdır; `packages/domain-core` ve `db/migrations/0001_core.sql` bu kararı uygular; kabul testleri T-64..T-69 doğrular.
