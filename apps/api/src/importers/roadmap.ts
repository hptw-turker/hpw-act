import type { Tx } from '../db.js';
import { buildWorkbook, num, int, isoDate, type Sheet, type TemplateSheet } from '../xlsx.js';
import { Report } from '../validation.js';
import { checkTenantCode, TEMPLATE_VERSION, tenantInfo, type Importer, type ImportCtx, type ValidationResult } from './common.js';

/** v2.15.0 — Yol haritası formu (sunumla birebir). HPTW birim raporunun "Yol Haritası" bölümü bu formla HPW Act'e aktarılır.
 * İlke: sunumdaki metin ve sayılar AYNEN taşınır, HPW Act yeniden hesaplamaz ve değiştirmez. Çalışan alıntıları için alan yoktur (gizlilik).
 * Takip edilen: eylem planı adımları (IK, YONETIM) ve eylem planı takvimi (kilometre taşları). CALISAN adımları yalnız gösterilir. */
export const ROADMAP_FORM_VERSION = 'yh-1';
export const ROLE_CODES = ['IK', 'YONETIM', 'CALISAN'] as const;
const KINDS_PRACTICE = ['QUESTION', 'PRACTICE']; const KINDS_ROLE = ['DUTY', 'EXPECTED']; const DIRECTIONS = ['INCREASE', 'DECREASE', 'MAINTAIN'];

