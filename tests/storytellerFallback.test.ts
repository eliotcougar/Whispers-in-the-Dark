import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerateContentResponse } from '@google/genai';
import { GEMINI_MODEL_NAME, GEMINI_LITE_MODEL_NAME, MAX_RETRIES } from '../constants';

const mocks = vi.hoisted(() => ({ generate: vi.fn(), record: vi.fn() }));
vi.mock('../services/geminiClient', () => ({
  isApiConfigured: () => true,
  geminiClient: { models: { generateContent: mocks.generate } },
}));
vi.mock('../services/aiProvider', () => ({
  getAIConnection: () => ({ provider: 'gemini', geminiModel: 'auto' }),
  generateChatGPTText: vi.fn(),
}));
vi.mock('../utils/modelUsageTracker', () => ({
  recordModelCall: mocks.record,
  getDelayUntilUnderLimit: () => 0,
}));

import { executeAIMainTurn, STORYTELLER_JSON_SCHEMA } from '../services/storyteller/api';
import { InvalidApiKeyError } from '../utils/aiErrorUtils';

const reply = (text = '{"sceneDescription":"A quiet harbor."}') => {
  const response = new GenerateContentResponse();
  response.candidates = [{ content: { role: 'model', parts: [{ text }] } }];
  return response;
};
const apiError = (status: number) => Object.assign(new Error('Model request failed'), { status });

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('Gemini storyteller recovery', () => {
  it.each([503, 429])('tries Flash-Lite immediately after Flash returns %s', async status => {
    mocks.generate.mockRejectedValueOnce(apiError(status)).mockResolvedValueOnce(reply());
    const result = await executeAIMainTurn('Continue the adventure.');
    expect(result.response.text).toContain('A quiet harbor.');
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(mocks.generate.mock.calls.map(call => (call[0] as { model: string }).model)).toEqual([GEMINI_MODEL_NAME, GEMINI_LITE_MODEL_NAME]);
    const fallbackRequest = mocks.generate.mock.calls[1]?.[0] as { contents: string; config: { responseMimeType: string; responseJsonSchema: unknown } };
    expect(fallbackRequest.contents).toBe('Continue the adventure.');
    expect(fallbackRequest.config.responseMimeType).toBe('application/json');
    expect(fallbackRequest.config.responseJsonSchema).toBe(STORYTELLER_JSON_SCHEMA);
    expect(mocks.record.mock.calls.map(call => String(call[0]))).toEqual([GEMINI_MODEL_NAME, GEMINI_LITE_MODEL_NAME]);
  });

  it('moves to Flash-Lite if the Flash request does not return within two minutes', async () => {
    mocks.generate.mockImplementationOnce((request: { config: { abortSignal: AbortSignal } }) => new Promise((_resolve, reject) => {
      request.config.abortSignal.addEventListener('abort', () => { reject(new Error('Request aborted')); });
    })).mockResolvedValueOnce(reply());
    const pending = executeAIMainTurn('Continue.');
    await vi.advanceTimersByTimeAsync(120_000);
    expect((await pending).response.text).toContain('A quiet harbor.');
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(mocks.generate.mock.calls[1]?.[0]).toMatchObject({ model: GEMINI_LITE_MODEL_NAME });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses Flash without a fallback request when it succeeds', async () => {
    mocks.generate.mockResolvedValueOnce(reply());
    await executeAIMainTurn('Continue.');
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.generate.mock.calls[0]?.[0]).toMatchObject({ model: GEMINI_MODEL_NAME });
  });

  it('stops on an invalid API key instead of trying other models', async () => {
    mocks.generate.mockRejectedValueOnce(Object.assign(new Error('API key not valid'), { status: 400 }));
    await expect(executeAIMainTurn('Continue.')).rejects.toBeInstanceOf(InvalidApiKeyError);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });

  it('preserves the final API error without multiplying exhausted dispatcher retries', async () => {
    const error = apiError(503);
    mocks.generate.mockRejectedValue(error);
    const assertion = expect(executeAIMainTurn('Continue.')).rejects.toBe(error);
    await vi.runAllTimersAsync();
    await assertion;
    expect(mocks.generate).toHaveBeenCalledTimes(1 + MAX_RETRIES);
    expect(mocks.record).toHaveBeenCalledTimes(1 + MAX_RETRIES);
  });

  it('still retries malformed JSON separately from API failures', async () => {
    mocks.generate.mockResolvedValueOnce(reply('{"sceneDescription":')).mockResolvedValueOnce(reply());
    const pending = executeAIMainTurn('Continue.');
    await vi.runAllTimersAsync();
    expect((await pending).response.text).toContain('A quiet harbor.');
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });
});
