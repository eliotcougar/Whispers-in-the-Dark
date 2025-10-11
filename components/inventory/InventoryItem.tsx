import React, { useCallback, useState } from 'react';
import { Item, KnownUse } from '../../types';
import { Icon } from '../elements/icons';
import ItemTypeDisplay from './ItemTypeDisplay';
import Button from '../elements/Button';
import {
  INSPECT_COOLDOWN,
  PLAYER_JOURNAL_ID,
  KNOWN_USE_ACTION_COST,
  GENERIC_USE_ACTION_COST,
  INSPECT_ACTION_COST,
  WRITTEN_ITEM_TYPES,
  IMAGE_ITEM_TYPES,
} from '../../constants';
import { FilterMode } from '../../hooks/useInventoryDisplay';

interface InventoryItemProps {
  readonly item: Item;
  readonly isNew: boolean;
  readonly isStashing: boolean;
  readonly applicableUses: Array<KnownUse>;
  readonly disabled: boolean;
  readonly currentTurn: number;
  readonly onSpecificUse: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onInspect: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onGenericUse: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onVehicleToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onDrop: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onDiscard: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onRead: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onStashToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly filterMode: FilterMode;
  readonly registerRef?: (el: HTMLLIElement | null) => void;
  readonly queuedActionIds: Set<string>;
  readonly remainingActionPoints: number;
}

