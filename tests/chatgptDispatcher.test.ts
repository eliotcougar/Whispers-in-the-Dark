import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GEMINI_MODEL_NAME, GEMINI_LITE_MODEL_NAME, GEMINI_PRO_MODEL_NAME, MINIMAL_MODEL_NAME, MAX_RETRIES } from '../constants';

const mocks = vi.hoisted(() => ({
  provider: 'chatgpt',
  geminiModel: 'auto',
  generate: vi.fn(),
  gemini: vi.fn(),
}));
vi.mock('../services/aiProvider', () => ({
  getAIConnection: () => ({ provider: mocks.provider, model: 'account-model', geminiModel: mocks.geminiModel }),
  generateChatGPTText: mocks.generate,
}));
vi.mock('../services/geminiClient', () => ({
  geminiClient: { models: { generateContent: mocks.gemini } },
  isApiConfigured: () => true,
  isGeminiConfigured: () => true,
}));
vi.mock('../utils/modelUsageTracker', () => ({ recordModelCall: vi.fn(), getDelayUntilUnderLimit: () => 0 }));
import { dispatchAIRequest } from '../services/modelDispatcher';
import { safeParseJson } from '../utils/jsonUtils';

beforeEach(() => { mocks.provider = 'chatgpt'; mocks.geminiModel = 'auto'; vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); });
describe('provider dispatch', () => {
  it('adapts ChatGPT JSON to the existing game parsers and never calls Gemini', async () => {
    mocks.generate.mockResolvedValue({ text: '{"scene":"A quiet room"}', model: 'account-model', inputTokens: 20, outputTokens: 10 });
    const result = await dispatchAIRequest({ modelNames: ['gemini-model'], prompt: 'Look around', systemInstruction: 'Tell the story', temperature: 0.7, thinkingBudget: 1000, maxOutputTokens: 5000, jsonSchema: { type: 'object', properties: { scene: { type: 'string' } } } });
    expect(safeParseJson(result.response.text ?? '')).toEqual({ scene: 'A quiet room' });
    expect(result.response.candidates?.[0].content?.parts?.[0].text).toBe(result.response.text);
    const request = mocks.generate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(request).toMatchObject({ model: 'account-model', prompt: 'Look around' });
    expect(request.instructions).toContain('"scene"');
    expect(request).not.toHaveProperty('temperature');
    expect(request).not.toHaveProperty('maxOutputTokens');
    expect(mocks.gemini).not.toHaveBeenCalled();
  });
  it('does not spend Gemini quota after a ChatGPT limit error', async () => {
    mocks.generate.mockRejectedValue(new Error('ChatGPT usage limit reached'));
    await expect(dispatchAIRequest({ modelNames: ['gemini-model'], prompt: 'Continue' })).rejects.toThrow('usage limit');
    expect(mocks.gemini).not.toHaveBeenCalled();
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it('retains the Gemini request path when Gemini is selected', async () => {
    mocks.provider = 'gemini';
    mocks.gemini.mockResolvedValue({ text: 'Gemini response' });
    expect((await dispatchAIRequest({ modelNames: ['gemini-model'], prompt: 'Continue' })).response.text).toBe('Gemini response');
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it.each([
    ['Storyteller', GEMINI_MODEL_NAME],
    ['Inventory', GEMINI_MODEL_NAME],
    ['LoremasterDistill', GEMINI_PRO_MODEL_NAME],
    ['ItemDirectiveCorrection', MINIMAL_MODEL_NAME],
    ['ImagePromptSanitizer', MINIMAL_MODEL_NAME],
  ])('uses selected Flash-Lite directly for %s', async (label, taskModel) => {
    mocks.provider = 'gemini'; mocks.geminiModel = GEMINI_LITE_MODEL_NAME;
    mocks.gemini.mockResolvedValue({ text: '{"scene":"A quiet room"}' });
    const schema = { type: 'object', properties: { scene: { type: 'string' } } };
    const result = await dispatchAIRequest({ modelNames: [[taskModel, []]], prompt: 'Continue.', systemInstruction: 'Follow the game rules.', responseMimeType: 'application/json', jsonSchema: schema, label });
    expect(mocks.gemini).toHaveBeenCalledTimes(1);
    const request = mocks.gemini.mock.calls[0]?.[0] as { model: string; contents: string; config: Record<string, unknown> };
    expect(request.model).toBe(GEMINI_LITE_MODEL_NAME);
    expect(request.contents).toBe('Continue.');
    expect(request.config.systemInstruction).toBe('Follow the game rules.');
    expect(request.config.responseJsonSchema).toBe(schema);
    expect(result.modelUsed).toBe(GEMINI_LITE_MODEL_NAME);
  });

  it('keeps explicit Flash-Lite selection after an overload instead of trying Flash', async () => {
    vi.useFakeTimers();
    mocks.provider = 'gemini'; mocks.geminiModel = GEMINI_LITE_MODEL_NAME;
    mocks.gemini.mockRejectedValue(Object.assign(new Error('Selected model overloaded'), { status: 503 }));
    const assertion = expect(dispatchAIRequest({ modelNames: [GEMINI_MODEL_NAME, GEMINI_LITE_MODEL_NAME], prompt: 'Continue.' })).rejects.toThrow('Selected model overloaded');
    await vi.runAllTimersAsync();
    await assertion;
    expect(mocks.gemini).toHaveBeenCalledTimes(MAX_RETRIES);
    expect(mocks.gemini.mock.calls.map(call => (call[0] as { model: string }).model)).toEqual(Array<string>(MAX_RETRIES).fill(GEMINI_LITE_MODEL_NAME));
  });

  it.each([GEMINI_MODEL_NAME, 'gemini-pro-latest'])('uses the explicitly selected %s model for lightweight tasks too', async model => {
    mocks.provider = 'gemini'; mocks.geminiModel = model;
    mocks.gemini.mockResolvedValue({ text: 'Prepared text.' });
    const result = await dispatchAIRequest({ modelNames: [MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME], prompt: 'Rewrite this text.' });
    expect(result.modelUsed).toBe(model);
    expect(mocks.gemini.mock.calls[0]?.[0]).toMatchObject({ model });
  });

});
