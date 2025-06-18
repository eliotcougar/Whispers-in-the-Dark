/**
 * @file HistoryDisplay.tsx
 * @description Shows the game log and memory of previously visited realities.
*/
import { ThemeHistoryState } from '../types';
import GameLogDisplay from './GameLogDisplay';

interface HistoryDisplayProps {
  readonly themeHistory: ThemeHistoryState;
  readonly gameLog: string[];
  // mapData?: MapNode[]; // If we need to look up MapNode details by placeName from ThemeMemory
  readonly isVisible: boolean;
  readonly onClose: () => void;
}

/**
 * Displays the game log and a history of themes the player has explored.
*/
function HistoryDisplay({
  themeHistory,
  gameLog,
  isVisible,
  onClose,
  // mapData // If needed in future
}: HistoryDisplayProps) {
  const rememberedThemes = Object.entries(themeHistory);

  return (
    <div
      aria-labelledby="history-title"
      aria-modal="true"
      className={`animated-frame ${isVisible ? 'open' : ''}`}
      role="dialog"
    >
      <div className="animated-frame-content">
        <button
          aria-label="Close history"
          className="animated-frame-close-button"
          onClick={onClose}
        >
          &times;
        </button>

        <div className="theme-memory-content-area">
          <h1
            className="text-3xl font-bold text-purple-400 mb-6 text-center"
            id="history-title"
          >
            History
          </h1>

          <GameLogDisplay messages={gameLog} />

          <h2 className="text-2xl font-semibold text-purple-300 mt-8 mb-4 text-center">
            Echoes of Past Realities
          </h2>
          
          {rememberedThemes.length === 0 && (
            <p className="text-slate-400 italic text-center">
              No alternate timelines have been chronicled yet.
            </p>
          )}

          {rememberedThemes.length > 0 && (
            <ul className="space-y-4">
              {rememberedThemes.map(([themeName, memory]) => (
                <li 
                  className="text-slate-300 bg-slate-700/80 p-4 rounded-lg shadow-lg border border-slate-600 transition-all hover:shadow-purple-500/40 hover:border-purple-500" 
                  key={themeName}
                >
                  <h4 className="font-semibold text-xl text-purple-300 mb-2">
                    {themeName}
                  </h4>

                  {memory.summary && memory.summary !== "The details of this reality are hazy..." ? (
                    <p className="text-sm text-slate-300 mb-2 italic leading-relaxed">
                      &ldquo;
                      {memory.summary}
                      &rdquo;
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 mb-2 italic">
                      The memories of this reality are too fragmented to recall clearly.
                    </p>
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
}

export default HistoryDisplay;
