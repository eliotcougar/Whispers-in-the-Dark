import { describe, it, expect } from 'vitest';
import { resetInspectCooldowns } from '../utils/undoUtils';
import { getInitialGameStates } from '../utils/initialStates';
import { PLAYER_HOLDER_ID } from '../constants';

describe('resetInspectCooldowns', () => {
  it('clears future inspect timestamps', () => {
    const state = getInitialGameStates();
    state.globalTurnNumber = 4;
    state.inventory = [{
      id: 'p1',
      name: 'Page',
      type: 'page',
      description: 'note',
      holderId: PLAYER_HOLDER_ID,
      lastInspectTurn: 6,
    }];
    state.lastJournalInspectTurn = 7;
    const cleaned = resetInspectCooldowns(state);
    expect(cleaned.inventory[0].lastInspectTurn).toBeUndefined();
    expect(cleaned.lastJournalInspectTurn).toBe(0);
  });

  it('clears inspect timestamps equal to current turn', () => {
    const state = getInitialGameStates();
    state.globalTurnNumber = 4;
    state.inventory = [{
      id: 'p1',
      name: 'Page',
      type: 'page',
      description: 'note',
      holderId: PLAYER_HOLDER_ID,
      lastInspectTurn: 4,
    }];
    state.lastJournalInspectTurn = 4;
    const cleaned = resetInspectCooldowns(state);
    expect(cleaned.inventory[0].lastInspectTurn).toBeUndefined();
    expect(cleaned.lastJournalInspectTurn).toBe(0);
  });

  it('preserves valid inspect timestamps', () => {
    const state = getInitialGameStates();
    state.globalTurnNumber = 4;
    state.inventory = [{
      id: 'p1',
      name: 'Page',
      type: 'page',
      description: 'note',
      holderId: PLAYER_HOLDER_ID,
      lastInspectTurn: 3,
    }];
    state.lastJournalInspectTurn = 2;
    const cleaned = resetInspectCooldowns(state);
    expect(cleaned.inventory[0].lastInspectTurn).toBe(3);
    expect(cleaned.lastJournalInspectTurn).toBe(2);
  });
});
