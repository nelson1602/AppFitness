import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The API serves `admin/dist` at /admin and the JSON API at /admin/api on the
// same origin, so the session cookie stays same-origin in production. In
// development the Vite server proxies /admin/api to the local API.
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: {
    proxy: {
      '/admin/api': {
        target: 'http://localhost:3001',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
});
