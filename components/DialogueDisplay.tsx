
/**
 * @file DialogueDisplay.tsx
 * @description Renders dialogue history and choice options.
 */
import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { DialogueHistoryEntry, Item, Character, MapNode, LoadingReason } from '../types'; 
import { highlightEntitiesInText, buildHighlightableEntities } from '../utils/highlightHelper';
import LoadingSpinner from './LoadingSpinner';
import ModelUsageIndicators from './ModelUsageIndicators';

interface DialogueDisplayProps {
  readonly isVisible: boolean;
  readonly onClose: () => void; 
  readonly history: DialogueHistoryEntry[];
  readonly options: string[];
  readonly onOptionSelect: (option: string) => void;
  readonly participants: string[];
  readonly isLoading: boolean; 
  readonly isDialogueExiting?: boolean;
  readonly inventory: Item[];
  readonly mapData: MapNode[]; 
  readonly allCharacters: Character[];
  readonly currentThemeName: string | null;
  readonly loadingReason: LoadingReason | null; // Added prop
}

/**
 * Renders dialogue history and available dialogue options.
 */
const DialogueDisplay: React.FC<DialogueDisplayProps> = ({
  isVisible,
  onClose,
  history,
  options,
  onOptionSelect,
  participants,
  isLoading,
  isDialogueExiting,
  inventory,
  mapData, 
  allCharacters,
  currentThemeName,
  loadingReason, // Destructure prop
}) => {
  const dialogueFrameRef = useRef<HTMLDivElement | null>(null); 
  const lastHistoryEntryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isVisible && lastHistoryEntryRef.current) {
      lastHistoryEntryRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [history, isVisible]);


  useEffect(() => {
    if (!isVisible) return;

    const frame = dialogueFrameRef.current;
    if (frame) {
        const shouldScrollToBottom = isLoading && 
            (isDialogueExiting || (!isDialogueExiting && options.length === 0));

        if (shouldScrollToBottom) {
            frame.scrollTo({ top: frame.scrollHeight, behavior: 'smooth' });
        }
    }
  }, [isLoading, isDialogueExiting, options.length, isVisible, history.length]);

  const entitiesForHighlighting = useMemo(
    () => buildHighlightableEntities(inventory, mapData, allCharacters, currentThemeName),
    [inventory, mapData, allCharacters, currentThemeName]
  );


  const participantsString = participants.join(', ');
  const optionsDisabled = isLoading || isDialogueExiting;

  const handleOptionClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const option = event.currentTarget.dataset.option;
      if (option) {
        onOptionSelect(option);
        event.currentTarget.blur();
      }
    },
    [onOptionSelect]
  );

  if (!isVisible) return null;

  const renderOptionsArea = () => {
    if (isDialogueExiting || isLoading) {
      return <LoadingSpinner loadingReason={loadingReason} />;
    }

    if (options.length > 0) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {options.map(option => (
            <button
              className={`w-full p-3 rounded-md shadow transition-all duration-150 ease-in-out
                          text-left text-white font-medium animate-dialogue-new-entry
                          bg-sky-700 hover:bg-sky-600 focus:ring-2 focus:ring-sky-500 focus:outline-none
                          disabled:bg-slate-500 disabled:text-slate-400 disabled:cursor-not-allowed
                          border border-sky-800 hover:border-sky-500`}
              data-option={option}
              disabled={optionsDisabled}
              key={option}
              onClick={handleOptionClick}
            >
              {highlightEntitiesInText(option, entitiesForHighlighting)}
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="text-center py-4">
        <p className="text-slate-400 italic">Waiting for response or options...</p>

        <button
          className="mt-2 px-4 py-2 text-sm bg-red-700 hover:bg-red-600 text-white font-medium rounded shadow" 
          onClick={onClose}
          >
          Force End Conversation (if really stuck)
        </button>
      </div>
    );
  };


  return (
    <div aria-labelledby="dialogue-title" aria-modal="true" className="dialogue-frame open" ref={dialogueFrameRef} role="dialog">
      <div className="dialogue-frame-content">
        <button
          aria-label="End Conversation"
          className="animated-frame-close-button" 
          disabled={isLoading || isDialogueExiting} // Updated disabled condition
          onClick={onClose}
        >
          &times;
        </button>

        <h1 className="text-2xl font-bold text-sky-300 mb-4 text-center" id="dialogue-title">
          Conversation with: {participantsString}
        </h1>

        <div className="dialogue-log-area flex-grow mb-4 pr-2 min-h-[200px] overflow-y-auto"> 
          {history.map((entry, index) => {
            const isPlayer = entry.speaker.toLowerCase() === 'player';
            return (
              <div
                className={`mb-3 p-3 rounded-lg animate-dialogue-new-entry ${isPlayer ? 'bg-slate-700 ml-auto w-11/12 text-right' : 'bg-slate-600 mr-auto w-11/12'}`}
                key={entry.line}
                ref={index === history.length - 1 ? lastHistoryEntryRef : null}
              >
                <strong className={isPlayer ? 'text-amber-400' : 'text-emerald-400'}>
                  {entry.speaker}:
                </strong>

                <span className="text-slate-200 ml-2">
                  {highlightEntitiesInText(entry.line, entitiesForHighlighting)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="dialogue-options-area mt-auto pt-4">
          <div className="flex items-center mb-2">
            <ModelUsageIndicators />

            <div className="flex-grow border-t border-slate-600 ml-2" />
          </div>

          {renderOptionsArea()}
        </div>
      </div>
    </div>
  );
};

export default DialogueDisplay;
