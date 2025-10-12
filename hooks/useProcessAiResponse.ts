import { useCallback, useRef } from 'react';
import * as React from 'react';
import {
  FullGameState,
  GameStateFromAI,
  GameStateStack,
  Item,
  ItemChange,
  LoadingReason,
  TurnChanges,
  StoryAct,
  MapNode,
  NPC,
} from '../types';
import { fetchCorrectedName } from '../services/corrections';
import { PLAYER_HOLDER_ID, MAX_LOG_MESSAGES, WRITTEN_ITEM_TYPES, REGULAR_ITEM_TYPES } from '../constants';
import {
  addLogMessageToList,
  buildItemChangeRecords,
  applyAllItemChanges,
  applyLoreFactChanges,
} from '../utils/gameLogicUtils';
import { formatLimitedMapContextForPrompt } from '../utils/promptFormatters/map';
import { useMapUpdateProcessor } from './useMapUpdateProcessor';
import { applyInventoryHints } from '../services/inventory';
import { applyLibrarianHints } from '../services/librarian';
import { refineLore } from '../services/loremaster';
import { generatePageText } from '../services/page';
import { rot13, toRunic, tornVisibleText } from '../utils/textTransforms';
import { structuredCloneGameState } from '../utils/cloneUtils';
import {
  findItemByIdentifier,
  findMapNodeByIdentifier,
  findNPCByIdentifier,
  stripBracketText,
} from '../utils/entityUtils';
import { filterDuplicateCreates } from '../utils/itemChangeUtils';

interface CorrectItemChangesParams {
  aiItemChanges: Array<ItemChange>;
  aiData: GameStateFromAI;
  baseState: FullGameState;
  playerActionText?: string;
  loadingReason: LoadingReason | null;
  setLoadingReason: (reason: LoadingReason | null) => void;
}

interface ItemIdentifier { id?: string; name?: string }

interface EntityLookupContext {
  nodesById: Map<string, MapNode>;
  nodesByToken: Map<string, MapNode>;
  npcsById: Map<string, NPC>;
  npcsByToken: Map<string, NPC>;
  inventoryById: Map<string, Item>;
  inventoryByToken: Map<string, Item>;
  playerInventory: Array<Item>;
  playerInventoryByToken: Map<string, Item>;
}

