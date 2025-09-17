import { useCallback, useRef } from 'react';
import * as React from 'react';
import {
  AdventureTheme,
  FullGameState,
  GameStateFromAI,
  GameStateStack,
  Item,
  ItemChange,
  LoadingReason,
  TurnChanges,
  StoryAct,
} from '../types';
import { fetchCorrectedName_Service } from '../services/corrections';
import { PLAYER_HOLDER_ID, MAX_LOG_MESSAGES, WRITTEN_ITEM_TYPES, REGULAR_ITEM_TYPES } from '../constants';
import {
  addLogMessageToList,
  buildItemChangeRecords,
  applyAllItemChanges,
  applyThemeFactChanges,
} from '../utils/gameLogicUtils';
import { itemsToString } from '../utils/promptFormatters/inventory';
import { formatLimitedMapContextForPrompt } from '../utils/promptFormatters/map';
import { useMapUpdateProcessor } from './useMapUpdateProcessor';
import { applyInventoryHints_Service } from '../services/inventory';
import { applyLibrarianHints_Service } from '../services/librarian';
import { refineLore_Service } from '../services/loremaster';
import { generatePageText } from '../services/page';
import { formatKnownPlacesForPrompt, npcsToString } from '../utils/promptFormatters';
import { rot13, toRunic, tornVisibleText } from '../utils/textTransforms';
import { structuredCloneGameState } from '../utils/cloneUtils';
import {
  findItemByIdentifier,
  findMapNodeByIdentifier,
  findNPCByIdentifier,
} from '../utils/entityUtils';
import { filterDuplicateCreates } from '../utils/itemChangeUtils';

interface CorrectItemChangesParams {
  aiItemChanges: Array<ItemChange>;
  aiData: GameStateFromAI;
  theme: AdventureTheme | null;
  baseState: FullGameState;
  playerActionText?: string;
  loadingReason: LoadingReason | null;
  setLoadingReason: (reason: LoadingReason | null) => void;
}

