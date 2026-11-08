/** Ortam dosyası yükleyici: HPW_ENV_FILE=.env.demo gibi; mevcut süreç değişkenleri dosyayı ezer (sırlar CI/sunucudan verilebilir). */
import { readFileSync, existsSync } from 'node:fs';
const f = process.env.HPW_ENV_FILE; if (f && existsSync(f)) for (const line of readFileSync(f, 'utf8').split('\n')) { const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line); if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^"(.*)"$/, '$1'); }
