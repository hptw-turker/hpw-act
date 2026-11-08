# Mac açılışı ve HTTPS test ortamları — durum ve plan (v2.6.2, M01/M02)

## Dürüst durum
- Bu ortamda gerçek Mac yok; Apple Developer ID sertifikası ve Apple hesabı yok. Bu yüzden **Mac'te ilk açılış bu teslimatta doğrulanmadı** ve `.command` başlatıcısı Gatekeeper tarafından engellendiği için **Mac kabulü açık**. "Sağ tıkla → Aç" veya karantina kaldırma bir ürün çözümü değildir ve öyle sunulmuyor. Dosya uzantısı değiştirmek de çözüm değildir.
- Bu ortamda yayın izni, alan adı, TLS sertifikası ve barındırılan PostgreSQL yoktur; **HTTPS test ortamları yayınlanmadı** ve hazırmış gibi bağlantı üretilmedi.

## Öncelikli yol: iki bağımsız HTTPS test ortamı (kullanıcı için en kolay)
Gerekenler (onay/altyapı): (1) iki alt alan adı (örn. demo.hpw-act.<alan>, bos.hpw-act.<alan>) ve DNS yetkisi; (2) TLS (Let's Encrypt otomatik, Caddy/Traefik) ; (3) iki ayrı PostgreSQL 16 veritabanı/kümesi (ayrı servis hesapları), günlük yedek; (4) iki ayrı uygulama süreci (aynı build, farklı .env: HPW_ENV, DATABASE_URL, COOKIE_NAME, SETUP_KEY, MAIL_DIR); (5) posta: yalnız onaylı test alıcıları (MAIL_ALLOWLIST) veya sandbox; (6) erişim kontrolü: test kullanıcıları için IP/temel kimlik doğrulama katmanı önerilir; (7) canlı yayın onayı.
Teslimat: DOLU_DEMO/index.html ve BOS_BASLANGIC/index.html bu ortamların gerçek girişi olur (`__ORIGIN__` https adresine paketleme anında yazılır; build/ready/kurulum kimliği kontrolü aynen çalışır). Artefakt: `apps/api/Dockerfile` (bu turda eklendi) ve kökteki `docker-compose.yml`; bu ortamda Docker çalıştırılamadığı için **test edilmedi** ve "hazır" değil, plan durumundadır. Docker zorunlu değildir; aynı build Node 22 + PostgreSQL 16 ile doğrudan da çalışır (BASLAT betikleri).

## Yerel Mac dağıtımı gerekirse
Gerçek çözüm: Developer ID ile imzalı ve notarize edilmiş bir uygulama paketi (.app/.pkg) — Node ve PostgreSQL ikililerini içeren, `CALISTIRMA` mantığını (kurulum kimliği, readiness, verili yükseltme, defterler) bir launchd servisi olarak yöneten kurucu. Gerekenler: Apple Developer Program üyeliği, Developer ID Application/Installer sertifikaları, notarization; desteklenen gerçek Mac'lerde (Apple Silicon + Intel, güncel macOS/Safari) son ZIP'ten açılış testi. Bunlar bu ortamda yapılamaz; yapılmış gibi gösterilmiyor.

## Bu teslimatta yapılan (Linux'ta doğrulanan) başlatıcı sertleştirmesi
Kalıcı kurulum kimliği + readiness + build kontrolü her yolda; PG_VERSION yokken veri dizini korunuyor (silme yok); initdb geçici dizinde kurulup atomik devreye alınıyor; Node 22+/PostgreSQL 16+ ve veri dizini sürüm uyumu kontrolü; kısa boşluksuz socket dizini ve tırnaklama; demo geri yüklemesi defter + manifest (tablo sayıları) ile; .env yalnız kalıcı sırlar, dağıtım yolları ve build her açılışta; PID yeniden kullanımı kontrolü. Boşluklu/Türkçe karakterli klasör yolu Linux'ta denenmedi.
