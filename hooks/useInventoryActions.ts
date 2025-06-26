import { useCallback, useEffect, useRef } from 'react';
import {
  FullGameState,
  ItemChangeRecord,
  TurnChanges,
  Item,
  ItemTag,
  ItemChapter,
} from '../types';
import { PLAYER_HOLDER_ID, MAX_LOG_MESSAGES } from '../constants';
import { structuredCloneGameState } from '../utils/cloneUtils';
import { addLogMessageToList, removeDroppedItemLog } from '../utils/gameLogicUtils';
import { getAdjacentNodeIds } from '../utils/mapGraphUtils';

export interface UseInventoryActionsProps {
  getCurrentGameState: () => FullGameState;
  commitGameState: (state: FullGameState) => void;
  isLoading: boolean;
}

export const useInventoryActions = ({
  getCurrentGameState,
  commitGameState,
  isLoading,
}: UseInventoryActionsProps) => {
  const getStateRef = useRef(getCurrentGameState);
  useEffect(() => {
    getStateRef.current = getCurrentGameState;
  }, [getCurrentGameState]);
  const handleDropItem = useCallback(
    (itemName: string, logMessageOverride?: string) => {
      const currentFullState = getCurrentGameState();
      if (isLoading || currentFullState.dialogueState) return;

      const itemToDiscard = currentFullState.inventory.find(
        (item) => item.name === itemName && item.holderId === PLAYER_HOLDER_ID,
      );
      if (!itemToDiscard) return;

      const draftState = structuredCloneGameState(currentFullState);
      const currentLocationId = currentFullState.currentMapNodeId ?? 'unknown';
      draftState.inventory = draftState.inventory.map(item => {
        if (item.name !== itemName || item.holderId !== PLAYER_HOLDER_ID) {
          return item;
        }

        const shouldResetStashed =
          item.type === 'page' || item.type === 'book' || item.type === 'journal';

        return {
          ...item,
          holderId: currentLocationId,
          ...(shouldResetStashed ? { stashed: false } : {}),
        };
      });
      const itemChangeRecord: ItemChangeRecord = { type: 'loss', lostItem: { ...itemToDiscard } };
      const turnChangesForDiscard: TurnChanges = {
        itemChanges: [itemChangeRecord],
        npcChanges: [],
        objectiveAchieved: false,
        objectiveTextChanged: false,
        mainQuestTextChanged: false,
        localTimeChanged: false,
        localEnvironmentChanged: false,
        localPlaceChanged: false,
        currentMapNodeIdChanged: false,
        scoreChangedBy: 0,
        mapDataChanged: false,
      };
      draftState.lastTurnChanges = turnChangesForDiscard;

      let logMessage = logMessageOverride;
      if (!logMessage) {
        const placeName =
          currentFullState.mapData.nodes.find((n) => n.id === currentLocationId)?.placeName ??
          currentFullState.localPlace ??
          'Unknown Place';
        if (itemToDiscard.type === 'vehicle' && !itemToDiscard.isActive) {
          logMessage = `You left your ${itemName} parked at ${placeName}.`;
        } else {
          logMessage = `You left your ${itemName} at ${placeName}.`;
        }
      }

      if (logMessage) {
        draftState.gameLog = addLogMessageToList(draftState.gameLog, logMessage, MAX_LOG_MESSAGES);
        draftState.lastActionLog = logMessage;
      }
      commitGameState(draftState);
    },
    [getCurrentGameState, commitGameState, isLoading],
  );

  const handleTakeLocationItem = useCallback(
    (itemName: string) => {
      const currentFullState = getCurrentGameState();
      if (isLoading || currentFullState.dialogueState) return;

      const currentLocationId = currentFullState.currentMapNodeId;
      if (!currentLocationId) return;

      const adjacentIds = getAdjacentNodeIds(currentFullState.mapData, currentLocationId);
      const itemToTake = currentFullState.inventory.find((item) => {
        if (item.name !== itemName) return false;
        if (item.holderId === currentLocationId) return true;
        return adjacentIds.includes(item.holderId);
      });
      if (!itemToTake) return;

      const draftState = structuredCloneGameState(currentFullState);
      draftState.inventory = draftState.inventory.map((item) =>
        item.name === itemName && item.holderId === itemToTake.holderId
          ? { ...item, holderId: PLAYER_HOLDER_ID }
          : item,
      );

      const itemChangeRecord: ItemChangeRecord = {
        type: 'gain',
        gainedItem: { ...itemToTake, holderId: PLAYER_HOLDER_ID },
      };
      const turnChangesForTake: TurnChanges = {
        itemChanges: [itemChangeRecord],
        npcChanges: [],
        objectiveAchieved: false,
        objectiveTextChanged: false,
        mainQuestTextChanged: false,
        localTimeChanged: false,
        localEnvironmentChanged: false,
        localPlaceChanged: false,
        currentMapNodeIdChanged: false,
        scoreChangedBy: 0,
        mapDataChanged: false,
      };
      draftState.lastTurnChanges = turnChangesForTake;

      draftState.gameLog = removeDroppedItemLog(draftState.gameLog, itemName);
      if (draftState.lastActionLog?.startsWith(`You left your ${itemName}`)) {
        draftState.lastActionLog = null;
      }
      commitGameState(draftState);
    },
    [getCurrentGameState, commitGameState, isLoading],
  );

  const updateItemContent = useCallback(
    (id: string, actual: string, visible: string, chapterIndex?: number) => {
      const currentFullState = getStateRef.current();
      const draftState = structuredCloneGameState(currentFullState);
      draftState.inventory = draftState.inventory.map(item => {
        if (item.id !== id) return item;
        if (item.chapters) {
          const idx = typeof chapterIndex === 'number' ? chapterIndex : 0;
          const updatedChapters = item.chapters.map((ch, cIdx) =>
            cIdx === idx ? { ...ch, actualContent: actual, visibleContent: visible } : ch
          );
          return { ...item, chapters: updatedChapters };
        }
        return item;
      });
      commitGameState(draftState);
    },
    [commitGameState]
  );

  const addJournalEntry = useCallback(
    (id: string, chapter: ItemChapter) => {
      const currentFullState = getStateRef.current();
      const draftState = structuredCloneGameState(currentFullState);
      draftState.inventory = draftState.inventory.map(item => {
        if (item.id !== id) return item;
        return {
          ...item,
          chapters: [...(item.chapters ?? []), chapter],
          lastWriteTurn: currentFullState.globalTurnNumber,
        };
      });
      commitGameState(draftState);
    },
    [commitGameState]
  );

  const addPlayerJournalEntry = useCallback(
    (chapter: ItemChapter) => {
      const currentFullState = getStateRef.current();
      const draftState = structuredCloneGameState(currentFullState);
      draftState.playerJournal = [...draftState.playerJournal, chapter];
      draftState.lastJournalWriteTurn = currentFullState.globalTurnNumber;
      commitGameState(draftState);
    },
    [commitGameState]
  );

  const updatePlayerJournalContent = useCallback(
    (actual: string, visible: string, chapterIndex?: number) => {
      const currentFullState = getStateRef.current();
      const idx = typeof chapterIndex === 'number' ? chapterIndex : 0;
      if (idx < 0 || idx >= currentFullState.playerJournal.length) return;
      const draftState = structuredCloneGameState(currentFullState);
      draftState.playerJournal = draftState.playerJournal.map((ch, cIdx) =>
        cIdx === idx ? { ...ch, actualContent: actual, visibleContent: visible } : ch
      );
      commitGameState(draftState);
    },
    [commitGameState]
  );

  const addTag = useCallback(
    (id: string, tag: ItemTag) => {
      const currentFullState = getStateRef.current();
      const draftState = structuredCloneGameState(currentFullState);
      const updatedInventory: Array<Item> = draftState.inventory.map(item => {
        if (item.id !== id) return item;
        const currentTags: Array<ItemTag> = item.tags ?? [];
        if (currentTags.includes(tag)) return item;
        return { ...item, tags: [...currentTags, tag] };
      });
      draftState.inventory = updatedInventory;
      commitGameState(draftState);
    },
    [commitGameState]
  );


  const handleStashToggle = useCallback(
    (name: string) => {
      const currentFullState = getCurrentGameState();
      if (isLoading || currentFullState.dialogueState) return;

      const draftState = structuredCloneGameState(currentFullState);
      draftState.inventory = draftState.inventory.map(item =>
        item.name === name && item.holderId === PLAYER_HOLDER_ID
          ? { ...item, stashed: !item.stashed }
          : item,
      );
      draftState.lastTurnChanges = currentFullState.lastTurnChanges;
      commitGameState(draftState);
    },
    [getCurrentGameState, commitGameState, isLoading],
  );


  const recordInspect = useCallback(
    (id: string): FullGameState => {
      const currentFullState = getStateRef.current();
      const draftState = structuredCloneGameState(currentFullState);
      draftState.inventory = draftState.inventory.map(item =>
        item.id === id
          ? { ...item, lastInspectTurn: currentFullState.globalTurnNumber }
          : item
      );
      commitGameState(draftState);
      return draftState;
    },
    [commitGameState]
  );

  return {
    handleDropItem,
    handleTakeLocationItem,
    updateItemContent,
    addJournalEntry,
    addPlayerJournalEntry,
    updatePlayerJournalContent,
    addTag,
    recordInspect,
    handleStashToggle,
  };
};

export type InventoryActions = ReturnType<typeof useInventoryActions>;
