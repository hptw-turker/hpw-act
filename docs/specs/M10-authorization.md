# M10 — Yetkilendirme: RBAC + ABAC politika karar noktası, görev ayrımı, RLS

**Mimari bölüm:** 14 · **Faz:** 0 temel (ABAC motoru ve tam SoD Faz 1)

## Amaç
Rol, hiyerarşi grubu, birim, ilişki türü, dönem, vekâlet, nesne sahibi ve gizlilik eşiğini birlikte değerlendiren politika karar noktası; sert görev ayrımı; RLS ikinci hat.

## Nesneler
RoleAssignment, MaterializedScope, PolicyDecision (log), Delegation.

## Kurallar ve algoritmalar
- `packages/policy`: `decide(actor, action, resource, context) → allow|deny(reason)`; controller'da rol kontrolü yok (I-31). Örnek politika mimari 14.
- SoD: exception requester ≠ approver; kritik kanıtta owner ≠ verifier ve vekili değil; delegation self-approval yok; tenant admin veri/teknik ayrımı.
- Materialized scope: (person → unit, group, includes_descendants, relationship_type) reorg/rol olaylarında yeniden hesaplanır.
- v2.3 (ADR-0029): `decide()` ifşa kararı her okumada; `disclosure_decision` kaydı; fark sorgusu koruması (`differencingRisk`); yorum eşiği 10; export aynı yol. Rol merkezli sahiplik (ADR-0028): `resolveAccountable`.
- v2.2 (ADR-0019): gizlilik çıktı kapısı `canExpose(viewer, unit, metric, outputType)` bütün okuma uçlarında; gizli birimde sayısal çıktı yok; katkı birim kapsamında yok; ikincil baskılama. Çalışan hesabına hedef/aksiyon/kanıt sahipliği politika ile reddedilir (ADR-0023, T-62).
- Skor görünürlüğü roll-up + gizlilik; hedef/aksiyon görünürlüğü sorumluluk ilişkileri; Akademi yerel uygulamaları görür, şube skorunu görmez.
- RLS: `docs/security/rls-checklist.md`; hpw_app NOBYPASSRLS, tablo sahibi değil, FORCE RLS (T-47, T-48).
- HPTW danışman çok-tenant görünümü açık tenant listesiyle.

## API (özet; tam sözleşme docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz))
Politika servisi iç API; GET /me/scope · GET /policy/explain?action=&resource= (neden reddedildi).

## Olaylar
`Policy.Denied` (audit), `Scope.Recomputed`.

## Kabul kriterleri
T-19, T-20, T-47, T-48.
