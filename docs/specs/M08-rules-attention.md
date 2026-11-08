# M08 — Kural, escalation ve dikkat motoru

**Mimari bölüm:** 12 · **Faz:** 1 (Faz 0: yalnız AttentionItem üretimi)

## Amaç
Bildirimsel kurallar, kalıcı zamanlayıcılar, operasyonel risk modeli, escalation yönlendirmesi, AttentionItem kuyruğu.

## Nesneler
NotificationRule, EscalationPolicy, AttentionItem, NotificationDelivery, WorkflowTimer.

## Kurallar ve algoritmalar
- Kurallar JSON/YAML; tetikleyici, koşul, alıcı çözümleme (rol + graf + vekâlet), kanal, şiddet, dikkat öğesi türü; idempotent anahtar (I-30).
- Merdiven (mimari 12.1) ve OperationalRisk = max(...) yönlendirmesi: sahip yok → KRİTİK/orphan; bloke bağımlılık → bağımlılık sahibi (T-21); kanıt güveni düşük → doğrulayıcı; ≥7 gün → yönetici+HRBP; confidence iki kez düştü → toparlanma.
- Master action escalation'ı dağıtım eşiği (%20 yerel gecikme) aşılınca.
- AttentionItem nesne: audience, type, severity, entity, rule, state, sla, resolved_by; SLA aşımı → escalated + metrik (T-54).
- Kanallar: uygulama içi, e-posta, Teams adaptive card, Slack; teslim makbuzu, retry, DLQ; sessize alma escalation'ı durdurmaz; vekâlet yönlendirir.

## API (özet; tam sözleşme docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz))
GET /attention?audience=me · POST /attention/{id}/acknowledge · POST /attention/{id}/resolve · POST /attention/{id}/dismiss (reason) · GET/PUT /tenant/rules · GET /notifications/deliveries?entity=.

## Olaylar
`Attention.Created/Acknowledged/Resolved/Escalated`, `Notification.Sent/Failed/Retried`, `Escalation.Raised`.

## Kabul kriterleri
T-21, T-54; aynı koşul iki escalation üretmez (I-30).
