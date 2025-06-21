
/**
 * @file CustomGameSetupScreen.tsx
 * @description Allows the Player to select starting themes.
 */
import { useCallback } from 'react';

import { AdventureTheme, ThemePackName } from '../../types';
import { THEME_PACKS } from '../../themes';
import Button from '../elements/Button';
import ThemeCard from '../elements/ThemeCard';
import { Icon } from '../elements/icons';

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
function CustomGameSetupScreen({
  isVisible,
  onClose,
  onThemeSelected,
  disabledThemeName = null,
  titleText = undefined,
  descriptionText = undefined,
}: CustomGameSetupScreenProps) {
  const handleThemeSelect = useCallback(
    (themeName: string) => () => { onThemeSelected(themeName); },
    [onThemeSelected]
  );

  if (!isVisible) {
    return null;
  }

  const groupedThemesByPack: Record<ThemePackName, Array<AdventureTheme>> = 
    Object.keys(THEME_PACKS).reduce((acc, packKey) => {
      const packName = packKey as ThemePackName;
      // Use THEME_PACKS directly to group themes by their pack.
      acc[packName] = THEME_PACKS[packName];
      return acc;
    }, {} as Record<ThemePackName, Array<AdventureTheme>>);

  const effectiveTitle = titleText ?? "Choose Your Adventure Theme";
  const effectiveDescription = descriptionText ??
    "Select a theme to start your custom game. In this mode, random reality shifts are disabled, allowing for a focused, single-theme experience. You can still manually trigger a reality shift if you wish to change themes later.";


  return (
    <div
      aria-labelledby="custom-game-setup-title"
      aria-modal="true"
      className="animated-frame open"
      role="dialog"
    >
      <div className="animated-frame-content">
        <Button
          ariaLabel="Close theme selection"
          icon={<Icon
            name="x"
            size={20}
          />}
          onClick={onClose}
          size="sm"
          variant="close"
        />

        <div className="flex flex-col items-center w-full h-full p-2">
          <h1
            className="text-3xl font-bold text-sky-300 mb-4 text-center"
            id="custom-game-setup-title"
          >
            {effectiveTitle}
          </h1>

          <p className="text-slate-300 mb-6 text-center text-sm max-w-2xl">
            {effectiveDescription}
          </p>
          
          {Object.keys(groupedThemesByPack).length === 0 ? (
            <p className="text-slate-300 italic">
              No themes available. Please check configuration.
            </p>
          ) : (
            <div className="overflow-y-auto flex-grow w-full max-w-5xl px-6">
              {Object.entries(groupedThemesByPack).map(([packName, themesInPack]) => (
                themesInPack.length > 0 && (
                  <section
                    className="mb-8"
                    key={packName}
                  >
                    <h2 className="text-2xl font-semibold text-purple-400 mb-3 pb-1 border-b border-purple-600">
                      {packName}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                      {themesInPack.map(theme => {
                        const isDisabled = theme.name === disabledThemeName;
                        return (
                          <ThemeCard
                            disabled={isDisabled}
                            key={theme.name}
                            onSelect={handleThemeSelect(theme.name)}
                            theme={theme}
                          />
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
}

CustomGameSetupScreen.defaultProps = {
  descriptionText: undefined,
  disabledThemeName: null,
  titleText: undefined,
};

export default CustomGameSetupScreen;
