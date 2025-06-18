import { useCallback, useRef } from 'react';
import {
  AdventureTheme,
  FullGameState,
  GameStateFromAI,
  GameStateStack,
  Item,
  ItemReference,
  ItemChange,
  LoadingReason,
  TurnChanges,
} from '../types';
import { fetchCorrectedName_Service } from '../services/corrections';
import { PLAYER_HOLDER_ID, MAX_LOG_MESSAGES } from '../constants';
import {
  addLogMessageToList,
  buildItemChangeRecords,
  applyAllItemChanges,
} from '../utils/gameLogicUtils';
import { formatInventoryForPrompt } from '../utils/promptFormatters/inventory';
import { formatLimitedMapContextForPrompt } from '../utils/promptFormatters/map';
import { useMapUpdateProcessor } from './useMapUpdateProcessor';
import { applyInventoryHints_Service } from '../services/inventory';

export interface ProcessAiResponseOptions {
  forceEmptyInventory?: boolean;
  baseStateSnapshot: FullGameState;
  isFromDialogueSummary?: boolean;
  scoreChangeFromAction?: number;
  playerActionText?: string;
}

export type ProcessAiResponseFn = (
  aiData: GameStateFromAI | null,
  themeContextForResponse: AdventureTheme | null,
  draftState: FullGameState,
  options: ProcessAiResponseOptions,
) => Promise<void>;

export interface UseProcessAiResponseProps {
  loadingReason: LoadingReason | null;
  setLoadingReason: (reason: LoadingReason | null) => void;
  setError: (err: string | null) => void;
  setGameStateStack: React.Dispatch<React.SetStateAction<GameStateStack>>;
}

