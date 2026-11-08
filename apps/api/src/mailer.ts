import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { withContext } from './db.js';
import { config } from './config.js';
/** E-posta işçisi (R32/R33): atomik kira ile kuyruktan alır (processing + lease), SMTP yapılandırılmış ve gönderen doğrulanmışsa gönderir; MAIL_ALLOWLIST doluysa yalnız izinli alıcılara.
    SMTP yoksa sandbox: var/mail-<env>/*.eml dosyası, transport 'sandbox' — gerçek teslimat değildir ve öyle etiketlenir. Kalıcı hata 5 denemeden sonra perm_fail. */
export async function runOutboxOnce(limit = 50): Promise<{ processed: number; transport: string; blocked: number }> {
  const transport = config.smtpUrl ? 'smtp' : 'sandbox';
  const rows = await withContext({ realm: 'worker' }, async tx => (await tx.query('SELECT * FROM outbox_claim($1)', [limit])).rows);
  let processed = 0, blocked = 0;
  for (const m of rows) {
    try {
      let messageId = `<${m.id}@hpw-act-${config.envName}>`;
      if (transport === 'smtp') {
        if (!config.mailFrom) throw Object.assign(new Error('MAIL_FROM tanımsız: doğrulanmış gönderen olmadan gerçek gönderim yapılmaz'), { perm: true });
        if (config.mailAllowlist.length && !config.mailAllowlist.includes(String(m.to_email).toLocaleLowerCase('en-US'))) { await withContext({ realm: 'worker' }, tx => tx.query('SELECT outbox_mark($1,$2,$3,$4,$5)', [m.id, 'blocked', transport, null, 'alıcı MAIL_ALLOWLIST dışında; gerçek gönderim engellendi'])); blocked++; continue; }
        const nm = await import('nodemailer'); const info = await nm.default.createTransport(config.smtpUrl).sendMail({ from: config.mailFrom, to: m.to_email, subject: m.subject, text: m.body_text, headers: { 'X-HPW-Env': config.envName } }); messageId = info.messageId;
      } else { mkdirSync(config.mailDir, { recursive: true }); writeFileSync(join(config.mailDir, `${m.id}.eml`), `To: ${m.to_email}\nSubject: ${m.subject}\nDate: ${new Date().toISOString()}\nX-Transport: sandbox\nX-HPW-Env: ${config.envName}\n\n${m.body_text}\n`); }
      await withContext({ realm: 'worker' }, tx => tx.query('SELECT outbox_mark($1,$2,$3,$4,$5)', [m.id, 'sent', transport, messageId, null]));
      if (m.invitation_id) await withContext({ realm: 'worker' }, tx => tx.query('UPDATE invitation SET status = $2, sent_at = now() WHERE id = $1 AND status IN ($3,$4)', [m.invitation_id, 'pending', 'ready', 'pending']).catch(() => null));
      processed++;
    } catch (e) { const perm = (e as { perm?: boolean }).perm; await withContext({ realm: 'worker' }, tx => tx.query('SELECT outbox_mark($1,$2,$3,$4,$5)', [m.id, perm ? 'perm_fail' : 'temp_fail', transport, null, String((e as Error).message).slice(0, 500)])); }
  }
  return { processed, transport, blocked };
}
