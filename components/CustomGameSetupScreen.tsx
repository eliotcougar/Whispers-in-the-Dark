
/**
 * @file CustomGameSetupScreen.tsx
 * @description Allows the Player to select starting themes.
 */
import { useCallback } from 'react';

import * as React from 'react';
import { AdventureTheme, ThemePackName } from '../types';
import { THEME_PACKS } from '../themes'; // To get pack names and structure

interface CustomGameSetupScreenProps {
  readonly isVisible: boolean;
  readonly onClose: () => void;
  readonly onThemeSelected: (themeName: string) => void;
  readonly disabledThemeName?: string | null; // Optional: Name of a theme to disable
  readonly titleText?: string; // Optional: Custom title for the screen
  readonly descriptionText?: string; // Optional: Custom description text
}

/**
 * Lets the player pick starting themes for a custom game.
 */
const CustomGameSetupScreen: React.FC<CustomGameSetupScreenProps> = ({
  isVisible,
  onClose,
  onThemeSelected,
  disabledThemeName,
  titleText,
  descriptionText,
}) => {
  const handleThemeSelect = useCallback(
    (themeName: string) => () => onThemeSelected(themeName),
    [onThemeSelected]
  );

  if (!isVisible) {
    return null;
  }

  const groupedThemesByPack: Record<ThemePackName, AdventureTheme[]> = 
    Object.keys(THEME_PACKS).reduce((acc, packKey) => {
      const packName = packKey as ThemePackName;
      // Use THEME_PACKS directly to group themes by their pack.
      acc[packName] = THEME_PACKS[packName];
      return acc;
    }, {} as Record<ThemePackName, AdventureTheme[]>);

  const effectiveTitle = titleText || "Choose Your Adventure Theme";
  const effectiveDescription = descriptionText || "Select a theme to start your custom game. In this mode, random reality shifts are disabled, allowing for a focused, single-theme experience. You can still manually trigger a reality shift if you wish to change themes later.";


  return (
    <div aria-labelledby="custom-game-setup-title" aria-modal="true" className={`animated-frame ${isVisible ? 'open' : ''}`} role="dialog">
      <div className="animated-frame-content">
        <button
          aria-label="Close theme selection"
          className="animated-frame-close-button"
          onClick={onClose}
        >
          &times;
        </button>

        <div className="flex flex-col items-center w-full h-full p-2">
          <h1 className="text-3xl font-bold text-sky-300 mb-4 text-center" id="custom-game-setup-title">
            {effectiveTitle}
          </h1>

          <p className="text-slate-400 mb-6 text-center text-sm max-w-2xl">
            {effectiveDescription}
          </p>
          
          {Object.keys(groupedThemesByPack).length === 0 ? (
            <p className="text-slate-400 italic">No themes available. Please check configuration.</p>
          ) : (
            <div className="overflow-y-auto flex-grow w-full max-w-5xl px-6">
              {Object.entries(groupedThemesByPack).map(([packName, themesInPack]) => (
                themesInPack.length > 0 && (
                  <section className="mb-8" key={packName}>
                    <h2 className="text-2xl font-semibold text-purple-400 mb-3 pb-1 border-b border-purple-600">
                      {packName}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                      {themesInPack.map(theme => {
                        const isDisabled = theme.name === disabledThemeName;
                        return (
                          <button
                            aria-label={`Start a new game in the theme: ${theme.name}${isDisabled ? ' (Current theme, cannot select)' : ''}`}
                            className={`p-3 bg-slate-700 hover:bg-slate-600/80 border border-slate-600 hover:border-sky-500 rounded-lg shadow-md 
                                       text-left text-slate-100 transition-all duration-150 ease-in-out transform hover:scale-[1.03] focus:ring-2 focus:ring-sky-400 focus:outline-none
                                       ${isDisabled ? 'opacity-50 cursor-not-allowed hover:bg-slate-700 hover:border-slate-600 hover:scale-100' : ''}`}
                            disabled={isDisabled}
                            key={theme.name}
                            onClick={handleThemeSelect(theme.name)}
                            style={{ minHeight: '180px' }}
                          >
                            <h3 className="text-xl font-semibold text-amber-400 mb-2">{theme.name}</h3>

                            <p className="text-sm text-slate-300 leading-snug line-clamp-8">
                              {theme.initialSceneDescriptionSeed}
                            </p>

                            {isDisabled ? <p className="text-xs text-orange-300 mt-1 italic">(Currently active theme)</p> : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomGameSetupScreen;
