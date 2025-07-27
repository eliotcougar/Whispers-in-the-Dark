

/**
 * @file SceneDisplay.tsx
 * @description Shows the main scene description and local context.
 */
import { useMemo } from 'react';

import { Item, NPC, MapNode } from '../types';
import { buildHighlightableEntities } from '../utils/highlightHelper';
import TextBox from './elements/TextBox';

interface SceneDisplayProps {
  readonly description: string;
  readonly lastActionLog?: string | null;
  readonly inventory: Array<Item>;
  readonly mapData: Array<MapNode>;
  readonly allNPCs: Array<NPC>;
  readonly localTime?: string | null;
  readonly localEnvironment?: string | null;
  readonly localPlace?: string | null;
}

/**
 * Displays the current scene description and quest objectives.
 */
function SceneDisplay({
  description,
  lastActionLog,
  inventory,
  mapData,
  allNPCs,
  localTime,
  localEnvironment,
  localPlace,
}: SceneDisplayProps) {

  const entitiesForHighlighting = useMemo(
    () => buildHighlightableEntities(inventory, mapData, allNPCs),
    [inventory, mapData, allNPCs]
  );

  const enableMobileTap =
    typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

  const descriptionTextBox = (
    <TextBox
      backgroundColorClass='bg-slate-800'
      borderColorClass="border-slate-600"
      borderWidthClass="rounded-lg border"
      contentFontClass="leading-relaxed text-lg"
      enableMobileTap={enableMobileTap}
      highlightEntities={entitiesForHighlighting}
      text={description || undefined}
    />
  );

  const lastActionBox = lastActionLog ? (
    <TextBox
      backgroundColorClass='bg-slate-800'
      borderColorClass="border-slate-600"
      borderWidthClass="rounded-lg border"
      contentColorClass="text-yellow-200"
      contentFontClass="leading-relaxed text-lg"
      enableMobileTap={enableMobileTap}
      highlightEntities={entitiesForHighlighting}
      text={lastActionLog || undefined}
    />
  ) : null;

  const contextBox =
    localTime || localEnvironment || localPlace ? (
      <TextBox
        borderColorClass="border-slate-600"
        borderWidthClass="border-t"
        contentColorClass="text-slate-300"
        contentFontClass="text-lg"
        text={`Time: ${localTime ?? 'Unknown'}. Environment: ${localEnvironment ?? 'Unknown'} Location: ${localPlace ?? 'Unknown'}`}
      />
    ) : null;

  return (
    <div className="space-y-3">
      {lastActionBox}

      {descriptionTextBox}

      {contextBox}
    </div>
  );
}

SceneDisplay.defaultProps = {
  lastActionLog: null,
  localEnvironment: null,
  localPlace: null,
  localTime: null,
};

export default SceneDisplay;
