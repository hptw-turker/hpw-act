import './load-env.js';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/** apps/api kökü: hem src (tsx) hem dist/src (derlenmiş) yerleşiminde package.json'a kadar yukarı çıkar. */
export const apiRoot = (() => { let d = dirname(fileURLToPath(import.meta.url)); for (let i = 0; i < 5; i++) { if (existsSync(join(d, 'package.json'))) return d; d = dirname(d); } return process.cwd(); })();
/** Ortam yapılandırması: DEMO ve BOŞ kurulumlar aynı koddan, farklı ortam dosyasıyla çalışır (ayrı DB, çerez adı, posta dizini, sırlar). Üretimde fail-closed doğrulama (R35). */
const env = process.env;
const bool = (v: string | undefined, d = false) => (v === undefined ? d : ['1', 'true', 'yes'].includes(v.toLocaleLowerCase('en-US')));
export const config = {
  envName: env.HPW_ENV ?? 'dev',                                   // demo | bos | dev | test | production
  port: Number(env.PORT ?? 8787),
  databaseUrl: env.DATABASE_URL ?? 'postgres://hpw_api:hpw_api@localhost:5432/hpw_act',
  migrateUrl: env.MIGRATE_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/hpw_act',
  sessionTtlHours: Number(env.SESSION_TTL_HOURS ?? 12),
  inviteTtlHours: Number(env.INVITE_TTL_HOURS ?? 72),
  resetTtlMinutes: Number(env.RESET_TTL_MINUTES ?? 60),
  appBaseUrl: env.APP_BASE_URL ?? `http://localhost:${env.PORT ?? 8787}`,
  cookieName: env.COOKIE_NAME ?? `hpw_session_${env.HPW_ENV ?? 'dev'}`,
  cookieSecure: bool(env.COOKIE_SECURE),
  smtpUrl: env.SMTP_URL ?? '',
  mailFrom: env.MAIL_FROM ?? '',                                     // doğrulanmış gönderen; yoksa SMTP gönderimi engellenir (R32)
  mailAllowlist: (env.MAIL_ALLOWLIST ?? '').split(',').map(s => s.trim().toLocaleLowerCase('en-US')).filter(Boolean), // dolu ise yalnız bu alıcılara gerçek gönderim
  mailDir: env.MAIL_DIR ? (env.MAIL_DIR.startsWith('/') ? env.MAIL_DIR : join(apiRoot, env.MAIL_DIR)) : join(apiRoot, 'var', `mail-${env.HPW_ENV ?? 'dev'}`),
  maxUploadBytes: Number(env.MAX_UPLOAD_BYTES ?? 15 * 1024 * 1024),
  /** v3.0.0 (ADR-0043): kapalı modüller (hedef/aksiyon/kanıt/uzlaştırma/AI/v2.15 yol haritası). Ürün varsayılanı KAPALI; test ortamında eski testler için açık. Her istekte okunur. */
  get legacyModules(): boolean { return env.HPW_LEGACY_MODULES ? env.HPW_LEGACY_MODULES === 'true' : (env.HPW_ENV ?? 'dev') === 'test'; },
  /** v3.0.0: iki adımlı doğrulama zorunluluğu (HPW personeli). Ürün varsayılanı KAPALI; test ortamında eski testler için açık. */
  get mfaRequired(): boolean { return env.HPW_MFA_REQUIRED ? env.HPW_MFA_REQUIRED === 'true' : (env.HPW_ENV ?? 'dev') === 'test'; },
  maxSheetRows: Number(env.MAX_SHEET_ROWS ?? 200000),
  webDist: env.WEB_DIST ?? join(apiRoot, '..', 'web', 'dist'),
  setupKey: env.SETUP_KEY ?? '',
  /** v3.0: ters vekil (Caddy) arkasında gerçek istemci adresi için atlanacak vekil sayısı; hız sınırı istemci adresine göre çalışır. Boşsa vekile güvenilmez. */
  trustProxy: /^\d+$/.test(env.TRUST_PROXY ?? '') ? Number(env.TRUST_PROXY) : false as number | false,
  demoData: bool(env.HPW_DEMO_DATA),                               // yalnız DEMO ortamında sentetik akran/etki istatistikleri gösterilir
  production: env.NODE_ENV === 'production' || env.HPW_ENV === 'production', // V290-05: iki göstergeden biri üretim diyorsa üretim kuralları uygulanır (çelişki ayrıca reddedilir)
  servePrototype: bool(env.HPW_SERVE_PROTOTYPE),
  migrationsDir: env.MIGRATIONS_DIR ?? join(apiRoot, '..', '..', 'db', 'migrations'),
  testOperatorMailbox: bool(env.HPW_TEST_OPERATOR_MAILBOX) && env.NODE_ENV !== 'production' && env.HPW_ENV !== 'production',   // parola bağlantıları yalnız test operatörü kutusunda (V09)                  // eski örnek verili prototip yalnız açıkça istenirse (N03)
  buildId: env.HPW_BUILD_ID ?? '',
  installId: env.HPW_INSTALL_ID ?? '',   // kalıcı kurulum kimliği (M03): süreç UUID'si değil, CALISTIRMA altındaki kimlik
  host: env.HOST ?? '127.0.0.1',                                 // yerel paket: yalnız loopback; yayın ayrı onay
};
/** V290-05: MFA sır şifreleme anahtarı biçimi — base64url (dolgu yok), en az 32 rastgele bayt (43+ karakter).
 * Üretim komutu: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"  (ya da: openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
 * Uzunluk ve karakter çeşitliliği denetimi entropi kanıtı değildir; anahtar yalnız yukarıdaki gibi kriptografik rastgele üreteçle üretilmelidir. Değer hiçbir zaman loglanmaz. */
