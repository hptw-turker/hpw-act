import { useI18n } from '../i18n';
/** Durum bir kelimedir, renk değil: caption ölçüsünde büyük harf. Kırmızı yalnız bölümün tek vurgusuysa ve çağıran verirse. */
export function StatusLabel({ status, red = false }: { status: string; red?: boolean }) {
  const { t } = useI18n();
  return <span className={`caption ${red ? 'red' : ''}`}>{t(`status.${status}`)}</span>;
}