const normalizeNodeToken = (value: string | undefined | null): string | null => {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .replace(/[.,!?;:"(){}[\]'’]/g, '')
    .trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeNpcToken = (value: string | undefined | null): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const normalizeItemToken = (value: string | undefined | null): string | null => {
  if (!value) return null;
  const normalized = stripBracketText(value).trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const buildEntityLookupContext = (state: FullGameState): EntityLookupContext => {
  const nodesById = new Map<string, MapNode>();
  const nodesByToken = new Map<string, MapNode>();
  for (const node of state.mapData.nodes) {
    nodesById.set(node.id, node);
    const labels = [node.placeName, ...(node.aliases ?? [])];
    for (const label of labels) {
      const token = normalizeNodeToken(label);
      if (token && !nodesByToken.has(token)) {
        nodesByToken.set(token, node);
      }
    }
  }

  const npcsById = new Map<string, NPC>();
  const npcsByToken = new Map<string, NPC>();
  for (const npc of state.allNPCs) {
    npcsById.set(npc.id, npc);
    const labels = [npc.name, ...(npc.aliases ?? [])];
    for (const label of labels) {
      const token = normalizeNpcToken(label);
      if (token && !npcsByToken.has(token)) {
        npcsByToken.set(token, npc);
      }
    }
  }

  const inventoryById = new Map<string, Item>();
  const inventoryByToken = new Map<string, Item>();
  const playerInventory: Array<Item> = [];
  const playerInventoryByToken = new Map<string, Item>();

  for (const item of state.inventory) {
    inventoryById.set(item.id, item);
    const token = normalizeItemToken(item.name);
    if (token && !inventoryByToken.has(token)) {
      inventoryByToken.set(token, item);
    }
    if (item.holderId === PLAYER_HOLDER_ID) {
      playerInventory.push(item);
      if (token && !playerInventoryByToken.has(token)) {
        playerInventoryByToken.set(token, item);
      }
    }
  }

  return {
    nodesById,
    nodesByToken,
    npcsById,
    npcsByToken,
    inventoryById,
    inventoryByToken,
    playerInventory,
    playerInventoryByToken,
  };
};

const resolveNodeId = (
  identifier: string | undefined,
  ctx: EntityLookupContext,
  baseState: FullGameState,
): string | undefined => {
  if (!identifier) return undefined;
  const direct = ctx.nodesById.get(identifier);
  if (direct) return direct.id;

  const token = normalizeNodeToken(identifier);
  if (token) {
    const byToken = ctx.nodesByToken.get(token);
    if (byToken) return byToken.id;
  }

  const fallback = findMapNodeByIdentifier(
    identifier,
    baseState.mapData.nodes,
    baseState.mapData,
    baseState.currentMapNodeId,
  );
  return Array.isArray(fallback) ? fallback[0]?.id : fallback?.id;
};

const resolveNpcId = (
  identifier: string | undefined,
  ctx: EntityLookupContext,
  baseState: FullGameState,
): string | undefined => {
  if (!identifier) return undefined;
  const direct = ctx.npcsById.get(identifier);
  if (direct) return direct.id;

  const token = normalizeNpcToken(identifier);
  if (token) {
    const byToken = ctx.npcsByToken.get(token);
    if (byToken) return byToken.id;
  }

  const fallback = findNPCByIdentifier(identifier, baseState.allNPCs);
  return Array.isArray(fallback) ? fallback[0]?.id : fallback?.id;
};

const findInventoryItem = (
  ctx: EntityLookupContext,
  baseState: FullGameState,
  identifiers: ItemIdentifier,
  ignoreCase = false,
): Item | null => {
  if (identifiers.id) {
    const byId = ctx.inventoryById.get(identifiers.id);
    if (byId) return byId;
  }
  const token = normalizeItemToken(identifiers.name ?? null);
  if (token) {
    const byToken = ctx.inventoryByToken.get(token);
    if (byToken) return byToken;
  }
  const fallback = findItemByIdentifier(
    [identifiers.id, identifiers.name],
    baseState.inventory,
    false,
    ignoreCase,
  );
  if (!fallback) return null;
  return Array.isArray(fallback) ? fallback[0] ?? null : fallback;
};

const findPlayerInventoryItem = (
  ctx: EntityLookupContext,
  identifiers: ItemIdentifier,
): Item | undefined => {
  if (identifiers.id) {
    const byId = ctx.inventoryById.get(identifiers.id);
    if (byId && byId.holderId === PLAYER_HOLDER_ID) return byId;
  }
  const token = normalizeItemToken(identifiers.name ?? null);
  if (token) {
    const byToken = ctx.playerInventoryByToken.get(token);
    if (byToken) return byToken;
  }
  return ctx.playerInventory.find(item => {
    if (identifiers.id && item.id === identifiers.id) return true;
    const token = normalizeItemToken(item.name);
    const refToken = normalizeItemToken(identifiers.name ?? null);
    return token !== null && token === refToken;
  });
};

const correctItemChanges = async ({
  aiItemChanges,
  aiData,
  baseState,
  playerActionText,
  loadingReason,
  setLoadingReason,
}: CorrectItemChangesParams): Promise<Array<ItemChange>> => {
  const theme = baseState.theme;
  const entityLookup = buildEntityLookupContext(baseState);
  const result: Array<ItemChange> = [];

  const correctionGroups = new Map<string, { originalName: string; indices: Array<number> }>();
  const destroyEntries: Array<{ index: number; shouldConvert: boolean }> = [];

  const dropIndicators = [
    'drop',
    'dropped',
    'leave',
    'left',
    'put down',
    'set down',
    'place',
    'placed',
  ];
  const dropText = `${aiData.logMessage ?? ''} ${
    'sceneDescription' in aiData ? aiData.sceneDescription : ''
  } ${playerActionText ?? ''}`.toLowerCase();
  const shouldConvertDestroyToDrop = dropIndicators.some((word) => dropText.includes(word));

  const resolveHolder = (holderId: string | undefined): string | undefined => {
    if (!holderId) return undefined;
    if (holderId === PLAYER_HOLDER_ID) return PLAYER_HOLDER_ID;
    if (holderId.startsWith('node-')) {
      return resolveNodeId(holderId, entityLookup, baseState);
    }
    if (holderId.startsWith('npc-')) {
      return resolveNpcId(holderId, entityLookup, baseState);
    }
    return undefined;
  };

  aiItemChanges.forEach((change, index) => {
    let currentChange: ItemChange = { ...change };

    if (currentChange.action === 'create') {
      const item = { ...(currentChange.item as Item) };
      const existing = findInventoryItem(
        entityLookup,
        baseState,
        { id: item.id, name: item.name },
        true,
      );
      if (existing) {
        currentChange = {
          action: 'change',
          item: { ...item, id: existing.id },
        };
      } else {
        const corrected = resolveHolder(item.holderId);
        if (corrected) item.holderId = corrected;
        currentChange = { ...currentChange, item };
      }
    } else if (currentChange.action === 'move') {
      const payload = { ...(currentChange.item as { newHolderId: string }) };
      const corrected = resolveHolder(payload.newHolderId);
      if (corrected) payload.newHolderId = corrected;
      currentChange = { ...currentChange, item: payload };
    } else if (currentChange.action === 'change') {
      const itm = { ...(currentChange.item as { holderId?: string }) };
      if (itm.holderId) {
        const corrected = resolveHolder(itm.holderId);
        if (corrected) itm.holderId = corrected;
      }
      currentChange = { ...currentChange, item: itm };
    }

    if ('item' in currentChange && (currentChange.item as { type?: string }).type === 'immovable') {
      if (currentChange.action === 'create') {
        const itm = currentChange.item as Item;
        if (!itm.holderId.startsWith('node-')) {
          itm.holderId = baseState.currentMapNodeId ?? 'unknown';
        }
      } else if (currentChange.action === 'move') {
        const payload = currentChange.item as { newHolderId: string };
        if (!payload.newHolderId.startsWith('node-')) {
          payload.newHolderId = baseState.currentMapNodeId ?? 'unknown';
        }
      }
    }

    if (currentChange.action === 'destroy') {
      const itemRef = { ...(currentChange.item as ItemIdentifier) };
      const playerMatch = findPlayerInventoryItem(entityLookup, itemRef);

      if (!playerMatch) {
        const originalName = itemRef.name ?? '';
        const trimmedKey = originalName.trim();
        const groupKey = trimmedKey.length > 0 ? trimmedKey.toLowerCase() : '__empty__';
        const existingGroup = correctionGroups.get(groupKey);
        if (existingGroup) {
          existingGroup.indices.push(index);
        } else {
          correctionGroups.set(groupKey, { originalName, indices: [index] });
        }
      }

      destroyEntries.push({ index, shouldConvert: shouldConvertDestroyToDrop });
      currentChange = { ...currentChange, item: itemRef };
    }

    result.push(currentChange);
  });

  if (correctionGroups.size > 0) {
    const originalLoading = loadingReason;
    setLoadingReason('corrections');
    const sceneContext =
      'sceneDescription' in aiData ? aiData.sceneDescription : baseState.currentScene;
    const playerInventoryNames = entityLookup.playerInventory.map((item) => item.name);

    const groupEntries = Array.from(correctionGroups.values());
    const correctionResults = await Promise.all(
      groupEntries.map(group =>
        fetchCorrectedName(
          'item',
          group.originalName,
          aiData.logMessage,
          sceneContext,
          playerInventoryNames,
          theme,
        ),
      ),
    );
    setLoadingReason(originalLoading);

    groupEntries.forEach((group, idx) => {
      const correctedName = correctionResults[idx];
      if (!correctedName) return;
      for (const changeIndex of group.indices) {
        const change = result[changeIndex];
        if (change.action !== 'destroy') {
          continue;
        }
        change.item = { id: correctedName, name: correctedName };
      }
    });
  }

  for (const entry of destroyEntries) {
    if (!entry.shouldConvert) continue;
    const change = result[entry.index];
    if (change.action !== 'destroy') continue;
    const itemRef = change.item as ItemIdentifier;
    const playerMatch = findPlayerInventoryItem(entityLookup, itemRef);
    if (playerMatch) {
      result[entry.index] = {
        action: 'create',
        item: {
          ...playerMatch,
          holderId: baseState.currentMapNodeId ?? 'unknown',
        },
      };
    }
  }

  return result;
};

interface ApplyMapUpdatesParams {
  aiData: GameStateFromAI;
  draftState: FullGameState;
  baseState: FullGameState;
  turnChanges: TurnChanges;
  processMapUpdates: (
    aiData: GameStateFromAI,
    draftState: FullGameState,
    baseState: FullGameState,
    turnChanges: TurnChanges,
  ) => Promise<void>;
}

const applyMapUpdatesFromAi = async ({
  aiData,
  draftState,
  baseState,
  turnChanges,
  processMapUpdates,
}: ApplyMapUpdatesParams) => {
  // Only run Cartographer when storyteller indicates map updates or
  // when the location changed.
  const shouldRunMap =
    aiData.mapUpdated === true || draftState.localPlace !== baseState.localPlace;
  if (shouldRunMap) {
    await processMapUpdates(aiData, draftState, baseState, turnChanges);
  }
};

interface HandleInventoryHintsParams {
  aiData: GameStateFromAI;
  draftState: FullGameState;
  baseState: FullGameState;
  correctedItemChanges: Array<ItemChange>;
  playerActionText?: string;
  loadingReason: LoadingReason | null;
  setLoadingReason: (reason: LoadingReason | null) => void;
}

const handleInventoryHints = async ({
  aiData,
  draftState,
  baseState,
  correctedItemChanges,
  playerActionText,
  loadingReason,
  setLoadingReason,
}: HandleInventoryHintsParams): Promise<{
  combinedItemChanges: Array<ItemChange>;
  baseInventoryForPlayer: Array<Item>;
}> => {
  const baseInventoryForPlayer = baseState.inventory.filter(
    (item) => item.holderId === PLAYER_HOLDER_ID,
  );
  const filterItemsByType = (
    items: Array<Item>,
    allowed: ReadonlyArray<string>,
  ): Array<Item> => items.filter(it => allowed.includes(it.type));

  let combinedItemChanges = [...correctedItemChanges];

  const theme = draftState.theme;
  const original = loadingReason;
  setLoadingReason('inventory_updates');
  const limitedMapContextRegular = formatLimitedMapContextForPrompt(
    draftState.mapData,
    draftState.currentMapNodeId,
    filterItemsByType(baseState.inventory, REGULAR_ITEM_TYPES),
  );
  const limitedMapContextWritten = formatLimitedMapContextForPrompt(
    draftState.mapData,
    draftState.currentMapNodeId,
    filterItemsByType(baseState.inventory, WRITTEN_ITEM_TYPES),
  );
  const allNewItems =
    'newItems' in aiData && Array.isArray(aiData.newItems) ? aiData.newItems : [];
  const librarianNewItems = allNewItems.filter(it =>
    WRITTEN_ITEM_TYPES.includes(it.type as (typeof WRITTEN_ITEM_TYPES)[number]),
  );
  const inventoryNewItems = allNewItems.filter(
    it => !WRITTEN_ITEM_TYPES.includes(it.type as (typeof WRITTEN_ITEM_TYPES)[number]),
  );

  const playerItemsHint =
    'playerItemsHint' in aiData ? aiData.playerItemsHint?.trim() : '';
  const worldItemsHint =
    'worldItemsHint' in aiData ? aiData.worldItemsHint?.trim() : '';
  const npcItemsHint =
    'npcItemsHint' in aiData ? aiData.npcItemsHint?.trim() : '';
  let invResult: Awaited<ReturnType<typeof applyInventoryHints>> | null = null;
  if (playerItemsHint || worldItemsHint || npcItemsHint || inventoryNewItems.length > 0) {
    invResult = await applyInventoryHints(
      playerItemsHint,
      worldItemsHint,
      npcItemsHint,
      inventoryNewItems,
      playerActionText ?? '',
      baseState.inventory,
      baseState.currentMapNodeId ?? null,
      baseState.allNPCs,
      'sceneDescription' in aiData ? aiData.sceneDescription : baseState.currentScene,
      aiData.logMessage,
      theme,
      limitedMapContextRegular,
    );
  }
  setLoadingReason(original);

  let librarianHint =
    'librarianHint' in aiData ? aiData.librarianHint?.trim() : '';
  if (!librarianHint && librarianNewItems.length > 0) {
    const names = librarianNewItems.map(it => it.name).join(', ');
    librarianHint = `Found ${names}.`;
  }
  let libResult: Awaited<ReturnType<typeof applyLibrarianHints>> | null = null;
  if (librarianHint) {
    // Reflect librarian stage in FSM and loading indicator
    draftState.turnState = 'librarian_updates';
    setLoadingReason('librarian_updates');
    libResult = await applyLibrarianHints(
      librarianHint,
      librarianNewItems,
      playerActionText ?? '',
      baseState.inventory,
      baseState.currentMapNodeId ?? null,
      baseState.allNPCs,
      limitedMapContextWritten,
    );
    setLoadingReason(original);
  }

  if (invResult && libResult) {
    invResult.itemChanges = filterDuplicateCreates(
      invResult.itemChanges,
      libResult.itemChanges,
    );
  }

  if (invResult) {
    combinedItemChanges = combinedItemChanges.concat(invResult.itemChanges);
    if (draftState.lastDebugPacket) {
      draftState.lastDebugPacket.inventoryDebugInfo = invResult.debugInfo;
    }
  }

  if (libResult) {
    combinedItemChanges = combinedItemChanges.concat(libResult.itemChanges);
    if (draftState.lastDebugPacket) {
      draftState.lastDebugPacket.librarianDebugInfo = libResult.debugInfo;
    }
  }

  return { combinedItemChanges, baseInventoryForPlayer };
};

const updateDialogueState = (
  draftState: FullGameState,
  aiData: GameStateFromAI,
  isFromDialogueSummary: boolean,
) => {
  if ('dialogueSetup' in aiData && aiData.dialogueSetup) {
    draftState.actionOptions = [];
    draftState.dialogueState = {
      participants: aiData.dialogueSetup.participants,
      history: aiData.dialogueSetup.initialNpcResponses,
      options: aiData.dialogueSetup.initialPlayerOptions,
    };
    draftState.turnState = 'dialogue_turn';
  } else if (isFromDialogueSummary) {
    draftState.dialogueState = null;
  }
};

const createInitialTurnChanges = (scoreChangeFromAction: number): TurnChanges => ({
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
  scoreChangedBy: scoreChangeFromAction,
  mapDataChanged: false,
});

interface MissingResponseParams {
  draftState: FullGameState;
  turnChanges: TurnChanges;
  setError: (err: string | null) => void;
  isFromDialogueSummary: boolean;
}

const handleMissingAiResponse = ({
  draftState,
  turnChanges,
  setError,
  isFromDialogueSummary,
}: MissingResponseParams): void => {
  setError("The Dungeon Master's connection is unstable... (Invalid AI response after retries)");
  if (!isFromDialogueSummary && 'actionOptions' in draftState) {
    draftState.actionOptions = [
      'Try to wait for the connection to improve.',
      'Consult the ancient network spirits.',
      'Check your own connection.',
      'Sigh dramatically.',
    ];
  }
  draftState.lastActionLog =
    "The Dungeon Master seems to be having trouble communicating the outcome of your last action.";
  if (!draftState.localTime) draftState.localTime = 'Time Unknown';
  if (!draftState.localEnvironment) draftState.localEnvironment = 'Environment Undetermined';
  if (!draftState.localPlace) draftState.localPlace = 'Undetermined Location';
  draftState.lastTurnChanges = turnChanges;
  draftState.dialogueState = null;
};

const updateDebugPacketWithAiData = (draftState: FullGameState, aiData: GameStateFromAI) => {
  draftState.lastDebugPacket = {
    ...(draftState.lastDebugPacket ?? {}),
    prompt: draftState.lastDebugPacket?.prompt ?? 'Prompt not captured for this state transition',
    rawResponseText: draftState.lastDebugPacket?.rawResponseText ?? 'Raw text not captured',
    parsedResponse: aiData,
    timestamp: new Date().toISOString(),
    mapUpdateDebugInfo: null,
    inventoryDebugInfo: null,
    librarianDebugInfo: null,
    loremasterDebugInfo:
      draftState.lastDebugPacket?.loremasterDebugInfo ??
      { collect: null, extract: null, integrate: null, distill: null, journal: null },
  };
};

interface SceneUpdateParams {
  aiData: GameStateFromAI;
  draftState: FullGameState;
  turnChanges: TurnChanges;
  clearObjectiveAnimationTimer: () => void;
  objectiveAnimationClearTimerRef: { current: number | null };
  setGameStateStack: React.Dispatch<React.SetStateAction<GameStateStack>>;
}

const applySceneAndObjectiveUpdates = ({
  aiData,
  draftState,
  turnChanges,
  clearObjectiveAnimationTimer,
  objectiveAnimationClearTimerRef,
  setGameStateStack,
}: SceneUpdateParams) => {
  if (aiData.localTime !== undefined) {
    if (draftState.localTime !== aiData.localTime) turnChanges.localTimeChanged = true;
    draftState.localTime = aiData.localTime;
  }
  if (aiData.localEnvironment !== undefined) {
    if (draftState.localEnvironment !== aiData.localEnvironment) turnChanges.localEnvironmentChanged = true;
    draftState.localEnvironment = aiData.localEnvironment;
  }
  if (aiData.localPlace !== undefined) {
    if (draftState.localPlace !== aiData.localPlace) turnChanges.localPlaceChanged = true;
    draftState.localPlace = aiData.localPlace;
  }

  if (aiData.mainQuest !== undefined) {
    if (draftState.mainQuest !== aiData.mainQuest) turnChanges.mainQuestTextChanged = true;
    draftState.mainQuest = aiData.mainQuest;
  }
  const previousObjective = draftState.currentObjective;
  if (aiData.currentObjective !== undefined) {
    if (draftState.currentObjective !== aiData.currentObjective) turnChanges.objectiveTextChanged = true;
    draftState.currentObjective = aiData.currentObjective;
  }

  clearObjectiveAnimationTimer();
  let animationToSet: 'success' | 'neutral' | null = null;
  if (aiData.currentObjective !== undefined && aiData.currentObjective !== previousObjective) {
    animationToSet = aiData.objectiveAchieved ? 'success' : 'neutral';
  } else if (aiData.objectiveAchieved && previousObjective !== null) {
    animationToSet = 'success';
  }

  if (animationToSet) {
    draftState.objectiveAnimationType = animationToSet;
    objectiveAnimationClearTimerRef.current = window.setTimeout(() => {
      setGameStateStack(prev => [{ ...prev[0], objectiveAnimationType: null }, prev[1]]);
      objectiveAnimationClearTimerRef.current = null;
    }, 5000);
  } else {
    draftState.objectiveAnimationType = null;
  }

  turnChanges.objectiveAchieved = aiData.objectiveAchieved ?? false;
  turnChanges.mainQuestAchieved = aiData.mainQuestAchieved ?? false;
  if (aiData.objectiveAchieved) {
    draftState.score = draftState.score + 1;
    turnChanges.scoreChangedBy += 1;
  }
};

interface ConfigureOptionsParams {
  draftState: FullGameState;
  aiData: GameStateFromAI;
  isFromDialogueSummary: boolean;
}

const configureActionOptions = ({
  draftState,
  aiData,
  isFromDialogueSummary,
}: ConfigureOptionsParams) => {
  if (aiData.options.length > 0 && !aiData.dialogueSetup) {
    draftState.actionOptions = aiData.options;
  } else if (!isFromDialogueSummary && !aiData.dialogueSetup) {
    draftState.actionOptions = [
      'Look around.',
      'Ponder your situation.',
      'Check your inventory.',
      'Wait for something to happen.',
      'Consider your objective.',
      'Plan your next steps.',
    ];
  }
};

interface MapInventoryStageParams {
  aiData: GameStateFromAI;
  draftState: FullGameState;
  baseStateSnapshot: FullGameState;
  playerActionText?: string;
  loadingReasonRef: React.RefObject<LoadingReason | null>;
  setLoadingReason: (reason: LoadingReason | null) => void;
  turnChanges: TurnChanges;
  processMapUpdates: (
    aiData: GameStateFromAI,
    draftState: FullGameState,
    baseState: FullGameState,
    turnChanges: TurnChanges,
  ) => Promise<void>;
}

interface MapInventoryStageResult {
  combinedItemChanges: Array<ItemChange>;
  baseInventoryForPlayer: Array<Item>;
}

const processMapAndInventoryStages = async ({
  aiData,
  draftState,
  baseStateSnapshot,
  playerActionText,
  loadingReasonRef,
  setLoadingReason,
  turnChanges,
  processMapUpdates,
}: MapInventoryStageParams): Promise<MapInventoryStageResult> => {
  const correctedAndVerifiedItemChanges = await correctItemChanges({
    aiItemChanges: aiData.itemChange,
    aiData,
    baseState: baseStateSnapshot,
    playerActionText,
    loadingReason: loadingReasonRef.current,
    setLoadingReason,
  });

  const shouldRunMap =
    aiData.mapUpdated === true || draftState.localPlace !== baseStateSnapshot.localPlace;
  if (shouldRunMap) {
    draftState.turnState = 'map_updates';
    await applyMapUpdatesFromAi({
      aiData,
      draftState,
      baseState: baseStateSnapshot,
      turnChanges,
      processMapUpdates,
    });
  }

  const allNewItems =
    'newItems' in aiData && Array.isArray(aiData.newItems) ? aiData.newItems : [];
  const hasLibrarianNew = allNewItems.some(it => WRITTEN_ITEM_TYPES.includes(it.type as (typeof WRITTEN_ITEM_TYPES)[number]));
  const hasInventoryNew = allNewItems.some(it => !WRITTEN_ITEM_TYPES.includes(it.type as (typeof WRITTEN_ITEM_TYPES)[number]));
  const hasInventoryHints = !!aiData.playerItemsHint || !!aiData.worldItemsHint || !!aiData.npcItemsHint || hasInventoryNew;
  const hasLibrarianHints = !!aiData.librarianHint || hasLibrarianNew;

  let combinedItemChanges: Array<ItemChange> = correctedAndVerifiedItemChanges;
  let baseInventoryForPlayer: Array<Item> = baseStateSnapshot.inventory.filter(
    it => it.holderId === PLAYER_HOLDER_ID,
  );

  if (hasInventoryHints || hasLibrarianHints) {
    if (hasInventoryHints) draftState.turnState = 'inventory_updates';
    const result = await handleInventoryHints({
      aiData,
      draftState,
      baseState: baseStateSnapshot,
      correctedItemChanges: correctedAndVerifiedItemChanges,
      playerActionText,
      loadingReason: loadingReasonRef.current,
      setLoadingReason,
    });
    combinedItemChanges = result.combinedItemChanges;
    baseInventoryForPlayer = result.baseInventoryForPlayer;
  }

  return { combinedItemChanges, baseInventoryForPlayer };
};

interface ApplyItemChangesParams {
  aiData: GameStateFromAI;
  draftState: FullGameState;
  baseStateSnapshot: FullGameState;
  combinedItemChanges: Array<ItemChange>;
  baseInventoryForPlayer: Array<Item>;
  turnChanges: TurnChanges;
  forceEmptyInventory?: boolean;
  themeContextForResponse: FullGameState['theme'];
  isFromDialogueSummary: boolean;
}

const applyItemChangesAndLogging = async ({
  aiData,
  draftState,
  baseStateSnapshot,
  combinedItemChanges,
  baseInventoryForPlayer,
  turnChanges,
  forceEmptyInventory,
  themeContextForResponse,
  isFromDialogueSummary,
}: ApplyItemChangesParams) => {
  turnChanges.itemChanges = buildItemChangeRecords(
    combinedItemChanges,
    baseInventoryForPlayer,
  );
  draftState.inventory = applyAllItemChanges(
    combinedItemChanges,
    forceEmptyInventory ? [] : baseStateSnapshot.inventory,
  );

  if (aiData.logMessage) {
    draftState.gameLog = addLogMessageToList(draftState.gameLog, aiData.logMessage, MAX_LOG_MESSAGES);
    draftState.lastActionLog = aiData.logMessage;
  } else if (!isFromDialogueSummary) {
    draftState.lastActionLog = 'The Dungeon Master remains silent on the outcome of your last action.';
  }

  for (const change of combinedItemChanges) {
    if (change.action === 'addDetails') {
      const target = findItemByIdentifier(
        [change.item.id, change.item.name],
        draftState.inventory,
        false,
        true,
      ) as Item | null;
      if (!target) continue;
      const chapter = change.item.chapters?.[0];
      if (!chapter) continue;
      const { name: themeName, storyGuidance } = themeContextForResponse;
      const prev = target.chapters?.[target.chapters.length - 1]?.actualContent ?? '';
      const thoughts = draftState.lastDebugPacket?.storytellerThoughts?.slice(-1)[0] ?? '';
      const actual = await generatePageText(
        chapter.heading,
        chapter.description,
        chapter.contentLength,
        themeName,
        storyGuidance,
        draftState.currentScene,
        thoughts,
        draftState.mapData.nodes,
        draftState.allNPCs,
        draftState.mainQuest,
        `Take into account: ${draftState.lastActionLog || ''}`,
        prev,
      );
      if (!actual) continue;

      const tags = target.tags ?? [];
      let visible = actual;
      if (tags.includes('foreign')) {
        const fake = await generatePageText(
          chapter.heading,
          chapter.description,
          chapter.contentLength,
          themeName,
          storyGuidance,
          draftState.currentScene,
          thoughts,
          draftState.mapData.nodes,
          draftState.allNPCs,
          draftState.mainQuest,
          `Translate the following text into an artificial nonexistent language that fits the theme and context:\n"""${actual}"""`,
        );
        visible = fake ?? actual;
      } else if (tags.includes('encrypted')) {
        visible = rot13(actual);
      } else if (tags.includes('runic')) {
        visible = toRunic(actual);
      }
      if (tags.includes('torn') && !tags.includes('recovered')) {
        visible = tornVisibleText(visible);
      }
      const updatedChapter = { ...chapter, actualContent: actual, visibleContent: visible };
      const idx = draftState.inventory.findIndex(i => i.id === target.id);
      const updated = {
        ...target,
        chapters: [...(target.chapters ?? []), updatedChapter],
        lastInspectTurn: undefined,
      };
      draftState.inventory[idx] = updated;
    }
  }
};

interface LoreRefinementParams {
  aiData: GameStateFromAI;
  draftState: FullGameState;
  options: ProcessAiResponseOptions;
  themeContextForResponse: FullGameState['theme'];
  playerActionText?: string;
  loadingReasonRef: React.RefObject<LoadingReason | null>;
  setLoadingReason: (reason: LoadingReason | null) => void;
  debugLore: boolean;
  openDebugLoreModal: (
    facts: Array<string>,
    resolve: (good: Array<string>, bad: Array<string>, proceed: boolean) => void,
  ) => void;
  actIntroRef: React.RefObject<StoryAct | null>;
  onActIntro: (act: StoryAct) => void;
}

const performLoreRefinementStage = async ({
  aiData,
  draftState,
  options,
  themeContextForResponse,
  playerActionText,
  loadingReasonRef,
  setLoadingReason,
  debugLore,
  openDebugLoreModal,
  actIntroRef,
  onActIntro,
}: LoreRefinementParams): Promise<void> => {
  draftState.turnState = options.isFromDialogueSummary ? 'dialogue_summary' : 'loremaster_extract';
  options.onBeforeRefine?.(structuredCloneGameState(draftState));
  options.setIsLoading?.(false);
  options.setIsTurnProcessing?.(true);

      const thoughts = draftState.lastDebugPacket?.storytellerThoughts?.join('\n') ?? '';
  const baseContext = options.isFromDialogueSummary
    ? [options.dialogueTranscript ?? '', thoughts ? `\n  ## Storyteller's Thoughts:\n${thoughts}\n------` : '']
        .filter(Boolean)
        .join('\n')
    : [
        playerActionText ? `Action: ${playerActionText}` : '',
        aiData.sceneDescription,
        aiData.logMessage ?? '',
        thoughts ? `\n  ## Storyteller's Thoughts:\n\n${thoughts}\n------` : '',
      ]
        .filter(Boolean)
        .join('\n');

  const nodesForTheme = draftState.mapData.nodes.filter(
    n => n.type !== 'feature' && n.type !== 'room',
  );
  const npcsForTheme = draftState.allNPCs;
  const itemsForTheme = draftState.inventory.filter(
    item =>
      item.holderId === PLAYER_HOLDER_ID ||
      nodesForTheme.some(n => n.id === item.holderId) ||
      npcsForTheme.some(npc => npc.id === item.holderId),
  );
  const idsContext = [
    `Node IDs: ${nodesForTheme.map(n => n.id).join(', ')}`,
    `NPC IDs: ${npcsForTheme.map(n => n.id).join(', ')}`,
    `Item IDs: ${itemsForTheme.map(i => i.id).join(', ')}`,
  ].join('\n');

  const contextParts = `${baseContext}\n${idsContext}`;
  if (actIntroRef.current) {
    onActIntro(actIntroRef.current);
    actIntroRef.current = null;
  }

  const original = loadingReasonRef.current;
  const refineResult = await refineLore({
    themeName: themeContextForResponse.name,
    turnContext: contextParts,
    existingFacts: draftState.loreFacts,
    logMessage: aiData.logMessage ?? '',
    currentScene: aiData.sceneDescription,
    onFactsExtracted: debugLore
      ? async (facts) =>
          new Promise<{ proceed: boolean }>(resolve => {
            openDebugLoreModal(
              facts.map(f => f.text),
              (good, bad, proceed) => {
                if (proceed) {
                  draftState.debugGoodFacts.push(...good);
                  draftState.debugBadFacts.push(...bad);
                }
                resolve({ proceed });
              },
            );
          })
      : undefined,
    onSetLoadingReason: setLoadingReason,
  });
  const loreDebugInfo = draftState.lastDebugPacket?.loremasterDebugInfo;
  if (loreDebugInfo) {
    loreDebugInfo.extract = refineResult?.debugInfo?.extract ?? null;
    loreDebugInfo.integrate = refineResult?.debugInfo?.integrate ?? null;
  }
  if (refineResult?.refinementResult) {
    applyLoreFactChanges(
      draftState,
      refineResult.refinementResult.factsChange,
      draftState.globalTurnNumber,
    );
  }
  setLoadingReason(original);
};

export interface ProcessAiResponseOptions {
  baseStateSnapshot: FullGameState;
  dialogueTranscript?: string;
  forceEmptyInventory?: boolean;
  isFromDialogueSummary?: boolean;
  onBeforeRefine?: (state: FullGameState) => void;
  playerActionText?: string;
  scoreChangeFromAction?: number;
  setIsLoading?: (val: boolean) => void;
  setIsTurnProcessing?: (val: boolean) => void;
}

export type ProcessAiResponseFn = (
  aiData: GameStateFromAI | null,
  draftState: FullGameState,
  options: ProcessAiResponseOptions,
) => Promise<void>;

export interface UseProcessAiResponseProps {
  loadingReasonRef: React.RefObject<LoadingReason | null>;
  setLoadingReason: (reason: LoadingReason | null) => void;
  setError: (err: string | null) => void;
  setGameStateStack: React.Dispatch<React.SetStateAction<GameStateStack>>;
  debugLore: boolean;
  openDebugLoreModal: (
    facts: Array<string>,
    resolve: (good: Array<string>, bad: Array<string>, proceed: boolean) => void,
  ) => void;
  actIntroRef: React.RefObject<StoryAct | null>;
  onActIntro: (act: StoryAct) => void;
}

export const useProcessAiResponse = ({
  loadingReasonRef,
  setLoadingReason,
  setError,
  setGameStateStack,
  debugLore,
  openDebugLoreModal,
  actIntroRef,
  onActIntro,
}: UseProcessAiResponseProps) => {
  const { processMapUpdates } = useMapUpdateProcessor({
    loadingReasonRef,
    setLoadingReason,
    setError,
  });

  const objectiveAnimationClearTimerRef = useRef<number | null>(null);

  const clearObjectiveAnimationTimer = useCallback(() => {
    if (objectiveAnimationClearTimerRef.current) {
      clearTimeout(objectiveAnimationClearTimerRef.current);
      objectiveAnimationClearTimerRef.current = null;
    }
  }, []);

  const processAiResponse: ProcessAiResponseFn = useCallback(
    async (aiData, draftState, options) => {
      const {
        baseStateSnapshot,
        isFromDialogueSummary = false,
        scoreChangeFromAction = 0,
        playerActionText,
      } = options;

      const turnChanges = createInitialTurnChanges(scoreChangeFromAction);
      const themeContextForResponse = draftState.theme;

      if (!aiData) {
        handleMissingAiResponse({
          draftState,
          turnChanges,
          setError,
          isFromDialogueSummary,
        });
        return;
      }

      updateDebugPacketWithAiData(draftState, aiData);

      if ('sceneDescription' in aiData && aiData.sceneDescription) {
        draftState.currentScene = aiData.sceneDescription;
      }

      applySceneAndObjectiveUpdates({
        aiData,
        draftState,
        turnChanges,
        clearObjectiveAnimationTimer,
        objectiveAnimationClearTimerRef,
        setGameStateStack,
      });

      configureActionOptions({ draftState, aiData, isFromDialogueSummary });

      if (aiData.dialogueSetup) {
        updateDialogueState(draftState, aiData, false);
        draftState.lastTurnChanges = turnChanges;
        return;
      }

      const { combinedItemChanges, baseInventoryForPlayer } = await processMapAndInventoryStages({
        aiData,
        draftState,
        baseStateSnapshot,
        playerActionText,
        loadingReasonRef,
        setLoadingReason,
        turnChanges,
        processMapUpdates,
      });

      await applyItemChangesAndLogging({
        aiData,
        draftState,
        baseStateSnapshot,
        combinedItemChanges,
        baseInventoryForPlayer,
        turnChanges,
        forceEmptyInventory: options.forceEmptyInventory,
        themeContextForResponse,
        isFromDialogueSummary,
      });

      await performLoreRefinementStage({
        aiData,
        draftState,
        options,
        themeContextForResponse,
        playerActionText,
        loadingReasonRef,
        setLoadingReason,
        debugLore,
        openDebugLoreModal,
        actIntroRef,
        onActIntro,
      });

      updateDialogueState(draftState, aiData, isFromDialogueSummary);

      draftState.lastTurnChanges = turnChanges;
      if (!options.isFromDialogueSummary) {
        draftState.turnState = 'awaiting_input';
      }
    },
    [
      loadingReasonRef,
      setLoadingReason,
      setError,
      setGameStateStack,
      processMapUpdates,
      clearObjectiveAnimationTimer,
      debugLore,
      openDebugLoreModal,
      actIntroRef,
      onActIntro,
    ],
  );

  return { processAiResponse, clearObjectiveAnimationTimer };
};

export type ProcessAiResponseHook = ReturnType<typeof useProcessAiResponse>;
