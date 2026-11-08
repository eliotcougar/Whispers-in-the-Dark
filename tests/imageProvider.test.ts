import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeParseJson } from '../utils/jsonUtils';

const mocks = vi.hoisted(() => ({ local: vi.fn(), text: vi.fn(), geminiImages: vi.fn() }));
vi.mock('../services/aiProvider', () => ({
  isLocalGame: () => true, localAIRequest: mocks.local, useAIConnection: () => ({ provider: 'chatgpt' }),
}));
vi.mock('../services/geminiClient', () => ({
  isGeminiConfigured: () => true,
  geminiClient: { models: { generateContentStream: mocks.geminiImages } },
}));
vi.mock('../services/modelDispatcher', () => ({ dispatchAIRequest: mocks.text }));

import { generateConfiguredImage, sanitizeVisualPrompt } from '../services/image/common';
import { generateChapterImage } from '../services/image/api';
import { getImageConnection, refreshOpenAIImageStatus, saveOpenAIImageKey, setImageProvider, setImageQuality, setImageModel } from '../services/imageProvider';
import { saveAIConnectionSettings, loadAIConnectionSettings, loadImageConnectionSettings } from '../services/aiConnectionStorage';
import { DEFAULT_OPENAI_IMAGE_MODEL, DEFAULT_GEMINI_IMAGE_MODEL } from '../shared/images';
import { DEFAULT_GEMINI_TEXT_MODEL } from '../shared/gemini';
import { PLACEHOLDER_THEME } from '../utils/initialStates';

const stored = new Map<string, string>();
afterEach(() => { vi.unstubAllGlobals(); });
beforeEach(async () => {
  vi.clearAllMocks(); stored.clear();
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { stored.set(key, value); } });
  mocks.local.mockImplementation((route: string) => route === 'image' ? { base64: '/9j/2Q==', mimeType: 'image/jpeg' } : { keyConfigured: true });
  await refreshOpenAIImageStatus();
  setImageProvider('gemini'); setImageModel(DEFAULT_GEMINI_IMAGE_MODEL);
  setImageProvider('openai'); setImageModel(DEFAULT_OPENAI_IMAGE_MODEL); setImageQuality('medium');
});

