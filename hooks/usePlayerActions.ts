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
  TurnChanges,
  StoryAct,
} from '../types';
import {
  executeAIMainTurn,
  parseAIResponse,
  buildMainGameTurnPrompt
} from '../services/storyteller';
import { buildSystemInstructionWithDebug } from '../services/storyteller/systemPrompt';
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
  ACT_COMPLETION_SCORE,
} from '../constants';

import { structuredCloneGameState } from '../utils/cloneUtils';
import { resetInspectCooldowns } from '../utils/undoUtils';
import { generateNextStoryAct } from '../services/worldData';
import { useProcessAiResponse } from './useProcessAiResponse';
import { useInventoryActions } from './useInventoryActions';
import { distillFacts_Service } from '../services/loremaster';
import { applyThemeFactChanges } from '../utils/gameLogicUtils';
import { isStoryArcValid } from '../utils/storyArcUtils';

export interface UsePlayerActionsProps {
  getCurrentGameState: () => FullGameState;
  commitGameState: (state: FullGameState) => void;
  setGameStateStack: React.Dispatch<React.SetStateAction<GameStateStack>>;
  setIsLoading: (val: boolean) => void;
  setIsTurnProcessing: (val: boolean) => void;
  setLoadingReason: (reason: LoadingReason | null) => void;
  loadingReasonRef: React.RefObject<LoadingReason | null>;
  setError: (err: string | null) => void;
  setParseErrorCounter: (val: number) => void;
  freeFormActionText: string;
  setFreeFormActionText: (text: string) => void;
  isLoading: boolean;
  isTurnProcessing: boolean;
  hasGameBeenInitialized: boolean;
  debugLore: boolean;
  openDebugLoreModal: (
    facts: Array<string>,
    resolve: (good: Array<string>, bad: Array<string>, proceed: boolean) => void,
  ) => void;
  actIntroRef: React.RefObject<StoryAct | null>;
  onActIntro: (act: StoryAct) => void;
}

/**
 * Provides helpers for executing player actions and processing AI responses.
 */
