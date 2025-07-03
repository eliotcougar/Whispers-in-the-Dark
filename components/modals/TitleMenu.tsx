
/**
 * @file TitleMenu.tsx
 * @description Main title screen with game start options.
 */
import { useCallback } from 'react';
import { CURRENT_GAME_VERSION } from '../../constants';
import { isApiConfigured } from '../../services/apiClient';
import AppHeader from '../app/AppHeader';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';
import VersionBadge from '../elements/VersionBadge';

interface TitleMenuProps {
  readonly isVisible: boolean;
  readonly onClose: () => void;
  readonly onNewGame: () => void;
  readonly onCustomGame: () => void; 
  readonly onSaveGame?: () => void | Promise<void>;
  readonly onLoadGame: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenInfo: () => void;
  readonly onOpenGeminiKeyModal?: () => void;
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
  onOpenGeminiKeyModal,
  isGameActive,
}: TitleMenuProps) {

  const handleSaveClick = useCallback(() => {
    if (onSaveGame) {
      void onSaveGame();
    }
  }, [onSaveGame]);

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
            icon={<Icon
              name="x"
              size={20}
            />}
            onClick={onClose}
            size="sm"
            variant="close"
          />
        ) : null}

        <div className="flex flex-col items-center justify-center h-full w-full p-4 text-center">
          <AppHeader
            currentTheme={null} // No theme in title menu
            hasGameBeenInitialized={isGameActive}
            isCustomGameMode={false} // Custom game mode not applicable here 
          />

          <div className="space-y-3 sm:space-y-3 w-full max-w-xs sm:max-w-sm">
            {!isApiConfigured() ? (
              <Button
                ariaLabel="Set Gemini API key"
                label="Set Gemini Key"
                onClick={onOpenGeminiKeyModal}
                preset="indigo"
                size="lg"
              />
            ) : null}

            <Button
              ariaLabel={isGameActive ? 'Start a New Game (Random Shifts, Progress will be lost)' : 'Start a New Game (Random Shifts)'}
              disabled={!isApiConfigured()}
              label="New Game"
              onClick={onNewGame}
              preset="red"
              size="lg"
            />

            <Button
              ariaLabel={isGameActive ? 'Start a Custom Game (Choose Theme, No Random Shifts, Progress will be lost)' : 'Start a Custom Game (Choose Theme, No Random Shifts)'}
              disabled={!isApiConfigured()}
              label="Custom Game"
              onClick={onCustomGame}
              preset="orange"
              size="lg"
            />

            {isGameActive && onSaveGame ? (
              <Button
                ariaLabel="Save Current Game to File"
                label="Save Game"
                onClick={handleSaveClick}
                preset="green"
                size="lg"
              />
            ) : null}

            <Button
              ariaLabel={isGameActive ? 'Load Game from File (Current progress will be lost)' : 'Load Game from File'}
              disabled={!isApiConfigured()}
              label="Load Game"
              onClick={onLoadGame}
              preset="blue"
              size="lg"
            />

            <Button
              ariaLabel="Open Settings"
              label="Settings"
              onClick={onOpenSettings}
              preset="gray"
              size="lg"
            />

            <Button
              ariaLabel="About & Game Guide"
              label="About"
              onClick={onOpenInfo}
              preset="cyan"
              size="lg"
            />

            {isGameActive ? (
              <Button
                ariaLabel="Return to Game"
                label="Return to Game"
                onClick={onClose}
                preset="sky"
                size="lg"
              />
            ) : null}
          </div>
        </div>

        {/* Version Number Display */}
        <VersionBadge
          version={CURRENT_GAME_VERSION}
        />
      </div>
    </div>
  );
}

TitleMenu.defaultProps = { onSaveGame: undefined, onOpenGeminiKeyModal: undefined };

export default TitleMenu;
