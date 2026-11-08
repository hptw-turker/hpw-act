# ADR-0020: Risk bazlı kanıt politikası E0–E4

**Durum:** Kabul edildi (v2.2 semantik kilit, 23.09.2026)

## Karar
EvidenceRisk = .30 kritiklik + .20 kapsam + .15 maliyet + .15 oyun riski + .10 geri alınamazlık + .10 önceki anomali (tenant ayarı). E0 yapılandırılmış beyan, E1 yapılandırılmış kayıt, E2 belge/sistem izi, E3 bağımsız doğrulama, E4 örneklem denetimi. Seviye kabulde dondurulur. Kural katmanı: sayısal hedefe bağlı ve birden çok birime yayılan aksiyon E0 olamaz; önceki anomali kaydı olan sahipte bir basamak yukarı. Sistem kaydı varsa dosya istenmez.

## Gerekçe
Her aksiyona PDF istemek sistemi 'iş yapmaktan çok yaptığını ispatlama' aracına çevirir; risk yükseldikçe kanıt gücü yükselir.

## Sonuçlar
- Mimari belge bölüm 24 bağlayıcıdır; `packages/domain-core` bu kararı uygular, kabul testleri T-55..T-62 doğrular.
