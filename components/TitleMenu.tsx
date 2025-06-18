
/**
 * @file TitleMenu.tsx
 * @description Main title screen with game start options.
 */
import { CURRENT_GAME_VERSION } from '../constants'; // Import the version constant
import Button from './elements/Button';
import { Icon } from './icons.tsx';
import VersionBadge from './elements/VersionBadge';

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
function TitleMenu({
  isVisible,
  onClose,
  onNewGame,
  onCustomGame,
  onSaveGame,
  onLoadGame,
  onOpenSettings,
  onOpenInfo,
  isGameActive,
}: TitleMenuProps) {

  return (
    <div
      aria-labelledby="title-menu-heading"
      aria-modal="true"
      className={`animated-frame ${isVisible ? 'open' : ''}`}
      role="dialog"
    >
      <div className="animated-frame-content relative"> 
        {' '}

        {/* Added relative positioning for version number */}
        {isGameActive ? (
          <Button
            ariaLabel="Close Title Menu"
            className="animated-frame-close-button"
            icon={<Icon
              name="x"
              size={20}
                  />}
            onClick={onClose}
            size="sm"
          />
        ) : null}

        <div className="flex flex-col items-center justify-center h-full w-full p-4 text-center">
          <header className="mb-10 md:mb-12">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-bold text-sky-400 tracking-wider title-font"
              id="title-menu-heading"
            >
              Whispers in the Dark
            </h1>

            <p className="text-slate-400 text-lg md:text-xl mt-2">
              An Adventure in Shifting Realities
            </p>
          </header>

          <div className="space-y-4 sm:space-y-5 w-full max-w-xs sm:max-w-sm">
            <Button
              ariaLabel={isGameActive ? 'Start a New Game (Random Shifts, Progress will be lost)' : 'Start a New Game (Random Shifts)'}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105 focus:ring-4 focus:ring-red-400 focus:outline-none"
              label="New Game"
              onClick={onNewGame}
              size="lg"
            />

            <Button
              ariaLabel={isGameActive ? 'Start a Custom Game (Choose Theme, No Random Shifts, Progress will be lost)' : 'Start a Custom Game (Choose Theme, No Random Shifts)'}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-lg shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105 focus:ring-4 focus:ring-orange-400 focus:outline-none"
              label="Custom Game"
              onClick={onCustomGame}
              size="lg"
            />

            {isGameActive && onSaveGame ? (
              <Button
                ariaLabel="Save Current Game to File"
                className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105 focus:ring-4 focus:ring-green-400 focus:outline-none"
                label="Save Game"
                onClick={onSaveGame}
                size="lg"
              />
            ) : null}

            <Button
              ariaLabel={isGameActive ? 'Load Game from File (Current progress will be lost)' : 'Load Game from File'}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105 focus:ring-4 focus:ring-blue-400 focus:outline-none"
              label="Load Game"
              onClick={onLoadGame}
              size="lg"
            />

            <Button
              ariaLabel="Open Settings"
              className="w-full bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105 focus:ring-4 focus:ring-gray-400 focus:outline-none"
              label="Settings"
              onClick={onOpenSettings}
              size="lg"
            />

            <Button
              ariaLabel="About & Game Guide"
              className="w-full bg-cyan-700 hover:bg-cyan-600 text-white font-semibold rounded-lg shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105 focus:ring-4 focus:ring-cyan-400 focus:outline-none"
              label="About"
              onClick={onOpenInfo}
              size="lg"
            />

            {isGameActive ? (
              <Button
                ariaLabel="Return to Game"
                className="w-full mt-6 sm:mt-8 bg-sky-700 hover:bg-sky-600 text-white font-semibold rounded-lg shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105 focus:ring-4 focus:ring-sky-500 focus:outline-none"
                label="Return to Game"
                onClick={onClose}
                size="lg"
              />
            ) : null}
          </div>
        </div>

        {/* Version Number Display */}
        <VersionBadge
          className="absolute bottom-4 right-4"
          version={CURRENT_GAME_VERSION}
        />
      </div>
    </div>
  );
}

TitleMenu.defaultProps = { onSaveGame: undefined };

export default TitleMenu;
