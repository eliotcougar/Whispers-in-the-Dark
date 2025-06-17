
/**
 * @file TitleMenu.tsx
 * @description Main title screen with game start options.
 */
import * as React from 'react';
import { CURRENT_GAME_VERSION } from '../constants'; // Import the version constant

interface TitleMenuProps {
  readonly isVisible: boolean;
  readonly onClose: () => void;
  readonly onNewGame: () => void;
  readonly onCustomGame: () => void; 
  readonly onSaveGame?: () => void;
  readonly onLoadGame: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenInfo: () => void;
  readonly isGameActive: boolean;
}

/**
 * Main title screen offering game start and load options.
 */
const TitleMenu: React.FC<TitleMenuProps> = ({
  isVisible,
  onClose,
  onNewGame,
  onCustomGame, 
  onSaveGame,
  onLoadGame,
  onOpenSettings,
  onOpenInfo,
  isGameActive,
}) => {

  return (
    <div aria-labelledby="title-menu-heading" aria-modal="true" className={`animated-frame ${isVisible ? 'open' : ''}`} role="dialog">
      <div className="animated-frame-content relative"> {/* Added relative positioning for version number */}
        {isGameActive ? <button
          aria-label="Close Title Menu"
          className="animated-frame-close-button"
          onClick={onClose}
          >
          &times;
        </button> : null}

        <div className="flex flex-col items-center justify-center h-full w-full p-4 text-center">
          <header className="mb-10 md:mb-12">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-sky-400 tracking-wider title-font" id="title-menu-heading">
              Whispers in the Dark
            </h1>

            <p className="text-slate-400 text-lg md:text-xl mt-2">An Adventure in Shifting Realities</p>
          </header>

          <div className="space-y-4 sm:space-y-5 w-full max-w-xs sm:max-w-sm">
            <button
              aria-label={isGameActive ? "Start a New Game (Random Shifts, Progress will be lost)" : "Start a New Game (Random Shifts)"}
              className="w-full px-6 py-2.5 sm:py-3 bg-red-600 hover:bg-red-500 text-white text-lg sm:text-xl font-semibold rounded-lg shadow-lg
                         transition-all duration-150 ease-in-out transform hover:scale-105 focus:ring-4 focus:ring-red-400 focus:outline-none"
              onClick={onNewGame}
            >
              New Game
            </button>

            <button
              aria-label={isGameActive ? "Start a Custom Game (Choose Theme, No Random Shifts, Progress will be lost)" : "Start a Custom Game (Choose Theme, No Random Shifts)"}
              className="w-full px-6 py-2.5 sm:py-3 bg-orange-600 hover:bg-orange-500 text-white text-lg sm:text-xl font-semibold rounded-lg shadow-lg
                         transition-all duration-150 ease-in-out transform hover:scale-105 focus:ring-4 focus:ring-orange-400 focus:outline-none"
              onClick={onCustomGame}
            >
              Custom Game
            </button>

            {isGameActive && onSaveGame ? <button
              aria-label="Save Current Game to File"
              className="w-full px-6 py-2.5 sm:py-3 bg-green-600 hover:bg-green-500 text-white text-lg sm:text-xl font-semibold rounded-lg shadow-lg
                           transition-all duration-150 ease-in-out transform hover:scale-105 focus:ring-4 focus:ring-green-400 focus:outline-none"
              onClick={onSaveGame}
              >
              Save Game
            </button> : null}

            <button
              aria-label={isGameActive ? "Load Game from File (Current progress will be lost)" : "Load Game from File"}
              className="w-full px-6 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-500 text-white text-lg sm:text-xl font-semibold rounded-lg shadow-lg
                         transition-all duration-150 ease-in-out transform hover:scale-105 focus:ring-4 focus:ring-blue-400 focus:outline-none"
              onClick={onLoadGame}
            >
              Load Game
            </button>

            <button
              aria-label="Open Settings"
              className="w-full px-6 py-2.5 sm:py-3 bg-gray-600 hover:bg-gray-500 text-white text-lg sm:text-xl font-semibold rounded-lg shadow-lg
                         transition-all duration-150 ease-in-out transform hover:scale-105 focus:ring-4 focus:ring-gray-400 focus:outline-none"
              onClick={onOpenSettings}
            >
              Settings
            </button>

            <button
              aria-label="About & Game Guide"
              className="w-full px-6 py-2.5 sm:py-3 bg-cyan-700 hover:bg-cyan-600 text-white text-lg sm:text-xl font-semibold rounded-lg shadow-lg
                         transition-all duration-150 ease-in-out transform hover:scale-105 focus:ring-4 focus:ring-cyan-400 focus:outline-none"
              onClick={onOpenInfo}
            >
              About
            </button>

            {isGameActive ? <button
              aria-label="Return to Game"
              className="w-full mt-6 sm:mt-8 px-6 py-2.5 sm:py-3 bg-sky-700 hover:bg-sky-600 text-white text-lg sm:text-xl font-semibold rounded-lg shadow-lg
                              transition-all duration-150 ease-in-out transform hover:scale-105 focus:ring-4 focus:ring-sky-500 focus:outline-none"
              onClick={onClose}
              >
              Return to Game
            </button> : null}
          </div>
        </div>

        {/* Version Number Display */}
        <div className="absolute bottom-4 right-4 text-xs text-slate-500">
          Version: {CURRENT_GAME_VERSION}
        </div>
      </div>
    </div>
  );
};

export default TitleMenu;
