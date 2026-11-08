/** Enstrüman modeli (v2.4): anket-agnostik. Takip birimi MADDE (soru); boyut ve indeks türetilmiş toplamlardır.
    Şirket boyut çıkarabilir, madde ekleyebilir; sistem sonuç paketinden enstrümanı algılar ve panelleri türetir. */
export type ItemScale = 'likert5_topbox' | 'likert5_mean' | 'nps_0_10' | 'binary' | 'custom';
export type Polarity = 'positive' | 'negative';
/** Deneyimin oluştuğu etkileşim alanı (HPTW modeli): işim, yöneticim, çalışma arkadaşlarım, işveren markası; ek: sistem/politika, kişisel eğilim, sonuç. */
export type InteractionArea = 'work' | 'manager' | 'colleagues' | 'employer_brand' | 'system' | 'self' | 'outcome';
/** Sorumluluk merkezi: maddenin hangi kaldıraçla ve kimin yetkisiyle değişebileceği. Sahip her zaman bir organizasyonel roldür; buradaki değer varsayılan eşlemedir, tenant kurulumunda role bağlanır. */
export type ResponsibilityCenter = 'line_manager' | 'team' | 'hr_policy' | 'talent_system' | 'central_function' | 'top_management' | 'employer_brand' | 'outcome' | 'individual';
export type ItemOrigin = 'core' | 'module' | 'custom';

export interface InstrumentDimension { code: string; name: string; nameEn?: string; category?: string; module: 'core' | 'ecosystem' | 'engagement' | 'custom'; }
export interface InstrumentItem {
  code: string; text: string; textEn?: string; dimensionCode?: string; scale: ItemScale; polarity: Polarity;
  interactionArea: InteractionArea; responsibilityCenter: ResponsibilityCenter; origin: ItemOrigin;
  /** Merkezi fonksiyon için kaldıraç etiketi (IT, tesis, operasyon planlama, İSG…) ve aksiyon kütüphanesi eşleşmesi. */
  leverTags: string[];
}
export interface InstrumentIndex { code: string; name: string; nameEn?: string; rule: 'mean_of_items' | 'mean_of_dimensions'; members: string[]; purpose: 'certification' | 'report'; }
export interface InstrumentVersion {
  instrumentCode: string; version: string; language: string; scoringRuleVersion: string;
  dimensions: InstrumentDimension[]; items: InstrumentItem[]; indices: InstrumentIndex[];
}
/** Metrik türü: takip (hedef, aksiyon, kanıt, sonuç) yalnız 'item' üzerinde; 'dimension' ve 'index' görünüm ve projeksiyon. */
export type MetricKind = 'item' | 'dimension' | 'index';
