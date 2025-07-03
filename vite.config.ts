/**
 * @file vite.config.ts
 * @description Configuration for Vite bundler.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [svgr()],
    base: "/Whispers-in-the-Dark/",
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('genai')) {
              return 'gemini';
            }
            if (id.includes('node_modules')) {
              return 'vendor';
            }
            if (id.includes('debug')) {
              return 'debug';
            }
            if (id.includes('resources')) {
              return 'resources';
            }
            if (id.includes('corrections')) {
              return 'corrections';
            }
            if (id.includes('utils')) {
              return 'utils';
            }
          },
        },
      },
    },
  };
});
