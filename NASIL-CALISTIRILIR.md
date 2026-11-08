# HPW Act — ne açılır, nasıl çalışır?

**İki farklı şey var; ikisi de bu pakette:**

1. **Prototip (tek dosya, çift tıkla açılır):** `hpw-act-prototip.html` — bütün ekranlar 13 rolle gezilir. İK Yöneticisi ve HPTW Sistem Yöneticisi menüsündeki **Excel ile kurulum** ekranından organizasyon, soru seti, anket sonuçları ve kullanıcı şablonları gerçek .xlsx olarak indirilir; doldurulan dosya yüklenir, doğrulanır (hata satırları kod + sayfa + satır + sütun), onaylanır; davetler sandbox gelen kutusuna düşer ve bağlantıdan parola belirlenir. Kayıtlar tarayıcı belleğinde (sessionStorage) tutulur; sekme kapanınca sıfırlanır. Bu dosya ZIP'in dışında ayrı verilir (apps/web'den `npm run build:single` ile üretilir).
2. **Ürün (çalışan uygulama):** `apps/web/dist/app.html` — ama bu dosya tek başına açılmaz. Giriş, şirket oluşturma, Excel yükleme, davet, hedef/aksiyon/kanıt gerçek bir sunucuya ve PostgreSQL'e yazar. Bir HTML dosyası veritabanına yazamaz; bu yüzden ürünün "tıkla-aç" sürümü yoktur, "kur-çalıştır" sürümü vardır.

## Ürünü çalıştırmak

Seçenek A — Docker (tek komut): `docker compose up --build` → tarayıcıda http://localhost:8787
Seçenek B — elle: PostgreSQL 16 + Node 22; adımlar `apps/api/README.md` içinde (createdb, migrate, grant, web build, npm start).

İlk açılışta platform yöneticisi yok. Oluşturmak için:
```
curl -X POST http://localhost:8787/api/platform/bootstrap -H 'Content-Type: application/json' -d '{"email":"admin@hptw.com","password":"Guclu-Parola-1","displayName":"HPW Yönetici"}'
```
Sonra http://localhost:8787 → giriş → Müşteriler → Yeni şirket → şirketi aç → Organizasyon / Soru seti / Dönemler / Kullanıcılar. Davet e-postaları SMTP verilmemişse `apps/api/var/mail/*.eml` dosyalarına yazılır; içindeki `#/davet/...` bağlantısıyla parola belirlenir.