export const usePlayerActions = (props: UsePlayerActionsProps) => {
  const {
    getCurrentGameState,
    commitGameState,
    setGameStateStack,
    setIsLoading,
    setIsTurnProcessing,
    setLoadingReason,
    setError,
    setParseErrorCounter,
    freeFormActionText,
    setFreeFormActionText,
    isLoading,
    isTurnProcessing,
    hasGameBeenInitialized,
    loadingReasonRef,
    debugLore,
    openDebugLoreModal,
    actIntroRef,
    onActIntro,
  } = props;

  const { processAiResponse, clearObjectiveAnimationTimer } = useProcessAiResponse({
    loadingReasonRef,
    setLoadingReason,
    setError,
    setGameStateStack,
    debugLore,
    openDebugLoreModal,
    actIntroRef,
    onActIntro,
  });

  const {
    handleDropItem,
    handleDiscardItem,
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
    isLoading: isLoading || isTurnProcessing,
  });

  const runDistillIfNeeded = useCallback(
    async (state: FullGameState) => {
      if (
        state.globalTurnNumber > 0 &&
        state.globalTurnNumber % DISTILL_LORE_INTERVAL === 0 &&
        state.lastLoreDistillTurn !== state.globalTurnNumber
      ) {
        const currentThemeNodes = state.mapData.nodes;
        const inventoryItemNames = Array.from(
          new Set(
            state.inventory
              .filter(item => {
                if (item.holderId === PLAYER_HOLDER_ID) return true;
                if (currentThemeNodes.some(node => node.id === item.holderId)) return true;
                const holderNpc = state.allNPCs.find(
                  npc => npc.id === item.holderId,
                );
                return Boolean(holderNpc);
              })
              .map(item => item.name),
          ),
        );
        const mapNodeNames = currentThemeNodes.map(n => n.placeName);
        const recentLogs = state.gameLog.slice(-RECENT_LOG_COUNT_FOR_DISTILL);
        setLoadingReason('loremaster_distill');
        const actIndex = state.storyArc.currentAct - 1;
        const acts = state.storyArc.acts;
        const act = actIndex >= 0 && actIndex < acts.length ? acts[actIndex] : null;
        const result = await distillFacts_Service({
          themeName: state.currentTheme.name,
          facts: state.themeFacts,
          currentQuest: act ? act.mainObjective : null,
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
      debugToolDirective?: string,
    ) => {
      const currentFullState = overrideState ?? getCurrentGameState();
      if (isLoading || isTurnProcessing || currentFullState.dialogueState) return;

      setIsLoading(true);
      setIsTurnProcessing(false);
      setError(null);
      setParseErrorCounter(0);
      setFreeFormActionText('');

      const baseStateSnapshot = structuredCloneGameState(currentFullState);
      const scoreChangeFromAction = isFreeForm ? -FREE_FORM_ACTION_COST : 0;

      const currentThemeObj = currentFullState.currentTheme;

      const recentLogs = currentFullState.gameLog.slice(-RECENT_LOG_COUNT_FOR_PROMPT);
      const currentThemeMainMapNodes = currentFullState.mapData.nodes.filter(
        n => n.data.nodeType !== 'feature' && n.data.nodeType !== 'room'
      );
      const currentThemeNPCs = currentFullState.allNPCs;
      const currentMapNodeDetails = currentFullState.currentMapNodeId
        ? currentFullState.mapData.nodes.find((n) => n.id === currentFullState.currentMapNodeId) ?? null
        : null;

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

      // Enter Loremaster collection stage in FSM before storyteller call
      {
        const beforeCollect = structuredCloneGameState(currentFullState);
        beforeCollect.turnState = 'loremaster_collect';
        commitGameState(beforeCollect);
      }
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

      const debugDirective = debugToolDirective?.trim() ?? '';
      const prompt = buildMainGameTurnPrompt(
        currentFullState.currentScene,
        action,
        currentFullState.inventory,
        currentFullState.currentMapNodeId ?? null,
        isStoryArcValid(currentFullState.storyArc)
          ? currentFullState.storyArc.acts[currentFullState.storyArc.currentAct - 1]?.mainObjective ?? null
          : null,
        currentFullState.currentObjective,
        currentThemeObj,
        recentLogs,
        currentThemeMainMapNodes,
        currentThemeNPCs,
        relevantFacts,
        currentFullState.localTime,
        currentFullState.localEnvironment,
        currentFullState.localPlace,
        currentFullState.worldFacts,
        currentFullState.heroSheet,
        currentMapNodeDetails,
        currentFullState.mapData,
        currentFullState.destinationNodeId,
        currentFullState.storyArc,
        debugDirective ? debugDirective : undefined
      );

      const systemInstructionForTurn = buildSystemInstructionWithDebug(debugDirective);

      let draftState = structuredCloneGameState(currentFullState);
      draftState.turnState = 'player_action_prompt';
      const debugPacket = {
        prompt,
        systemInstruction: systemInstructionForTurn,
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
        draftState.turnState = 'storyteller';
        const {
          response,
          thoughts,
          systemInstructionUsed,
          jsonSchemaUsed,
          promptUsed,
        } = await executeAIMainTurn(prompt, { systemInstructionOverride: systemInstructionForTurn });
        draftState.lastDebugPacket = {
          ...draftState.lastDebugPacket,
          rawResponseText: response.text ?? null,
          storytellerThoughts: thoughts,
          systemInstruction: systemInstructionUsed,
          jsonSchema: jsonSchemaUsed,
          prompt: promptUsed,
        };

        const currentThemeMapDataForParse = draftState.mapData;

        const parsedData = await parseAIResponse(
          response.text ?? '',
          currentThemeObj,
          draftState.heroSheet,
          () => { setParseErrorCounter(1); },
          currentFullState.lastActionLog || undefined,
          currentFullState.currentScene,
          currentThemeNPCs,
          currentThemeMapDataForParse,
          currentFullState.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID)
        );

        await processAiResponse(parsedData, currentThemeObj, draftState, {
          baseStateSnapshot,
          onBeforeRefine: state => {
            commitGameState(state);
          },
          playerActionText: action,
          scoreChangeFromAction,
          setIsLoading,
          setIsTurnProcessing,
        });
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
          draftState.globalTurnNumber += 1;
          await runDistillIfNeeded(draftState);
          draftState.turnState = 'awaiting_input';
        } else {
          draftState.turnState = 'error';
        }
        commitGameState(draftState);
        setIsTurnProcessing(false);
        setIsLoading(false);
        setLoadingReason(null);
      }
    }, [
      getCurrentGameState,
      commitGameState,
      isLoading,
      isTurnProcessing,
      setIsLoading,
      setIsTurnProcessing,
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
    (action: string, stateOverride?: FullGameState): Promise<void> => {
      const currentFullState = stateOverride ?? getCurrentGameState();
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
          const alreadyIncluded =
            finalAction.includes(`Player reads the ${item.name}`) ||
            finalAction.includes(`The contents of the ${item.name} follow:`);
          if (!alreadyIncluded) {
            const showActual = item.tags?.includes('recovered');
            const contents = (item.chapters ?? [])
              .map(ch => `${ch.heading}\n${showActual ? ch.actualContent ?? '' : ch.visibleContent ?? ''}`)
              .join('\n\n');
            finalAction += `\nThe contents of the ${item.name} follow:\n${contents}`;
          }
        }
      }

      return executePlayerAction(finalAction, false, currentFullState);
    }, [getCurrentGameState, executePlayerAction]);

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
      !isTurnProcessing &&
      hasGameBeenInitialized &&
      !currentFullState.dialogueState
    ) {
      void executePlayerAction(freeFormActionText.trim(), true);
    }
  }, [
    freeFormActionText,
    getCurrentGameState,
    isLoading,
    isTurnProcessing,
    hasGameBeenInitialized,
    executePlayerAction,
  ]);

  /**
   * Restores the previous turn's game state if available.
   */
  const handleUndoTurn = useCallback(() => {
    setGameStateStack(prevStack => {
      const [current, previous] = prevStack;
      if (previous && current.globalTurnNumber > 0) {
        clearObjectiveAnimationTimer();
        const cleanedPrev = resetInspectCooldowns(previous);
        return [cleanedPrev, current];
      }
      return prevStack;
    });
  }, [setGameStateStack, clearObjectiveAnimationTimer]);

  /**
   * Forces the main quest completion procedure without AI involvement.
   */
  const triggerMainQuestAchieved = useCallback(async (
    stateOverride?: FullGameState,
  ): Promise<FullGameState | null> => {
    const currentState = stateOverride ?? getCurrentGameState();
    const {
      currentTheme,
      storyArc,
      worldFacts,
      heroSheet,
    } = currentState;

    if (!isStoryArcValid(storyArc)) {
      console.error('triggerMainQuestAchieved: invalid story arc detected.');
      return null;
    }

    const draftState = structuredCloneGameState(currentState);
    draftState.turnState = 'act_transition';
    const newAct = await generateNextStoryAct(
      currentTheme,
      worldFacts,
      heroSheet,
      storyArc,
      draftState.gameLog,
      draftState.currentScene,
    );

    const turnChanges: TurnChanges = {
      itemChanges: [],
      npcChanges: [],
      objectiveAchieved: false,
      mainQuestAchieved: true,
      objectiveTextChanged: false,
      mainQuestTextChanged: false,
      localTimeChanged: false,
      localEnvironmentChanged: false,
      localPlaceChanged: false,
      currentMapNodeIdChanged: false,
      scoreChangedBy: 0,
      mapDataChanged: false,
    };

    const arc = draftState.storyArc;
    arc.acts[arc.currentAct - 1].completed = true;

    draftState.score += ACT_COMPLETION_SCORE;
    turnChanges.scoreChangedBy += ACT_COMPLETION_SCORE;

    if (newAct) {
      arc.acts.push(newAct);
      arc.currentAct = newAct.actNumber;
      turnChanges.mainQuestAchieved = false;
      actIntroRef.current = newAct;
    } else {
      draftState.isVictory = true;
      turnChanges.mainQuestAchieved = false;
    }

    draftState.globalTurnNumber += 1;
    draftState.lastTurnChanges = turnChanges;
    commitGameState(draftState);

    // Do not auto-trigger a new scene when switching acts.
    // We only display the New Act modal while Loremaster refines in the background.

    return draftState;
  }, [getCurrentGameState, commitGameState, actIntroRef]);

  /**
   * Sequentially completes all remaining acts to reach victory.
   */
  const simulateVictory = useCallback(async () => {
    let state: FullGameState | null = getCurrentGameState();
    let guard = 0;
    while (state && !state.isVictory && guard < 10) {
      state = await triggerMainQuestAchieved(state);
      guard += 1;
    }
  }, [getCurrentGameState, triggerMainQuestAchieved]);

  const spawnItemForPlayer = useCallback(
    (
      itemType: Item['type'],
      itemLabel: string,
      extraInstructions: string,
    ) => {
      if (isLoading || isTurnProcessing || !hasGameBeenInitialized) return;
      const currentFullState = getCurrentGameState();
      if (currentFullState.dialogueState) return;

      const debugDirective = `Spawn exactly one ${itemLabel} directly into the player's inventory this turn.\n- Include the full item in "newItems" with type "${itemType}" and holderId "${PLAYER_HOLDER_ID}".\n- Provide a vivid description and all required fields for this type.\n- Summarize the gain in "playerItemsHint" so downstream systems pick it up.\n${extraInstructions}\n- Avoid unrelated story or world changes.`;

      void executePlayerAction('[DEBUG TOOL INVOCATION]', false, currentFullState, debugDirective);
    },
    [
      executePlayerAction,
      getCurrentGameState,
      hasGameBeenInitialized,
      isLoading,
      isTurnProcessing,
    ],
  );

  const spawnNpcAtPlayerLocation = useCallback(() => {
    if (isLoading || isTurnProcessing || !hasGameBeenInitialized) return;
    const currentFullState = getCurrentGameState();
    if (currentFullState.dialogueState) return;

    const shouldBeCompanion = Math.random() < 0.3;
    const presenceStatus = shouldBeCompanion ? 'companion' : 'nearby';
    const debugDirective = `Spawn a single new NPC directly at the player's current location.\n- presenceStatus must be "${presenceStatus}" with a fitting preciseLocation.\n- Provide a concise description, attitudeTowardPlayer, and at least one knownPlayerName when sensible.\n- Update newItems only if the NPC brings items, otherwise avoid unrelated world changes.\n- Do NOT initiate dialogue, simply add the NPC to the state.`;

    void executePlayerAction('[DEBUG TOOL INVOCATION]', false, currentFullState, debugDirective);
  }, [
    executePlayerAction,
    getCurrentGameState,
    hasGameBeenInitialized,
    isLoading,
    isTurnProcessing,
  ]);

  const spawnBookForPlayer = useCallback(() => {
    spawnItemForPlayer(
      'book',
      'book of written lore',
      '- Provide between 2 and 4 concise chapters in "chapters" so the Librarian can parse it.\n- Mention the new book in "librarianHint" as well.',
    );
  }, [spawnItemForPlayer]);

  const spawnMapForPlayer = useCallback(() => {
    spawnItemForPlayer(
      'map',
      'map with useful annotations',
      '- Supply exactly one chapter entry describing the map contents.\n- Mention the new map in "librarianHint".',
    );
  }, [spawnItemForPlayer]);

  const spawnPictureForPlayer = useCallback(() => {
    spawnItemForPlayer(
      'picture',
      'illustrated picture or photograph',
      '- Include a single chapter entry describing what the picture shows.\n- Mention the new picture in "librarianHint".',
    );
  }, [spawnItemForPlayer]);

  const spawnPageForPlayer = useCallback(() => {
    spawnItemForPlayer(
      'page',
      'loose written page',
      '- Include exactly one chapter entry capturing the page contents.\n- Mention the new page in "librarianHint".',
    );
  }, [spawnItemForPlayer]);

  const spawnVehicleForPlayer = useCallback(() => {
    spawnItemForPlayer(
      'vehicle',
      'vehicle the player can operate',
      '- Specify whether it is active via the "isActive" flag and list any knownUses that make sense.',
    );
  }, [spawnItemForPlayer]);

  return {
    processAiResponse,
    executePlayerAction,
    handleActionSelect,
    handleItemInteraction,
    handleDropItem,
    handleDiscardItem,
    handleTakeLocationItem,
    updateItemContent,
    addJournalEntry,
    addPlayerJournalEntry,
    updatePlayerJournalContent,
    handleStashToggle,
    recordPlayerJournalInspect,
    recordInspect,
    handleFreeFormActionSubmit,
    handleUndoTurn,
    triggerMainQuestAchieved,
    simulateVictory,
    spawnBookForPlayer,
    spawnMapForPlayer,
    spawnPictureForPlayer,
    spawnPageForPlayer,
    spawnVehicleForPlayer,
    spawnNpcAtPlayerLocation,
  };
};
