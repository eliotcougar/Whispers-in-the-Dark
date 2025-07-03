/**
 * @file vite.config.ts
 * @description Configuration for Vite bundler.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import svgr from 'vite-plugin-svgr';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }: { mode: string }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [svgr()],
    base: "/Whispers-in-the-Dark/",
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KE),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KE),
    },
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
