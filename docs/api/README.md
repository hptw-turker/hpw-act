# HPW Act API sözleşmesi

**Tek geçerli sözleşme:** `openapi-urun.json` (OpenAPI 3.1, sürüm = ürün sürümü). Çalışan Fastify rotalarından `apps/api/scripts/openapi-gen.mts` ile üretilir; `--check` modu rotalar değişip sözleşme güncellenmezse testi kırar (API test paketindeki sözleşme testi).

- Taban: `/api`. Şirket kapsamlı uçlar: `/api/t/{tid}/…`. `/api/v1` yoktur.
- Oturum: HttpOnly çerez (`/api/auth/login`, `/api/auth/me`, `/api/auth/logout`).
- Hata gövdesi: `{ error, message, details? }`; kodlar: 401 oturum, 403 yetki/kapsam, 404 yok/kapsam dışı, 409 çatışma ve idempotency durumları, 400/422 doğrulama, 429 hız sınırı, 500, 503.
- Gizlilik: gizli satırda sayısal alanlar `null` (asla 0), türetilmiş durumlar `hidden`.
- Idempotency: `Idempotency-Key` başlığı; `receipt_lost` = iş yapıldı, makbuz kayıp → istemci kaynağı yeniden okur.
- Sürüm çatışması: hedef kabulünde gövdede `expectedVersion`; uyuşmazsa 409 `version_changed`. `If-Match` kullanılmaz.
- Yetki özeti: `GET /api/t/{tid}/permissions?unitId=` (kural tablosu `apps/api/src/governance.ts`); arayüz görünürlüğü bununla, yetkinin kaynağı sunucu uçlarıdır.

`arsiv/openapi-v1-taslak-KULLANILMAZ.yaml`: v2.3 dönemi tasarım taslağıdır (`/api/v1`); ürünle uyumlu DEĞİLDİR, yalnız tarihçe için tutulur.
