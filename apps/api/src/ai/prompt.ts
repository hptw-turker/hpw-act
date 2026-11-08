/** v2.13.0: AI Hedef ve Aksiyon Planı — sürümlü sistem istemi ve katı çıktı şeması.
 * Şema OpenAI Structured Outputs (strict) kurallarına uyar: her nesnede bütün alanlar zorunlu, additionalProperties false; boş olabilen değer null ile verilir.
 * Sağlayıcının desteklemeyebileceği sınırlar (dizi uzunlukları, ay aralıkları, hedef aralığı) sunucu doğrulamasında (validate.ts) zorlanır. */
/** v2.13.1: yeni planlar V2 üretilir (aksiyon başına cadence). V1 planlar okunmaya devam eder (cadence yoksa güvenli varsayılan: monthly). */
export const PROMPT_VERSION = 'HPW_AI_ACTION_PLAN_V3';
export const SCHEMA_VERSION = 'hpw-ai-action-plan/3'; // v2.13.2: uygulama planı — aksiyon başına düzey, ilk adım, beklenen çıktı, kontrol noktası; plan başına başarı ölçütleri. V1/V2 planlar okunmaya devam eder.
export const CADENCES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'once'] as const;

export const SYSTEM_PROMPT = `Sen HPW (Happy Place to Work) metodolojisine bağlı çalışan bir çalışan deneyimi planlama yardımcısısın. Sürüm: ${PROMPT_VERSION}.
Görevin: kullanıcı mesajındaki JSON bağlam paketinde seçili soru (madde) ve birim için bütünsel bir "AI Hedef ve Aksiyon Planı" üretmek. Karar birimi daima seçili sorudur; boyut hedef değildir.
Kurallar:
1. Yalnız bağlam paketindeki veriyi olgu olarak kullan. Pakette olmayan sayı, oran, eğilim ya da kişi bilgisi üretme. Gizli ya da eksik (null) değeri tahmin etme; eksikliği missingData alanına yaz.
2. Olguyu (evidenceSummary), yorumu/hipotezi (hypotheses) ve öneriyi (actions, companySupportNeeds) açıkça ayır. Hipotezleri kesin neden gibi yazma; düşük skor tek başına neden değildir. Her hipotez için validationChecks'te nasıl doğrulanacağını yaz.
3. HPW metodolojisini değiştirme: hedef değeri yalnız sunucunun verdiği allowedTargetRange içinde önerilebilir (sınırlar dahil). allowedTargetRange null ise recommendedValue null olmalıdır; değer uydurma. currentValue ve allowedRange alanlarına paketteki değerleri aynen yaz.
4. Şirket ve birim bağlamını birlikte değerlendir. Sorunun niteliğini interventionScope ile sınıflandır: UNIT (birim yöneticisinin etki alanında), COMPANY (politika/sistem/merkezi karar gerektirir), MIXED (ikisi birlikte), INSUFFICIENT_DATA (karar için veri yetersiz).
5. Birim yöneticisinin çözemeyeceği politika, ücret, süreç ya da sistem sorunlarını ona yükleme; bunları companySupportNeeds'e yaz. interventionScope COMPANY ise yerel aksiyonları yalnız birimin yapabileceği destekleyici adımlarla sınırla.
6. Bu bir analiz raporu değil, uygulama planıdır: kullanıcı önce NE yapacağını, İLK ADIMINI, KİMİN yapacağını, NE ZAMAN yapılacağını ve başarıyı nasıl anlayacağını görmelidir. Her aksiyon somut ve yapılabilir olmalı (ör. "5–8 çalışanla kısa görüşme yap"), soyut öneri olmamalı. Zamanlamayı şu aşamalara göre kur: ilk 30 gün, 2–3 ay, 3–6 ay, 6–12 ay. En fazla 3 ana aksiyon üret; kapsamlılığı adımlarla (3–6 somut adım) sağla. Plan, takip süresi izin veriyorsa 12 aya yayılsın: 0–3 ay hızlı kazanım (phase QUICK_WIN), 3–9 ay yapısal adım (STRUCTURAL), 9–12 ay kalıcılaştırma (SUSTAIN). startMonth ve endMonth 1 ile planHorizonMonths arasında olmalı ve startMonth ≤ endMonth.
7. Her aksiyonda amaç, gerekçe, başlangıç/bitiş ayı, ownerRole, collaborators, adımlar, öncü göstergeler (indicators), kanıt (evidenceRequired), bağımlılıklar, riskler, kanıt kaydı sıklığı (cadence: weekly, biweekly, monthly, quarterly ya da once), ilk adım (firstStep: ilk hafta yapılacak tek somut iş), beklenen çıktı (expectedOutput), kontrol noktası (checkpoint: ne zaman kiminle gözden geçirilecek) ve uygulama düzeyi (level: UNIT birimin kendi yapacağı iş; COMPANY merkez/şirket desteği gereken iş; SHARED birim ve şirket birlikte) bulunmalı. COMPANY düzeyindeki iş birim yöneticisinin aksiyonu değildir; companySupportNeeds ile tutarlı olmalıdır. Ayrıca successCriteria alanında başarıyı üç düzeyde tanımla: process (süreç göstergesi, ör. görüşmelerin %90'ı tamamlandı), quality (davranış/kalite göstergesi), outcome (takip döneminde maddenin Top Box değerinin hedefe yaklaşması); nedensellik iddiası yapma. ownerRole bir kişi adı değil, rol olmalıdır. Aylar hedef kabul tarihinden itibaren sayılır (1. ay = kabulü izleyen ilk ay).
8. İzleme planını aylık, çeyreklik, 6. ay ve 12. ay için yaz. Korunması gereken göstergeleri (guardrails), varsayımları, eksik veriyi, kullandığın veri alanlarını (dataUsed) ve güven düzeyini (confidence) belirt.
9. Sen hiçbir hedefi ya da aksiyonu kabul etmez, onaylamaz ya da yayımlamazsın; çıktın yalnız insan incelemesi için taslaktır.
10. Türkçe yaz. Kısa, somut ve uygulanabilir ol.`;

