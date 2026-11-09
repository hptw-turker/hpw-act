import type { Tx } from '../db.js';
import { buildWorkbook, num, int, isoDate, type Sheet, type TemplateSheet } from '../xlsx.js';
import { Report } from '../validation.js';
import { checkTenantCode, tenantInfo, type Importer, type ImportCtx, type ValidationResult } from './common.js';

/** v3.0.0 (ADR-0043) — Yol haritası dosyası (yh-2). HPTW kurum raporu ve işletme raporlarının 8. bölümü (yol haritası) bu dosyayla yüklenir.
 * Hedef rapordan gelir; HPW Act yalnız denetler (kesir–yüzde tutarlılığı, atıflar, gizlilik eşiği) ve takip eder. Çalışan alıntıları için alan yoktur. */
export const RM2_FORM_VERSION = 'yh-2';
export const PHASES: Record<number, string> = { 30: 'İlk 30 gün', 90: 'İlk 90 gün', 180: 'İlk 6 ay' };
const ROLES = ['IK', 'YONETIM', 'CALISAN']; const LAYERS = ['KURUM', 'ISLETME']; const KINDS = ['HEDEF', 'IZLENIR'];
const MIN_N = 5;

type T = 'metin' | 'kod' | 'sayı' | 'tamsayı' | 'tarih' | 'seçim';
type C = { key: string; desc: string; type: T; required?: boolean; list?: string[]; width?: number };
const c = (key: string, desc: string, type: T = 'metin', o: Partial<C> = {}): C => ({ key, desc, type, ...o });
const B = c('birim_kodu', 'Organizasyondaki birim kodu (kurum satırı için kök birimin kodu).', 'kod', { required: true });
export const FORM2: { name: string; title: string; cols: C[] }[] = [
  { name: 'Rapor', title: 'Rapor bilgisi (tek satır)', cols: [
    c('sirket_kodu', 'Şirket kodu (kontrol alanı).', 'kod', { required: true }), c('donem_kodu', 'Dönem kodu (ör. 2026-ANA). Yoksa yüklemede oluşturulur.', 'kod', { required: true }),
    c('rapor_adi', 'Kurum raporunun adı.', 'metin', { required: true, width: 50 }), c('baslangic_tarihi', 'Yol haritasının başladığı gün = sunum günü (YYYY-AA-GG). Terminler buna göre hesaplanır.', 'tarih', { required: true }),
    c('etki_olcum_donemi', 'Etkinin ölçüleceği dönem (ör. "2027 ölçümü").', 'metin', { width: 24 })] },
  { name: 'Birimler', title: 'Yol haritaları (kurum + işletmeler)', cols: [B,
    c('katman', 'KURUM (kurum planı, tek satır) ya da ISLETME.', 'seçim', { required: true, list: LAYERS }), c('birim_adi', 'Rapordaki ad.', 'metin', { required: true, width: 32 }),
    c('yanit_sayisi', 'Bu birimde anketi yanıtlayan sayısı.', 'tamsayı', { required: true }), c('karsilastirma_adi', 'Karşılaştırma değerinin adı (ör. "Şirket geneli" ya da "Sektör").', 'metin', { width: 22 }),
    c('ana_sonuc_baslik', 'Ana sonuç cümlesi.', 'metin', { width: 60 }), c('ana_sonuc_metin', 'Ana sonucun açıklaması.', 'metin', { width: 80 })] },
  { name: 'Planlar', title: 'Eylem planları (her plan tek anket maddesi)', cols: [B,
    c('plan_no', 'Plan numarası (rapordaki sıra).', 'tamsayı', { required: true }), c('baslik', 'Plan başlığı.', 'metin', { required: true, width: 44 }),
    c('madde_kodu', 'İzlenecek anket maddesinin kodu (ör. wp41).', 'kod', { required: true }), c('madde_metni', 'Maddenin tam metni.', 'metin', { required: true, width: 60 }),
    c('mevcut_olumlu', 'Mevcut olumlu yanıt sayısı (hedefli planda zorunlu).', 'tamsayı'), c('mevcut_yuzde', 'Mevcut değer (%, 0–100).', 'sayı', { required: true }),
    c('karsilastirma_yuzde', 'Karşılaştırma değeri (%).', 'sayı'), c('hedef_turu', 'HEDEF ya da IZLENIR.', 'seçim', { required: true, list: KINDS }),
    c('hedef_olumlu', 'Hedef olumlu yanıt sayısı (HEDEF ise zorunlu).', 'tamsayı'), c('hedef_yuzde', 'Hedef (%) = hedef_olumlu / yanit_sayisi.', 'sayı'),
    c('sorumluluk', 'Rapordaki sorumluluk metni.', 'metin', { width: 36 }), c('etki_metni', 'Rapordaki ETKİ cümlesi.', 'metin', { width: 70 })] },
  { name: 'Adimlar', title: 'Adımlar (rol × aşama)', cols: [B,
    c('plan_no', 'Plan numarası.', 'tamsayı', { required: true }), c('rol', 'IK, YONETIM ya da CALISAN.', 'seçim', { required: true, list: ROLES }),
    c('rol_adi', 'Rapordaki rol adı (ör. "Şirket İnsan Kaynakları", "Merkez Otel Yönetimi").', 'metin', { required: true, width: 32 }),
    c('asama_gun', '30 (İlk 30 gün), 90 (İlk 90 gün) ya da 180 (İlk 6 ay).', 'tamsayı', { required: true }), c('sira', 'Aynı aşamadaki sıra (1, 2, …).', 'tamsayı', { required: true }),
    c('adim', 'Adım metni (rapordaki gibi).', 'metin', { required: true, width: 70 }), c('cikti', 'Çıktı (adımın yapıldığını gösteren sonuç).', 'metin', { width: 60 }),
    c('plana_katkisi', 'Yalnız çalışan adımları: plana katkısı.', 'metin', { width: 50 }),
    c('kurum_atfi', 'Yalnız işletme İK adımları: kurum planındaki adıma atıf, ör. "Kurum planı 1 · İK · İlk 30 gün · Eğitim ihtiyaç analizi".', 'metin', { width: 60 })] },
  { name: 'Izleme', title: 'İzleme göstergeleri (anket maddeleri)', cols: [B,
    c('sira', 'Sıra.', 'tamsayı', { required: true }), c('madde_kodu', 'Madde kodu.', 'kod', { required: true }), c('madde_metni', 'Madde metni.', 'metin', { required: true, width: 60 }),
    c('baglanti', 'Bağlantı (ör. "Eylem planı 1 · eğitim ve gelişim", "Bağlılık · kalma niyeti").', 'metin', { width: 36 }),
    c('mevcut_yuzde', 'Mevcut (%).', 'sayı'), c('karsilastirma_yuzde', 'Karşılaştırma (%).', 'sayı'), c('sektor_yuzde', 'Sektör (%).', 'sayı'), c('hedef', 'Hedef (ör. "%37,9") ya da "İzlenir".', 'metin', { width: 18 })] },
];
export const GUIDE2 = [
  'BU DOSYA NEDİR? HPTW kurum raporunun ve işletme raporlarının "Yol Haritası" bölümünü HPW Act\'e aktarır. Raporda ne yazıyorsa AYNEN yazılır.',
  'SIRA: Önce Organizasyon dosyası yüklenmiş olmalı (birim kodları oradan gelir). Sonra bu dosya, en son Kullanıcılar dosyası.',
  'KATMAN: Kurum planı KURUM satırıdır (kök birimin kodu); her işletme ISLETME satırıdır. Bir dosyada bir şirketin bütün yol haritaları olur.',
  'HEDEF: Hedef olumlu yanıt sayısıyla yazılır (ör. 9/29 → 11/29); yüzde bu kesirden hesaplanır. Yanıt sayısı 5\'in altındaki birime hedef verilmez. Kurum hedefi, aynı maddeye hedef veren işletmelerin ek yanıtlarının toplamıdır.',
  'ADIMLAR: Her adım bir rol, bir aşama (30 / 90 / 180 gün) ve bir çıktı taşır. Bir aşamada birden çok adım olabilir (sira 1, 2, …). Çalışan adımları bilgi içindir.',
  'ATIF: İşletme İK sütununda kurum planına bağlı satırlar kurum_atfi ile yazılır; durum kurum adımında bir kez işaretlenir.',
  'GİZLİLİK: Çalışan alıntıları bu dosyaya yazılmaz. Kişi adı yazılmaz.',
  'Yüzdeler 0–100 arası sayıdır (%31,0 → 31). Formül girmeyin. Sayfa ve sütun adlarını değiştirmeyin.',
];
export function blankForm2(rows: Partial<Record<string, Record<string, unknown>[]>> = {}): TemplateSheet[] {
  return FORM2.map(s => ({ name: s.name, columns: s.cols.map(x => ({ key: x.key, header: x.key, width: x.width, list: x.list, required: x.required })), rows: rows[s.name] ?? [] }));
}
export function form2Dictionary() { return FORM2.flatMap(s => s.cols.map(x => ({ sheet: s.name, field: x.key, desc: x.desc, req: x.required ? 'Zorunlu' : 'İsteğe bağlı', type: x.type, allowed: x.list?.join(' / ') }))); }

