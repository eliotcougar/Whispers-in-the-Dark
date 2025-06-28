import { useCallback, useEffect, useRef } from 'react';
import {
  FullGameState,
  ItemChangeRecord,
  TurnChanges,
  Item,
  ItemTag,
  ItemChapter,
  LoremasterModeDebugInfo,
} from '../types';
import { PLAYER_HOLDER_ID, MAX_LOG_MESSAGES } from '../constants';
import { structuredCloneGameState } from '../utils/cloneUtils';
import { makeUniqueHeading } from '../utils/uniqueHeading';
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
          item.type === 'page' || item.type === 'book';

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
    (
      id: string,
      actual?: string,
      visible?: string,
      chapterIndex?: number,
      imageData?: string,
    ) => {
      const currentFullState = getStateRef.current();
      const draftState = structuredCloneGameState(currentFullState);
      draftState.inventory = draftState.inventory.map(item => {
        if (item.id !== id) return item;
        if (item.chapters) {
          const idx = typeof chapterIndex === 'number' ? chapterIndex : 0;
          const updatedChapters = item.chapters.map((ch, cIdx) => {
            if (cIdx !== idx) return ch;
            const updated = { ...ch };
            if (actual !== undefined) updated.actualContent = actual;
            if (visible !== undefined) updated.visibleContent = visible;
            if (imageData !== undefined) updated.imageData = imageData;
            return updated;
          });
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
        const newChapter = {
          ...chapter,
          heading: makeUniqueHeading(chapter.heading, item.chapters ?? []),
        };
        return {
          ...item,
          chapters: [...(item.chapters ?? []), newChapter],
          lastWriteTurn: currentFullState.globalTurnNumber,
        };
      });
      commitGameState(draftState);
    },
    [commitGameState]
  );

  const addPlayerJournalEntry = useCallback(
    (chapter: ItemChapter, debugInfo?: LoremasterModeDebugInfo | null) => {
      const currentFullState = getStateRef.current();
      const draftState = structuredCloneGameState(currentFullState);
      const newChapter = {
        ...chapter,
        heading: makeUniqueHeading(chapter.heading, draftState.playerJournal),
      };
      draftState.playerJournal = [...draftState.playerJournal, newChapter];
      draftState.lastJournalWriteTurn = currentFullState.globalTurnNumber;
      if (debugInfo) {
        draftState.lastDebugPacket ??= {
          prompt: '',
          rawResponseText: null,
          parsedResponse: null,
          timestamp: new Date().toISOString(),
          storytellerThoughts: null,
          mapUpdateDebugInfo: null,
          inventoryDebugInfo: null,
          loremasterDebugInfo: { collect: null, extract: null, integrate: null, distill: null, journal: null },
          dialogueDebugInfo: null,
        };
        if (draftState.lastDebugPacket.loremasterDebugInfo) {
          draftState.lastDebugPacket.loremasterDebugInfo.journal = debugInfo;
        }
      }
      commitGameState(draftState);
    },
    [commitGameState]
  );

  const updatePlayerJournalContent = useCallback(
    (actual: string, chapterIndex?: number) => {
      const currentFullState = getStateRef.current();
      const idx = typeof chapterIndex === 'number' ? chapterIndex : 0;
      if (idx < 0 || idx >= currentFullState.playerJournal.length) return;
      const draftState = structuredCloneGameState(currentFullState);
      draftState.playerJournal = draftState.playerJournal.map((ch, cIdx) =>
        cIdx === idx ? { ...ch, actualContent: actual } : ch
      );
      commitGameState(draftState);
    },
    [commitGameState]
  );

  const recordPlayerJournalInspect = useCallback(() => {
    const currentFullState = getStateRef.current();
    const draftState = structuredCloneGameState(currentFullState);
    draftState.lastJournalInspectTurn = currentFullState.globalTurnNumber;
    commitGameState(draftState);
    return draftState;
  }, [commitGameState]);

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
    (id: string, baseState?: FullGameState): FullGameState => {
      const currentFullState = baseState ?? getStateRef.current();
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
    recordPlayerJournalInspect,
    handleStashToggle,
  };
};

export type InventoryActions = ReturnType<typeof useInventoryActions>;
