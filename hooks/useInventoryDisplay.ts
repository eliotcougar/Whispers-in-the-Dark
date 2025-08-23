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
    type: 'generic' | 'specific' | 'inspect' | 'drop',
    knownUse?: KnownUse
  ) => void;
  readonly onStashToggle: (itemId: string) => void;
  readonly onReadPage: (item: Item) => void;
}

export type FilterMode = 'all' | 'stashed';
export const useInventoryDisplay = ({
  items,
  onItemInteract,
  onStashToggle,
  onReadPage,
}: UseInventoryDisplayProps) => {
  const [newlyAddedItemIds, setNewlyAddedItemIds] = useState<Set<string>>(new Set());
  const prevItemsRef = useRef<Array<Item>>(items);
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [stashingItemIds, setStashingItemIds] = useState<Set<string>>(new Set());

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


  const handleStashToggleInternal = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.itemId;
      if (id) {
        const item = items.find(i => i.id === id);
        onStashToggle(id);
        if (item?.stashed) {
          if (filterMode === 'stashed') {
            setStashingItemIds(current => new Set(current).add(id));
            setTimeout(() => {
              setStashingItemIds(current => {
                const updated = new Set(current);
                updated.delete(id);
                return updated;
              });
            }, 1000);
          } else {
            setNewlyAddedItemIds(current => new Set(current).add(id));
            setTimeout(() => {
              setNewlyAddedItemIds(current => {
                const updated = new Set(current);
                updated.delete(id);
                return updated;
              });
            }, 1500);
          }
        } else {
          setStashingItemIds(current => new Set(current).add(id));
          setTimeout(() => {
            setStashingItemIds(current => {
              const updated = new Set(current);
              updated.delete(id);
              return updated;
            });
          }, 1000);
        }
        event.currentTarget.blur();
      }
    },
    [filterMode, items, onStashToggle],
  );

  const handleSpecificUse = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const { itemId, actionName, promptEffect } = event.currentTarget.dataset;
      if (!itemId || !actionName || !promptEffect) return;
      const item = items.find(i => i.id === itemId);
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
      const id = event.currentTarget.dataset.itemId;
      if (!id) return;
      const item = items.find(i => i.id === id);
      if (!item) return;
      onItemInteract(item, 'inspect');
      event.currentTarget.blur();
    },
    [items, onItemInteract]
  );

  const handleGenericUse = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.itemId;
      if (!id) return;
      const item = items.find(i => i.id === id);
      if (!item) return;
      onItemInteract(item, 'generic');
      event.currentTarget.blur();
    },
    [items, onItemInteract]
  );

  const handleDrop = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.itemId;
      if (!id) return;
      const item = items.find(i => i.id === id);
      if (!item) return;
      onItemInteract(item, 'drop');
      event.currentTarget.blur();
    },
    [items, onItemInteract],
  );

  const handleVehicleToggle = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.itemId;
      if (!id) return;
      const item = items.find(i => i.id === id);
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
    const id = event.currentTarget.dataset.itemId;
    if (!id) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    onReadPage(item);
    event.currentTarget.blur();
  }, [items, onReadPage]);


  useEffect(() => {
    const currentItemIds = new Set(items.map(item => item.id));
    const prevItemIds = new Set(prevItemsRef.current.map(item => item.id));
    const added: Array<string> = [];

    currentItemIds.forEach(id => {
      if (!prevItemIds.has(id)) {
        added.push(id);
      }
    });

    if (added.length > 0) {
      setNewlyAddedItemIds(currentAnimatingItems => {
        const newSet = new Set(currentAnimatingItems);
        added.forEach(id => newSet.add(id));
        return newSet;
      });

      added.forEach(id => {
        setTimeout(() => {
          setNewlyAddedItemIds(currentAnimatingItems => {
            const updatedSet = new Set(currentAnimatingItems);
            updatedSet.delete(id);
            return updatedSet;
          });
        }, 1500);
      });
    }
    prevItemsRef.current = items;
  }, [items]);

  const displayedItems = useMemo(() => {
    const itemsToDisplay = items.filter(item => {
      if (stashingItemIds.has(item.id)) return true;
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
  }, [items, sortOrder, filterMode, stashingItemIds]);

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
    newlyAddedItemIds,
    stashingItemIds,
    sortOrder,
    filterMode,
    handleSortByName,
    handleSortByType,
    handleFilterAll,
    handleFilterStashed,
    handleSpecificUse,
    handleInspect,
    handleGenericUse,
    handleDrop,
    handleVehicleToggle,
    handleStashToggleInternal,
    handleRead,
    getApplicableKnownUses,
  } as const;
};
