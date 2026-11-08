/** v3.0.0: şirketten bağımsız boş "Yol haritası dosyası" (yh-2). Şirkete özel dosya ürün içinden indirilir (birim kodları önceden yazılı).
 * Kullanım: node --import tsx scripts/roadmap2-form.mts <çıktı.xlsx> */
import { writeFileSync } from 'node:fs';
import { buildWorkbook } from '../src/xlsx.ts';
import { blankForm2, form2Dictionary, GUIDE2, RM2_FORM_VERSION, FORM2 } from '../src/importers/roadmap2.ts';
import { TEMPLATE_VERSION } from '../src/importers/common.ts';
const out = process.argv[2] ?? '../../docs/rapor-formu/HPW_Act_yol_haritasi_v3.xlsx';
const buf = await buildWorkbook({ title: 'HPW Act | Yol haritası dosyası (rapordan) · BOŞ', version: `${TEMPLATE_VERSION}/${RM2_FORM_VERSION}`, guide: GUIDE2,
  sheets: blankForm2({ Rapor: [{ sirket_kodu: 'SIRKET_KODU', donem_kodu: 'YYYY-ANA', rapor_adi: '', baslangic_tarihi: 'YYYY-AA-GG', etki_olcum_donemi: '' }] }), dictionary: form2Dictionary() });
writeFileSync(out, buf); console.log('yazıldı', out, FORM2.length, 'sayfa');
