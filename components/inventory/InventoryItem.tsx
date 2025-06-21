import { Item, KnownUse } from '../../types';
import { Icon } from '../elements/icons';
import ItemTypeDisplay from './ItemTypeDisplay';
import Button from '../elements/Button';

interface InventoryItemProps {
  readonly item: Item;
  readonly isNew: boolean;
  readonly isConfirmingDiscard: boolean;
  readonly applicableUses: Array<KnownUse>;
  readonly disabled: boolean;
  readonly onSpecificUse: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onInspect: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onGenericUse: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onVehicleToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onStartConfirmDiscard: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onConfirmDrop: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onCancelDiscard: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onRead: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

function InventoryItem({
  item,
  isNew,
  isConfirmingDiscard,
  applicableUses,
  disabled,
  onSpecificUse,
  onInspect,
  onGenericUse,
  onVehicleToggle,
  onStartConfirmDiscard,
  onConfirmDrop,
  onCancelDiscard,
  onRead,
}: InventoryItemProps) {
  const displayDescription = item.isActive && item.activeDescription ? item.activeDescription : item.description;
  return (
    <li
      className={`w-[270px] text-slate-300 bg-slate-700/60 p-4 rounded-md shadow border border-slate-600 ${isNew ? 'animate-new-item-pulse' : ''} flex flex-col`}
      key={item.name}
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
        disabled={disabled || isConfirmingDiscard}
        key={`${item.name}-inspect`}
        label="Inspect"
        onClick={onInspect}
        preset="indigo"
        size="sm"
      />

      {item.type === 'page' ? (
        <Button
          ariaLabel={`Read ${item.name}`}
          data-item-name={item.name}
          disabled={disabled || isConfirmingDiscard}
          key={`${item.name}-read`}
          label="Read"
          onClick={onRead}
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

        {!item.tags?.includes('junk') && !isConfirmingDiscard && item.type !== 'vehicle' && item.type !== 'status effect' && (
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
              label={item.type === 'vehicle' && !item.isActive ? 'Confirm Park' : item.tags?.includes('junk') ? 'Confirm Discard' : 'Confirm Drop'}
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

export default InventoryItem;
