import { Item, KnownUse } from '../../types';
import { Icon } from '../elements/icons';
import ItemTypeDisplay from './ItemTypeDisplay';
import Button from '../elements/Button';
import { JOURNAL_WRITE_COOLDOWN, INSPECT_COOLDOWN } from '../../constants';

interface InventoryItemProps {
  readonly item: Item;
  readonly isNew: boolean;
  readonly isArchiving: boolean;
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
  readonly onWrite: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onArchiveToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onStashToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly registerRef?: (el: HTMLLIElement | null) => void;
}

function InventoryItem({
  item,
  isNew,
  isArchiving,
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
  onWrite,
  onArchiveToggle,
  onStashToggle,
  registerRef,
}: InventoryItemProps) {
  const displayDescription = item.isActive && item.activeDescription ? item.activeDescription : item.description;
  const isWrittenItem = item.type === 'page' || item.type === 'book' || item.type === 'journal';
  return (
    <li
      className={`w-[270px] text-slate-300 bg-slate-700/60 p-4 rounded-md shadow border border-slate-600 ${isNew ? 'animate-new-item-pulse' : ''} ${isArchiving || isStashing ? 'animate-archive-fade-out' : ''} flex flex-col`}
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
        {applicableUses.map(knownUse => (
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
      ))}

        <Button
          ariaLabel={`Inspect ${item.name}`}
          data-item-name={item.name}
          disabled={
            disabled ||
            isConfirmingDiscard ||
            (isWrittenItem
              ? item.type === 'journal'
                ? (item.chapters?.length ?? 0) === 0
                : (item.chapters?.some(ch => !ch.actualContent) ?? true)
              : false) ||
            (item.lastInspectTurn !== undefined && currentTurn - item.lastInspectTurn < INSPECT_COOLDOWN)
          }
          key={`${item.name}-inspect`}
          label="Inspect"
          onClick={onInspect}
          preset="indigo"
          size="sm"
        />

        {item.type === 'page' || item.type === 'book' || item.type === 'journal' ? (
          <Button
            ariaLabel={`Read ${item.name}`}
            data-item-name={item.name}
            disabled={
              disabled ||
              isConfirmingDiscard ||
              (item.type === 'journal' && (item.chapters?.length ?? 0) === 0)
            }
            key={`${item.name}-read`}
            label="Read"
            onClick={onRead}
            preset="teal"
            size="sm"
          />
        ) : null}

        {item.type === 'journal' ? (
          <Button
            ariaLabel={`Write in ${item.name}`}
            data-item-name={item.name}
            disabled={
              disabled ||
              isConfirmingDiscard ||
              (item.lastWriteTurn !== undefined && currentTurn - item.lastWriteTurn < JOURNAL_WRITE_COOLDOWN)
            }
            key={`${item.name}-write`}
            label="Write"
            onClick={onWrite}
            preset="teal"
            size="sm"
          />
        ) : null}

        {(item.type !== 'knowledge' && item.type !== 'status effect' && item.type !== 'vehicle') && (
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
        )}

        {item.type === 'vehicle' && (
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
        )}

        {item.tags?.includes('junk') && !isConfirmingDiscard ? (
          <Button
            ariaLabel={`Discard ${item.name}`}
            data-item-name={item.name}
            disabled={disabled}
            icon={
              <Icon
                color="white"
                inline
                marginRight={4}
                name="trash"
                size={16}
              />
            }
            key={`${item.name}-discard`}
            label="Discard"
            onClick={onStartConfirmDiscard}
            preset="orange"
            size="sm"
          />
        ) : null}

        {item.type === 'knowledge' && !isConfirmingDiscard ? (
          <Button
            ariaLabel={item.archived ? `Restore ${item.name}` : `Archive ${item.name}`}
            data-item-name={item.name}
            disabled={disabled}
            key={`${item.name}-archive`}
            label={item.archived ? 'Restore' : 'Archive'}
            onClick={onArchiveToggle}
            preset="sky"
            size="sm"
          />
        ) : null}

        {(item.type === 'page' || item.type === 'book' || item.type === 'journal') && !isConfirmingDiscard ? (
          <Button
            ariaLabel={item.stashed ? `Retrieve ${item.name}` : `Stash ${item.name}`}
            data-item-name={item.name}
            disabled={disabled}
            key={`${item.name}-stash`}
            label={item.stashed ? 'Retrieve' : 'Stash'}
            onClick={onStashToggle}
            preset="sky"
            size="sm"
          />
        ) : null}

        {item.type === 'knowledge' && item.archived && !isConfirmingDiscard ? (
          <Button
            ariaLabel={`Forget ${item.name}`}
            data-item-name={item.name}
            disabled={disabled}
            key={`${item.name}-forget`}
            label="Forget"
            onClick={onStartConfirmDiscard}
            preset="red"
            size="sm"
          />
        ) : null}

        {!item.tags?.includes('junk') && !isConfirmingDiscard && item.type !== 'vehicle' && item.type !== 'status effect' && item.type !== 'knowledge' && (
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
        )}

        {!item.tags?.includes('junk') && !isConfirmingDiscard && item.type === 'vehicle' && !item.isActive && (
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
        )}

        {isConfirmingDiscard ? (
          <div className="grid grid-cols-2 gap-2 mt-2">
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
                    : item.type === 'knowledge'
                      ? 'Confirm Forget'
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
        ) : null}
      </div>
    </li>
  );
}

InventoryItem.defaultProps = {
  registerRef: undefined,
};

export default InventoryItem;
