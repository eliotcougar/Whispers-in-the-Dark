/**
 * @file useInventoryDisplay.ts
 * @description Provides state management and handlers for InventoryDisplay.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Item, KnownUse } from '../types';

export type SortOrder = 'default' | 'name' | 'type';

interface UseInventoryDisplayProps {
  readonly items: Array<Item>;
  readonly onItemInteract: (
    item: Item,
    type: 'generic' | 'specific' | 'inspect',
    knownUse?: KnownUse
  ) => void;
  readonly onDropItem: (itemName: string) => void;
  readonly onStashToggle: (itemName: string) => void;
  readonly onReadPage: (item: Item) => void;
}

export type FilterMode = 'all' | 'stashed';
export const useInventoryDisplay = ({
  items,
  onItemInteract,
  onDropItem,
  onStashToggle,
  onReadPage,
}: UseInventoryDisplayProps) => {
  const [newlyAddedItemNames, setNewlyAddedItemNames] = useState<Set<string>>(new Set());
  const prevItemsRef = useRef<Array<Item>>(items);
  const [confirmingDiscardItemName, setConfirmingDiscardItemName] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [stashingItemNames, setStashingItemNames] = useState<Set<string>>(new Set());

  const handleSortByName = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setSortOrder(prev => (prev === 'name' ? 'default' : 'name'));
    event.currentTarget.blur();
  }, []);

  const handleSortByType = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setSortOrder(prev => (prev === 'type' ? 'default' : 'type'));
    event.currentTarget.blur();
  }, []);

  const handleFilterAll = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setFilterMode('all');
    event.currentTarget.blur();
  }, []);

  const handleFilterStashed = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setFilterMode(prev => (prev === 'stashed' ? 'all' : 'stashed'));
    event.currentTarget.blur();
  }, []);

  const handleStartConfirmDiscard = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const name = event.currentTarget.dataset.itemName;
    if (name) {
      setConfirmingDiscardItemName(name);
      event.currentTarget.blur();
    }
  }, []);

  const handleConfirmDrop = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const name = event.currentTarget.dataset.itemName;
      if (!name) return;
      const item = items.find(i => i.name === name);
      if (!item) return;
      onDropItem(name);

      setConfirmingDiscardItemName(null);
      event.currentTarget.blur();
    },
    [items, onDropItem]
  );


  const handleStashToggleInternal = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const name = event.currentTarget.dataset.itemName;
      if (name) {
        const item = items.find(i => i.name === name);
        onStashToggle(name);
        if (item?.stashed) {
          if (filterMode === 'stashed') {
            setStashingItemNames(current => new Set(current).add(name));
            setTimeout(() => {
              setStashingItemNames(current => {
                const updated = new Set(current);
                updated.delete(name);
                return updated;
              });
            }, 1000);
          } else {
            setNewlyAddedItemNames(current => new Set(current).add(name));
            setTimeout(() => {
              setNewlyAddedItemNames(current => {
                const updated = new Set(current);
                updated.delete(name);
                return updated;
              });
            }, 1500);
          }
        } else {
          setStashingItemNames(current => new Set(current).add(name));
          setTimeout(() => {
            setStashingItemNames(current => {
              const updated = new Set(current);
              updated.delete(name);
              return updated;
            });
          }, 1000);
        }
        event.currentTarget.blur();
      }
    },
    [filterMode, items, onStashToggle],
  );

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
        description: actionName,
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
        description: actionName,
      };
      onItemInteract(item, 'specific', dynamicKnownUse);
      event.currentTarget.blur();
    },
    [items, onItemInteract]
  );

  const handleRead = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const name = event.currentTarget.dataset.itemName;
    if (!name) return;
    const item = items.find(i => i.name === name);
    if (!item) return;
    onReadPage(item);
    event.currentTarget.blur();
  }, [items, onReadPage]);


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
    const itemsToDisplay = items.filter(item => {
      if (stashingItemNames.has(item.name)) return true;
      const isWritten = ['page', 'book', 'picture', 'map'].includes(item.type);
      if (filterMode === 'stashed') return item.stashed && isWritten;
      const isStashedWritten = item.stashed && isWritten;
      return !isStashedWritten;
    });

    const sortedItems = [...itemsToDisplay];

    if (sortOrder === 'name') {
      sortedItems.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === 'type') {
      sortedItems.sort((a, b) => {
        const typeCompare = a.type.localeCompare(b.type);
        if (typeCompare !== 0) {
          return typeCompare;
        }
        return a.name.localeCompare(b.name);
      });
    } else {
      sortedItems.reverse();
    }
    return sortedItems;
  }, [items, sortOrder, filterMode, stashingItemNames]);

  const getApplicableKnownUses = useCallback((item: Item): Array<KnownUse> => {
    if (!item.knownUses) return [];
    return item.knownUses.filter(ku => {
      const isActive = !!item.isActive;

      if (ku.appliesWhenActive !== undefined && ku.appliesWhenInactive !== undefined) {
        return (
          (ku.appliesWhenActive && isActive) ||
          (ku.appliesWhenInactive && !isActive) ||
          (!ku.appliesWhenActive && !ku.appliesWhenInactive)
        );
      }
      if (ku.appliesWhenActive !== undefined) {
        return ku.appliesWhenActive === isActive;
      }
      if (ku.appliesWhenInactive !== undefined) {
        return ku.appliesWhenInactive === !isActive;
      }
      return true;
    });
  }, []);

  return {
    displayedItems,
    newlyAddedItemNames,
    stashingItemNames,
    confirmingDiscardItemName,
    sortOrder,
    filterMode,
    handleSortByName,
    handleSortByType,
    handleFilterAll,
    handleFilterStashed,
    handleStartConfirmDiscard,
    handleConfirmDrop,
    handleCancelDiscard,
    handleSpecificUse,
    handleInspect,
    handleGenericUse,
    handleVehicleToggle,
    handleStashToggleInternal,
    handleRead,
    getApplicableKnownUses,
  } as const;
};