describe('image provider routing', () => {
  it('remembers a separate model for each provider and sends the selected OpenAI model', async () => {
    setImageModel('gpt-image-2.6-sunburst');
    setImageProvider('gemini'); setImageModel('gemini-3-pro-image');
    setImageProvider('openai');
    await generateConfiguredImage('Prepared scene.');
    expect(mocks.local).toHaveBeenCalledWith('image', expect.objectContaining({ model: 'gpt-image-2.6-sunburst' }));
    expect(loadImageConnectionSettings()).toMatchObject({ openaiModel: 'gpt-image-2.6-sunburst', geminiModel: 'gemini-3-pro-image' });
  });
  it('loads older or invalid model preferences with working defaults', () => {
    localStorage.setItem('whispersInTheDark-image-connection', JSON.stringify({ provider: 'openai', quality: 'high' }));
    expect(loadImageConnectionSettings()).toMatchObject({ provider: 'openai', quality: 'high', openaiModel: DEFAULT_OPENAI_IMAGE_MODEL, geminiModel: DEFAULT_GEMINI_IMAGE_MODEL });
    localStorage.setItem('whispersInTheDark-image-connection', JSON.stringify({ openaiModel: 'gpt-image-1', geminiModel: 'imagen-4.0-generate-001' }));
    expect(loadImageConnectionSettings()).toMatchObject({ openaiModel: DEFAULT_OPENAI_IMAGE_MODEL, geminiModel: DEFAULT_GEMINI_IMAGE_MODEL });
  });
  it('stops generation if the model changes during prompt preparation', async () => {
    const selection = getImageConnection();
    setImageModel('gpt-image-2');
    await expect(generateConfiguredImage('Prepared scene.', '4:3', selection)).rejects.toThrow('Image settings changed');
    expect(mocks.local).not.toHaveBeenCalledWith('image', expect.anything());
  });
  it('uses OpenAI images independently from text and never falls back to Gemini', async () => {
    expect(await generateConfiguredImage('Prepared safe scene.', '4:3')).toBe('/9j/2Q==');
    expect(mocks.local).toHaveBeenCalledWith('image', { model: DEFAULT_OPENAI_IMAGE_MODEL, prompt: 'Prepared safe scene.', aspectRatio: '4:3', quality: 'medium' });
    expect(mocks.geminiImages).not.toHaveBeenCalled();
    mocks.local.mockRejectedValue(new Error('OpenAI API credits unavailable'));
    await expect(generateConfiguredImage('Prepared safe scene.')).rejects.toThrow('API credits');
    expect(mocks.geminiImages).not.toHaveBeenCalled();
  });
  it('retains Gemini images as a separate explicit choice', async () => {
    setImageProvider('gemini');
    setImageModel('gemini-3.1-flash-image');
    mocks.geminiImages.mockImplementation(async function* () { yield await Promise.resolve({ candidates: [{ content: { parts: [{ inlineData: { data: 'gemini-image' } }] } }] }); });
    expect(await generateConfiguredImage('Prepared scene.')).toBe('gemini-image');
    expect(mocks.geminiImages).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-3.1-flash-image', config: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: '4:3' } } }));
    expect(mocks.local).not.toHaveBeenCalledWith('image', expect.anything());
  });
  it('blocks images when disabled even if both image credentials are available', async () => {
    setImageProvider('disabled');
    await expect(generateConfiguredImage('Scene')).rejects.toThrow('configure an image provider');
    expect(mocks.geminiImages).not.toHaveBeenCalled();
  });
  it('reports a selected Gemini model failure without trying another model', async () => {
    setImageProvider('gemini'); setImageModel('gemini-3-pro-image');
    mocks.geminiImages.mockRejectedValue(new Error('Selected model unavailable'));
    await expect(generateConfiguredImage('Prepared scene.')).rejects.toThrow('Selected model unavailable');
    expect(mocks.geminiImages).toHaveBeenCalledTimes(1);
    expect(mocks.local).not.toHaveBeenCalledWith('image', expect.anything());
  });
  it('keeps image preferences separate from text settings and never saves the API key in browser storage', async () => {
    const key = 'sk-unit-test-images-only';
    saveAIConnectionSettings({ provider: 'chatgpt', model: 'text-model', geminiModel: DEFAULT_GEMINI_TEXT_MODEL });
    await saveOpenAIImageKey(key);
    setImageQuality('low');
    expect(loadAIConnectionSettings()).toEqual({ provider: 'chatgpt', model: 'text-model', geminiModel: DEFAULT_GEMINI_TEXT_MODEL });
    expect(loadImageConnectionSettings()).toEqual({ provider: 'openai', quality: 'low', openaiModel: DEFAULT_OPENAI_IMAGE_MODEL, geminiModel: DEFAULT_GEMINI_IMAGE_MODEL });
    expect(safeParseJson(localStorage.getItem('whispersInTheDark-image-connection') ?? '')).toEqual({ provider: 'openai', quality: 'low', openaiModel: DEFAULT_OPENAI_IMAGE_MODEL, geminiModel: DEFAULT_GEMINI_IMAGE_MODEL });
    expect(Array.from(stored.values()).join('')).not.toContain(key);
    expect(JSON.stringify(getImageConnection())).not.toContain(key);
    saveAIConnectionSettings({ provider: 'gemini', model: '', geminiModel: DEFAULT_GEMINI_TEXT_MODEL });
    expect(loadImageConnectionSettings()).toEqual({ provider: 'openai', quality: 'low', openaiModel: DEFAULT_OPENAI_IMAGE_MODEL, geminiModel: DEFAULT_GEMINI_IMAGE_MODEL });
  });
  it('does not send raw item text to an image model when prompt preparation fails', async () => {
    mocks.text.mockRejectedValue(new Error('Text provider unavailable'));
    await expect(generateChapterImage({ id: 'item-map-1a2b', name: 'Map', description: 'A hand-painted map.', type: 'map', holderId: 'player', chapters: [{ heading: 'Map', description: 'Coastal roads.', contentLength: 100 }] }, PLACEHOLDER_THEME, 0)).rejects.toThrow('prepare the image prompt');
    expect(mocks.local).not.toHaveBeenCalledWith('image', expect.anything());
    expect(mocks.geminiImages).not.toHaveBeenCalled();
  });
  it('rejects empty visual rewrites instead of falling back to the raw prompt', async () => {
    mocks.text.mockResolvedValue({ response: { text: '' } });
    await expect(sanitizeVisualPrompt('Raw user input', 'A digital painting.')).rejects.toThrow('prepare the image prompt');
  });
});
