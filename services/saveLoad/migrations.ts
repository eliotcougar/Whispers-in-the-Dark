/**
 * @file migrations.ts
 * @description Functions for normalizing and converting saved game data between versions.
 */
import {
  FullGameState,
  SavedGameDataShape,
  MapData,
  MapNode,
  MapEdge,
  GameStateStack,
  SavedGameStack,
} from '../../types';
import { CURRENT_SAVE_GAME_VERSION, PLAYER_HOLDER_ID, DEFAULT_ENABLED_THEME_PACKS } from '../../constants';
import { ensureCoreGameStateIntegrity } from '../../utils/gameStateIntegrity';
import {
  ensureCompleteMapLayoutConfig,
  ensureCompleteMapNodeDataDefaults,
  ensureCompleteMapEdgeDataDefaults,
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

  const candidateObj = { ...parsedObj } as Record<string, unknown> & {
    theme?: unknown;
    currentTheme?: unknown;
    themeFacts?: unknown;
    loreFacts?: unknown;
  };
  if (candidateObj.theme === undefined && candidateObj.currentTheme !== undefined) {
    candidateObj.theme = candidateObj.currentTheme;
    delete candidateObj.currentTheme;
  }
  if (candidateObj.loreFacts === undefined && Array.isArray(candidateObj.themeFacts)) {
    candidateObj.loreFacts = candidateObj.themeFacts;
  }
  if ('themeFacts' in candidateObj) delete candidateObj.themeFacts;
  const candidate = candidateObj as SavedGameDataShape;
  ensureCompleteMapLayoutConfig(candidate);
  ensureCompleteMapNodeDataDefaults(candidate.mapData);
  ensureCompleteMapEdgeDataDefaults(candidate.mapData);

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

  const workingMapData: MapData = {
    nodes: gameState.mapData.nodes.map(node => ({ ...node })),
    edges: gameState.mapData.edges.map(edge => ({ ...edge })),
  };
  ensureCompleteMapNodeDataDefaults(workingMapData);
  ensureCompleteMapEdgeDataDefaults(workingMapData);

  const mapDataForSave: MapData = {
    nodes: workingMapData.nodes.map(node => {
      const { description, aliases, ...rest } = node;
      return {
        ...rest,
        description: description || 'Description missing in save prep',
        aliases: aliases ?? [],
      };
    }),
    edges: workingMapData.edges.map(edge => {
      const edgeCopy: MapEdge = {
        ...edge,
        description: edge.description ?? '',
      };
      if (edgeCopy.travelTime === undefined) {
        delete (edgeCopy as Record<string, unknown>).travelTime;
      }
      return edgeCopy;
    }),
  };

  const savedData: SavedGameDataShape = {
    ...restOfGameState,
    saveGameVersion: CURRENT_SAVE_GAME_VERSION,
    theme: gameState.theme,
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
        knowsPlayerAs: sanitizeKnownPlayerNames(npc.knowsPlayerAs),
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
    loreFacts: gameState.loreFacts,
    WorldSheet: gameState.WorldSheet,
    heroSheet: gameState.heroSheet,
    heroBackstory: gameState.heroBackstory,
  };
  return savedData;
};

export const expandSavedDataToFullState = (savedData: SavedGameDataShape): FullGameState => {
  const mapDataFromLoad: MapData = {
    nodes: savedData.mapData.nodes.map(node => {
      const legacyNode = node as MapNode & { data?: Partial<MapNode> | null };
      const mergedRecord: Record<string, unknown> = {
        ...(legacyNode as Record<string, unknown>),
      };
      if (legacyNode.data && typeof legacyNode.data === 'object') {
        Object.assign(mergedRecord, legacyNode.data as Record<string, unknown>);
      }
      delete mergedRecord.data;
      const rawDescription = typeof mergedRecord.description === "string" ? mergedRecord.description : "";
      const description = rawDescription.trim().length > 0 ? rawDescription : "Description missing on load";
      const aliasesSource = mergedRecord.aliases;
      const aliases =
        Array.isArray(aliasesSource)
          ? aliasesSource.filter((alias): alias is string => typeof alias === 'string')
          : [];
      const normalized = {
        ...mergedRecord,
        description,
        aliases,
      } as MapNode;
      return normalized;
    }),
    edges: savedData.mapData.edges.map(edge => {
      const legacyEdge = edge as MapEdge & { data?: Partial<MapEdge> | null };
      const mergedRecord: Record<string, unknown> = {
        ...(legacyEdge as Record<string, unknown>),
      };
      if (legacyEdge.data && typeof legacyEdge.data === 'object') {
        Object.assign(mergedRecord, legacyEdge.data as Record<string, unknown>);
      }
      delete mergedRecord.data;
      const description = typeof mergedRecord.description === "string" ? mergedRecord.description : "";
      const flattened = {
        ...mergedRecord,
        description,
      } as MapEdge;
      const edgeCopy: MapEdge = { ...flattened };
      if (typeof edgeCopy.travelTime !== "string") {
        Reflect.deleteProperty(edgeCopy, "travelTime");
      }
      return edgeCopy;
    }),
  };
  ensureCompleteMapNodeDataDefaults(mapDataFromLoad);
  ensureCompleteMapEdgeDataDefaults(mapDataFromLoad);

  const baseState: FullGameState = {
    ...savedData,
    theme: savedData.theme,
    enabledThemePacks: [...DEFAULT_ENABLED_THEME_PACKS],
    thinkingEffort: 'Medium',
    allNPCs: savedData.allNPCs.map(npc => {
      const npcWithLegacyNames = npc as typeof npc & {
        knownPlayerNames?: Array<string> | string | null;
      };
      const knowsPlayerAsSource = (npcWithLegacyNames as { knowsPlayerAs?: Array<string> | string | null }).knowsPlayerAs
        ?? npcWithLegacyNames.knownPlayerNames;
      return {
        ...npc,
        attitudeTowardPlayer: npc.attitudeTowardPlayer,
        knowsPlayerAs: sanitizeKnownPlayerNames(knowsPlayerAsSource),
        dialogueSummaries: npc.dialogueSummaries ?? [],
      };
    }),
    mapData: mapDataFromLoad,
    currentMapNodeId: savedData.currentMapNodeId,
    destinationNodeId: savedData.destinationNodeId,
    mapLayoutConfig: savedData.mapLayoutConfig,
    mapViewBox: savedData.mapViewBox,
    globalTurnNumber: savedData.globalTurnNumber,
    loreFacts: savedData.loreFacts,
    WorldSheet: savedData.WorldSheet,
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




