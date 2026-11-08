import type { Conflict } from '../api/envelope';
import { useI18n } from '../i18n';
import { Button } from './Button';
/** 409: sürüm çatışması değişen alanlarla; anlamsal çatışma seçeneklerle. Siyah-beyaz kutu, kırmızı yok. */
const FIELD: Record<string, string> = { target_date: 'hedef tarihi', owner_person_id: 'sahip', approved_target: 'onaylı hedef', due_date: 'termin', status: 'durum' };
export function ConflictNotice({ conflict, onReload, onAttachAsComment }: { conflict: Conflict; onReload: () => void; onAttachAsComment?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="notice notice--ink stack-1" role="alert">
      <p className="bold">{t('target.conflict')}</p>
      {conflict.kind === 'version'
        ? <p>{conflict.changedBy} · sürüm {conflict.yourVersion} → {conflict.currentVersion} · değişen: {conflict.changedFields.map(f => FIELD[f] ?? f).join(', ')}</p>
        : <p>{conflict.reason === 'aggregate_cancelled' ? 'Kayıt bu arada iptal edilmiş' : conflict.reason === 'aggregate_closed' ? 'Kayıt bu arada kapatılmış' : 'Birim bu arada kapatılmış'} · {conflict.occurredAt}</p>}
      <div className="row">
        <Button onClick={onReload}>{t('target.reload')}</Button>
        {conflict.kind === 'semantic' && onAttachAsComment ? <Button variant="secondary" onClick={onAttachAsComment}>Yorum olarak ekle</Button> : null}
      </div>
    </div>
  );
}