const correctItemChanges = async ({
  aiItemChanges,
  aiData,
  theme,
  baseState,
  playerActionText,
  loadingReason,
  setLoadingReason,
}: CorrectItemChangesParams): Promise<Array<ItemChange>> => {
  if (!theme) return [...aiItemChanges];

  const result: Array<ItemChange> = [];

  const resolveHolder = (holderId: string | undefined): string | undefined => {
    if (!holderId) return undefined;
    if (holderId === PLAYER_HOLDER_ID) return PLAYER_HOLDER_ID;
    if (holderId.startsWith('node-')) {
      const node = findMapNodeByIdentifier(
        holderId,
        baseState.mapData.nodes,
        baseState.mapData,
        baseState.currentMapNodeId,
      );
      return Array.isArray(node) ? node[0]?.id : node?.id;
    }
    if (holderId.startsWith('npc-')) {
      const npc = findNPCByIdentifier(holderId, baseState.allNPCs);
      return Array.isArray(npc) ? npc[0]?.id : npc?.id;
    }
    return undefined;
  };
  for (const change of aiItemChanges) {
    let currentChange: ItemChange = { ...change };

    if (currentChange.action === 'create') {
      const item = currentChange.item;
      const match = findItemByIdentifier(
        [item.id, item.name],
        baseState.inventory,
        false,
        true,
      );
      const existing = Array.isArray(match) ? null : match;
      if (existing) {
        currentChange = {
          action: 'change',
          item: { ...item, id: existing.id },
        };
      }
      const corrected = resolveHolder(item.holderId);
      if (corrected) item.holderId = corrected;
    } else if (currentChange.action === 'move') {
      const payload = currentChange.item as { newHolderId: string };
      const corrected = resolveHolder(payload.newHolderId);
      if (corrected) payload.newHolderId = corrected;
    } else if (currentChange.action === 'change') {
      const itm = currentChange.item as { holderId?: string };
      if (itm.holderId) {
        const corrected = resolveHolder(itm.holderId);
        if (corrected) itm.holderId = corrected;
      }
    }

    if ('item' in currentChange && (currentChange.item as { type?: string }).type === 'immovable') {
      if (currentChange.action === 'create') {
        const itm = currentChange.item;
        if (!itm.holderId.startsWith('node-')) {
          itm.holderId = baseState.currentMapNodeId ?? 'unknown';
        }
      } else if (currentChange.action === 'move') {
        const payload = currentChange.item;
        if (!payload.newHolderId.startsWith('node-')) {
          payload.newHolderId = baseState.currentMapNodeId ?? 'unknown';
        }
      }
    }
    if (currentChange.action === 'destroy') {
      const itemRef = currentChange.item;
      const itemNameFromAI = itemRef.name;
      const exactMatchInInventory = baseState.inventory
        .filter((i) => i.holderId === PLAYER_HOLDER_ID)
        .find((invItem) => {
          const matchId = itemRef.id !== undefined && invItem.id === itemRef.id;
          const matchName =
            itemRef.name !== undefined && invItem.name === itemRef.name;
          return matchId || matchName;
        });
      if (!exactMatchInInventory) {
        const original = loadingReason;
        setLoadingReason('corrections');
        const correctedName = await fetchCorrectedName_Service(
          'item',
          itemNameFromAI ?? '',
          aiData.logMessage,
          'sceneDescription' in aiData ? aiData.sceneDescription : baseState.currentScene,
          baseState.inventory
            .filter((i) => i.holderId === PLAYER_HOLDER_ID)
            .map((item) => item.name),
          theme,
        );
        if (correctedName) {
          // Fix wrong item name from AI using correction service
          currentChange.item = { id: correctedName, name: correctedName };
        }
        setLoadingReason(original);
      }

      const dropText = `${aiData.logMessage ?? ''} ${
        'sceneDescription' in aiData ? aiData.sceneDescription : ''
      } ${playerActionText ?? ''}`.toLowerCase();
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
      if (dropIndicators.some((word) => dropText.includes(word))) {
        // Convert mistaken destroy action into a put action at current location
        const invItem = baseState.inventory.find(
          (i) =>
            i.holderId === PLAYER_HOLDER_ID &&
            ((itemRef.id != null && i.id === itemRef.id) ||
              (itemRef.name != null && i.name.toLowerCase() === itemRef.name.toLowerCase()))
        );
        if (invItem) {
          currentChange = {
            action: 'create',
            item: {
              ...invItem,
              holderId: baseState.currentMapNodeId ?? 'unknown',
            },
          };
        }
      }
    }
    result.push(currentChange);
  }
  return result;
};

interface ApplyMapUpdatesParams {
  aiData: GameStateFromAI;
  theme: AdventureTheme | null;
  draftState: FullGameState;
  baseState: FullGameState;
  turnChanges: TurnChanges;
  processMapUpdates: (
    aiData: GameStateFromAI,
    draftState: FullGameState,
    baseState: FullGameState,
    theme: AdventureTheme,
    turnChanges: TurnChanges,
  ) => Promise<void>;
}

const applyMapUpdatesFromAi = async ({
  aiData,
  theme,
  draftState,
  baseState,
  turnChanges,
  processMapUpdates,
}: ApplyMapUpdatesParams) => {
  if (theme) {
    // Only run Cartographer when storyteller indicates map updates or
    // when the location changed.
    let shouldRunMap = false;
    if ((('mapUpdated' in aiData) && aiData.mapUpdated) || (draftState.localPlace !== baseState.localPlace)) {
      shouldRunMap = true;
    }
    if (shouldRunMap) {
      await processMapUpdates(aiData, draftState, baseState, theme, turnChanges);
    }
  }
};

interface HandleInventoryHintsParams {
  aiData: GameStateFromAI;
  theme: AdventureTheme | null;
  draftState: FullGameState;
  baseState: FullGameState;
  correctedItemChanges: Array<ItemChange>;
  playerActionText?: string;
  loadingReason: LoadingReason | null;
  setLoadingReason: (reason: LoadingReason | null) => void;
}

