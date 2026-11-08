# HPW Act — MFA sır şifreleme anahtarı (HPW_MFA_KEY)

v2.9.1 · V290-05 kapanışı. HPW personelinin doğrulama uygulaması sırları veritabanında AES-256-GCM ile şifreli durur. Şifreleme anahtarı veritabanında değil, sunucu ortamında tutulur; veritabanı yedeği ele geçse bile anahtar olmadan sırlar açılamaz.

## Biçim

- Değişken: `HPW_MFA_KEY`
- Biçim: base64url (A–Z a–z 0–9 `-` `_`, dolgu `=` yok), çözüldüğünde **en az 32 bayt** (en az 43 karakter).
- Sunucu başlangıçta biçimi, uzunluğu ve karakter çeşitliliğini denetler. Bu denetim entropi kanıtı değildir: anahtar **yalnız kriptografik rastgele üreteçle** üretilmelidir. El ile yazılmış, tahmin edilebilir ya da başka bir sistemden kopyalanmış değer kullanılmaz.

## Üretim

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```
ya da
```
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
```

Yerel paketlerde (BOŞ, DOLU) başlatıcı anahtarı ilk çalıştırmada bu yöntemle üretir ve `CALISTIRMA/.env.<ortam>` dosyasına yazar; v2.9.0'dan gelen kurulumda dosyada yoksa bir kez ekler. Değer ekrana ya da loglara yazılmaz.

## Hangi ortamda zorunlu

| Ortam | Kural |
|---|---|
| Üretim (`NODE_ENV=production` ya da `HPW_ENV=production`) | Zorunlu; eksik, boş, kısa ya da bozuk biçimde sunucu başlamaz. Türetilmiş yedek anahtar hiçbir koşulda kullanılmaz. |
| Yerel paket (`HPW_ENV=bos` / `demo`) | Zorunlu (başlatıcı üretir). |
| Geliştirme ve test (`HPW_ENV=dev` / `test`, üretim değil) | Verilmezse kurulum kimliğinden türetilen geliştirme anahtarı kullanılır; verilirse biçim denetlenir. |

`NODE_ENV` ile `HPW_ENV` çelişemez: biri `production` diğeri değilse sunucu başlamaz (güvenlik kontrolleri sessizce atlanmaz).

## Saklama

Anahtar, sunucu ortam dosyası ya da gizli bilgi kasasında tutulur; veritabanı yedeğiyle **aynı yerde** tutulmaz, ama kurtarma planında erişilebilir olmalıdır. Anahtar kaybolursa sırlar açılamaz: bu durumda personel yeniden kurulum yapar (aşağıda "Acil durum").

## Anahtar değişimi (rotasyon)

1. Yeni anahtarı üretin.
2. Eski değeri `HPW_MFA_KEY_PREVIOUS`, yenisini `HPW_MFA_KEY` olarak ayarlayıp sunucuyu yeniden başlatın. İki değer aynı olamaz; ikisi de biçim denetiminden geçer.
3. Her mühür, anahtarın kimliğini taşır (`v2.<anahtar kimliği>....`). Eski anahtarla mühürlü sır, sahibinin bir sonraki başarılı doğrulamasında yeni anahtarla yeniden mühürlenir.
4. Bütün personel en az bir kez giriş yaptıktan sonra `HPW_MFA_KEY_PREVIOUS` kaldırılır. Kalan (giriş yapmamış) personelin doğrulaması bu noktadan sonra açılamaz; bir Sistem Yöneticisi doğrulamalarını sıfırlar.

Toplu (giriş beklemeden) yeniden şifreleme betiği bu sürümde yoktur.

## v2.9.0'dan yükseltme

v2.9.0 sırları `v1` biçimindedir. Yükseltmede okunabilirler: `HPW_MFA_KEY`/`HPW_MFA_KEY_PREVIOUS` ham değeri ile ve — **yalnız üretim dışı ortamlarda** — v2.9.0'ın kurulum kimliğinden türettiği malzemeyle. Başarılı doğrulamada `v2` biçimine geçer. v2.9.0 kabul edilmiş bir üretim sürümü olmadığından üretimde türetilmiş malzemeyle okuma desteklenmez.

## Acil durum

Anahtar kaybı ya da bütün yöneticilerin doğrulamaya erişememesi: veritabanı operatörü `DELETE FROM platform_mfa WHERE user_id = '<kişi>'` ile ilgili kişinin kaydını siler ve `session` tablosundaki oturumlarını kapatır; kişi sonraki girişte yeniden kurulum yapar. İşlem tutanakla kaydedilir.
