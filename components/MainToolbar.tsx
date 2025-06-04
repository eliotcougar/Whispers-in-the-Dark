
import React from 'react';
import {
  CoinIcon,
  VisualizeIcon, BookOpenIcon, MenuIcon, InfoIcon, RealityShiftIcon, ScrollIcon, MapIcon // Added MapIcon
} from './icons.tsx';

interface MainToolbarProps {
  score: number;
  isLoading: boolean;
  currentThemeName: string | null;
  currentSceneExists: boolean;
  onOpenInfo: () => void;
  onOpenVisualizer: () => void;
  onOpenKnowledgeBase: () => void;
  onOpenThemeMemory: () => void; 
  onOpenMap: () => void; // Added for Map
  onOpenTitleMenu: () => void;
  onManualRealityShift: () => void;
  turnsSinceLastShift: number;
}

const MainToolbar: React.FC<MainToolbarProps> = ({
  score,
  isLoading,
  currentThemeName,
  currentSceneExists,
  onOpenInfo,
  onOpenVisualizer,
  onOpenKnowledgeBase,
  onOpenThemeMemory, 
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
          className="flex items-center p-2 border border-amber-500 rounded-md shadow-md"
          title={`Score: ${score} points`}
          aria-label={`Current score: ${score} points`}
        >
          <CoinIcon className="w-5 h-5 mr-2 text-amber-400" />
          <span className="text-amber-400 font-semibold text-lg">{score}</span>
        </div>
        {currentThemeName && (
          <div 
            className="flex items-center p-2 border border-indigo-500 rounded-md shadow-md"
            title={`Turns since last reality shift: ${turnsSinceLastShift}`}
            aria-label={`Turns since last reality shift: ${turnsSinceLastShift}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-indigo-400 font-semibold text-lg">{turnsSinceLastShift}</span>
          </div>
        )}
      </div>


      {/* Icon Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={onOpenInfo}
          disabled={isLoading}
          className="p-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-md shadow-md
                    disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                    transition-colors duration-150"
          title="Open Game Info & Guide"
          aria-label="Open Game Info & Guide"
        >
          <InfoIcon />
        </button>
        <button
          onClick={onOpenVisualizer}
          disabled={isLoading || !currentThemeName || !currentSceneExists}
          className="p-2 bg-blue-700 hover:bg-blue-600 text-white rounded-md shadow-md
                    disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                    transition-colors duration-150"
          title="Visualize Scene"
          aria-label="Visualize Scene"
        >
          <VisualizeIcon />
        </button>
        <button
          onClick={onOpenKnowledgeBase}
          disabled={isLoading || !currentThemeName}
          className="p-2 bg-blue-700 hover:bg-blue-600 text-white rounded-md shadow-md
                    disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                    transition-colors duration-150"
          title="Open Knowledge Base"
          aria-label="Open Knowledge Base"
        >
          <BookOpenIcon />
        </button>
        <button
          onClick={onOpenThemeMemory} 
          disabled={isLoading || !currentThemeName}
          className="p-2 bg-blue-700 hover:bg-blue-600 text-white rounded-md shadow-md 
                    disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                    transition-colors duration-150"
          title="View Echoes of Past Realities"
          aria-label="View Echoes of Past Realities"
        >
          <ScrollIcon />
        </button>
        <button
          onClick={onOpenMap}
          disabled={isLoading || !currentThemeName}
          className="p-2 bg-blue-700 hover:bg-blue-600 text-white rounded-md shadow-md
                    disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                    transition-colors duration-150"
          title="Open Map"
          aria-label="Open Map"
        >
          <MapIcon />
        </button>
        <button
          onClick={onManualRealityShift}
          disabled={isLoading || !currentThemeName}
          className="p-2 bg-purple-700 hover:bg-purple-600 text-white rounded-md shadow-md
                    disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                    transition-colors duration-150"
          title="Force Reality Shift"
          aria-label="Force Reality Shift"
        >
          <RealityShiftIcon />
        </button>
        <button
          onClick={onOpenTitleMenu}
          disabled={isLoading}
          className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md shadow-md
                    disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                    transition-colors duration-150"
          title="Open Title Menu"
          aria-label="Open Title Menu"
        >
          <MenuIcon />
        </button>
      </div>
    </div>
  );
};

export default MainToolbar;
