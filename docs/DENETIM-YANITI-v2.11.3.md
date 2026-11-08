# HPW Act v2.11.3 — Bağımsız v2.11.2 yeniden denetimine yanıt (V2111-R1-A, V2111-R1-B, BOŞ 7h)

Yanıtlanan: "HPW Act v2.11.2 — bağımsız yeniden denetim" (build 39a2d66d1ee2, SHA-256 `8a682f82…0935`). Kapsam: iki devam senaryosu, BOŞ 7h kapanışı ve regresyonlar. Yeni özellik yok, yeni migrasyon yok (0001–0019 değişmedi). **Bağımsız kabul kararı denetçiye aittir; bu belge üretici kanıtıdır.**
Kanıt kökü: `GELISTIRICI_KAYNAK/docs/test-ciktilari/v2113/` (aşağıda `v2113/`). Türler: **[DB]** gerçek PostgreSQL + gerçek Fastify HTTP · **[UI]** gerçek tarayıcı + kontrollü HTTP (R1'de kontrollü saat ve Europe/Istanbul) · **[DB-KONTROLLÜ]** gerçek Fastify, sorgular düzenekte · **[PAKET]** teslim ZIP'i + gerçek başlatıcı + gerçek PostgreSQL.

## Denetçi testleri

`HPW-v2.11.2-Denetim-Kanitlari.zip`: 112 dosyalık envanter kendi `SHA256SUMS.json` listesiyle doğrulandı. `HPW-v2_11_2-Test-Betigi-Paketi.txt`: her dosyanın bayt uzunluğu ve SHA-256 değeri doğrulandı; ZIP'tekilerle bayt düzeyinde aynı. Önceki turların betikleri depodakilerle aynı. `tests/pending-ui.cjs` değiştirilmeden `tools/tests/bagimsiz-v2112/` altına alındı ve standart kapıya (B) bağlandı; tek ortam uyarlaması kök `pw.cjs` (`ADAPTASYON.md`). Etkileşim uyarlaması gerekmedi.

## Önce / sonra

| Test | Tür | Değiştirilmemiş v2.11.2 | v2.11.3 final paket | Kanıt |
|---|---|---|---|---|
| Denetçi `pending-ui.cjs` (aynı gün kontrol, gece yarısı, yeniden açma) | [UI] | **1/3** (gece yarısı ve yeniden açma başarısız) | **3/3** | önce: `v2113/baseline-v2112/pending-ui*`; sonra: `v2113/fe-paket/bagimsiz-v2112/pending-ui/` |
| Üretici V2113 matrisi (9): reddetme/erteleme × kaydedildi/kaydedilmedi × en erken/normal/en geç × gece yarısı, Vazgeç, Escape, alan değişimi (uygulanmış/uygulanmamış), çatışma sonrası yeniden onay | [UI] | — (yeni) | 9/9 | `v2113/fe-paket/ui-regresyon-sonuc.json` |
| Denetçi `edge-ui.cjs` (R1 ilk karşı örnek + R2) | [UI] | 7/7 | 7/7 | `v2113/fe-paket/bagimsiz-v2111/edge-ui/` |
| BOŞ turu 7h | [PAKET] | v2.11.2 ilk koşusunda 7h düştü (tanı: `v2112/bos-7h-tani/`) | üç ayrı temiz kurulumda 54/54, aynı seçim ve yollar | `v2113/bos-turlari/` |

## Bulgular

| Bulgu | Kök neden | Değişen dosyalar | Sonra |
|---|---|---|---|
| V2111-R1-A (gece yarısı) | Pencere onayı, dondurulmuş komut tekrarına ulaşmadan güncel tarih aralığını uyguluyordu; gün değişince en erken gün ilerliyordu | `apps/web/src/product/Dialog.tsx` (`dateBypass`, `reasonInitial`, `notice`), `apps/web/src/product/pages/WorkItems.tsx` | Aynı değerlerle onay = özgün komutun aynen yeniden gönderimi: bitiş anı gelecekteyse tarih aralığı uygulanmaz, aynı gövde/anahtar gider; bitiş anı geçmişse gönderilmez, sonuç güncel kayıttan doğrulanır. Yeni komutların tarih doğrulaması ve sunucunun 30/90 gün sınırı aynı |
| V2111-R1-B (kapatıp açma) | Satırdaki işlem düğmesi her açılışta dondurulmuş komutu siliyordu | `WorkItems.tsx` (bekleyen komut deposu pencere dışında; kapsam kullanıcı + şirket + iş + işlem; `Platform.tsx` kullanıcı kimliğini geçirir) | Vazgeç/Escape işlemi iptal etmez; yeniden açınca özgün değerler dolar ve bilgi gösterilir; aynı değerlerle devam aynı anahtarla. Alan değişiminde önce güncel kayıt okunur (uygulanmışsa kapanır; uygulanmamışsa açıkça söylenir, gönderim yapılmaz, ancak ikinci onayla yeni komut). Pencere kapalıyken liste işin beklenen duruma geçtiğini gösterirse bekleyen komut uzlaştırılır |
| BOŞ 7h kapanışı | Tur test verisi rastgele tohumlanan `hash()` ile üretiliyordu; şablon "monthly" metni/ilk seçenek yedeğiyle seçiliyordu | `tools/scripts/ui-bos-tur.py` (özgünleri `tools/scripts/arsiv/`) | Madde ve şablonlar sabit kodla: manuel yol GUR-01/`takdir-ritmi`, politika yolu BAS-02/`yetki-devri`; yoksa önkoşul hatasıyla durur; takip ölçümü verisi de `zlib.crc32`; yeni adımlar 7g2 (manuel yol doğrulama bekler) ve 7i (politika yolu POLICY_MET ile kapanır) |

Ürün tarafında BOŞ 7h için değişiklik yapılmadı; ürün, politika şablonunda kuralına uygun davranıyordu.

## Final paket üzerinde koşulanlar (build 090687250d70)

| Grup | Sonuç | Tür | Kanıt |
|---|---|---|---|
| API (paketlenen kaynakla; iki parça + sözleşme) | 50/50 + 45/45; yarış sırası pg_locks ile gözlendi; 1.142 gerçek yanıt 0 sapma; OpenAPI 112 uç güncel; 152 kural 0 sorun | [DB] | `v2113/api-parca1.log`, `api-parca2.log`, `api-sozlesme.log` |
| Domain | 70/70 | birim | `v2113/domain-test.log` |
| Kapı A (dil 1092/112/103, yetki + uç sınıfı, DTO⊆sözleşme 32 uç, istemci 5/5 + 10/10, denetçi tarayıcı 26/27 — LOGIN-ENTER belgeli istisna) | geçti | [UI]/tip | `v2113/fe-kabul-paket-A.log` |
| Kapı R (165 regresyon; tek koşu kimliği, dört parça 42+41+41+41) + C | 165/165; C geçti | [UI] | `v2113/fe-kabul-paket-R0…R3C.log` |
| Kapı B (bütün bağımsız karşı örnekler; v2.11.1 ve v2.11.2 denetçi betikleri dahil) | geçti | [UI]/[DB-KONTROLLÜ] | `v2113/fe-kabul-paket-B.log` |
| Kritik akışlar (66; iki parça) | Chromium 66/66 · Firefox 66/66 · **WebKit 65/66 (V2100-URL)** | [UI] | `v2113/motorlar-paket/` (kesilen/tekrarlanan koşular dahil) |
| BOŞ (üç temiz kurulum) / DOLU | 54/54 × 3 · 8/8 | [PAKET] | `v2113/bos-turlari/`, `demo-smoke.log` |
| Temiz kurulum | domain, web, API kurulum/derleme, 19 migrasyon, sözleşme --check, yapılandırma: 0 | kaynak | `v2113/temiz-kurulum.log` |
| v2.11.2 → v2.11.3 yükseltme | bütün sayımlar aynı; MFA, rol, atama, bekleyen iş kayıtları korunmuş | [PAKET] | `v2113/yukseltme-v2112/` |
| Migrasyonlar | 0001–0019 v2.11.2 ile AYNI; yeni yok | SHA-256 | `v2113/migrasyon-karsilastirma/sonuc.txt` |

Test aracı değişiklikleri ve gerekçeleri: `docs/TEST-DEGISIKLIKLERI-v2.10.0.md` (v2.11.3 ekleri: eski R1 alan testi yeni davranışa uyarlandı; V2110-ERTELE odak okuması anlık okuma yerine odağın gelmesini bekliyor). Not: kapı R koşusu V2110-ERTELE'nin önceki (anlık okuyan) haliyle koşuldu ve geçti; değişiklik yalnız sonraki motor koşularına yansıdı.

## Açık kalanlar

- WebKit V2100-URL: açık, neden belirlenemedi. Linux WebKit ≠ Safari.
- 20 şirket yükü, gerçek Safari/cihaz, ekran okuyucu, gerçek %200 yakınlaştırma, Genel bakış, Sistem ve teslimatlar, canlıya çıkış kapıları: açık.
- Önceki BOŞ 7h arızalarının (v2.10.0 ilk koşu) aynı nedenle oluştuğu kanıtlanmış değil.
