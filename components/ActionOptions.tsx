

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
  readonly onActionSelect: (action: string) => void;
  readonly disabled: boolean;
  readonly inventory: Array<Item>;
  readonly mapData: Array<MapNode>;
  readonly allNPCs: Array<NPC>;
  readonly queuedActions: Array<{ id: string; text: string; effect?: () => void }>;
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


  const queuedText = queuedActions.map(a => a.text).join(', ');

  const executeQueuedOnly = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      queuedActions.forEach(a => a.effect?.());
      onActionSelect(queuedText);
      onClearQueuedActions();
      event.currentTarget.blur();
    },
    [queuedActions, onActionSelect, onClearQueuedActions, queuedText]
  );

  const handleOptionClick = useCallback(
    (action: string) => (event: React.MouseEvent<HTMLButtonElement>) => {
      const combined = queuedText ? `${queuedText}, and ${action}` : action;
      queuedActions.forEach(a => a.effect?.());
      onActionSelect(combined);
      onClearQueuedActions();
      event.currentTarget.blur();
    },
    [queuedActions, onActionSelect, onClearQueuedActions, queuedText]
  );

  return (
    <div className="mt-6">
      {queuedActions.length > 0 ? (
        <div className="mb-3">
          <Button
            ariaLabel={queuedText}
            disabled={disabled}
            label={<>{highlightEntitiesInText(queuedText, entitiesForHighlighting)}</>}
            onClick={executeQueuedOnly}
            preset="teal"
            size="lg"
            variant="standard"
          />
        </div>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {options.map(option => (
          <Button
            ariaLabel={option}
            disabled={disabled || option === '...'}
            key={option}
            label={<>{highlightEntitiesInText(option, entitiesForHighlighting)}</>}
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
