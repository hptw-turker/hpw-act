# M07 — Yürütme, check-in, toplu işlem, komut zarfı

**Mimari bölüm:** 11 · **Faz:** 0 (toplu işlem UI Faz 1)

## Amaç
Check-in ritmi ve confidence; termin uzatma ve iptal; toplu işlemler; komut zarfı, iyimser eşzamanlılık ve anlamsal çatışma çözümü.

## Nesneler
CheckIn, DeadlineExtension, BulkOperation (WorkflowInstance türü), CommandLog.

## Kurallar ve algoritmalar
- Komut zarfı ve handler sırası `docs/conventions/coding-standards.md`; 409 gövdesi `{currentVersion, yourVersion, changedBy, changedFields}` (T-14); aynı command_id → aynı yanıt (T-31).
- Geç gelen komut: hedef aggregate iptal/kapalıysa 'son yazan kazanır' yok; `409 SEMANTIC_CONFLICT` + seçenek (`attach_as_comment`) (T-30).
- Check-in: progress, confidence (yüksek/orta/düşük), not; ilerleme↑ confidence↓ → AttentionItem.
- Termin uzatma: neden kodu, onay, eski termin tarihçede, 'uzatıldı' ayrı sayılır. İptal: gerekçe; hedef yeterlilik dikkat öğesi.
- Toplu işlem: asenkron, önizleme/dry-run, geri alma penceresi, tek audit kökü; türler: approve targets, deploy master, reassign, decide exceptions, remind, import/export.

## API (özet; tam sözleşme docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz))
POST /actions/{id}/check-ins · POST /actions/{id}/extend · POST /actions/{id}/cancel · POST /bulk (type, filter, dry_run) → job · POST /bulk/{id}/commit · POST /bulk/{id}/undo.

## Olaylar
`CheckIn.Recorded`, `Deadline.Extended`, `Action.Cancelled`, `Bulk.Previewed/Committed/Undone`.

## Kabul kriterleri
T-14, T-30, T-31.
