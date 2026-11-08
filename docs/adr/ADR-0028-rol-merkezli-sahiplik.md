# ADR-0028: Sorumluluk organizasyonel rolde durur; kişi effective-dated çözülür

**Durum:** Kabul edildi (v2.3 kanonik, 24.09.2026)

## Karar
`org_role` (Konak Şube Müdürü) ve `accountability_assignment` (primary/delegate/acting, tarih aralıklı). Yerel hedef, ambition, fonksiyonel KPI ve aksiyon `owner_role_id` taşır; kişi `resolveAccountable(role, holders, asOf)` ile çözülür (vekil > vekâleten > asıl). Kişi ayrılınca iş taşınmaz, rol boşalır (vacant) ve dikkat kuyruğuna düşer; audit'te kişi referansı korunur.

## Gerekçe
Kişi merkezli sahiplik her ayrılışta toplu taşıma gerektirir; matris organizasyonda ve 8 yöneticinin aynı dönemde ayrıldığı senaryoda kırılgandır.

## Sonuçlar
- Mimari belge v2.3 bağlayıcıdır; `packages/domain-core` ve `db/migrations/0001_core.sql` bu kararı uygular; kabul testleri T-64..T-69 doğrular.
