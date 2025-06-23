/**
 * @file gameLogicUtils.ts
 * @description Central exports for game logic utilities such as inventory and character helpers.
 */

export * from './inventoryUtils';
export * from './characterUtils';

import { AdventureTheme } from '../types';

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

/**
 * Selects the name of the next theme for a reality shift.
 */
export const selectNextThemeName = (
  availableThemes: Array<AdventureTheme>,
  currentThemeName?: string | null,
): string | null => {
  if (availableThemes.length === 0) {
    return null;
  }
  const filteredThemes =
    currentThemeName && availableThemes.length > 1
      ? availableThemes.filter(theme => theme.name !== currentThemeName)
      : availableThemes;
  const themesToChooseFrom = filteredThemes.length > 0 ? filteredThemes : availableThemes;
  const randomIndex = Math.floor(Math.random() * themesToChooseFrom.length);
  return themesToChooseFrom[randomIndex].name;
};

import { FullGameState, ThemeFactChange, ThemeFact } from '../types';

export const applyThemeFactChanges = (
  state: FullGameState,
  changes: Array<ThemeFactChange>,
  currentTurn: number,
): void => {
  let nextId = state.themeFacts.length > 0 ? Math.max(...state.themeFacts.map(f => f.id)) + 1 : 1;
  for (const change of changes) {
    switch (change.action) {
      case 'add':
        if (change.fact && change.fact.text && change.fact.themeName) {
          const newFact: ThemeFact = {
            id: nextId++,
            text: change.fact.text,
            themeName: change.fact.themeName,
            createdTurn: change.fact.createdTurn ?? currentTurn,
            tier: change.fact.tier ?? 1,
          };
          state.themeFacts.push(newFact);
        }
        break;
      case 'change': {
        const idx = state.themeFacts.findIndex(f => f.id === change.id);
        if (idx >= 0 && change.fact) {
          state.themeFacts[idx] = {
            ...state.themeFacts[idx],
            ...change.fact,
          };
        }
        break;
      }
      case 'delete': {
        const i = state.themeFacts.findIndex(f => f.id === change.id);
        if (i >= 0) state.themeFacts.splice(i, 1);
        break;
      }
      default:
        break;
    }
  }
};
