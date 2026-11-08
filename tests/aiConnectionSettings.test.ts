import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GEMINI_TEXT_MODEL } from '../shared/gemini';

const stored = new Map<string, string>();
const connectionKey = 'whispersInTheDark-ai-connection';

beforeEach(() => {
  stored.clear();
  vi.resetModules();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value); },
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('text model preferences', () => {
  it('adds the Flash-Lite default to older settings without replacing the ChatGPT model', async () => {
    stored.set(connectionKey, JSON.stringify({ provider: 'chatgpt', model: 'account-model' }));
    const { loadAIConnectionSettings } = await import('../services/aiConnectionStorage');
    expect(loadAIConnectionSettings()).toEqual({ provider: 'chatgpt', model: 'account-model', geminiModel: DEFAULT_GEMINI_TEXT_MODEL });
  });

  it('rejects image models or unknown models in saved text preferences', async () => {
    stored.set(connectionKey, JSON.stringify({ geminiModel: 'gemini-3-pro-image' }));
    const { loadAIConnectionSettings } = await import('../services/aiConnectionStorage');
    expect(loadAIConnectionSettings().geminiModel).toBe(DEFAULT_GEMINI_TEXT_MODEL);
  });

  it('remembers both text models across provider changes and reloads without affecting images', async () => {
    const images = JSON.stringify({ provider: 'openai', openaiModel: 'gpt-image-2.5-sunburst', quality: 'low' });
    stored.set('whispersInTheDark-image-connection', images);
    const { setGeminiModel, setChatGPTModel, setAIProvider } = await import('../services/aiProvider');
    setGeminiModel('gemini-flash-latest');
    setChatGPTModel('account-model');
    setAIProvider('chatgpt');
    setAIProvider('gemini');
    vi.resetModules();
    const { getAIConnection } = await import('../services/aiProvider');
    expect(getAIConnection()).toMatchObject({ provider: 'gemini', model: 'account-model', geminiModel: 'gemini-flash-latest' });
    expect(stored.get(connectionKey)).toBe(JSON.stringify({ provider: 'gemini', model: 'account-model', geminiModel: 'gemini-flash-latest' }));
    expect(stored.get('whispersInTheDark-image-connection')).toBe(images);
  });

  it('persists an explicit Automatic choice', async () => {
    const { setGeminiModel } = await import('../services/aiProvider');
    setGeminiModel('auto');
    const { loadAIConnectionSettings } = await import('../services/aiConnectionStorage');
    expect(loadAIConnectionSettings().geminiModel).toBe('auto');
  });
});
