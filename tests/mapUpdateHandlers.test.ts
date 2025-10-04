import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  FullGameState,
  GameStateFromAI,
  TurnChanges,
  MapNode,
  MapEdge,
  MapData,
} from '../types';
import { getInitialGameStates } from '../utils/initialStates';

const updateMapFromAIDataMock = vi.fn();
const suggestNodeFromLocationChangeMock = vi.fn().mockResolvedValue(null);
const assignSpecificNamesMock = vi.fn().mockResolvedValue([]);
const fetchFullPlaceDetailsMock = vi.fn().mockResolvedValue(null);

vi.mock('../services/cartographer', () => ({
  __esModule: true,
  updateMapFromAIData_Service: updateMapFromAIDataMock,
  suggestNodeFromLocationChange_Service: suggestNodeFromLocationChangeMock,
}));

vi.mock('../services/corrections', () => ({
  __esModule: true,
  fetchFullPlaceDetailsForNewMapNode_Service: fetchFullPlaceDetailsMock,
  assignSpecificNamesToDuplicateNodes_Service: assignSpecificNamesMock,
}));

vi.mock('../utils/entityUtils', async () => {
  const actual = await vi.importActual<typeof import('../utils/entityUtils')>('../utils/entityUtils');
  return {
    __esModule: true,
    ...actual,
    buildNodeId: (placeName: string) => `node-${placeName.toLowerCase().replace(/\s+/g, '-')}-abcd`,
  };
});

vi.mock('../utils/mapNodeMatcher', () => ({
  __esModule: true,
  selectBestMatchingMapNode: vi.fn().mockReturnValue(null),
  attemptMatchAndSetNode: vi.fn().mockReturnValue({ matched: false, nodeId: null }),
}));

const { handleMapUpdates } = await import('../utils/mapUpdateHandlers');

type MutableGameState = FullGameState & { mapData: MapData };

const makeNode = (id: string, placeName: string, visited = true): MapNode => ({
  id,
  placeName,
  position: { x: 0, y: 0 },
  data: {
    description: `${placeName} description`,
    status: 'discovered',
    nodeType: 'location',
    parentNodeId: 'universe',
    visited,
    aliases: [],
  },
});

const makeEdge = (id: string, source: string, target: string, status: MapEdge['data']['status']): MapEdge => ({
  id,
  sourceNodeId: source,
  targetNodeId: target,
  data: { status },
});

const createTurnChanges = (): TurnChanges => ({
  itemChanges: [],
  npcChanges: [],
  objectiveAchieved: false,
  mainQuestAchieved: false,
  objectiveTextChanged: false,
  mainQuestTextChanged: false,
  localTimeChanged: false,
  localEnvironmentChanged: false,
  localPlaceChanged: false,
  currentMapNodeIdChanged: false,
  scoreChangedBy: 0,
  mapDataChanged: false,
});

const createAiPayload = (override: Partial<GameStateFromAI> = {}): GameStateFromAI => ({
  sceneDescription: 'Scene',
  options: [],
  itemChange: [],
  ...override,
});

beforeEach(() => {
  vi.clearAllMocks();
  suggestNodeFromLocationChangeMock.mockResolvedValue(null);
  assignSpecificNamesMock.mockResolvedValue([]);
  fetchFullPlaceDetailsMock.mockResolvedValue(null);
});

describe('handleMapUpdates', () => {
  it('renames nodes and updates references and aliases', async () => {
    const baseState = getInitialGameStates() as MutableGameState;
    const originalNode = makeNode('node-old', 'Old Name');
    baseState.mapData = {
      nodes: [originalNode],
      edges: [],
    };
    baseState.currentMapNodeId = 'node-old';
    baseState.destinationNodeId = 'node-old';
    baseState.inventory = [
      {
        id: 'item-1',
        name: 'Keepsake',
        type: 'key',
        description: 'A keepsake',
        holderId: 'node-old',
      },
    ];
    baseState.loreFacts = [
      { id: 1, text: 'Fact', entities: ['node-old'], tier: 1, createdTurn: 0 },
    ];

    const draftState = structuredCloneValue(baseState);
    const baseSnapshot = structuredCloneValue(baseState);

    assignSpecificNamesMock.mockResolvedValue([
      { nodeId: 'node-old', newName: 'Bright Plaza' },
    ]);
    updateMapFromAIDataMock.mockResolvedValue({
      updatedMapData: draftState.mapData,
      newlyAddedNodes: [],
      newlyAddedEdges: [],
      debugInfo: null,
    });

    const turnChanges = createTurnChanges();

    await handleMapUpdates(
      createAiPayload({ mapUpdated: true }),
      draftState,
      baseSnapshot,
      null,
      vi.fn(),
      turnChanges,
    );

    const renamedNode = draftState.mapData.nodes[0];
    expect(renamedNode.placeName).toBe('Bright Plaza');
    expect(renamedNode.id).toBe('node-bright-plaza-abcd');
    expect(Array.isArray(renamedNode.data.aliases)).toBe(true);
    expect(draftState.inventory[0].holderId).toBe(renamedNode.id);
    expect(draftState.loreFacts[0].entities).toContain(renamedNode.id);
    expect(draftState.currentMapNodeId).toBeDefined();
    expect(turnChanges.mapDataChanged).toBe(true);
  });

  it('removes redundant rumored edges once a confirmed path exists', async () => {
    const baseState = getInitialGameStates() as MutableGameState;
    const nodeA = makeNode('node-a', 'A');
    const nodeB = makeNode('node-b', 'B');
    const nodeC = makeNode('node-c', 'C');
    baseState.mapData = {
      nodes: [nodeA, nodeB, nodeC],
      edges: [
        makeEdge('edge-ab', 'node-a', 'node-b', 'open'),
        makeEdge('edge-bc', 'node-b', 'node-c', 'open'),
        makeEdge('edge-ac', 'node-a', 'node-c', 'rumored'),
      ],
    };
    baseState.currentMapNodeId = 'node-a';
    baseState.destinationNodeId = null;

    const draftState = structuredCloneValue(baseState);
    const baseSnapshot = structuredCloneValue(baseState);

    const updatedMapData = structuredCloneValue(baseState.mapData);
    updateMapFromAIDataMock.mockResolvedValue({
      updatedMapData,
      newlyAddedNodes: [],
      newlyAddedEdges: [],
      debugInfo: null,
    });

    const turnChanges = createTurnChanges();

    await handleMapUpdates(
      createAiPayload({ mapUpdated: true }),
      draftState,
      baseSnapshot,
      null,
      vi.fn(),
      turnChanges,
    );

    const edgeIds = draftState.mapData.edges.map(edge => edge.id);
    expect(edgeIds).not.toContain('edge-ac');
    expect(edgeIds).toEqual(expect.arrayContaining(['edge-ab', 'edge-bc']));
    expect(turnChanges.mapDataChanged).toBe(true);
  });
});

function structuredCloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
