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
  fetchCorrectedItemChangeArray_Service: vi.fn(),
  fetchCorrectedAddDetailsPayload_Service: vi.fn(),
}));

import { dispatchAIRequest } from '../services/modelDispatcher';
import { fetchCorrectedItemChangeArray_Service } from '../services/corrections';
import { applyInventoryHints_Service } from '../services/inventory/api.ts';
import { FANTASY_AND_MYTH_THEMES } from '../themes';

const mockedDispatch = vi.mocked(dispatchAIRequest);
const mockedCorrection = vi.mocked(fetchCorrectedItemChangeArray_Service);

describe('applyInventoryHints_Service', () => {
  it('does not invoke correction when AI returns empty itemChanges', async () => {
    mockedDispatch.mockResolvedValue({
      response: { text: '{"itemChanges": []}' } as unknown as GenerateContentResponse,
      modelUsed: 'test',
      systemInstructionUsed: 'sys',
      jsonSchemaUsed: undefined,
      promptUsed: 'p',
    });

    const theme = FANTASY_AND_MYTH_THEMES[0];
    const res = await applyInventoryHints_Service(
      'nothing',
      undefined,
      undefined,
      [],
      '',
      '',
      '',
      null,
      '',
      '',
      undefined,
      undefined,
      theme,
      '',
    );

    expect(res).not.toBeNull();
    expect(res?.itemChanges).toHaveLength(0);
    expect(mockedCorrection).not.toHaveBeenCalled();
  });
});
