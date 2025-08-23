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
    interactionType: 'generic' | 'specific' | 'inspect' | 'drop',
    knownUse?: KnownUse
  ) => void;
  readonly onStashToggle: (itemId: string) => void;
  readonly onReadPage: (item: Item) => void;
  readonly currentTurn: number;
  readonly disabled: boolean;
  readonly queuedActionIds: Set<string>;
}

function InventoryDisplay({ items, onItemInteract, onStashToggle, onReadPage, currentTurn, disabled, queuedActionIds }: InventoryDisplayProps) {
  const {
    displayedItems,
    newlyAddedItemIds,
    stashingItemIds,
    confirmingDiscardItemId,
    sortOrder,
    handleSortByName,
    handleSortByType,
    filterMode,
    handleFilterAll,
    handleFilterStashed,
    handleStartConfirmDiscard,
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
    onStashToggle,
    onReadPage,
  });

  const itemElementMap = useRef(new Map<string, HTMLLIElement>());
  const prevRectsRef = useRef(new Map<string, DOMRect>());
  const prevDisabledRef = useRef(disabled);

  const registerItemRef = useCallback((el: HTMLLIElement | null) => {
    if (!el) return;
    const id = el.dataset.itemId;
    if (id) {
      itemElementMap.current.set(id, el);
    }
  }, []);

  useLayoutEffect(() => {
    const newRects = new Map<string, DOMRect>();
    itemElementMap.current.forEach((el, id) => {
      if (!el.isConnected) {
        itemElementMap.current.delete(id);
        prevRectsRef.current.delete(id);
        return;
      }
      newRects.set(id, el.getBoundingClientRect());
    });

    if (prevDisabledRef.current !== disabled) {
      prevDisabledRef.current = disabled;
      prevRectsRef.current = newRects;
      return;
    }

    if (!disabled) {
      prevRectsRef.current.forEach((prevRect, id) => {
        const newRect = newRects.get(id);
        const el = itemElementMap.current.get(id);
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
            const isNew = newlyAddedItemIds.has(item.id);
            const isStashing = stashingItemIds.has(item.id);
            const isConfirmingDiscard = confirmingDiscardItemId === item.id;
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
                key={item.id}
                onCancelDiscard={handleCancelDiscard}
                onGenericUse={handleGenericUse}
                onInspect={handleInspect}
                onRead={handleRead}
                onSpecificUse={handleSpecificUse}
                onStartConfirmDiscard={handleStartConfirmDiscard}
                onStashToggle={handleStashToggleInternal}
                onVehicleToggle={handleVehicleToggle}
                queuedActionIds={queuedActionIds}
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
