import { describe, it, expect } from 'vitest';
import { isValidNPCUpdate, isValidNewNPCPayload } from '../services/parsers/validation';

const buildLongText = () => 'He has a complicated mix of admiration, curiosity, and concern that defies a neat label; it stretches well beyond the usual quick note about temperament.';

describe('npc attitude validation', () => {
  it('accepts attitude updates longer than 100 characters', () => {
    const payload = {
      name: 'Captain Mirell',
      newAttitudeTowardPlayer: buildLongText(),
    };

    expect(isValidNPCUpdate(payload)).toBe(true);
  });

  it('accepts long attitudes for new NPC payloads', () => {
    const payload = {
      name: 'Seer Alonna',
      description: 'A mystic whose eyes shimmer with distant starlight.',
      attitudeTowardPlayer: buildLongText(),
    };

    expect(isValidNewNPCPayload(payload)).toBe(true);
  });
});
