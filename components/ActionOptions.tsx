

/**
 * @file ActionOptions.tsx
 * @description Renders the list of actions the Player can choose from.
 */

import React, { useMemo, useCallback } from 'react';
import { Item, Character, MapNode } from '../types'; 
import { highlightEntitiesInText, buildHighlightableEntities } from '../utils/highlightHelper';

interface ActionOptionsProps {
  readonly options: string[];
  readonly onActionSelect: (action: string) => void;
  readonly disabled: boolean;
  readonly inventory: Item[];
  readonly mapData: MapNode[];
  readonly allCharacters: Character[];
  readonly currentThemeName: string | null;
}

/**
 * Component that displays all available actions as buttons.
 * Calls `onActionSelect` with the chosen action when a button is clicked.
 */
const ActionOptions: React.FC<ActionOptionsProps> = ({
  options,
  onActionSelect,
  disabled,
  inventory,
  mapData,
  allCharacters,
  currentThemeName 
}) => {

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((option, index) => (
          <button
            className={`w-full p-4 rounded-lg shadow-md transition-all duration-150 ease-in-out
                        text-left text-white font-medium text-lg 
                        bg-sky-700 hover:bg-sky-600 focus:ring-4 focus:ring-sky-500 focus:outline-none
                        disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                        border border-sky-800 hover:border-sky-500
                        transform hover:scale-105 disabled:transform-none`} 
            disabled={disabled || option === "..."}
            key={option}
            onClick={handleOptionClick(option)}
          >
            {index + 1}. {highlightEntitiesInText(option, entitiesForHighlighting)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ActionOptions;
