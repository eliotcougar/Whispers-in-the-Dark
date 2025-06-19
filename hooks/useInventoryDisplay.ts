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
}

export const useInventoryDisplay = ({
  items,
  onItemInteract,
  onDropItem,
}: UseInventoryDisplayProps) => {
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
    } else {
      itemsToDisplay.reverse();
    }
    return itemsToDisplay;
  }, [items, sortOrder]);

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
    confirmingDiscardItemName,
    sortOrder,
    handleSortByName,
    handleSortByType,
    handleStartConfirmDiscard,
    handleConfirmDrop,
    handleCancelDiscard,
    handleSpecificUse,
    handleInspect,
    handleGenericUse,
    handleVehicleToggle,
    getApplicableKnownUses,
  } as const;
};
