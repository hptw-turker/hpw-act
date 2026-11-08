# M06 — Kanıt ve doğrulama

**Mimari bölüm:** 10 · **Faz:** 0 (bağlayıcılar ve anomali Faz 2)

## Amaç
Aksiyon açılırken kanıt gereksinimini kilitler; kanıt türleri ve merdiveni; kural motoru ile doğrulama; anomali ve kanıt güveni; iki güven skoru.

## Nesneler
EvidenceRequirement, Evidence, EvidenceVerification, EvidenceConnector (Faz 2), EvidenceRetentionClass.

## Kurallar ve algoritmalar
- v2.3 (ADR-0030): KURAL ÖNCE — seviye açık kural tablosundan (`evidenceLevelByRules`), risk puanı yalnız triyaj; doğrulama yolu politikası (`verificationRoute`): sistem izi otomatik, E0/E1 istisna yoksa insan yok, E2 bağlayıcı güveniyle otomatik, E3 insan, E4 örneklem denetimi. Durumlar: declared, submitted, auto_verified, human_verified, partially_verified, needs_more_evidence, review_required, rejected_with_reason.
- v2.2 (ADR-0020): kanıt seviyesi E0–E4 aksiyonun riskinden otomatik seçilir (`evidenceRisk/evidenceLevel`), kabulde dondurulur; sayısal hedefe bağlı yaygın aksiyon E0 olamaz; önceki anomali bir basamak yükseltir; sistem kaydı varsa dosya istenmez.
- Gereksinim şablondan kopyalanır ve kabulde sürüm kilitlenir (I-21).
- 'Tamamlandı' → evidence_pending (I-19). Kural motoru: count/duration/attendance/artifact/attestation/system_metric; 7/8 → partially_verified (T-24).
- Merdiven: declared → submitted → verified/partially_verified → kpi_confirmed → outcome_confirmed; her basamak ayrı raporlanır.
- Kanıt güveni modeli `packages/domain-core/src/evidence/confidence.ts` (mimari 10.4): coverage .30, sourceTrust .25, independence .15, temporal .15, crossConsistency .15, cezalar; ≥80 Yüksek, 60–79 Orta, <60 Düşük → review_required. Hash tekrarı yalnız ilişkisiz aksiyonlarda ceza (I-24). Beyan ile bağlayıcı metriği >%30 çelişiyorsa güven Düşük'e sabitlenir (`connector_contradicts_claim`).
- Sistem `rejected` yazamaz; insan kararı + gerekçe (I-22, T-22, T-23).
- SoD: kritik kanıtta verifier ≠ submitter ve vekili değil — politika (T-20).
- Dosya: SHA-256, virüs taraması, saklama sınıfı, imzalı süreli URL.

## API (özet; tam sözleşme docs/api/openapi-urun.json (ürün sözleşmesi; eski /api/v1 taslağı docs/api/arsiv altında, geçersiz))
GET /actions/{id}/evidence-requirement · POST /actions/{id}/complete (declare) · POST /actions/{id}/evidence (multipart | link | attestation) · POST /evidence/{id}/verify (verifier; If-Match) · POST /evidence/{id}/review-decision (verified|partially|rejected + reason) · GET /actions/{id}/verification (ladder, confidence, anomalies).

## Olaylar
`Action.CompletionDeclared`, `Evidence.Submitted/Verified/PartiallyVerified/ReviewRequired/Rejected`, `Evidence.AnomalyDetected`.

## Kabul kriterleri
T-20, T-22, T-23, T-24, T-25.
