import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/corrections/placeDetails', async () => {
  const actual = await vi.importActual('../services/corrections/placeDetails');
  return { ...actual, fetchCorrectedNodeIdentifier_Service: vi.fn() };
});

vi.mock('../services/corrections/edgeFixes', async () => {
  const actual = await vi.importActual('../services/corrections/edgeFixes');
  return { ...actual, fetchConnectorChains_Service: vi.fn().mockResolvedValue({ payload: null }) };
});

import { applyMapUpdates } from '../services/cartographer/applyUpdates';
import type {
  AdventureTheme,
  MapData,
  MapNode,
  AIMapUpdatePayload,
  GameStateFromAI,
} from '../types';
import { fetchCorrectedNodeIdentifier_Service } from '../services/corrections/placeDetails';

const theme: AdventureTheme = { name: 'TestTheme' } as AdventureTheme;

const existingFeature: MapNode = {
  id: 'node-gate-real1',
  placeName: 'Ancient Gate',
  position: { x: 0, y: 0 },
  data: {
    description: '',
    aliases: [],
    status: 'discovered',
    nodeType: 'feature',
    parentNodeId: 'Universe',
  },
};

const baseMap: MapData = {
  nodes: [existingFeature],
  edges: [],
};

const payload: AIMapUpdatePayload = {
  nodesToAdd: [
    {
      placeName: 'Side Tunnel',
      description: '',
      aliases: [],
      status: 'rumored',
      parentNodeId: 'Universe',
      nodeType: 'location',
    },
    {
      placeName: 'Hidden Door',
      description: '',
      aliases: [],
      status: 'rumored',
      parentNodeId: 'node-side-tunnel-fake',
      nodeType: 'feature',
    },
  ],
  edgesToAdd: [
    {
      sourcePlaceName: existingFeature.id,
      targetPlaceName: 'node-hidden-door-fake',
      type: 'path',
      status: 'rumored',
      description: '',
    },
  ],
};

describe('applyMapUpdates partial id handling', () => {
  it('resolves bogus suffix references without corrections', async () => {
    const result = await applyMapUpdates({
      payload,
      currentMapData: baseMap,
      currentTheme: theme,
      previousMapNodeId: null,
      inventoryItems: [],
      knownNPCs: [],
      aiData: { currentMapNodeId: null } as unknown as GameStateFromAI,
      minimalModelCalls: [],
      debugInfo: {} as unknown as import('../services/cartographer/types').MapUpdateDebugInfo,
    });

    const sideTunnel = result.updatedMapData.nodes.find(n => n.placeName === 'Side Tunnel');
    const hiddenDoor = result.updatedMapData.nodes.find(n => n.placeName === 'Hidden Door');
    expect(sideTunnel).toBeDefined();
    expect(hiddenDoor).toBeDefined();
    if (!sideTunnel || !hiddenDoor) throw new Error('Missing nodes');
    expect(hiddenDoor.data.parentNodeId).toBe(sideTunnel.id);

    const edge = result.updatedMapData.edges.find(e =>
      (e.sourceNodeId === existingFeature.id && e.targetNodeId === hiddenDoor.id) ||
      (e.targetNodeId === existingFeature.id && e.sourceNodeId === hiddenDoor.id)
    );
    expect(edge).toBeDefined();
    expect(vi.mocked(fetchCorrectedNodeIdentifier_Service)).not.toHaveBeenCalled();
  });
});
