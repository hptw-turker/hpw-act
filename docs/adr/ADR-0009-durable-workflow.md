# ADR-0009: Kalıcı süreç yürütme: motor bağımsız nesneler, Faz 0 Postgres, Faz 2 Temporal

**Durum:** Kabul edildi (v2.1, 22.09.2026)

## Karar
WorkflowInstance/Step/Timer/Incident/CompensationCommand domain'de. Faz 0: idempotent adım yürütücüsü Postgres üzerinde. Faz 2: Temporal (TypeScript SDK). Camunda yalnız BPMN görünürlüğü zorunlu olursa. Outbox her durumda kalır.

## Gerekçe
Kuyruk+zamanlayıcı+outbox olay teslimatını çözer, süreç durumunu çözmez; 9 aylık süreçler çökmeye dayanıklı olmalı; erken platform yükü alınmaz.

## Sonuçlar
- Mimari belgenin ilgili bölümü bağlayıcıdır; değişiklik yeni ADR gerektirir.
- Kabul testleri `docs/testing/acceptance-tests.md` içinde bu kararı doğrular.
