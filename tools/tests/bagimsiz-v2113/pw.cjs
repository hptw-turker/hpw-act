// Ortam uyarlaması (davranış değil): denetçi betikleri Playwright'ı kök dizindeki pw.cjs üzerinden yükler (tests/*/pw.cjs → ../../pw.cjs, tests/edge-ui.cjs → ../pw.cjs).
// Denetçinin ortamındaki sarmalayıcı pakete eklenmemişti; bu dosya aynı arayüzü bu ortamdaki Playwright kurulumuna bağlar.
module.exports = require(process.env.PLAYWRIGHT_MODULE || '/home/claude/.npm-global/lib/node_modules/playwright');
