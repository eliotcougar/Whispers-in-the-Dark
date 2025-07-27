import { describe, it, expect } from 'vitest';
import { handleMapUpdates } from '../utils/mapUpdateHandlers.ts';
import { structuredCloneGameState } from '../utils/cloneUtils.ts';
import type { AdventureTheme, FullGameState, GameStateFromAI, MapData, TurnChanges, MapLayoutConfig } from '../types';

const theme: AdventureTheme = { name: 'Kaiju Defense Force' } as AdventureTheme;

const mapData: MapData = {
  nodes: [
    {
      id: 'node_rim_test',
      placeName: 'Neo-Atlantic Rim',
      position: { x: 0, y: 0 },
      data: { description: 'waters', aliases: ['Open Waters', "The Rim"], status: 'rumored', nodeType: 'region', parentNodeId: 'universe' }
    },
    {
      id: 'node_coast_test',
      placeName: 'Coast',
      position: { x: 0, y: 0 },
      data: { description: 'distant coast', aliases: ['Coast', "Outpost"], status: 'rumored', nodeType: 'location', parentNodeId: 'universe' }
    },
    {
      id: 'node_coastal_outpost_test',
      placeName: 'Coastal Outpost',
      position: { x: 0, y: 0 },
      data: { description: 'coastal outpost', aliases: ['Outer Base', "Outpost"], status: 'rumored', nodeType: 'exterior', parentNodeId: 'node_coast_test' }
    },
    {
      id: 'node_utility_entrance_test',
      placeName: 'Utility Entrance',
      position: { x: 0, y: 0 },
      data: { description: 'utility entrance', aliases: ['Utility Hatch', 'Metal Door'], status: 'rumored', nodeType: 'feature', parentNodeId: 'node_coastal_outpost_test' }
    },
    {
      id: 'node_main_entrance_test',
      placeName: 'Main Entrance',
      position: { x: 0, y: 0 },
      data: { description: 'utility entrance', aliases: ['Marked Door', 'Yellow Door'], status: 'rumored', nodeType: 'feature', parentNodeId: 'node_coastal_outpost_test' }
    }
    
  ],
  edges: [
    {
      id: 'edge_node_rim_test_to_node_utility_entrance_test_test',
      sourceNodeId: 'node_utility_entrance_test',
      targetNodeId: 'node_rim_test',
      data: { description: 'to the rim', type: 'path', status: 'rumored' }
    }
  ]
};

const baseState: FullGameState = {
  saveGameVersion: '8',
  currentTheme: theme,
  currentScene: '',
  actionOptions: [],
  mainQuest: null,
  currentObjective: null,
  inventory: [],
  playerJournal: [],
  lastJournalWriteTurn: 0,
  lastJournalInspectTurn: 0,
  lastLoreDistillTurn: 0,
  gameLog: [],
  lastActionLog: null,
  themeFacts: [],
  worldFacts: null,
  heroSheet: null,
  heroBackstory: null,
  storyArc: null,
  allNPCs: [],
  mapData: structuredCloneGameState(mapData),
  currentMapNodeId: 'universe',
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
  score: 0,
  localTime: null,
  localEnvironment: null,
  localPlace: null,
  globalTurnNumber: 0,
  dialogueState: null,
  playerGender: 'neutral',
  enabledThemePacks: [],
  debugLore: false,
  debugGoodFacts: [],
  debugBadFacts: [],
  objectiveAnimationType: null,
  lastDebugPacket: null,
  lastTurnChanges: null
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

await handleMapUpdates(aiData, draftState, baseState, theme, null, () => undefined, turnChanges);

const updatedMaybe = draftState.mapData.nodes.find(n => n.id === 'node_rim_test');
if (!updatedMaybe) throw new Error('node_rim_test not found');
const updated = updatedMaybe;
describe('Update Visited Node by Name', () => {
    it('current mapNodeName should become discovered and visited', () => {
        expect(updated.data.status).toBe('discovered');
        expect(updated.data.visited).toBe(true);
    });
});

const aiData2 = {
  currentMapNodeId: 'node_utility_entrance_test'
} as Partial<GameStateFromAI> as GameStateFromAI;

await handleMapUpdates(aiData2, draftState, baseState, theme, null, () => undefined, turnChanges);

const updated2Maybe = draftState.mapData.nodes.find(n => n.id === 'node_utility_entrance_test');
const updated3Maybe = draftState.mapData.edges.find(n => n.id === 'edge_node_rim_test_to_node_utility_entrance_test_test');
const updated4Maybe = draftState.mapData.nodes.find(n => n.id === 'node_coastal_outpost_test');
const updated5Maybe = draftState.mapData.nodes.find(n => n.id === 'node_coast_test');
if (!updated2Maybe || !updated3Maybe || !updated4Maybe || !updated5Maybe) throw new Error('Updated nodes not found');
const updated2 = updated2Maybe;
const updated3 = updated3Maybe;
const updated4 = updated4Maybe;
const updated5 = updated5Maybe;
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

await handleMapUpdates(aiData3, draftState, baseState, theme, null, () => undefined, turnChanges);

const updated6Maybe = draftState.mapData.nodes.find(n => n.id === 'node_main_entrance_test');
if (!updated6Maybe) throw new Error('node_main_entrance_test not found');
const updated6 = updated6Maybe;
describe('Update Visited Node by Alias', () => {
    it('current mapNode Alias should become discovered and visited', () => {
        expect(updated6.data.status).toBe('discovered');
        expect(updated6.data.visited).toBe(true);
    });
});