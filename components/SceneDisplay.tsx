

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
      containerClassName="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700"
      contentFontClass="leading-relaxed text-lg"
      enableMobileTap={enableMobileTap}
      highlightEntities={entitiesForHighlighting}
      text={description || undefined}
    />
  );

  const lastActionBox = lastActionLog ? (
    <TextBox
      containerClassName="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700"
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
        borderColorClass="border-slate-700"
        borderWidthClass="border-b"
        containerClassName="mt-4 pt-3 border-t border-slate-700"
        contentColorClass="text-slate-300"
        contentFontClass="text-lg"
        text={`Time: ${localTime ?? 'Unknown'}. Environment: ${localEnvironment ?? 'Unknown'} Location: ${localPlace ?? 'Unknown'}`}
      />
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
