// Denetçinin tarayıcı sonuçları: tümü PASS olmalı. Tek belgeli istisna: LOGIN-ENTER geçersiz e-posta ("invalid-email") ile tek istek bekler;
// F14 gereği yerel e-posta doğrulaması bu isteği durdurur (0 istek). İstisna yalnız F14-ENTER-VALID (geçerli e-posta, tek istek) ve F14-EMAIL-INVALID (0 istek + ileti) geçtiyse kabul edilir.
import { readFileSync } from 'node:fs'; const OUT = process.env.OUT || 'docs/test-ciktilari/fe';
const a = JSON.parse(readFileSync(OUT + '/ui-results.json', 'utf8')); const r = JSON.parse(readFileSync(OUT + '/ui-regresyon-sonuc.json', 'utf8')); const ok = id => r.some(x => x.id === id && x.status === 'PASS');
const bad = a.filter(x => x.status !== 'PASS' && !(x.id === 'LOGIN-ENTER' && x.observed?.requests === 0 && ok('F14-ENTER-VALID') && ok('F14-EMAIL-INVALID')));
console.log('DENETÇİ TARAYICI', a.length, 'kontrol;', a.filter(x => x.status === 'PASS').length, 'PASS; belgeli istisna:', a.some(x => x.id === 'LOGIN-ENTER' && x.status !== 'PASS') ? 'LOGIN-ENTER (geçersiz e-posta yerelde durduruldu)' : 'yok', '; kabul dışı:', bad.map(x => x.id).join(',') || 'yok');
process.exit(bad.length ? 1 : 0);
