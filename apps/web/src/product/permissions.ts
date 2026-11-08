import { useMe } from './App';
import { useLoad, getJson } from './hooks';
import { DTO } from './dto';
/** F04: rol + şirket kapsamı + birim yetkisi + kayıt durumu. Kural tablosu sunucudaki PERMISSION_RULES ile aynıdır (sözleşme testi karşılaştırır);
 * sunucu yanıtı geldiğinde onun tablosu ve birim profili kullanılır. Arayüz kontrolü yalnız görünürlüktür; yetkinin kaynağı sunucudur. */
const U4 = ['HR_ADMIN', 'HR_PARTNER', 'REGION_MANAGER', 'UNIT_MANAGER'];
const UD = ['HR_ADMIN', 'HR_PARTNER', 'REGION_MANAGER', 'UNIT_MANAGER'];
export const RULES = {
  unit: { createTarget: U4, acceptTarget: U4, reviewTarget: ['HR_ADMIN', 'HR_PARTNER'], transferTarget: ['HR_ADMIN', 'HR_PARTNER'], createAction: U4, addEvidence: [...U4, 'ACTION_OWNER'], declareComplete: [...U4, 'ACTION_OWNER'], verify: ['HR_ADMIN', 'HR_PARTNER', 'REGION_MANAGER'], transition: U4, cancelAction: U4, transferAction: U4, followupReview: ['HR_ADMIN', 'HR_PARTNER'], cohortDecision: UD, respondDeployment: UD, upgradeDeployment: UD, resourceRequest: UD },
  tenant: { setup: ['HR_ADMIN', 'HR_PARTNER'], users: ['HR_ADMIN'], responsibilityMap: ['HR_ADMIN'], reorg: ['HR_ADMIN'], goLiveConfirm: ['HR_ADMIN'] },
  companyWide: { towerView: ['HR_ADMIN', 'EXEC', 'HR_PARTNER'], planningView: ['HR_ADMIN', 'EXEC', 'HR_PARTNER'], propose: ['HR_ADMIN', 'EXEC'], freeze: ['HR_ADMIN'], reconcile: ['HR_ADMIN'], publish: ['HR_ADMIN'], deploy: ['HR_ADMIN'], centralDecision: ['HR_ADMIN', 'EXEC'] },
  screens: { genel: ['HR_ADMIN', 'HR_PARTNER', 'EXEC', 'REGION_MANAGER', 'UNIT_MANAGER', 'ACTION_OWNER', 'VIEWER'], dikkat: ['HR_ADMIN', 'HR_PARTNER', 'EXEC', 'REGION_MANAGER', 'UNIT_MANAGER', 'ACTION_OWNER'], birimler: ['HR_ADMIN', 'HR_PARTNER', 'EXEC', 'REGION_MANAGER', 'UNIT_MANAGER', 'VIEWER'], hedefler: ['HR_ADMIN', 'HR_PARTNER', 'REGION_MANAGER', 'UNIT_MANAGER', 'VIEWER'], aksiyonlar: [...U4, 'ACTION_OWNER'], takip: U4, organizasyon: ['HR_ADMIN', 'HR_PARTNER'], soruSeti: ['HR_ADMIN', 'HR_PARTNER'], donemler: ['HR_ADMIN', 'HR_PARTNER'], yukle: ['HR_ADMIN', 'HR_PARTNER'], kullanicilar: ['HR_ADMIN'] , yolHaritasi: ['HR_ADMIN', 'HR_PARTNER', 'EXEC', 'REGION_MANAGER', 'UNIT_MANAGER', 'VIEWER']},
};
export type UnitAction = keyof typeof RULES.unit; export type CorpAction = keyof typeof RULES.companyWide; export type Screen = keyof typeof RULES.screens; export type TenantAction = keyof typeof RULES.tenant;
export type PlatformPerm = { role: 'admin' | 'consultant' | 'methodologist' | 'auditor' | null; capabilities: ('read' | 'setup' | 'methodology' | 'business')[]; tenantStatus: string | null; intervention: { id: string; endsAt: string; mine: boolean } | null; actionClass: Record<string, 'read' | 'setup' | 'methodology' | 'business'> };
type PermDto = { realm: string; profile: string | null; companyWide: boolean; unitId: string | null; unitProfile: string | null; rules: typeof RULES; platform?: PlatformPerm | null };
/** N02: yetki yanıtı yüklenirken, hata (403/503/ağ), boş ya da bozuk yanıtta hiçbir mutasyon kontrolü açılmaz; genel profilden birim yetkisi varsayılmaz.
 * Menü (ekran görünürlüğü) salt görüntüleme olduğu için sunucu yanıtı yokken oturum profiliyle çizilir; yetkinin kaynağı yine sunucudur. Bağlam anahtarı değişince eski yanıt kullanılmaz (useLoad). */
export function usePerms(tid: string, unitId?: string | null, fallbackProfile?: string | null) {
  const { me } = useMe();
  const q = useLoad<PermDto>(tid ? `${tid}|${unitId ?? ''}|${me?.userId ?? ''}` : null, getJson<PermDto>(`/api/t/${tid}/permissions${unitId ? `?unitId=${encodeURIComponent(unitId)}` : ''}`, DTO.permissions));
  const valid = q.status === 'ok' && !!q.data && (!unitId || q.data.unitId === unitId || q.data.unitId === null);
  const d = valid ? q.data! : null;
  const platform = (d ? d.realm : me?.realm) === 'platform';
  const profile = (d ? d.profile : null) ?? fallbackProfile ?? me?.profile ?? null;
  // v2.9.0: HPW personeli için düğmeler sunucunun verdiği platform yeteneklerinden (rol × sınıf × şirket durumu × müdahale); tüm düğmeler açık varsayılmaz
  const pl = d?.platform ?? null; const plCan = (key: string) => !!pl && pl.capabilities.includes(pl.actionClass[key] ?? 'business');
  const has = (list: string[] | undefined, p: string | null) => (!!p && Array.isArray(list) && list.includes(p));
  return {
    ready: valid, status: q.status, message: q.status === 'error' ? q.message : null, reload: q.reload, profile, companyWide: d ? d.companyWide : false, unitProfile: d ? d.unitProfile : null,
    platform: pl,
    can: (a: UnitAction) => !!d && !!unitId && (platform ? plCan(a) : has(d.rules.unit?.[a], d.unitProfile)),
    tenant: (a: TenantAction) => !!d && (platform ? plCan(a) : has(d.rules.tenant?.[a], d.profile)),
    corp: (a: CorpAction) => !!d && (platform ? plCan(a) : d.companyWide && has(d.rules.companyWide?.[a], d.profile)),
    screen: (s: Screen) => platform || has((d ? d.rules.screens : RULES.screens)?.[s], profile),
  };
}
