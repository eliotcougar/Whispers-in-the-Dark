import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { mkdir, open, readFile, rename, rm, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRemoteJWKSet, jwtVerify, customFetch } from 'jose';
import { safeParseJson } from '../utils/jsonUtils';
import type { ChatGPTModel, ChatGPTStatus, ChatGPTTextRequest, ChatGPTTextResult } from '../shared/chatgpt';
import { isOpenAIImageModel, isImageQuality, isImageAspectRatio, type OpenAIImageRequest, type OpenAIImageResult, type OpenAIImageStatus } from '../shared/images';

const ISSUER = 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const executeFile = promisify(execFile);
const terminalRefreshErrors = new Set([
  'invalid_grant', 'invalid_refresh_token', 'token_expired', 'refresh_token_expired',
  'refresh_token_invalidated', 'refresh_token_invalid', 'refresh_token_reused',
]);

type JsonObject = Record<string, unknown>;
export const asObject = (value: unknown): JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};

interface Credentials {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
  scopes: Array<string>;
}

interface Profile {
  id: string;
  clientId: string;
  subject?: string;
  email?: string;
  credentials?: Credentials;
}

interface SavedState {
  hostId: string;
  activeProfileId: string | null;
  profiles: Array<Profile>;
  openAIImageApiKey?: string;
}

interface PendingSignIn {
  state: string;
  nonce: string;
  verifier: string;
  redirectUri: string;
  profile: Profile;
  newRegistration: boolean;
  server: Server;
  timer: ReturnType<typeof setTimeout>;
}

export class ChatGPTError extends Error {
  readonly code: string;
  constructor(message: string, code = 'chatgpt_error') {
    super(message);
    this.name = 'ChatGPTError';
    this.code = code;
  }
}

const errorMessage = (code: string): string => {
  if (code === 'subscription_sharing_usage_limit_exceeded') return 'ChatGPT usage limit reached. Review your plan and this app’s limit in Manage usage.';
  if (code === 'subscription_sharing_user_not_eligible') return 'This ChatGPT account or workspace is not eligible to use its plan in the game.';
  if (code === 'subscription_sharing_unsupported_capability') return 'The selected model does not support this request through ChatGPT plan usage. Choose another model.';
  if (code === 'subscription_sharing_usage_unavailable' || code === 'subscription_sharing_user_unavailable') return 'ChatGPT plan usage is temporarily unavailable. Please try again later.';
  return 'The ChatGPT request failed. Try reconnecting your account or choosing another available model.';
};

// Only return classified messages to the browser. Upstream bodies can contain credentials.
const readUpstream = async (response: Response): Promise<JsonObject> => {
  const data = asObject(safeParseJson<unknown>(await response.text()));
  if (!response.ok) {
    const codeValue = asObject(data.error).code ?? data.error;
    const code = typeof codeValue === 'string' ? codeValue : `http_${String(response.status)}`;
    throw new ChatGPTError(errorMessage(code), code);
  }
  return data;
};

export async function readCompletedResponse(response: Response): Promise<ChatGPTTextResult> {
  if (!response.ok) { await readUpstream(response); }
  if (!response.body) throw new ChatGPTError('ChatGPT returned an empty response.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let result: ChatGPTTextResult | null = null;
  try {
    for (;;) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      // SSE events may span network chunks and use either LF or CRLF.
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer)) !== null) {
        const event = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const raw = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!raw || raw === '[DONE]') continue;
        const data = asObject(safeParseJson<unknown>(raw));
        if (data.type === 'response.output_text.delta' && typeof data.delta === 'string') text += data.delta;
        if (data.type === 'response.refusal.delta') throw new ChatGPTError('ChatGPT could not complete this game request. Try a different action.');
        if (data.type === 'response.failed' || data.type === 'error') {
          const error = asObject(asObject(data.response).error ?? data.error ?? data);
          const code = typeof error.code === 'string' ? error.code : 'response_failed';
          throw new ChatGPTError(errorMessage(code), code);
        }
        if (data.type === 'response.incomplete') throw new ChatGPTError('ChatGPT’s response was incomplete. The game has not applied it. Please retry.');
        if (data.type === 'response.completed') {
          const completed = asObject(data.response);
          const usage = asObject(completed.usage);
          if (Array.isArray(completed.output)) {
            const contents = completed.output.flatMap(item => {
              const content = asObject(item).content;
              return Array.isArray(content) ? content as Array<unknown> : [];
            }).map(asObject);
            if (contents.some(item => item.type === 'refusal')) throw new ChatGPTError('ChatGPT could not complete this game request. Try a different action.');
            const finalText = contents.filter(item => item.type === 'output_text' && typeof item.text === 'string').map(item => String(item.text)).join('');
            if (finalText) text = finalText;
          }
          result = {
            text, model: typeof completed.model === 'string' ? completed.model : '',
            inputTokens: typeof usage.input_tokens === 'number' ? usage.input_tokens : 0,
            outputTokens: typeof usage.output_tokens === 'number' ? usage.output_tokens : 0,
          };
        }
      }
      if (chunk.done) break;
    }
  } finally { reader.releaseLock(); }
  if (!result?.text.trim()) throw new ChatGPTError('ChatGPT’s response did not finish. The game has not applied it. Please retry.');
  return result;
}