type Row = Record<string, string | number | null>;
export interface Rm2Payload {
  report: { cycleCode: string; title: string; startDate: string; measurePeriod: string | null };
  roadmaps: { unitCode: string; unitId: string; layer: 'KURUM' | 'ISLETME'; head: Row; plans: Row[]; steps: Row[]; items: Row[] }[];
}
export const ATIF_RE = /^Kurum planı (\d+) · İK · (İlk 30 gün|İlk 90 gün|İlk 6 ay) · (.+)$/;
const PH_DAYS: Record<string, number> = { 'İlk 30 gün': 30, 'İlk 90 gün': 90, 'İlk 6 ay': 180 };
const words = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N} ]+/gu, ' ').split(/\s+/).filter(w => w.length > 3).map(w => w.slice(0, 5));
/** Atıf kısa adı, kurum İK adımlarından tam olarak birine uymalı (kısa adın anlamlı kelimeleri adım metninde geçer). */
export function resolveAtif(label: string, candidates: { key: string; text: string }[]): { key: string } | 'none' | 'ambiguous' {
  const kw = words(label); if (!kw.length) return 'none';
  const hits = candidates.filter(x => { const t = words(x.text); return kw.every(k => t.some(w => w.startsWith(k) || k.startsWith(w))); });
  return hits.length === 1 ? { key: hits[0]!.key } : hits.length ? 'ambiguous' : 'none';
}
export const addDays = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

