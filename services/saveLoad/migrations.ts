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
import { CURRENT_SAVE_GAME_VERSION, PLAYER_HOLDER_ID } from '../../constants';
import { findThemeByName } from '../../utils/themeUtils';
import {
  ensureCompleteMapLayoutConfig,
  ensureCompleteMapNodeDataDefaults,
  validateSavedGameState,
  postProcessValidatedData,
} from './validators';

export function normalizeLoadedSaveData(
  parsedObj: Record<string, unknown>,
  sourceLabel: string
): SavedGameDataShape | null {
  let dataToValidateAndExpand: SavedGameDataShape | null = null;
  if (
    parsedObj.saveGameVersion === CURRENT_SAVE_GAME_VERSION ||
    (typeof parsedObj.saveGameVersion === 'string' &&
      parsedObj.saveGameVersion.startsWith(CURRENT_SAVE_GAME_VERSION.split('.')[0]))
  ) {
    if (parsedObj.saveGameVersion !== CURRENT_SAVE_GAME_VERSION) {
      console.warn(
        `Potentially compatible future V${CURRENT_SAVE_GAME_VERSION.split('.')[0]}.x save version '${String(parsedObj.saveGameVersion)}' from ${sourceLabel}. Attempting to treat as current version (V3) for validation.`
      );
    }
    dataToValidateAndExpand = parsedObj as SavedGameDataShape;
    ensureCompleteMapLayoutConfig(dataToValidateAndExpand);
    ensureCompleteMapNodeDataDefaults(dataToValidateAndExpand.mapData);
  } else {
    console.warn(
      `Unknown save version '${String(parsedObj.saveGameVersion)}' from ${sourceLabel}. This might fail validation.`
    );
    dataToValidateAndExpand = parsedObj as SavedGameDataShape;
    ensureCompleteMapLayoutConfig(dataToValidateAndExpand);
    ensureCompleteMapNodeDataDefaults(dataToValidateAndExpand.mapData);
  }

  if (!dataToValidateAndExpand.currentThemeObject && dataToValidateAndExpand.currentThemeName) {
    dataToValidateAndExpand.currentThemeObject = findThemeByName(
      dataToValidateAndExpand.currentThemeName
    );
    if (!dataToValidateAndExpand.currentThemeObject) {
      console.warn(
        `Failed to find theme "${dataToValidateAndExpand.currentThemeName}" during ${sourceLabel} load. Game state might be incomplete.`
      );
    }
  }

  const gtRaw = (parsedObj as { globalTurnNumber?: unknown }).globalTurnNumber;
  if (typeof gtRaw === 'string') {
    const parsed = parseInt(gtRaw, 10);
    dataToValidateAndExpand.globalTurnNumber = isNaN(parsed) ? 0 : parsed;
  } else if (gtRaw === undefined || gtRaw === null) {
    dataToValidateAndExpand.globalTurnNumber = 0;
  }
  dataToValidateAndExpand.destinationNodeId = dataToValidateAndExpand.destinationNodeId ?? null;

  if (validateSavedGameState(dataToValidateAndExpand)) {
    return postProcessValidatedData(dataToValidateAndExpand);
  }

  return null;
}

export const prepareGameStateForSaving = (gameState: FullGameState): SavedGameDataShape => {
  const {
    dialogueState,
    objectiveAnimationType,
    lastDebugPacket,
    lastTurnChanges,
    isAwaitingManualShiftThemeSelection,
    ...restOfGameState
  } = gameState;

  void dialogueState;
  void objectiveAnimationType;
  void lastDebugPacket;
  void lastTurnChanges;
  void isAwaitingManualShiftThemeSelection;

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
    currentThemeObject: gameState.currentThemeObject,
    inventory: gameState.inventory.map(item => ({ ...item, tags: item.tags ?? [], holderId: item.holderId || PLAYER_HOLDER_ID })),
      allCharacters: gameState.allCharacters.map(c => ({
        ...c,
        aliases: c.aliases ?? [],
        presenceStatus: c.presenceStatus,
        lastKnownLocation: c.lastKnownLocation,
        preciseLocation: c.preciseLocation,
        dialogueSummaries: c.dialogueSummaries ?? [],
      })),
    mapData: mapDataForSave,
      currentMapNodeId: gameState.currentMapNodeId,
      destinationNodeId: gameState.destinationNodeId,
    mapLayoutConfig: gameState.mapLayoutConfig,
    mapViewBox: gameState.mapViewBox,
    score: gameState.score,
    stabilityLevel: gameState.stabilityLevel,
    chaosLevel: gameState.chaosLevel,
      localTime: gameState.localTime,
      localEnvironment: gameState.localEnvironment,
      localPlace: gameState.localPlace,
      enabledThemePacks: gameState.enabledThemePacks,
    playerGender: gameState.playerGender,
    turnsSinceLastShift: gameState.turnsSinceLastShift,
    globalTurnNumber: gameState.globalTurnNumber,
    isCustomGameMode: gameState.isCustomGameMode,
    themeFacts: gameState.themeFacts,
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

  let themeObjectToUse = savedData.currentThemeObject;
  if (!themeObjectToUse && savedData.currentThemeName) {
    themeObjectToUse = findThemeByName(savedData.currentThemeName);
    if (!themeObjectToUse) {
      console.warn(`expandSavedDataToFullState: Theme "${savedData.currentThemeName}" not found in current definitions. Game may be unstable.`);
    }
  }

  return {
    ...savedData,
    currentThemeObject: themeObjectToUse,
    allCharacters: savedData.allCharacters.map(c => ({
      ...c,
      dialogueSummaries: c.dialogueSummaries ?? [],
    })),
    mapData: mapDataFromLoad,
    currentMapNodeId: savedData.currentMapNodeId,
    destinationNodeId: savedData.destinationNodeId,
    mapLayoutConfig: savedData.mapLayoutConfig,
    mapViewBox: savedData.mapViewBox,
    isCustomGameMode: savedData.isCustomGameMode,
    globalTurnNumber: savedData.globalTurnNumber,
    themeFacts: savedData.themeFacts,
    isAwaitingManualShiftThemeSelection: false,
    dialogueState: null,
    objectiveAnimationType: null,
    lastDebugPacket: null,
    lastTurnChanges: null,
  };
};

export const prepareGameStateStackForSaving = (
  stack: GameStateStack,
): SavedGameStack => ({
  current: prepareGameStateForSaving(stack[0]),
  previous: stack[1] ? prepareGameStateForSaving(stack[1]) : null,
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
  if (typeof parsedObj !== 'object' || parsedObj === null) return null;
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
