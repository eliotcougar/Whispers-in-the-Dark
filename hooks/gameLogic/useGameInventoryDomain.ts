import { useCallback, useMemo, useState } from 'react';
import type { FullGameState, Item, KnownUse } from '../../types';
import {
  ACTION_POINTS_PER_TURN,
  GENERIC_USE_ACTION_COST,
  KNOWN_USE_ACTION_COST,
  INSPECT_ACTION_COST,
  PLAYER_HOLDER_ID,
  WRITTEN_ITEM_TYPES,
} from '../../constants';
import { getAdjacentNodeIds } from '../../utils/mapGraphUtils';

export interface QueuedItemAction {
  readonly id: string;
  readonly displayText: string;
  readonly promptText: string;
  readonly cost: number;
  readonly effect?: () => void;
}

interface UseGameInventoryDomainParams {
  readonly fullState: FullGameState;
  readonly executeItemInteraction: (
    item: Item,
    interactionType: 'generic' | 'specific' | 'inspect',
    knownUse?: KnownUse,
    stateOverride?: FullGameState,
  ) => void;
  readonly handleDropItem: (itemId: string) => void;
  readonly handleDiscardItem: (itemId: string) => void;
  readonly handleTakeLocationItem: (itemId: string) => void;
  readonly handleStashToggle: (itemId: string) => void;
  readonly updateItemContent: (
    id: string,
    actual?: string,
    visible?: string,
    chapterIndex?: number,
    imageData?: string,
  ) => void;
  readonly recordInspect: (itemId: string) => void;
}

interface InventoryHandlers {
  readonly executeItemInteraction: UseGameInventoryDomainParams['executeItemInteraction'];
  readonly handleDropItem: UseGameInventoryDomainParams['handleDropItem'];
  readonly handleDiscardItem: UseGameInventoryDomainParams['handleDiscardItem'];
  readonly handleTakeLocationItem: UseGameInventoryDomainParams['handleTakeLocationItem'];
  readonly handleStashToggle: UseGameInventoryDomainParams['handleStashToggle'];
  readonly updateItemContent: UseGameInventoryDomainParams['updateItemContent'];
}

interface InventoryQueue {
  readonly actions: Array<QueuedItemAction>;
  readonly enqueue: (
    item: Item,
    interactionType: 'generic' | 'specific' | 'inspect' | 'take' | 'drop' | 'discard',
    knownUse?: KnownUse,
  ) => void;
  readonly clear: () => void;
  readonly remainingActionPoints: number;
}

export interface GameInventoryDomain {
  readonly items: Array<Item>;
  readonly itemsHere: Array<Item>;
  readonly handlers: InventoryHandlers;
  readonly queue: InventoryQueue;
}

export const useGameInventoryDomain = ({
  fullState,
  executeItemInteraction,
  handleDropItem,
  handleDiscardItem,
  handleTakeLocationItem,
  handleStashToggle,
  updateItemContent,
  recordInspect,
}: UseGameInventoryDomainParams): GameInventoryDomain => {
  const [queuedItemActions, setQueuedItemActions] = useState<Array<QueuedItemAction>>([]);

  const playerInventory = useMemo(
    () => fullState.inventory.filter(item => item.holderId === PLAYER_HOLDER_ID),
    [fullState.inventory],
  );

  const itemsHere = useMemo(() => {
    const currentNodeId = fullState.currentMapNodeId;
    if (!currentNodeId) return [];
    const atCurrent = fullState.inventory.filter(item => item.holderId === currentNodeId);
    const adjacentIds = getAdjacentNodeIds(fullState.mapData, currentNodeId);
    const nearbyItems = fullState.inventory.filter(item => adjacentIds.includes(item.holderId));
    const combined = [...atCurrent];
    nearbyItems.forEach(item => {
      if (!combined.includes(item)) {
        combined.push(item);
      }
    });
    return combined;
  }, [fullState.currentMapNodeId, fullState.inventory, fullState.mapData]);

  const totalQueuedActionCost = useMemo(
    () => queuedItemActions.reduce((sum, action) => sum + action.cost, 0),
    [queuedItemActions],
  );
  const remainingActionPoints = ACTION_POINTS_PER_TURN - totalQueuedActionCost;

  const toggleQueuedAction = useCallback(
    (action: QueuedItemAction) => {
      setQueuedItemActions(prev => {
        const exists = prev.some(a => a.id === action.id);
        return exists ? prev.filter(a => a.id !== action.id) : [...prev, action];
      });
    },
    [],
  );

  const clearQueuedItemActions = useCallback(() => {
    setQueuedItemActions([]);
  }, []);

  const queueItemAction = useCallback(
    (
      item: Item,
      interactionType: 'generic' | 'specific' | 'inspect' | 'take' | 'drop' | 'discard',
      knownUse?: KnownUse,
    ) => {
      if (interactionType === 'take') {
        handleTakeLocationItem(item.id);
        return;
      }
      if (interactionType === 'drop') {
        handleDropItem(item.id);
        return;
      }
      if (interactionType === 'discard') {
        handleDiscardItem(item.id);
        return;
      }

      let id = '';
      let displayText = '';
      let promptText = '';
      let effect: (() => void) | undefined;
      let cost = 0;

      switch (interactionType) {
        case 'inspect': {
          id = `${item.id}-inspect`;
          displayText = `Inspect the ${item.name}`;
          effect = () => {
            recordInspect(item.id);
          };
          cost = INSPECT_ACTION_COST;
          if (WRITTEN_ITEM_TYPES.includes(item.type as (typeof WRITTEN_ITEM_TYPES)[number])) {
            const showActual = item.tags?.includes('recovered');
            const contents = (item.chapters ?? [])
              .map(ch => `${ch.heading}\n${showActual ? ch.actualContent ?? '' : ch.visibleContent ?? ''}`)
              .join('\n\n');
            promptText = `Player reads the ${item.name} - ${item.description}. Here's what the player reads:\n${contents}`;
          } else {
            promptText = `Player investigates the ${item.name} - ${item.description}.`;
          }
          break;
        }
        case 'generic':
          id = `${item.id}-generic`;
          displayText = `Attempt to use the ${item.name}`;
          promptText = `Attempt to use: ${item.name}`;
          cost = GENERIC_USE_ACTION_COST;
          break;
        case 'specific':
          if (knownUse) {
            id = `${item.id}-specific-${knownUse.actionName}`;
            displayText = knownUse.actionName;
            promptText = knownUse.promptEffect;
            cost = KNOWN_USE_ACTION_COST;
          }
          break;
        default:
          break;
      }

      if (id && displayText && promptText) {
        const isQueued = queuedItemActions.some(action => action.id === id);
        if (!isQueued && cost > remainingActionPoints) return;
        toggleQueuedAction({ id, displayText, promptText, cost, effect });
      }
    },
    [
      handleDiscardItem,
      handleDropItem,
      handleTakeLocationItem,
      queuedItemActions,
      recordInspect,
      remainingActionPoints,
      toggleQueuedAction,
    ],
  );

  return {
    items: playerInventory,
    itemsHere,
    handlers: {
      executeItemInteraction,
      handleDropItem,
      handleDiscardItem,
      handleTakeLocationItem,
      handleStashToggle,
      updateItemContent,
    },
    queue: {
      actions: queuedItemActions,
      enqueue: queueItemAction,
      clear: clearQueuedItemActions,
      remainingActionPoints,
    },
  };
};