async function units(tx: Tx, tenantId: string) {
  return new Map<string, { id: string; name: string }>((await tx.query('SELECT id, external_id, name FROM org_unit WHERE tenant_id = $1 AND external_id IS NOT NULL AND effective_to IS NULL', [tenantId])).rows.map((r: { id: string; external_id: string; name: string }) => [r.external_id, { id: r.id, name: r.name }]));
}

export const roadmap2Importer: Importer = {
  kind: 'roadmap2',
  unitsAffected(payload) { return ((payload as unknown as Rm2Payload).roadmaps ?? []).map(u => u.unitCode); },
  async template(tx, ctx) {
    const t = await tenantInfo(tx, ctx.tenantId); const u = await units(tx, ctx.tenantId);
    return buildWorkbook({ title: `HPW Act | Yol haritası dosyası · ${t.name}`, version: RM2_FORM_VERSION, guide: GUIDE2,
      sheets: blankForm2({ Rapor: [{ sirket_kodu: t.code, donem_kodu: '', rapor_adi: '', baslangic_tarihi: '', etki_olcum_donemi: '' }],
        Birimler: [...u.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, x]) => ({ birim_kodu: code, katman: '', birim_adi: x.name })) }),
      dictionary: form2Dictionary() });
  },
  async validate(sheets, tx, ctx): Promise<ValidationResult> {
    const rep = new Report();
    // şirket kodu kontrolü (sütun adı sirket_kodu)
    for (const r of sheets['Rapor']?.rows ?? []) { const tc = (r.cells['sirket_kodu'] ?? '').trim(); if (tc && tc !== ctx.tenantCode) rep.error('Rapor', r.n, 'sirket_kodu', 'tenant_code_mismatch', `Dosyadaki şirket kodu (${tc}) bu şirketin kodu (${ctx.tenantCode}) değil; dosya bu şirkete yüklenemez`, tc); }
    void checkTenantCode;
    const U = await units(tx, ctx.tenantId);
    const P: Record<string, Row[]> = {}; let rowCount = 0;
    for (const s of FORM2) {
      const sh: Sheet | undefined = sheets[s.name];
      if (!sh) { rep.error(s.name, null, null, 'sheet_missing', `"${s.name}" sayfası dosyada yok`); P[s.name] = []; continue; }
      const missing = s.cols.filter(x => !sh.header.includes(x.key)).map(x => x.key); if (missing.length) { rep.error(s.name, 1, missing.join(','), 'columns_missing', `Eksik sütun: ${missing.join(', ')}`); P[s.name] = []; continue; }
      P[s.name] = [];
      for (const r of sh.rows) {
        const out: Row = { _row: r.n }; let bad = false;
        for (const x of s.cols) {
          const v = (r.cells[x.key] ?? '').trim();
          if (!v) { if (x.required) { rep.error(s.name, r.n, x.key, 'required', `${x.key} boş olamaz`); bad = true; } out[x.key] = null; continue; }
          if (x.type === 'sayı') { const n = num(v.replace('%', '')); if (n === null || Number.isNaN(n) || n < 0 || n > 100) { rep.error(s.name, r.n, x.key, 'not_percent', 'Yüzde 0–100 arası sayı olmalı (ör. 31 ya da 31,0)', v); bad = true; } else out[x.key] = n; }
          else if (x.type === 'tamsayı') { const n = int(v); if (n === null || Number.isNaN(n) || n < 0) { rep.error(s.name, r.n, x.key, 'not_integer', 'Tam sayı olmalı', v); bad = true; } else out[x.key] = n; }
          else if (x.type === 'tarih') { const d = isoDate(v); if (!d || d === 'INVALID') { rep.error(s.name, r.n, x.key, 'invalid_date', 'Tarih YYYY-AA-GG olmalı (ör. 2026-11-16)', v); bad = true; } else out[x.key] = d; }
          else if (x.type === 'seçim') { const u = v.toLocaleUpperCase('tr-TR').replace('İ', 'I'); if (!x.list!.includes(u)) { rep.error(s.name, r.n, x.key, 'invalid_choice', `Yazılabilecek değerler: ${x.list!.join(', ')}`, v); bad = true; } else out[x.key] = u; }
          else { if (v.length > 4000) { rep.error(s.name, r.n, x.key, 'too_long', 'Metin 4000 karakteri aşamaz'); bad = true; } else out[x.key] = v.replace(/\r\n/g, '\n'); }
        }
        if (out.birim_kodu && !U.has(String(out.birim_kodu))) { rep.error(s.name, r.n, 'birim_kodu', 'unit_unknown', 'Bu birim kodu organizasyonda yok; önce Organizasyon dosyasını yükleyin ya da kodu düzeltin', String(out.birim_kodu)); bad = true; }
        if (!bad) { P[s.name]!.push(out); rowCount++; }
      }
    }
    const rap = P['Rapor']!; if (rap.length !== 1) rep.error('Rapor', null, null, 'single_row', 'Rapor sayfasında tek satır olmalı');
    const R = rap[0];
    const heads = P['Birimler']!; const seenU = new Set<string>();
    for (const h of heads) { const k = String(h.birim_kodu); if (seenU.has(k)) rep.error('Birimler', Number(h._row), 'birim_kodu', 'duplicate', 'Aynı birim iki kez yazılmış', k); seenU.add(k); }
    const kurumHeads = heads.filter(h => h.katman === 'KURUM'); if (kurumHeads.length > 1) rep.error('Birimler', Number(kurumHeads[1]!._row), 'katman', 'multiple_kurum', 'Dosyada yalnız bir KURUM satırı olabilir');
    const headOf = new Map(heads.map(h => [String(h.birim_kodu), h]));
    for (const sn of ['Planlar', 'Adimlar', 'Izleme']) for (const r of P[sn]!) if (!headOf.has(String(r.birim_kodu))) rep.error(sn, Number(r._row), 'birim_kodu', 'unit_header_missing', 'Bu birim Birimler sayfasında yok', String(r.birim_kodu));
    const pct = (a: number, n: number) => Math.round((a / n) * 1000 + 1e-9) / 10;
    // planlar
    const planKey = (u: unknown, p: unknown) => `${u}|${p}`; const plans = new Map<string, Row>();
    for (const p of P['Planlar']!) {
      const k = planKey(p.birim_kodu, p.plan_no); if (plans.has(k)) { rep.error('Planlar', Number(p._row), 'plan_no', 'duplicate', 'Aynı birimde aynı plan numarası iki kez var', String(p.plan_no)); continue; } plans.set(k, p);
      const h = headOf.get(String(p.birim_kodu)); const n = Number(h?.yanit_sayisi ?? 0);
      if (p.mevcut_olumlu !== null && n && Math.abs(pct(Number(p.mevcut_olumlu), n) - Number(p.mevcut_yuzde)) > 0.051) rep.error('Planlar', Number(p._row), 'mevcut_yuzde', 'pct_mismatch', `mevcut_olumlu/yanit_sayisi = %${pct(Number(p.mevcut_olumlu), n)}; yazılan %${p.mevcut_yuzde}`, String(p.mevcut_yuzde));
      if (p.hedef_turu === 'HEDEF') {
        if (n < MIN_N) rep.error('Planlar', Number(p._row), 'hedef_turu', 'below_threshold', `Yanıt sayısı ${MIN_N}'in altında olan birime hedef verilmez; IZLENIR yazın`);
        if (p.mevcut_olumlu === null || p.hedef_olumlu === null) rep.error('Planlar', Number(p._row), 'hedef_olumlu', 'target_counts_required', 'Hedefli planda mevcut_olumlu ve hedef_olumlu zorunlu');
        else {
          if (Number(p.hedef_olumlu) <= Number(p.mevcut_olumlu) || Number(p.hedef_olumlu) > n) rep.error('Planlar', Number(p._row), 'hedef_olumlu', 'target_out_of_range', `Hedef olumlu yanıt mevcuttan büyük ve yanıt sayısından (${n}) küçük ya da eşit olmalı`, String(p.hedef_olumlu));
          if (p.hedef_yuzde !== null && n && Math.abs(pct(Number(p.hedef_olumlu), n) - Number(p.hedef_yuzde)) > 0.051) rep.error('Planlar', Number(p._row), 'hedef_yuzde', 'pct_mismatch', `hedef_olumlu/yanit_sayisi = %${pct(Number(p.hedef_olumlu), n)}; yazılan %${p.hedef_yuzde}`, String(p.hedef_yuzde));
        }
      } else if (p.hedef_olumlu !== null) rep.warn('Planlar', Number(p._row), 'hedef_olumlu', 'ignored', 'IZLENIR planında hedef_olumlu kullanılmaz');
    }
    // kurum hedefi = işletme hedeflerinin toplamı (rapor yöntemi) — uyarı
    const kh = kurumHeads[0];
    if (kh) for (const kp of P['Planlar']!.filter(p => p.birim_kodu === kh.birim_kodu && p.hedef_turu === 'HEDEF' && p.hedef_olumlu !== null && p.mevcut_olumlu !== null)) {
      const sum = P['Planlar']!.filter(p => p.birim_kodu !== kh.birim_kodu && p.madde_kodu === kp.madde_kodu && p.hedef_turu === 'HEDEF' && p.hedef_olumlu !== null && p.mevcut_olumlu !== null).reduce((a, p) => a + Number(p.hedef_olumlu) - Number(p.mevcut_olumlu), 0);
      const diff = Number(kp.hedef_olumlu) - Number(kp.mevcut_olumlu);
      if (sum !== diff) rep.warn('Planlar', Number(kp._row), 'hedef_olumlu', 'kurum_sum_mismatch', `Kurum hedefinin ek yanıtı (${diff}) işletme hedeflerinin ek yanıtları toplamından (${sum}) farklı`, String(kp.hedef_olumlu));
    }
    // adımlar
    const stepSeen = new Set<string>(); const kurumIk: { key: string; text: string; plan: number; days: number }[] = [];
    for (const s of P['Adimlar']!) {
      if (!plans.has(planKey(s.birim_kodu, s.plan_no))) rep.error('Adimlar', Number(s._row), 'plan_no', 'plan_unknown', 'Planlar sayfasında bu birim için böyle bir plan yok', String(s.plan_no));
      if (![30, 90, 180].includes(Number(s.asama_gun))) rep.error('Adimlar', Number(s._row), 'asama_gun', 'invalid_phase', 'Aşama 30, 90 ya da 180 olmalı', String(s.asama_gun));
      const k = `${s.birim_kodu}|${s.plan_no}|${s.rol}|${s.asama_gun}|${s.sira}`; if (stepSeen.has(k)) rep.error('Adimlar', Number(s._row), 'sira', 'duplicate', 'Aynı birim, plan, rol, aşama ve sıra iki kez var', k); stepSeen.add(k);
      if (s.plana_katkisi && s.rol !== 'CALISAN') rep.warn('Adimlar', Number(s._row), 'plana_katkisi', 'ignored', 'plana_katkisi yalnız çalışan adımlarında kullanılır');
      if (kh && s.birim_kodu === kh.birim_kodu && s.rol === 'IK') kurumIk.push({ key: k, text: String(s.adim), plan: Number(s.plan_no), days: Number(s.asama_gun) });
    }
    const refs: Record<string, string> = {};
    for (const s of P['Adimlar']!.filter(x => x.kurum_atfi)) {
      const isUnitIk = s.rol === 'IK' && headOf.get(String(s.birim_kodu))?.katman === 'ISLETME';
      if (!isUnitIk) { rep.error('Adimlar', Number(s._row), 'kurum_atfi', 'atif_not_allowed', 'Kurum atfı yalnız işletme İK adımlarında yazılır'); continue; }
      if (!kh) { rep.error('Adimlar', Number(s._row), 'kurum_atfi', 'kurum_missing', 'Atıf var ama dosyada KURUM yol haritası yok'); continue; }
      const m = ATIF_RE.exec(String(s.kurum_atfi)); if (!m) { rep.error('Adimlar', Number(s._row), 'kurum_atfi', 'atif_format', 'Biçim: "Kurum planı 1 · İK · İlk 30 gün · Kısa ad"', String(s.kurum_atfi)); continue; }
      const days = PH_DAYS[m[2]!]!; if (days !== Number(s.asama_gun)) rep.warn('Adimlar', Number(s._row), 'kurum_atfi', 'atif_phase', `Atıftaki aşama (${m[2]}) bu satırın aşamasından farklı`, String(s.kurum_atfi));
      const res = resolveAtif(m[3]!, kurumIk.filter(x => x.plan === Number(m[1]) && x.days === days));
      if (res === 'none') rep.error('Adimlar', Number(s._row), 'kurum_atfi', 'atif_unresolved', `Kurum planı ${m[1]} · İK · ${m[2]} içinde "${m[3]}" adlı bir adım bulunamadı`, String(s.kurum_atfi));
      else if (res === 'ambiguous') rep.error('Adimlar', Number(s._row), 'kurum_atfi', 'atif_ambiguous', `"${m[3]}" birden çok kurum adımına uyuyor; kısa adı belirginleştirin`, String(s.kurum_atfi));
      else refs[`${s.birim_kodu}|${s.plan_no}|${s.rol}|${s.asama_gun}|${s.sira}`] = res.key;
    }
    for (const h of heads) { const code = String(h.birim_kodu); if (!P['Planlar']!.some(p => p.birim_kodu === code)) rep.error('Birimler', Number(h._row), 'birim_kodu', 'no_plans', `${code}: Planlar sayfasında bu birimin planı yok`); }
    const izSeen = new Set<string>(); for (const r of P['Izleme']!) { const k = `${r.birim_kodu}|${r.sira}`; if (izSeen.has(k)) rep.error('Izleme', Number(r._row), 'sira', 'duplicate', 'Aynı birimde aynı sıra iki kez var', k); izSeen.add(k); }
    const strip = (r: Row) => { const o = { ...r }; delete o._row; delete o.birim_kodu; return o; };
    const roadmaps: Rm2Payload['roadmaps'] = heads.map(h => { const code = String(h.birim_kodu); return { unitCode: code, unitId: U.get(code)?.id ?? '', layer: h.katman as 'KURUM' | 'ISLETME', head: strip(h),
      plans: P['Planlar']!.filter(p => p.birim_kodu === code).map(strip), steps: P['Adimlar']!.filter(s => s.birim_kodu === code).map(s => ({ ...strip(s), _ref: refs[`${code}|${s.plan_no}|${s.rol}|${s.asama_gun}|${s.sira}`] ?? null })), items: P['Izleme']!.filter(i => i.birim_kodu === code).map(strip) }; })
      .sort((a, b) => (a.layer === 'KURUM' ? -1 : 0) - (b.layer === 'KURUM' ? -1 : 0));
    if (!roadmaps.length && rep.ok) rep.error('Birimler', null, null, 'no_units', 'Dosyada hiç yol haritası yok');
    const preview = { cycle: R?.donem_kodu ?? null, report: R?.rapor_adi ?? null, startDate: R?.baslangic_tarihi ?? null, roadmaps: roadmaps.map(r => ({ unit: r.unitCode, name: r.head.birim_adi, layer: r.layer, plans: r.plans.length, targets: r.plans.filter(p => p.hedef_turu === 'HEDEF').length, ikSteps: r.steps.filter(s => s.rol === 'IK').length, managementSteps: r.steps.filter(s => s.rol === 'YONETIM').length, employeeSteps: r.steps.filter(s => s.rol === 'CALISAN').length, references: r.steps.filter(s => s._ref).length })) };
    const payload: Rm2Payload = { report: { cycleCode: String(R?.donem_kodu ?? ''), title: String(R?.rapor_adi ?? ''), startDate: String(R?.baslangic_tarihi ?? ''), measurePeriod: (R?.etki_olcum_donemi as string) ?? null }, roadmaps };
    return { report: rep, payload: payload as unknown as Record<string, unknown>, preview, rowCount, templateVersion: RM2_FORM_VERSION };
  },
  async commit(payloadRaw, tx, ctx) {
    const pl = payloadRaw as unknown as Rm2Payload; const start = pl.report.startDate;
    // dönem: yoksa oluşturulur (anket toplama ağacıyla)
    let cyc = (await tx.query('SELECT id FROM survey_cycle WHERE tenant_id = $1 AND code = $2', [ctx.tenantId, pl.report.cycleCode])).rows[0] as { id: string } | undefined;
    if (!cyc) {
      let h = (await tx.query("SELECT id FROM hierarchy_group WHERE tenant_id = $1 AND code = 'SURVEY'", [ctx.tenantId])).rows[0];
      if (!h) h = (await tx.query("INSERT INTO hierarchy_group (tenant_id, organization_id, code, name, purpose) VALUES ($1,$2,'SURVEY','Anket toplama ağacı','SURVEY_ROLLUP') RETURNING id", [ctx.tenantId, ctx.organizationId])).rows[0];
      cyc = (await tx.query('INSERT INTO survey_cycle (tenant_id, organization_id, code, name, period_start, period_end, rollup_hierarchy_group_id) VALUES ($1,$2,$3,$3,$4,$5,$6) RETURNING id', [ctx.tenantId, ctx.organizationId, pl.report.cycleCode, start, addDays(start, 364), h.id])).rows[0];
    }
    const cycleId = cyc!.id; const stepIds: Record<string, string> = {}; const out: { unit: string; roadmapId: string; plans: number; steps: number; carried: number }[] = [];
    for (const r of pl.roadmaps) {
      const prev = (await tx.query("SELECT id FROM rm2_roadmap WHERE tenant_id = $1 AND cycle_id = $2 AND unit_id = $3 AND status = 'active' FOR UPDATE", [ctx.tenantId, cycleId, r.unitId])).rows[0] as { id: string } | undefined;
      const prevSteps = prev ? (await tx.query('SELECT s.id, p.plan_no, s.role_code, s.phase_days, s.text, s.status, s.note, s.updated_by, s.status_at FROM rm2_step s JOIN rm2_plan p ON p.tenant_id = s.tenant_id AND p.id = s.plan_id WHERE s.tenant_id = $1 AND s.roadmap_id = $2', [ctx.tenantId, prev.id])).rows : [];
      if (prev) await tx.query("UPDATE rm2_roadmap SET status = 'superseded', updated_at = now(), version = version + 1 WHERE tenant_id = $1 AND id = $2", [ctx.tenantId, prev.id]);
      const h = r.head;
      const rid = (await tx.query('INSERT INTO rm2_roadmap (tenant_id, cycle_id, unit_id, layer, report_title, unit_label, respondents, comparison_label, headline, summary, start_date, measure_period, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id', [ctx.tenantId, cycleId, r.unitId, r.layer, pl.report.title, h.birim_adi, h.yanit_sayisi, h.karsilastirma_adi, h.ana_sonuc_baslik, h.ana_sonuc_metin, start, pl.report.measurePeriod, ctx.userId])).rows[0].id as string;
      let steps = 0, carried = 0; const n = Number(h.yanit_sayisi);
      for (const p of r.plans.slice().sort((a, b) => Number(a.plan_no) - Number(b.plan_no))) {
        const hedef = p.hedef_turu === 'HEDEF';
        const pid = (await tx.query('INSERT INTO rm2_plan (tenant_id, roadmap_id, unit_id, plan_no, title, item_code, item_text, respondents, current_pos, current_pct, comparison_pct, target_kind, target_pos, target_pct, responsibility, impact_text) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id',
          [ctx.tenantId, rid, r.unitId, p.plan_no, p.baslik, p.madde_kodu, p.madde_metni, n || null, p.mevcut_olumlu, p.mevcut_yuzde, p.karsilastirma_yuzde, p.hedef_turu, hedef ? p.hedef_olumlu : null, hedef ? (p.hedef_yuzde ?? Math.round(Number(p.hedef_olumlu) / n * 1000) / 10) : null, p.sorumluluk, p.etki_metni])).rows[0].id as string;
        for (const s of r.steps.filter(x => x.plan_no === p.plan_no).sort((a, b) => Number(a.asama_gun) - Number(b.asama_gun) || Number(a.sira) - Number(b.sira))) {
          const refKey = s._ref as string | null; const refId = refKey ? stepIds[refKey] ?? null : null;
          const old = !refId && s.rol !== 'CALISAN' ? prevSteps.find(o => o.plan_no === p.plan_no && o.role_code === s.rol && o.phase_days === s.asama_gun && o.text === s.adim) : undefined;
          const id = (await tx.query('INSERT INTO rm2_step (tenant_id, roadmap_id, plan_id, unit_id, role_code, role_label, phase_days, ord, text, output, contribution, ref_label, ref_step_id, due_date, status, note, updated_by, status_at, carried_from) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id',
            [ctx.tenantId, rid, pid, r.unitId, s.rol, s.rol_adi, s.asama_gun, s.sira, s.adim, s.cikti, s.plana_katkisi, s.kurum_atfi, refId, addDays(start, Number(s.asama_gun)), old?.status ?? 'NOT_DONE', old?.note ?? null, old?.updated_by ?? null, old?.status_at ?? null, old?.id ?? null /* v3.1.0: kayıt geçmişi zinciri */])).rows[0].id as string;
          if (r.layer === 'KURUM') stepIds[`${r.unitCode}|${s.plan_no}|${s.rol}|${s.asama_gun}|${s.sira}`] = id;
          steps++; if (old?.status === 'DONE') carried++;
        }
      }
      let ord = 0; for (const i of r.items.slice().sort((a, b) => Number(a.sira) - Number(b.sira))) { ord++; await tx.query('INSERT INTO rm2_item (tenant_id, roadmap_id, unit_id, ord, item_code, item_text, link_label, current_pct, comparison_pct, sector_pct, target_label) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [ctx.tenantId, rid, r.unitId, ord, i.madde_kodu, i.madde_metni, i.baglanti, i.mevcut_yuzde, i.karsilastirma_yuzde, i.sektor_yuzde, i.hedef]); }
      out.push({ unit: r.unitCode, roadmapId: rid, plans: r.plans.length, steps, carried });
    }
    return { cycleId, roadmaps: out.length, plans: out.reduce((a, x) => a + x.plans, 0), steps: out.reduce((a, x) => a + x.steps, 0), carriedStatuses: out.reduce((a, x) => a + x.carried, 0), units: out };
  },
};
