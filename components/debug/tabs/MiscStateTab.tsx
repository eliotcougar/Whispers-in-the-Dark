import DebugSection from '../DebugSection';
import type { FullGameState } from '../../../types';

interface MiscStateTabProps {
  readonly currentState: FullGameState;
}

function MiscStateTab({ currentState }: MiscStateTabProps) {
  const { lastTurnChanges } = currentState;
  const lastTurnChangesBrief = lastTurnChanges
    ? {
        npcs: lastTurnChanges.npcChanges.length,
        items: lastTurnChanges.itemChanges.length,
        mapChanged: lastTurnChanges.mapDataChanged,
        objAchieved: lastTurnChanges.objectiveAchieved,
        mainQuestAchieved: lastTurnChanges.mainQuestAchieved,
      }
    : null;

  return (
    <DebugSection
      content={{
        currentMapNodeId: currentState.currentMapNodeId,
        currentObjective: currentState.currentObjective,
        themeName: currentState.theme.name,
        globalTurnNumber: currentState.globalTurnNumber,
        lastTurnChangesBrief,
        localEnvironment: currentState.localEnvironment,
        localPlace: currentState.localPlace,
        localTime: currentState.localTime,
        mainQuest: currentState.mainQuest,
        objectiveAnimationType: currentState.objectiveAnimationType,
        score: currentState.score,
      }}
      maxHeightClass="max-h-[70vh]"
      title="Miscellaneous State Values"
    />
  );
}

export default MiscStateTab;
