import { describe, it, expect } from 'vitest';
import { buildCharacterChangeRecords, applyAllCharacterChanges } from '../utils/characterUtils';
import type { ValidNewCharacterPayload } from '../types';

describe('characterUtils', () => {
  it('applyAllCharacterChanges adds new character', () => {
    const newChar: ValidNewCharacterPayload = {
      name: 'Alice',
      description: 'An adventurer',
    };
    const result = applyAllCharacterChanges([newChar], [], 'theme', []);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
  });

  it('buildCharacterChangeRecords returns add record', () => {
    const newChar: ValidNewCharacterPayload = {
      name: 'Bob',
      description: 'NPC',
    };
    const records = buildCharacterChangeRecords([newChar], [], 'theme', []);
    expect(records[0].characterName).toBe('Bob');
    expect(records[0].type).toBe('add');
  });
});
