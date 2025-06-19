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