export function mfaKeyProblem(name: string, v: string | undefined): string | null {
  if (v === undefined || v.trim() === '') return `${name} eksik`;
  if (!/^[A-Za-z0-9_-]+$/.test(v)) return `${name} base64url biçiminde değil (yalnız A–Z a–z 0–9 - _, dolgu yok)`;
  if (Buffer.from(v, 'base64url').length < 32) return `${name} en az 32 bayt (43+ karakter) olmalı`;
  if (new Set(v).size < 16) return `${name} rastgele üretilmiş görünmüyor (karakter çeşitliliği düşük)`;
  return null;
}
/** MFA anahtarı zorunlu ortamlar: üretim ve yerel paketler (bos/demo). Türetilmiş geri dönüş anahtarı yalnız açıkça dev/test ortamında. */
export const mfaFallbackAllowed = () => !config.production && (config.envName === 'dev' || config.envName === 'test');
export function validateConfig(): string[] {
  const problems: string[] = [];
  // V290-05: ortam göstergeleri çelişemez (biri üretim diğeri değilse güvenlik kontrolleri sessizce atlanmaz)
  if (env.NODE_ENV === 'production' && env.HPW_ENV !== 'production') problems.push(`NODE_ENV=production ile HPW_ENV=${env.HPW_ENV ?? '(yok)'} çelişiyor; üretimde ikisi de production olmalı`);
  if (env.HPW_ENV === 'production' && env.NODE_ENV !== 'production') problems.push(`HPW_ENV=production ile NODE_ENV=${env.NODE_ENV ?? '(yok)'} çelişiyor; üretimde ikisi de production olmalı`);
  if (!mfaFallbackAllowed()) { const k = mfaKeyProblem('HPW_MFA_KEY', env.HPW_MFA_KEY); if (k) problems.push(`${k} (MFA sırlarının şifreleme anahtarı; bkz. docs/MFA-ANAHTARI.md)`); }
  else if (env.HPW_MFA_KEY !== undefined) { const k = mfaKeyProblem('HPW_MFA_KEY', env.HPW_MFA_KEY); if (k) problems.push(k); }
  if (env.HPW_MFA_KEY_PREVIOUS !== undefined) { const k = mfaKeyProblem('HPW_MFA_KEY_PREVIOUS', env.HPW_MFA_KEY_PREVIOUS); if (k) problems.push(k); else if (env.HPW_MFA_KEY_PREVIOUS === env.HPW_MFA_KEY) problems.push('HPW_MFA_KEY_PREVIOUS yeni anahtarla aynı olamaz'); }
  if (env.HPW_ENV_FILE && !existsSync(env.HPW_ENV_FILE)) problems.push(`HPW_ENV_FILE bulunamadı: ${env.HPW_ENV_FILE} (sessizce atlanmaz, N04)`);
  if (!['demo', 'bos', 'dev', 'test', 'production'].includes(config.envName)) problems.push(`HPW_ENV geçersiz: ${config.envName}`);
  if (config.envName === 'demo' && config.smtpUrl && config.mailAllowlist.length === 0) problems.push('DEMO ortamında gerçek SMTP yalnız MAIL_ALLOWLIST ile (alıcı izin listesi zorunlu, N04)');
  if (config.envName === 'bos' && config.demoData) problems.push('BOŞ ortamda HPW_DEMO_DATA açık olamaz');
  if (config.production) {
    if (!config.setupKey) problems.push('SETUP_KEY zorunlu (bootstrap açık kalamaz)');
    if (!config.cookieSecure) problems.push('COOKIE_SECURE=true zorunlu');
    if (!/^https:\/\//.test(config.appBaseUrl)) problems.push('APP_BASE_URL https olmalı');
    if (/hpw_api:hpw_api@|postgres:postgres@/.test(config.databaseUrl)) problems.push('DATABASE_URL varsayılan parola içeriyor');
    if (config.smtpUrl && !config.mailFrom) problems.push('SMTP_URL varken MAIL_FROM (doğrulanmış gönderen) zorunlu');
  }
  return problems;
}