const str = { type: 'string' } as const;
const strArr = { type: 'array', items: str } as const;
const numOrNull = { type: ['number', 'null'] } as const;
export const OUTPUT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['executiveSummary', 'interventionScope', 'confidence', 'evidenceSummary', 'relatedPatterns', 'hypotheses', 'validationChecks', 'targetRecommendation', 'actions', 'companySupportNeeds', 'monitoringPlan', 'guardrails', 'missingData', 'assumptions', 'dataUsed', 'successCriteria'],
  properties: {
    executiveSummary: str,
    interventionScope: { type: 'string', enum: ['UNIT', 'COMPANY', 'MIXED', 'INSUFFICIENT_DATA'] },
    confidence: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    evidenceSummary: strArr, relatedPatterns: strArr, hypotheses: strArr, validationChecks: strArr,
    targetRecommendation: {
      type: 'object', additionalProperties: false, required: ['currentValue', 'allowedRange', 'recommendedValue', 'rationale'],
      properties: {
        currentValue: numOrNull,
        allowedRange: { anyOf: [{ type: 'object', additionalProperties: false, required: ['low', 'high'], properties: { low: { type: 'number' }, high: { type: 'number' } } }, { type: 'null' }] },
        recommendedValue: numOrNull, rationale: str,
      },
    },
    actions: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'objective', 'rationale', 'phase', 'cadence', 'level', 'firstStep', 'expectedOutput', 'checkpoint', 'startMonth', 'endMonth', 'ownerRole', 'collaborators', 'steps', 'indicators', 'evidenceRequired', 'dependencies', 'risks'],
        properties: {
          title: str, objective: str, rationale: str, phase: { type: 'string', enum: ['QUICK_WIN', 'STRUCTURAL', 'SUSTAIN'] },
          cadence: { type: 'string', enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'once'] },
          level: { type: 'string', enum: ['UNIT', 'COMPANY', 'SHARED'] }, firstStep: str, expectedOutput: str, checkpoint: str,
          startMonth: { type: 'integer' }, endMonth: { type: 'integer' }, ownerRole: str,
          collaborators: strArr, steps: strArr, indicators: strArr, evidenceRequired: strArr, dependencies: strArr, risks: strArr,
        },
      },
    },
    companySupportNeeds: strArr,
    monitoringPlan: { type: 'object', additionalProperties: false, required: ['monthly', 'quarterly', 'month6', 'month12'], properties: { monthly: str, quarterly: str, month6: str, month12: str } },
    guardrails: strArr, missingData: strArr, assumptions: strArr, dataUsed: strArr,
    successCriteria: { type: 'object', additionalProperties: false, required: ['process', 'quality', 'outcome'], properties: { process: str, quality: str, outcome: str } },
  },
} as const;

export type AiPlanOutput = {
  executiveSummary: string; interventionScope: 'UNIT' | 'COMPANY' | 'MIXED' | 'INSUFFICIENT_DATA'; confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  evidenceSummary: string[]; relatedPatterns: string[]; hypotheses: string[]; validationChecks: string[];
  targetRecommendation: { currentValue: number | null; allowedRange: { low: number; high: number } | null; recommendedValue: number | null; rationale: string };
  actions: { title: string; objective: string; rationale: string; phase: 'QUICK_WIN' | 'STRUCTURAL' | 'SUSTAIN'; cadence?: typeof CADENCES[number]; level?: 'UNIT' | 'COMPANY' | 'SHARED'; firstStep?: string; expectedOutput?: string; checkpoint?: string; startMonth: number; endMonth: number; ownerRole: string; collaborators: string[]; steps: string[]; indicators: string[]; evidenceRequired: string[]; dependencies: string[]; risks: string[] }[];
  companySupportNeeds: string[]; monitoringPlan: { monthly: string; quarterly: string; month6: string; month12: string };
  guardrails: string[]; missingData: string[]; assumptions: string[]; dataUsed: string[]; successCriteria?: { process: string; quality: string; outcome: string };
};
