
/**
 * @file SettingsDisplay.tsx
 * @description Screen for adjusting game and user settings.
 */
import { useCallback } from 'react';

import { ThemePackName } from '../../types';
import { ALL_THEME_PACK_NAMES_CONST } from '../../constants';
import CheckboxSelector from '../elements/CheckboxSelector';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';

interface SettingsDisplayProps {
  readonly isVisible: boolean;
  readonly onClose: () => void;
  readonly enabledThemePacks: Array<ThemePackName>;
  readonly onToggleThemePack: (packName: ThemePackName) => void;
}

/**
 * Screen for tweaking player and gameplay settings.
 */
function SettingsDisplay({
  isVisible,
  onClose,
  enabledThemePacks,
  onToggleThemePack,
}: SettingsDisplayProps) {

  /** Toggles a theme pack in the player's preferences. */
  const handleThemePackToggle = useCallback(
    (packName: ThemePackName) => {
      onToggleThemePack(packName);
    },
    [onToggleThemePack]
  );

  const handleThemeToggleWrapper = useCallback(
    (value: string) => {
      handleThemePackToggle(value as ThemePackName);
    },
    [handleThemePackToggle]
  );


  return (
    <div
      aria-labelledby="settings-title"
      aria-modal="true"
      className={`animated-frame ${isVisible ? 'open' : ''}`}
      role="dialog"
    >
      <div className="animated-frame-content">
        <Button
          ariaLabel="Close settings"
          icon={<Icon
            name="x"
            size={20}
          />}
          onClick={onClose}
          size="sm"
          variant="close"
        />

        <div className="settings-content-area">
          <h1
            className="text-3xl font-bold text-sky-300 mb-8 text-center"
            id="settings-title"
          >
            Game Settings
          </h1>
          

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-amber-400 mb-3 pb-1 border-b border-amber-600">
              Theme Pack Preferences
            </h2>

            <p className="settings-explanation mb-3">
              Select which genre packs to include when choosing a starting theme. At least one pack must be enabled. You can change this setting at any time.
            </p>

            <CheckboxSelector
              errorText={enabledThemePacks.length === 0 ? 'At least one theme pack must be enabled. Please select a pack to continue.' : undefined}
              onToggle={handleThemeToggleWrapper}
              options={ALL_THEME_PACK_NAMES_CONST}
              selected={enabledThemePacks}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsDisplay;
