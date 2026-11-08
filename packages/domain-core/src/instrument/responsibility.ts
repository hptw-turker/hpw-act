import type { InstrumentItem, ResponsibilityCenter } from './types.js';
/** Sorumluluk merkezi → rol eşlemesi (varsayılan; tenant kurulumunda org_role'a bağlanır). İki etiket ayrı: sonucu izleyen (her zaman birim yöneticisi) ve müdahaleye yetkili. */
export interface RolePair { monitoringRole: string; interventionOwnerRole: string; controllability: number; targetable: boolean; }
export const CENTER_LABEL: Record<ResponsibilityCenter, string> = { line_manager: 'birim yöneticisi', team: 'ekip (yönetici kolaylaştırır)', hr_policy: 'İK politikası', talent_system: 'yetenek ve kariyer sistemi', central_function: 'merkezi fonksiyon', top_management: 'üst yönetim / kurumsal iletişim', employer_brand: 'işveren markası', outcome: 'sonuç (kaldıraç yok)', individual: 'kişisel eğilim' };
const CENTRAL_BY_LEVER: Record<string, string> = { bilgi_teknolojileri: 'Bilgi Teknolojileri', tesis: 'İdari İşler', donanim: 'İdari İşler', operasyon_planlama: 'Operasyon Planlama Müdürlüğü', isg: 'İş Sağlığı ve Güvenliği', vardiya_planlama: 'Operasyon Planlama Müdürlüğü' };
export function rolesForItem(item: InstrumentItem, unitName: string, unitType: 'branch' | 'call_center' | 'hq_department' | 'region' = 'branch'): RolePair {
  const mgr = `${unitName} Müdürü`;
  switch (item.responsibilityCenter) {
    case 'line_manager': return { monitoringRole: mgr, interventionOwnerRole: mgr, controllability: 0.9, targetable: true };
    case 'team': return { monitoringRole: mgr, interventionOwnerRole: `${mgr} (ekip kolaylaştırma)`, controllability: 0.7, targetable: true };
    case 'hr_policy': return { monitoringRole: mgr, interventionOwnerRole: 'İnsan Kaynakları Direktörlüğü', controllability: unitType === 'hq_department' ? 0.6 : 0.2, targetable: true };
    case 'talent_system': return { monitoringRole: mgr, interventionOwnerRole: 'Yetenek ve Kariyer Yönetimi (İK)', controllability: 0.3, targetable: true };
    case 'central_function': { const lever = item.leverTags.find(t => CENTRAL_BY_LEVER[t]); return { monitoringRole: mgr, interventionOwnerRole: lever ? CENTRAL_BY_LEVER[lever]! : 'Merkezi fonksiyon', controllability: 0.3, targetable: true }; }
    case 'top_management': return { monitoringRole: mgr, interventionOwnerRole: 'Genel Müdür / Kurumsal İletişim', controllability: 0.15, targetable: true };
    case 'employer_brand': return { monitoringRole: mgr, interventionOwnerRole: 'Kurumsal İletişim', controllability: 0.15, targetable: true };
    case 'outcome': return { monitoringRole: mgr, interventionOwnerRole: '—', controllability: 0, targetable: false };
    case 'individual': return { monitoringRole: mgr, interventionOwnerRole: '—', controllability: 0.1, targetable: false };
  }
}
