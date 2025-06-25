import { describe, it, expect } from 'vitest';
import { buildNPCChangeRecords, applyAllNPCChanges } from '../utils/npcUtils';
import type { ValidNewNPCPayload } from '../types';

describe('npcUtils', () => {
  it('applyAllNPCChanges adds new NPC', () => {
    const newNPC: ValidNewNPCPayload = {
      name: 'Alice',
      description: 'An adventurer',
    };
    const result = applyAllNPCChanges([newNPC], [], 'theme', []);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
  });

  it('buildNPCChangeRecords returns add record', () => {
    const newNPC: ValidNewNPCPayload = {
      name: 'Bob',
      description: 'NPC',
    };
    const records = buildNPCChangeRecords([newNPC], [], 'theme', []);
    expect(records[0].npcName).toBe('Bob');
    expect(records[0].type).toBe('add');
  });
});
