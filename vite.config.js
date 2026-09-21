import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 4173, strictPort: true, allowedHosts: ['terminal.local'], proxy: { '/api': 'http://127.0.0.1:4000', '/socket.io': { target: 'http://127.0.0.1:4000', ws: true } } },
  build: { outDir: 'dist', sourcemap: false }
});
