

/**
 * @file ActionOptions.tsx
 * @description Renders the list of actions the Player can choose from.
 */

import React, { useMemo } from 'react';
import { Item, Character, MapNode } from '../types'; 
import { highlightEntitiesInText, HighlightableEntity } from '../utils/highlightHelper';

interface ActionOptionsProps {
  options: string[];
  onActionSelect: (action: string) => void;
  disabled: boolean;
  inventory: Item[];
  mapData: MapNode[];
  allCharacters: Character[];
  currentThemeName: string | null;
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

  const entitiesForHighlighting = useMemo((): HighlightableEntity[] => {
    const items: HighlightableEntity[] = inventory.map(item => ({ 
      name: item.name, 
      type: 'item',
      description: item.isActive && item.activeDescription ? item.activeDescription : item.description,
    }));

    // Derive places from mapData (main nodes)
    const places: HighlightableEntity[] = currentThemeName 
      ? mapData
          .filter(node => node.themeName === currentThemeName && !node.data.isLeaf) 
          .map(node => ({ 
            name: node.placeName, 
            type: 'place', 
            description: node.data.description || 'A location of interest.',
            aliases: node.data.aliases || []
          }))
      : [];
      
    const characters: HighlightableEntity[] = currentThemeName
      ? allCharacters.filter(c => c.themeName === currentThemeName).map(c => ({ 
          name: c.name, 
          type: 'character',
          description: c.description,
          aliases: c.aliases
        }))
      : [];
    return [...items, ...places, ...characters];
  }, [inventory, mapData, allCharacters, currentThemeName]);


  return (
    <div className="mt-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((option, index) => (
          <button
            key={option} 
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
              onActionSelect(option);
              event.currentTarget.blur(); 
            }}
            disabled={disabled || option === "..."}
            className={`w-full p-4 rounded-lg shadow-md transition-all duration-150 ease-in-out
                        text-left text-white font-medium text-lg 
                        bg-sky-700 hover:bg-sky-600 focus:ring-4 focus:ring-sky-500 focus:outline-none
                        disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                        border border-sky-800 hover:border-sky-500
                        transform hover:scale-105 disabled:transform-none`}
          >
            {index + 1}. {highlightEntitiesInText(option, entitiesForHighlighting)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ActionOptions;
