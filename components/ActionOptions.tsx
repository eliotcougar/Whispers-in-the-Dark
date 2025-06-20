

/**
 * @file ActionOptions.tsx
 * @description Renders the list of actions the Player can choose from.
 */

import { useMemo, useCallback } from 'react';

import * as React from 'react';
import { Item, Character, MapNode } from '../types';
import { highlightEntitiesInText, buildHighlightableEntities } from '../utils/highlightHelper';
import Button from './elements/Button';

interface ActionOptionsProps {
  readonly options: Array<string>;
  readonly onActionSelect: (action: string) => void;
  readonly disabled: boolean;
  readonly inventory: Array<Item>;
  readonly mapData: Array<MapNode>;
  readonly allCharacters: Array<Character>;
  readonly currentThemeName: string | null;
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
  allCharacters,
  currentThemeName
}: ActionOptionsProps) {

  const entitiesForHighlighting = useMemo(
    () => buildHighlightableEntities(inventory, mapData, allCharacters, currentThemeName),
    [inventory, mapData, allCharacters, currentThemeName]
  );


  const handleOptionClick = useCallback(
    (action: string) => (event: React.MouseEvent<HTMLButtonElement>) => {
      onActionSelect(action);
      event.currentTarget.blur();
    },
    [onActionSelect]
  );

  return (
    <div className="mt-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {options.map((option) => (
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
