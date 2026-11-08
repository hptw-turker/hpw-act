/** v3.0 kişiler ve davetler: kim davet edildi, kim girdi; bekleyen davetleri gönder, tek kişiye yeniden gönder. */
import { useCallback, useEffect, useState } from 'react';
import { tt } from '../i18n';
import { api, commandApi, describeError } from '../api';
import { PROFILE_LABEL } from './Shell';

interface UserRow { membership_id: string; email: string; display_name: string; permission_profile: string; membership_status: string; roles: string | null; last_login_at: string | null; invitation: { status: string; sent_at: string | null; accepted_at: string | null; delivery: string | null } | null }

const invWord = (u: UserRow) => {
  if (u.last_login_at || u.invitation?.status === 'accepted') return tt('Giriş yaptı');
  const s = u.invitation?.status; if (!s) return '—';
  return s === 'pending' ? tt('Davet gönderildi') : s === 'ready' || s === 'draft' ? tt('Davet gönderilmedi') : s === 'expired' ? tt('Davetin süresi doldu') : s === 'revoked' ? tt('Davet iptal') : s;
};

export function People({ tid, compact }: { tid: string; compact?: boolean }) {
  const [rows, setRows] = useState<UserRow[] | null>(null); const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setRows(await api<UserRow[]>('GET', `/api/t/${tid}/users`)); } catch (e) { setErr(describeError(e)); } }, [tid]);
  useEffect(() => { void load(); }, [load]);
  const send = async (ids?: string[]) => { setBusy(true); setErr(null); setMsg(null);
    try { const r = await commandApi<{ sent?: number; queued?: number }>(`/api/t/${tid}/invitations/send`, ids ? { membershipIds: ids, resend: true } : {}); const n = r.sent ?? r.queued ?? 0; setMsg(n ? tt('{0} davet e-postası gönderildi.', n) : tt('Gönderilecek yeni davet yoktu.')); await load(); }
    catch (e) { setErr(describeError(e)); } finally { setBusy(false); } };
  const waiting = (rows ?? []).filter(u => u.invitation && ['ready', 'draft'].includes(u.invitation.status)).length;
  return <div className="v-field">
    {!compact ? <><h1 className="v-h1">{tt('Kişiler')}</h1><p className="v-sub">{tt('Kullanıcılar, Happy Place to Work tarafından yüklenen kullanıcı dosyasından gelir. Davetle gelen kişi parolasını kendisi belirler.')}</p></> : null}
    <div className="v-btns"><button type="button" className="v-btn" disabled={busy || !waiting} onClick={() => void send()}>{waiting ? tt('Bekleyen {0} daveti gönder', waiting) : tt('Bekleyen davet yok')}</button></div>
    {msg ? <p className="v-ok" role="status">{msg}</p> : null}
    {err ? <p className="v-alert" role="alert">{err}</p> : null}
    {rows ? <div className="v-tablewrap"><table className="v-table"><thead><tr><th>{tt('Kişi')}</th><th>{tt('Rol')}</th><th>{tt('Durum')}</th><th><span className="v-sr">{tt('İşlem')}</span></th></tr></thead>
      <tbody>{rows.map(u => <tr key={u.membership_id}><td><b>{u.display_name}</b><br /><span className="v-meta v-wrap">{u.email}</span></td><td>{PROFILE_LABEL(u.permission_profile)}{u.roles ? <><br /><span className="v-meta">{u.roles}</span></> : null}</td>
        <td>{u.membership_status !== 'active' ? tt('Erişimi kapalı') : invWord(u)}</td>
        <td>{u.membership_status === 'active' && !u.last_login_at && u.invitation && ['pending', 'expired'].includes(u.invitation.status) ? <button type="button" className="v-link" disabled={busy} onClick={() => void send([u.membership_id])}>{tt('Yeniden gönder')}</button> : null}</td></tr>)}</tbody></table></div> : <p className="v-meta">{tt('Yükleniyor…')}</p>}
  </div>;
}