const handleInventoryHints = async ({
  aiData,
  theme,
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
  const locationInventory = baseState.inventory.filter(
    (item) => item.holderId === baseState.currentMapNodeId,
  );
  const companionNPCs = baseState.allNPCs.filter(
    (npc) => npc.presenceStatus === 'companion',
  );
  const nearbyNPCs = baseState.allNPCs.filter(
    (npc) => npc.presenceStatus === 'nearby',
  );

  const filterItemsByType = (
    items: Array<Item>,
    allowed: ReadonlyArray<string>,
  ): Array<Item> => items.filter(it => allowed.includes(it.type));

  const regularPlayerInventory = filterItemsByType(
    baseInventoryForPlayer,
    REGULAR_ITEM_TYPES,
  );
  const regularLocationInventory = filterItemsByType(
    locationInventory,
    REGULAR_ITEM_TYPES,
  );
  const writtenPlayerInventory = filterItemsByType(
    baseInventoryForPlayer,
    WRITTEN_ITEM_TYPES,
  );
  const writtenLocationInventory = filterItemsByType(
    locationInventory,
    WRITTEN_ITEM_TYPES,
  );

  const formatNPCInventoryList = (
    npcs: typeof companionNPCs,
    allowedTypes: ReadonlyArray<string>,
  ): string => {
    if (npcs.length === 0) return 'None.';
    return npcs
      .map((npc) => {
        const items = baseState.inventory.filter(
          (i) => i.holderId === npc.id && allowedTypes.includes(i.type),
        );
        return `ID: ${npc.id} - ${npc.name}: ${itemsToString(items, ' - ', true, true, false, true)}`;
      })
      .join('\n');
  };

  let combinedItemChanges = [...correctedItemChanges];

  if (theme) {
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
    let invResult: Awaited<ReturnType<typeof applyInventoryHints_Service>> | null = null;
    if (playerItemsHint || worldItemsHint || npcItemsHint || inventoryNewItems.length > 0) {
      invResult = await applyInventoryHints_Service(
        playerItemsHint,
        worldItemsHint,
        npcItemsHint,
        inventoryNewItems,
        playerActionText ?? '',
        itemsToString(regularPlayerInventory, ' - ', true, true, false, true),
        itemsToString(regularLocationInventory, ' - ', true, true, false, true),
        baseState.currentMapNodeId ?? null,
        formatNPCInventoryList(companionNPCs, REGULAR_ITEM_TYPES),
        formatNPCInventoryList(nearbyNPCs, REGULAR_ITEM_TYPES),
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
    let libResult: Awaited<ReturnType<typeof applyLibrarianHints_Service>> | null = null;
    if (librarianHint) {
      // Reflect librarian stage in FSM and loading indicator
      draftState.turnState = 'librarian_updates';
      setLoadingReason('librarian_updates');
      libResult = await applyLibrarianHints_Service(
        librarianHint,
        librarianNewItems,
        playerActionText ?? '',
        itemsToString(writtenPlayerInventory, ' - ', true, true, false, true),
        itemsToString(writtenLocationInventory, ' - ', true, true, false, true),
        baseState.currentMapNodeId ?? null,
        formatNPCInventoryList(companionNPCs, WRITTEN_ITEM_TYPES),
        formatNPCInventoryList(nearbyNPCs, WRITTEN_ITEM_TYPES),
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
  themeContextForResponse: AdventureTheme | null,
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
    async (aiData, themeContextForResponse, draftState, options) => {
      const {
        baseStateSnapshot,
        isFromDialogueSummary = false,
        scoreChangeFromAction = 0,
        playerActionText,
      } = options;

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
        currentMapNodeIdChanged: false,
        scoreChangedBy: scoreChangeFromAction,
        mapDataChanged: false,
      };

      if (!aiData) {
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
        return;
      }

      draftState.lastDebugPacket = {
        ...(draftState.lastDebugPacket ?? {}),
        prompt: draftState.lastDebugPacket?.prompt ?? 'Prompt not captured for this state transition',
        rawResponseText: draftState.lastDebugPacket?.rawResponseText ?? 'Raw text not captured',
        parsedResponse: aiData,
        timestamp: new Date().toISOString(),
        mapUpdateDebugInfo: null,
        inventoryDebugInfo: null,
        librarianDebugInfo: null,
        loremasterDebugInfo: draftState.lastDebugPacket?.loremasterDebugInfo ?? { collect: null, extract: null, integrate: null, distill: null, journal: null },
      };

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
      const oldObjectiveText = draftState.currentObjective;
      if (aiData.currentObjective !== undefined) {
        if (draftState.currentObjective !== aiData.currentObjective) turnChanges.objectiveTextChanged = true;
        draftState.currentObjective = aiData.currentObjective;
      }

      clearObjectiveAnimationTimer();
      let animationToSet: 'success' | 'neutral' | null = null;
      if (aiData.currentObjective !== undefined && aiData.currentObjective !== oldObjectiveText) {
        animationToSet = aiData.objectiveAchieved ? 'success' : 'neutral';
      } else if (aiData.objectiveAchieved && oldObjectiveText !== null) {
        animationToSet = 'success';
      }
      if (animationToSet) {
        draftState.objectiveAnimationType = animationToSet;
        objectiveAnimationClearTimerRef.current = window.setTimeout(() => {
          setGameStateStack((prev) => [{ ...prev[0], objectiveAnimationType: null }, prev[1]]);
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

      if ('sceneDescription' in aiData && aiData.sceneDescription) {
        draftState.currentScene = aiData.sceneDescription;
      }
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

      // Early branch: if storyteller indicated a dialogue starts, skip optional
      // stages (map/inventory/librarian/lore_refine) and enter dialogue loop.
      if (aiData.dialogueSetup) {
        updateDialogueState(draftState, aiData, false);
        draftState.lastTurnChanges = turnChanges;
        return;
      }

      const aiItemChangesFromParser = aiData.itemChange;
      const correctedAndVerifiedItemChanges = await correctItemChanges({
        aiItemChanges: aiItemChangesFromParser,
        aiData,
        theme: themeContextForResponse,
        baseState: baseStateSnapshot,
        playerActionText,
        loadingReason: loadingReasonRef.current,
        setLoadingReason,
      });

      // Map updates run only if flagged
      let shouldRunMap = false;
      if ((('mapUpdated' in aiData) && aiData.mapUpdated) || (draftState.localPlace !== baseStateSnapshot.localPlace)) {
        shouldRunMap = true;
      }
      if (shouldRunMap) {
        draftState.turnState = 'map_updates';
        await applyMapUpdatesFromAi({
          aiData,
          theme: themeContextForResponse,
          draftState,
          baseState: baseStateSnapshot,
          turnChanges,
          processMapUpdates,
        });
      }

      // Inventory/librarian updates: only when flags present
      const allNewItems =
        'newItems' in aiData && Array.isArray(aiData.newItems) ? aiData.newItems : [];
      const hasLibrarianNew = allNewItems.some(it => WRITTEN_ITEM_TYPES.includes(it.type as (typeof WRITTEN_ITEM_TYPES)[number]));
      const hasInventoryNew = allNewItems.some(it => !WRITTEN_ITEM_TYPES.includes(it.type as (typeof WRITTEN_ITEM_TYPES)[number]));
      const hasInventoryHints = !!aiData.playerItemsHint || !!aiData.worldItemsHint || !!aiData.npcItemsHint || hasInventoryNew;
      const hasLibrarianHints = !!aiData.librarianHint || hasLibrarianNew;
      let combinedItemChanges: Array<ItemChange> = correctedAndVerifiedItemChanges;
      let baseInventoryForPlayer: Array<Item> = baseStateSnapshot.inventory.filter(it => it.holderId === PLAYER_HOLDER_ID);
      if (hasInventoryHints || hasLibrarianHints) {
        if (hasInventoryHints) draftState.turnState = 'inventory_updates';
        const result = await handleInventoryHints({
          aiData,
          theme: themeContextForResponse,
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

      turnChanges.itemChanges = buildItemChangeRecords(
        combinedItemChanges,
        baseInventoryForPlayer,
      );
      draftState.inventory = applyAllItemChanges(
        combinedItemChanges,
        options.forceEmptyInventory ? [] : baseStateSnapshot.inventory,
      );

      if (aiData.logMessage) {
        draftState.gameLog = addLogMessageToList(draftState.gameLog, aiData.logMessage, MAX_LOG_MESSAGES);
        draftState.lastActionLog = aiData.logMessage;
      } else if (!isFromDialogueSummary) {
        draftState.lastActionLog = 'The Dungeon Master remains silent on the outcome of your last action.';
      }

      if (themeContextForResponse) {
        for (const change of combinedItemChanges) {
          if (change.action === 'addDetails') {
            const target = findItemByIdentifier([
              change.item.id,
              change.item.name,
            ], draftState.inventory, false, true) as Item | null;
            if (!target) continue;
            const chapter = change.item.chapters?.[0];
            if (!chapter) continue;
            const { name: themeName, storyGuidance } = themeContextForResponse;
            const nodes = draftState.mapData.nodes.filter(
              n => n.data.nodeType !== 'feature' && n.data.nodeType !== 'room'
            );
            const knownPlaces = formatKnownPlacesForPrompt(nodes, true);
            const npcs = draftState.allNPCs;
            const knownNPCs =
              npcsToString(npcs, '- <ID: {id}> - {name}\n') ||
              'None specifically known in this theme yet.\n';
            const prev = target.chapters?.[target.chapters.length - 1]?.actualContent ?? '';
            const thoughts = draftState.lastDebugPacket.storytellerThoughts?.slice(-1)[0] ?? '';
            const actual = await generatePageText(
              chapter.heading,
              chapter.description,
              chapter.contentLength,
              themeName,
              storyGuidance,
              draftState.currentScene,
              thoughts,
              knownPlaces,
              knownNPCs,
              draftState.mainQuest,
              `Take into account: ${draftState.lastActionLog || ''}`,
              prev
            );
            if (actual) {
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
                  knownPlaces,
                  knownNPCs,
                  draftState.mainQuest,
                  `Translate the following text into an artificial nonexistent language that fits the theme and context:\n"""${actual}"""`
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
        }
      }

      if (themeContextForResponse) {
        // Proceed to loremaster extract (dialogue summary -> summary stage)
        draftState.turnState = options.isFromDialogueSummary ? 'dialogue_summary' : 'loremaster_extract';
        options.onBeforeRefine?.(structuredCloneGameState(draftState));
        options.setIsLoading?.(false);
        options.setIsTurnProcessing?.(true);

        const thoughts = draftState.lastDebugPacket.storytellerThoughts?.join('\n') ?? '';
        const baseContext = isFromDialogueSummary
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
          n => n.data.nodeType !== 'feature' && n.data.nodeType !== 'room',
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
        const refineResult = await refineLore_Service({
          themeName: themeContextForResponse.name,
          turnContext: contextParts,
          existingFacts: draftState.themeFacts,
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
        if (draftState.lastDebugPacket.loremasterDebugInfo) {
          draftState.lastDebugPacket.loremasterDebugInfo.extract = refineResult?.debugInfo?.extract ?? null;
          draftState.lastDebugPacket.loremasterDebugInfo.integrate = refineResult?.debugInfo?.integrate ?? null;
        }
        if (refineResult?.refinementResult) {
          applyThemeFactChanges(
            draftState,
            refineResult.refinementResult.factsChange,
            draftState.globalTurnNumber,
          );
        }
        setLoadingReason(original);
      }

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
