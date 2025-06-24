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
  readonly onArchiveToggle: (itemName: string) => void;
  readonly onReadPage: (item: Item) => void;
  readonly onWriteJournal: (item: Item) => void;
}

export type FilterMode = 'all' | 'knowledge' | 'archived';
export const useInventoryDisplay = ({
  items,
  onItemInteract,
  onDropItem,
  onArchiveToggle,
  onReadPage,
  onWriteJournal,
}: UseInventoryDisplayProps) => {
  const [newlyAddedItemNames, setNewlyAddedItemNames] = useState<Set<string>>(new Set());
  const prevItemsRef = useRef<Array<Item>>(items);
  const [confirmingDiscardItemName, setConfirmingDiscardItemName] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [archivingItemNames, setArchivingItemNames] = useState<Set<string>>(new Set());

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

  const handleFilterKnowledge = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setFilterMode(prev => (prev === 'knowledge' ? 'all' : 'knowledge'));
    event.currentTarget.blur();
  }, []);

  const handleFilterArchived = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setFilterMode(prev => (prev === 'archived' ? 'all' : 'archived'));
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
      if (name) {
        onDropItem(name);
        setConfirmingDiscardItemName(null);
        event.currentTarget.blur();
      }
    },
    [onDropItem]
  );

  const handleArchiveToggleInternal = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const name = event.currentTarget.dataset.itemName;
      if (name) {
        const item = items.find(i => i.name === name);
        onArchiveToggle(name);
        if (item?.archived) {
          setNewlyAddedItemNames(current => new Set(current).add(name));
          setTimeout(() => {
            setNewlyAddedItemNames(current => {
              const updated = new Set(current);
              updated.delete(name);
              return updated;
            });
          }, 1500);
        } else {
          setArchivingItemNames(current => new Set(current).add(name));
          setTimeout(() => {
            setArchivingItemNames(current => {
              const updated = new Set(current);
              updated.delete(name);
              return updated;
            });
          }, 1000);
        }
        event.currentTarget.blur();
      }
    },
    [items, onArchiveToggle],
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

  const handleWrite = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const name = event.currentTarget.dataset.itemName;
    if (!name) return;
    const item = items.find(i => i.name === name);
    if (!item) return;
    onWriteJournal(item);
    event.currentTarget.blur();
  }, [items, onWriteJournal]);

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
      if (archivingItemNames.has(item.name)) return true;
      if (filterMode === 'archived') return item.archived && item.type === 'knowledge';
      if (filterMode === 'knowledge') return item.type === 'knowledge' && !item.archived;
      return !(item.archived && item.type === 'knowledge');
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
  }, [items, sortOrder, filterMode, archivingItemNames]);

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
    archivingItemNames,
    confirmingDiscardItemName,
    sortOrder,
    filterMode,
    handleSortByName,
    handleSortByType,
    handleFilterAll,
    handleFilterKnowledge,
    handleFilterArchived,
    handleStartConfirmDiscard,
    handleConfirmDrop,
    handleCancelDiscard,
    handleSpecificUse,
    handleInspect,
    handleGenericUse,
    handleVehicleToggle,
    handleArchiveToggleInternal,
    handleRead,
    handleWrite,
    getApplicableKnownUses,
  } as const;
};
