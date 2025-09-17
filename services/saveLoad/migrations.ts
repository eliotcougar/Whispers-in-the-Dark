/**
 * @file migrations.ts
 * @description Functions for normalizing and converting saved game data between versions.
 */
import {
  FullGameState,
  SavedGameDataShape,
  MapData,
  GameStateStack,
  SavedGameStack,
} from '../../types';
import { CURRENT_SAVE_GAME_VERSION, PLAYER_HOLDER_ID, DEFAULT_ENABLED_THEME_PACKS } from '../../constants';
import { ensureCoreGameStateIntegrity } from '../../utils/gameStateIntegrity';
import {
  ensureCompleteMapLayoutConfig,
  ensureCompleteMapNodeDataDefaults,
  validateSavedGameState,
  postProcessValidatedData,
} from './validators';

const sanitizeKnownPlayerNames = (value?: Array<string> | string | null): Array<string> => {
  if (value === undefined || value === null) return [];
  const values = Array.isArray(value) ? value : [value];
  const sanitized: Array<string> = [];
  for (const entry of values) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (trimmed.length === 0) continue;
    if (!sanitized.includes(trimmed)) sanitized.push(trimmed);
  }
  return sanitized;
};

export function normalizeLoadedSaveData(
  parsedObj: Record<string, unknown>,
  sourceLabel: string,
): SavedGameDataShape | null {
  if (parsedObj.saveGameVersion !== CURRENT_SAVE_GAME_VERSION) {
    console.warn(
      `Save version '${String(parsedObj.saveGameVersion)}' from ${sourceLabel} does not match current version '${CURRENT_SAVE_GAME_VERSION}'. Attempting to load without migration support.`,
    );
  }

  const candidate = parsedObj as SavedGameDataShape;
  ensureCompleteMapLayoutConfig(candidate);
  ensureCompleteMapNodeDataDefaults(candidate.mapData);

  if (validateSavedGameState(candidate)) {
    return postProcessValidatedData(candidate);
  }

  return null;
}

export const prepareGameStateForSaving = (gameState: FullGameState): SavedGameDataShape => {
  const {
    dialogueState,
    objectiveAnimationType,
    lastDebugPacket,
    lastTurnChanges,
    debugLore,
    debugGoodFacts,
    debugBadFacts,
    isVictory,
    ...restOfGameState
  } = gameState;

  void dialogueState;
  void objectiveAnimationType;
  void lastDebugPacket;
  void lastTurnChanges;
  void debugLore;
  void debugGoodFacts;
  void debugBadFacts;
  void isVictory;

  const mapDataForSave: MapData = {
      nodes: gameState.mapData.nodes.map(node => ({
      ...node,
      data: {
        description: node.data.description || 'Description missing in save prep',
        aliases: node.data.aliases ?? [],
        status: node.data.status,
        isFeature: node.data.isFeature,
        visited: node.data.visited,
        parentNodeId: node.data.parentNodeId,
        nodeType: node.data.nodeType,
        ...Object.fromEntries(Object.entries(node.data).filter(([key]) => !['description', 'aliases'].includes(key)))
      }
    })),
      edges: gameState.mapData.edges,
  };

  const savedData: SavedGameDataShape = {
    ...restOfGameState,
    saveGameVersion: CURRENT_SAVE_GAME_VERSION,
    currentTheme: gameState.currentTheme,
    inventory: gameState.inventory.map(item => ({
      ...item,
      tags: item.tags ?? [],
      stashed: item.stashed ?? false,
      holderId: item.holderId || PLAYER_HOLDER_ID,
    })),
      allNPCs: gameState.allNPCs.map(npc => ({
        ...npc,
        aliases: npc.aliases ?? [],
        presenceStatus: npc.presenceStatus,
        attitudeTowardPlayer: npc.attitudeTowardPlayer,
        knownPlayerNames: sanitizeKnownPlayerNames(npc.knownPlayerNames),
        lastKnownLocation: npc.lastKnownLocation,
        preciseLocation: npc.preciseLocation,
        dialogueSummaries: npc.dialogueSummaries ?? [],
      })),
    mapData: mapDataForSave,
      currentMapNodeId: gameState.currentMapNodeId,
      destinationNodeId: gameState.destinationNodeId,
    mapLayoutConfig: gameState.mapLayoutConfig,
    mapViewBox: gameState.mapViewBox,
    score: gameState.score,
      localTime: gameState.localTime,
      localEnvironment: gameState.localEnvironment,
      localPlace: gameState.localPlace,
    globalTurnNumber: gameState.globalTurnNumber,
    themeFacts: gameState.themeFacts,
    worldFacts: gameState.worldFacts,
    heroSheet: gameState.heroSheet,
    heroBackstory: gameState.heroBackstory,
  };
  return savedData;
};