type C = { key: string; header: string; width?: number; list?: string[]; required?: boolean; desc: string; type: 'metin' | 'kod' | 'sayı' | 'tamsayı' | 'tarih' | 'seçim' };
const col = (key: string, desc: string, type: C['type'] = 'metin', o: Partial<C> = {}): C => ({ key, header: key, desc, type, ...o });
const U = col('unit_code', 'Organizasyondaki birim kodu (Organizasyon şablonundaki unit_code ile aynı).', 'kod', { required: true });
/** Formun TEK tanımı: şablon, sözlük ve doğrulama bu tablodan üretilir. Sayfa sırası sunumdaki bölüm sırasıdır. */
export const FORM: { name: string; title: string; perUnit: boolean; cols: C[] }[] = [
  { name: 'Rapor', title: 'Rapor bilgisi (tek satır)', perUnit: false, cols: [
    col('tenant_code', 'Şirket kodu (kontrol alanı; yetki vermez).', 'kod', { required: true }), col('cycle_code', 'Dönem kodu; formun yüklendiği dönemle aynı olmalı.', 'kod', { required: true }),
    col('report_title', 'Raporun adı (ör. "Ant Yapı 2026 Çalışan Deneyimi ve Bağlılık Raporu").', 'metin', { required: true, width: 50 }),
    col('company_label', 'Sunumda şirket genelinin adı (ör. "Ant Yapı geneli").', 'metin', { required: true, width: 24 }),
    col('start_date', 'Yol haritasının başladığı gün (YYYY-AA-GG); "İlk 30 gün" gibi terminler buna göre hesaplanır. Genellikle sunumun yapıldığı gün.', 'tarih', { required: true }),
    col('source_note', 'Kaynak notu (ör. sunum dosya adları).', 'metin', { width: 50 })] },
  { name: 'Birimler', title: 'Birim raporu üst bilgileri', perUnit: true, cols: [U,
    col('unit_label', 'Sunumdaki birim adı.', 'metin', { required: true, width: 30 }), col('sector_label', 'Karşılaştırma sektörü (ör. "Turizm sektörü").'),
    col('headcount', 'Ölçüm dönemindeki kadro.', 'tamsayı'), col('participants', 'Anketi tamamlayan.', 'tamsayı'), col('participation_rate', 'Katılım oranı (%; 0–100).', 'sayı'), col('cert_score', 'Sertifikasyon puanı (%; 0–100).', 'sayı'),
    col('conclusion_title', 'Ana sonuç slaytının başlığı.', 'metin', { width: 40 }), col('conclusion_headline', 'Ana sonuç cümlesi (büyük yazı).', 'metin', { required: true, width: 60 }), col('conclusion_body', 'Ana sonuç paragrafları; paragraflar arasında satır sonu (Alt+Enter).', 'metin', { width: 80 }),
    col('priority_summary', '"Güçlü yönler ve öncelikler" slaytının alt paragrafı.', 'metin', { width: 60 }), col('influence_principle', '"Etki alanı" slaytındaki VERİ İLKESİ metni.', 'metin', { width: 60 }),
    col('agenda_title', '"Birimin gündemi" slaytının başlığı.', 'metin', { width: 60 }), col('agenda_subtitle', '"Birimin gündemi" slaytının alt başlığı.', 'metin', { width: 60 }),
    col('practice_principle', '"Uygulama adımları" slaytındaki TEMEL İLKE metni.', 'metin', { width: 60 }), col('monitoring_approach', '"İzleme ve hedefler" slaytındaki İZLEME YAKLAŞIMI metni; maddeler arasında satır sonu.', 'metin', { width: 60 })] },
  { name: 'Guclu_Yonler', title: 'Görece güçlü yönler', perUnit: true, cols: [U, col('order', 'Sıra (1, 2, …).', 'tamsayı', { required: true }), col('title', 'Güçlü yön başlığı.', 'metin', { required: true, width: 26 }), col('text', 'Açıklama cümlesi.', 'metin', { width: 70 })] },
  { name: 'Oncelikler', title: 'Üç gelişim önceliğinin birimdeki karşılığı', perUnit: true, cols: [U, col('priority_no', 'Öncelik numarası (1–3).', 'tamsayı', { required: true }), col('title', 'Öncelik başlığı.', 'metin', { required: true, width: 50 }),
    col('short_title', 'Rol ve takvim slaytlarındaki kısa ad (ör. "Eğitim ve gelişim").', 'metin', { width: 24 }), col('rationale', 'Gerekçe cümlesi.', 'metin', { width: 50 }), col('finding', 'Bulgu cümlesi ("Bulgu:" yazmadan).', 'metin', { width: 70 }), col('area_label', 'Alan etiketi (ör. "Çalışma Ekosistemi · Eğitim ve Gelişim").', 'metin', { width: 36 })] },
  { name: 'Oncelik_Uygulamalari', title: 'Uygulama adımları: değerlendirme soruları ve önerilen uygulamalar', perUnit: true, cols: [U, col('priority_no', 'Öncelik numarası (1–3).', 'tamsayı', { required: true }), col('kind', 'QUESTION değerlendirme sorusu; PRACTICE önerilen uygulama.', 'seçim', { list: KINDS_PRACTICE, required: true }), col('order', 'Sıra.', 'tamsayı', { required: true }), col('text', 'Metin.', 'metin', { required: true, width: 80 })] },
  { name: 'Etki_Alani', title: 'Etki alanı: üç rolün genel görevleri', perUnit: true, cols: [U, col('role_code', 'IK, YONETIM ya da CALISAN.', 'seçim', { list: [...ROLE_CODES], required: true }), col('role_label', 'Sunumdaki rol adı (ör. "Ant Yapı İnsan Kaynakları").', 'metin', { required: true, width: 30 }), col('tagline', 'Rolün kısa tanımı (ör. "Ölçer, karşılaştırır…").', 'metin', { width: 40 }), col('order', 'Sıra.', 'tamsayı', { required: true }), col('duty', 'Görev maddesi.', 'metin', { required: true, width: 60 })] },
  { name: 'Gundem', title: 'Birimin gündemi (konular)', perUnit: true, cols: [U, col('theme_no', 'Konu numarası.', 'tamsayı', { required: true }), col('title', 'Konu adı.', 'metin', { required: true, width: 36 }), col('mentions', 'Yorumda değinen çalışan sayısı.', 'tamsayı'), col('commenters', 'Yorum yazan çalışan sayısı.', 'tamsayı')] },
  { name: 'Gundem_Gostergeleri', title: 'Gündem konularının anket göstergeleri', perUnit: true, cols: [U, col('theme_no', 'Gundem sayfasındaki konu numarası.', 'tamsayı', { required: true }), col('order', 'Sıra.', 'tamsayı', { required: true }), col('label', 'Sunumdaki gösterge adı.', 'metin', { width: 44 }), col('item_code', 'Gösterge bir madde ise madde kodu (Soru seti).', 'kod'), col('dimension_code', 'Gösterge bir boyut ise boyut kodu.', 'kod'), col('unit_value', 'Birim değeri (%).', 'sayı'), col('company_value', 'Şirket geneli değeri (%).', 'sayı'), col('note', 'Gösterge yerine not (ör. "Ankette doğrudan soru yer almaz…").', 'metin', { width: 50 })] },
  { name: 'Eylem_Planlari', title: 'Eylem planları', perUnit: true, cols: [U, col('plan_no', 'Plan numarası (sunumdaki sıra).', 'tamsayı', { required: true }), col('theme_no', 'İlgili gündem konusu numarası.', 'tamsayı'), col('title', 'Plan başlığı (konu adı).', 'metin', { required: true, width: 36 }),
    col('headline', 'Slayt başlık cümlesi.', 'metin', { required: true, width: 80 }), col('mentions', 'Konuya değinen çalışan sayısı.', 'tamsayı'), col('commenters', 'Yorum yazan çalışan sayısı.', 'tamsayı'), col('data_note', 'Veri dayanağı notu (ör. "Ankette bu konuya doğrudan soru yer almaz.").', 'metin', { width: 50 }),
    col('measure_label', 'İzlenecek ölçüt adı (sayısal ölçüt yoksa boş).', 'metin', { width: 40 }), col('measure_item_code', 'İzlenecek ölçüt bir madde ise madde kodu.', 'kod'), col('measure_current', 'Mevcut değer (%).', 'sayı'), col('measure_company', 'Şirket geneli (%).', 'sayı'), col('measure_target', 'Hedef (%).', 'sayı'), col('measure_rule', 'Hedef kuralı (ör. "mevcut + 2,5 puan").', 'metin', { width: 22 }),
    col('measure_text', 'İZLENECEK ÖLÇÜT metninin tamamı (sunumdaki gibi).', 'metin', { required: true, width: 80 })] },
  { name: 'Eylem_Dayanaklari', title: 'Eylem planı veri dayanağı', perUnit: true, cols: [U, col('plan_no', 'Plan numarası.', 'tamsayı', { required: true }), col('order', 'Sıra.', 'tamsayı', { required: true }), col('label', 'Gösterge adı.', 'metin', { required: true, width: 44 }), col('item_code', 'Madde kodu.', 'kod'), col('dimension_code', 'Boyut kodu.', 'kod'), col('unit_value', 'Birim değeri (%).', 'sayı'), col('company_value', 'Şirket geneli (%).', 'sayı')] },
  { name: 'Eylem_Adimlari', title: 'Eylem planı adımları (rol sütunları)', perUnit: true, cols: [U, col('plan_no', 'Plan numarası.', 'tamsayı', { required: true }), col('role_code', 'IK, YONETIM ya da CALISAN.', 'seçim', { list: [...ROLE_CODES], required: true }), col('role_label', 'Sunumdaki sütun başlığı.', 'metin', { required: true, width: 30 }), col('order', 'Sütun içindeki sıra.', 'tamsayı', { required: true }), col('text', 'Adım metni (sunumdaki gibi).', 'metin', { required: true, width: 90 })] },
  { name: 'Eylem_Takvimi', title: 'Eylem planı takvimi', perUnit: true, cols: [U, col('plan_no', 'Plan numarası.', 'tamsayı', { required: true }), col('order', 'Sıra.', 'tamsayı', { required: true }), col('phase_label', 'Sunumdaki aşama adı (ör. "İlk 30 gün", "6 ay").', 'metin', { required: true }), col('due_days', 'Başlangıçtan itibaren gün (30, 90, 180…).', 'tamsayı', { required: true }), col('text', 'Aşamada yapılacak iş.', 'metin', { required: true, width: 80 })] },
  { name: 'Roller', title: 'Roller ve sorumluluklar (rol başlıkları)', perUnit: true, cols: [U, col('role_code', 'IK, YONETIM ya da CALISAN.', 'seçim', { list: [...ROLE_CODES], required: true }), col('title', 'Slayt başlığı.', 'metin', { required: true, width: 60 }), col('description', 'Slayt açıklaması.', 'metin', { width: 70 }), col('note_title', 'Alt kutu başlığı (ör. "İNSAN KAYNAKLARININ ROLÜ").', 'metin', { width: 30 }), col('note', 'Alt kutu metni.', 'metin', { width: 70 })] },
  { name: 'Rol_Sorumluluklari', title: 'Roller ve sorumluluklar (öncelik bazında)', perUnit: true, cols: [U, col('role_code', 'IK, YONETIM ya da CALISAN.', 'seçim', { list: [...ROLE_CODES], required: true }), col('priority_no', 'Öncelik numarası (1–3).', 'tamsayı', { required: true }), col('priority_title', 'Sütun başlığı (ör. "Eğitim ve gelişim").', 'metin', { width: 24 }), col('kind', 'DUTY sorumluluk maddesi; EXPECTED beklenen sonuç.', 'seçim', { list: KINDS_ROLE, required: true }), col('order', 'Sıra.', 'tamsayı', { required: true }), col('text', 'Metin.', 'metin', { required: true, width: 80 })] },
  { name: 'Rol_Surecleri', title: 'Roller: sürece katılım (aşama bazında)', perUnit: true, cols: [U, col('role_code', 'IK, YONETIM ya da CALISAN.', 'seçim', { list: [...ROLE_CODES], required: true }), col('order', 'Sıra.', 'tamsayı', { required: true }), col('phase_label', 'Aşama (ör. "İlk 90 gün").', 'metin', { required: true }), col('text', 'Metin.', 'metin', { required: true, width: 80 })] },
  { name: 'Uygulama_Takvimi', title: 'Uygulama takvimi (aşamalar ve iş akışları)', perUnit: true, cols: [U, col('phase_no', 'Aşama numarası (1–3).', 'tamsayı', { required: true }), col('phase_label', 'Aşama etiketi (ör. "İLK 90 GÜN").', 'metin', { required: true }), col('phase_title', 'Aşama başlığı (ör. "Doğrulama ve anlama").', 'metin', { width: 30 }), col('phase_outcome', 'Aşamanın alt kutusu (beklenen sonuç); aşamanın ilk satırında yeterli.', 'metin', { width: 60 }), col('order', 'İş akışı sırası.', 'tamsayı', { required: true }), col('workstream_title', 'İş akışı başlığı.', 'metin', { required: true, width: 24 }), col('workstream_text', 'İş akışı metni.', 'metin', { required: true, width: 70 })] },
  { name: 'Izleme_Hedefleri', title: 'İzleme göstergeleri ve hedefler', perUnit: true, cols: [U, col('order', 'Sıra.', 'tamsayı', { required: true }), col('label', 'Gösterge adı.', 'metin', { required: true, width: 40 }), col('current_value', 'Mevcut (%).', 'sayı'), col('sector_value', 'Sektör (%); yoksa boş.', 'sayı'), col('company_value', 'Şirket geneli (%).', 'sayı'), col('target_text', 'HEDEF / İZLEME YAKLAŞIMI sütunu (sunumdaki gibi).', 'metin', { required: true, width: 30 }), col('target_value', 'Hedef sayısal ise değer (%).', 'sayı'), col('direction', 'INCREASE artış, DECREASE düşüş, MAINTAIN koruma.', 'seçim', { list: DIRECTIONS })] },
];

