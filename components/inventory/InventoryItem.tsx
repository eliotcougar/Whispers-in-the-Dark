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
  readonly isConfirmingDiscard: boolean;
  readonly applicableUses: Array<KnownUse>;
  readonly disabled: boolean;
  readonly currentTurn: number;
  readonly onSpecificUse: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onInspect: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onGenericUse: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onVehicleToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onStartConfirmDiscard: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onConfirmDrop: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onCancelDiscard: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onRead: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onStashToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly filterMode: FilterMode;
  readonly registerRef?: (el: HTMLLIElement | null) => void;
}

function InventoryItem({
  item,
  isNew,
  isStashing,
  isConfirmingDiscard,
  applicableUses,
  disabled,
  currentTurn,
  onSpecificUse,
  onInspect,
  onGenericUse,
  onVehicleToggle,
  onStartConfirmDiscard,
  onConfirmDrop,
  onCancelDiscard,
  onRead,
  onStashToggle,
  filterMode,
  registerRef,
}: InventoryItemProps) {
  const displayDescription = item.isActive && item.activeDescription ? item.activeDescription : item.description;
  const isWrittenItem = item.type === 'page' || item.type === 'book';
  const isImageItem = item.type === 'picture' || item.type === 'map';
  const canShowGenericUse =
    item.type !== 'status effect' && item.type !== 'vehicle';
  const canEverDrop =
    !item.tags?.includes('junk') &&
    item.type !== 'vehicle' &&
    item.type !== 'status effect';
  const showDropForWrittenItem =
    filterMode === 'stashed' && (Boolean(item.stashed) || isStashing);
  const canShowDropNow =
    canEverDrop &&
    !isConfirmingDiscard &&
    (!isWrittenItem || showDropForWrittenItem);
  const actionButtons: Array<React.ReactElement> = [];

  applicableUses.forEach(knownUse => {
    actionButtons.push(
      <Button
        ariaLabel={`${knownUse.actionName}${knownUse.description ? ': ' + knownUse.description : ''}`}
        data-action-name={knownUse.actionName}
        data-item-name={item.name}
        data-prompt-effect={knownUse.promptEffect}
        disabled={disabled || isConfirmingDiscard}
        key={`${item.name}-knownuse-${knownUse.actionName}`}
        label={knownUse.actionName}
        onClick={onSpecificUse}
        preset="teal"
        size="sm"
        title={knownUse.description}
      />
    );
  });

  const inspectDisabled =
    disabled ||
    isConfirmingDiscard ||
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
      data-item-name={item.name}
      disabled={inspectDisabled}
      key={`${item.name}-inspect`}
      label="Inspect"
      onClick={onInspect}
      preset="indigo"
      size="sm"
    />
  );

  if (item.type === 'page' || item.type === 'book' || item.type === 'picture' || item.type === 'map') {
    actionButtons.push(
      <Button
        ariaLabel={`Read ${item.name}`}
        data-item-name={item.name}
        disabled={
          disabled ||
          isConfirmingDiscard ||
          (item.id === PLAYER_JOURNAL_ID && (item.chapters?.length ?? 0) === 0)
        }
        key={`${item.name}-read`}
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
        data-item-name={item.name}
        disabled={disabled || isConfirmingDiscard}
        key={`${item.name}-generic-use`}
        label="Attempt to Use (Generic)"
        onClick={onGenericUse}
        preset="sky"
        size="sm"
      />
    );
  }

  if (item.type === 'vehicle') {
    actionButtons.push(
      <Button
        ariaLabel={item.isActive ? `Exit ${item.name}` : `Enter ${item.name}`}
        data-item-name={item.name}
        disabled={disabled || isConfirmingDiscard}
        key={`${item.name}-vehicle-action`}
        label={item.isActive ? `Exit ${item.name}` : `Enter ${item.name}`}
        onClick={onVehicleToggle}
        preset="sky"
        size="sm"
      />
    );
  }

  if (item.tags?.includes('junk') && !isConfirmingDiscard) {
    actionButtons.push(
      <Button
        ariaLabel={`Discard ${item.name}`}
        data-item-name={item.name}
        disabled={disabled}
        icon={<Icon
          color="white"
          inline
          marginRight={4}
          name="trash"
          size={16}
        />}
        key={`${item.name}-discard`}
        label="Discard"
        onClick={onStartConfirmDiscard}
        preset="orange"
        size="sm"
      />
    );
  }

  if ((item.type === 'page' || item.type === 'book') && !isConfirmingDiscard) {
    actionButtons.push(
      <Button
        ariaLabel={filterMode === 'stashed' ? `Retrieve ${item.name}` : `Stash ${item.name}`}
        data-item-name={item.name}
        disabled={disabled}
        key={`${item.name}-stash`}
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
        data-item-name={item.name}
        disabled={disabled}
        key={`${item.name}-drop`}
        label="Drop"
        onClick={onStartConfirmDiscard}
        preset="sky"
        size="sm"
      />
    );
  }

  if (canEverDrop && !isWrittenItem && canShowDropNow) {
    actionButtons.push(
      <Button
        ariaLabel={`Drop ${item.name}`}
        data-item-name={item.name}
        disabled={disabled}
        key={`${item.name}-drop`}
        label="Drop"
        onClick={onStartConfirmDiscard}
        preset="sky"
        size="sm"
      />
    );
  }

  if (!item.tags?.includes('junk') && !isConfirmingDiscard && item.type === 'vehicle' && !item.isActive) {
    actionButtons.push(
      <Button
        ariaLabel={`Park ${item.name} here`}
        data-item-name={item.name}
        disabled={disabled}
        key={`${item.name}-drop`}
        label="Park Here"
        onClick={onStartConfirmDiscard}
        preset="sky"
        size="sm"
      />
    );
  }

  if (isConfirmingDiscard) {
    actionButtons.push(
      <div
        className="grid grid-cols-2 gap-2 mt-2"
        key={`${item.name}-confirm-group`}
      >
        <Button
          ariaLabel={`Confirm drop of ${item.name}`}
          data-item-name={item.name}
          disabled={disabled}
          key={`${item.name}-confirm-drop`}
          label={
            item.type === 'vehicle' && !item.isActive
              ? 'Confirm Park'
              : item.tags?.includes('junk')
                ? 'Confirm Discard'
                : 'Confirm Drop'
          }
          onClick={onConfirmDrop}
          preset="red"
          size="sm"
        />

        <Button
          ariaLabel="Cancel discard"
          disabled={disabled}
          key={`${item.name}-cancel-discard`}
          label="Cancel"
          onClick={onCancelDiscard}
          preset="slate"
          size="sm"
        />
      </div>
    );
  }

  return (
    <li
      className={`w-[270px] text-slate-300 bg-slate-700/60 p-4 rounded-md shadow border border-slate-600 ${isNew ? 'animate-new-item-pulse' : ''} ${isStashing ? 'animate-archive-fade-out' : ''} flex flex-col`}
      data-item-name={item.name}
      key={item.name}
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
