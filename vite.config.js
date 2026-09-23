import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { BRAND } from './shared/brand.js';

/** index.html cannot import modules, so the %BRAND_*% placeholders in it are filled from the same
 *  config the app uses. Renaming the product stays a one-line change. */
const brandHtml = () => ({
  name: 'brand-html',
  transformIndexHtml: html => html
    .replace(/%BRAND_TITLE%/g, BRAND.title)
    .replace(/%BRAND_DESCRIPTION%/g, BRAND.description),
});

export default defineConfig({
  plugins: [react(), brandHtml()],
  server: { host: '0.0.0.0', port: 4173, strictPort: true, allowedHosts: ['terminal.local'], proxy: { '/api': 'http://127.0.0.1:4000', '/socket.io': { target: 'http://127.0.0.1:4000', ws: true } } },
  build: { outDir: 'dist', sourcemap: false }
});
