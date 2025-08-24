

/**
 * @file ActionOptions.tsx
 * @description Renders the list of actions the Player can choose from.
 */

import { useMemo, useCallback } from 'react';

import * as React from 'react';
import { Item, NPC, MapNode } from '../types';
import { highlightEntitiesInText, buildHighlightableEntities } from '../utils/highlightHelper';
import Button from './elements/Button';

interface ActionOptionsProps {
  readonly options: Array<string>;
  readonly onActionSelect: (action: string) => void | Promise<void>;
  readonly disabled: boolean;
  readonly inventory: Array<Item>;
  readonly mapData: Array<MapNode>;
  readonly allNPCs: Array<NPC>;
  readonly queuedActions: Array<{
    id: string;
    displayText: string;
    promptText: string;
    cost: number;
    effect?: () => void;
  }>;
  readonly onClearQueuedActions: () => void;
}

/**
 * Component that displays all available actions as buttons.
 * Calls `onActionSelect` with the chosen action when a button is clicked.
 */
function ActionOptions({
  options,
  onActionSelect,
  disabled,
  inventory,
  mapData,
  allNPCs,
  queuedActions,
  onClearQueuedActions,
}: ActionOptionsProps) {

  const entitiesForHighlighting = useMemo(
    () => buildHighlightableEntities(inventory, mapData, allNPCs),
    [inventory, mapData, allNPCs]
  );


  const queuedDisplayText = queuedActions.map(a => a.displayText).join(', ');
  const queuedPromptText = queuedActions
    .map(a => `  - ${a.promptText}`)
    .join('\n');

  const executeQueuedOnly = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      queuedActions.forEach(a => a.effect?.());
      void onActionSelect(queuedPromptText);
      onClearQueuedActions();
      event.currentTarget.blur();
    },
    [queuedActions, onActionSelect, onClearQueuedActions, queuedPromptText],
  );

  const handleOptionClick = useCallback(
    (action: string) => (event: React.MouseEvent<HTMLButtonElement>) => {
      const combined = queuedPromptText
        ? `${queuedPromptText}\n  - ${action}`
        : `  - ${action}`;
      queuedActions.forEach(a => a.effect?.());
      void onActionSelect(combined);
      onClearQueuedActions();
      event.currentTarget.blur();
    },
    [queuedActions, onActionSelect, onClearQueuedActions, queuedPromptText],
  );

  return (
    <div className="mt-6">
      {queuedActions.length > 0 ? (
        <>
          <div className="mb-3">
            <Button
              ariaLabel={queuedDisplayText}
              disabled={disabled}
              label={<>
                {highlightEntitiesInText(queuedDisplayText, entitiesForHighlighting)}
              </>}
              onClick={executeQueuedOnly}
              preset="teal"
              size="lg"
              variant="standard"
            />
          </div>

          <div
            className="mb-3 flex items-center"
            role="separator"
          >
            <span className="flex-grow border-b border-slate-500" />

            <span className="px-2 text-slate-300">
              AND
            </span>

            <span className="flex-grow border-b border-slate-500" />
          </div>
        </>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {options.map(option => (
          <Button
            ariaLabel={option}
            disabled={disabled || option === '...'}
            key={option}
            label={<>
              {highlightEntitiesInText(option, entitiesForHighlighting)}
            </>}
            onClick={handleOptionClick(option)}
            preset="sky"
            size="lg"
            variant="standard"
          />
        ))}
      </div>
    </div>
  );
}

export default ActionOptions;
