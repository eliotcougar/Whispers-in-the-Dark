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
      isAwaitingManualShiftThemeSelection: currentState.isAwaitingManualShiftThemeSelection,
      isCustomGameMode: currentState.isCustomGameMode,
      lastTurnChangesBrief: currentState.lastTurnChanges ? {
        chars: currentState.lastTurnChanges.characterChanges.length,
        items: currentState.lastTurnChanges.itemChanges.length,
        mapChanged: currentState.lastTurnChanges.mapDataChanged,
        objAchieved: currentState.lastTurnChanges.objectiveAchieved,
      } : null,
      localEnvironment: currentState.localEnvironment,
      localPlace: currentState.localPlace,
      localTime: currentState.localTime,
      mainQuest: currentState.mainQuest,
      objectiveAnimationType: currentState.objectiveAnimationType,
      pendingNewThemeNameAfterShift: currentState.pendingNewThemeNameAfterShift,
      score: currentState.score,
      turnsSinceLastShift: currentState.turnsSinceLastShift,
    }}
    maxHeightClass="max-h-[70vh]"
    title="Miscellaneous State Values"
  />
  );
}

export default MiscStateTab;
