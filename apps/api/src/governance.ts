/** Saf (bağımlılıksız) yönetişim ve yetki kural tablosu: sunucu uçları, /permissions yanıtı ve ön yüz sözleşme testi aynı kaynağı kullanır. */
export type Profile = 'HR_ADMIN' | 'HR_PARTNER' | 'EXEC' | 'REGION_MANAGER' | 'UNIT_MANAGER' | 'ACTION_OWNER' | 'VIEWER';
/** Yönetişim matrisi (P0-3): kurumsal istek önerir = HR_ADMIN/EXEC (şirket geneli); freeze+reconcile = HR_ADMIN; birim kararı (istisna/karşı teklif/farkı kabul) = birimde UNIT_MANAGER+/HRBP; ana aksiyon yayım/dağıtım = HR_ADMIN; merkezi karar = HR_ADMIN/EXEC (şirket geneli); Control Tower/kuyruk tam görünüm = şirket geneli roller (HR_ADMIN, EXEC, şirket geneli HR_PARTNER); kapsamlı HRBP yalnız kendi ağacı. Yerel hedef kurumsal isteğe göre DEĞİŞMEZ. */
export const GOVERNANCE = { propose: ['HR_ADMIN', 'EXEC'] as Profile[], freeze: ['HR_ADMIN'] as Profile[], reconcile: ['HR_ADMIN'] as Profile[], unitDecision: ['HR_ADMIN', 'HR_PARTNER', 'REGION_MANAGER', 'UNIT_MANAGER'] as Profile[], publish: ['HR_ADMIN'] as Profile[], deploy: ['HR_ADMIN'] as Profile[], centralDecision: ['HR_ADMIN', 'EXEC'] as Profile[], towerView: ['HR_ADMIN', 'EXEC', 'HR_PARTNER'] as Profile[] };
const U4: Profile[] = ['HR_ADMIN', 'HR_PARTNER', 'REGION_MANAGER', 'UNIT_MANAGER'];
/** F04: arayüz işlem görünürlüğü için TEK kural tablosu. Uçlardaki requireUnitProfile/requireProfile listeleriyle aynıdır (test/permissions-contract.test.ts sözleşme testi uçları rol rol çağırarak doğrular).
 * unit: birim bazlı profil (profileForUnit) ile; tenant: şirket profiliyle; companyWide: şirket geneli yetki ile; screens: menü ve doğrudan adres erişimi (kılavuz rol matrisi; sunucu okuma yetkisinden dar olabilir, geniş olamaz). Arayüz kontrolü sunucu yetkisinin yerine geçmez. */
