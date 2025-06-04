
/**
 * @file InventoryDisplay.tsx
 * @description Shows the Player's items and handles interactions.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Item, KnownUse } from '../types';
import { InventoryIcon, TrashIcon } from './icons.tsx';

interface InventoryDisplayProps {
  items: Item[];
  onItemInteract: (item: Item, interactionType: 'generic' | 'specific' | 'inspect', knownUse?: KnownUse) => void;
  onDiscardJunkItem: (itemName: string) => void; 
  disabled: boolean;
}

type SortOrder = 'default' | 'name' | 'type';

export const ItemTypeDisplay: React.FC<{ type: Item['type'] }> = ({ type }) => {
  let color = 'text-slate-400'; // Default
  if (type === 'single-use') color = 'text-red-400';
  else if (type === 'multi-use') color = 'text-yellow-400';
  else if (type === 'equipment') color = 'text-sky-400';
  else if (type === 'container') color = 'text-orange-400';
  else if (type === 'key') color = 'text-lime-400';
  else if (type === 'ammunition') color = 'text-cyan-400';
  else if (type === 'vehicle') color = 'text-indigo-400';
  else if (type === 'knowledge') color = 'text-purple-400';
  else if (type === 'status effect') color = 'text-pink-400';
  
  return <span className={`text-xs italic ${color}`}>{type}</span>;
};

const InventoryDisplay: React.FC<InventoryDisplayProps> = ({ items, onItemInteract, onDiscardJunkItem, disabled }) => {
  const [newlyAddedItemNames, setNewlyAddedItemNames] = useState<Set<string>>(new Set());
  const prevItemsRef = useRef<Item[]>(items);
  const [confirmingDiscardItemName, setConfirmingDiscardItemName] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');


  useEffect(() => {
    const currentItemNames = new Set(items.map(item => item.name));
    const prevItemNames = new Set(prevItemsRef.current.map(item => item.name));
    const added: string[] = [];

    currentItemNames.forEach(name => {
      if (!prevItemNames.has(name)) {
        added.push(name);
      }
    });

    if (added.length > 0) {
      setNewlyAddedItemNames(currentAnimatingItems => {
        const newSet = new Set(currentAnimatingItems);
        added.forEach(name => newSet.add(name));
        return newSet;
      });

      added.forEach(name => {
        setTimeout(() => {
          setNewlyAddedItemNames(currentAnimatingItems => {
            const updatedSet = new Set(currentAnimatingItems);
            updatedSet.delete(name);
            return updatedSet;
          });
        }, 1500); 
      });
    }
    prevItemsRef.current = items;
  }, [items]);

  const displayedItems = useMemo(() => {
    let itemsToDisplay = [...items]; 

    if (sortOrder === 'name') {
      itemsToDisplay.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === 'type') {
      itemsToDisplay.sort((a, b) => {
        const typeCompare = a.type.localeCompare(b.type);
        if (typeCompare !== 0) {
          return typeCompare;
        }
        return a.name.localeCompare(b.name);
      });
    } else { // 'default' sort order
      itemsToDisplay.reverse(); // Newest first
    }
    return itemsToDisplay;
  }, [items, sortOrder]);


  const getApplicableKnownUses = (item: Item): KnownUse[] => {
    if (!item.knownUses) return [];
    return item.knownUses.filter(ku => {
      const isActive = !!item.isActive; 

      if (ku.appliesWhenActive !== undefined && ku.appliesWhenInactive !== undefined) {
        return (ku.appliesWhenActive && isActive) || (ku.appliesWhenInactive && !isActive);
      }
      if (ku.appliesWhenActive !== undefined) {
        return ku.appliesWhenActive === isActive;
      }
      if (ku.appliesWhenInactive !== undefined) {
        return ku.appliesWhenInactive === !isActive;
      }
      return true;
    });
  };

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700 h-full">
      <h3 className="text-xl font-bold text-amber-400 mb-2 border-b-2 border-amber-700 pb-2 flex items-center">
        <InventoryIcon /> Inventory
      </h3>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
            setSortOrder(prev => prev === 'name' ? 'default' : 'name');
            event.currentTarget.blur();
          }}
          disabled={disabled}
          className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded shadow transition-colors duration-150
                      ${sortOrder === 'name'
                        ? 'bg-sky-600 text-white hover:bg-sky-500 ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-800'
                        : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      } disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed disabled:ring-0`}
          aria-pressed={sortOrder === 'name'}
        >
          Sort by Name
        </button>
        <button
          onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
            setSortOrder(prev => prev === 'type' ? 'default' : 'type');
            event.currentTarget.blur();
          }}
          disabled={disabled}
          className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded shadow transition-colors duration-150
                      ${sortOrder === 'type'
                        ? 'bg-sky-600 text-white hover:bg-sky-500 ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-800'
                        : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      } disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed disabled:ring-0`}
          aria-pressed={sortOrder === 'type'}
        >
          Sort by Type
        </button>
      </div>

      {displayedItems.length === 0 ? (
        <p className="text-slate-400 italic">Your pockets are empty.</p>
      ) : (
        <ul className="flex flex-wrap justify-center gap-4 list-none p-0">
          {displayedItems.map((item) => {
            const displayDescription = item.isActive && item.activeDescription ? item.activeDescription : item.description;
            const applicableUses = getApplicableKnownUses(item);
            const isNew = newlyAddedItemNames.has(item.name);
            const isConfirmingDiscard = confirmingDiscardItemName === item.name;

            return (
              <li 
                key={item.name} 
                className={`w-[270px] text-slate-300 bg-slate-700/60 p-4 rounded-md shadow border border-slate-600 ${isNew ? 'animate-new-item-pulse' : ''} flex flex-col`} 
              >
                <div className="flex justify-between items-center mb-1 text-xs"> {/* New top row */}
                  <ItemTypeDisplay type={item.type} />
                  {item.isActive && <span className="text-green-400 font-semibold">Active</span>}
                </div>
                <div className="mb-1"> {/* Name row */}
                  <span className="font-semibold text-lg text-slate-100">
                    {item.name}
                  </span>
                </div>

                <p className="text-sm text-slate-300 mb-3 italic leading-tight flex-grow">{displayDescription}</p> 
                {item.isJunk && <p className="text-xs text-orange-400 mb-1 italic">(Marked as junk)</p>}


                <div className="space-y-2 mt-auto"> 
                  {applicableUses.map((knownUse) => (
                    <button
                      key={`${item.name}-knownuse-${knownUse.actionName}`}
                      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                        onItemInteract(item, 'specific', knownUse);
                        event.currentTarget.blur();
                      }}
                      disabled={disabled || isConfirmingDiscard}
                      className="w-full text-sm bg-teal-600 hover:bg-teal-500 text-white font-medium py-1.5 px-3 rounded shadow
                                 disabled:bg-slate-500 disabled:text-slate-400 disabled:cursor-not-allowed
                                 transition-colors duration-150 ease-in-out"
                      aria-label={`${knownUse.actionName}${knownUse.description ? ': ' + knownUse.description : ''}`}
                      title={knownUse.description}
                    >
                      {knownUse.actionName}
                    </button>
                  ))}

                  <button
                    key={`${item.name}-inspect`}
                    onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                      onItemInteract(item, 'inspect');
                      event.currentTarget.blur();
                    }}
                    disabled={disabled || isConfirmingDiscard}
                    className="w-full text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-1.5 px-3 rounded shadow
                               disabled:bg-slate-500 disabled:text-slate-400 disabled:cursor-not-allowed
                               transition-colors duration-150 ease-in-out"
                    aria-label={`Inspect ${item.name}`}
                  >
                    Inspect
                  </button>

                  {(item.type !== 'knowledge' && item.type !== 'status effect' && item.type !== 'vehicle') && (
                    <button
                      key={`${item.name}-generic-use`}
                      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                        onItemInteract(item, 'generic');
                        event.currentTarget.blur();
                      }}
                      disabled={disabled || isConfirmingDiscard}
                      className="w-full text-sm bg-sky-700 hover:bg-sky-600 text-white font-medium py-1.5 px-3 rounded shadow
                                disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                                transition-colors duration-150 ease-in-out"
                      aria-label={`Attempt to use ${item.name} (generic action)`}
                    >
                      Attempt to Use (Generic)
                    </button>
                  )}
                  {item.type === 'vehicle' && (
                    <button
                      key={`${item.name}-vehicle-action`}
                      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                        const actionName = item.isActive ? `Exit ${item.name}` : `Enter ${item.name}`;
                        const dynamicKnownUse: KnownUse = {
                          actionName: actionName,
                          promptEffect: actionName,
                        };
                        onItemInteract(item, 'specific', dynamicKnownUse);
                        event.currentTarget.blur();
                      }}
                      disabled={disabled || isConfirmingDiscard}
                      className="w-full text-sm bg-green-700 hover:bg-green-600 text-white font-medium py-1.5 px-3 rounded shadow
                                disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                                transition-colors duration-150 ease-in-out"
                      aria-label={item.isActive ? `Exit ${item.name}` : `Enter ${item.name}`}
                    >
                      {item.isActive ? `Exit ${item.name}` : `Enter ${item.name}`}
                    </button>
                  )}

                  {item.isJunk && !isConfirmingDiscard && (
                     <button
                        key={`${item.name}-discard`}
                        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                          setConfirmingDiscardItemName(item.name);
                          event.currentTarget.blur();
                        }}
                        disabled={disabled}
                        className="w-full text-sm bg-orange-700 hover:bg-orange-600 text-white font-medium py-1.5 px-3 rounded shadow
                                   disabled:bg-slate-500 disabled:text-slate-400 disabled:cursor-not-allowed
                                   transition-colors duration-150 ease-in-out flex items-center justify-center"
                        aria-label={`Discard ${item.name}`}
                      >
                        <TrashIcon /> Discard
                      </button>
                  )}
                  {isConfirmingDiscard && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                       <button
                        key={`${item.name}-confirm-discard`}
                        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                          onDiscardJunkItem(item.name);
                          setConfirmingDiscardItemName(null);
                          event.currentTarget.blur();
                        }}
                        disabled={disabled}
                        className="w-full text-sm bg-red-600 hover:bg-red-500 text-white font-semibold py-1.5 px-3 rounded shadow
                                   disabled:bg-slate-500 disabled:cursor-not-allowed
                                   transition-colors duration-150 ease-in-out"
                        aria-label={`Confirm discard of ${item.name}`}
                      >
                        Confirm Discard
                      </button>
                      <button
                        key={`${item.name}-cancel-discard`}
                        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                          setConfirmingDiscardItemName(null);
                          event.currentTarget.blur();
                        }}
                        disabled={disabled}
                        className="w-full text-sm bg-slate-600 hover:bg-slate-500 text-white font-medium py-1.5 px-3 rounded shadow
                                   disabled:bg-slate-500 disabled:cursor-not-allowed
                                   transition-colors duration-150 ease-in-out"
                        aria-label="Cancel discard"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default InventoryDisplay;
