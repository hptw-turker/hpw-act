/** Yük sınırları domain politikasıdır (v2.3): yerel yönetici için en fazla 2 aktif yerel hedef ve 3 aktif aksiyon. Aşım istisna yoluyla (merkezi destek / alternatif sahip). */
export interface WorkloadPolicy { maxActiveLocalTargets: number; maxActiveActions: number; maxRecommendedOptions: number; }
export const DEFAULT_WORKLOAD_POLICY: WorkloadPolicy = { maxActiveLocalTargets: 2, maxActiveActions: 3, maxRecommendedOptions: 3 };
export type WorkloadCheck = { allowed: true } | { allowed: false; reason: 'max_active_actions' | 'max_active_local_targets'; suggestion: string };
/** Acil güvenlik / taciz / ciddi çalışan riski bildirimi sınıra takılmaz; ürün bunu mevcut kurumsal sürece (etik hattı, İSG) yönlendirir, vaka yönetimine dönüşmez. */
export function canOpenAction(activeActions: number, p: WorkloadPolicy = DEFAULT_WORKLOAD_POLICY, urgent = false): WorkloadCheck {
  if (urgent) return { allowed: true };
  return activeActions < p.maxActiveActions ? { allowed: true } : { allowed: false, reason: 'max_active_actions', suggestion: 'Mevcut aksiyonlardan biri tamamlanmadan yeni aksiyon açılması önerilmiyor; merkezi destek ya da alternatif sahip isteyin.' };
}
export function canAddLocalTarget(activeTargets: number, p: WorkloadPolicy = DEFAULT_WORKLOAD_POLICY): WorkloadCheck {
  return activeTargets < p.maxActiveLocalTargets ? { allowed: true } : { allowed: false, reason: 'max_active_local_targets', suggestion: 'Bir yönetici aynı anda en fazla iki yerel hedef taşır; üçüncüsü izleme listesinde kalır.' };
}