function InventoryItem({
  item,
  isNew,
  isStashing,
  applicableUses,
  disabled,
  currentTurn,
  onSpecificUse,
  onInspect,
  onGenericUse,
  onVehicleToggle,
  onDrop,
  onDiscard,
  onRead,
  onStashToggle,
  filterMode,
  registerRef,
  queuedActionIds,
  remainingActionPoints,
}: InventoryItemProps) {
  const displayDescription = item.isActive && item.activeDescription ? item.activeDescription : item.description; // Show regular description if active item doesn't have an activeDescription
  const isWrittenItem = WRITTEN_ITEM_TYPES.includes(
    item.type as (typeof WRITTEN_ITEM_TYPES)[number],
  );
  const isImageItem = IMAGE_ITEM_TYPES.includes(
    item.type as (typeof IMAGE_ITEM_TYPES)[number],
  );
  const canShowGenericUse =
    item.type !== 'status effect' && item.type !== 'vehicle';
  const canEverDrop =
    !item.tags?.includes('junk') &&
    item.type !== 'vehicle' &&
    item.type !== 'status effect';
  const showDropForWrittenItem =
    filterMode === 'stashed' && (item.stashed === true || isStashing);
  const canShowDropNow = canEverDrop && (!isWrittenItem || showDropForWrittenItem);
  const actionButtons: Array<React.ReactElement> = [];
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);

  const handleDiscardClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setIsConfirmingDiscard(true);
      event.currentTarget.blur();
    },
    [],
  );

  const handleConfirmDiscard = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onDiscard(event);
      setIsConfirmingDiscard(false);
    },
    [onDiscard],
  );

  const handleCancelDiscard = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setIsConfirmingDiscard(false);
    event.currentTarget.blur();
  }, []);

  applicableUses.forEach(knownUse => {
    const isQueued = queuedActionIds.has(`${item.id}-specific-${knownUse.actionName}`);
    actionButtons.push(
      <Button
        ariaLabel={`${knownUse.actionName}${knownUse.description ? ': ' + knownUse.description : ''}`}
        cost={KNOWN_USE_ACTION_COST}
        data-action-name={knownUse.actionName}
        data-item-id={item.id}
        data-prompt-effect={knownUse.promptEffect}
        disabled={disabled || (!isQueued && KNOWN_USE_ACTION_COST > remainingActionPoints)}
        key={`${item.id}-knownuse-${knownUse.actionName}`}
        label={knownUse.actionName}
        onClick={onSpecificUse}
        preset="teal"
        pressed={isQueued}
        size="sm"
        title={knownUse.description}
        variant="toggleFull"
      />
    );
  });

  const inspectDisabled =
    disabled ||
    (isWrittenItem
      ? item.id === PLAYER_JOURNAL_ID
        ? (item.chapters?.length ?? 0) === 0
        : (item.chapters?.some(ch => !ch.actualContent) ?? true)
      : isImageItem
        ? (item.chapters?.some(ch => !ch.imageData) ?? true)
        : false) ||
    (item.lastInspectTurn !== undefined &&
      currentTurn - item.lastInspectTurn < INSPECT_COOLDOWN);
  const inspectQueued = queuedActionIds.has(`${item.id}-inspect`);

  actionButtons.push(
    <Button
      ariaLabel={`Inspect ${item.name}`}
      cost={INSPECT_ACTION_COST}
      data-item-id={item.id}
      disabled={inspectDisabled || (!inspectQueued && INSPECT_ACTION_COST > remainingActionPoints)}
      key={`${item.id}-inspect`}
      label="Inspect"
      onClick={onInspect}
      preset="indigo"
      pressed={inspectQueued}
      size="sm"
      variant="toggleFull"
    />
  );

  if (isWrittenItem) {
    actionButtons.push(
      <Button
        ariaLabel={`Read ${item.name}`}
        data-item-id={item.id}
        disabled={
          disabled ||
          (item.id === PLAYER_JOURNAL_ID && (item.chapters?.length ?? 0) === 0)
        }
        key={`${item.id}-read`}
        label="Read"
        onClick={onRead}
        preset="teal"
        size="sm"
      />
    );
  }


    if (canShowGenericUse) {
      const genericQueued = queuedActionIds.has(`${item.id}-generic`);
      actionButtons.push(
        <Button
          ariaLabel={`Attempt to use ${item.name} (generic action)`}
          cost={GENERIC_USE_ACTION_COST}
          data-item-id={item.id}
          disabled={disabled || (!genericQueued && GENERIC_USE_ACTION_COST > remainingActionPoints)}
          key={`${item.id}-generic-use`}
          label="Attempt to Use (Generic)"
          onClick={onGenericUse}
          preset="sky"
          pressed={genericQueued}
          size="sm"
          variant="toggleFull"
        />
      );
    }

  if (item.type === 'vehicle') {
    actionButtons.push(
      <Button
        ariaLabel={item.isActive ? `Exit ${item.name}` : `Enter ${item.name}`}
        data-item-id={item.id}
        disabled={disabled}
        key={`${item.id}-vehicle-action`}
        label={item.isActive ? `Exit ${item.name}` : `Enter ${item.name}`}
        onClick={onVehicleToggle}
        preset="sky"
        pressed={queuedActionIds.has(`${item.id}-specific-${item.isActive ? `Exit ${item.name}` : `Enter ${item.name}`}`)}
        size="sm"
        variant="toggleFull"
      />
    );
  }

  if (item.tags?.includes('junk')) {
    if (isConfirmingDiscard) {
      actionButtons.push(
        <div
          className="grid grid-cols-2 gap-2 mt-2"
          key={`${item.id}-confirm-group`}
        >
          <Button
            ariaLabel={`Confirm discard of ${item.name}`}
            data-item-id={item.id}
            disabled={disabled}
            key={`${item.id}-confirm-discard`}
            label={
              item.type === 'vehicle' && !item.isActive
                ? 'Confirm Park'
                : 'Confirm Discard'
            }
            onClick={handleConfirmDiscard}
            preset="red"
            size="sm"
          />

          <Button
            ariaLabel="Cancel discard"
            disabled={disabled}
            key={`${item.id}-cancel-discard`}
            label="Cancel"
            onClick={handleCancelDiscard}
            preset="slate"
            size="sm"
          />
        </div>
      );
    } else {
      actionButtons.push(
        <Button
          ariaLabel={`Discard ${item.name}`}
          data-item-id={item.id}
          disabled={disabled}
          icon={<Icon
            color="white"
            inline
            marginRight={4}
            name="trash"
            size={16}
          />}
          key={`${item.id}-discard`}
          label="Discard"
          onClick={handleDiscardClick}
          preset="orange"
          size="sm"
        />
      );
    }
  }

  if (isWrittenItem) {
    actionButtons.push(
      <Button
        ariaLabel={filterMode === 'stashed' ? `Retrieve ${item.name}` : `Stash ${item.name}`}
        data-item-id={item.id}
        disabled={disabled}
        key={`${item.id}-stash`}
        label={filterMode === 'stashed' ? 'Retrieve' : 'Stash'}
        onClick={onStashToggle}
        preset="sky"
        size="sm"
      />
    );
  }

  if (canEverDrop && isWrittenItem && canShowDropNow) {
    actionButtons.push(
      <Button
        ariaLabel={`Drop ${item.name}`}
        data-item-id={item.id}
        disabled={disabled}
        key={`${item.id}-drop`}
        label="Drop"
        onClick={onDrop}
        preset="sky"
        size="sm"
      />
    );
  }

  if (canEverDrop && !isWrittenItem && canShowDropNow) {
    actionButtons.push(
      <Button
        ariaLabel={`Drop ${item.name}`}
        data-item-id={item.id}
        disabled={disabled}
        key={`${item.id}-drop`}
        label="Drop"
        onClick={onDrop}
        preset="sky"
        size="sm"
      />
    );
  }

  if (!item.tags?.includes('junk') && item.type === 'vehicle' && !item.isActive) {
    actionButtons.push(
      <Button
        ariaLabel={`Park ${item.name} here`}
        data-item-id={item.id}
        disabled={disabled}
        key={`${item.id}-drop`}
        label="Park Here"
        onClick={onDrop}
        preset="sky"
        size="sm"
      />
    );
  }

  return (
    <li
      className={`w-[270px] text-slate-300 bg-slate-700/60 p-4 rounded-md shadow border border-slate-600 ${isNew ? 'animate-new-item-pulse' : ''} ${isStashing ? 'animate-archive-fade-out' : ''} flex flex-col`}
      data-item-id={item.id}
      key={item.id}
      ref={registerRef}
    >
      <div className="flex justify-between items-center mb-1 text-xs">
        <ItemTypeDisplay type={item.type} />

        {item.isActive ? (
          <span className="text-green-400 font-semibold">
            Active
          </span>
        ) : null}
      </div>

      <div className="mb-1">
        <span className="font-semibold text-lg text-slate-100">
          {item.name}
        </span>
      </div>

      <p className="text-sm text-slate-300 mb-3 italic leading-tight flex-grow">
        {displayDescription}
      </p>

      {item.tags?.includes('junk') ? (
        <p className="text-xs text-orange-400 mb-1 italic">
          (Marked as junk)
        </p>
      ) : null}

      <div className="space-y-2 mt-auto">
        {actionButtons}
      </div>
    </li>
  );
}

InventoryItem.defaultProps = {
  registerRef: undefined,
};

export default InventoryItem;
