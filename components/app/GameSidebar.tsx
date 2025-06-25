import TextBox from '../elements/TextBox';
import LocationItemsDisplay from '../inventory/LocationItemsDisplay';
import InventoryDisplay from '../inventory/InventoryDisplay';
import { useMemo } from 'react';
import { buildHighlightableEntities } from '../../utils/highlightHelper';
import {
  Character,
  Item,
  KnownUse,
  MapNode,
} from '../../types';

interface GameSidebarProps {
  readonly allCharacters: Array<Character>;
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
  readonly onWriteJournal: (item: Item) => void;
  readonly onTakeItem: (itemName: string) => void;
  readonly globalTurnNumber: number;
  readonly disabled: boolean;
}

function GameSidebar({
  allCharacters,
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
  onWriteJournal,
  onTakeItem,
  globalTurnNumber,
  disabled,
}: GameSidebarProps) {
  const questHighlightEntities = useMemo(
    () =>
      buildHighlightableEntities(
        inventory,
        mapNodes,
        allCharacters,
        currentThemeName,
      ),
    [inventory, mapNodes, allCharacters, currentThemeName],
  );

  return (
    <>
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
        onTakeItem={onTakeItem}
      />

      <InventoryDisplay
        currentTurn={globalTurnNumber}
        disabled={disabled}
        items={inventory}
        onStashToggle={onStashToggle}
        onDropItem={onDropItem}
        onItemInteract={onItemInteract}
        onReadPage={onReadPage}
        onWriteJournal={onWriteJournal}
      />
    </>
  );
}

export default GameSidebar;