export const PERMISSION_RULES = {
  unit: { createTarget: U4, acceptTarget: U4, reviewTarget: ['HR_ADMIN', 'HR_PARTNER'] as Profile[], transferTarget: ['HR_ADMIN', 'HR_PARTNER'] as Profile[], createAction: U4, addEvidence: [...U4, 'ACTION_OWNER'] as Profile[], declareComplete: [...U4, 'ACTION_OWNER'] as Profile[], verify: ['HR_ADMIN', 'HR_PARTNER', 'REGION_MANAGER'] as Profile[], transition: U4, cancelAction: U4, transferAction: U4, followupReview: ['HR_ADMIN', 'HR_PARTNER'] as Profile[], cohortDecision: GOVERNANCE.unitDecision, respondDeployment: GOVERNANCE.unitDecision, upgradeDeployment: GOVERNANCE.unitDecision, resourceRequest: GOVERNANCE.unitDecision },
  tenant: { setup: ['HR_ADMIN', 'HR_PARTNER'] as Profile[], users: ['HR_ADMIN'] as Profile[], responsibilityMap: ['HR_ADMIN'] as Profile[], reorg: ['HR_ADMIN'] as Profile[], goLiveConfirm: ['HR_ADMIN'] as Profile[] },
  companyWide: { towerView: GOVERNANCE.towerView, planningView: GOVERNANCE.towerView, propose: GOVERNANCE.propose, freeze: GOVERNANCE.freeze, reconcile: GOVERNANCE.reconcile, publish: GOVERNANCE.publish, deploy: GOVERNANCE.deploy, centralDecision: GOVERNANCE.centralDecision },
  screens: { genel: ['HR_ADMIN', 'HR_PARTNER', 'EXEC', 'REGION_MANAGER', 'UNIT_MANAGER', 'ACTION_OWNER', 'VIEWER'] as Profile[], dikkat: ['HR_ADMIN', 'HR_PARTNER', 'EXEC', 'REGION_MANAGER', 'UNIT_MANAGER', 'ACTION_OWNER'] as Profile[], birimler: ['HR_ADMIN', 'HR_PARTNER', 'EXEC', 'REGION_MANAGER', 'UNIT_MANAGER', 'VIEWER'] as Profile[], hedefler: ['HR_ADMIN', 'HR_PARTNER', 'REGION_MANAGER', 'UNIT_MANAGER', 'VIEWER'] as Profile[], aksiyonlar: [...U4, 'ACTION_OWNER'] as Profile[], takip: U4, organizasyon: ['HR_ADMIN', 'HR_PARTNER'] as Profile[], soruSeti: ['HR_ADMIN', 'HR_PARTNER'] as Profile[], donemler: ['HR_ADMIN', 'HR_PARTNER'] as Profile[], yukle: ['HR_ADMIN', 'HR_PARTNER'] as Profile[], kullanicilar: ['HR_ADMIN'] as Profile[], yolHaritasi: ['HR_ADMIN', 'HR_PARTNER', 'EXEC', 'REGION_MANAGER', 'UNIT_MANAGER', 'VIEWER'] as Profile[] },
};

/** v2.9.0 (tasarım v2 bölüm 3): HPW platform rolleri ve şirket içi uç sınıfları.
 * Her şirket içi yazma ucu tek bir sınıfa aittir; GET uçları 'read'. Sınıfı olmayan yazma ucu için API testi derlemeyi düşürür. */
