import { structuredCloneGameState } from './cloneUtils';
import { FullGameState } from '../types';

/**
 * Resets inspect-related cooldown timestamps that point to future turns.
 *
 * @param state - Game state to sanitize.
 * @returns Deep-cloned state with invalid inspect timestamps cleared.
 */
export function resetInspectCooldowns(state: FullGameState): FullGameState {
  const cleaned = structuredCloneGameState(state);
  cleaned.inventory = cleaned.inventory.map(item => (
    item.lastInspectTurn !== undefined && item.lastInspectTurn > cleaned.globalTurnNumber
      ? { ...item, lastInspectTurn: undefined }
      : item
  ));
  if (cleaned.lastJournalInspectTurn > cleaned.globalTurnNumber) {
    cleaned.lastJournalInspectTurn = 0;
  }
  return cleaned;
}
