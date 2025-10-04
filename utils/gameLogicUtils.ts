/**
 * @file gameLogicUtils.ts
 * @description Central exports for game logic utilities such as inventory and NPC helpers.
 */

export * from './inventoryUtils';
export * from './npcUtils';


/** Adds a log message to the list while enforcing a maximum length. */
export const addLogMessageToList = (
  currentLog: Array<string>,
  message: string,
  maxLogMessages: number,
): Array<string> => {
  const newLog = [...currentLog, message];
  return newLog.length > maxLogMessages
    ? newLog.slice(newLog.length - maxLogMessages)
    : newLog;
};

/** Removes the most recent log entry added by dropping an item. */
export const removeDroppedItemLog = (
  currentLog: Array<string>,
  itemName: string,
): Array<string> => {
  const prefix = `You left your ${itemName}`;
  for (let i = currentLog.length - 1; i >= 0; i -= 1) {
    if (currentLog[i].startsWith(prefix)) {
      const updated = [...currentLog.slice(0, i), ...currentLog.slice(i + 1)];
      return updated;
    }
  }
  return currentLog;
};

import { FullGameState, LoreFactChange, LoreFact } from '../types';

export const applyLoreFactChanges = (
  state: FullGameState,
  changes: Array<LoreFactChange>,
  currentTurn: number,
): void => {
  let nextId =
    state.loreFacts.length > 0 ? Math.max(...state.loreFacts.map(f => f.id)) + 1 : 1;
  for (const change of changes) {
    switch (change.action) {
      case 'add':
        if (change.text) {
          const newFact: LoreFact = {
            id: nextId++,
            text: change.text,
            entities: change.entities ?? [],
            createdTurn: change.createdTurn ?? currentTurn,
            tier: change.tier ?? 1,
          };
          state.loreFacts.push(newFact);
        }
        break;
      case 'change': {
        const idx = state.loreFacts.findIndex(f => f.id === change.id);
        if (idx >= 0) {
          const updated: LoreFact = {
            ...state.loreFacts[idx],
            text: change.text ?? state.loreFacts[idx].text,
            entities: change.entities ?? state.loreFacts[idx].entities,
            tier: change.tier ?? state.loreFacts[idx].tier,
          };
          state.loreFacts[idx] = updated;
        }
        break;
      }
      case 'delete': {
        const i = state.loreFacts.findIndex(f => f.id === change.id);
        if (i >= 0) state.loreFacts.splice(i, 1);
        break;
      }
      default:
        break;
    }
  }
};

export const updateEntityIdsInFacts = (
  facts: Array<LoreFact>,
  renameMap: Record<string, string>,
): void => {
  if (facts.length === 0 || Object.keys(renameMap).length === 0) return;
  facts.forEach(fact => {
    fact.entities = fact.entities.map(id => renameMap[id] ?? id);
  });
};
