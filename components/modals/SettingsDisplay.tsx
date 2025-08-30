
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
  readonly onChangePreferredPlayerName: (value: string) => void;
  readonly onClose: () => void;
  readonly onToggleThemePack: (packName: ThemePackName) => void;
  readonly preferredPlayerName: string;
  readonly thinkingEffort: ThinkingEffort;
}

/**
 * Screen for tweaking player and gameplay settings.
 */
function SettingsDisplay({
  enabledThemePacks,
  isVisible,
  onChangeThinkingEffort,
  onChangePreferredPlayerName,
  onClose,
  onToggleThemePack,
  preferredPlayerName,
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

  const handlePreferredNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow letters, numbers, spaces, hyphen, single-quote and double-quote; defer trimming/collapsing to save stage
    const filtered = raw.replace(/[^a-zA-Z0-9\s\-"']/g, '');
    onChangePreferredPlayerName(filtered);
  }, [onChangePreferredPlayerName]);


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
              Preferred Player Name
            </h2>
            <p className="settings-explanation mb-3">
              Optional: if set, this name appears as the first option when choosing your character. Disallowed characters are removed automatically.
            </p>
            <input
              aria-label="Preferred player name"
              className="w-full p-2 bg-slate-700 text-slate-200 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
              onChange={handlePreferredNameChange}
              placeholder="e.g., Morgan"
              type="text"
              value={preferredPlayerName}
            />
          </div>
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-amber-400 mb-3 pb-1 border-b border-amber-600">
              Thinking Effort
            </h2>

            <p className="settings-explanation mb-3">
              Select how much reasoning the AI uses. Higher levels may improve quality at the cost of time, but will not affect API usage quotas.
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