export const expandSavedDataToFullState = (savedData: SavedGameDataShape): FullGameState => {
  const mapDataFromLoad: MapData = {
    nodes: savedData.mapData.nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        description: node.data.description || 'Description missing on load',
        aliases: node.data.aliases ?? []
      }
    })),
    edges: savedData.mapData.edges,
  };

  const baseState: FullGameState = {
    ...savedData,
    currentTheme: savedData.currentTheme,
    enabledThemePacks: [...DEFAULT_ENABLED_THEME_PACKS],
    thinkingEffort: 'Medium',
    allNPCs: savedData.allNPCs.map(npc => ({
      ...npc,
      attitudeTowardPlayer: npc.attitudeTowardPlayer,
      knownPlayerNames: sanitizeKnownPlayerNames(npc.knownPlayerNames),
      dialogueSummaries: npc.dialogueSummaries ?? [],
    })),
    mapData: mapDataFromLoad,
    currentMapNodeId: savedData.currentMapNodeId,
    destinationNodeId: savedData.destinationNodeId,
    mapLayoutConfig: savedData.mapLayoutConfig,
    mapViewBox: savedData.mapViewBox,
    globalTurnNumber: savedData.globalTurnNumber,
    themeFacts: savedData.themeFacts,
    worldFacts: savedData.worldFacts,
    heroSheet: savedData.heroSheet,
    heroBackstory: savedData.heroBackstory,
    debugLore: false,
    debugGoodFacts: [],
    debugBadFacts: [],
    dialogueState: null,
    isVictory: false,
    objectiveAnimationType: null,
    lastDebugPacket: null,
    lastTurnChanges: null,
  };
  return ensureCoreGameStateIntegrity(baseState, 'expandSavedDataToFullState');
};

export const prepareGameStateStackForSaving = (
  stack: GameStateStack,
): SavedGameStack => ({
  current: prepareGameStateForSaving(stack[0]),
  previous: stack[1] ? prepareGameStateForSaving(stack[1]) : null,
});

export const prepareGameStateForSavingWithoutImages = (
  gameState: FullGameState,
): SavedGameDataShape => {
  const data = prepareGameStateForSaving(gameState);
  data.inventory = data.inventory.map(item => ({
    ...item,
    chapters: item.chapters?.map(ch => ({
      ...ch,
      imageData: undefined,
    })),
  }));
  data.playerJournal = data.playerJournal.map(ch => ({
    ...ch,
    imageData: undefined,
  }));
  return data;
};

export const prepareGameStateStackForSavingWithoutImages = (
  stack: GameStateStack,
): SavedGameStack => ({
  current: prepareGameStateForSavingWithoutImages(stack[0]),
  previous: stack[1] ? prepareGameStateForSavingWithoutImages(stack[1]) : null,
});

export const expandSavedStackToFullStates = (
  savedStack: SavedGameStack,
): GameStateStack => [
  expandSavedDataToFullState(savedStack.current),
  savedStack.previous ? expandSavedDataToFullState(savedStack.previous) : undefined,
];

export function normalizeLoadedSaveDataStack(
  parsedObj: Record<string, unknown>,
  sourceLabel: string,
): SavedGameStack | null {
  const currentRaw = (parsedObj as { current?: unknown }).current;
  if (!currentRaw || typeof currentRaw !== 'object') return null;
  const current = normalizeLoadedSaveData(currentRaw as Record<string, unknown>, sourceLabel);
  if (!current) return null;
  const prevRaw = (parsedObj as { previous?: unknown }).previous;
  let previous: SavedGameDataShape | null = null;
  if (prevRaw && typeof prevRaw === 'object') {
    const processedPrev = normalizeLoadedSaveData(prevRaw as Record<string, unknown>, sourceLabel);
    if (processedPrev) previous = processedPrev;
  }
  return { current, previous };
}




