/**
 * @file vite.config.ts
 * @description Configuration for Vite bundler.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv, Plugin } from 'vite';
import svgr from 'vite-plugin-svgr';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }: { mode: string }) => {
  const env = loadEnv(mode, '.', '');
  const plugins: Array<Plugin> = [svgr()];

  if (mode !== 'production' && env.GEMINI_API_KEY) {
    const injectGeminiKey = (): Plugin => ({
      name: 'inject-gemini-key',
      transformIndexHtml(html) {
        const jsonKey = JSON.stringify(env.GEMINI_API_KEY);
        return html.replace(
          '</head>',
          `<script>window.GEMINI_API_KEY=${jsonKey};localStorage.setItem('whispersInTheDark_geminiApiKey',${jsonKey});</script></head>`,
        );
      },
    });
    plugins.push(injectGeminiKey());
  }

  return {
    plugins,
    base: "/Whispers-in-the-Dark/",
    define: {},
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
