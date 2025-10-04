import { describe, it, expect } from 'vitest';
import { handleMapUpdates } from '../utils/mapUpdateHandlers.ts';
import { structuredCloneGameState } from '../utils/cloneUtils.ts';
import { getInitialGameStates } from '../utils/initialStates';
import type { FullGameState, GameStateFromAI, MapData, TurnChanges, MapLayoutConfig } from '../types';
import { ROOT_MAP_NODE_ID } from '../constants';

const mapData: MapData = {
  nodes: [
    {
      id: 'node-rim-test',
      placeName: 'Neo-Atlantic Rim',
      position: { x: 0, y: 0 },
      data: { description: 'waters', aliases: ['Open Waters', "The Rim"], status: 'rumored', nodeType: 'region', parentNodeId: ROOT_MAP_NODE_ID }
    },
    {
      id: 'node-coast-test',
      placeName: 'Coast',
      position: { x: 0, y: 0 },
      data: { description: 'distant coast', aliases: ['Coast', "Outpost"], status: 'rumored', nodeType: 'location', parentNodeId: ROOT_MAP_NODE_ID }
    },
    {
      id: 'node-coastal-outpost-test',
      placeName: 'Coastal Outpost',
      position: { x: 0, y: 0 },
      data: { description: 'coastal outpost', aliases: ['Outer Base', "Outpost"], status: 'rumored', nodeType: 'exterior', parentNodeId: 'node-coast-test' }
    },
    {
      id: 'node-utility-entrance-test',
      placeName: 'Utility Entrance',
      position: { x: 0, y: 0 },
      data: { description: 'utility entrance', aliases: ['Utility Hatch', 'Metal Door'], status: 'rumored', nodeType: 'feature', parentNodeId: 'node-coastal-outpost-test' }
    },
    {
      id: 'node-main-entrance-test',
      placeName: 'Main Entrance',
      position: { x: 0, y: 0 },
      data: { description: 'utility entrance', aliases: ['Marked Door', 'Yellow Door'], status: 'rumored', nodeType: 'feature', parentNodeId: 'node-coastal-outpost-test' }
    }
    
  ],
  edges: [
    {
      id: 'edge-node-rim-test-to-node-utility-entrance-test-test',
      sourceNodeId: 'node-utility-entrance-test',
      targetNodeId: 'node-rim-test',
      data: { description: 'to the rim', type: 'path', status: 'rumored' }
    }
  ]
};

const baseState: FullGameState = {
  ...getInitialGameStates(),
  saveGameVersion: '9',
  currentScene: '',
  actionOptions: [],
  currentObjective: null,
  mapData: structuredCloneGameState(mapData),
  currentMapNodeId: ROOT_MAP_NODE_ID,
  destinationNodeId: null,
  mapLayoutConfig: {
    IDEAL_EDGE_LENGTH: 50,
    NESTED_PADDING: 10,
    NESTED_ANGLE_PADDING: 0.15,
    LABEL_MARGIN_PX: 10,
    LABEL_LINE_HEIGHT_EM: 1.1,
    LABEL_OVERLAP_MARGIN_PX: 2,
    ITEM_ICON_SCALE: 0.3
  } as MapLayoutConfig,
  mapViewBox: '',
  enabledThemePacks: [],
  thinkingEffort: 'Medium',
};

const draftState: FullGameState = structuredCloneGameState(baseState);

const aiData = {
  currentMapNodeId: 'Neo-Atlantic Rim'
} as Partial<GameStateFromAI> as GameStateFromAI;

const turnChanges: TurnChanges = {
  itemChanges: [],
  npcChanges: [],
  objectiveAchieved: false,
  mainQuestAchieved: false,
  objectiveTextChanged: false,
  mainQuestTextChanged: false,
  localTimeChanged: false,
  localEnvironmentChanged: false,
  localPlaceChanged: false,
  scoreChangedBy: 0
};

    await handleMapUpdates(aiData, draftState, baseState, null, () => undefined, turnChanges);

const updated = draftState.mapData.nodes.find(n => n.id === 'node-rim-test');
if (!updated) throw new Error('node-rim-test not found');
describe('Update Visited Node by Name', () => {
    it('current mapNodeName should become discovered and visited', () => {
        expect(updated.data.status).toBe('discovered');
        expect(updated.data.visited).toBe(true);
    });
});

const aiData2 = {
  currentMapNodeId: 'node-utility-entrance-test'
} as Partial<GameStateFromAI> as GameStateFromAI;

    await handleMapUpdates(aiData2, draftState, baseState, null, () => undefined, turnChanges);

const updated2 = draftState.mapData.nodes.find(n => n.id === 'node-utility-entrance-test');
const updated3 = draftState.mapData.edges.find(n => n.id === 'edge-node-rim-test-to-node-utility-entrance-test-test');
const updated4 = draftState.mapData.nodes.find(n => n.id === 'node-coastal-outpost-test');
const updated5 = draftState.mapData.nodes.find(n => n.id === 'node-coast-test');
if (!updated2 || !updated3 || !updated4 || !updated5) throw new Error('Updated nodes not found');
describe('Update Visited Node by ID', () => {
    it('current mapNodeId should become discovered and visited', () => {
        expect(updated2.data.status).toBe('discovered');
        expect(updated2.data.visited).toBe(true);
    });
    it('edge should become open', () => {
        expect(updated3.data.status).toBe('open');
    });
    it('parent node should become discovered and visited', () => {
        expect(updated4.data.status).toBe('discovered');
        expect(updated4.data.visited).toBe(true);
    });
    it('grandparent node should become discovered and visited', () => {
        expect(updated5.data.status).toBe('discovered');
        expect(updated5.data.visited).toBe(true);
    });
});

const aiData3 = {
  currentMapNodeId: 'Yellow Door'
} as Partial<GameStateFromAI> as GameStateFromAI;

    await handleMapUpdates(aiData3, draftState, baseState, null, () => undefined, turnChanges);

const updated6 = draftState.mapData.nodes.find(n => n.id === 'node-main-entrance-test');
if (!updated6) throw new Error('node-main-entrance-test not found');
describe('Update Visited Node by Alias', () => {
    it('current mapNode Alias should become discovered and visited', () => {
        expect(updated6.data.status).toBe('discovered');
        expect(updated6.data.visited).toBe(true);
    });
});
