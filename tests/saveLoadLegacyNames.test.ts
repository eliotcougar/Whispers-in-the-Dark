import { describe, it, expect } from 'vitest';

import { prepareGameStateForSaving, expandSavedDataToFullState } from '../services/saveLoad/migrations';
import { postProcessValidatedData } from '../services/saveLoad/validators';
import { getInitialGameStates } from '../utils/initialStates';
import type { NPC, SavedGameDataShape } from '../types';

describe('save/load legacy NPC name migration', () => {
  it('restores known player names saved under knownPlayerNames', () => {
    const baseState = getInitialGameStates();

    const keeper: NPC = {
      id: 'npc-keeper-1a2b',
      name: 'Keeper Marel',
      description: 'Watches the northern gate and rarely forgets a name.',
      aliases: [],
      presenceStatus: 'nearby',
      attitudeTowardPlayer: 'cautious',
      knowsPlayerAs: ['Hero'],
      lastKnownLocation: 'North Gate',
      preciseLocation: null,
      dialogueSummaries: [],
    };

    const chronicler: NPC = {
      id: 'npc-chronicler-2b3c',
      name: 'The Chronicler',
      description: 'Keeps meticulous notes on everyone who passes through the archive.',
      aliases: [],
      presenceStatus: 'distant',
      attitudeTowardPlayer: 'neutral',
      knowsPlayerAs: ['Archivist'],
      lastKnownLocation: 'Archive Annex',
      preciseLocation: null,
      dialogueSummaries: [],
    };

    baseState.allNPCs = [keeper, chronicler];

    const saved = prepareGameStateForSaving(baseState);

    const legacySaved = {
      ...saved,
      allNPCs: saved.allNPCs.map((npc, index) => {
        const { knowsPlayerAs, ...rest } = npc;
        return {
          ...rest,
          knownPlayerNames: index === 1 ? 'Wayfarer' : knowsPlayerAs,
        };
      }),
    } as unknown as SavedGameDataShape;

    const processed = postProcessValidatedData(legacySaved);

    expect(processed.allNPCs[0].knowsPlayerAs).toEqual(['Hero']);
    expect(processed.allNPCs[1].knowsPlayerAs).toEqual(['Wayfarer']);
    expect('knownPlayerNames' in processed.allNPCs[0]).toBe(false);
    expect('knownPlayerNames' in processed.allNPCs[1]).toBe(false);

    const fullState = expandSavedDataToFullState(processed);

    expect(fullState.allNPCs[0].knowsPlayerAs).toEqual(['Hero']);
    expect(fullState.allNPCs[1].knowsPlayerAs).toEqual(['Wayfarer']);
  });
});
