// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ChatGPTRuntime } from '../server/chatgptRuntime';
import { DEFAULT_OPENAI_IMAGE_MODEL } from '../shared/images';
import { safeParseJson } from '../utils/jsonUtils';

const key = 'sk-unit-test-openai-image-key';
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });

async function harness(response = Response.json({ data: [{ b64_json: jpeg }] })) {
  const directory = await mkdtemp(path.join(tmpdir(), 'whispers-images-test-'));
  const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(response));
  const runtime = new ChatGPTRuntime(directory, fetcher);
  cleanup.push(async () => {
    await runtime.close();
    if (path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith('whispers-images-test-')) throw new Error('Unexpected test directory');
    await rm(directory, { recursive: true, force: true });
  });
  return { runtime, fetcher, directory };
}

describe('independent OpenAI image key', () => {
  it('persists the key without exposing it in status or requiring ChatGPT sign-in', async () => {
    const h = await harness();
    expect(await h.runtime.setImageApiKey(key)).toEqual({ keyConfigured: true });
    expect(h.fetcher).not.toHaveBeenCalled();
    expect((await h.runtime.status()).profiles).toEqual([]);
    expect(JSON.stringify(await h.runtime.status())).not.toContain(key);
    expect(JSON.stringify(await h.runtime.imageStatus())).not.toContain(key);
    await h.runtime.close();
    const resumed = new ChatGPTRuntime(h.directory, h.fetcher);
    try {
      expect(await resumed.imageStatus()).toEqual({ keyConfigured: true });
      await resumed.setImageApiKey('');
      expect(await resumed.imageStatus()).toEqual({ keyConfigured: false });
      expect(await readFile(path.join(h.directory, 'accounts.json'), 'utf8')).not.toContain(key);
    } finally { await resumed.close(); }
  });
  it('uses the selected image model and API key for one JPEG with the requested quality', async () => {
    const h = await harness();
    await h.runtime.setImageApiKey(key);
    expect(await h.runtime.generateImage({ model: 'gpt-image-2.6-sunburst', prompt: 'A prepared scene depiction.', aspectRatio: '4:3', quality: 'low' })).toEqual({ base64: jpeg, mimeType: 'image/jpeg' });
    expect(h.fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = h.fetcher.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/images/generations');
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${key}` });
    const body = typeof init?.body === 'string' ? safeParseJson(init.body) : null;
    expect(body).toEqual({ model: 'gpt-image-2.6-sunburst', prompt: 'A prepared scene depiction.', n: 1, size: '1536x1024', quality: 'low', output_format: 'jpeg', output_compression: 85 });
  });
  it('does not generate when no image key is configured', async () => {
    const h = await harness();
    await expect(h.runtime.generateImage({ model: DEFAULT_OPENAI_IMAGE_MODEL, prompt: 'Scene', aspectRatio: '1:1', quality: 'medium' })).rejects.toThrow('save an OpenAI API key');
    expect(h.fetcher).not.toHaveBeenCalled();
  });
  it('rejects unsupported models before sending a paid request', async () => {
    const h = await harness();
    await h.runtime.setImageApiKey(key);
    const request = { model: DEFAULT_OPENAI_IMAGE_MODEL, prompt: 'Scene', aspectRatio: '1:1' as const, quality: 'medium' as const };
    Object.assign(request, { model: 'gpt-image-1' });
    await expect(h.runtime.generateImage(request)).rejects.toThrow('Invalid image request');
    expect(h.fetcher).not.toHaveBeenCalled();
  });
  it('reports API billing failures without retrying or exposing upstream content', async () => {
    const h = await harness(Response.json({ error: { code: 'insufficient_quota', message: key } }, { status: 429 }));
    await h.runtime.setImageApiKey(key);
    await expect(h.runtime.generateImage({ model: DEFAULT_OPENAI_IMAGE_MODEL, prompt: 'Scene', aspectRatio: '1:1', quality: 'medium' })).rejects.toThrow('API credits');
    expect(h.fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects malformed image data instead of handing it to the browser', async () => {
    const h = await harness(Response.json({ data: [{ b64_json: 'not-an-image' }] }));
    await h.runtime.setImageApiKey(key);
    await expect(h.runtime.generateImage({ model: DEFAULT_OPENAI_IMAGE_MODEL, prompt: 'Scene', aspectRatio: '1:1', quality: 'medium' })).rejects.toThrow('valid image data');
  });
});
