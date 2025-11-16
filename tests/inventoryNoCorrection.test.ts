import { describe, it, expect, vi } from 'vitest';
import type { GenerateContentResponse } from '@google/genai';

vi.mock('../services/modelDispatcher', () => ({
  dispatchAIRequest: vi.fn(),
}));

vi.mock('../utils/retry', () => ({
  retryAiCall: vi.fn(async (fn: (attempt: number) => Promise<{ result: unknown }>) => {
    const { result } = await fn(0);
    return result;
  }),
}));

vi.mock('../utils/loadingProgress', () => ({
  addProgressSymbol: vi.fn(),
}));

vi.mock('../services/corrections', () => ({
  fetchCorrectedItemChangeArray: vi.fn(),
  fetchCorrectedAddDetailsPayload: vi.fn(),
}));

import { dispatchAIRequest } from '../services/modelDispatcher';
import { fetchCorrectedItemChangeArray } from '../services/corrections';
import { applyInventoryDirectives } from '../services/inventory/api.ts';
import { FANTASY_AND_MYTH_THEMES } from '../themes';

const mockedDispatch = vi.mocked(dispatchAIRequest);
const mockedCorrection = vi.mocked(fetchCorrectedItemChangeArray);

describe('applyInventoryDirectives', () => {
  it('does not invoke correction when AI returns empty itemChanges', async () => {
    mockedDispatch.mockResolvedValue({
      response: { text: '{"itemChanges": []}' } as unknown as GenerateContentResponse,
      modelUsed: 'test',
      systemInstructionUsed: 'sys',
      jsonSchemaUsed: undefined,
      promptUsed: 'p',
    });

    const theme = FANTASY_AND_MYTH_THEMES[0];
    const res = await applyInventoryDirectives([], '', [], null, [], undefined, undefined, theme, '', {});

    expect(res).not.toBeNull();
    expect(res?.itemChanges).toHaveLength(0);
    expect(mockedCorrection).not.toHaveBeenCalled();
  });
});
