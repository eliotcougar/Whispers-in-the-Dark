// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { safeParseJson } from '../utils/jsonUtils';
import { ChatGPTRuntime, readCompletedResponse } from '../server/chatgptRuntime';
import { isLocalAIRequest } from '../server/localAIPlugin';

const event = (data: unknown) => `data: ${JSON.stringify(data)}\n\n`;
const finished = (text: string) => new Response(event({ type: 'response.output_text.delta', delta: text }) + event({ type: 'response.completed', response: { model: 'test-text', usage: { input_tokens: 10, output_tokens: 5 } } }));
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });

describe('ChatGPT response completion', () => {
  it('handles split UTF-8, CRLF and multi-line SSE without losing JSON', async () => {
    const raw = new TextEncoder().encode(event({ type: 'response.output_text.delta', delta: '{"scene":"café"}' }).replace(/\n/g, '\r\n') + event({ type: 'response.completed', response: { model: 'test' } }));
    const body = new ReadableStream({ start(controller) { for (const byte of raw) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
    expect((await readCompletedResponse(new Response(body))).text).toBe('{"scene":"café"}');
  });
  it('rejects partial output and late usage-limit failures', async () => {
    await expect(readCompletedResponse(new Response(event({ type: 'response.output_text.delta', delta: '{"scene":' })))).rejects.toThrow('did not finish');
    await expect(readCompletedResponse(new Response(event({ type: 'response.output_text.delta', delta: 'partial' }) + event({ type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } } })))).rejects.toThrow('usage limit reached');
    await expect(readCompletedResponse(new Response(event({ type: 'response.incomplete' })))).rejects.toThrow('incomplete');
  });
});

describe('loopback request protection', () => {
  const request = (host: string, origin: string, address = '127.0.0.1') => ({ method: 'POST', socket: { remoteAddress: address }, headers: { host, origin, 'content-type': 'application/json', 'x-whispers-local': '1' } });
  it('rejects remote clients, cross-origin requests and DNS rebinding hosts', () => {
    expect(isLocalAIRequest(request('127.0.0.1:5173', 'http://127.0.0.1:5173'), 5173)).toBe(true);
    expect(isLocalAIRequest(request('127.0.0.1:5173', 'https://untrusted.example'), 5173)).toBe(false);
    expect(isLocalAIRequest(request('untrusted.example:5173', 'http://untrusted.example:5173'), 5173)).toBe(false);
    expect(isLocalAIRequest(request('127.0.0.1:5173', 'http://127.0.0.1:5173', '192.168.1.2'), 5173)).toBe(false);
  });
});

async function harness(scope = 'openid profile email chatgpt.tokens.use.direct offline_access', wrongNonce = false) {
  const directory = await mkdtemp(path.join(tmpdir(), 'whispers-chatgpt-test-'));
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  let nonce = '';
  let exchange: URLSearchParams | null = null;
  let sent: Record<string, unknown> = {};
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const body = typeof init?.body === 'string' ? init.body : init?.body instanceof URLSearchParams ? init.body.toString() : '';
    if (url.endsWith('/.well-known/openid-configuration')) return Response.json({ jwks_uri: 'https://auth.openai.com/jwks', revocation_endpoint: 'https://auth.openai.com/revoke' });
    if (url.endsWith('/jwks')) return Response.json({ keys: [{ ...jwk, kid: 'test', alg: 'RS256', use: 'sig' }] });
    if (url.endsWith('/oauth/token')) {
      exchange = new URLSearchParams(body);
      if (exchange.get('grant_type') === 'refresh_token') return Response.json({ access_token: 'fake-access-renewed', refresh_token: 'fake-refresh-renewed', expires_in: 3600 });
      const idToken = await new SignJWT({ nonce: wrongNonce ? 'wrong-nonce' : nonce, email: 'player@example.test' }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer('https://auth.openai.com').setAudience('oaiapp-test').setSubject('test-player').setIssuedAt().setExpirationTime('1h').sign(privateKey);
      return Response.json({ access_token: 'fake-access', refresh_token: 'fake-refresh', id_token: idToken, expires_in: 3600, scope });
    }
    if (url.endsWith('/models')) return Response.json({ models: [{ slug: 'test-text', display_name: 'Test Text', visibility: 'list' }] });
    if (url.endsWith('/responses')) { sent = safeParseJson<Record<string, unknown>>(body) ?? {}; return finished('{"scene":"A quiet room","options":["Look around"]}'); }
    if (url.endsWith('/revoke')) return new Response(null, { status: 200 });
    throw new Error('Unexpected test URL');
  });
  const runtime = new ChatGPTRuntime(directory, fetcher);
  cleanup.push(async () => {
    await runtime.close();
    if (path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith('whispers-chatgpt-test-')) throw new Error('Unexpected test directory');
    await rm(directory, { recursive: true, force: true });
  });
  const url = new URL(await runtime.beginSignIn());
  nonce = url.searchParams.get('nonce') ?? '';
  const callback = new URL(url.searchParams.get('redirect_uri') ?? '');
  callback.search = new URLSearchParams({ state: url.searchParams.get('state') ?? '', code: 'one-time-code', client_id: 'oaiapp-test' }).toString();
  return { runtime, url, callback, directory, fetcher, exchange: () => exchange, sent: () => sent };
}

