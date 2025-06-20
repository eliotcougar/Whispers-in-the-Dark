/**
 * @file initPromptHelpers.ts
 * @description Helper for constructing initial game prompts.
 */
import { AdventureTheme, Character, MapData, ThemeMemory, Item } from '../types';
import { PLAYER_HOLDER_ID } from '../constants';
import {
  buildNewGameFirstTurnPrompt,
  buildNewThemePostShiftPrompt,
  buildReturnToThemePostShiftPrompt,
} from '../services/storyteller';

export interface BuildInitialGamePromptOptions {
  theme: AdventureTheme;
  inventory: Array<Item>;
  playerGender: string;
  isTransitioningFromShift: boolean;
  themeMemory?: ThemeMemory;
  mapDataForTheme?: MapData;
  charactersForTheme?: Array<Character>;
}

/**
 * Build the storyteller prompt used when starting or resuming a theme.
 */
export const buildInitialGamePrompt = (
  options: BuildInitialGamePromptOptions,
): string => {
  const {
    theme,
    inventory,
    playerGender,
    isTransitioningFromShift,
    themeMemory,
    mapDataForTheme,
    charactersForTheme,
  } = options;

  const inventoryForPrompt = inventory.filter(i => i.holderId === PLAYER_HOLDER_ID);

  let prompt = '';
  if (isTransitioningFromShift && themeMemory && mapDataForTheme && charactersForTheme) {
    prompt = buildReturnToThemePostShiftPrompt(
      theme,
      inventoryForPrompt,
      playerGender,
      themeMemory,
      mapDataForTheme,
      charactersForTheme,
    );
  } else if (isTransitioningFromShift) {
    prompt = buildNewThemePostShiftPrompt(
      theme,
      inventoryForPrompt,
      playerGender,
    );
  } else {
    prompt = buildNewGameFirstTurnPrompt(theme, playerGender);
  }
  return prompt;
};
