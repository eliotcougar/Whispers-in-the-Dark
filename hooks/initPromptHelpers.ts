/**
 * @file initPromptHelpers.ts
 * @description Helper for constructing initial game prompts.
 */
import { AdventureTheme, NPC, MapData, ThemeMemory, Item } from '../types';
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
  npcsForTheme?: Array<NPC>;
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
    npcsForTheme,
  } = options;

  const inventoryForPrompt = inventory.filter(i => i.holderId === PLAYER_HOLDER_ID);

  let prompt = '';
  if (isTransitioningFromShift && themeMemory && mapDataForTheme && npcsForTheme) {
    prompt = buildReturnToThemePostShiftPrompt(
      theme,
      inventoryForPrompt,
      playerGender,
      themeMemory,
      mapDataForTheme,
      npcsForTheme,
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
