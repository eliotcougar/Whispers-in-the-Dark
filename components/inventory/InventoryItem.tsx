import React from 'react';
import { Item, KnownUse } from '../../types';
import { Icon } from '../elements/icons';
import ItemTypeDisplay from './ItemTypeDisplay';
import Button from '../elements/Button';
import { INSPECT_COOLDOWN, PLAYER_JOURNAL_ID } from '../../constants';
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
  readonly onRead: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onStashToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly filterMode: FilterMode;
  readonly registerRef?: (el: HTMLLIElement | null) => void;
  readonly queuedActionIds: Set<string>;
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
  onRead,
  onStashToggle,
  filterMode,
  registerRef,
  queuedActionIds,
}: InventoryItemProps) {
  const displayDescription = item.isActive && item.activeDescription ? item.activeDescription : item.description;
  const isWrittenItem =
    item.type === 'page' ||
    item.type === 'book' ||
    item.type === 'picture' ||
    item.type === 'map';
  const isImageItem = item.type === 'picture' || item.type === 'map';
  const canShowGenericUse =
    item.type !== 'status effect' && item.type !== 'vehicle';
  const canEverDrop =
    !item.tags?.includes('junk') &&
    item.type !== 'vehicle' &&
    item.type !== 'status effect';
  const showDropForWrittenItem =
    filterMode === 'stashed' && (Boolean(item.stashed) || isStashing);
  const canShowDropNow = canEverDrop && (!isWrittenItem || showDropForWrittenItem);
  const actionButtons: Array<React.ReactElement> = [];

  applicableUses.forEach(knownUse => {
    actionButtons.push(
      <Button
        ariaLabel={`${knownUse.actionName}${knownUse.description ? ': ' + knownUse.description : ''}`}
        data-action-name={knownUse.actionName}
        data-item-id={item.id}
        data-prompt-effect={knownUse.promptEffect}
        disabled={disabled}
        key={`${item.id}-knownuse-${knownUse.actionName}`}
        label={knownUse.actionName}
        onClick={onSpecificUse}
        preset="teal"
        pressed={queuedActionIds.has(`${item.id}-specific-${knownUse.actionName}`)}
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

  actionButtons.push(
    <Button
      ariaLabel={`Inspect ${item.name}`}
      data-item-id={item.id}
      disabled={inspectDisabled}
      key={`${item.id}-inspect`}
      label="Inspect"
      onClick={onInspect}
      preset="indigo"
      pressed={queuedActionIds.has(`${item.id}-inspect`)}
      size="sm"
      variant="toggleFull"
    />
  );

  if (item.type === 'page' || item.type === 'book' || item.type === 'picture' || item.type === 'map') {
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
    actionButtons.push(
      <Button
        ariaLabel={`Attempt to use ${item.name} (generic action)`}
        data-item-id={item.id}
        disabled={disabled}
        key={`${item.id}-generic-use`}
        label="Attempt to Use (Generic)"
        onClick={onGenericUse}
        preset="sky"
        pressed={queuedActionIds.has(`${item.id}-generic`)}
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
        onClick={onDrop}
        preset="orange"
        size="sm"
      />
    );
  }

  if (
    item.type === 'page' ||
    item.type === 'book' ||
    item.type === 'picture' ||
    item.type === 'map'
  ) {
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
