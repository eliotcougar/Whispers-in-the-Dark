
/**
 * @file MainToolbar.tsx
 * @description Top-level toolbar with action buttons.
 */
import { Icon } from './elements/icons';
import Button from './elements/Button';

interface MainToolbarProps {
  readonly score: number;
  readonly isLoading: boolean;
  readonly currentThemeName: string | null;
  readonly currentSceneExists: boolean;
  readonly onOpenVisualizer: () => void;
  readonly onOpenKnowledgeBase: () => void;
  readonly onOpenHistory: () => void;
  readonly onOpenMap: () => void; // Added for Map
  readonly onOpenTitleMenu: () => void;
  readonly onManualRealityShift: () => void;
  readonly turnsSinceLastShift: number;
}

/**
 * Provides quick-access buttons for common game actions.
 */
function MainToolbar({
  score,
  isLoading,
  currentThemeName,
  currentSceneExists,
  onOpenVisualizer,
  onOpenKnowledgeBase,
  onOpenHistory,
  onOpenMap, // Added for Map
  onOpenTitleMenu,
  onManualRealityShift,
  turnsSinceLastShift,
}: MainToolbarProps) {
  return (
    <div className="flex justify-between items-center w-full">
      {/* Score and Turns Display */}
      <div className="flex items-center space-x-3">
        <div
          aria-label={`Current score: ${String(score)} points`}
          className="flex items-center p-2 border border-amber-500 rounded-md shadow-md"
          title={`Score: ${String(score)} points`}
        >
          <Icon
            color="amber"
            inline
            marginRight={8}
            name="coin"
            size={20}
          />

          <span className="text-amber-400 font-semibold text-lg">
            {score}
          </span>
        </div>

        {currentThemeName ? <div
          aria-label={`Turns since last reality shift: ${String(turnsSinceLastShift)}`}
          className="flex items-center p-2 border border-indigo-500 rounded-md shadow-md"
          title={`Turns since last reality shift: ${String(turnsSinceLastShift)}`}
                            >
          <Icon
            color="indigo"
            inline
            marginRight={8}
            name="clock"
            size={20}
          />

          <span className="text-indigo-400 font-semibold text-lg">
            {turnsSinceLastShift}
          </span>
        </div> : null}
      </div>


      {/* Icon Buttons */}
      <div className="flex space-x-2">
        <Button
          ariaLabel="Visualize Scene"
          disabled={isLoading || !currentThemeName || !currentSceneExists}
          icon={<Icon
            inline
            name="visualize"
            size={20}
                />}
          onClick={onOpenVisualizer}
          preset="blue"
          size="md"
          title="Visualize Scene"
          variant="toolbar"
        />

        <Button
          ariaLabel="Open Knowledge Base"
          disabled={isLoading || !currentThemeName}
          icon={<Icon
            inline
            name="bookOpen"
            size={20}
                />}
          onClick={onOpenKnowledgeBase}
          preset="blue"
          size="md"
          title="Open Knowledge Base"
          variant="toolbar"
        />

        <Button
          ariaLabel="Open History"
          disabled={isLoading || !currentThemeName}
          icon={<Icon
            inline
            name="scroll"
            size={20}
                />}
          onClick={onOpenHistory}
          preset="blue"
          size="md"
          title="Open History"
          variant="toolbar"
        />

        <Button
          ariaLabel="Open Map"
          disabled={isLoading || !currentThemeName}
          icon={<Icon
            inline
            name="map"
            size={20}
                />}
          onClick={onOpenMap}
          preset="blue"
          size="md"
          title="Open Map"
          variant="toolbar"
        />

        <Button
          ariaLabel="Force Reality Shift"
          disabled={isLoading || !currentThemeName}
          icon={<Icon
            inline
            name="realityShift"
            size={20}
                />}
          onClick={onManualRealityShift}
          preset="purple"
          size="md"
          title="Force Reality Shift"
          variant="toolbar"
        />

        <Button
          ariaLabel="Open Title Menu"
          disabled={isLoading}
          icon={<Icon
            inline
            name="menu"
            size={20}
                />}
          onClick={onOpenTitleMenu}
          preset="gray"
          size="md"
          title="Open Title Menu"
          variant="toolbar"
        />
      </div>
    </div>
  );
}

export default MainToolbar;
