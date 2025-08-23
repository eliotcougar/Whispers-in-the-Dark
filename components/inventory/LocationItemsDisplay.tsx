import { useCallback } from 'react';
import * as React from 'react';
import { Item, KnownUse } from '../../types';
import { Icon } from '../elements/icons';
import ItemTypeDisplay from './ItemTypeDisplay';
import Button from '../elements/Button';

interface LocationItemsDisplayProps {
  readonly items: Array<Item>;
  readonly onItemInteract: (
    item: Item,
    type: 'generic' | 'specific' | 'inspect' | 'take',
    knownUse?: KnownUse,
  ) => void;
  readonly disabled: boolean;
  readonly currentNodeId: string | null;
  readonly mapNodes: Array<{ id: string; placeName: string }>;
  readonly queuedActionIds: Set<string>;
}

function LocationItemsDisplay({ items, onItemInteract, disabled, currentNodeId, mapNodes, queuedActionIds }: LocationItemsDisplayProps) {
  const handleTakeItem = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const itemId = event.currentTarget.dataset.itemId;
      if (!itemId) return;
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      onItemInteract(item, 'take');
      event.currentTarget.blur();
    },
    [items, onItemInteract]
  );

  const handleInspect = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.itemId;
      if (!id) return;
      const item = items.find(i => i.id === id);
      if (!item) return;
      onItemInteract(item, 'inspect');
      event.currentTarget.blur();
    },
    [items, onItemInteract]
  );

  const handleGenericUse = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.itemId;
      if (!id) return;
      const item = items.find(i => i.id === id);
      if (!item) return;
      onItemInteract(item, 'generic');
      event.currentTarget.blur();
    },
    [items, onItemInteract]
  );

  const handleSpecificUse = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const { itemId, actionName, promptEffect } = event.currentTarget.dataset;
      if (!itemId || !actionName || !promptEffect) return;
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      const ku: KnownUse = { actionName, promptEffect, description: actionName };
      onItemInteract(item, 'specific', ku);
      event.currentTarget.blur();
    },
    [items, onItemInteract]
  );

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

  if (items.length === 0) return null;

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
      <h3 className="text-xl font-bold text-amber-400 mb-2 border-b-2 border-amber-700 pb-2 flex items-center">
        <Icon
          color="amber"
          inline
          marginRight={8}
          name="inventory"
          size={20}
        />

        {' '}
        Items Here
      </h3>

      <ul className="flex flex-wrap justify-center gap-4 list-none p-0">
        {items.map((item) => {
          const description = item.isActive && item.activeDescription ? item.activeDescription : item.description;
          const atCurrent = item.holderId === currentNodeId;
          const holderName = !atCurrent ? mapNodes.find(n => n.id === item.holderId)?.placeName : null;
          return (
            <li
              className="w-[270px] text-slate-300 bg-slate-700/60 p-4 rounded-md shadow border border-slate-600 flex flex-col"
              key={item.id}
            >
              <div className="flex justify-between items-center mb-1 text-xs">
                <ItemTypeDisplay type={item.type} />

                {item.isActive ? <span className="text-green-400 font-semibold">
                  Active
                </span> : null}
              </div>

              <div className="mb-1">
                <span className="font-semibold text-lg text-slate-100">
                  {item.name}
                </span>
              </div>

              <p className="text-sm text-slate-300 mb-1 italic leading-tight flex-grow">
                {description}
              </p>

              {!atCurrent && holderName ? <p className="text-xs text-slate-300 mb-2">
                {'Reachable at '}

                {holderName}
              </p> : null}

              <div className="mt-auto space-y-2">
                {item.type === 'immovable' ? (
                  <>
                    {getApplicableKnownUses(item).map(ku => (
                      <Button
                        ariaLabel={`${ku.actionName}${ku.description ? ': ' + ku.description : ''}`}
                        data-action-name={ku.actionName}
                        data-item-id={item.id}
                        data-prompt-effect={ku.promptEffect}
                        disabled={disabled}
                        key={`${item.id}-ku-${ku.actionName}`}
                        label={ku.actionName}
                        onClick={handleSpecificUse}
                        preset="teal"
                        pressed={queuedActionIds.has(`${item.id}-specific-${ku.actionName}`)}
                        size="sm"
                        title={ku.description}
                        variant="toggleFull"
                      />
                    ))}
                    <Button
                      ariaLabel={`Inspect ${item.name}`}
                      data-item-id={item.id}
                      disabled={disabled}
                      label="Inspect"
                      onClick={handleInspect}
                      preset="indigo"
                      pressed={queuedActionIds.has(`${item.id}-inspect`)}
                      size="sm"
                      variant="toggleFull"
                    />

                    <Button
                      ariaLabel={`Attempt to use ${item.name}`}
                      data-item-id={item.id}
                      disabled={disabled}
                      label="Attempt to Use (Generic)"
                      onClick={handleGenericUse}
                      preset="sky"
                      pressed={queuedActionIds.has(`${item.id}-generic`)}
                      size="sm"
                      variant="toggleFull"
                    />
                </>
              ) : (
                  <Button
                    ariaLabel={item.type === 'vehicle' ? `Enter ${item.name}` : `Take ${item.name}`}
                    data-item-id={item.id}
                    disabled={disabled}
                    label={item.type === 'vehicle' ? 'Enter Vehicle' : 'Take'}
                    onClick={handleTakeItem}
                    preset="green"
                    size="sm"
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default LocationItemsDisplay;
