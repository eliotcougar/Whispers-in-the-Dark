
/**
 * @file SettingsDisplay.tsx
 * @description Screen for adjusting game and user settings.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ThemePackName, ALL_THEME_PACK_NAMES } from '../themes';
import { DEFAULT_PLAYER_GENDER } from '../constants';

interface SettingsDisplayProps {
  readonly isVisible: boolean;
  readonly onClose: () => void;
  readonly stabilityLevel: number;
  readonly chaosLevel: number;
  readonly onStabilityChange: (value: number) => void;
  readonly onChaosChange: (value: number) => void;
  readonly enabledThemePacks: ThemePackName[];
  readonly onToggleThemePack: (packName: ThemePackName) => void;
  readonly playerGender: string;
  readonly onPlayerGenderChange: (gender: string) => void;
  readonly isCustomGameMode: boolean;
}

/**
 * Screen for tweaking player and gameplay settings.
 */
const SettingsDisplay: React.FC<SettingsDisplayProps> = ({
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
}) => {
  const [customGenderInput, setCustomGenderInput] = useState('');
  const [selectedGenderOption, setSelectedGenderOption] = useState<'Male' | 'Female' | 'Custom'>(DEFAULT_PLAYER_GENDER as 'Male' | 'Female' | 'Custom');

  useEffect(() => {
    if (isVisible) {
      if (playerGender === 'Male') {
        setSelectedGenderOption('Male');
        setCustomGenderInput('');
      } else if (playerGender === 'Female') {
        setSelectedGenderOption('Female');
        setCustomGenderInput('');
      } else {
        setSelectedGenderOption('Custom');
        setCustomGenderInput(playerGender === 'Not Specified' ? '' : playerGender);
      }
    }
  }, [playerGender, isVisible]);

  /** Toggles a theme pack in the player's preferences. */
  const handleThemePackToggle = useCallback(
    (packName: ThemePackName) => {
      onToggleThemePack(packName);
    },
    [onToggleThemePack]
  );

  /** Handles checkbox changes using a data attribute. */
  const handleThemePackToggleByData = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const packName = e.currentTarget.dataset.packName as ThemePackName | undefined;
      if (packName) {
        handleThemePackToggle(packName);
      }
    },
    [handleThemePackToggle]
  );

  /** Updates gender selection based on radio option. */
  const handleGenderRadioChange = useCallback(
    (option: 'Male' | 'Female' | 'Custom') => {
      setSelectedGenderOption(option);
      if (option === 'Male') {
        onPlayerGenderChange('Male');
      } else if (option === 'Female') {
        onPlayerGenderChange('Female');
      } else {
        // Custom
        onPlayerGenderChange(customGenderInput.trim() || 'Not Specified');
      }
    },
    [customGenderInput, onPlayerGenderChange]
  );

  /** Reads the gender option from a data attribute. */
  const handleGenderRadioChangeByData = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const option = e.currentTarget.dataset.genderOption as 'Male' | 'Female' | 'Custom' | undefined;
      if (option) {
        handleGenderRadioChange(option);
      }
    },
    [handleGenderRadioChange]
  );

  /** Handles typing into the custom gender text input. */
  const handleCustomGenderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomGenderInput(value);
    if (selectedGenderOption === 'Custom') {
      onPlayerGenderChange(value.trim() || 'Not Specified');
    }
  };

  const sliderControlOpacityClass = isCustomGameMode ? "opacity-50" : "";

  const handleStabilitySliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onStabilityChange(parseInt(e.target.value, 10));
    },
    [onStabilityChange]
  );

  const handleChaosSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChaosChange(parseInt(e.target.value, 10));
    },
    [onChaosChange]
  );

  return (
    <div aria-labelledby="settings-title" aria-modal="true" className={`animated-frame ${isVisible ? 'open' : ''}`} role="dialog">
      <div className="animated-frame-content">
        <button
          aria-label="Close settings"
          className="animated-frame-close-button"
          onClick={onClose}
        >
          &times;
        </button>

        <div className="settings-content-area">
          <h1 className="text-3xl font-bold text-sky-300 mb-8 text-center" id="settings-title">Game Settings</h1>
          
          <div className="mb-8" id="reality-shift-controls"> {/* Removed conditional class from here */}
            <h2 className="text-xl font-semibold text-amber-400 mb-3 pb-1 border-b border-amber-600">Reality Shift Controls</h2>

            {isCustomGameMode ? <div className="p-3 mb-3 bg-indigo-800/70 border border-indigo-600 rounded-md text-indigo-200 text-sm">
              <p>Random Reality Shifts are disabled in Custom Game mode.</p>

              <p>You can still change these settings, and they will apply if you start a regular &quot;New Game&quot; from the Main Menu.</p>
            </div> : null}

            <div className="settings-slider-container">
              <label className={`settings-slider-label ${sliderControlOpacityClass}`} htmlFor="stabilitySlider">
                Stability: <span>{stabilityLevel}</span>
              </label>

              <input
                aria-labelledby="stabilitySliderLabel"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={stabilityLevel}
                className={`settings-slider ${sliderControlOpacityClass}`} /* Apply opacity here, remove disabled */
                id="stabilitySlider"
                max="100"
                min="0"
                onChange={handleStabilitySliderChange}
                type="range"
                value={stabilityLevel}
                // disabled={isCustomGameMode} // REMOVED: Slider is now interactive
              />

              <p className={`settings-explanation ${sliderControlOpacityClass}`} id="stabilitySliderLabel">
                Number of turns after any reality shift before random chaos shifts can occur again.
                Higher values mean longer periods of stability (e.g., 0 = chaos can happen immediately, 10 = 10 turns of safety). Max 100.
              </p>
            </div>

            <div className="settings-slider-container">
              <label className={`settings-slider-label ${sliderControlOpacityClass}`} htmlFor="chaosSlider">
                Chaos: <span>{chaosLevel}%</span>
              </label>

              <input
                aria-labelledby="chaosSliderLabel"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={chaosLevel}
                className={`settings-slider ${sliderControlOpacityClass}`} /* Apply opacity here, remove disabled */
                id="chaosSlider"
                max="100"
                min="0"
                onChange={handleChaosSliderChange}
                type="range"
                value={chaosLevel}
                // disabled={isCustomGameMode} // REMOVED: Slider is now interactive
              />

              <p className={`settings-explanation ${sliderControlOpacityClass}`} id="chaosSliderLabel">
                Percentage chance (0-100%) of a random reality shift occurring each turn, *after* the &apos;Stability&apos; period has passed.
                Higher values mean more frequent shifts.
              </p>
            </div>

            {/* Disclaimer is NOT greyed out */}
            <div className="settings-disclaimer">
              <p><strong>In the Beta</strong>, manual reality shift can be triggered at any time regardless of these settings.</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-amber-400 mb-3 pb-1 border-b border-amber-600">Player Character Gender</h2>

            <p className="settings-explanation mb-3">
              Choose your character&apos;s gender. This may subtly influence descriptions and interactions in the game. Changing it in the middle of the game can have unexpected effects.
            </p>

            <div className="space-y-3">
                {(['Male', 'Female', 'Custom'] as const).map(option => (
                  <label className="flex items-center space-x-3 cursor-pointer p-2 bg-slate-700/50 rounded-md hover:bg-slate-600/50 transition-colors" key={option}>
                    <input
                      aria-labelledby={`gender-label-${option.toLowerCase()}`}
                      checked={selectedGenderOption === option}
                      className="form-radio h-5 w-5 text-sky-500 bg-slate-600 border-slate-500 focus:ring-sky-400 focus:ring-offset-slate-800"
                      name="playerGender"
                      data-gender-option={option}
                      onChange={handleGenderRadioChangeByData}
                      type="radio"
                      value={option}
                    />

                  <span className="text-slate-200 text-lg" id={`gender-label-${option.toLowerCase()}`}>{option}</span>
                </label>
              ))}

              {selectedGenderOption === 'Custom' && (
                <input
                  aria-label="Custom gender input"
                  className="w-full p-2 mt-2 bg-slate-600 text-slate-100 border border-slate-500 rounded-md focus:ring-sky-500 focus:border-sky-500"
                  onChange={handleCustomGenderInputChange}
                  placeholder="Enter custom gender (or leave blank for &apos;Not Specified&apos;)"
                  type="text"
                  value={customGenderInput}
                />
              )}
            </div>
          </div>


          <div className="mb-6">
            <h2 className="text-xl font-semibold text-amber-400 mb-3 pb-1 border-b border-amber-600">Theme Pack Preferences</h2>

            <p className="settings-explanation mb-3">
              Select which genre packs to include in the pool for random reality shifts. At least one pack must be enabled. Can be safely changed at any time.
            </p>

            <div className="space-y-3">
                {ALL_THEME_PACK_NAMES.map(packName => (
                  <label className="flex items-center space-x-3 cursor-pointer p-2 bg-slate-700/50 rounded-md hover:bg-slate-600/50 transition-colors" key={packName}>
                    <input
                      aria-labelledby={`theme-pack-label-${packName.replace(/\s|&/g, '-')}`}
                      checked={enabledThemePacks.includes(packName)}
                      className="form-checkbox h-5 w-5 text-sky-500 bg-slate-600 border-slate-500 rounded focus:ring-sky-400 focus:ring-offset-slate-800"
                      data-pack-name={packName}
                      onChange={handleThemePackToggleByData}
                      type="checkbox"
                    />

                  <span className="text-slate-200 text-lg" id={`theme-pack-label-${packName.replace(/\s|&/g, '-')}`}>{packName}</span>
                </label>
              ))}
            </div>

            {enabledThemePacks.length === 0 && (
            <p className="text-red-400 mt-2 text-sm">
              At least one theme pack must be enabled. Please select a pack to continue.
            </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsDisplay;
