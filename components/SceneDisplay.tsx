

/**
 * @file SceneDisplay.tsx
 * @description Shows the main scene description and objectives.
 */
import React, { useMemo } from 'react';
import { Item, Character, MapNode } from '../types';
import { highlightEntitiesInText, buildHighlightableEntities } from '../utils/highlightHelper';

interface SceneDisplayProps {
  description: string;
  mainQuest?: string | null;
  currentObjective?: string | null;
  lastActionLog?: string | null;
  inventory: Item[];
  mapData: MapNode[]; 
  allCharacters: Character[];
  currentThemeName: string | null;
  objectiveAnimationType?: 'success' | 'neutral' | null; 
  localTime?: string | null; 
  localEnvironment?: string | null;
  localPlace?: string | null;
}

/**
 * Displays the current scene description and quest objectives.
 */
const SceneDisplay: React.FC<SceneDisplayProps> = ({
  description,
  mainQuest,
  currentObjective,
  lastActionLog,
  inventory,
  mapData, 
  allCharacters,
  currentThemeName,
  objectiveAnimationType,
  localTime, 
  localEnvironment, 
  localPlace,
}) => {

  const entitiesForHighlighting = useMemo(
    () => buildHighlightableEntities(inventory, mapData, allCharacters, currentThemeName),
    [inventory, mapData, allCharacters, currentThemeName]
  );

  const highlightedDescription = useMemo(() => {
    return description.split('\n').map((para, index) => (
      <p key={index} className="mb-4 leading-relaxed text-lg text-slate-300">
        {highlightEntitiesInText(para, entitiesForHighlighting)}
      </p>
    ));
  }, [description, entitiesForHighlighting]);

  const highlightedLastActionLog = useMemo(() => {
    return highlightEntitiesInText(lastActionLog, entitiesForHighlighting);
  }, [lastActionLog, entitiesForHighlighting]);

  const objectiveBoxClasses = useMemo(() => {
    const baseClass = "mb-4 p-3 bg-amber-900/50 border border-amber-700 rounded-md";
    if (objectiveAnimationType === 'success') {
      return `${baseClass} animate-objective-success`;
    }
    if (objectiveAnimationType === 'neutral') {
      return `${baseClass} animate-objective-neutral`;
    }
    return baseClass;
  }, [objectiveAnimationType]);

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700 min-h-[200px]">

      {mainQuest && (
        <div className="mb-4 p-3 bg-purple-900/50 border border-purple-700 rounded-md">
          <h3 className="text-lg font-semibold text-purple-300">Main Quest:</h3>
          <p className="text-purple-200 text-lg">{mainQuest}</p> 
        </div>
      )}

      {currentObjective && (
        <div className={objectiveBoxClasses}>
          <h3 className="text-lg font-semibold text-amber-300">Current Objective:</h3>
          <p className="text-amber-200 text-lg">{currentObjective}</p> 
        </div>
      )}
      {lastActionLog && (
        <div className="mb-4 p-3 bg-slate-700/50 border border-slate-600 rounded-md">
          <p className="text-yellow-200 text-lg">{highlightedLastActionLog}</p> 
        </div>
      )}
      {highlightedDescription}
      
      {(localTime || localEnvironment || localPlace) && (
        <div className="mt-4 pt-3 border-t border-slate-700">
          <p className="text-lg text-slate-400">
            <strong className="text-slate-300">Time:</strong> {localTime || "Unknown"}.{' '}
            <strong className="text-slate-300">Environment:</strong> {localEnvironment || "Unknown"}.{' '}
            <strong className="text-slate-300">Location:</strong> {localPlace || "Unknown"}.
          </p>
        </div>
      )}
    </div>
  );
};

export default SceneDisplay;
