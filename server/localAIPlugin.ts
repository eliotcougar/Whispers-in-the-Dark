import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import { ChatGPTRuntime, ChatGPTError, asObject } from './chatgptRuntime';
import { safeParseJson } from '../utils/jsonUtils';
import { isImageAspectRatio, isImageQuality, isOpenAIImageModel } from '../shared/images';

const isLoopback = (value: string): boolean =>
  value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';

export function isLocalAIRequest(req: Pick<IncomingMessage, 'headers' | 'method'> & { readonly socket: { readonly remoteAddress?: string } }, port: number): boolean {
  if (!isLoopback(req.socket.remoteAddress ?? '')) return false;
  const host = req.headers.host;
  if (host !== `localhost:${String(port)}` && host !== `127.0.0.1:${String(port)}` && host !== `[::1]:${String(port)}`) return false;
  const origin = req.headers.origin;
  if (origin && origin !== `http://${host}`) return false;
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  return req.method === 'GET' || (req.headers['x-whispers-local'] === '1' && req.headers['content-type'] === 'application/json' && origin === `http://${host}`);
}

const readBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Array<Buffer> = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += bytes.length;
    if (size > 2 * 1024 * 1024) throw new ChatGPTError('The game request is too large.');
    chunks.push(bytes);
  }
  const data: unknown = safeParseJson(Buffer.concat(chunks).toString('utf8'));
  if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new ChatGPTError('Invalid local game request.');
  return asObject(data);
};

const send = (res: ServerResponse, status: number, value: unknown): void => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
};

export function localAIPlugin(): Plugin {
  let base = '/';
  const attach = (server: ViteDevServer | PreviewServer): void => {
    const runtime = new ChatGPTRuntime();
    server.httpServer?.once('close', () => { void runtime.close(); });
    server.middlewares.use((req, res, next) => {
      const pathname = (req.url ?? '').split('?')[0];
      const prefix = `${base}api/local-ai/`;
      if (!pathname.startsWith(prefix)) { next(); return; }
      const address = server.httpServer?.address();
      if (!address || typeof address === 'string' || !isLocalAIRequest(req, address.port)) { send(res, 403, { error: 'OpenAI connections are available only from this game’s local browser session.' }); return; }
      const route = pathname.slice(prefix.length);
      void (async () => {
        if (req.method === 'GET' && route === 'status') { send(res, 200, await runtime.status()); return; }
        if (req.method === 'GET' && route === 'models') { send(res, 200, await runtime.listModels()); return; }
        if (req.method === 'GET' && route === 'image-settings') { send(res, 200, await runtime.imageStatus()); return; }
        if (req.method !== 'POST') { send(res, 405, { error: 'Method not allowed.' }); return; }
        const data = await readBody(req);
        if (route === 'image-key' && typeof data.apiKey === 'string') {
          send(res, 200, await runtime.setImageApiKey(data.apiKey));
        } else if (route === 'image' && isOpenAIImageModel(data.model) && typeof data.prompt === 'string' && isImageQuality(data.quality) && isImageAspectRatio(data.aspectRatio)) {
          send(res, 200, await runtime.generateImage({ model: data.model, prompt: data.prompt, quality: data.quality, aspectRatio: data.aspectRatio }));
        } else if (route === 'sign-in') {
          send(res, 200, { url: await runtime.beginSignIn(typeof data.profileId === 'string' ? data.profileId : undefined) });
        } else if (route === 'cancel') { runtime.cancelSignIn(); send(res, 200, await runtime.status()); }
        else if (route === 'select' && typeof data.profileId === 'string') { send(res, 200, await runtime.selectProfile(data.profileId)); }
        else if (route === 'sign-out') { send(res, 200, await runtime.signOut()); }
        else if (route === 'generate' && typeof data.model === 'string' && typeof data.prompt === 'string' && typeof data.instructions === 'string') {
          send(res, 200, await runtime.generate({ model: data.model, prompt: data.prompt, instructions: data.instructions }));
        } else { send(res, 400, { error: 'Unknown local game request.' }); }
      })().catch((error: unknown) => {
        // Never serialize upstream exceptions, tokens, or authorization URLs.
        const known = error instanceof ChatGPTError;
        send(res, 400, { error: known ? error.message : 'The local ChatGPT connection failed. Please try again.', code: known ? error.code : 'local_connection_failed' });
      });
    });
  };
  return {
    name: 'whispers-local-ai',
    configResolved(config) { base = config.base; },
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
