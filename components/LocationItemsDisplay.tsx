import React from 'react';
import { Item } from '../types';
import { InventoryIcon } from './icons';
import { ItemTypeDisplay } from './InventoryDisplay';

interface LocationItemsDisplayProps {
  items: Item[];
  onTakeItem: (itemName: string) => void;
  disabled: boolean;
}

const LocationItemsDisplay: React.FC<LocationItemsDisplayProps> = ({ items, onTakeItem, disabled }) => {
  if (items.length === 0) return null;

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
      <h3 className="text-xl font-bold text-amber-400 mb-2 border-b-2 border-amber-700 pb-2 flex items-center">
        <InventoryIcon /> Items Here
      </h3>
      <ul className="flex flex-wrap justify-center gap-4 list-none p-0">
        {items.map((item) => {
          const description = item.isActive && item.activeDescription ? item.activeDescription : item.description;
          return (
            <li
              key={item.name}
              className="w-[270px] text-slate-300 bg-slate-700/60 p-4 rounded-md shadow border border-slate-600 flex flex-col"
            >
              <div className="flex justify-between items-center mb-1 text-xs">
                <ItemTypeDisplay type={item.type} />
                {item.isActive && <span className="text-green-400 font-semibold">Active</span>}
              </div>
              <div className="mb-1">
                <span className="font-semibold text-lg text-slate-100">{item.name}</span>
              </div>
              <p className="text-sm text-slate-300 mb-3 italic leading-tight flex-grow">{description}</p>
              <div className="mt-auto">
                <button
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                    onTakeItem(item.name);
                    event.currentTarget.blur();
                  }}
                  disabled={disabled}
                  className="w-full text-sm bg-sky-700 hover:bg-sky-600 text-white font-medium py-1.5 px-3 rounded shadow disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out"
                  aria-label={`Take ${item.name}`}
                >
                  Take
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
