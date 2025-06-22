import { useCallback, useEffect, useRef } from 'react';
import {
  FullGameState,
  ItemChangeRecord,
  TurnChanges,
  Item,
  ItemTag,
} from '../types';
import { PLAYER_HOLDER_ID, MAX_LOG_MESSAGES } from '../constants';
import { structuredCloneGameState } from '../utils/cloneUtils';
import { addLogMessageToList } from '../utils/gameLogicUtils';
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
      draftState.inventory = draftState.inventory.map((item) =>
        item.name === itemName && item.holderId === PLAYER_HOLDER_ID
          ? { ...item, holderId: currentLocationId }
          : item,
      );
      const itemChangeRecord: ItemChangeRecord = { type: 'loss', lostItem: { ...itemToDiscard } };
      const turnChangesForDiscard: TurnChanges = {
        itemChanges: [itemChangeRecord],
        characterChanges: [],
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
        characterChanges: [],
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
        if (typeof chapterIndex === 'number' && item.chapters) {
          const updatedChapters = item.chapters.map((ch, idx) =>
            idx === chapterIndex ? { ...ch, actualContent: actual, visibleContent: visible } : ch
          );
          return { ...item, chapters: updatedChapters };
        }
        return { ...item, actualContent: actual, visibleContent: visible };
      });
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

  return { handleDropItem, handleTakeLocationItem, updateItemContent, addTag };
};

export type InventoryActions = ReturnType<typeof useInventoryActions>;
