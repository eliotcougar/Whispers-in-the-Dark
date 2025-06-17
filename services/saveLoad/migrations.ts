/**
 * @file migrations.ts
 * @description Functions for normalizing and converting saved game data between versions.
 */
import { FullGameState, SavedGameDataShape, MapData } from '../../types';
import { CURRENT_SAVE_GAME_VERSION, DEFAULT_STABILITY_LEVEL, DEFAULT_CHAOS_LEVEL, DEFAULT_ENABLED_THEME_PACKS, DEFAULT_PLAYER_GENDER, PLAYER_HOLDER_ID } from '../../constants';
import { findThemeByName } from '../../utils/themeUtils';
import { getDefaultMapLayoutConfig } from '../../hooks/useMapUpdates';
import { DEFAULT_VIEWBOX } from '../../constants';
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
    parsedObj &&
    (parsedObj.saveGameVersion === CURRENT_SAVE_GAME_VERSION ||
      (typeof parsedObj.saveGameVersion === 'string' &&
        parsedObj.saveGameVersion.startsWith(CURRENT_SAVE_GAME_VERSION.split('.')[0])))
  ) {
    if (parsedObj.saveGameVersion !== CURRENT_SAVE_GAME_VERSION) {
      console.warn(
        `Potentially compatible future V${CURRENT_SAVE_GAME_VERSION.split('.')[0]}.x save version '${String(parsedObj.saveGameVersion)}' from ${sourceLabel}. Attempting to treat as current version (V3) for validation.`
      );
    }
    dataToValidateAndExpand = parsedObj as SavedGameDataShape;
    ensureCompleteMapLayoutConfig(dataToValidateAndExpand);
    ensureCompleteMapNodeDataDefaults(dataToValidateAndExpand.mapData);
  } else if (parsedObj) {
    console.warn(
      `Unknown save version '${String(parsedObj.saveGameVersion)}' from ${sourceLabel}. This might fail validation.`
    );
    dataToValidateAndExpand = parsedObj as SavedGameDataShape;
    if (dataToValidateAndExpand) {
      ensureCompleteMapLayoutConfig(dataToValidateAndExpand);
      ensureCompleteMapNodeDataDefaults(dataToValidateAndExpand.mapData);
    }
  }

  if (
    dataToValidateAndExpand &&
    !dataToValidateAndExpand.currentThemeObject &&
    dataToValidateAndExpand.currentThemeName
  ) {
    dataToValidateAndExpand.currentThemeObject = findThemeByName(
      dataToValidateAndExpand.currentThemeName
    );
    if (!dataToValidateAndExpand.currentThemeObject) {
      console.warn(
        `Failed to find theme "${dataToValidateAndExpand.currentThemeName}" during ${sourceLabel} load. Game state might be incomplete.`
      );
    }
  }

  if (dataToValidateAndExpand) {
    const gtRaw = (parsedObj as { globalTurnNumber?: unknown }).globalTurnNumber;
    if (typeof gtRaw === 'string') {
      const parsed = parseInt(gtRaw, 10);
      dataToValidateAndExpand.globalTurnNumber = isNaN(parsed) ? 0 : parsed;
    } else if (gtRaw === undefined || gtRaw === null) {
      dataToValidateAndExpand.globalTurnNumber = 0;
    }
    dataToValidateAndExpand.destinationNodeId = dataToValidateAndExpand.destinationNodeId ?? null;
  }

  if (dataToValidateAndExpand && validateSavedGameState(dataToValidateAndExpand)) {
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
    nodes: (gameState.mapData?.nodes || []).map(node => ({
      ...node,
      data: {
        description: node.data.description || 'Description missing in save prep',
        aliases: node.data.aliases || [],
        status: node.data.status,
        isFeature: node.data.isFeature,
        visited: node.data.visited,
        parentNodeId: node.data.parentNodeId,
        nodeType: node.data.nodeType,
        ...Object.fromEntries(Object.entries(node.data).filter(([key]) => !['description', 'aliases'].includes(key)))
      }
    })),
    edges: gameState.mapData?.edges || [],
  };

  const savedData: SavedGameDataShape = {
    ...restOfGameState,
    saveGameVersion: CURRENT_SAVE_GAME_VERSION,
    currentThemeObject: gameState.currentThemeObject,
    inventory: gameState.inventory.map(item => ({ ...item, isJunk: item.isJunk ?? false, holderId: item.holderId || PLAYER_HOLDER_ID })),
    allCharacters: gameState.allCharacters.map(c => ({
      ...c,
      aliases: c.aliases || [],
      presenceStatus: c.presenceStatus || 'unknown',
      lastKnownLocation: c.lastKnownLocation,
      preciseLocation: c.preciseLocation,
      dialogueSummaries: c.dialogueSummaries || [],
    })),
    mapData: mapDataForSave,
    currentMapNodeId: gameState.currentMapNodeId || null,
    destinationNodeId: gameState.destinationNodeId || null,
    mapLayoutConfig: gameState.mapLayoutConfig || getDefaultMapLayoutConfig(),
    mapViewBox: gameState.mapViewBox ?? DEFAULT_VIEWBOX,
    score: gameState.score ?? 0,
    stabilityLevel: gameState.stabilityLevel ?? DEFAULT_STABILITY_LEVEL,
    chaosLevel: gameState.chaosLevel ?? DEFAULT_CHAOS_LEVEL,
    localTime: gameState.localTime ?? null,
    localEnvironment: gameState.localEnvironment ?? null,
    localPlace: gameState.localPlace ?? null,
    enabledThemePacks: gameState.enabledThemePacks ?? [...DEFAULT_ENABLED_THEME_PACKS],
    playerGender: gameState.playerGender ?? DEFAULT_PLAYER_GENDER,
    turnsSinceLastShift: gameState.turnsSinceLastShift ?? 0,
    globalTurnNumber: gameState.globalTurnNumber ?? 0,
    isCustomGameMode: gameState.isCustomGameMode ?? false,
  };
  return savedData;
};

export const expandSavedDataToFullState = (savedData: SavedGameDataShape): FullGameState => {
  const mapDataFromLoad: MapData = {
    nodes: (savedData.mapData?.nodes || []).map(node => ({
      ...node,
      data: {
        ...node.data,
        description: node.data.description || 'Description missing on load',
        aliases: node.data.aliases || []
      }
    })),
    edges: savedData.mapData?.edges || [],
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
      dialogueSummaries: c.dialogueSummaries || [],
    })),
    mapData: mapDataFromLoad,
    currentMapNodeId: savedData.currentMapNodeId || null,
    destinationNodeId: savedData.destinationNodeId || null,
    mapLayoutConfig: savedData.mapLayoutConfig,
    mapViewBox: savedData.mapViewBox || DEFAULT_VIEWBOX,
    isCustomGameMode: savedData.isCustomGameMode ?? false,
    globalTurnNumber: savedData.globalTurnNumber ?? 0,
    isAwaitingManualShiftThemeSelection: false,
    dialogueState: null,
    objectiveAnimationType: null,
    lastDebugPacket: null,
    lastTurnChanges: null,
  };
};
