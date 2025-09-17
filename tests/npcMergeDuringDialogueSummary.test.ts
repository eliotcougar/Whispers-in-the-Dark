import { describe, it, expect } from 'vitest';
import { applyAllNPCChanges } from '../utils/npcUtils';
import type { NPC, ValidNewNPCPayload, ValidNPCUpdatePayload, DialogueSummaryRecord } from '../types';

describe('NPC attitude update with existing dialogue memories', () => {
  it('preserves dialogueSummaries while applying newAttitudeTowardPlayer', () => {
    const existingSummary: DialogueSummaryRecord = {
      summaryText: 'Talked about the weather',
      participants: ['Alice'],
      timestamp: 'Noon',
      location: 'Town Square',
    };

    const base: Array<NPC> = [{
      id: 'npc-alice',
      name: 'Alice',
      description: 'A villager',
      aliases: [],
      presenceStatus: 'nearby',
      attitudeTowardPlayer: 'neutral',
      knowsPlayerAs: [],
      lastKnownLocation: null,
      preciseLocation: null,
      dialogueSummaries: [existingSummary],
    }];

    const adds: Array<ValidNewNPCPayload> = [];
    const updates: Array<ValidNPCUpdatePayload> = [{
      name: 'Alice',
      newAttitudeTowardPlayer: 'friendly',
    }];

    const result = applyAllNPCChanges(adds, updates, base);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
    expect(result[0].attitudeTowardPlayer).toBe('friendly');
    expect(result[0].dialogueSummaries?.length).toBe(1);
    expect(result[0].dialogueSummaries?.[0].summaryText).toBe('Talked about the weather');
  });
});
