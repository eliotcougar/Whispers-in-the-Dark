import TextBox from '../elements/TextBox';
import LocationItemsDisplay from '../inventory/LocationItemsDisplay';
import InventoryDisplay from '../inventory/InventoryDisplay';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';
import { useMemo } from 'react';
import { buildHighlightableEntities } from '../../utils/highlightHelper';
import {
  NPC,
  Item,
  KnownUse,
  MapNode,
} from '../../types';

interface GameSidebarProps {
  readonly allNPCs: Array<NPC>;
  readonly currentMapNodeId: string | null;
  readonly currentObjective: string | null;
  readonly currentThemeName: string | null;
  readonly enableMobileTap: boolean;
  readonly inventory: Array<Item>;
  readonly itemsHere: Array<Item>;
  readonly mainQuest: string | null;
  readonly mapNodes: Array<MapNode>;
  readonly objectiveAnimationType: 'success' | 'neutral' | null;
  readonly onDropItem: (itemName: string) => void;
  readonly onStashToggle: (itemName: string) => void;
  readonly onItemInteract: (
    item: Item,
    interactionType: 'generic' | 'specific' | 'inspect',
    knownUse?: KnownUse,
  ) => void;
  readonly onReadPage: (item: Item) => void;
  readonly onReadPlayerJournal: () => void;
  readonly onTakeItem: (itemName: string) => void;
  readonly globalTurnNumber: number;
  readonly disabled: boolean;
}

function GameSidebar({
  allNPCs: allNPCs,
  currentMapNodeId,
  currentObjective,
  currentThemeName,
  enableMobileTap,
  inventory,
  itemsHere,
  mainQuest,
  mapNodes,
  objectiveAnimationType,
  onDropItem,
  onStashToggle,
  onItemInteract,
  onReadPage,
  onReadPlayerJournal,
  onTakeItem,
  globalTurnNumber,
  disabled,
}: GameSidebarProps) {
  const questHighlightEntities = useMemo(
    () =>
      buildHighlightableEntities(
        inventory,
        mapNodes,
        allNPCs,
        currentThemeName,
      ),
    [inventory, mapNodes, allNPCs, currentThemeName],
  );

  return (
    <>
      <div className="flex justify-start gap-4 mb-2">
        <Button
          ariaLabel="Open journal"
          disabled={disabled}
          icon={<Icon
            name="journalPen"
            size={24}
          />}
          onClick={onReadPlayerJournal}
          preset="blue"
          size="lg"
          variant="toolbarLarge"
        />
      </div>

      {mainQuest ? (
        <TextBox
          backgroundColorClass="bg-purple-800/50"
          borderColorClass="border-purple-600"
          borderWidthClass="border rounded-lg"
          containerClassName="p-3"
          contentColorClass="text-purple-200"
          contentFontClass="text-lg"
          enableMobileTap={enableMobileTap}
          header="Main Quest"
          headerFont="lg"
          headerPreset="purple"
          highlightEntities={questHighlightEntities}
          text={mainQuest}
        />
      ) : null}

      {currentObjective ? (
        <TextBox
          backgroundColorClass="bg-amber-800/50"
          borderColorClass="border-amber-600"
          borderWidthClass="border rounded-lg"
          containerClassName={`p-3 ${
            objectiveAnimationType === 'success'
              ? 'animate-objective-success'
              : objectiveAnimationType === 'neutral'
                ? 'animate-objective-neutral'
                : ''
          }`}
          contentColorClass="text-amber-200"
          contentFontClass="text-lg"
          enableMobileTap={enableMobileTap}
          header="Current Objective"
          headerFont="lg"
          headerPreset="amber"
          highlightEntities={questHighlightEntities}
          text={currentObjective}
        />
      ) : null}

      <LocationItemsDisplay
        currentNodeId={currentMapNodeId}
        disabled={disabled}
        items={itemsHere}
        mapNodes={mapNodes}
        onItemInteract={onItemInteract}
        onTakeItem={onTakeItem}
      />

      <InventoryDisplay
        currentTurn={globalTurnNumber}
        disabled={disabled}
        items={inventory}
        onDropItem={onDropItem}
        onItemInteract={onItemInteract}
        onReadPage={onReadPage}
        onStashToggle={onStashToggle}
      />
    </>
  );
}

export default GameSidebar;
