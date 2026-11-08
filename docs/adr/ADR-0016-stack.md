# ADR-0016: TypeScript/NestJS + React/Vite + PostgreSQL 16 + Redis/BullMQ

**Durum:** Kabul edildi (v2.1, 22.09.2026)

## Karar
Tek dil ailesi (mevcut HPW EX prototipi JS), OpenAPI, Drizzle ile SQL migrasyon, RLS. Frontend framework'e geçiş; vanilla JS prototip yaşayan spec.

## Gerekçe
Python/FastAPI alternatif; AI ağırlıklı ekipte yeniden değerlendirilebilir.

## Sonuçlar
- Mimari belgenin ilgili bölümü bağlayıcıdır; değişiklik yeni ADR gerektirir.
- Kabul testleri `docs/testing/acceptance-tests.md` içinde bu kararı doğrular.
