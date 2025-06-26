/**
 * @file HistoryDisplay.tsx
 * @description Shows the game log and memory of previously visited realities.
*/
import { ThemeHistoryState } from '../../types';
import GameLogDisplay from '../GameLogDisplay';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';
import TextBox from '../elements/TextBox';

interface HistoryDisplayProps {
  readonly themeHistory: ThemeHistoryState;
  readonly gameLog: Array<string>;
  // mapData?: MapNode[]; // If we need to look up MapNode details by placeName from ThemeMemory
  readonly isVisible: boolean;
  readonly onClose: () => void;
  readonly onReadJournal: () => void;
  readonly onWriteJournal: () => void;
  readonly canWriteJournal: boolean;
}

/**
 * Displays the game log and a history of themes the player has explored.
*/
function HistoryDisplay({
  themeHistory,
  gameLog,
  isVisible,
  onClose,
  onReadJournal,
  onWriteJournal,
  canWriteJournal,
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
        <Button
          ariaLabel="Close history"
          icon={<Icon
            name="x"
            size={20}
          />}
          onClick={onClose}
          size="sm"
          variant="close"
        />


        <div className="theme-memory-content-area">
          <TextBox
            borderColorClass="border-purple-700"
            borderWidthClass="border-b-2"
            containerClassName="mt-4 mb-4"
            header="History"
            headerFont="2xl"
            headerPreset="purple"
            headerTag="h2"
            headerWrapperClassName="text-center"
          />

          <GameLogDisplay messages={gameLog} />

          <TextBox
            borderColorClass="border-purple-700"
            borderWidthClass="border-b-2"
            containerClassName="mt-4 mb-4"
            header="Echoes of Past Realities"
            headerFont="2xl"
            headerPreset="purple"
            headerTag="h2"
            headerWrapperClassName="text-center"
          />
          
          {rememberedThemes.length === 0 && (
            <p className="text-slate-300 italic text-center">
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
                    <p className="text-sm text-slate-300 mb-2 italic">
                      The memories of this reality are too fragmented to recall clearly.
                    </p>
                  )}
                </li>
              ))}
            </ul>
            )}

            <div className="flex justify-center gap-2 mt-4">
              <Button
                ariaLabel="Read journal"
                icon={<Icon name="bookOpen" size={20} />}
                label="Read Journal"
                onClick={onReadJournal}
                preset="blue"
                size="sm"
                variant="toolbar"
              />

              <Button
                ariaLabel="Write journal entry"
                disabled={!canWriteJournal}
                icon={<Icon name="log" size={20} />}
                label="Write Entry"
                onClick={onWriteJournal}
                preset="blue"
                size="sm"
                variant="toolbar"
              />
            </div>
          </div>
      </div>
    </div>
  );
}

export default HistoryDisplay;