export type PlatformRole = 'admin' | 'consultant' | 'methodologist' | 'auditor';
export type RouteClass = 'read' | 'setup' | 'methodology' | 'business';
export const ROUTE_CLASS: Record<string, RouteClass> = {
  'POST /api/t/:tid/ai/config': 'setup', 'POST /api/t/:tid/ai/config/remove': 'setup', 'POST /api/t/:tid/targets/:ltid/ai-plan': 'business', 'POST /api/t/:tid/ai-plans/:pid/actions': 'business', 'POST /api/t/:tid/cycles/:cid/units/:uid/items/:code/ai-plan': 'business', 'POST /api/t/:tid/ai-plans/:pid/bind': 'business', /* v2.13.1 */ // v2.13.0 (AI uçları yalnız müşteri oturumuna açık)
  'POST /api/t/:tid/org/units': 'setup', 'POST /api/t/:tid/org/roles': 'setup', 'POST /api/t/:tid/org/units/:uid/move': 'setup', 'POST /api/t/:tid/org/units/:uid/absorb': 'setup',
  'POST /api/t/:tid/responsibility-map': 'setup', 'POST /api/t/:tid/responsibility-map/:mid/retire': 'setup', 'POST /api/t/:tid/instruments': 'setup',
  'POST /api/t/:tid/cycles': 'setup', 'PATCH /api/t/:tid/cycles/:cid': 'setup', 'POST /api/t/:tid/imports/:kind': 'setup', 'POST /api/t/:tid/imports/:jid/commit': 'setup',
  'POST /api/t/:tid/users': 'setup', 'POST /api/t/:tid/users/:mid/revoke': 'setup', 'POST /api/t/:tid/invitations/send': 'setup',
  'POST /api/t/:tid/instruments/equivalence': 'methodology', 'POST /api/t/:tid/targets/:ltid/followup/review': 'methodology',
  'POST /api/t/:tid/cycles/:cid/units/:uid/targets': 'business', 'POST /api/t/:tid/targets/:ltid/accept': 'business', 'POST /api/t/:tid/targets/:ltid/review': 'business', 'POST /api/t/:tid/targets/:ltid/transfer': 'business', 'POST /api/t/:tid/targets/:ltid/actions': 'business', 'POST /api/t/:tid/targets/:ltid/followup/assess': 'business',
  'POST /api/t/:tid/actions/:aid/evidence': 'business', 'POST /api/t/:tid/actions/:aid/plan-steps/:idx/done': 'business', 'POST /api/t/:tid/actions/:aid/declare-complete': 'business', 'POST /api/t/:tid/actions/:aid/verify': 'business', 'POST /api/t/:tid/actions/:aid/transition': 'business', 'POST /api/t/:tid/actions/:aid/transfer': 'business',
  'POST /api/t/:tid/attention/:key/snooze': 'business',
  'POST /api/t/:tid/roadmap-steps/:sid/status': 'business', 'POST /api/t/:tid/roadmap-milestones/:mid/status': 'business', // v2.15.0 yol haritası takibi
  'POST /api/t/:tid/rm2-steps/:sid': 'business', // v3.0.0 sade yol haritası
  'POST /api/t/:tid/corporate/ambitions': 'business', 'POST /api/t/:tid/corporate/ambitions/:aid/freeze': 'business', 'POST /api/t/:tid/corporate/ambitions/:aid/reconcile': 'business', 'POST /api/t/:tid/corporate/ambitions/:aid/units/:uid/decision': 'business',
  'POST /api/t/:tid/corporate/master-actions': 'business', 'POST /api/t/:tid/corporate/master-actions/:mid/deploy': 'business', 'POST /api/t/:tid/corporate/deployments/:did/respond': 'business', 'POST /api/t/:tid/corporate/deployments/:did/upgrade': 'business', 'POST /api/t/:tid/corporate/deployments/:did/link': 'business',
  'POST /api/t/:tid/corporate/queue/:qid/decide': 'business', 'POST /api/t/:tid/corporate/resource-requests': 'business',
  'POST /api/t/:tid/onboarding/go-live/confirm': 'business', // müşteri teyidi: HPW (müdahale dahil) yapamaz; uç ayrıca yalnız müşteri alanına açık
};
/** Rol × sınıf (3.3). 'business' Sistem Yöneticisi için yalnız etkin müdahale modunda açılır. Durdurulmuş şirkette yalnız 'read' (K6). */
export const PLATFORM_CAN: Record<PlatformRole, RouteClass[]> = { admin: ['read', 'setup', 'methodology', 'business'], consultant: ['read', 'setup'], methodologist: ['read', 'methodology'], auditor: ['read'] };
export function platformAllows(role: PlatformRole | null, cls: RouteClass, tenantStatus: string | null, interventionActive: boolean): { ok: boolean; reason?: 'no_role' | 'suspended' | 'role' | 'intervention_required' } {
  if (!role) return { ok: false, reason: 'no_role' };
  if (cls !== 'read' && tenantStatus !== 'active') return { ok: false, reason: 'suspended' };
  if (!PLATFORM_CAN[role].includes(cls)) return { ok: false, reason: 'role' };
  if (cls === 'business' && !interventionActive) return { ok: false, reason: 'intervention_required' };
  return { ok: true };
}
/** Ön yüz işlem anahtarlarının platform sınıfı (permissions ucu ve arayüz aynı tabloyu kullanır) */
export const PLATFORM_ACTION_CLASS: Record<string, RouteClass> = {
  createTarget: 'business', acceptTarget: 'business', reviewTarget: 'business', transferTarget: 'business', createAction: 'business', addEvidence: 'business', declareComplete: 'business', verify: 'business', transition: 'business', cancelAction: 'business', transferAction: 'business', followupReview: 'methodology', cohortDecision: 'business', respondDeployment: 'business', upgradeDeployment: 'business', resourceRequest: 'business',
  setup: 'setup', users: 'setup', responsibilityMap: 'setup', reorg: 'setup', goLiveConfirm: 'business',
  towerView: 'read', planningView: 'read', propose: 'business', freeze: 'business', reconcile: 'business', publish: 'business', deploy: 'business', centralDecision: 'business',
};