export class ChatGPTRuntime {
  private state: SavedState | null = null;
  private loading: Promise<SavedState> | null = null;
  private refresh: Promise<void> | null = null;
  private pending: PendingSignIn | null = null;
  private lastError: string | null = null;
  private discovery: Promise<JsonObject> | null = null;
  private keys: ReturnType<typeof createRemoteJWKSet> | null = null;
  private lockOwned = false;
  private closing = false;
  private startingSignIn = false;
  private finishingSignIn = false;
  private requests = 0;
  private saving: Promise<void> = Promise.resolve();
  private readonly directory: string;
  private readonly fetcher: typeof fetch;

  constructor(directory = path.join(homedir(), '.config', 'whispers-in-the-dark', 'chatgpt'), fetcher: typeof fetch = fetch) {
    this.directory = directory;
    this.fetcher = fetcher;
  }

  private async load(): Promise<SavedState> {
    if (this.state) return this.state;
    this.loading ??= this.loadStore().catch((error: unknown) => { this.loading = null; throw error; });
    return this.loading;
  }

  private async loadStore(): Promise<SavedState> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    if (process.platform === 'win32') {
      // Restrict the new app directory, not the user's existing configuration tree.
      const { stdout } = await executeFile(path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32', 'whoami.exe'), ['/user', '/fo', 'csv', '/nh'], { windowsHide: true });
      const sid = /S-1-5-[\d-]+/.exec(stdout)?.[0];
      if (!sid) throw new ChatGPTError('Could not protect the local ChatGPT credential directory.');
      await executeFile(path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32', 'icacls.exe'), [this.directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true });
    } else { await chmod(this.directory, 0o700); }
    const lockPath = path.join(this.directory, 'runtime.lock');
    try {
      const lock = await open(lockPath, 'wx', 0o600);
      await lock.writeFile(String(process.pid));
      await lock.close();
    } catch (error: unknown) {
      if (asObject(error).code !== 'EEXIST') throw error;
      const pid = Number(await readFile(lockPath, 'utf8'));
      let alive = true;
      try { process.kill(pid, 0); } catch (failure: unknown) { alive = asObject(failure).code !== 'ESRCH'; }
      if (alive || !Number.isInteger(pid) || pid <= 0) throw new ChatGPTError('Another local game server is using ChatGPT. Close it before connecting here.');
      await rm(lockPath);
      const lock = await open(lockPath, 'wx', 0o600);
      await lock.writeFile(String(process.pid));
      await lock.close();
    }
    this.lockOwned = true;
    let saved: unknown;
    try { saved = safeParseJson<unknown>(await readFile(path.join(this.directory, 'accounts.json'), 'utf8')); }
    catch (error: unknown) { if (asObject(error).code !== 'ENOENT') throw error; }
    if (saved !== undefined) {
      const data = asObject(saved);
      if (typeof data.hostId !== 'string' || !Array.isArray(data.profiles) || !data.profiles.every(item => {
        const profile = asObject(item);
        const credentials = asObject(profile.credentials);
        return typeof profile.id === 'string' && typeof profile.clientId === 'string' &&
          (profile.credentials === undefined || (typeof credentials.accessToken === 'string' && typeof credentials.expiresAt === 'number' && Array.isArray(credentials.scopes) && credentials.scopes.every(scope => typeof scope === 'string')));
      })) throw new ChatGPTError('The local ChatGPT account file is invalid. Restore it from a backup before reconnecting.');
      if (data.openAIImageApiKey !== undefined && typeof data.openAIImageApiKey !== 'string') throw new ChatGPTError('The saved OpenAI image key is invalid.');
      this.state = { hostId: data.hostId, activeProfileId: typeof data.activeProfileId === 'string' ? data.activeProfileId : null, profiles: data.profiles as Array<Profile>, openAIImageApiKey: data.openAIImageApiKey };
    } else { this.state = { hostId: `urn:uuid:${randomUUID()}`, activeProfileId: null, profiles: [] }; }
    return this.state;
  }

  private async save(): Promise<void> {
    if (!this.state || this.closing) return;
    const snapshot = JSON.stringify(this.state);
    // Key edits and OAuth renewal share this store; keep atomic writes in mutation order.
    this.saving = this.saving.catch(() => undefined).then(async () => {
      const target = path.join(this.directory, 'accounts.json');
      const temporary = `${target}.${randomUUID()}.tmp`;
      const file = await open(temporary, 'wx', 0o600);
      try { await file.writeFile(snapshot); await file.sync(); }
      finally { await file.close(); }
      await rename(temporary, target);
    });
    await this.saving;
  }

  async imageStatus(): Promise<OpenAIImageStatus> {
    const state = await this.load();
    return { keyConfigured: !!state.openAIImageApiKey };
  }

  async setImageApiKey(value: string): Promise<OpenAIImageStatus> {
    const apiKey = value.trim();
    if (apiKey && (apiKey.length < 10 || apiKey.length > 4096 || /\s/.test(apiKey))) throw new ChatGPTError('Enter a valid OpenAI API key without spaces.');
    const state = await this.load();
    if (apiKey) state.openAIImageApiKey = apiKey;
    else delete state.openAIImageApiKey;
    await this.save();
    return this.imageStatus();
  }

  async generateImage(request: OpenAIImageRequest): Promise<OpenAIImageResult> {
    const state = await this.load();
    const apiKey = state.openAIImageApiKey;
    if (!apiKey) throw new ChatGPTError('Open AI Connection → Images and save an OpenAI API key.');
    if (!isOpenAIImageModel(request.model) || !request.prompt.trim() || request.prompt.length > 32000 || !isImageQuality(request.quality) || !isImageAspectRatio(request.aspectRatio)) throw new ChatGPTError('Invalid image request.');
    let response: Response;
    try {
      response = await this.fetcher(`${RESOURCE}/images/generations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model, prompt: request.prompt, n: 1,
          size: request.aspectRatio === '1:1' ? '1024x1024' : '1536x1024',
          quality: request.quality, output_format: 'jpeg', output_compression: 85,
        }),
        signal: AbortSignal.timeout(5 * 60_000),
      });
    } catch { throw new ChatGPTError('Could not complete the OpenAI image request. Check your connection before retrying.'); }
    const data = asObject(safeParseJson<unknown>(await response.text()));
    if (!response.ok) {
      const code = asObject(data.error).code;
      if (response.status === 401) throw new ChatGPTError('The OpenAI image API key was rejected. Replace it in AI Connection → Images.');
      if (code === 'insufficient_quota') throw new ChatGPTError('OpenAI API credits are unavailable. Check the API account’s billing and credit balance.');
      if (response.status === 429) throw new ChatGPTError('OpenAI’s image API rate limit was reached. Wait before trying again.');
      if (response.status === 403) throw new ChatGPTError('This OpenAI API key cannot access the image model. Check its permissions and whether the API organization needs verification.');
      if (code === 'content_policy_violation') throw new ChatGPTError('OpenAI declined this image prompt. Try a different scene.');
      throw new ChatGPTError('OpenAI image generation failed. Check the API key’s model access before retrying.');
    }
    const image = Array.isArray(data.data) ? asObject(data.data[0]).b64_json : undefined;
    if (typeof image !== 'string' || !image || image.length > 35 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) throw new ChatGPTError('OpenAI did not return valid image data.');
    const bytes = Buffer.from(image, 'base64');
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new ChatGPTError('OpenAI did not return the requested JPEG image.');
    return { base64: image, mimeType: 'image/jpeg' };
  }

  async status(): Promise<ChatGPTStatus> {
    const state = await this.load();
    return {
      profiles: state.profiles.map((profile, index) => ({
        id: profile.id, label: `${profile.email ?? 'ChatGPT account'} · ${String(index + 1)}`,
        connected: !!profile.credentials,
        sharing: !!profile.credentials?.scopes.includes('chatgpt.tokens.use.direct'),
      })),
      activeProfileId: state.activeProfileId, pending: !!this.pending || this.startingSignIn || this.finishingSignIn, error: this.lastError,
    };
  }

  async selectProfile(id: string): Promise<ChatGPTStatus> {
    if (this.pending || this.refresh || this.finishingSignIn || this.startingSignIn || this.requests) throw new ChatGPTError('Finish the current game request or account operation first.');
    const state = await this.load();
    if (!state.profiles.some(profile => profile.id === id)) throw new ChatGPTError('Unknown ChatGPT account.');
    state.activeProfileId = id;
    this.lastError = null;
    await this.save();
    return this.status();
  }

  async beginSignIn(profileId?: string): Promise<string> {
    if (this.pending || this.refresh || this.startingSignIn || this.finishingSignIn || this.requests) throw new ChatGPTError('Finish the current game request or account operation first.');
    this.startingSignIn = true;
    try { return await this.startSignIn(profileId); }
    finally { this.startingSignIn = false; }
  }

  private async startSignIn(profileId?: string): Promise<string> {
    const state = await this.load();
    const saved = profileId ? state.profiles.find(profile => profile.id === profileId) : undefined;
    if (profileId && !saved) throw new ChatGPTError('Unknown ChatGPT account.');
    const profile = saved ?? { id: randomUUID(), clientId: 'dynamic_agent_client' };
    const server = createServer((req, res) => {
      void (async () => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        const pending = this.pending;
        if (req.method !== 'GET' || url.pathname !== '/auth/callback' || url.searchParams.get('state') !== pending?.state) {
          res.writeHead(400, { 'Content-Type': 'text/plain' }); res.end('Invalid sign-in callback.'); return;
        }
        this.pending = null;
        this.finishingSignIn = true;
        clearTimeout(pending.timer);
        try {
          if (url.searchParams.has('error')) throw new ChatGPTError('ChatGPT sign-in was cancelled or declined.');
          const callbackClient = url.searchParams.get('client_id');
          if (pending.newRegistration) {
            if (!callbackClient || callbackClient === 'dynamic_agent_client') throw new ChatGPTError('ChatGPT did not finish registering the game.');
            profile.clientId = callbackClient;
            state.profiles.push(profile);
            await this.save();
          } else if (callbackClient && callbackClient !== profile.clientId) throw new ChatGPTError('The ChatGPT registration did not match the selected account.');
          const code = url.searchParams.get('code');
          if (!code) throw new ChatGPTError('ChatGPT did not return an authorization code.');
          const tokens = await this.tokenRequest({ grant_type: 'authorization_code', client_id: profile.clientId, code, code_verifier: pending.verifier, redirect_uri: pending.redirectUri, resource: RESOURCE });
          if (typeof tokens.id_token !== 'string') throw new ChatGPTError('ChatGPT did not return a verifiable identity.');
          const discovery = await this.discover();
          if (typeof discovery.jwks_uri !== 'string' || new URL(discovery.jwks_uri).origin !== ISSUER) throw new ChatGPTError('Invalid OpenAI identity configuration.');
          this.keys ??= createRemoteJWKSet(new URL(discovery.jwks_uri), { [customFetch]: this.fetcher });
          const { payload } = await jwtVerify(tokens.id_token, this.keys, { issuer: ISSUER, audience: profile.clientId, requiredClaims: ['sub', 'exp', 'iat'], clockTolerance: 5 });
          if (payload.nonce !== pending.nonce || typeof payload.sub !== 'string' || !payload.sub.trim() || (profile.subject !== undefined && profile.subject !== payload.sub)) throw new ChatGPTError('The signed-in ChatGPT identity did not match this sign-in attempt.');
          profile.subject = payload.sub;
          profile.email = typeof payload.email === 'string' ? payload.email : undefined;
          profile.credentials = { ...this.credentials(tokens), idToken: tokens.id_token };
          state.activeProfileId = profile.id;
          this.lastError = null;
          await this.save();
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", 'Referrer-Policy': 'no-referrer' });
          res.end('<!doctype html><title>ChatGPT connected</title><body style="background:#0f172a;color:#e2e8f0;font:20px system-ui;padding:3rem"><h1>ChatGPT connected</h1><p>Return to the game tab to choose a model and continue.</p></body>');
        } catch (error: unknown) {
          this.lastError = error instanceof ChatGPTError ? error.message : 'ChatGPT sign-in failed. Please try again.';
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
          res.end('ChatGPT sign-in did not finish. Return to the game for details.');
        } finally { this.finishingSignIn = false; server.close(); }
      })().catch(() => { res.end('Sign-in failed.'); server.close(); });
    });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (!address || typeof address === 'string') { server.close(); throw new ChatGPTError('Could not start local sign-in.'); }
    const random = () => randomBytes(32).toString('base64url');
    const verifier = random();
    const pending: PendingSignIn = {
      state: random(), nonce: random(), verifier, redirectUri: `http://127.0.0.1:${String(address.port)}/auth/callback`,
      profile, newRegistration: !saved, server,
      timer: setTimeout(() => { this.cancelSignIn(); this.lastError = 'ChatGPT sign-in timed out. Please try again.'; }, 5 * 60_000),
    };
    this.pending = pending;
    this.lastError = null;
    const params = new URLSearchParams({
      client_id: profile.clientId, ext_agent_host_id: state.hostId, response_type: 'code', redirect_uri: pending.redirectUri,
      scope: SCOPES, resource: RESOURCE, state: pending.state, nonce: pending.nonce, code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    });
    if (!saved) params.set('agent_name_hint', 'Whispers in the Dark');
    else if (profile.email) params.set('login_hint', profile.email);
    if (saved?.credentials?.idToken) params.set('id_token_hint', saved.credentials.idToken);
    if (profile.credentials && !profile.credentials.scopes.includes('chatgpt.tokens.use.direct')) params.set('prompt', 'consent');
    // Persist the host before the first authorization, even if the user cancels.
    await this.save();
    return `${ISSUER}/api/accounts/authorize?${params.toString()}`;
  }

  cancelSignIn(): void {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    this.pending.server.close();
    this.pending = null;
  }

  private async discover(): Promise<JsonObject> {
    this.discovery ??= this.fetcher(`${ISSUER}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(20_000) }).then(readUpstream).catch((error: unknown) => { this.discovery = null; throw error; });
    return this.discovery;
  }

  private async tokenRequest(body: Record<string, string>): Promise<JsonObject> {
    return readUpstream(await this.fetcher(`${ISSUER}/api/accounts/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body), signal: AbortSignal.timeout(30_000) }));
  }

  private credentials(tokens: JsonObject, previous?: Credentials): Credentials {
    if (typeof tokens.access_token !== 'string' || typeof tokens.expires_in !== 'number' || tokens.expires_in <= 0 || (tokens.token_type !== undefined && (typeof tokens.token_type !== 'string' || tokens.token_type.toLowerCase() !== 'bearer'))) throw new ChatGPTError('ChatGPT returned invalid session credentials.');
    return {
      accessToken: tokens.access_token,
      refreshToken: typeof tokens.refresh_token === 'string' ? tokens.refresh_token : previous?.refreshToken,
      idToken: previous?.idToken,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scopes: typeof tokens.scope === 'string' ? tokens.scope.split(/\s+/) : previous?.scopes ?? [],
    };
  }

  private async active(): Promise<Profile> {
    const state = await this.load();
    const profile = state.profiles.find(item => item.id === state.activeProfileId);
    if (!profile?.credentials) throw new ChatGPTError('Open AI connection and sign in to ChatGPT to continue.');
    return profile;
  }

  private async accessToken(): Promise<string> {
    const profile = await this.active();
    if (!profile.credentials?.scopes.includes('chatgpt.tokens.use.direct')) throw new ChatGPTError('Reconnect ChatGPT and allow the game to use your ChatGPT plan.');
    if (profile.credentials.expiresAt <= Date.now() + 60_000) {
      this.refresh ??= (async () => {
        const previous = profile.credentials;
        if (!previous?.refreshToken) throw new ChatGPTError('Your ChatGPT session expired. Reconnect your account.');
        try { profile.credentials = this.credentials(await this.tokenRequest({ grant_type: 'refresh_token', client_id: profile.clientId, refresh_token: previous.refreshToken, resource: RESOURCE }), previous); await this.save(); }
        catch (error: unknown) {
          if (error instanceof ChatGPTError && terminalRefreshErrors.has(error.code)) { delete profile.credentials; await this.save(); }
          throw error;
        }
      })().finally(() => { this.refresh = null; });
      await this.refresh;
    }
    if (!profile.credentials.scopes.includes('chatgpt.tokens.use.direct')) throw new ChatGPTError('Reconnect ChatGPT and allow the game to use your ChatGPT plan.');
    return profile.credentials.accessToken;
  }

  async listModels(): Promise<Array<ChatGPTModel>> {
    const token = await this.accessToken();
    const data = await readUpstream(await this.fetcher(`${RESOURCE}/models`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) }));
    if (!Array.isArray(data.models)) throw new ChatGPTError('ChatGPT did not return a model catalog.');
    return data.models.map(asObject).filter(model => model.visibility === 'list' && typeof model.slug === 'string' && typeof model.display_name === 'string').map(model => ({ slug: String(model.slug), displayName: String(model.display_name) }));
  }

  async generate(request: ChatGPTTextRequest): Promise<ChatGPTTextResult> {
    if (this.pending || this.finishingSignIn || this.startingSignIn) throw new ChatGPTError('Finish connecting your ChatGPT account before continuing.');
    this.requests += 1;
    try { return await this.generateText(request); }
    finally { this.requests -= 1; }
  }

  private async generateText(request: ChatGPTTextRequest): Promise<ChatGPTTextResult> {
    const models = await this.listModels();
    if (!models.some(model => model.slug === request.model)) throw new ChatGPTError('Select a model available to your ChatGPT account.');
    const token = await this.accessToken();
    const response = await this.fetcher(`${RESOURCE}/responses`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: request.model, instructions: request.instructions, input: [{ role: 'user', content: request.prompt }], store: false, stream: true }),
      signal: AbortSignal.timeout(5 * 60_000),
    });
    return readCompletedResponse(response);
  }

  async signOut(): Promise<{ warning: string | null }> {
    if (this.pending || this.refresh || this.finishingSignIn || this.startingSignIn || this.requests) throw new ChatGPTError('Finish the current game request or account operation first.');
    const profile = await this.active();
    let warning: string | null = null;
    try {
      if (profile.credentials?.refreshToken) {
        const discovery = await this.discover();
        if (typeof discovery.revocation_endpoint !== 'string' || new URL(discovery.revocation_endpoint).origin !== ISSUER) throw new ChatGPTError('Invalid revocation endpoint.');
        const response = await this.fetcher(discovery.revocation_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: profile.credentials.refreshToken, token_type_hint: 'refresh_token', client_id: profile.clientId }), signal: AbortSignal.timeout(20_000) });
        if (!response.ok) throw new ChatGPTError('Revocation failed.');
      } else { warning = 'Signed out locally. Disconnect the game in ChatGPT settings to remove its access.'; }
    } catch { warning = 'Signed out locally. Remote revocation was not confirmed; disconnect the game in ChatGPT Settings → Security and login → Sign in with ChatGPT.'; }
    delete profile.credentials;
    await this.save();
    return { warning };
  }

  async close(): Promise<void> {
    this.cancelSignIn();
    if (this.refresh) await this.refresh.catch(() => undefined);
    this.closing = true;
    await this.saving.catch(() => undefined);
    if (this.lockOwned) { await rm(path.join(this.directory, 'runtime.lock'), { force: true }); this.lockOwned = false; }
  }
}
