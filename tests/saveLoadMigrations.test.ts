import { describe, it, expect } from 'vitest';
import { normalizeLoadedSaveData, normalizeLoadedSaveDataStack, prepareGameStateForSaving } from '../services/saveLoad/migrations';
import { getInitialGameStates } from '../utils/initialStates';

const buildLegacySave = (overrides?: Partial<Record<string, unknown>>) => {
  const baseGameState = getInitialGameStates();
  const saved = prepareGameStateForSaving(baseGameState);
  const legacy = { ...saved, ...overrides } as Record<string, unknown>;
  legacy.saveGameVersion = '8';
  delete legacy.loreFacts;
  legacy.themeFacts = overrides?.themeFacts ?? [];
  return legacy;
};

describe('save/load migrations', () => {
  it('migrates themeFacts to loreFacts on single save data', () => {
    const parsed = buildLegacySave({
      themeFacts: [{ id: 1, text: 'Old Fact', entities: [], tier: 1, createdTurn: 0 }],
    });

    const migrated = normalizeLoadedSaveData(parsed, 'test');
    expect(migrated).not.toBeNull();
    expect(migrated?.loreFacts).toEqual([{ id: 1, text: 'Old Fact', entities: [], tier: 1, createdTurn: 0 }]);
    expect((migrated as Record<string, unknown>).themeFacts).toBeUndefined();
  });

  it('migrates themeFacts in stacked save data', () => {
    const stack = {
      current: buildLegacySave(),
      previous: buildLegacySave({
        themeFacts: [{ id: 2, text: 'Prev', entities: [], tier: 1, createdTurn: 0 }],
      }),
    } as unknown as Record<string, unknown>;

    const migrated = normalizeLoadedSaveDataStack(stack, 'test');
    expect(migrated?.current.loreFacts).toEqual([]);
    expect(migrated?.previous?.loreFacts).toEqual([{ id: 2, text: 'Prev', entities: [], tier: 1, createdTurn: 0 }]);
  });
});
