
/**
 * @file SettingsDisplay.tsx
 * @description Screen for adjusting game and user settings.
 */
import { useCallback } from 'react';

import { ThemePackName, ThinkingEffort } from '../../types';
import { ALL_THEME_PACK_NAMES_CONST } from '../../constants';
import Button from '../elements/Button';
import CheckboxSelector from '../elements/CheckboxSelector';
import RadioSelector from '../elements/RadioSelector';
import { Icon } from '../elements/icons';

interface SettingsDisplayProps {
  readonly enabledThemePacks: Array<ThemePackName>;
  readonly isVisible: boolean;
  readonly onChangeThinkingEffort: (value: ThinkingEffort) => void;
  readonly onClose: () => void;
  readonly onToggleThemePack: (packName: ThemePackName) => void;
  readonly thinkingEffort: ThinkingEffort;
}

/**
 * Screen for tweaking player and gameplay settings.
 */
function SettingsDisplay({
  enabledThemePacks,
  isVisible,
  onChangeThinkingEffort,
  onClose,
  onToggleThemePack,
  thinkingEffort,
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

  const handleThinkingEffortChange = useCallback(
    (value: string) => {
      onChangeThinkingEffort(value as ThinkingEffort);
    },
    [onChangeThinkingEffort]
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
              Thinking Effort
            </h2>

            <p className="settings-explanation mb-3">
              Select how much reasoning the AI uses. Higher levels may improve quality at the cost of time.
            </p>

            <RadioSelector
              name="thinking-effort"
              onChange={handleThinkingEffortChange}
              options={['Low', 'Medium', 'High']}
              value={thinkingEffort}
            />
          </div>


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
