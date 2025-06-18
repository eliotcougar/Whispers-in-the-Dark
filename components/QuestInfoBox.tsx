import { useMemo } from 'react';

interface QuestInfoBoxProps {
  readonly mainQuest?: string | null;
  readonly currentObjective?: string | null;
  readonly objectiveAnimationType?: 'success' | 'neutral' | null;
}

function QuestInfoBox({ mainQuest, currentObjective, objectiveAnimationType }: QuestInfoBoxProps) {
  const objectiveBoxClasses = useMemo(() => {
    const baseClass = 'p-3 bg-amber-900/50 border border-amber-700 rounded-md';
    if (objectiveAnimationType === 'success') return `${baseClass} animate-objective-success`;
    if (objectiveAnimationType === 'neutral') return `${baseClass} animate-objective-neutral`;
    return baseClass;
  }, [objectiveAnimationType]);

  return (
    <div className="space-y-4">
      {mainQuest ? <div className="p-3 bg-purple-900/50 border border-purple-700 rounded-md">
        <h3 className="text-lg font-semibold text-purple-300">
          Main Quest:
        </h3>

        <p className="text-purple-200 text-lg">
          {mainQuest}
        </p>
      </div> : null}

      {currentObjective ? <div className={objectiveBoxClasses}>
        <h3 className="text-lg font-semibold text-amber-300">
          Current Objective:
        </h3>

        <p className="text-amber-200 text-lg">
          {currentObjective}
        </p>
      </div> : null}
    </div>
  );
}

QuestInfoBox.defaultProps = {
  mainQuest: null,
  currentObjective: null,
  objectiveAnimationType: null
};

export default QuestInfoBox;
