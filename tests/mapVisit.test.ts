import assert from 'assert';
import { handleMapUpdates } from '../utils/mapUpdateHandlers.ts';
import { structuredCloneGameState } from '../utils/cloneUtils.ts';
import type { AdventureTheme, FullGameState, GameStateFromAI, MapData, TurnChanges, MapLayoutConfig, ThemeHistoryState } from '../types';

const theme: AdventureTheme = { name: 'Kaiju Defense Force' } as AdventureTheme;

const mapData: MapData = {
  nodes: [
    {
      id: 'universe',
      themeName: theme.name,
      placeName: 'Universe',
      position: { x: 0, y: 0 },
      data: { description: 'root', status: 'discovered', nodeType: 'region' }
    },
    {
      id: 'node_rim',
      themeName: theme.name,
      placeName: 'Neo-Atlantic Rim',
      position: { x: 0, y: 0 },
      data: { description: 'coast', status: 'rumored', nodeType: 'location', parentNodeId: 'universe' }
    }
  ],
  edges: []
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

const updated = draftState.mapData.nodes.find(n => n.id === 'node_rim')!;
assert.strictEqual(updated.data.status, 'discovered');
assert.strictEqual(updated.data.visited, true);
console.log('mapVisit.test passed');
