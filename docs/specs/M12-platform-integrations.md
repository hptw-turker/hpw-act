# M12 — Entegrasyonlar, süreç motoru, olay altyapısı, HA/DR, veri yaşam döngüsü

**Mimari bölüm:** 18–19 · **Faz:** 0 çekirdek (outbox, yürütücü, retention tabloları); HA/DR, kotalar, akışlar Faz 2

## Amaç
Dört bağlayıcı sınıfı; komut/olay altyapısı; kalıcı süreç yürütücü; tenant izolasyonu; yüksek erişilebilirlik; veri yaşam döngüsü; gözlemlenebilirlik.

## Nesneler
OutboxEvent, ProcessedEvent, DeadLetter, WorkflowDefinition/Instance/Step/Timer/Incident, CompensationCommand, ConnectorCursor, TenantQuota, DataRetentionPolicy, LegalHold, DeletionRequest, AnonymizationJob, DataTransferRegister.

## Kurallar ve algoritmalar
- Bağlayıcılar: sonuç (HPTW native JSON payload mimari 18; CSV; API), kimlik/org (OIDC/SAML, SCIM 2.0, HRIS taslak reorg), kanıt (LMS, takvim meta, ticketing; yalnız gereksinimdeki metrik), bildirim (e-posta, Teams, Slack, webhook). Cursor + mutabakat + replay; kesinti çekirdeği bloke etmez (T-36).
- Outbox: iş yazımıyla aynı transaction; relay; tüketici dedupe (T-13); DLQ 5 deneme; replay komutu.
- Süreç yürütücü (Faz 0 Postgres): tablo tabanlı adımlar, idempotency_key, kalıcı timer (`fire_at`), incident; süreç tanımları `docs/workflows`. Faz 2 Temporal (ADR-0009).
- Tenant kotaları: iş eşzamanlılığı, bildirim hızı, toplu işlem, sorgu bütçesi, depolama; öncelikli kuyruklar (T-32).
- HA/DR: topoloji, RPO ≤5 dk, RTO ≤30 dk, tatbikat (T-33, T-34); bozulma matrisi (AI, projeksiyon, bağlayıcı, kuyruk, zamanlayıcı).
- Veri yaşam döngüsü: politika/sınıf, LegalHold silmeyi durdurur, DeletionRequest → AnonymizationJob → imha kaydı (T-40, T-41); DataTransferRegister; audit referansla.
- Gözlemlenebilirlik: OpenTelemetry, tenant etiketi, metrik listesi mimari 19, correlation zinciri.

## API (özet; tam sözleşme docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz))
POST /connectors/{type} · GET /connectors/{id}/health · POST /events/replay · GET /workflows/{id} · POST /workflows/{id}/retry · POST /tenant/quotas · POST /data/retention-policies · POST /data/legal-holds · POST /data/deletion-requests · GET /data/transfer-register.

## Olaylar
`Connector.Synced/Failed`, `Workflow.Started/StepCompleted/Incident/Completed`, `Retention.Executed`, `LegalHold.Placed/Released`, `Deletion.Requested/Completed`.

## Kabul kriterleri
T-11, T-12, T-13, T-32, T-33, T-34, T-35, T-36, T-40, T-41, T-44, T-45.