export const GUIDE = [
  'BU FORM NEDİR? HPTW birim raporunun (sunumun) "Yol Haritası" bölümünü HPW Act\'e aktarır. Sunumda ne yazıyorsa forma AYNEN yazılır: metni kısaltmayın, yeniden yazmayın, sayıları yuvarlamayın.',
  'SIRA: Önce Organizasyon, Soru seti ve Anket sonuçları yüklenmiş olmalıdır. Bu form dönem seçilerek yüklenir (Dönemler ve sonuçlar → Yol haritası yükle).',
  'BİR FORM, BÜTÜN BİRİMLER: Her satır unit_code ile bir birime bağlanır. Bir birimin sunumu yoksa satır yazmayın. Eylem planı olmayan birim (yalnız öncelikler ve takvim) geçerlidir.',
  'ROL KODLARI: IK = şirket İnsan Kaynakları sütunu; YONETIM = birim (işletme) yönetimi sütunu; CALISAN = çalışanlar sütunu. role_label sunumdaki başlığın aynısıdır.',
  'TAKİP: HPW Act\'te İK ve birim yönetimi adımları "Başlamadı / Devam ediyor / Tamamlandı" olarak takip edilir; takvim satırları (İlk 30 gün, İlk 90 gün, 6 ay…) start_date + due_days ile terminlenir. Çalışan adımları yalnız gösterilir.',
  'GİZLİLİK: Çalışan alıntıları (ÇALIŞANLARIN İFADELERİYLE) bu forma YAZILMAZ; formda bunun için alan yoktur. Kişi adı yazmayın.',
  'SAYILAR: Yüzdeler 0–100 arası sayı olarak yazılır (%53,6 → 53,6). Sektör değeri olmayan hücre boş bırakılır ("-" yazmayın). Hedef bir sayı değilse (ör. "Mevcut düzeyin korunması") target_text\'e yazın, target_value boş kalsın.',
  'MADDE KODLARI: Gösterge bir anket maddesine karşılık geliyorsa item_code yazın (Soru seti şablonundaki kodlar). Boyut ise dimension_code. Bilinmiyorsa boş bırakın; gösterge yine sunumdaki adıyla ve değeriyle görünür.',
  'Formül girmeyin; yalnız değer. Satır sonu gereken hücrelerde Alt+Enter kullanın. Sayfa ve sütun adlarını değiştirmeyin.',
];