export const useProcessAiResponse = ({
  loadingReason,
  setLoadingReason,
  setError,
  setGameStateStack,
}: UseProcessAiResponseProps) => {
  const { processMapUpdates } = useMapUpdateProcessor({
    loadingReason,
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
        characterChanges: [],
        objectiveAchieved: false,
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
        draftState.localTime = draftState.localTime ?? 'Time Unknown';
        draftState.localEnvironment = draftState.localEnvironment ?? 'Environment Undetermined';
        draftState.localPlace = draftState.localPlace ?? 'Undetermined Location';
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

      const aiItemChangesFromParser = aiData.itemChange;
      const correctedAndVerifiedItemChanges: Array<ItemChange> = [];
      if (themeContextForResponse) {
        for (const change of aiItemChangesFromParser) {
          const currentChange = { ...change };
          if (currentChange.action === 'destroy' && currentChange.item) {
            const itemRef = currentChange.item as ItemReference;
            const itemNameFromAI = itemRef.name;
            const exactMatchInInventory = baseStateSnapshot.inventory
              .filter((i) => i.holderId === PLAYER_HOLDER_ID)
              .find((invItem) => {
                const matchId = itemRef.id !== undefined && invItem.id === itemRef.id;
                const matchName = itemRef.name !== undefined && invItem.name === itemRef.name;
                return matchId || matchName;
              });
            if (!exactMatchInInventory) {
              const originalLoadingReason = loadingReason;
              setLoadingReason('correction');
              const correctedName = await fetchCorrectedName_Service(
                'item',
                itemNameFromAI ?? '',
                aiData.logMessage,
                'sceneDescription' in aiData ? aiData.sceneDescription : baseStateSnapshot.currentScene,
                baseStateSnapshot.inventory
                  .filter((i) => i.holderId === PLAYER_HOLDER_ID)
                  .map((item) => item.name),
                themeContextForResponse,
              );
              if (correctedName) {
                currentChange.item = { id: correctedName, name: correctedName };
              }
              setLoadingReason(originalLoadingReason);
            }

            const dropText = `${aiData.logMessage ?? ''} ${
              'sceneDescription' in aiData ? aiData.sceneDescription : ''
            } ${playerActionText ?? ''}`.toLowerCase();
            const dropIndicators = ['drop', 'dropped', 'leave', 'left', 'put down', 'set down', 'place', 'placed'];
            if (dropIndicators.some((word) => dropText.includes(word))) {
              const invItem = baseStateSnapshot.inventory.find(
                (i) =>
                  i.holderId === PLAYER_HOLDER_ID &&
                  ((itemRef.id && i.id === itemRef.id) ||
                    (itemRef.name && i.name.toLowerCase() === itemRef.name.toLowerCase()))
              );
              if (invItem) {
                currentChange.action = 'put';
                currentChange.item = {
                  ...invItem,
                  holderId: baseStateSnapshot.currentMapNodeId ?? 'unknown',
                } as Item;
              }
            }
          }
          correctedAndVerifiedItemChanges.push(currentChange);
        }
      } else {
        correctedAndVerifiedItemChanges.push(...aiItemChangesFromParser);
      }
      const baseInventoryForPlayer = baseStateSnapshot.inventory.filter((i) => i.holderId === PLAYER_HOLDER_ID);
      const locationInventory = baseStateSnapshot.inventory.filter((i) => i.holderId === baseStateSnapshot.currentMapNodeId);
      const companionChars = baseStateSnapshot.allCharacters.filter((c) => c.presenceStatus === 'companion');
      const nearbyChars = baseStateSnapshot.allCharacters.filter((c) => c.presenceStatus === 'nearby');

      const formatCharInventoryList = (chars: typeof companionChars): string => {
        if (chars.length === 0) return 'None.';
        return chars
          .map((ch) => {
            const items = baseStateSnapshot.inventory.filter((i) => i.holderId === ch.id);
            return `ID: ${ch.id} - ${ch.name}: ${formatInventoryForPrompt(items)}`;
          })
          .join('\n');
      };

      let combinedItemChanges = [...correctedAndVerifiedItemChanges];

      if (themeContextForResponse) {
        await processMapUpdates(aiData, draftState, baseStateSnapshot, themeContextForResponse, turnChanges);
      }

      if (themeContextForResponse) {
        const originalLoadingReason = loadingReason;
        setLoadingReason('inventory');
        const limitedMapContext = formatLimitedMapContextForPrompt(
          draftState.mapData,
          draftState.currentMapNodeId,
          baseStateSnapshot.inventory,
        );
        const invResult = await applyInventoryHints_Service(
          'playerItemsHint' in aiData ? aiData.playerItemsHint : undefined,
          'worldItemsHint' in aiData ? aiData.worldItemsHint : undefined,
          'npcItemsHint' in aiData ? aiData.npcItemsHint : undefined,
          'newItems' in aiData && Array.isArray(aiData.newItems) ? aiData.newItems : [],
          playerActionText ?? '',
          formatInventoryForPrompt(baseInventoryForPlayer),
          formatInventoryForPrompt(locationInventory),
          baseStateSnapshot.currentMapNodeId ?? null,
          formatCharInventoryList(companionChars),
          formatCharInventoryList(nearbyChars),
          'sceneDescription' in aiData ? aiData.sceneDescription : baseStateSnapshot.currentScene,
          aiData.logMessage,
          themeContextForResponse,
          limitedMapContext,
        );
        setLoadingReason(originalLoadingReason);
        if (invResult) {
          combinedItemChanges = combinedItemChanges.concat(invResult.itemChanges);
            draftState.lastDebugPacket.inventoryDebugInfo = invResult.debugInfo;
        }
      }

      turnChanges.itemChanges = buildItemChangeRecords(combinedItemChanges, baseInventoryForPlayer);
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

      if ('dialogueSetup' in aiData && aiData.dialogueSetup) {
        draftState.actionOptions = [];
        draftState.dialogueState = {
          participants: aiData.dialogueSetup.participants,
          history: aiData.dialogueSetup.initialNpcResponses,
          options: aiData.dialogueSetup.initialPlayerOptions,
        };
      } else if (isFromDialogueSummary) {
        draftState.dialogueState = null;
      }

      draftState.lastTurnChanges = turnChanges;
    },
    [loadingReason, setLoadingReason, setError, setGameStateStack, processMapUpdates, clearObjectiveAnimationTimer],
  );

  return { processAiResponse, clearObjectiveAnimationTimer };
};

export type ProcessAiResponseHook = ReturnType<typeof useProcessAiResponse>;
