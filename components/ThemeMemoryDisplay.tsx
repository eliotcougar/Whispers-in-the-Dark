

/**
 * @file ThemeMemoryDisplay.tsx
 * @description Displays memory of previously visited themes.
 */
import React from 'react';
import { ThemeHistoryState } from '../types';

interface ThemeMemoryDisplayProps {
  themeHistory: ThemeHistoryState;
  // mapData?: MapNode[]; // If we need to look up MapNode details by placeName from ThemeMemory
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Displays a history of themes the player has explored.
 */
const ThemeMemoryDisplay: React.FC<ThemeMemoryDisplayProps> = ({
  themeHistory, 
  isVisible, 
  onClose,
  // mapData // If needed in future
}) => {
  const rememberedThemes = Object.entries(themeHistory);

  return (
    <div className={`animated-frame ${isVisible ? 'open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="theme-memory-title">
      <div className="animated-frame-content">
        <button
          onClick={onClose}
          className="animated-frame-close-button"
          aria-label="Close echoes of past realities"
        >
          &times;
        </button>
        <div className="theme-memory-content-area"> 
          <h1 id="theme-memory-title" className="text-3xl font-bold text-purple-400 mb-6 text-center">
            Echoes of Past Realities
          </h1>
          
          {rememberedThemes.length === 0 && (
            <p className="text-slate-400 italic text-center">No alternate timelines have been chronicled yet.</p>
          )}

          {rememberedThemes.length > 0 && (
            <ul className="space-y-4">
              {rememberedThemes.map(([themeName, memory]) => (
                <li 
                  key={themeName} 
                  className="text-slate-300 bg-slate-700/80 p-4 rounded-lg shadow-lg border border-slate-600 transition-all hover:shadow-purple-500/40 hover:border-purple-500"
                >
                  <h4 className="font-semibold text-xl text-purple-300 mb-2">{themeName}</h4>
                  {memory.summary && memory.summary !== "The details of this reality are hazy..." ? (
                    <p className="text-sm text-slate-300 mb-2 italic leading-relaxed">&ldquo;{memory.summary}&rdquo;</p>
                  ) : (
                    <p className="text-sm text-slate-400 mb-2 italic">The memories of this reality are too fragmented to recall clearly.</p>
                  )}
                  {/* 
                  Future enhancements could include looking up MapNode details using memory.placeNames from mapData.
                  Currently, memory.placeNames are just strings (MapNode.placeName).
                  <p className="text-xs text-slate-400">Main Quest: {memory.mainQuest}</p>
                  <p className="text-xs text-slate-400">Objective: {memory.currentObjective}</p>
                  {memory.placeNames.length > 0 && <p className="text-xs text-slate-400">Recalled Places: {memory.placeNames.join(', ')}</p>}
                  {memory.characterNames.length > 0 && <p className="text-xs text-slate-400">Recalled Characters: {memory.characterNames.join(', ')}</p>}
                  */}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ThemeMemoryDisplay;
