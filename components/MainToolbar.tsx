
/**
 * @file MainToolbar.tsx
 * @description Top-level toolbar with action buttons.
 */
import * as React from 'react';
import {
  CoinIcon,
  VisualizeIcon, BookOpenIcon, MenuIcon, RealityShiftIcon, ScrollIcon, MapIcon // Added MapIcon
} from './icons.tsx';

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
const MainToolbar: React.FC<MainToolbarProps> = ({
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
}) => {
  return (
    <div className="flex justify-between items-center w-full">
      {/* Score and Turns Display */}
      <div className="flex items-center space-x-3">
        <div
          aria-label={`Current score: ${score} points`}
          className="flex items-center p-2 border border-amber-500 rounded-md shadow-md"
          title={`Score: ${score} points`}
        >
          <CoinIcon className="w-5 h-5 mr-2 text-amber-400" />

          <span className="text-amber-400 font-semibold text-lg">{score}</span>
        </div>

        {currentThemeName ? <div
          aria-label={`Turns since last reality shift: ${turnsSinceLastShift}`}
          className="flex items-center p-2 border border-indigo-500 rounded-md shadow-md"
          title={`Turns since last reality shift: ${turnsSinceLastShift}`}
          >
          <svg className="h-5 w-5 mr-2 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <span className="text-indigo-400 font-semibold text-lg">{turnsSinceLastShift}</span>
        </div> : null}
      </div>


      {/* Icon Buttons */}
      <div className="flex space-x-2">
        <button
          aria-label="Visualize Scene"
          className="p-2 bg-blue-700 hover:bg-blue-600 text-white rounded-md shadow-md
                    disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                    transition-colors duration-150"
          disabled={isLoading || !currentThemeName || !currentSceneExists}
          onClick={onOpenVisualizer}
          title="Visualize Scene"
        >
          <VisualizeIcon />
        </button>

        <button
          aria-label="Open Knowledge Base"
          className="p-2 bg-blue-700 hover:bg-blue-600 text-white rounded-md shadow-md
                    disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                    transition-colors duration-150"
          disabled={isLoading || !currentThemeName}
          onClick={onOpenKnowledgeBase}
          title="Open Knowledge Base"
        >
          <BookOpenIcon />
        </button>

        <button
          aria-label="Open History"
          className="p-2 bg-blue-700 hover:bg-blue-600 text-white rounded-md shadow-md
                    disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                    transition-colors duration-150"
          disabled={isLoading || !currentThemeName}
          onClick={onOpenHistory}
          title="Open History"
        >
          <ScrollIcon />
        </button>

        <button
          aria-label="Open Map"
          className="p-2 bg-blue-700 hover:bg-blue-600 text-white rounded-md shadow-md
                    disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                    transition-colors duration-150"
          disabled={isLoading || !currentThemeName}
          onClick={onOpenMap}
          title="Open Map"
        >
          <MapIcon />
        </button>

        <button
          aria-label="Force Reality Shift"
          className="p-2 bg-purple-700 hover:bg-purple-600 text-white rounded-md shadow-md
                    disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                    transition-colors duration-150"
          disabled={isLoading || !currentThemeName}
          onClick={onManualRealityShift}
          title="Force Reality Shift"
        >
          <RealityShiftIcon />
        </button>

        <button
          aria-label="Open Title Menu"
          className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md shadow-md
                    disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                    transition-colors duration-150"
          disabled={isLoading}
          onClick={onOpenTitleMenu}
          title="Open Title Menu"
        >
          <MenuIcon />
        </button>
      </div>
    </div>
  );
};

export default MainToolbar;
