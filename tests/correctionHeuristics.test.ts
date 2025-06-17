import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/modelDispatcher', () => ({
  dispatchAIRequest: vi.fn(),
}));

import { dispatchAIRequest } from '../services/modelDispatcher';
import { fetchCorrectedNodeType_Service } from '../services/corrections/placeDetails.ts';
import { fetchCorrectedEdgeType_Service } from '../services/corrections/edgeFixes.ts';

const mockedDispatch = vi.mocked(dispatchAIRequest);

describe('correction heuristics', () => {
  it('infers node and edge types without API calls', async () => {
    const nodeType = await fetchCorrectedNodeType_Service({
      placeName: 'Example',
      nodeType: 'castle',
    });
    expect(nodeType).toBe('exterior');

    const edgeType = await fetchCorrectedEdgeType_Service({
      description: 'secret tunnel',
    });
    expect(edgeType).toBe('secret_passage');

    expect(mockedDispatch).not.toHaveBeenCalled();
  });
});
