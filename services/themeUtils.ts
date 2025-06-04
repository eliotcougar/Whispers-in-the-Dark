/**
 * @file services/themeUtils.ts
 * @description Helper functions related to theme lookups.
 */

import { AdventureTheme, ThemePackName } from '../types';
import { THEME_PACKS } from '../themes';

/**
 * Finds and returns the AdventureTheme object for a given theme name.
 * @param themeName Name of the theme to search for.
 */
export const findThemeByName = (themeName: string | null): AdventureTheme | null => {
  if (!themeName) return null;
  for (const packKey in THEME_PACKS) {
    const pack = THEME_PACKS[packKey as ThemePackName];
    const foundTheme = pack.find(theme => theme.name === themeName);
    if (foundTheme) {
      return foundTheme;
    }
  }
  return null;
};
