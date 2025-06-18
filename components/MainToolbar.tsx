
/**
 * @file MainToolbar.tsx
 * @description Top-level toolbar with action buttons.
 */
import { Icon } from './icons.tsx';
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
          <svg
            className="h-5 w-5 mr-2 text-indigo-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <span className="text-indigo-400 font-semibold text-lg">
            {turnsSinceLastShift}
          </span>
        </div> : null}
      </div>


      {/* Icon Buttons */}
      <div className="flex space-x-2">
        <Button
          ariaLabel="Visualize Scene"
          className="bg-blue-700 hover:bg-blue-600 text-white rounded-md shadow-md disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-150"
          disabled={isLoading || !currentThemeName || !currentSceneExists}
          icon={<Icon
            inline
            name="visualize"
            size={20}
                />}
          onClick={onOpenVisualizer}
          size="md"
          title="Visualize Scene"
          variant="toolbar"
        />

        <Button
          ariaLabel="Open Knowledge Base"
          className="bg-blue-700 hover:bg-blue-600 text-white rounded-md shadow-md disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-150"
          disabled={isLoading || !currentThemeName}
          icon={<Icon
            inline
            name="bookOpen"
            size={20}
                />}
          onClick={onOpenKnowledgeBase}
          size="md"
          title="Open Knowledge Base"
          variant="toolbar"
        />

        <Button
          ariaLabel="Open History"
          className="bg-blue-700 hover:bg-blue-600 text-white rounded-md shadow-md disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-150"
          disabled={isLoading || !currentThemeName}
          icon={<Icon
            inline
            name="scroll"
            size={20}
                />}
          onClick={onOpenHistory}
          size="md"
          title="Open History"
          variant="toolbar"
        />

        <Button
          ariaLabel="Open Map"
          className="bg-blue-700 hover:bg-blue-600 text-white rounded-md shadow-md disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-150"
          disabled={isLoading || !currentThemeName}
          icon={<Icon
            inline
            name="map"
            size={20}
                />}
          onClick={onOpenMap}
          size="md"
          title="Open Map"
          variant="toolbar"
        />

        <Button
          ariaLabel="Force Reality Shift"
          className="bg-purple-700 hover:bg-purple-600 text-white rounded-md shadow-md disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-150"
          disabled={isLoading || !currentThemeName}
          icon={<Icon
            inline
            name="realityShift"
            size={20}
                />}
          onClick={onManualRealityShift}
          size="md"
          title="Force Reality Shift"
          variant="toolbar"
        />

        <Button
          ariaLabel="Open Title Menu"
          className="bg-gray-700 hover:bg-gray-600 text-white rounded-md shadow-md disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-150"
          disabled={isLoading}
          icon={<Icon
            inline
            name="menu"
            size={20}
                />}
          onClick={onOpenTitleMenu}
          size="md"
          title="Open Title Menu"
          variant="toolbar"
        />
      </div>
    </div>
  );
}

export default MainToolbar;
