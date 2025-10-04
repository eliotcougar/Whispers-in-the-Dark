
/**
 * @file MainToolbar.tsx
 * @description Top-level toolbar with action buttons.
 */
import Button from './elements/Button';
import { Icon } from './elements/icons';
import LoadingSpinner from './LoadingSpinner';

interface MainToolbarProps {
  readonly score: number;
  readonly isLoading: boolean;
  readonly isTurnProcessing: boolean;
  readonly themeName: string | null;
  readonly currentSceneExists: boolean;
  readonly onOpenVisualizer: () => void;
  readonly onOpenKnowledgeBase: () => void;
  readonly onOpenMap: () => void; // Added for Map
  readonly onOpenTitleMenu: () => void;
}

/**
 * Provides quick-access buttons for common game actions.
 */
function MainToolbar({
  score,
  isLoading,
  isTurnProcessing,
  themeName,
  currentSceneExists,
  onOpenVisualizer,
  onOpenKnowledgeBase,
  onOpenMap, // Added for Map
  onOpenTitleMenu,
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

        {isTurnProcessing ? (
          <LoadingSpinner
            showText={false}
            size="sm"
          />
        ) : null}

        {/* Turns counter removed */}
      </div>


      {/* Icon Buttons */}
      <div className="flex space-x-2">
        <Button
          ariaLabel="Visualize Scene"
          disabled={isLoading || isTurnProcessing || !themeName || !currentSceneExists}
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
          disabled={isLoading || isTurnProcessing || !themeName}
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
          ariaLabel="Open Map"
          disabled={isLoading || isTurnProcessing || !themeName}
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
          ariaLabel="Open Title Menu"
          disabled={isLoading || isTurnProcessing}
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