describe('ChatGPT OAuth and text gameplay', () => {
  it('validates state and signed identity, persists a host, and completes a structured turn', async () => {
    const h = await harness();
    const invalid = new URL(h.callback); invalid.searchParams.set('state', 'unrelated-state');
    expect((await fetch(invalid)).status).toBe(400);
    expect(h.fetcher).not.toHaveBeenCalled();
    expect((await fetch(h.callback)).status).toBe(200);
    const exchange = h.exchange();
    expect(exchange?.get('client_id')).toBe('oaiapp-test');
    expect(exchange?.get('redirect_uri')).toBe(h.url.searchParams.get('redirect_uri'));
    const verifier = exchange?.get('code_verifier') ?? '';
    expect(createHash('sha256').update(verifier).digest('base64url')).toBe(h.url.searchParams.get('code_challenge'));
    const status = await h.runtime.status();
    expect(status.profiles[0].sharing).toBe(true);
    expect(JSON.stringify(status)).not.toContain('fake-access');
    await h.runtime.setImageApiKey('sk-unit-test-separate-image-key');
    const text = await h.runtime.generate({ model: 'test-text', prompt: 'Look around', instructions: 'Return scene and options as JSON' });
    expect(safeParseJson(text.text)).toMatchObject({ scene: 'A quiet room', options: ['Look around'] });
    const responseCall = h.fetcher.mock.calls.find(([url]) => typeof url === 'string' && url.endsWith('/responses'));
    expect(responseCall?.[1]?.headers).toMatchObject({ Authorization: 'Bearer fake-access' });
    expect(h.sent()).toEqual({ model: 'test-text', instructions: 'Return scene and options as JSON', input: [{ role: 'user', content: 'Look around' }], store: false, stream: true });
    const saved = JSON.parse(await readFile(path.join(h.directory, 'accounts.json'), 'utf8')) as { hostId: string };
    expect(saved.hostId).toBe(h.url.searchParams.get('ext_agent_host_id'));
    const again = new URL(await h.runtime.beginSignIn(status.profiles[0].id));
    expect(again.searchParams.get('client_id')).toBe('oaiapp-test');
    expect(again.searchParams.has('agent_name_hint')).toBe(false);
    expect(again.searchParams.get('ext_agent_host_id')).toBe(saved.hostId);
    h.runtime.cancelSignIn();
    await h.runtime.signOut();
    expect((await h.runtime.status()).profiles[0].connected).toBe(false);
    expect(await h.runtime.imageStatus()).toEqual({ keyConfigured: true });
  });
  it('serializes rotating-token refresh and retains previously granted scopes', async () => {
    const h = await harness();
    expect((await fetch(h.callback)).status).toBe(200);
    const target = path.join(h.directory, 'accounts.json');
    const saved = safeParseJson<{ profiles: Array<{ credentials: { expiresAt: number } }> }>(await readFile(target, 'utf8'));
    if (!saved) throw new Error('Missing test credential record');
    saved.profiles[0].credentials.expiresAt = 0;
    await writeFile(target, JSON.stringify(saved));
    await h.runtime.close();
    const resumed = new ChatGPTRuntime(h.directory, h.fetcher);
    try {
      const catalogs = await Promise.all([resumed.listModels(), resumed.listModels()]);
      expect(catalogs[0][0].slug).toBe('test-text');
      const refreshes = h.fetcher.mock.calls.filter(([, init]) => init?.body instanceof URLSearchParams && init.body.get('grant_type') === 'refresh_token');
      expect(refreshes).toHaveLength(1);
      expect((await readFile(target, 'utf8'))).toContain('fake-refresh-renewed');
      expect((await resumed.status()).profiles[0].sharing).toBe(true);
    } finally { await resumed.close(); }
  });
  it('rejects a valid signature with the wrong nonce', async () => {
    const h = await harness(undefined, true);
    expect((await fetch(h.callback)).status).toBe(400);
    expect((await h.runtime.status()).profiles[0].connected).toBe(false);
  });
  it('keeps identity-only sign-in separate from plan consent', async () => {
    const h = await harness('openid profile email');
    expect((await fetch(h.callback)).status).toBe(200);
    expect((await h.runtime.status()).profiles[0]).toMatchObject({ connected: true, sharing: false });
    await expect(h.runtime.generate({ model: 'test-text', prompt: 'Hello', instructions: '' })).rejects.toThrow('allow the game');
  });
});
