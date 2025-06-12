
/**
 * @file SettingsDisplay.tsx
 * @description Screen for adjusting game and user settings.
 */
import React, { useState, useEffect, memo } from 'react';
import { ThemePackName, ALL_THEME_PACK_NAMES } from '../themes';
import { DEFAULT_PLAYER_GENDER } from '../constants';

interface SettingsDisplayProps {
  isVisible: boolean;
  onClose: () => void;
  stabilityLevel: number;
  chaosLevel: number;
  onStabilityChange: (value: number) => void;
  onChaosChange: (value: number) => void;
  enabledThemePacks: ThemePackName[];
  onToggleThemePack: (packName: ThemePackName) => void;
  playerGender: string;
  onPlayerGenderChange: (gender: string) => void;
  isCustomGameMode: boolean;
}

/**
 * Screen for tweaking player and gameplay settings.
 */
const SettingsDisplayComponent: React.FC<SettingsDisplayProps> = ({
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
  const handleThemePackToggle = (packName: ThemePackName) => {
    onToggleThemePack(packName);
  };

  /** Updates gender selection based on radio option. */
  const handleGenderRadioChange = (option: 'Male' | 'Female' | 'Custom') => {
    setSelectedGenderOption(option);
    if (option === 'Male') {
      onPlayerGenderChange('Male');
    } else if (option === 'Female') {
      onPlayerGenderChange('Female');
    } else { // Custom
      onPlayerGenderChange(customGenderInput.trim() || 'Not Specified');
    }
  };

  /** Handles typing into the custom gender text input. */
  const handleCustomGenderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomGenderInput(value);
    if (selectedGenderOption === 'Custom') {
      onPlayerGenderChange(value.trim() || 'Not Specified');
    }
  };

  const sliderControlOpacityClass = isCustomGameMode ? "opacity-50" : "";

  return (
    <div className={`animated-frame ${isVisible ? 'open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="animated-frame-content">
        <button
          onClick={onClose}
          className="animated-frame-close-button"
          aria-label="Close settings"
        >
          &times;
        </button>
        <div className="settings-content-area">
          <h1 id="settings-title" className="text-3xl font-bold text-sky-300 mb-8 text-center">Game Settings</h1>
          
          <div id="reality-shift-controls" className="mb-8"> {/* Removed conditional class from here */}
            <h2 className="text-xl font-semibold text-amber-400 mb-3 pb-1 border-b border-amber-600">Reality Shift Controls</h2>
            {isCustomGameMode && (
              <div className="p-3 mb-3 bg-indigo-800/70 border border-indigo-600 rounded-md text-indigo-200 text-sm">
                <p>Random Reality Shifts are disabled in Custom Game mode.</p>
                <p>You can still change these settings, and they will apply if you start a regular &quot;New Game&quot; from the Main Menu.</p>
              </div>
            )}
            <div className="settings-slider-container">
              <label htmlFor="stabilitySlider" className={`settings-slider-label ${sliderControlOpacityClass}`}>
                Stability: <span>{stabilityLevel}</span>
              </label>
              <input
                type="range"
                id="stabilitySlider"
                min="0"
                max="100"
                value={stabilityLevel}
                onChange={(e) => onStabilityChange(parseInt(e.target.value, 10))}
                className={`settings-slider ${sliderControlOpacityClass}`} /* Apply opacity here, remove disabled */
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={stabilityLevel}
                aria-labelledby="stabilitySliderLabel"
                // disabled={isCustomGameMode} // REMOVED: Slider is now interactive
              />
              <p id="stabilitySliderLabel" className={`settings-explanation ${sliderControlOpacityClass}`}>
                Number of turns after any reality shift before random chaos shifts can occur again.
                Higher values mean longer periods of stability (e.g., 0 = chaos can happen immediately, 10 = 10 turns of safety). Max 100.
              </p>
            </div>

            <div className="settings-slider-container">
              <label htmlFor="chaosSlider" className={`settings-slider-label ${sliderControlOpacityClass}`}>
                Chaos: <span>{chaosLevel}%</span>
              </label>
              <input
                type="range"
                id="chaosSlider"
                min="0"
                max="100"
                value={chaosLevel}
                onChange={(e) => onChaosChange(parseInt(e.target.value, 10))}
                className={`settings-slider ${sliderControlOpacityClass}`} /* Apply opacity here, remove disabled */
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={chaosLevel}
                aria-labelledby="chaosSliderLabel"
                // disabled={isCustomGameMode} // REMOVED: Slider is now interactive
              />
              <p id="chaosSliderLabel" className={`settings-explanation ${sliderControlOpacityClass}`}>
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
                <label key={option} className="flex items-center space-x-3 cursor-pointer p-2 bg-slate-700/50 rounded-md hover:bg-slate-600/50 transition-colors">
                  <input
                    type="radio"
                    name="playerGender"
                    value={option}
                    checked={selectedGenderOption === option}
                    onChange={() => handleGenderRadioChange(option)}
                    className="form-radio h-5 w-5 text-sky-500 bg-slate-600 border-slate-500 focus:ring-sky-400 focus:ring-offset-slate-800"
                    aria-labelledby={`gender-label-${option.toLowerCase()}`}
                  />
                  <span id={`gender-label-${option.toLowerCase()}`} className="text-slate-200 text-lg">{option}</span>
                </label>
              ))}
              {selectedGenderOption === 'Custom' && (
                <input
                  type="text"
                  value={customGenderInput}
                  onChange={handleCustomGenderInputChange}
                  placeholder="Enter custom gender (or leave blank for &apos;Not Specified&apos;)"
                  className="w-full p-2 mt-2 bg-slate-600 text-slate-100 border border-slate-500 rounded-md focus:ring-sky-500 focus:border-sky-500"
                  aria-label="Custom gender input"
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
                <label key={packName} className="flex items-center space-x-3 cursor-pointer p-2 bg-slate-700/50 rounded-md hover:bg-slate-600/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={enabledThemePacks.includes(packName)}
                    onChange={() => handleThemePackToggle(packName)}
                    className="form-checkbox h-5 w-5 text-sky-500 bg-slate-600 border-slate-500 rounded focus:ring-sky-400 focus:ring-offset-slate-800"
                    aria-labelledby={`theme-pack-label-${packName.replace(/\s|&/g, '-')}`}
                  />
                  <span id={`theme-pack-label-${packName.replace(/\s|&/g, '-')}`} className="text-slate-200 text-lg">{packName}</span>
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

const SettingsDisplay = memo(SettingsDisplayComponent);

export default SettingsDisplay;
