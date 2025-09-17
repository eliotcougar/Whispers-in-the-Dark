import { describe, it, expect } from 'vitest';
import { buildNPCChangeRecords, applyAllNPCChanges } from '../utils/npcUtils';
import type { ValidNewNPCPayload } from '../types';

describe('npcUtils', () => {
  it('applyAllNPCChanges adds new NPC', () => {
    const newNPC: ValidNewNPCPayload = {
      name: 'Alice',
      description: 'An adventurer',
      attitudeTowardPlayer: 'neutral',
      knowsPlayerAs: [],
    };
    const result = applyAllNPCChanges([newNPC], [], []);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
    expect(result[0].attitudeTowardPlayer).toBe('neutral');
    expect(result[0].knowsPlayerAs).toEqual([]);
  });

  it('buildNPCChangeRecords returns add record', () => {
    const newNPC: ValidNewNPCPayload = {
      name: 'Bob',
      description: 'NPC',
      attitudeTowardPlayer: 'wary',
      knowsPlayerAs: ['Traveler'],
    };
    const records = buildNPCChangeRecords([newNPC], [], []);
    expect(records[0].npcName).toBe('Bob');
    expect(records[0].type).toBe('add');
    expect(records[0].addedNPC?.attitudeTowardPlayer).toBe('wary');
    expect(records[0].addedNPC?.knowsPlayerAs).toEqual(['Traveler']);
  });
});
