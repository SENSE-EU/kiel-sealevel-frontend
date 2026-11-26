/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const strapi = env.STRAPI_PROXY_TARGET || 'http://localhost:1337';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      // Caddy strips /cms before forwarding to Strapi in deployed environments.
      proxy: {
        '/cms': {
          target: strapi,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/cms(?=\/|$)/, ''),
        },
        '/uploads': strapi,
      },
    },
    // Three.js is one large chunk, loaded only on entering a scene (about 200 kB gzipped).
    build: { chunkSizeWarningLimit: 800 },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  };
});
