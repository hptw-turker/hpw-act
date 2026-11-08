import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normTxt } from '../src/textnorm.js';
test('F99-07 (fonksiyon testi): 1,5 gün ile 15 gün aynı sayılmaz; 1,5 = 1.5; boşluk/noktalama anlam taşımaz', () => {
  assert.notEqual(normTxt('Vardiya planım 1,5 gün önce açıklanır'), normTxt('Vardiya planım 15 gün önce açıklanır'));
  assert.equal(normTxt('1,5 gün'), normTxt('1.5 gün'));
  assert.equal(normTxt('Vardiya  planım,  en az 2 hafta önce açıklanır.'), normTxt('vardiya planım en az 2 hafta önce açıklanır'));
  assert.notEqual(normTxt('yöneticim bana güvenir'), normTxt('yöneticim bana güvenmez'), 'anlam değişimi otomatik eşitlenmez');
});
