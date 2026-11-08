import { ttLabel } from './i18n';
/** Türkçe arayüz etiketleri: sistem kodları ekranda Türkçe karşılığıyla gösterilir (kod değerleri API sözleşmesinde aynen kalır). */
const L: Record<string, string> = {
  HR_ADMIN: 'İK Yöneticisi', HR_PARTNER: 'İK İş Ortağı', EXEC: 'Üst Yönetim', REGION_MANAGER: 'Bölge Müdürü', UNIT_MANAGER: 'Birim Müdürü', ACTION_OWNER: 'Aksiyon Sorumlusu', VIEWER: 'İzleyici',
  work: 'iş', manager: 'yönetici', colleagues: 'çalışma arkadaşları', employer_brand: 'işveren markası', system: 'sistem/süreç', self: 'kişinin kendisi', outcome: 'sonuç',
  line_manager: 'birim yöneticisi', team: 'ekip', hr_policy: 'İK politikası', talent_system: 'yetenek sistemi', central_function: 'merkezi birim', top_management: 'üst yönetim', individual: 'bireysel',
  core: 'çekirdek', engagement: 'bağlılık', optional: 'isteğe bağlı', custom: 'ek',
  draft: 'taslak', frozen: 'kohort donduruldu', reconciling: 'uzlaştırılıyor', reconciled: 'uzlaştırıldı', superseded: 'eski sürüm', published: 'yayımlı', retired: 'emekli', withdrawn: 'geri çekildi', planned: 'planlandı', active: 'etkin',
  pending: 'bekliyor', aligned: 'uyumlu', contributing: 'katkı veriyor', no_local_target: 'yerel hedef yok', gap: 'fark var', unsupported: 'desteklenmiyor', exception: 'istisna', counterproposal: 'karşı teklif',
  counterproposal_accepted: 'karşı teklif kabul', counterproposal_rejected: 'karşı teklif ret', exception_accepted: 'istisna kabul',
  decision: 'karar', resource: 'kaynak', dependency: 'bağımlılık', budget: 'bütçe', orphan: 'sahipsiz birim', upgrade: 'sürüm geçişi',
  open: 'açık', in_review: 'incelemede', decided: 'karar verildi', closed: 'kapalı', approved: 'onaylandı', rejected: 'reddedildi', fulfilled: 'karşılandı', accepted: 'kabul edildi',
  low: 'düşük', normal: 'normal', high: 'yüksek', confirmed: 'onaylı', candidate: 'aday',
  weekly: 'haftalık', biweekly: 'iki haftada bir', monthly: 'aylık', quarterly: 'üç aylık', once: 'tek sefer',
  in_progress: 'devam ediyor', declared_complete: 'tamamlandı beyanı', paused: 'duraklatıldı', cancelled: 'iptal', current: 'güncel', pending_upgrade: 'sürüm geçişi bekliyor', upgraded: 'yükseltildi', hidden: 'gizli', critical: 'kritik', on_track: 'yolunda', at_risk: 'riskte', off_track: 'yoldan çıktı', verified: 'doğrulandı', needs_review: 'incelemeye iade', not_required: 'gerekmez', policy_accepted: 'politika ile kabul', rejected_evidence: 'kanıt reddedildi', under_review: 'incelemede', pending_acceptance: 'kabul bekliyor', proposed: 'önerildi', expired: 'süresi doldu', auto: 'kendiliğinden', human: 'insan onayı', independent: 'bağımsız doğrulama', planned_cycle: 'planlı', published_cycle: 'yayımlı', open_cycle: 'açık', setup: 'kurulum', collecting: 'toplanıyor', warning: 'uyarı', info: 'bilgi', provisional: 'geçici', final: 'kesin',
};
export const trl = (code: string | null | undefined): string => (code == null ? '' : ttLabel(code, L[code] ?? code));
