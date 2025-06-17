

/**
 * @file SceneDisplay.tsx
 * @description Shows the main scene description and local context.
 */
import { useMemo } from 'react';

import * as React from 'react';
import { Item, Character, MapNode } from '../types';
import { highlightEntitiesInText, buildHighlightableEntities } from '../utils/highlightHelper';

interface SceneDisplayProps {
  readonly description: string;
  readonly lastActionLog?: string | null;
  readonly inventory: Item[];
  readonly mapData: MapNode[];
  readonly allCharacters: Character[];
  readonly currentThemeName: string | null;
  readonly localTime?: string | null;
  readonly localEnvironment?: string | null;
  readonly localPlace?: string | null;
}

/**
 * Displays the current scene description and quest objectives.
 */
const SceneDisplay: React.FC<SceneDisplayProps> = ({
  description,
  lastActionLog,
  inventory,
  mapData,
  allCharacters,
  currentThemeName,
  localTime,
  localEnvironment,
  localPlace,
}) => {

  const entitiesForHighlighting = useMemo(
    () => buildHighlightableEntities(inventory, mapData, allCharacters, currentThemeName),
    [inventory, mapData, allCharacters, currentThemeName]
  );

  const enableMobileTap =
    typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

  const highlightedDescription = useMemo(() => {
    return description.split('\n').map((para) => (
      <p className="mb-4 leading-relaxed text-lg text-slate-300" key={para}>
        {highlightEntitiesInText(para, entitiesForHighlighting, enableMobileTap)}
      </p>
    ));
  }, [description, entitiesForHighlighting, enableMobileTap]);

  const highlightedLastActionLog = useMemo(() => {
    return highlightEntitiesInText(lastActionLog, entitiesForHighlighting, enableMobileTap);
  }, [lastActionLog, entitiesForHighlighting, enableMobileTap]);

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700 min-h-[200px]">

      {lastActionLog ? <div className="mb-4 p-3 bg-slate-700/50 border border-slate-600 rounded-md">
        <p className="text-yellow-200 text-lg">{highlightedLastActionLog}</p>
      </div> : null}

      {highlightedDescription}
      
      {(localTime || localEnvironment || localPlace) ? <div className="mt-4 pt-3 border-t border-slate-700">
        <p className="text-lg text-slate-400">
          <strong className="text-slate-300">Time:</strong> {localTime || "Unknown"}.{' '}

          <strong className="text-slate-300">Environment:</strong> {localEnvironment || "Unknown"}.{' '}

          <strong className="text-slate-300">Location:</strong> {localPlace || "Unknown"}.
        </p>
      </div> : null}
    </div>
  );
};

export default SceneDisplay;