export function blankForm(rows: Partial<Record<string, Record<string, unknown>[]>> = {}): TemplateSheet[] {
  return FORM.map(s => ({ name: s.name, columns: s.cols.map(c => ({ key: c.key, header: c.header, width: c.width, list: c.list, required: c.required })), rows: rows[s.name] ?? [] }));
}
export function formDictionary() { return FORM.flatMap(s => s.cols.map(c => ({ sheet: s.name, field: c.key, desc: c.desc, req: c.required ? 'Zorunlu' : 'İsteğe bağlı', type: c.type, allowed: c.list?.join(' / ') }))); }

type Row = Record<string, string | number | null>;
export interface RoadmapPayload {
  report: { cycleCode: string; title: string; companyLabel: string; startDate: string; sourceNote: string | null };
  units: { unitCode: string; unitId: string; header: Row; sections: Record<string, Row[]> }[];
}

async function cycleCtx(tx: Tx, ctx: ImportCtx) {
  const c = (await tx.query('SELECT id, code, instrument_version_id FROM survey_cycle WHERE tenant_id = $1 AND id = $2', [ctx.tenantId, ctx.cycleId])).rows[0];
  if (!c) throw Object.assign(new Error('cycle_not_found'), { status: 404, code: 'cycle_not_found', message: 'Dönem bulunamadı' });
  const items = new Set<string>(c.instrument_version_id ? (await tx.query('SELECT code FROM instrument_item WHERE tenant_id = $1 AND instrument_version_id = $2', [ctx.tenantId, c.instrument_version_id])).rows.map((r: { code: string }) => r.code) : []);
  const dims = new Set<string>(c.instrument_version_id ? (await tx.query('SELECT DISTINCT dimension_code AS code FROM instrument_item WHERE tenant_id = $1 AND instrument_version_id = $2 AND dimension_code IS NOT NULL', [ctx.tenantId, c.instrument_version_id])).rows.map((r: { code: string }) => r.code) : []);
  const units = new Map<string, { id: string; name: string }>((await tx.query('SELECT id, external_id, name FROM org_unit WHERE tenant_id = $1 AND external_id IS NOT NULL AND effective_to IS NULL', [ctx.tenantId])).rows.map((r: { id: string; external_id: string; name: string }) => [r.external_id, { id: r.id, name: r.name }]));
  return { cycle: c as { id: string; code: string }, items, dims, units };
}

