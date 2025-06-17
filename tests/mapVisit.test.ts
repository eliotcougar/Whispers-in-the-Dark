import { describe, it, expect } from 'vitest';
import { handleMapUpdates } from '../utils/mapUpdateHandlers.ts';
import { structuredCloneGameState } from '../utils/cloneUtils.ts';
import type { AdventureTheme, FullGameState, GameStateFromAI, MapData, TurnChanges, MapLayoutConfig, ThemeHistoryState } from '../types';

const theme: AdventureTheme = { name: 'Kaiju Defense Force' } as AdventureTheme;

const mapData: MapData = {
  nodes: [
    {
      id: 'node_rim_test',
      themeName: theme.name,
      placeName: 'Neo-Atlantic Rim',
      position: { x: 0, y: 0 },
      data: { description: 'waters', aliases: ['Open Waters', "The Rim"], status: 'rumored', nodeType: 'region', parentNodeId: 'universe' }
    },
    {
      id: 'node_coast_test',
      themeName: theme.name,
      placeName: 'Coast',
      position: { x: 0, y: 0 },
      data: { description: 'distant coast', aliases: ['Coast', "Outpost"], status: 'rumored', nodeType: 'location', parentNodeId: 'universe' }
    },
    {
      id: 'node_coastal_outpost_test',
      themeName: theme.name,
      placeName: 'Coastal Outpost',
      position: { x: 0, y: 0 },
      data: { description: 'coastal outpost', aliases: ['Outer Base', "Outpost"], status: 'rumored', nodeType: 'exterior', parentNodeId: 'node_coast_test' }
    },
    {
      id: 'node_utility_entrance_test',
      themeName: theme.name,
      placeName: 'Utility Entrance',
      position: { x: 0, y: 0 },
      data: { description: 'utility entrance', aliases: ['Utility Hatch', 'Metal Door'], status: 'rumored', nodeType: 'feature', parentNodeId: 'node_coastal_outpost_test' }
    },
    {
      id: 'node_main_entrance_test',
      themeName: theme.name,
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
  saveGameVersion: '1',
  currentThemeName: theme.name,
  currentThemeObject: theme,
  currentScene: '',
  actionOptions: [],
  mainQuest: null,
  currentObjective: null,
  inventory: [],
  gameLog: [],
  lastActionLog: null,
  themeHistory: {} as ThemeHistoryState,
  pendingNewThemeNameAfterShift: null,
  allCharacters: [],
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
  turnsSinceLastShift: 0,
  globalTurnNumber: 0,
  dialogueState: null,
  isCustomGameMode: false,
  playerGender: 'neutral',
  enabledThemePacks: [],
  stabilityLevel: 0,
  chaosLevel: 0,
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
  characterChanges: [],
  objectiveAchieved: false,
  objectiveTextChanged: false,
  mainQuestTextChanged: false,
  localTimeChanged: false,
  localEnvironmentChanged: false,
  localPlaceChanged: false,
  scoreChangedBy: 0
};

await handleMapUpdates(aiData, draftState, baseState, theme, null, () => {}, turnChanges);

const updated = draftState.mapData.nodes.find(n => n.id === 'node_rim_test')!;
describe('Update Visited Node by Name', () => {
    it('current mapNodeName should become discovered and visited', () => {
        expect(updated.data.status).toBe('discovered');
        expect(updated.data.visited).toBe(true);
    });
});

const aiData2 = {
  currentMapNodeId: 'node_utility_entrance_test'
} as Partial<GameStateFromAI> as GameStateFromAI;

await handleMapUpdates(aiData2, draftState, baseState, theme, null, () => {}, turnChanges);

const updated2 = draftState.mapData.nodes.find(n => n.id === 'node_utility_entrance_test')!;
const updated3 = draftState.mapData.edges.find(n => n.id === 'edge_node_rim_test_to_node_utility_entrance_test_test')!;
const updated4 = draftState.mapData.nodes.find(n => n.id === 'node_coastal_outpost_test')!;
const updated5 = draftState.mapData.nodes.find(n => n.id === 'node_coast_test')!;
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

await handleMapUpdates(aiData3, draftState, baseState, theme, null, () => {}, turnChanges);

const updated6 = draftState.mapData.nodes.find(n => n.id === 'node_main_entrance_test')!;
describe('Update Visited Node by Alias', () => {
    it('current mapNode Alias should become discovered and visited', () => {
        expect(updated6.data.status).toBe('discovered');
        expect(updated6.data.visited).toBe(true);
    });
});