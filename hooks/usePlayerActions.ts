/**
 * @file usePlayerActions.ts
 * @description Hook that handles player actions and AI response processing.
 */

import { useCallback } from 'react';
import * as React from 'react';
import {
  KnownUse,
  Item,
  FullGameState,
  GameStateStack,
  LoadingReason,
} from '../types';
import {
  executeAIMainTurn,
  parseAIResponse,
  buildMainGameTurnPrompt
} from '../services/storyteller';
import { SYSTEM_INSTRUCTION } from '../services/storyteller/systemPrompt';
import { collectRelevantFacts_Service } from '../services/loremaster';
import { formatDetailedContextForMentionedEntities } from '../utils/promptFormatters';
import { buildHighlightRegex } from '../utils/highlightHelper';
import { isServerOrClientError, extractStatusFromError } from '../utils/aiErrorUtils';
import {
  FREE_FORM_ACTION_COST,
  RECENT_LOG_COUNT_FOR_PROMPT,
  PLAYER_HOLDER_ID,
  DISTILL_LORE_INTERVAL,
  RECENT_LOG_COUNT_FOR_DISTILL,
} from '../constants';

import { structuredCloneGameState } from '../utils/cloneUtils';
import { useProcessAiResponse } from './useProcessAiResponse';
import { useInventoryActions } from './useInventoryActions';
import { distillFacts_Service } from '../services/loremaster';
import { applyThemeFactChanges } from '../utils/gameLogicUtils';

export interface UsePlayerActionsProps {
  getCurrentGameState: () => FullGameState;
  commitGameState: (state: FullGameState) => void;
  setGameStateStack: React.Dispatch<React.SetStateAction<GameStateStack>>;
  playerGenderProp: string;
  stabilityLevelProp: number;
  chaosLevelProp: number;
  setIsLoading: (val: boolean) => void;
  setLoadingReason: (reason: LoadingReason | null) => void;
  loadingReasonRef: React.RefObject<LoadingReason | null>;
  setError: (err: string | null) => void;
  setParseErrorCounter: (val: number) => void;
  triggerRealityShift: (isChaosShift?: boolean) => void;
  executeManualRealityShift: () => void;
  freeFormActionText: string;
  setFreeFormActionText: (text: string) => void;
  isLoading: boolean;
  hasGameBeenInitialized: boolean;
  debugLore: boolean;
  openDebugLoreModal: (
    facts: Array<string>,
    resolve: (good: Array<string>, bad: Array<string>, proceed: boolean) => void,
  ) => void;
}

/**
 * Provides helpers for executing player actions and processing AI responses.
 */
