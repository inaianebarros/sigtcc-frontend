import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.DEV_PROXY_TARGET ?? 'http://localhost:8000';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      strictPort: true,
      headers: { 'Referrer-Policy': 'no-referrer' },
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true, xfwd: true },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
  };
});
