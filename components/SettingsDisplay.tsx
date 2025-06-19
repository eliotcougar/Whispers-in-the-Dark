
/**
 * @file SettingsDisplay.tsx
 * @description Screen for adjusting game and user settings.
 */
import { useCallback } from 'react';

import { ThemePackName } from '../types';
import { ALL_THEME_PACK_NAMES_CONST } from '../constants';
import Slider from './elements/Slider';
import RadioSelector from './elements/RadioSelector';
import CheckboxSelector from './elements/CheckboxSelector';
import Button from './elements/Button';
import { Icon } from './elements/icons';

interface SettingsDisplayProps {
  readonly isVisible: boolean;
  readonly onClose: () => void;
  readonly stabilityLevel: number;
  readonly chaosLevel: number;
  readonly onStabilityChange: (value: number) => void;
  readonly onChaosChange: (value: number) => void;
  readonly enabledThemePacks: Array<ThemePackName>;
  readonly onToggleThemePack: (packName: ThemePackName) => void;
  readonly playerGender: string;
  readonly onPlayerGenderChange: (gender: string) => void;
  readonly isCustomGameMode: boolean;
}

/**
 * Screen for tweaking player and gameplay settings.
 */
function SettingsDisplay({
  isVisible,
  onClose,
  stabilityLevel,
  chaosLevel,
  onStabilityChange,
  onChaosChange,
  enabledThemePacks,
  onToggleThemePack,
  playerGender,
  onPlayerGenderChange,
  isCustomGameMode,
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
          className="animated-frame-close-button"
          icon={<Icon
            name="x"
            size={20}
                />}
          onClick={onClose}
          size="sm"
        />

        <div className="settings-content-area">
          <h1
            className="text-3xl font-bold text-sky-300 mb-8 text-center"
            id="settings-title"
          >
            Game Settings
          </h1>
          
          <div
            className="mb-8"
            id="reality-shift-controls"
          >
            {' '}

            {/* Removed conditional class from here */}
            <h2 className="text-xl font-semibold text-amber-400 mb-3 pb-1 border-b border-amber-600">
              Reality Shift Controls
            </h2>

            {isCustomGameMode ? <div className="p-3 mb-3 bg-indigo-800/70 border border-indigo-600 rounded-md text-indigo-200 text-sm">
              <p>
                Random Reality Shifts are disabled in Custom Game mode.
              </p>

              <p>
                You can still change these settings, and they will apply if you start a regular &quot;New Game&quot; from the Main Menu.
              </p>
            </div> : null}

            <Slider
              explanation="Number of turns after any reality shift before random chaos shifts can occur again. Higher values mean longer periods of stability (e.g., 0 = chaos can happen immediately, 10 = 10 turns of safety). Max 100."
              faded={isCustomGameMode}
              id="stabilitySlider"
              label="Stability"
              onChange={onStabilityChange}
              value={stabilityLevel}
            />

            <Slider
              explanation="Percentage chance (0-100%) of a random reality shift occurring each turn, *after* the 'Stability' period has passed. Higher values mean more frequent shifts."
              faded={isCustomGameMode}
              id="chaosSlider"
              label="Chaos"
              onChange={onChaosChange}
              suffix="%"
              value={chaosLevel}
            />

            {/* Disclaimer is NOT greyed out */}
            <p className="settings-disclaimer">
              {/* eslint-disable-next-line react/jsx-max-depth */}
              <strong>
                In the Beta
              </strong>

              {' '}

              , manual reality shift can be triggered at any time regardless of these settings.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-amber-400 mb-3 pb-1 border-b border-amber-600">
              Player Character Gender
            </h2>

            <p className="settings-explanation mb-3">
              Choose your character&apos;s gender. This may subtly influence descriptions and interactions in the game. Changing it in the middle of the game can have unexpected effects.
            </p>

            <RadioSelector
              addCustom
              name="playerGender"
              onChange={onPlayerGenderChange}
              options={['Male', 'Female']}
              placeholder="Enter custom gender (or leave blank for 'Not Specified')"
              value={playerGender}
            />
          </div>


          <div className="mb-6">
            <h2 className="text-xl font-semibold text-amber-400 mb-3 pb-1 border-b border-amber-600">
              Theme Pack Preferences
            </h2>

            <p className="settings-explanation mb-3">
              Select which genre packs to include in the pool for random reality shifts. At least one pack must be enabled. Can be safely changed at any time.
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
