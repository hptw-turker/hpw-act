# ADR-0011: RBAC + ABAC politika karar noktası ve görev ayrımı

**Durum:** Kabul edildi (v2.1, 22.09.2026)

## Karar
Kararlar packages/policy içinde (rol, hiyerarşi grubu, birim, ilişki türü, dönem, vekâlet, nesne sahibi, gizlilik). RLS ikinci hat: uygulama rolü tablo sahibi değil, NOBYPASSRLS, FORCE RLS. SoD kuralları sert.

## Gerekçe
Rol tek başına matris organizasyon + vekâlet + kanıt sahipliği kararını veremez.

## Sonuçlar
- Mimari belgenin ilgili bölümü bağlayıcıdır; değişiklik yeni ADR gerektirir.
- Kabul testleri `docs/testing/acceptance-tests.md` içinde bu kararı doğrular.
