
/**
 * @file InventoryDisplay.tsx
 * @description Shows the Player's items and handles interactions.
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import * as React from 'react';
import { Item, KnownUse } from '../types';
import { Icon } from './icons.tsx';
import ItemActionButton from './ItemActionButton';
import ItemTypeDisplay from './ItemTypeDisplay';
import Button from './elements/Button';

interface InventoryDisplayProps {
  readonly items: Array<Item>;
  readonly onItemInteract: (item: Item, interactionType: 'generic' | 'specific' | 'inspect', knownUse?: KnownUse) => void;
  readonly onDropItem: (itemName: string) => void;
  readonly disabled: boolean;
}

type SortOrder = 'default' | 'name' | 'type';

/**
 * Shows the player's inventory and handles item interactions.
 */
function InventoryDisplay({ items, onItemInteract, onDropItem, disabled }: InventoryDisplayProps) {
  const [newlyAddedItemNames, setNewlyAddedItemNames] = useState<Set<string>>(new Set());
  const prevItemsRef = useRef<Array<Item>>(items);
  const [confirmingDiscardItemName, setConfirmingDiscardItemName] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');

  const handleSortByName = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setSortOrder(prev => (prev === 'name' ? 'default' : 'name'));
    event.currentTarget.blur();
  }, []);

  const handleSortByType = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setSortOrder(prev => (prev === 'type' ? 'default' : 'type'));
    event.currentTarget.blur();
  }, []);

  const handleStartConfirmDiscard = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const name = event.currentTarget.dataset.itemName;
    if (name) {
      setConfirmingDiscardItemName(name);
      event.currentTarget.blur();
    }
  }, []);

  const handleConfirmDrop = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const name = event.currentTarget.dataset.itemName;
    if (name) {
      onDropItem(name);
      setConfirmingDiscardItemName(null);
      event.currentTarget.blur();
    }
  }, [onDropItem]);

  const handleCancelDiscard = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setConfirmingDiscardItemName(null);
    event.currentTarget.blur();
  }, []);

  const handleSpecificUse = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const { itemName, actionName, promptEffect } = event.currentTarget.dataset;
      if (!itemName || !actionName || !promptEffect) return;
      const item = items.find(i => i.name === itemName);
      if (!item) return;
      const knownUse: KnownUse = {
        actionName,
        promptEffect,
      };
      onItemInteract(item, 'specific', knownUse);
      event.currentTarget.blur();
    },
    [items, onItemInteract]
  );

  const handleInspect = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const name = event.currentTarget.dataset.itemName;
      if (!name) return;
      const item = items.find(i => i.name === name);
      if (!item) return;
      onItemInteract(item, 'inspect');
      event.currentTarget.blur();
    },
    [items, onItemInteract]
  );

  const handleGenericUse = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const name = event.currentTarget.dataset.itemName;
      if (!name) return;
      const item = items.find(i => i.name === name);
      if (!item) return;
      onItemInteract(item, 'generic');
      event.currentTarget.blur();
    },
    [items, onItemInteract]
  );

  const handleVehicleToggle = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const name = event.currentTarget.dataset.itemName;
      if (!name) return;
      const item = items.find(i => i.name === name);
      if (!item) return;
      const actionName = item.isActive ? `Exit ${item.name}` : `Enter ${item.name}`;
      const dynamicKnownUse: KnownUse = {
        actionName,
        promptEffect: actionName,
      };
      onItemInteract(item, 'specific', dynamicKnownUse);
      event.currentTarget.blur();
    },
    [items, onItemInteract]
  );


  useEffect(() => {
    const currentItemNames = new Set(items.map(item => item.name));
    const prevItemNames = new Set(prevItemsRef.current.map(item => item.name));
    const added: Array<string> = [];

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
    const itemsToDisplay = [...items];

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


  /**
   * Filters known uses based on the item's active state.
   */
  const getApplicableKnownUses = (item: Item): Array<KnownUse> => {
    if (!item.knownUses) return [];
    return item.knownUses.filter(ku => {
      const isActive = !!item.isActive; 

      if (ku.appliesWhenActive !== undefined && ku.appliesWhenInactive !== undefined) {
        return (ku.appliesWhenActive && isActive) || (ku.appliesWhenInactive && !isActive) || (!ku.appliesWhenActive && !ku.appliesWhenInactive);
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
        <Icon
          color="amber"
          inline
          marginRight={8}
          name="inventory"
          size={20}
        />

        {' '}
        Inventory
      </h3>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          ariaLabel="Sort by Name"
          className={`${sortOrder === 'name' ? 'bg-sky-600 text-white hover:bg-sky-500 ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-800' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'} disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed disabled:ring-0`}
          disabled={disabled}
          label="Sort by Name"
          onClick={handleSortByName}
          pressed={sortOrder === 'name'}
          size="sm"
          variant="toggle"
        />

        <Button
          ariaLabel="Sort by Type"
          className={`${sortOrder === 'type' ? 'bg-sky-600 text-white hover:bg-sky-500 ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-800' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'} disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed disabled:ring-0`}
          disabled={disabled}
          label="Sort by Type"
          onClick={handleSortByType}
          pressed={sortOrder === 'type'}
          size="sm"
          variant="toggle"
        />
      </div>

      {displayedItems.length === 0 ? (
        <p className="text-slate-400 italic">
          Your pockets are empty.
        </p>
      ) : (
        <ul className="flex flex-wrap justify-center gap-4 list-none p-0">
          {displayedItems.map((item) => {
            const displayDescription = item.isActive && item.activeDescription ? item.activeDescription : item.description;
            const applicableUses = getApplicableKnownUses(item);
            const isNew = newlyAddedItemNames.has(item.name);
            const isConfirmingDiscard = confirmingDiscardItemName === item.name;

            return (
              <li 
                className={`w-[270px] text-slate-300 bg-slate-700/60 p-4 rounded-md shadow border border-slate-600 ${isNew ? 'animate-new-item-pulse' : ''} flex flex-col`} 
                key={item.name} 
              >
                <div className="flex justify-between items-center mb-1 text-xs"> 
                  {' '}

                  {/* New top row */}
                  <ItemTypeDisplay type={item.type} />

                  {item.isActive ? <span className="text-green-400 font-semibold">
                    Active
                  </span> : null}
                </div>

                <div className="mb-1"> 
                  {' '}

                  {/* Name row */}
                  <span className="font-semibold text-lg text-slate-100">
                    {item.name}
                  </span>
                </div>

                <p className="text-sm text-slate-300 mb-3 italic leading-tight flex-grow">
                  {displayDescription}
                </p> 

                {item.isJunk ? <p className="text-xs text-orange-400 mb-1 italic">
                  (Marked as junk)
                </p> : null}


                <div className="space-y-2 mt-auto"> 
                  {applicableUses.map((knownUse) => (
                    <Button
                      ariaLabel={`${knownUse.actionName}${knownUse.description ? ': ' + knownUse.description : ''}`}
                      className="w-full bg-teal-600 hover:bg-teal-500 text-white font-medium rounded shadow disabled:bg-slate-500 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out"
                      data-action-name={knownUse.actionName}
                      data-item-name={item.name}
                      data-prompt-effect={knownUse.promptEffect}
                      disabled={disabled || isConfirmingDiscard}
                      key={`${item.name}-knownuse-${knownUse.actionName}`}
                      label={knownUse.actionName}
                      onClick={handleSpecificUse}
                      size="sm"
                      title={knownUse.description}
                    />
                  ))}

                  <Button
                    ariaLabel={`Inspect ${item.name}`}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded shadow disabled:bg-slate-500 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out"
                    data-item-name={item.name}
                    disabled={disabled || isConfirmingDiscard}
                    key={`${item.name}-inspect`}
                    label="Inspect"
                    onClick={handleInspect}
                    size="sm"
                  />

                  {(item.type !== 'knowledge' && item.type !== 'status effect' && item.type !== 'vehicle') && (
                    <Button
                      ariaLabel={`Attempt to use ${item.name} (generic action)`}
                      className="w-full bg-sky-700 hover:bg-sky-600 text-white font-medium rounded shadow disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out"
                      data-item-name={item.name}
                      disabled={disabled || isConfirmingDiscard}
                      key={`${item.name}-generic-use`}
                      label="Attempt to Use (Generic)"
                      onClick={handleGenericUse}
                      size="sm"
                    />
                  )}

                  {item.type === 'vehicle' && (
                    <Button
                      ariaLabel={item.isActive ? `Exit ${item.name}` : `Enter ${item.name}`}
                      className="w-full bg-green-700 hover:bg-green-600 text-white font-medium rounded shadow disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out"
                      data-item-name={item.name}
                      disabled={disabled || isConfirmingDiscard}
                      key={`${item.name}-vehicle-action`}
                      label={item.isActive ? `Exit ${item.name}` : `Enter ${item.name}`}
                      onClick={handleVehicleToggle}
                      size="sm"
                    />
                  )}

                  {item.isJunk && !isConfirmingDiscard ? (
                    <ItemActionButton
                      ariaLabel={`Discard ${item.name}`}
                      dataItemName={item.name}
                      disabled={disabled}
                      key={`${item.name}-discard`}
                      label={<>
                        <Icon
                          color="white"
                          inline
                          marginRight={4}
                          name="trash"
                          size={16}
                        />

                        {' '}
                        Discard
                      </>}
                      onClick={handleStartConfirmDiscard}
                      variant="danger"
                    />
                  ) : null}

                  {!item.isJunk && !isConfirmingDiscard && item.type !== 'vehicle' && item.type !== 'status effect' && (
                    <ItemActionButton
                      ariaLabel={`Drop ${item.name}`}
                      dataItemName={item.name}
                      disabled={disabled}
                      key={`${item.name}-drop`}
                      label="Drop"
                      onClick={handleStartConfirmDiscard}
                      variant="primary"
                    />
                  )}

                  {!item.isJunk && !isConfirmingDiscard && item.type === 'vehicle' && !item.isActive && (
                    <ItemActionButton
                      ariaLabel={`Park ${item.name} here`}
                      dataItemName={item.name}
                      disabled={disabled}
                      key={`${item.name}-drop`}
                      label="Park Here"
                      onClick={handleStartConfirmDiscard}
                      variant="primary"
                    />
                  )}

                  {isConfirmingDiscard ? <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button
                      ariaLabel={`Confirm drop of ${item.name}`}
                      className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold rounded shadow disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out"
                      data-item-name={item.name}
                      disabled={disabled}
                      key={`${item.name}-confirm-drop`}
                      label={item.type === 'vehicle' && !item.isActive ? 'Confirm Park' : item.isJunk ? 'Confirm Discard' : 'Confirm Drop'}
                      onClick={handleConfirmDrop}
                      size="sm"
                    />

                    <Button
                      ariaLabel="Cancel discard"
                      className="w-full bg-slate-600 hover:bg-slate-500 text-white font-medium rounded shadow disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out"
                      disabled={disabled}
                      key={`${item.name}-cancel-discard`}
                      label="Cancel"
                      onClick={handleCancelDiscard}
                      size="sm"
                    />
                  </div> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default InventoryDisplay;
