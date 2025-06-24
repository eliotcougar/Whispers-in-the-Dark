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

interface InventoryDisplayProps {
  readonly items: Array<Item>;
  readonly onItemInteract: (
    item: Item,
    interactionType: 'generic' | 'specific' | 'inspect',
    knownUse?: KnownUse
  ) => void;
  readonly onDropItem: (itemName: string) => void;
  readonly onArchiveToggle: (itemName: string) => void;
  readonly onReadPage: (item: Item) => void;
  readonly onWriteJournal: (item: Item) => void;
  readonly currentTurn: number;
  readonly disabled: boolean;
}

function InventoryDisplay({ items, onItemInteract, onDropItem, onArchiveToggle, onReadPage, onWriteJournal, currentTurn, disabled }: InventoryDisplayProps) {
  const {
    displayedItems,
    newlyAddedItemNames,
    archivingItemNames,
    confirmingDiscardItemName,
    sortOrder,
    handleSortByName,
    handleSortByType,
    filterMode,
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
  } = useInventoryDisplay({
    items,
    onItemInteract,
    onDropItem,
    onArchiveToggle,
    onReadPage,
    onWriteJournal,
  });

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
        onFilterKnowledge={handleFilterKnowledge}
        onFilterArchived={handleFilterArchived}
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
            const isArchiving = archivingItemNames.has(item.name);
            const isConfirmingDiscard = confirmingDiscardItemName === item.name;
            return (
              <InventoryItem
                applicableUses={applicableUses}
                currentTurn={currentTurn}
                disabled={disabled}
                isArchiving={isArchiving}
                isConfirmingDiscard={isConfirmingDiscard}
                isNew={isNew}
                item={item}
                key={item.name}
                onCancelDiscard={handleCancelDiscard}
                onConfirmDrop={handleConfirmDrop}
                onGenericUse={handleGenericUse}
                onInspect={handleInspect}
                onRead={handleRead}
                onSpecificUse={handleSpecificUse}
                onStartConfirmDiscard={handleStartConfirmDiscard}
                onVehicleToggle={handleVehicleToggle}
                onArchiveToggle={handleArchiveToggleInternal}
                onWrite={handleWrite}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default InventoryDisplay;
