
/**
 * @file DialogueDisplay.tsx
 * @description Renders dialogue history and choice options.
 */
import { useEffect, useRef, useMemo, useCallback } from 'react';

import * as React from 'react';
import { DialogueHistoryEntry, Item, NPC, MapNode } from '../types';
import { highlightEntitiesInText, buildHighlightableEntities } from '../utils/highlightHelper';
import LoadingSpinner from './LoadingSpinner';
import ModelUsageIndicators from './ModelUsageIndicators';
import Button from './elements/Button';
import { Icon } from './elements/icons';

interface DialogueDisplayProps {
  readonly isVisible: boolean;
  readonly onClose: () => void; 
  readonly history: Array<DialogueHistoryEntry>;
  readonly options: Array<string>;
  readonly onOptionSelect: (option: string) => void;
  readonly participants: Array<string>;
  readonly isLoading: boolean; 
  readonly isDialogueExiting?: boolean;
  readonly inventory: Array<Item>;
  readonly mapData: Array<MapNode>;
  readonly allNPCs: Array<NPC>;
}

/**
 * Renders dialogue history and available dialogue options.
 */
function DialogueDisplay({
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
  allNPCs: allNPCs,
}: DialogueDisplayProps) {
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
            (isDialogueExiting === true || options.length === 0);

        if (shouldScrollToBottom) {
            frame.scrollTo({ top: frame.scrollHeight, behavior: 'smooth' });
        }
    }
  }, [isLoading, isDialogueExiting, options.length, isVisible, history.length]);

  const entitiesForHighlighting = useMemo(
    () => buildHighlightableEntities(inventory, mapData, allNPCs),
    [inventory, mapData, allNPCs]
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
      return <LoadingSpinner />;
    }

    if (options.length > 0) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {options.map(option => (
            <Button
              ariaLabel={option}
              data-option={option}
              disabled={optionsDisabled}
              enableHighlightTap
              highlightEntities={entitiesForHighlighting}
              key={option}
              label={option}
              onClick={handleOptionClick}
              preset="sky"
              size="md"
              variant="standard"
            />
          ))}
        </div>
      );
    }
  };


  return (
    <div
      aria-labelledby="dialogue-title"
      aria-modal="true"
      className="dialogue-frame open"
      ref={dialogueFrameRef}
      role="dialog"
    >
      <div className="dialogue-frame-content">
        <Button
          ariaLabel="End Conversation"
          disabled={isLoading || isDialogueExiting}
          icon={<Icon
            name="x"
            size={20}
          />}
          onClick={onClose}
          size="sm"
          variant="close"
        />

        <h1
          className="text-2xl font-bold text-sky-300 mb-4 text-center"
          id="dialogue-title"
        >
          Conversation with: 
          {' '}

          {participantsString}
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
                  {entry.speaker}
                  :
                </strong>

                <span className="text-slate-100 ml-2">
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
}

DialogueDisplay.defaultProps = {
  isDialogueExiting: false
};

export default DialogueDisplay;
