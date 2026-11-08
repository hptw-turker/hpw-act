/** v2.15.0: şirketten bağımsız boş "Yol haritası formu"nu üretir (docs/rapor-formu/). Şirkete özel form ürün içinden indirilir (birim kodları önceden yazılı).
 * Kullanım: node --import tsx scripts/roadmap-form.mts <çıktı.xlsx> */
import { writeFileSync } from 'node:fs';
import { buildWorkbook } from '../src/xlsx.ts';
import { blankForm, formDictionary, ROADMAP_FORM_VERSION } from '../src/importers/roadmap.ts';
import { TEMPLATE_VERSION } from '../src/importers/common.ts';
const out = process.argv[2] ?? '../../docs/rapor-formu/HPW_Act_yol_haritasi_formu.xlsx';
const { FORM } = await import('../src/importers/roadmap.ts');
// KILAVUZ metni importer'daki GUIDE ile aynı olsun diye şablon uç noktasının ürettiği dosyadan değil, aynı tablodan üretilir
const guide = (await import('../src/importers/roadmap.ts')) as unknown as { GUIDE?: string[] };
const buf = await buildWorkbook({ title: 'HPW Act | Yol haritası formu (sunumla birebir) · BOŞ FORM', version: `${TEMPLATE_VERSION}/${ROADMAP_FORM_VERSION}`, guide: guide.GUIDE ?? [],
  sheets: blankForm({ Rapor: [{ tenant_code: 'SIRKET_KODU', cycle_code: 'YYYY-ANA', report_title: '', company_label: '', start_date: '', source_note: '' }] }), dictionary: formDictionary() });
writeFileSync(out, buf); console.log('yazıldı', out, FORM.length, 'sayfa');
