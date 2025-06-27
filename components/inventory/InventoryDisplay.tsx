/**
 * @file InventoryDisplay.tsx
 * @description Shows the Player's items and handles interactions.
 */
import { Item, KnownUse } from '../../types';
import { Icon } from '../elements/icons';
import InventoryItem from './InventoryItem';
import InventorySortControls from './InventorySortControls';
import InventoryFilterControls from './InventoryFilterControls';
import { useInventoryDisplay } from '../../hooks/useInventoryDisplay';
import { useLayoutEffect, useRef, useCallback } from 'react';

interface InventoryDisplayProps {
  readonly items: Array<Item>;
  readonly onItemInteract: (
    item: Item,
    interactionType: 'generic' | 'specific' | 'inspect',
    knownUse?: KnownUse
  ) => void;
  readonly onDropItem: (itemName: string) => void;
  readonly onStashToggle: (itemName: string) => void;
  readonly onReadPage: (item: Item) => void;
  readonly currentTurn: number;
  readonly disabled: boolean;
}

function InventoryDisplay({ items, onItemInteract, onDropItem, onStashToggle, onReadPage, currentTurn, disabled }: InventoryDisplayProps) {
  const {
    displayedItems,
    newlyAddedItemNames,
    stashingItemNames,
    confirmingDiscardItemName,
    sortOrder,
    handleSortByName,
    handleSortByType,
    filterMode,
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
  } = useInventoryDisplay({
    items,
    onItemInteract,
    onDropItem,
    onStashToggle,
    onReadPage,
  });

  const itemElementMap = useRef(new Map<string, HTMLLIElement>());
  const prevRectsRef = useRef(new Map<string, DOMRect>());
  const prevDisabledRef = useRef(disabled);

  const registerItemRef = useCallback((el: HTMLLIElement | null) => {
    if (!el) return;
    const name = el.dataset.itemName;
    if (name) {
      itemElementMap.current.set(name, el);
    }
  }, []);

  useLayoutEffect(() => {
    const newRects = new Map<string, DOMRect>();
    itemElementMap.current.forEach((el, name) => {
      if (!el.isConnected) {
        itemElementMap.current.delete(name);
        prevRectsRef.current.delete(name);
        return;
      }
      newRects.set(name, el.getBoundingClientRect());
    });

    if (prevDisabledRef.current !== disabled) {
      prevDisabledRef.current = disabled;
      prevRectsRef.current = newRects;
      return;
    }

    if (!disabled) {
      prevRectsRef.current.forEach((prevRect, name) => {
        const newRect = newRects.get(name);
        const el = itemElementMap.current.get(name);
        if (!newRect || !el) return;
        const dx = Math.round(prevRect.left - newRect.left);
        const dy = Math.round(prevRect.top - newRect.top);
        if (dx !== 0 || dy !== 0) {
          el.style.transition = 'none';
          el.style.transform = `translate(${String(dx)}px, ${String(dy)}px)`;
          requestAnimationFrame(() => {
            el.style.transition = 'transform 0.2s';
            el.style.transform = '';
          });
          setTimeout(() => {
            el.style.transition = '';
          }, 200);
        }
      });
    }

    prevRectsRef.current = newRects;
  }, [displayedItems, disabled]);

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

      <InventorySortControls
        disabled={disabled}
        onSortByName={handleSortByName}
        onSortByType={handleSortByType}
        sortOrder={sortOrder}
      />

      <InventoryFilterControls
        disabled={disabled}
        filterMode={filterMode}
        onFilterAll={handleFilterAll}
        onFilterStashed={handleFilterStashed}
      />

      {displayedItems.length === 0 ? (
        <p className="text-slate-300 italic">
          Your pockets are empty.
        </p>
      ) : (
        <ul className="flex flex-wrap justify-center gap-4 list-none p-0">
          {displayedItems.map(item => {
            const applicableUses = getApplicableKnownUses(item);
            const isNew = newlyAddedItemNames.has(item.name);
            const isStashing = stashingItemNames.has(item.name);
            const isConfirmingDiscard = confirmingDiscardItemName === item.name;
            return (
              <InventoryItem
                applicableUses={applicableUses}
                currentTurn={currentTurn}
                disabled={disabled}
                filterMode={filterMode}
                isConfirmingDiscard={isConfirmingDiscard}
                isNew={isNew}
                isStashing={isStashing}
                item={item}
                key={item.name}
                onCancelDiscard={handleCancelDiscard}
                onConfirmDrop={handleConfirmDrop}
                onGenericUse={handleGenericUse}
                onInspect={handleInspect}
                onRead={handleRead}
                onSpecificUse={handleSpecificUse}
                onStartConfirmDiscard={handleStartConfirmDiscard}
                onStashToggle={handleStashToggleInternal}
                onVehicleToggle={handleVehicleToggle}
                registerRef={registerItemRef}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default InventoryDisplay;
