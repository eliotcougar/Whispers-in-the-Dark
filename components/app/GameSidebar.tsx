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
  StoryArc,
} from '../../types';

interface GameSidebarProps {
  readonly allNPCs: Array<NPC>;
  readonly currentMapNodeId: string | null;
  readonly currentObjective: string | null;
  readonly enableMobileTap: boolean;
  readonly inventory: Array<Item>;
  readonly itemsHere: Array<Item>;
  readonly storyArc: StoryArc | null;
  readonly mapNodes: Array<MapNode>;
  readonly objectiveAnimationType: 'success' | 'neutral' | null;
  readonly onStashToggle: (itemId: string) => void;
  readonly onItemInteract: (
    item: Item,
    interactionType: 'generic' | 'specific' | 'inspect' | 'take' | 'drop',
    knownUse?: KnownUse,
  ) => void;
  readonly onReadPage: (item: Item) => void;
  readonly onReadPlayerJournal: () => void;
  readonly globalTurnNumber: number;
  readonly disabled: boolean;
  readonly queuedActionIds: Set<string>;
}

function GameSidebar({
  allNPCs: allNPCs,
  currentMapNodeId,
  currentObjective,
  enableMobileTap,
  inventory,
  itemsHere,
  storyArc,
  mapNodes,
  objectiveAnimationType,
  onStashToggle,
  onItemInteract,
  onReadPage,
  onReadPlayerJournal,
  globalTurnNumber,
  disabled,
  queuedActionIds,
}: GameSidebarProps) {
  const questHighlightEntities = useMemo(
    () => buildHighlightableEntities(inventory, mapNodes, allNPCs),
    [inventory, mapNodes, allNPCs],
  );

  const act = storyArc?.acts[storyArc.currentAct - 1];
  const mainQuest = act?.mainObjective ?? null;
  const actHeader = act ? `Act ${String(storyArc.currentAct)}: ${act.title}` : '';

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
          title="Open Journal"
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
          header={actHeader}
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
        queuedActionIds={queuedActionIds}
      />

      <InventoryDisplay
        currentTurn={globalTurnNumber}
        disabled={disabled}
        items={inventory}
                onItemInteract={onItemInteract}
        onReadPage={onReadPage}
        onStashToggle={onStashToggle}
        queuedActionIds={queuedActionIds}
      />
    </>
  );
}

export default GameSidebar;