export const usePlayerActions = (props: UsePlayerActionsProps) => {
  const {
    getCurrentGameState,
    commitGameState,
    setGameStateStack,
    playerGenderProp,
    stabilityLevelProp,
    chaosLevelProp,
    setIsLoading,
    setLoadingReason,
    setError,
    setParseErrorCounter,
    triggerRealityShift,
    executeManualRealityShift,
    freeFormActionText,
    setFreeFormActionText,
    isLoading,
    hasGameBeenInitialized,
    loadingReasonRef,
    debugLore,
    openDebugLoreModal,
  } = props;

  const { processAiResponse, clearObjectiveAnimationTimer } = useProcessAiResponse({
    loadingReasonRef,
    setLoadingReason,
    setError,
    setGameStateStack,
    debugLore,
    openDebugLoreModal,
  });

  const {
    handleDropItem,
    handleTakeLocationItem,
    updateItemContent,
    addJournalEntry,
    addPlayerJournalEntry,
    updatePlayerJournalContent,
    recordPlayerJournalInspect,
    recordInspect,
    handleStashToggle,
  } = useInventoryActions({
    getCurrentGameState,
    commitGameState,
    isLoading,
  });

  const runDistillIfNeeded = useCallback(
    async (state: FullGameState) => {
      const themeObj = state.currentThemeObject;
      if (!themeObj) return;
      if (
        state.globalTurnNumber > 0 &&
        state.globalTurnNumber % DISTILL_LORE_INTERVAL === 0 &&
        state.lastLoreDistillTurn !== state.globalTurnNumber
      ) {
        const currentThemeNodes = state.mapData.nodes.filter(
          n => n.themeName === themeObj.name,
        );
        const inventoryItemNames = Array.from(
          new Set(
            state.inventory
              .filter(item => {
                if (item.holderId === PLAYER_HOLDER_ID) return true;
                if (currentThemeNodes.some(node => node.id === item.holderId)) return true;
                const holderNpc = state.allNPCs.find(
                  npc => npc.id === item.holderId && npc.themeName === themeObj.name,
                );
                return Boolean(holderNpc);
              })
              .map(item => item.name),
          ),
        );
        const mapNodeNames = currentThemeNodes.map(n => n.placeName);
        const recentLogs = state.gameLog.slice(-RECENT_LOG_COUNT_FOR_DISTILL);
        setLoadingReason('loremaster_refine');
        const act =
          state.storyArc?.acts[state.storyArc.currentAct - 1];
        const result = await distillFacts_Service({
          themeName: themeObj.name,
          facts: state.themeFacts,
          currentQuest: act?.mainObjective ?? null,
          currentObjective: state.currentObjective,
          inventoryItemNames,
          mapNodeNames,
          recentLogEntries: recentLogs,
        });
        state.lastLoreDistillTurn = state.globalTurnNumber;
        state.lastDebugPacket ??= {
          prompt: '',
          rawResponseText: null,
          parsedResponse: null,
          timestamp: new Date().toISOString(),
          storytellerThoughts: null,
          mapUpdateDebugInfo: null,
          inventoryDebugInfo: null,
          librarianDebugInfo: null,
          loremasterDebugInfo: { collect: null, extract: null, integrate: null, distill: null, journal: null },
          dialogueDebugInfo: null,
        };
        if (state.lastDebugPacket.loremasterDebugInfo) {
          state.lastDebugPacket.loremasterDebugInfo.distill = result?.debugInfo ?? null;
        }
        if (result?.refinementResult) {
          applyThemeFactChanges(
            state,
            result.refinementResult.factsChange,
            state.globalTurnNumber,
            themeObj.name,
          );
        }
      }
    },
    [setLoadingReason],
  );

  /**
   * Executes a player's chosen action by querying the AI storyteller.
   * On failure, the draft state is rolled back to the base snapshot so no
   * counters or score are affected.
   */
  const executePlayerAction = useCallback(
    async (
      action: string,
      isFreeForm = false,
      overrideState?: FullGameState,
    ) => {
      const currentFullState = overrideState ?? getCurrentGameState();
      if (isLoading || currentFullState.dialogueState) return;

      setIsLoading(true);
      setError(null);
      setParseErrorCounter(0);
      setFreeFormActionText('');

      const baseStateSnapshot = structuredCloneGameState(currentFullState);
      const scoreChangeFromAction = isFreeForm ? -FREE_FORM_ACTION_COST : 0;

      const currentThemeObj = currentFullState.currentThemeObject;
      if (!currentThemeObj) {
        setError('Critical error: Current theme object not found. Cannot proceed.');
        setIsLoading(false);
        setLoadingReason(null);
        return;
      }

      const recentLogs = currentFullState.gameLog.slice(-RECENT_LOG_COUNT_FOR_PROMPT);
        const currentThemeMainMapNodes = currentFullState.mapData.nodes.filter(
          n =>
            n.themeName === currentThemeObj.name &&
            n.data.nodeType !== 'feature' &&
            n.data.nodeType !== 'room'
        );
      const currentThemeNPCs = currentFullState.allNPCs.filter((npc) => npc.themeName === currentThemeObj.name);
      const currentMapNodeDetails = currentFullState.currentMapNodeId
        ? currentFullState.mapData.nodes.find((n) => n.id === currentFullState.currentMapNodeId) ?? null
        : null;

      const locationItems = currentFullState.inventory.filter(
        i =>
          i.holderId !== PLAYER_HOLDER_ID &&
          i.holderId === currentFullState.currentMapNodeId
      );

      const detailedContextForFacts = formatDetailedContextForMentionedEntities(
        currentThemeMainMapNodes,
        currentThemeNPCs,
        `${currentFullState.currentScene} ${action}`,
        'Locations mentioned:',
        'NPCs mentioned:'
      );

      const sortedFacts = [...currentFullState.themeFacts]
        .sort((a, b) => (b.tier - a.tier) || (b.createdTurn - a.createdTurn))
        .map(f => ({ text: f.text, tier: f.tier }));

      setLoadingReason('loremaster_collect');
      const collectResult = await collectRelevantFacts_Service({
        themeName: currentThemeObj.name,
        facts: sortedFacts,
        lastScene: currentFullState.currentScene,
        playerAction: action,
        recentLogEntries: recentLogs,
        detailedContext: detailedContextForFacts,
      });
      const relevantFacts = collectResult?.facts ?? [];

      const prompt = buildMainGameTurnPrompt(
        currentFullState.currentScene,
        action,
        currentFullState.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID),
        locationItems,
        currentFullState.storyArc?.acts[
          currentFullState.storyArc.currentAct - 1
        ]?.mainObjective ?? null,
        currentFullState.currentObjective,
        currentThemeObj,
        recentLogs,
        currentThemeMainMapNodes,
        currentThemeNPCs,
        relevantFacts,
        currentFullState.localTime,
        currentFullState.localEnvironment,
        currentFullState.localPlace,
        playerGenderProp,
        currentFullState.worldFacts,
        currentFullState.heroSheet,
        currentFullState.themeHistory,
        currentMapNodeDetails,
        currentFullState.mapData,
        currentFullState.destinationNodeId,
        currentFullState.storyArc
      );

      let draftState = structuredCloneGameState(currentFullState);
      const debugPacket = {
        prompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        jsonSchema: undefined,
        rawResponseText: null,
        parsedResponse: null,
        timestamp: new Date().toISOString(),
        storytellerThoughts: null,
        mapUpdateDebugInfo: null,
        inventoryDebugInfo: null,
        librarianDebugInfo: null,
        loremasterDebugInfo: {
          collect: collectResult?.debugInfo ?? null,
          extract: null,
          integrate: null,
          distill: null,
          journal: null,
        },
        dialogueDebugInfo: null,
      };
      draftState.lastDebugPacket = debugPacket;
      if (isFreeForm) draftState.score -= FREE_FORM_ACTION_COST;

      let encounteredError = false;
      try {
        setLoadingReason('storyteller');
        const {
          response,
          thoughts,
          systemInstructionUsed,
          jsonSchemaUsed,
          promptUsed,
        } = await executeAIMainTurn(prompt);
        draftState.lastDebugPacket = {
          ...draftState.lastDebugPacket,
          rawResponseText: response.text ?? null,
          storytellerThoughts: thoughts,
          systemInstruction: systemInstructionUsed,
          jsonSchema: jsonSchemaUsed,
          prompt: promptUsed,
        };

        const currentThemeMapDataForParse = {
          nodes: draftState.mapData.nodes.filter((n) => n.themeName === currentThemeObj.name),
          edges: draftState.mapData.edges.filter((e) => {
            const sourceNode = draftState.mapData.nodes.find((node) => node.id === e.sourceNodeId);
            const targetNode = draftState.mapData.nodes.find((node) => node.id === e.targetNodeId);
            return sourceNode?.themeName === currentThemeObj.name && targetNode?.themeName === currentThemeObj.name;
          }),
        };

        const parsedData = await parseAIResponse(
          response.text ?? '',
          playerGenderProp,
          currentThemeObj,
          () => { setParseErrorCounter(1); },
          currentFullState.lastActionLog ?? undefined,
          currentFullState.currentScene,
          currentThemeNPCs,
          currentThemeMapDataForParse,
          currentFullState.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID)
        );

        await processAiResponse(parsedData, currentThemeObj, draftState, { baseStateSnapshot, scoreChangeFromAction, playerActionText: action });
      } catch (e: unknown) {
        encounteredError = true;
        console.error('Error executing player action:', e);
        if (isServerOrClientError(e)) {
          const status = extractStatusFromError(e);
          setError(`AI service error (${String(status ?? 'unknown')}). Please retry.`);
        } else {
          const errMsg = e instanceof Error ? e.message : String(e);
          setError(`The Dungeon Master's connection seems unstable. Error: (${errMsg}). Please try again or consult the game log.`);
        }
        draftState = structuredCloneGameState(baseStateSnapshot);
        draftState.lastActionLog = `Your action ("${action}") caused a ripple in reality, but the outcome is obscured.`;
        draftState.actionOptions = [
          'Look around.',
          'Ponder the situation.',
          'Check your inventory.',
          'Try to move on.',
          'Consider your objective.',
          'Plan your next steps.'
        ];
        draftState.dialogueState = null;
        draftState.lastDebugPacket = { ...debugPacket, error: e instanceof Error ? e.message : String(e) };
      } finally {
        if (!encounteredError) {
          draftState.turnsSinceLastShift += 1;
          draftState.globalTurnNumber += 1;
          await runDistillIfNeeded(draftState);
        }
        commitGameState(draftState);
        setIsLoading(false);
        setLoadingReason(null);

        if (!draftState.isCustomGameMode && !draftState.dialogueState) {
          const stabilityThreshold = currentThemeObj.name === draftState.pendingNewThemeNameAfterShift ? 0 : stabilityLevelProp;
          if (draftState.turnsSinceLastShift > stabilityThreshold && Math.random() * 100 < chaosLevelProp) {
            setError('CHAOS SHIFT! Reality fractures without warning!');
            triggerRealityShift(true);
          }
        }
      }
    }, [
      getCurrentGameState,
      commitGameState,
      isLoading,
      playerGenderProp,
      stabilityLevelProp,
      chaosLevelProp,
      triggerRealityShift,
      setIsLoading,
      setLoadingReason,
      setError,
      setParseErrorCounter,
      setFreeFormActionText,
      processAiResponse,
      runDistillIfNeeded,
    ]);

  /**
   * Handles a player's menu selection or special shift action.
   * @param action - The action string chosen by the player.
   */
  const handleActionSelect = useCallback(
    (action: string) => {
      const currentFullState = getCurrentGameState();
      let finalAction = action;

      const highlightMatcher = buildHighlightRegex(
        currentFullState.inventory.map(item => ({
          name: item.name,
          type: 'item',
          description: item.description,
          item,
        }))
      );

      if (highlightMatcher) {
        const { regex, lookup } = highlightMatcher;
        const matchedBooks = new Set<Item>();
        let match;
        while ((match = regex.exec(action)) !== null) {
          const info = lookup.get(match[0].toLowerCase());
          const matchedItem = info?.entityData.item;
          if (matchedItem && (matchedItem.type === 'book' || matchedItem.type === 'page')) {
            matchedBooks.add(matchedItem);
          }
        }

        for (const item of matchedBooks) {
          const showActual = item.tags?.includes('recovered');
          const contents = (item.chapters ?? [])
            .map(ch => `${ch.heading}\n${showActual ? ch.actualContent ?? '' : ch.visibleContent ?? ''}`)
            .join('\n\n');
          finalAction += `\nThe contents of the ${item.name} follow:\n${contents}`;
        }
      }

      if (action === 'Try to force your way back to the previous reality.') {
        const previousThemeName = Object.keys(currentFullState.themeHistory).pop();
        if (previousThemeName) {
          const statePreparedForShift = {
            ...currentFullState,
            pendingNewThemeNameAfterShift: previousThemeName,
          } as FullGameState;
          setGameStateStack((prev) => [statePreparedForShift, prev[1]]);

          if (currentFullState.isCustomGameMode) {
            executeManualRealityShift();
          } else {
            triggerRealityShift();
          }
        } else {
          setError('No previous reality to return to.');
        }
      } else {
        void executePlayerAction(finalAction);
      }
    }, [getCurrentGameState, executePlayerAction, triggerRealityShift, setError, setGameStateStack, executeManualRealityShift]);

  /**
   * Triggers an action based on the player's interaction with an item.
   */
  const handleItemInteraction = useCallback(
    (
      item: Item,
      interactionType: 'generic' | 'specific' | 'inspect',
      knownUse?: KnownUse,
      stateOverride?: FullGameState,
    ) => {
      if (interactionType === 'inspect') {
        const updatedState = recordInspect(item.id, stateOverride);

        if (item.type === 'book' || item.type === 'page') {
          const showActual = item.tags?.includes('recovered');
          const contents = (item.chapters ?? [])
            .map(
              ch =>
                `${ch.heading}\n${showActual ? ch.actualContent ?? '' : ch.visibleContent ?? ''}\n\n`,
            )
            .join('');

          void executePlayerAction(
            `Player reads the ${item.name} - ${item.description}. Here's what the player reads:\n${contents}`,
            false,
            updatedState,
          );
        } else {
          void executePlayerAction(
            `Player investigates the ${item.name} - ${item.description}.`,
            false,
            updatedState,
          );
        }
      } else if (interactionType === 'specific' && knownUse) {
        void executePlayerAction(knownUse.promptEffect);
      } else if (interactionType === 'generic') {
        void executePlayerAction(`Attempt to use: ${item.name}`);
      }
    },
    [executePlayerAction, recordInspect]
  );


  /**
   * Executes the player's typed free-form action if allowed.
   */
  const handleFreeFormActionSubmit = useCallback(() => {
    const currentFullState = getCurrentGameState();
    if (
      freeFormActionText.trim() &&
      currentFullState.score >= FREE_FORM_ACTION_COST &&
      !isLoading &&
      hasGameBeenInitialized &&
      !currentFullState.dialogueState
    ) {
      void executePlayerAction(freeFormActionText.trim(), true);
    }
  }, [freeFormActionText, getCurrentGameState, isLoading, hasGameBeenInitialized, executePlayerAction]);

  /**
   * Restores the previous turn's game state if available.
   */
  const handleUndoTurn = useCallback(() => {
    setGameStateStack((prevStack) => {
      const [current, previous] = prevStack;
      if (previous && current.globalTurnNumber > 0) {
        clearObjectiveAnimationTimer();
        return [previous, current];
      }
      return prevStack;
    });
  }, [setGameStateStack, clearObjectiveAnimationTimer]);

  return {
    processAiResponse,
    executePlayerAction,
    handleActionSelect,
    handleItemInteraction,
    handleDropItem,
    handleTakeLocationItem,
    updateItemContent,
    addJournalEntry,
    addPlayerJournalEntry,
    updatePlayerJournalContent,
    handleStashToggle,
    recordPlayerJournalInspect,
    handleFreeFormActionSubmit,
    handleUndoTurn,
  };
};
