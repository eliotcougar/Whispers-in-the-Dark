import React, { useCallback } from 'react';
import { Item } from '../types';
import { InventoryIcon } from './icons';
import { ItemTypeDisplay } from './InventoryDisplay';

interface LocationItemsDisplayProps {
  readonly items: Item[];
  readonly onTakeItem: (itemName: string) => void;
  readonly disabled: boolean;
  readonly currentNodeId: string | null;
  readonly mapNodes: { id: string; placeName: string }[];
}

const LocationItemsDisplay: React.FC<LocationItemsDisplayProps> = ({ items, onTakeItem, disabled, currentNodeId, mapNodes }) => {
  const handleTakeItem = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const itemName = event.currentTarget.dataset.itemName;
      if (itemName) {
        onTakeItem(itemName);
        event.currentTarget.blur();
      }
    },
    [onTakeItem]
  );

  if (items.length === 0) return null;

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
      <h3 className="text-xl font-bold text-amber-400 mb-2 border-b-2 border-amber-700 pb-2 flex items-center">
        <InventoryIcon /> Items Here
      </h3>

      <ul className="flex flex-wrap justify-center gap-4 list-none p-0">
        {items.map((item) => {
          const description = item.isActive && item.activeDescription ? item.activeDescription : item.description;
          const atCurrent = item.holderId === currentNodeId;
          const holderName = !atCurrent ? mapNodes.find(n => n.id === item.holderId)?.placeName : null;
          return (
            <li
              className="w-[270px] text-slate-300 bg-slate-700/60 p-4 rounded-md shadow border border-slate-600 flex flex-col"
              key={item.name}
            >
              <div className="flex justify-between items-center mb-1 text-xs">
                <ItemTypeDisplay type={item.type} />

                {item.isActive ? <span className="text-green-400 font-semibold">Active</span> : null}
              </div>

              <div className="mb-1">
                <span className="font-semibold text-lg text-slate-100">{item.name}</span>
              </div>

              <p className="text-sm text-slate-300 mb-1 italic leading-tight flex-grow">{description}</p>

              {!atCurrent && holderName ? <p className="text-xs text-slate-400 mb-2">Reachable at {holderName}</p> : null}

              <div className="mt-auto">
                <button
                  aria-label={item.type === 'vehicle' ? `Enter ${item.name}` : `Take ${item.name}`}
                  className="w-full text-sm bg-green-700 hover:bg-green-600 text-white font-medium py-1.5 px-3 rounded shadow disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out"
                  data-item-name={item.name}
                  disabled={disabled}
                  onClick={handleTakeItem}
                >
                  {item.type === 'vehicle' ? 'Enter Vehicle' : 'Take'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default LocationItemsDisplay;
