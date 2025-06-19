

/**
 * @file SceneDisplay.tsx
 * @description Shows the main scene description and local context.
 */
import { useMemo } from 'react';

import { Item, Character, MapNode } from '../types';
import { buildHighlightableEntities } from '../utils/highlightHelper';
import TextBox from './elements/TextBox';

interface SceneDisplayProps {
  readonly description: string;
  readonly lastActionLog?: string | null;
  readonly inventory: Array<Item>;
  readonly mapData: Array<MapNode>;
  readonly allCharacters: Array<Character>;
  readonly currentThemeName: string | null;
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
  allCharacters,
  currentThemeName,
  localTime,
  localEnvironment,
  localPlace,
}: SceneDisplayProps) {

  const entitiesForHighlighting = useMemo(
    () => buildHighlightableEntities(inventory, mapData, allCharacters, currentThemeName),
    [inventory, mapData, allCharacters, currentThemeName]
  );

  const enableMobileTap =
    typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

  const descriptionTextBox = (
    <TextBox
      containerClassName="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700 min-h-[200px]"
      contentFontClass="leading-relaxed text-lg"
      enableMobileTap={enableMobileTap}
      header="Scene"
      headerColorClass="text-slate-300"
      headerFontClass="text-2xl font-semibold"
      highlightEntities={entitiesForHighlighting}
      text={description}
    />
  );

  const lastActionBox = lastActionLog ? (
    <TextBox
      containerClassName="mb-4 p-3 bg-slate-700/50 border border-slate-600 rounded-md"
      contentColorClass="text-yellow-200"
      contentFontClass="text-lg"
      enableMobileTap={enableMobileTap}
      header="Last Action"
      headerColorClass="text-yellow-200"
      headerFontClass="text-lg font-semibold"
      headerTag="h3"
      highlightEntities={entitiesForHighlighting}
      text={lastActionLog || undefined}
    />
  ) : null;

  const contextBox =
    localTime || localEnvironment || localPlace ? (
      <TextBox
        borderColorClass="border-slate-700"
        borderWidthClass="border-b"
        containerClassName="mt-4 pt-3 border-t border-slate-700"
        contentColorClass="text-slate-400"
        contentFontClass="text-lg"
        header="Local Context"
        headerColorClass="text-slate-300"
        headerFontClass="text-lg font-semibold"
        headerTag="h3"
      >
        <p>
          {`Time: ${localTime ?? 'Unknown'} Environment: ${localEnvironment ?? 'Unknown'} Location: ${localPlace ?? 'Unknown'}`}
        </p>
      </TextBox>
    ) : null;

  return (
    <div className="space-y-4">
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