export const roadmapImporter: Importer = {
  kind: 'roadmap',
  unitsAffected(payload) { return ((payload as unknown as RoadmapPayload).units ?? []).map(u => u.unitCode); },
  async template(tx, ctx) {
    const t = await tenantInfo(tx, ctx.tenantId); const { cycle, units } = await cycleCtx(tx, ctx);
    return buildWorkbook({ title: `HPW Act | Yol haritası formu (sunumla birebir) · ${t.name} · ${cycle.code}`, version: `${TEMPLATE_VERSION}/${ROADMAP_FORM_VERSION}`, guide: GUIDE,
      sheets: blankForm({ Rapor: [{ tenant_code: t.code, cycle_code: cycle.code, report_title: '', company_label: `${t.name} geneli`, start_date: '', source_note: '' }],
        Birimler: [...units.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, u]) => ({ unit_code: code, unit_label: u.name })) }),
      dictionary: formDictionary() });
  },
  async validate(sheets, tx, ctx): Promise<ValidationResult> {
    const rep = new Report(); checkTenantCode(sheets, ctx, rep, ['Rapor']);
    const { cycle, items, dims, units } = await cycleCtx(tx, ctx);
    const parsed: Record<string, Row[]> = {}; let rowCount = 0;
    for (const s of FORM) {
      const sh: Sheet | undefined = sheets[s.name];
      if (!sh) { if (s.name === 'Rapor' || s.name === 'Birimler') rep.error(s.name, null, null, 'sheet_missing', `"${s.name}" sayfası yok`); parsed[s.name] = []; continue; }
      const missing = s.cols.filter(c => !sh.header.includes(c.key)).map(c => c.key); if (missing.length) { rep.error(s.name, 1, missing.join(','), 'columns_missing', `Eksik sütun: ${missing.join(', ')}`); parsed[s.name] = []; continue; }
      parsed[s.name] = [];
      for (const r of sh.rows) {
        const out: Row = { _row: r.n }; let bad = false;
        for (const c of s.cols) {
          const v = (r.cells[c.key] ?? '').trim();
          if (!v) { if (c.required) { rep.error(s.name, r.n, c.key, 'required', `${c.key} zorunlu`); bad = true; } out[c.key] = null; continue; }
          if (c.type === 'sayı') { const n = num(v); if (n === null || Number.isNaN(n)) { rep.error(s.name, r.n, c.key, 'not_number', 'Sayı bekleniyor (ör. 53,6)', v); bad = true; } else if (n < -100 || n > 100) { rep.error(s.name, r.n, c.key, 'out_of_range', 'Yüzde değer −100 ile 100 arasında olmalı', v); bad = true; } else out[c.key] = n; }
          else if (c.type === 'tamsayı') { const n = int(v); if (n === null || Number.isNaN(n) || n < 0) { rep.error(s.name, r.n, c.key, 'not_integer', 'Tam sayı bekleniyor', v); bad = true; } else out[c.key] = n; }
          else if (c.type === 'tarih') { const d = isoDate(v); if (!d || d === 'INVALID') { rep.error(s.name, r.n, c.key, 'invalid_date', 'Tarih YYYY-AA-GG olmalı', v); bad = true; } else out[c.key] = d; }
          else if (c.type === 'seçim') { const u = v.toLocaleUpperCase('en-US'); if (!c.list!.includes(u)) { rep.error(s.name, r.n, c.key, 'invalid_choice', `İzinli değerler: ${c.list!.join(', ')}`, v); bad = true; } else out[c.key] = u; }
          else { if (v.length > 4000) { rep.error(s.name, r.n, c.key, 'too_long', 'Metin 4000 karakteri aşamaz'); bad = true; } else out[c.key] = v.replace(/\r\n/g, '\n'); }
        }
        if (s.perUnit && out.unit_code && !units.has(String(out.unit_code))) { rep.error(s.name, r.n, 'unit_code', 'unit_unknown', 'Organizasyonda (etkin) böyle bir birim yok; önce Organizasyon şablonunu yükleyin', String(out.unit_code)); bad = true; }
        for (const k of ['item_code', 'measure_item_code']) if (out[k] && !items.has(String(out[k]))) { rep.error(s.name, r.n, k, 'item_unknown', 'Bu dönemin soru setinde böyle bir madde kodu yok', String(out[k])); bad = true; }
        if (out.dimension_code && !dims.has(String(out.dimension_code))) { rep.error(s.name, r.n, 'dimension_code', 'dimension_unknown', 'Bu dönemin soru setinde böyle bir boyut kodu yok', String(out.dimension_code)); bad = true; }
        if (!bad) { parsed[s.name]!.push(out); rowCount++; }
      }
    }
    const rap = parsed['Rapor'] ?? [];
    if (rap.length !== 1) rep.error('Rapor', null, null, 'single_row', 'Rapor sayfasında tam bir satır olmalı');
    const R = rap[0];
    if (R && R.cycle_code !== cycle.code) rep.error('Rapor', Number(R._row), 'cycle_code', 'cycle_mismatch', `Form ${R.cycle_code} dönemi için; seçili dönem ${cycle.code}`, String(R.cycle_code));
    // birim bazında bütünlük
    const byUnit = new Map<string, Record<string, Row[]>>();
    for (const s of FORM.filter(x => x.perUnit)) for (const r of parsed[s.name] ?? []) { const u = String(r.unit_code); if (!byUnit.has(u)) byUnit.set(u, {}); const m = byUnit.get(u)!; (m[s.name] ??= []).push(r); }
    const uniq = (sheet: string, rows: Row[] | undefined, keys: string[]) => { const seen = new Set<string>(); for (const r of rows ?? []) { const k = keys.map(x => r[x]).join('|'); if (seen.has(k)) rep.error(sheet, Number(r._row), keys.join('+'), 'duplicate', `Aynı ${keys.join(' + ')} iki kez yazılmış`, k); seen.add(k); } };
    const units_out: RoadmapPayload['units'] = [];
    for (const [code, m] of byUnit) {
      const heads = m['Birimler'] ?? []; if (heads.length !== 1) { rep.error('Birimler', null, 'unit_code', heads.length ? 'duplicate' : 'unit_header_missing', heads.length ? 'Birimler sayfasında aynı birim iki kez var' : `${code} için Birimler sayfasında satır yok (diğer sayfalarda satırı var)`, code); continue; }
      uniq('Guclu_Yonler', m['Guclu_Yonler'], ['unit_code', 'order']); uniq('Oncelikler', m['Oncelikler'], ['unit_code', 'priority_no']); uniq('Gundem', m['Gundem'], ['unit_code', 'theme_no']); uniq('Eylem_Planlari', m['Eylem_Planlari'], ['unit_code', 'plan_no']);
      uniq('Eylem_Adimlari', m['Eylem_Adimlari'], ['unit_code', 'plan_no', 'role_code', 'order']); uniq('Eylem_Takvimi', m['Eylem_Takvimi'], ['unit_code', 'plan_no', 'order']); uniq('Izleme_Hedefleri', m['Izleme_Hedefleri'], ['unit_code', 'order']);
      for (const r of m['Oncelikler'] ?? []) if (Number(r.priority_no) < 1 || Number(r.priority_no) > 3) rep.error('Oncelikler', Number(r._row), 'priority_no', 'out_of_range', 'Öncelik numarası 1–3 olmalı', String(r.priority_no));
      const plans = new Set((m['Eylem_Planlari'] ?? []).map(r => Number(r.plan_no))); const themes = new Set((m['Gundem'] ?? []).map(r => Number(r.theme_no)));
      for (const p of m['Eylem_Planlari'] ?? []) { if (Number(p.plan_no) < 1 || Number(p.plan_no) > 20) rep.error('Eylem_Planlari', Number(p._row), 'plan_no', 'out_of_range', 'Plan numarası 1–20 olmalı'); if (p.theme_no !== null && !themes.has(Number(p.theme_no))) rep.warn('Eylem_Planlari', Number(p._row), 'theme_no', 'theme_unknown', 'Gundem sayfasında bu konu numarası yok; plan konuya bağlanmadan gösterilir', String(p.theme_no));
        if (p.mentions !== null && p.commenters !== null && Number(p.mentions) > Number(p.commenters)) rep.error('Eylem_Planlari', Number(p._row), 'mentions', 'mentions_gt_commenters', 'Değinen sayısı yorum yazan sayısından büyük olamaz');
        if (p.measure_target !== null && p.measure_label === null) rep.error('Eylem_Planlari', Number(p._row), 'measure_label', 'measure_label_required', 'Sayısal hedef varsa ölçüt adı da yazılmalı'); }
      for (const sh of ['Eylem_Dayanaklari', 'Eylem_Adimlari', 'Eylem_Takvimi']) for (const r of m[sh] ?? []) if (!plans.has(Number(r.plan_no))) rep.error(sh, Number(r._row), 'plan_no', 'plan_unknown', 'Eylem_Planlari sayfasında bu birim için böyle bir plan yok', String(r.plan_no));
      for (const r of m['Gundem_Gostergeleri'] ?? []) { if (!themes.has(Number(r.theme_no))) rep.error('Gundem_Gostergeleri', Number(r._row), 'theme_no', 'theme_unknown', 'Gundem sayfasında bu konu yok', String(r.theme_no)); if (!r.label && !r.note) rep.error('Gundem_Gostergeleri', Number(r._row), 'label', 'label_or_note', 'label ya da note dolu olmalı'); }
      for (const r of m['Eylem_Takvimi'] ?? []) if (Number(r.due_days) < 1 || Number(r.due_days) > 1095) rep.error('Eylem_Takvimi', Number(r._row), 'due_days', 'out_of_range', 'due_days 1–1095 olmalı', String(r.due_days));
      for (const p of plans) { const st = (m['Eylem_Adimlari'] ?? []).filter(r => Number(r.plan_no) === p); if (!st.some(r => r.role_code === 'YONETIM') && !st.some(r => r.role_code === 'IK')) rep.warn('Eylem_Planlari', null, 'plan_no', 'plan_without_steps', `${code} plan ${p}: İK ya da yönetim adımı yok; takip edilecek adım olmayacak`); }
      const sections: Record<string, Row[]> = {}; for (const s of FORM.filter(x => x.perUnit && x.name !== 'Birimler')) sections[s.name] = (m[s.name] ?? []).map(r => { const o = { ...r }; delete o._row; delete o.unit_code; return o; });
      const header = { ...heads[0]! }; delete header._row;
      units_out.push({ unitCode: code, unitId: units.get(code)!.id, header, sections });
    }
    if (!units_out.length && rep.ok) rep.error('Birimler', null, null, 'no_units', 'Formda hiçbir birim yok');
    const preview = { cycle: cycle.code, report: R?.report_title ?? null, startDate: R?.start_date ?? null, units: units_out.map(u => ({ unit: u.unitCode, plans: u.sections['Eylem_Planlari']!.length, ikSteps: u.sections['Eylem_Adimlari']!.filter(r => r.role_code === 'IK').length, managementSteps: u.sections['Eylem_Adimlari']!.filter(r => r.role_code === 'YONETIM').length, employeeSteps: u.sections['Eylem_Adimlari']!.filter(r => r.role_code === 'CALISAN').length, milestones: u.sections['Eylem_Takvimi']!.length, measures: u.sections['Izleme_Hedefleri']!.length })) };
    const payload: RoadmapPayload = { report: { cycleCode: cycle.code, title: String(R?.report_title ?? ''), companyLabel: String(R?.company_label ?? ''), startDate: String(R?.start_date ?? ''), sourceNote: (R?.source_note as string) ?? null }, units: units_out };
    return { report: rep, payload: payload as unknown as Record<string, unknown>, preview, rowCount, templateVersion: ROADMAP_FORM_VERSION };
  },
  async commit(payloadRaw, tx, ctx) {
    const payload = payloadRaw as unknown as RoadmapPayload; const out: { unit: string; roadmapId: string; plans: number; steps: number; milestones: number; carriedStatuses: number }[] = [];
    const addDays = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
    for (const u of payload.units) {
      // önceki etkin yol haritası: durumlar aynı plan + rol + sıra + metin için taşınır (düzeltilmiş sunum yeniden yüklendiğinde takip kaybolmaz)
      const prev = (await tx.query("SELECT id FROM roadmap WHERE tenant_id = $1 AND cycle_id = $2 AND unit_id = $3 AND status = 'active' FOR UPDATE", [ctx.tenantId, ctx.cycleId, u.unitId])).rows[0] as { id: string } | undefined;
      const prevSteps = prev ? (await tx.query('SELECT p.plan_no, s.role_code, s.ord, s.text, s.status, s.note, s.updated_by, s.status_at FROM roadmap_step s JOIN roadmap_plan p ON p.tenant_id = s.tenant_id AND p.id = s.plan_id WHERE s.tenant_id = $1 AND s.roadmap_id = $2', [ctx.tenantId, prev.id])).rows : [];
      const prevMs = prev ? (await tx.query('SELECT p.plan_no, m.ord, m.text, m.status, m.note, m.updated_by, m.status_at FROM roadmap_milestone m JOIN roadmap_plan p ON p.tenant_id = m.tenant_id AND p.id = m.plan_id WHERE m.tenant_id = $1 AND m.roadmap_id = $2', [ctx.tenantId, prev.id])).rows : [];
      if (prev) await tx.query("UPDATE roadmap SET status = 'superseded', updated_at = now(), version = version + 1 WHERE tenant_id = $1 AND id = $2", [ctx.tenantId, prev.id]);
      const h = u.header; const S = u.sections;
      const content = { header: h, strengths: S['Guclu_Yonler'], priorities: S['Oncelikler'], priorityPractices: S['Oncelik_Uygulamalari'], influence: S['Etki_Alani'], agenda: S['Gundem'], agendaIndicators: S['Gundem_Gostergeleri'], roles: S['Roller'], roleResponsibilities: S['Rol_Sorumluluklari'], roleProcesses: S['Rol_Surecleri'], calendar: S['Uygulama_Takvimi'], monitoring: S['Izleme_Hedefleri'], formVersion: ROADMAP_FORM_VERSION, sourceNote: payload.report.sourceNote };
      const rid = (await tx.query('INSERT INTO roadmap (tenant_id, cycle_id, unit_id, import_job_id, report_title, company_label, unit_label, sector_label, start_date, content, created_by) VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10) RETURNING id', [ctx.tenantId, ctx.cycleId, u.unitId, payload.report.title, payload.report.companyLabel, h.unit_label, h.sector_label ?? null, payload.report.startDate, JSON.stringify(content), ctx.userId])).rows[0].id as string;
      let steps = 0, ms = 0, carried = 0;
      for (const p of (S['Eylem_Planlari'] ?? []).slice().sort((a, b) => Number(a.plan_no) - Number(b.plan_no))) {
        const inds = (S['Eylem_Dayanaklari'] ?? []).filter(r => r.plan_no === p.plan_no).sort((a, b) => Number(a.order) - Number(b.order)).map(r => ({ label: r.label, itemCode: r.item_code, dimensionCode: r.dimension_code, unit: r.unit_value, company: r.company_value }));
        const measure = { label: p.measure_label, itemCode: p.measure_item_code, current: p.measure_current, company: p.measure_company, target: p.measure_target, rule: p.measure_rule, text: p.measure_text };
        const pid = (await tx.query('INSERT INTO roadmap_plan (tenant_id, roadmap_id, unit_id, plan_no, theme_no, title, headline, mentions, commenters, data_note, indicators, measure) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id', [ctx.tenantId, rid, u.unitId, p.plan_no, p.theme_no, p.title, p.headline, p.mentions, p.commenters, p.data_note, JSON.stringify(inds), JSON.stringify(measure)])).rows[0].id as string;
        for (const s of (S['Eylem_Adimlari'] ?? []).filter(r => r.plan_no === p.plan_no)) {
          const old = prevSteps.find(o => o.plan_no === p.plan_no && o.role_code === s.role_code && o.ord === s.order && o.text === s.text);
          await tx.query('INSERT INTO roadmap_step (tenant_id, roadmap_id, plan_id, unit_id, role_code, role_label, ord, text, status, note, updated_by, status_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [ctx.tenantId, rid, pid, u.unitId, s.role_code, s.role_label, s.order, s.text, old && s.role_code !== 'CALISAN' ? old.status : 'NOT_STARTED', old?.note ?? null, old?.updated_by ?? null, old?.status_at ?? null]);
          steps++; if (old && old.status !== 'NOT_STARTED') carried++;
        }
        for (const m of (S['Eylem_Takvimi'] ?? []).filter(r => r.plan_no === p.plan_no)) {
          const old = prevMs.find(o => o.plan_no === p.plan_no && o.ord === m.order && o.text === m.text);
          await tx.query('INSERT INTO roadmap_milestone (tenant_id, roadmap_id, plan_id, unit_id, ord, phase_label, due_days, due_date, text, status, note, updated_by, status_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)', [ctx.tenantId, rid, pid, u.unitId, m.order, m.phase_label, m.due_days, addDays(payload.report.startDate, Number(m.due_days)), m.text, old?.status ?? 'OPEN', old?.note ?? null, old?.updated_by ?? null, old?.status_at ?? null]);
          ms++; if (old && old.status === 'DONE') carried++;
        }
      }
      out.push({ unit: u.unitCode, roadmapId: rid, plans: (S['Eylem_Planlari'] ?? []).length, steps, milestones: ms, carriedStatuses: carried });
    }
    return { roadmaps: out.length, plans: out.reduce((a, x) => a + x.plans, 0), steps: out.reduce((a, x) => a + x.steps, 0), milestones: out.reduce((a, x) => a + x.milestones, 0), carriedStatuses: out.reduce((a, x) => a + x.carriedStatuses, 0), units: out };
  },
};
