import DebugSection from '../DebugSection';
import type { FullGameState } from '../../../types';

interface MiscStateTabProps {
  readonly currentState: FullGameState;
}

function MiscStateTab({ currentState }: MiscStateTabProps) {
  return (
    <DebugSection
      content={{
      currentMapNodeId: currentState.currentMapNodeId,
      currentObjective: currentState.currentObjective,
      currentThemeName: currentState.currentThemeName,
      globalTurnNumber: currentState.globalTurnNumber,
      lastTurnChangesBrief: currentState.lastTurnChanges ? {
        npcs: currentState.lastTurnChanges.npcChanges.length,
        items: currentState.lastTurnChanges.itemChanges.length,
        mapChanged: currentState.lastTurnChanges.mapDataChanged,
        objAchieved: currentState.lastTurnChanges.objectiveAchieved,
        mainQuestAchieved: currentState.lastTurnChanges.mainQuestAchieved,
      } : null,
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
