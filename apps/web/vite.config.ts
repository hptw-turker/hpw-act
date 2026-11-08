import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@hpw-act/domain-core': p('../../packages/domain-core/src/index.ts'),
      '@atlas': p('../../data/atlas'),
    },
  },
  server: { fs: { allow: [p('../..')] }, proxy: { '/api': 'http://localhost:8787' } },
  // Tek dosya derlemesinde (VITE_ROUTER=hash) klasik script üret: file:// ve her tarayıcıda module semantiği gerekmez.
  build: process.env.VITE_ROUTER === 'hash' ? { rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } }, modulePreload: false } : { rollupOptions: { input: process.env.VITE_APP_ONLY === '1' ? { app: p('./app.html') } : { index: p('./index.html'), app: p('./app.html') } } }, // v3.0: sunucu imajında yalnız ürün (prototip ve sentetik veri gerekmez)
});
